const { app, BrowserWindow, ipcMain, screen, globalShortcut, shell, desktopCapturer } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawn, exec, execFile } = require('child_process');
const { BridgeRequests, ramPolicy, matchesApp, findAppWindow, appMatchScore } = require('./runtime-policy');
const { AppCatalog } = require('./app-catalog');
const { WindowPreviews } = require('./window-previews');
const systemControls = require('./system-controls');
const readline = require('readline');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('enable-hardware-overlays', 'single-fullscreen,underlays,extra-fullscreen');
app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder,CanvasOopRasterization,UseSkiaRenderer');
let mainWindow = null;
let homeBarWindow = null;
let splitDividerWindow = null;
let currentSplitLayout = [];
let bridgeProc = null;
let bridgeReady = false;
let currentForegroundHwnd = null;
let currentForegroundPid = null;
let activeLaunchInfo = null;
let snapshotTimer = null;
let activeAppCpuTimer = null;
let cleanupStarted = false;
let launchGate = null;
let launchSerial = 0;
let launcherView = 'home';
let knownWindows = [];
let foregroundCaptureTimer = null;
const windowApps = new Map();
const appWatchers = [];
const requests = new BridgeRequests(sendBridgeCommand);
let openedAppOrder = [];
let ramWarningNotified = false;
let memoryCritical = false;
let discoveryTimer = null;
function isProtectedSystemProcess(procName) {
    if (!procName) return false;
    const name = String(procName).toLowerCase().trim();
    const protectedList = [
        'explorer.exe', 'dwm.exe', 'taskmgr.exe', 'system', 'registry',
        'smss.exe', 'csrss.exe', 'wininit.exe', 'services.exe', 'lsass.exe',
        'svchost.exe', 'fontdrvhost.exe', 'winlogon.exe', 'sihost.exe',
        'ctfmon.exe', 'shellexperiencehost.exe', 'searchhost.exe', 'startmenuexperiencehost.exe',
        'electron.exe', 'AeroIOS.exe', 'code.exe'
    ];
    return protectedList.includes(name);
}
function forceKillProcessAndWindow(hwnd, pid) {
    if (!hwnd || IsLauncherOrHomebarHwnd(hwnd)) return false;
    const numHwnd = Number(hwnd);
    sendBridgeCommand({ cmd: 'close_window', hwnd: numHwnd });
    if (pid && Number(pid) > 4 && Number(pid) !== process.pid) {
        try { process.kill(Number(pid), 'SIGKILL'); } catch (_) {}
        try { exec(`taskkill /F /T /PID ${pid}`, { windowsHide: true }, () => {}); } catch (_) {}
    }
    windowApps.delete(numHwnd);
    openedAppOrder = openedAppOrder.filter(item => Number(item.hwnd) !== numHwnd && (!pid || Number(item.pid) !== Number(pid)));
    knownWindows = knownWindows.filter(win => Number(win.hwnd) !== numHwnd);
    return true;
}
let isEmergencyFreeingRam = false;
let lastRamAlertLevel = 'normal';
function recordAppForeground(hwnd, pid, title) {
    if (!hwnd || IsLauncherOrHomebarHwnd(hwnd)) return;
    const numHwnd = Number(hwnd);
    openedAppOrder = openedAppOrder.filter(a => Number(a.hwnd) !== numHwnd);
    openedAppOrder.push({ hwnd: numHwnd, pid: Number(pid), title: title || '', time: Date.now() });
    if (openedAppOrder.length > 256) openedAppOrder.shift();
}
async function handleRamManagement(stats) {
    if (!stats || typeof stats.ramPct !== 'number') return;
    const ramPct = stats.ramPct;
    let currentLevel = 'normal';
    if (ramPct >= 97) currentLevel = 'critical';
    else if (ramPct >= 85) currentLevel = 'high';
    else if (ramPct >= 65) currentLevel = 'warning';
    const ramPayload = {
        ramPct: Math.round(ramPct),
        ramUsedGB: stats.ramUsedGB,
        ramTotalGB: stats.ramTotalGB,
        level: currentLevel,
        cpu: Math.round(stats.cpu || 0)
    };
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('ram-update', ramPayload);
    }
    if (homeBarWindow && !homeBarWindow.isDestroyed()) {
        homeBarWindow.webContents.send('ram-update', ramPayload);
    }
    if (currentLevel !== 'normal' && currentLevel !== lastRamAlertLevel) {
        lastRamAlertLevel = currentLevel;
        let msg = '';
        if (currentLevel === 'warning') msg = `Mức RAM đang tăng: ${Math.round(ramPct)}%`;
        else if (currentLevel === 'high') msg = `Cảnh báo: Bộ nhớ RAM cao (${Math.round(ramPct)}%)!`;
        else if (currentLevel === 'critical') msg = `Báo động: RAM đạt ${Math.round(ramPct)}%! Đang tự giải phóng...`;
        const alertData = { level: currentLevel, ramPct: Math.round(ramPct), message: msg };
        if (homeBarWindow && !homeBarWindow.isDestroyed()) homeBarWindow.webContents.send('ram-alert', alertData);
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('ram-alert', alertData);
    } else if (currentLevel === 'normal') {
        lastRamAlertLevel = 'normal';
    }
    if (ramPct >= 97 && !isEmergencyFreeingRam) {
        isEmergencyFreeingRam = true;
        try {
            const windows = await getNativeWindows();
            const candidates = windows.filter(w => !IsLauncherOrHomebarHwnd(w.hwnd) && !isProtectedSystemProcess(w.processName));
            if (candidates.length > 0) {
                let target = null;
                for (const item of openedAppOrder) {
                    const match = candidates.find(c => Number(c.hwnd) === Number(item.hwnd) || (item.pid && Number(c.pid) === Number(item.pid)));
                    if (match) { target = match; break; }
                }
                if (!target) target = candidates[0];
                const targetTitle = target.title || target.processName || 'Ứng dụng';
                forceKillProcessAndWindow(target.hwnd, target.pid);
                const purgeMsg = {
                    level: 'critical',
                    ramPct: Math.round(ramPct),
                    message: `Đã tự động đóng "${targetTitle}" để giải phóng RAM (${Math.round(ramPct)}%)`
                };
                if (homeBarWindow && !homeBarWindow.isDestroyed()) homeBarWindow.webContents.send('ram-alert', purgeMsg);
                if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('ram-alert', purgeMsg);
            }
        } finally {
            setTimeout(() => { isEmergencyFreeingRam = false; }, 2000);
        }
    }
    const critical = ramPolicy(stats).critical;
    if (critical !== memoryCritical && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('memory-pressure', { critical });
    }
    memoryCritical = critical;
}
const SNAPSHOTS_DIR = path.join(__dirname, 'cache', 'snapshots');
if (!fs.existsSync(SNAPSHOTS_DIR)) fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
const catalog = new AppCatalog(shell, __dirname);
const previews = new WindowPreviews(desktopCapturer, SNAPSHOTS_DIR);
function getAppKey(appId) {
    if (!appId) return 'app';
    return crypto.createHash('md5').update(appId).digest('hex').substring(0, 12);
}
function startCoreBridge() {
    const bridgePath = fs.existsSync(path.join(__dirname, 'core_bridge_new.exe'))
        ? path.join(__dirname, 'core_bridge_new.exe')
        : path.join(__dirname, 'core_bridge.exe');
    bridgeProc = spawn(bridgePath, [], {
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe']
    });
    const rl = readline.createInterface({
        input: bridgeProc.stdout,
        terminal: false
    });
    rl.on('line', (line) => {
        try {
            const msg = JSON.parse(line.trim());
            handleBridgeMessage(msg);
        } catch (e) {
        }
    });
    bridgeProc.stderr.on('data', (d) => {
        console.error('Bridge STDERR:', d.toString());
    });
    bridgeProc.on('exit', (code) => {
        bridgeReady = false;
        requests.dispose();
        console.log('Bridge exited with code:', code);
    });
    bridgeProc.on('error', err => { console.error('Bridge:', err.message); requests.dispose(); });
    bridgeProc.stdin.on('error', err => console.error('Bridge input:', err.message));
}
function sendBridgeCommand(cmdObj) {
    if (!bridgeProc || !bridgeProc.stdin.writable || bridgeProc.stdin.destroyed) return false;
    const str = JSON.stringify(cmdObj) + '\n';
    bridgeProc.stdin.write(str);
    return true;
}
function handleBridgeMessage(msg) {
    if (msg.rect && mainWindow && !mainWindow.isDestroyed() && screen.screenToDipRect) {
        const origin = mainWindow.getBounds();
        const r = screen.screenToDipRect(mainWindow, { x: msg.rect.x, y: msg.rect.y, width: msg.rect.w, height: msg.rect.h });
        msg = { ...msg, coordinateSpace: 'launcher', rect: { x: r.x - origin.x, y: r.y - origin.y, w: r.width, h: r.height } };
    }
    if (msg.type === 'bridge_ready') {
        bridgeReady = true;
        console.log('Core Bridge is READY.');
        sendBridgeCommand({ cmd: 'set_launcher_pid', pid: process.pid });
        if (mainWindow && !mainWindow.isDestroyed()) {
            const handle = mainWindow.getNativeWindowHandle();
            const hwnd = handle.readBigUInt64LE ? handle.readBigUInt64LE(0) : handle.readUInt32LE(0);
            sendBridgeCommand({ cmd: 'set_launcher_hwnd', hwnd: Number(hwnd) });
        }
        if (homeBarWindow && !homeBarWindow.isDestroyed()) {
            const handle = homeBarWindow.getNativeWindowHandle();
            const hwnd = handle.readBigUInt64LE ? handle.readBigUInt64LE(0) : handle.readUInt32LE(0);
            sendBridgeCommand({ cmd: 'set_homebar_hwnd', hwnd: Number(hwnd) });
        }
        sendBridgeCommand({ cmd: 'hide_taskbar' });
        return;
    }
    if (msg.type === 'windows_list') {
        knownWindows = msg.data.filter(win => !IsLauncherOrHomebarHwnd(win.hwnd));
        associateWindows(knownWindows);
        if (launchGate) discoverLaunchWindow(launchGate, knownWindows);
        requests.resolve('windows_list', knownWindows); return;
    }
    if (msg.type === 'action_ack') {
        requests.resolve('action_' + msg.action + '_' + msg.hwnd, msg.success !== false);
        return;
    }
    if (msg.type === 'capture_result') { requests.resolve('capture_' + msg.hwnd, msg.success); return; }
    if (msg.type === 'controls_result') { requests.resolve('controls', msg); return; }
    if (msg.type === 'control_ack') { requests.resolve('control_' + msg.id, msg); return; }
    if (msg.type === 'window_info') { requests.resolve('info_' + msg.hwnd, msg); return; }
    if (msg.type === 'system_stats') {
        handleRamManagement(msg); requests.resolve('system_stats', msg); return;
    }
    if (msg.event === 'foreground_changed') {
        if (launchGate && !matchesApp(msg, launchGate.app)) return;
        currentForegroundHwnd = msg.hwnd;
        currentForegroundPid = msg.pid;
        recordAppForeground(msg.hwnd, msg.pid, msg.title);
        if (launchGate) {
            launchGate.window = msg;
            windowApps.set(Number(msg.hwnd), launchGate.app);
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.setAlwaysOnTop(true, 'pop-up-menu');
                sendBridgeCommand({ cmd: 'raise_launcher' });
                keepHomebarVisible();
            }
        }
        if (activeLaunchInfo && (Date.now() - activeLaunchInfo.timestamp < 12000)) {
            sendBridgeCommand({ cmd: 'set_cpu_mode', mode: 'launch', targetPid: currentForegroundPid });
        }
        if (mainWindow && !mainWindow.isDestroyed()) {
            if (!launchGate) mainWindow.webContents.send('event-foreground-changed', msg);
        }
        const previous = knownWindows.findIndex(win => Number(win.hwnd) === Number(msg.hwnd));
        if (previous >= 0) knownWindows[previous] = { ...knownWindows[previous], ...msg, isMinimized: false };
        else knownWindows.push({ ...msg, isMinimized: false });
        associateWindows(knownWindows);
        if (!launchGate) scheduleWindowCapture();
        if (activeAppCpuTimer) clearTimeout(activeAppCpuTimer);
        activeAppCpuTimer = setTimeout(() => {
            if (currentForegroundHwnd && currentForegroundPid) {
                console.log(`[CPU Optimizer] App PID ${currentForegroundPid} active for >5s. Restoring normal launcher scheduling.`);
                sendBridgeCommand({ cmd: 'set_cpu_mode', mode: 'app_active', targetPid: currentForegroundPid });
            }
        }, 5000);
    } else if (msg.event === 'window_rect_changed') {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('event-window-rect-changed', msg);
        }
    } else if (msg.event === 'window_minimized' || msg.event === 'window_destroyed') {
        const hwnd = Number(msg.hwnd);
        const info = windowApps.get(hwnd);
        if (Number(currentForegroundHwnd) === hwnd && !launchGate && launcherView === 'app') showHome(hwnd, info, false);
        if (msg.event === 'window_destroyed') {
            windowApps.delete(hwnd);
            openedAppOrder = openedAppOrder.filter(item => Number(item.hwnd) !== hwnd);
            knownWindows = knownWindows.filter(win => Number(win.hwnd) !== hwnd);
        } else {
            const win = knownWindows.find(item => Number(item.hwnd) === hwnd);
            if (win) win.isMinimized = true;
        }
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(
            msg.event === 'window_destroyed' ? 'event-window-destroyed' : 'event-window-minimized', msg);
    }
}
function createMainWindow() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { x, y, width, height } = primaryDisplay.bounds;
    mainWindow = new BrowserWindow({
        x,
        y,
        width: width,
        height: height,
        frame: false,
        thickFrame: false,
        hasShadow: false,
        fullscreen: false,
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false,
        fullscreenable: false,
        transparent: false,
        backgroundColor: '#0a0a0f',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: true,
            backgroundThrottling: false
        }
    });
    mainWindow.webContents.on('console-message', (event, ...args) => {
        const msg = (typeof event === 'object' && event && event.message) ? event.message : (args[1] || event);
        console.log(`[Renderer] ${msg}`);
    });
    mainWindow.webContents.on('did-fail-load', (e, code, desc) => {
        console.error(`[Renderer Fail] ${code} ${desc}`);
    });
    mainWindow.loadFile('index.html');
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        mainWindow.focus();
        const handle = mainWindow.getNativeWindowHandle();
        const hwnd = handle.readBigUInt64LE ? handle.readBigUInt64LE(0) : handle.readUInt32LE(0);
        sendBridgeCommand({ cmd: 'set_launcher_hwnd', hwnd: Number(hwnd) });
        sendBridgeCommand({ cmd: 'hide_taskbar' });
        sendBridgeCommand({ cmd: 'raise_launcher' });
        setTimeout(() => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.show();
                mainWindow.focus();
            }
        }, 300);
    });
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
function createHomeBarWindow() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { x, y, width, height } = primaryDisplay.bounds;
    const barW = 340;
    const barH = 46;
    const barX = x + Math.floor((width - barW) / 2);
    const barY = y + height - barH;
    homeBarWindow = new BrowserWindow({
        x: barX,
        y: barY,
        width: barW,
        height: barH,
        frame: false,
        transparent: true,
        thickFrame: false,
        focusable: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        hasShadow: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload_homebar.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });
    homeBarWindow.loadFile('homebar.html');
    homeBarWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    const handle = homeBarWindow.getNativeWindowHandle();
    const hwnd = handle.readBigUInt64LE ? handle.readBigUInt64LE(0) : handle.readUInt32LE(0);
    sendBridgeCommand({ cmd: 'set_homebar_hwnd', hwnd: Number(hwnd) });
    homeBarWindow.on('closed', () => {
        homeBarWindow = null;
    });
}
function IsLauncherOrHomebarHwnd(hwnd) {
    return [mainWindow, homeBarWindow, splitDividerWindow].some(win => win && !win.isDestroyed() &&
        Number(win.getNativeWindowHandle().readBigUInt64LE(0)) === Number(hwnd));
}
function readAppsCache() {
    return catalog.read();
}
function keepHomebarVisible() {
    if (!homeBarWindow || homeBarWindow.isDestroyed()) return;
    homeBarWindow.setAlwaysOnTop(true, 'screen-saver');
    homeBarWindow.showInactive();
    sendBridgeCommand({ cmd: 'raise_homebar' });
}
function localWindowInfo(win) {
    if (!win || !win.rect || win.coordinateSpace === 'launcher') return win;
    const bounds = mainWindow.getBounds();
    const rect = screen.screenToDipRect ? screen.screenToDipRect(mainWindow,
        { x:win.rect.x, y:win.rect.y, width:win.rect.w, height:win.rect.h }) :
        { x:win.rect.x, y:win.rect.y, width:win.rect.w, height:win.rect.h };
    return { ...win, coordinateSpace: 'launcher', rect:{x:rect.x-bounds.x,y:rect.y-bounds.y,w:rect.width,h:rect.height} };
}
function associateWindows(windows) {
    const apps = readAppsCache();
    for (const win of windows) {
        let linked = windowApps.get(Number(win.hwnd));
        if (linked && linked.windowPid && linked.windowPid !== win.pid) { windowApps.delete(Number(win.hwnd)); linked = null; }
        if (!linked) {
            const match = apps.map(app => ({app, score:appMatchScore(win,app)})).filter(item=>item.score>0)
                .sort((a,b)=>b.score-a.score)[0];
            if (match) { linked = { ...match.app, key:getAppKey(match.app.appId), windowPid:win.pid }; windowApps.set(Number(win.hwnd), linked); }
        }
        if (linked) { win.appId = linked.appId; win.icon = linked.icon; win.appName = linked.name; }
        win.snapshotPath = previews.lookup(win);
    }
}
function discoverLaunchWindow(gate, windows) {
    if (gate !== launchGate) return null;
    const match = findAppWindow(windows, gate.app);
    if (match) {
        gate.targetHwnd = match.hwnd;
        gate.window = localWindowInfo(match);
        windowApps.set(Number(match.hwnd), { ...gate.app, windowPid:match.pid });
    }
    return gate.window;
}
function getNativeWindows() { return requests.request('windows_list', {cmd:'list_windows'}, knownWindows); }
function scheduleWindowCapture() {
    clearTimeout(foregroundCaptureTimer);
    foregroundCaptureTimer = setTimeout(cacheForegroundSnapshot, 450);
}
let scanPromise = null;
let scanAgain = false;
let lastAppsJSON = '';
function scanApps() {
    if (scanPromise) { scanAgain = true; return scanPromise; }
    scanPromise = new Promise(resolve => {
        execFile(process.execPath, [path.join(__dirname, 'scanner.js')], {
            cwd: __dirname, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
            windowsHide: true, timeout: 180000
        }, err => {
            if (err) console.error('Application scan:', err.message);
            const apps = readAppsCache();
            const serialized = JSON.stringify(apps);
            if (serialized !== lastAppsJSON && mainWindow && !mainWindow.isDestroyed()) {
                lastAppsJSON = serialized;
                mainWindow.webContents.send('apps-updated', apps);
            }
            resolve(apps);
        });
    }).finally(() => {
        scanPromise = null;
        if (scanAgain && !cleanupStarted) { scanAgain = false; scanApps(); }
    });
    return scanPromise;
}
ipcMain.handle('get-apps', () => {
    const apps = readAppsCache();
    return apps.length ? apps : scanApps();
});
let appWatcherDebounce = null;
function setupAppWatchers() {
    const dirs = [
        path.join(process.env.ProgramData || 'C:\\ProgramData', 'Microsoft/Windows/Start Menu/Programs'),
        path.join(process.env.APPDATA || '', 'Microsoft/Windows/Start Menu/Programs'),
        path.join(process.env.USERPROFILE || '', 'Desktop'),
        path.join(process.env.PUBLIC || '', 'Desktop')
    ];
    for (const dir of new Set(dirs)) {
        if (!fs.existsSync(dir)) continue;
        try {
            const watcher = fs.watch(dir, { recursive: true }, (_, filename) => {
                if (filename && /\.(tmp|jpg|png|json|log|cpp|js|css|html)$/i.test(filename)) return;
                clearTimeout(appWatcherDebounce);
                appWatcherDebounce = setTimeout(scanApps, 1800);
            });
            watcher.on('error', err => console.warn('Watcher:', err.message));
            appWatchers.push(watcher);
        } catch (err) { console.warn('Watcher:', err.message); }
    }
}
function autoCheckAppsCache() {
    const cache = path.join(__dirname, 'cache', 'apps.json');
    if (!fs.existsSync(cache) || Date.now() - fs.statSync(cache).mtimeMs > 3600000) scanApps();
}
ipcMain.handle('rescan-apps', scanApps);
ipcMain.handle('get-windows', async () => {
    const list = await getNativeWindows();
    return list.map(win => ({ ...win, snapshotPath: previews.lookup(win) }));
});
ipcMain.handle('get-window-previews', async () => {
    if (!memoryCritical && !launchGate) await previews.refresh(knownWindows, true);
    return knownWindows.map(win => ({ hwnd:win.hwnd, snapshotPath:previews.lookup(win) }));
});
ipcMain.handle('set-launcher-view', (_, view) => {
    if (['home','switcher'].includes(view)) {
        launcherView = view;
        if (view === 'switcher') { releaseLaunchCover(); currentForegroundHwnd = null; }
    }
    keepHomebarVisible();
});
ipcMain.handle('capture-window', (_, { hwnd }) => {
    if (launchGate || !Number.isSafeInteger(Number(hwnd)) || Number(hwnd) <= 0) return false;
    return requests.request('capture_' + hwnd, { cmd: 'capture_window', hwnd: Number(hwnd),
        path: path.join(SNAPSHOTS_DIR, 'snap_' + Number(hwnd) + '.jpg') }, false, 2500);
});
ipcMain.handle('minimize-window', (event, hwnd) => {
    sendBridgeCommand({ cmd: 'minimize', hwnd: Number(hwnd) });
    return true;
});
ipcMain.handle('restore-window', (event, hwnd) => {
    sendBridgeCommand({ cmd: 'restore', hwnd: Number(hwnd) });
    return true;
});
ipcMain.handle('maximize-window', (event, hwnd) => {
    sendBridgeCommand({ cmd: 'maximize', hwnd: Number(hwnd) });
    return true;
});
ipcMain.handle('close-window', async (_, hwnd) => {
    if (IsLauncherOrHomebarHwnd(hwnd)) return false;
    const numHwnd = Number(hwnd);
    const win = knownWindows.find(w => Number(w.hwnd) === numHwnd);
    const pid = win ? win.pid : null;
    return forceKillProcessAndWindow(numHwnd, pid);
});
ipcMain.handle('close-all-windows', async (_, selected) => {
    const windows = await getNativeWindows();
    const allowed = new Set(windows.map(win => Number(win.hwnd)));
    const targets = Array.isArray(selected) ? [...new Set(selected.map(Number))].filter(hwnd=>allowed.has(hwnd)) : [...allowed];
    for (const hwnd of targets) {
        if (!IsLauncherOrHomebarHwnd(hwnd)) {
            const win = windows.find(w => Number(w.hwnd) === Number(hwnd));
            forceKillProcessAndWindow(hwnd, win ? win.pid : null);
        }
    }
    return { success: true };
});
ipcMain.handle('hide-taskbar', () => {
    sendBridgeCommand({ cmd: 'hide_taskbar' });
    return true;
});
ipcMain.handle('show-taskbar', () => {
    sendBridgeCommand({ cmd: 'show_taskbar' });
    return true;
});
ipcMain.handle('get-stats', () => requests.request('system_stats', { cmd: 'get_stats' }, null));
ipcMain.handle('display-bounds', () => {
    const display = screen.getDisplayMatching(mainWindow.getBounds());
    return { ...display.bounds, scaleFactor: display.scaleFactor };
});
ipcMain.handle('get-controls', () => systemControls.getControls());
ipcMain.handle('set-control', (_, params) => systemControls.setControl(params));
ipcMain.handle('get-cached-snapshot', (event, appId) => {
    if (!appId || memoryCritical) return null;
    const preview = previews.forApp(appId);
    if (preview) return preview;
    const key = getAppKey(appId);
    const p = path.join(SNAPSHOTS_DIR, `app_${key}.jpg`);
    if (fs.existsSync(p) && fs.statSync(p).size > 1000) {
        return `cache/snapshots/app_${key}.jpg?t=${fs.statSync(p).mtimeMs}`;
    }
    return null;
});
ipcMain.handle('snap-windows', (event, layout) => {
    if (!Array.isArray(layout) || layout.length < 2 || layout.length > 4 ||
        new Set(layout.map(item => item.hwnd)).size !== layout.length) return false;
    currentSplitLayout = layout;
    sendBridgeCommand({ cmd: 'snap_windows', windows: nativeLayout(layout) });
    updateNativeDivider();
    return true;
});
ipcMain.handle('set-split-mode', (event, params) => {
    sendBridgeCommand({ cmd: 'set_split_mode', active: params.active });
    if (!params.active) {
        currentSplitLayout = [];
        if (splitDividerWindow && !splitDividerWindow.isDestroyed()) splitDividerWindow.hide();
    }
    return true;
});
ipcMain.handle('set-window-rect', (event, params) => {
    sendBridgeCommand({ cmd: 'set_window_rect', ...nativeLayout([params])[0] });
    return true;
});
function nativeLayout(layout) {
    const display = screen.getDisplayMatching(mainWindow.getBounds());
    return layout.map(item => {
        const r = screen.dipToScreenRect(mainWindow, { x: display.bounds.x + item.x,
            y: display.bounds.y + item.y, width: item.w, height: item.h });
        return { hwnd: Number(item.hwnd), x: r.x, y: r.y, w: Math.max(120, r.width), h: Math.max(120, r.height) };
    });
}
function updateNativeDivider() {
    if (currentSplitLayout.length !== 2) {
        if (splitDividerWindow && !splitDividerWindow.isDestroyed()) splitDividerWindow.hide();
        return;
    }
    if (!splitDividerWindow || splitDividerWindow.isDestroyed()) {
        splitDividerWindow = new BrowserWindow({ width: 28, height: 140, show: false,
            frame: false, transparent: true, alwaysOnTop: true, focusable: false,
            skipTaskbar: true, resizable: false, hasShadow: false,
            webPreferences: { preload: path.join(__dirname, 'preload_split.js'), contextIsolation: true, nodeIntegration: false } });
        splitDividerWindow.loadFile('split-divider.html');
        splitDividerWindow.setAlwaysOnTop(true, 'pop-up-menu');
    }
    const bounds = screen.getDisplayMatching(mainWindow.getBounds()).bounds;
    splitDividerWindow.setBounds({ x: bounds.x + currentSplitLayout[0].w - 14,
        y: bounds.y + Math.floor(bounds.height / 2) - 70, width: 28, height: 140 });
    splitDividerWindow.showInactive();
}
function dragNativeDivider(x) {
    if (currentSplitLayout.length !== 2 || !Number.isFinite(x)) return;
    const bounds = screen.getDisplayMatching(mainWindow.getBounds()).bounds;
    const width = Math.round(Math.max(bounds.width * .2, Math.min(bounds.width * .8, x - bounds.x)));
    currentSplitLayout[0] = { ...currentSplitLayout[0], x: 0, w: width };
    currentSplitLayout[1] = { ...currentSplitLayout[1], x: width, w: bounds.width - width };
    updateNativeDivider();
}
ipcMain.on('split-divider-drag', (event, x) => {
    if (splitDividerWindow && event.sender === splitDividerWindow.webContents) dragNativeDivider(x);
});
ipcMain.on('split-divider-commit', event => {
    if (splitDividerWindow && event.sender === splitDividerWindow.webContents)
        sendBridgeCommand({ cmd: 'snap_windows', windows: nativeLayout(currentSplitLayout) });
});
ipcMain.on('split-divider-center', event => {
    if (splitDividerWindow && event.sender === splitDividerWindow.webContents) {
        const bounds = screen.getDisplayMatching(mainWindow.getBounds()).bounds;
        dragNativeDivider(bounds.x + bounds.width / 2);
        sendBridgeCommand({ cmd: 'snap_windows', windows: nativeLayout(currentSplitLayout) });
    }
});
ipcMain.handle('open-wifi-settings', () => {
    shell.openExternal('ms-availablenetworks:');
    return true;
});
ipcMain.handle('open-bluetooth-settings', () => {
    shell.openExternal('ms-settings:bluetooth');
    return true;
});
ipcMain.handle('open-settings', (event, uri = '') => {
    if (!/^ms-settings:[a-z0-9-]*$/i.test(uri || 'ms-settings:')) return false;
    shell.openExternal(uri || 'ms-settings:');
    return true;
});
ipcMain.handle('set-cpu-mode', (event, { mode, targetPid }) => {
    sendBridgeCommand({ cmd: 'set_cpu_mode', mode, targetPid });
    return true;
});
function getDesktopFileType(ext, isDir) {
    if (isDir) return 'folder';
    ext = (ext || '').toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico'].includes(ext)) return 'image';
    if (['.txt', '.doc', '.docx', '.pdf', '.rtf', '.odt', '.md'].includes(ext)) return 'document';
    if (['.xls', '.xlsx', '.csv'].includes(ext)) return 'spreadsheet';
    if (['.ppt', '.pptx'].includes(ext)) return 'presentation';
    if (['.zip', '.rar', '.7z', '.tar', '.gz'].includes(ext)) return 'archive';
    if (['.mp4', '.mkv', '.avi', '.mov', '.wmv'].includes(ext)) return 'video';
    if (['.mp3', '.wav', '.flac', '.aac', '.m4a'].includes(ext)) return 'audio';
    if (['.js', '.ts', '.html', '.css', '.json', '.py', '.cpp', '.c', '.cs', '.java', '.bat', '.ps1'].includes(ext)) return 'code';
    if (['.lnk', '.url'].includes(ext)) return 'shortcut';
    if (['.exe', '.msi'].includes(ext)) return 'exe';
    return 'file';
}
function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
const fileIcons = new Map();
async function desktopIcon(file) {
    const key = file.fullPath + ':' + file.mtime;
    if (fileIcons.has(key)) return fileIcons.get(key);
    const cached = readAppsCache().find(item=>item.appId === file.fullPath || item.shortcutPaths?.includes(file.fullPath));
    let icon = cached?.icon || null;
    if (!icon && app.getFileIcon) {
        try { const native = await app.getFileIcon(file.fullPath,{size:'large'}); if (!native.isEmpty()) icon = native.toDataURL(); } catch {}
    }
    fileIcons.set(key,icon);
    if (fileIcons.size > 192) fileIcons.delete(fileIcons.keys().next().value);
    return icon;
}
ipcMain.handle('get-desktop-files', async (event, directory) => {
    const userDesktop = app.getPath ? app.getPath('desktop') : path.join(process.env.USERPROFILE || 'C:\\Users\\acer', 'Desktop');
    const publicDesktop = path.join(process.env.PUBLIC || 'C:\\Users\\Public', 'Desktop');
    const dirsToScan = [userDesktop];
    if (fs.existsSync(publicDesktop) && publicDesktop !== userDesktop) {
        dirsToScan.push(publicDesktop);
    }
    if (directory) {
        const candidate = path.resolve(directory);
        if (!dirsToScan.some(root=>candidate.toLowerCase()===root.toLowerCase() || candidate.toLowerCase().startsWith(root.toLowerCase()+path.sep))) return [];
        dirsToScan.splice(0,dirsToScan.length,candidate);
    }
    const seenNames = new Set();
    const result = [];
    for (const dir of dirsToScan) {
        if (!fs.existsSync(dir)) continue;
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.name.toLowerCase() === 'desktop.ini') continue;
                if (seenNames.has(entry.name.toLowerCase())) continue;
                seenNames.add(entry.name.toLowerCase());
                const fullPath = path.join(dir, entry.name);
                let stat = null;
                try {
                    stat = fs.statSync(fullPath);
                } catch (e) {
                    continue;
                }
                const isDir = entry.isDirectory();
                const ext = path.extname(entry.name);
                const fileType = getDesktopFileType(ext, isDir);
                result.push({
                    name: entry.name,
                    fullPath: fullPath,
                    isDirectory: isDir,
                    size: isDir ? '' : formatBytes(stat.size),
                    sizeBytes: stat.size,
                    mtime: stat.mtimeMs,
                    mtimeStr: new Date(stat.mtimeMs).toLocaleDateString('vi-VN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
                    ext: ext,
                    type: fileType
                });
            }
        } catch (e) {
            console.error('Error reading desktop directory:', dir, e);
        }
    }
    result.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });
    let next = 0;
    await Promise.all(Array.from({length:4}, async ()=>{
        while (next < result.length) {
            const file = result[next++];
            file.icon = await desktopIcon(file);
            if (!file.isDirectory) file.launch = catalog.resolve({appId:file.fullPath,
                name:path.basename(file.name,path.extname(file.name)),icon:file.icon});
        }
    }));
    return result;
});
ipcMain.handle('open-desktop-file', async (event, filePath) => {
    if (!filePath || !fs.existsSync(filePath)) return false;
    shell.openPath(filePath);
    return true;
});
ipcMain.handle('show-item-in-folder', async (event, filePath) => {
    if (!filePath || !fs.existsSync(filePath)) return false;
    shell.showItemInFolder(filePath);
    return true;
});
ipcMain.handle('create-desktop-item', async (event, { name, type, content }) => {
    const userDesktop = path.join(process.env.USERPROFILE || 'C:\\Users\\acer', 'Desktop');
    if (!fs.existsSync(userDesktop)) fs.mkdirSync(userDesktop, { recursive: true });
    let baseName = name;
    if (!baseName) {
        baseName = type === 'folder' ? 'Thư mục mới' : 'Tài liệu mới.txt';
    }
    let targetPath = path.join(userDesktop, baseName);
    let counter = 1;
    const ext = type === 'folder' ? '' : path.extname(baseName);
    const rawName = type === 'folder' ? baseName : path.basename(baseName, ext);
    while (fs.existsSync(targetPath)) {
        const candName = `${rawName} (${counter})${ext}`;
        targetPath = path.join(userDesktop, candName);
        counter++;
    }
    try {
        if (type === 'folder') {
            fs.mkdirSync(targetPath);
        } else {
            fs.writeFileSync(targetPath, content || '', 'utf8');
        }
        return { success: true, path: targetPath, name: path.basename(targetPath) };
    } catch (e) {
        return { success: false, error: e.message };
    }
});
ipcMain.handle('delete-desktop-item', async (event, filePath) => {
    if (!filePath || !fs.existsSync(filePath)) return false;
    try {
        await shell.trashItem(filePath);
        return true;
    } catch (e) {
        return false;
    }
});
ipcMain.handle('rename-desktop-item', async (event, { oldPath, newName }) => {
    if (!oldPath || !newName || !fs.existsSync(oldPath)) return false;
    const dir = path.dirname(oldPath);
    const newPath = path.join(dir, newName);
    try {
        fs.renameSync(oldPath, newPath);
        return { success: true, newPath, name: newName };
    } catch (e) {
        return { success: false, error: e.message };
    }
});
ipcMain.handle('launch-app', async (event, appArg) => {
    const info = typeof appArg === 'object' ? appArg : {appId:appArg};
    if (info.launchToken && (!launchGate || info.launchToken !== launchGate.token)) return {success:false, cancelled:true};
    const resolved = catalog.resolveLaunch(info);
    const appId = resolved.appId;
    if (typeof appId !== 'string' || !appId || appId.length > 32768 || appId.includes('\0')) return {success:false,error:'Đường dẫn ứng dụng không hợp lệ.'};
    const gate = launchGate;
    activeLaunchInfo = { ...resolved, key:getAppKey(appId), timestamp:Date.now() };
    if (gate && info.launchToken === gate.token) gate.app = activeLaunchInfo;
    try {
        const shortcut = (resolved.shortcutPaths || []).find(file=>fs.existsSync(file));
        if (appId.includes('!') || (!shortcut && (appId.startsWith('{') || (!path.isAbsolute(appId) && !/\.(exe|lnk|bat|cmd)$/i.test(appId))))) {
            const child = spawn('explorer.exe', ['shell:AppsFolder\\' + appId], {windowsHide:true,stdio:'ignore'});
            child.on('error', error=>failLaunch(gate,error.message));
        } else if (!path.isAbsolute(appId) && /\.exe$/i.test(appId)) {
            const child = spawn(appId, [], {windowsHide:false,stdio:'ignore'});
            if (gate) gate.app.launchPid = child.pid;
            child.on('error', error=>failLaunch(gate,error.message));
        } else {
            const error = await shell.openPath(shortcut || appId);
            if (error) { failLaunch(gate,error); return {success:false,error}; }
        }
        return {success:true};
    } catch (error) { failLaunch(gate,error.message); return {success:false,error:error.message}; }
});
function failLaunch(gate, error) {
    if (gate && launchGate === gate) gate.error = error;
}
ipcMain.handle('open-windows-taskbar', () => {
    sendBridgeCommand({ cmd: 'show_taskbar' });
    return true;
});
ipcMain.handle('open-task-mgr', () => {
    exec('taskmgr.exe');
    return true;
});
ipcMain.handle('take-screenshot', () => {
    exec('snippingtool.exe');
    return true;
});
ipcMain.handle('set-window-foreground', (event, hwnd) => {
    sendBridgeCommand({ cmd: 'set_foreground', hwnd: Number(hwnd) });
    return true;
});
ipcMain.handle('lower-launcher', () => {
    sendBridgeCommand({ cmd: 'lower_launcher' });
    return true;
});
ipcMain.handle('raise-launcher', () => {
    sendBridgeCommand({ cmd: 'raise_launcher' });
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
        mainWindow.focus();
    }
    return true;
});
ipcMain.handle('exit-shell', () => {
    cleanupAndExit();
});
function snapshotPath(hwnd, info) {
    const win = knownWindows.find(item=>Number(item.hwnd)===Number(hwnd));
    return (win && previews.lookup(win)) || (info && previews.forApp(info.appId)) || null;
}
function showHome(hwnd = currentForegroundHwnd, info = windowApps.get(Number(hwnd)), minimize = true) {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (!info && launchGate) info = launchGate.app;
    const win = knownWindows.find(item=>Number(item.hwnd)===Number(hwnd));
    if (!memoryCritical && win && !win.isMinimized) previews.refresh(knownWindows);
    launcherView = 'home';
    releaseLaunchCover(); clearTimeout(activeAppCpuTimer);
    currentForegroundHwnd = null; currentForegroundPid = null;
    sendBridgeCommand({cmd:'set_cpu_mode',mode:'exit_anim'});
    sendBridgeCommand({cmd:'raise_launcher'});
    mainWindow.show(); mainWindow.focus(); keepHomebarVisible();
    mainWindow.webContents.send('trigger-home', {
        hwnd, appId:info && info.appId, icon:info && info.icon, name:info && info.name,
        origin:info && info.origin, rect:win && localWindowInfo(win).rect,
        snapPath:snapshotPath(hwnd,info)
    });
    if (minimize && hwnd) sendBridgeCommand({cmd:'minimize',hwnd:Number(hwnd)});
    if (splitDividerWindow && !splitDividerWindow.isDestroyed()) splitDividerWindow.hide();
    setTimeout(()=>sendBridgeCommand({cmd:'set_cpu_mode',mode:'idle'}),400);
}
ipcMain.on('homebar-click', ()=>showHome());
ipcMain.on('homebar-hold', ()=>{
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (!memoryCritical) previews.refresh(knownWindows);
    releaseLaunchCover(); launcherView = 'switcher'; currentForegroundHwnd = null;
    sendBridgeCommand({cmd:'raise_launcher'});
    mainWindow.show(); mainWindow.focus(); keepHomebarVisible();
    mainWindow.webContents.send('trigger-switcher');
});
async function cacheForegroundSnapshot() {
    if (memoryCritical || launchGate || cleanupStarted) return;
    const windows = await getNativeWindows();
    if (!launchGate && !memoryCritical) await previews.refresh(windows);
}
async function pruneSnapshots() {
    const files = [];
    for (const filename of await fs.promises.readdir(SNAPSHOTS_DIR)) {
        if (!/^(snap_[0-9]+|app_[a-f0-9]{12})\.jpg$/.test(filename)) continue;
        const target = path.join(SNAPSHOTS_DIR, filename);
        try { const stat = await fs.promises.stat(target); files.push({ target, size: stat.size, time: stat.mtimeMs }); } catch {}
    }
    files.sort((a,b) => b.time - a.time);
    let bytes = 0;
    for (let i = 0; i < files.length; i++) {
        bytes += files[i].size;
        if (i >= 64 || bytes > 48 * 1024 * 1024) await fs.promises.unlink(files[i].target).catch(() => {});
    }
}
function releaseLaunchCover() {
    if (launchGate) clearTimeout(launchGate.timer);
    launchGate = null;
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setAlwaysOnTop(false);
    sendBridgeCommand({ cmd: 'set_cpu_mode', mode: 'idle' });
}
ipcMain.handle('begin-launch', async (_, info) => {
    releaseLaunchCover(); launcherView = 'launch';
    const resolved = catalog.resolveLaunch(info);
    activeLaunchInfo = { ...resolved, key:getAppKey(info.appId), timestamp:Date.now() };
    const gate = {token:++launchSerial, app:activeLaunchInfo, window:null, targetHwnd:info.hwnd || null, lastPoll:0};
    launchGate = gate;
    gate.timer = setTimeout(()=>{
        if (launchGate !== gate) return;
        releaseLaunchCover(); launcherView = 'home';
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('launch-timeout', {token:gate.token});
    },15000);
    mainWindow.setAlwaysOnTop(true,'pop-up-menu');
    sendBridgeCommand({cmd:'raise_launcher'}); keepHomebarVisible();
    sendBridgeCommand({cmd:'set_cpu_mode',mode:'launch'});
    const windows = await getNativeWindows();
    if (launchGate !== gate) return {cancelled:true,token:gate.token};
    const running = findAppWindow(windows, gate.app);
    if (running) {
        gate.targetHwnd = running.hwnd;
        const existing = windowApps.get(Number(running.hwnd));
        if (!gate.app.origin && existing) gate.app.origin = existing.origin;
    }
    return {token:gate.token, runningHwnd:gate.targetHwnd, app:gate.app};
});
ipcMain.handle('launch-window-info', async (_, argument) => {
    const params = argument && typeof argument === 'object' ? argument : {hwnd:argument};
    const gate = launchGate;
    if (!gate || (params.token && params.token !== gate.token)) return {cancelled:true};
    if (gate.error) return {error:gate.error};
    if (Date.now() - gate.lastPoll > 180) {
        gate.lastPoll = Date.now();
        const windows = await getNativeWindows();
        if (launchGate !== gate) return {cancelled:true};
        discoverLaunchWindow(gate,windows);
    }
    const hwnd = params.hwnd || gate.targetHwnd || gate.window?.hwnd;
    if (hwnd) {
        const info = await requests.request('info_' + hwnd,{cmd:'window_info',hwnd:Number(hwnd)},null);
        if (launchGate !== gate) return {cancelled:true};
        if (info && info.rect && info.rect.w > 0) return {...gate.window,...info};
    }
    return gate.window;
});
ipcMain.handle('finish-launch', (_, argument) => {
    const params = argument && typeof argument === 'object' ? argument : {hwnd:argument};
    if (params.token && (!launchGate || params.token !== launchGate.token)) return false;
    const hwnd = Number(params.hwnd) || null;
    if (hwnd && launchGate) {
        const existing = knownWindows.find(win=>Number(win.hwnd)===hwnd);
        windowApps.set(hwnd,{...launchGate.app,windowPid:existing?.pid});
        currentForegroundHwnd = hwnd; currentForegroundPid = existing?.pid || null;
    }
    if (hwnd || launchGate) releaseLaunchCover();
    launcherView = hwnd ? 'app' : 'home';
    if (hwnd) {
        sendBridgeCommand({cmd:'restore',hwnd}); sendBridgeCommand({cmd:'set_foreground',hwnd});
        scheduleWindowCapture();
    }
    keepHomebarVisible();
    return true;
});
function cleanupAndExit() {
    if (cleanupStarted) return;
    cleanupStarted = true;
    releaseLaunchCover();
    clearInterval(snapshotTimer); clearInterval(discoveryTimer); clearTimeout(foregroundCaptureTimer); clearTimeout(activeAppCpuTimer); clearTimeout(appWatcherDebounce);
    for (const watcher of appWatchers) watcher.close();
    requests.dispose();
    sendBridgeCommand({ cmd: 'show_taskbar' });
    if (bridgeProc && bridgeProc.stdin.writable) bridgeProc.stdin.end();
    app.quit();
}
app.whenReady().then(() => {
    if (!app.hasSingleInstanceLock() || cleanupStarted) return;
    if (process.argv.includes('--restore-windows')) {
        execFile(path.join(__dirname, 'taskbar_mgr.exe'), ['show'], { windowsHide: true }, () => cleanupAndExit());
        return;
    }
    startCoreBridge();
    createMainWindow();
    createHomeBarWindow();
    autoCheckAppsCache();
    setupAppWatchers();
    pruneSnapshots().catch(error => console.warn('Snapshot cache:', error.message));
    snapshotTimer = setInterval(cacheForegroundSnapshot, 3000);
    discoveryTimer = setInterval(scanApps, 10 * 60 * 1000);
    globalShortcut.register('CommandOrControl+Space', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.show();
            mainWindow.focus();
            mainWindow.webContents.send('toggle-spotlight');
        }
    });
    globalShortcut.register('Alt+Home', () => showHome());
    globalShortcut.register('CommandOrControl+Shift+Alt+Escape', () => {
        cleanupAndExit();
    });
});
app.on('before-quit', () => { if (!cleanupStarted) cleanupAndExit(); });
app.on('will-quit', () => globalShortcut.unregisterAll());
if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', (_, argv) => {
    if (argv.includes('--restore-windows')) { cleanupAndExit(); return; }
    if (argv.includes('--reload-launcher')) {
        app.relaunch({ args: [__dirname] });
        cleanupAndExit();
        return;
    }
    if (mainWindow && !mainWindow.isDestroyed()) { mainWindow.show(); mainWindow.focus(); }
});
process.on('SIGINT', cleanupAndExit);
process.on('SIGTERM', cleanupAndExit);
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    cleanupAndExit();
});