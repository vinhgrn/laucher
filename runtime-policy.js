'use strict';
class BridgeRequests {
    constructor(send) { this.send = send; this.pending = new Map(); }
    request(key, command, fallback, timeout = 1500) {
        const existing = this.pending.get(key);
        if (existing) return existing.promise;
        let finish;
        const promise = new Promise(resolve => { finish = resolve; });
        const entry = { promise, finish, fallback };
        entry.timer = setTimeout(() => this.resolve(key, fallback), timeout);
        this.pending.set(key, entry);
        if (!this.send(command)) this.resolve(key, fallback);
        return promise;
    }
    resolve(key, value) {
        const entry = this.pending.get(key);
        if (!entry) return;
        clearTimeout(entry.timer);
        this.pending.delete(key);
        entry.finish(value);
    }
    dispose() {
        for (const [key, entry] of this.pending) this.resolve(key, entry.fallback);
    }
}
function ramPolicy(stats) {
    const pct = stats && stats.ramPct;
    return { warn: Number.isFinite(pct) && pct >= 85,
        critical: Number.isFinite(pct) && pct >= 95 };
}
const identityText = value => String(value || '').normalize('NFKC').trim().toLocaleLowerCase();
const identityPath = value => identityText(value).replace(/^"|"$/g, '').replace(/\//g, '\\');
const identityName = value => identityText(value).replace(/\.(lnk|exe)$/i, '').replace(/\s+/g, ' ');
function appMatchScore(win, app) {
    if (!win || !app) return 0;
    if (app.hwnd && Number(app.hwnd) === Number(win.hwnd)) return 120;
    if (win.appId && identityText(win.appId) === identityText(app.appId)) return 115;
    const ids = [app.appUserModelId, ...(app.appUserModelIds || []), app.appId].filter(Boolean).map(identityText);
    const windowIds = [win.appUserModelId, win.processAppUserModelId].filter(Boolean).map(identityText);
    if (windowIds.some(id => ids.includes(id))) return 110;
    const name = identityName(app.name);
    const title = identityName(win.title);
    const titleMatch = name.length >= 3 && (title === name ||
        [' - ', ' — ', ' – ', ' | '].some(separator => title.endsWith(separator + name) || title.startsWith(name + separator)));
    const specialized = /(?:\._crx_|--app(?:-id)?=)/i.test((app.appId || '') + ' ' + (app.arguments || ''));
    if (specialized && windowIds.length && !titleMatch) return 0;
    const executable = identityPath(win.processPath || win.executablePath);
    const targets = [app.executablePath, ...(app.executablePaths || []), app.targetPath,
        /\.exe$/i.test(app.appId || '') ? app.appId : null].filter(Boolean).map(identityPath);
    const hostProcess = /^(explorer|applicationframehost|rundll32|dllhost|svchost)\.exe$/i.test(win.processName || '');
    if (!hostProcess && !specialized && executable && targets.includes(executable)) return 100;
    const processName = identityName(win.processName || executable.split('\\').pop());
    const basenames = targets.map(target => identityName(target.split('\\').pop()));
    const id = identityText(app.appId);
    if (!id.includes('\\') && !id.includes('/') && !id.includes('!') && !id.includes('.lnk')) basenames.push(identityName(id));
    if (!hostProcess && !specialized && processName && basenames.includes(processName)) return 80;
    if (app.launchPid && (Number(app.launchPid) === Number(win.pid) ||
        (win.ancestorPids || []).includes(Number(app.launchPid)))) return 95;
    return titleMatch ? 40 : 0;
}
function matchesApp(win, app) { return appMatchScore(win, app) > 0; }
function findAppWindow(windows, app) {
    return windows.map(win => ({ win, score: appMatchScore(win, app) }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score || Number(b.win.isForeground) - Number(a.win.isForeground) ||
            Number(a.win.isMinimized) - Number(b.win.isMinimized))[0]?.win || null;
}
if (typeof module !== 'undefined') module.exports = { BridgeRequests, ramPolicy, matchesApp, appMatchScore, findAppWindow };
else window.launcherPolicy = { matchesApp, appMatchScore, findAppWindow };