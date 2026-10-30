const { execFileSync } = require('child_process');
const os = require('os');
try { os.setPriority(process.pid, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch {}
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ICONS_DIR = path.join(__dirname, 'assets', 'icons');
const CACHE_DIR = path.join(__dirname, 'cache');
const EXTRACTOR_EXE = path.join(__dirname, 'icon_extractor.exe');
if (!fs.existsSync(ICONS_DIR)) fs.mkdirSync(ICONS_DIR, { recursive: true });
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
function getHash(str) {
    return crypto.createHash('md5').update(str).digest('hex').substring(0, 12);
}
function cleanAppName(name) {
    return name
        .replace(/\.lnk$/i, '')
        .replace(/\.exe$/i, '')
        .replace(/ - Shortcut$/i, '')
        .replace(/ - Phím tắt$/i, '')
        .replace(/\s+/g, ' ')
        .trim();
}
function isJunkItem(name, appId) {
    const lowerName = name.toLowerCase();
    const lowerId = (appId || '').toLowerCase();
    if (lowerId.startsWith('http://') || lowerId.startsWith('https://')) return true;
    if (lowerId.endsWith('.url') || lowerId.endsWith('.chm') || lowerId.endsWith('.pdf') || lowerId.endsWith('.txt')) return true;
    if (lowerName.includes('uninstall') || lowerName.includes('gỡ cài đặt') || lowerName.includes('remove ') || lowerName.startsWith('unins0')) return true;
    if (lowerName.includes('readme') || lowerName.includes('documentation') || lowerName.includes('hướng dẫn') || lowerName.includes('release notes')) return true;
    if (lowerName.includes('help') && !lowerName.includes('assistant') && !lowerName.includes('devkit')) return true;
    if (lowerName.includes('license') || lowerName.includes('giấy phép') || lowerName.includes('eula')) return true;
    if (lowerName.includes('website') || lowerName.includes('trang web') || lowerName.includes('visit ')) return true;
    if (lowerName.includes('feedback hub') || lowerName.includes('hub phản hồi')) return false;
    if (lowerName === 'about' || lowerName === 'credits') return true;
    return false;
}
function categorizeApp(name, appId) {
    const text = (name + ' ' + (appId || '')).toLowerCase();
    if (/\b(chrome|edge|firefox|browser|opera|brave|vivaldi|tor|safari|arc|duckduckgo|waterfox|maxthon|web|internet)\b/i.test(text) ||
        text.includes('cốc cốc') || text.includes('coccoc') || text.includes('google chrome') || text.includes('microsoft edge')) {
        return 'Browsers & Web';
    }
    if (/\b(code|visual studio|vscode|vsc|cursor|sublime|notepad\+\+|clion|pycharm|intellij|webstorm|rider|phpstorm|rubymine|android studio|dev-c\+\+|devc|eclipse|netbeans|git|github|gitlab|gitkraken|sourcetree|terminal|powershell|cmd|bash|wsl|python|node|nodejs|npm|yarn|pnpm|docker|postman|wireshark|insomnia|f3d|dbeaver|navicat|heidisql|pgadmin|mongodb|sqlite|unity|unreal|godot|AeroIOS|deepseek|AeroIOS|AeroIOS|ollama|llm|harness|compiler|sdk|jdk|jre|debugger|api|hex editor|msys|clang|mingw|ucrt|automate)\b/i.test(text) ||
        text.includes('visual studio') || text.includes('powershell') || text.includes('terminal') || text.includes('dev-c') || text.includes('dev home') || text.includes('additional tools for node') || text.includes('msys2') || text.includes('power automate')) {
        return 'Developer Tools';
    }
    if (/\b(steam|epic games|riot|valorant|league of legends|lol|garena|battle\.net|blizzard|origin|ea app|ubisoft|gog|gog galaxy|xbox|roblox|minecraft|slimebound|genshin|honkai|wuthering|waves|pubg|csgo|dota|game|gaming|play|gameloop|bluestacks|nox|ldplayer|memu|mumu|emulator|yuzu|rpcs3|ppsspp|dolphin|retroarch|furmark|benchmark|3dmark|gamepass|sklauncher|rivatuner|rtss)\b/i.test(text) ||
        text.includes('steam') || text.includes('furmark') || text.includes('xbox') || text.includes('epic') || text.includes('game') || text.includes('slimebound') || text.includes('wuthering') || text.includes('sklauncher')) {
        return 'Gaming';
    }
    if (/\b(photoshop|illustrator|premiere|after effects|lightroom|indesign|audition|creative cloud|figma|canva|coreldraw|gimp|inkscape|paint|clip studio|krita|aseprite|davinci|resolve|capcut|camtasia|filmora|obs|streamlabs|audacity|fl studio|ableton|cubase|studio one|reaper|logic|sound forge|vlc|potplayer|k-lite|gom|media player|windows media|groove|spotify|apple music|tidal|soundcloud|camera|máy ảnh|photo|ảnh|gallery|voice recorder|ghi âm|handbrake|format factory|ffmpeg|video|music|nhạc|âm thanh|audio|movie|phim|render|3d|clipchamp|upscayl|tiktok|ggtt|vẽ|đa phương tiện|giọng nói)\b/i.test(text) ||
        text.includes('spotify') || text.includes('player') || text.includes('photoshop') || text.includes('capcut') || text.includes('vlc') || text.includes('obs') || text.includes('media') || text.includes('clipchamp') || text.includes('upscayl') || text.includes('đa phương tiện') || text.includes('giọng nói') || text.includes('ảnh') || text.includes('vẽ') || text.includes('tiktok')) {
        return 'Media & Creative';
    }
    if (/\b(word|excel|powerpoint|outlook|onenote|office|wps|libreoffice|openoffice|docs|sheet|slide|notion|obsidian|evernote|logseq|todo|to-do|task|reminder|nhắc nhở|calendar|lịch|mail|thư|calculator|máy tính|fx-580|casio|zotero|mendeley|acrobat|foxit|pdf|nitro|drawboard|scan|ocr|sticky note|ghi chú|print|in ấn|access|publisher|dropbox|onedrive|google drive|box|mega|zalo|telegram|discord|skype|teams|zoom|messenger|facebook|whatsapp|viber|signal|wechat|line|slack|phone link|liên kết điện thoại|family|localsend|ultraviewer|remote desktop|remote|vivo|notepad)\b/i.test(text) ||
        text.includes('office') || text.includes('word') || text.includes('excel') || text.includes('powerpoint') || text.includes('zalo') || text.includes('telegram') || text.includes('discord') || text.includes('teams') || text.includes('zoom') || text.includes('calculator') || text.includes('máy tính') || text.includes('ghi chú') || text.includes('dropbox') || text.includes('fx-580') || text.includes('to do') || text.includes('notepad') || text.includes('sticky notes') || text.includes('localsend') || text.includes('ultraviewer') || text.includes('remote desktop') || text.includes('vivo')) {
        return 'Productivity';
    }
    if (/\b(setting|cài đặt|control panel|task manager|taskmgr|quản lý tác vụ|bảo mật|security|defender|antivirus|malware|disk|ổ đĩa|defragment|phân mảnh|cleanup|dọn dẹp|7-zip|winrar|winzip|zip|rar|tar|everything|search|cpu-z|gpu-z|hwmonitor|aida64|msi afterburner|core temp|rufus|balena|etcher|crystaldisk|partition|minitool|driver|realtek|intel|nvidia|amd|radeon|geforce|device manager|event viewer|services|registry|regedit|component services|iscsi|computer management|công cụ cắt|snipping|snip|character map|trợ năng|accessibility|narrator|magnifier|acer|asus|lenovo|dell|hp|msi|alienware|intelligence space|cloudflare|vpn|proxy|grub2win|chia sẻ nhanh|quick share|airpods|bluetooth|wifi|mạng|network|diagnostics|troubleshoot|backup|sao lưu|restore|khôi phục|update|cập nhật|sysinternals|clock|đồng hồ|quickcpu|mem reduct|diagnostic|performance monitor|resource monitor|odbc|store|weather|thời tiết|news|tin tức|4ddig)\b/i.test(text) ||
        text.includes('setting') || text.includes('control') || text.includes('security') || text.includes('manager') || text.includes('intel') || text.includes('nvidia') || text.includes('amd') || text.includes('acer') || text.includes('7-zip') || text.includes('bảo mật') || text.includes('cắt') || text.includes('đồng hồ') || text.includes('quản lý') || text.includes('quickcpu') || text.includes('mem reduct') || text.includes('thời tiết') || text.includes('tin tức') || text.includes('store') || text.includes('explorer') || text.includes('disk') || text.includes('monitor') || text.includes('airpods')) {
        return 'Utilities & System';
    }
    return 'Applications';
}
function scanShortcutsRecursively(dir) {
    let results = [];
    if (!dir || !fs.existsSync(dir)) return results;
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                results = results.concat(scanShortcutsRecursively(fullPath));
            } else if (entry.name.toLowerCase().endsWith('.lnk')) {
                results.push({ name: entry.name.replace(/\.lnk$/i, ''), fullPath });
            }
        }
    } catch (e) {}
    return results;
}
function extractAppIcon(target, iconPath) {
    if (!fs.existsSync(EXTRACTOR_EXE)) return false;
    let needsExtract = !fs.existsSync(iconPath) || (fs.existsSync(iconPath) && fs.statSync(iconPath).size < 100);
    if (!needsExtract) return true;
    try {
        execFileSync(EXTRACTOR_EXE, [target, iconPath], { timeout: 3500, stdio: 'ignore', windowsHide: true });
    } catch (e) {
        if (!target.startsWith('shell:AppsFolder\\') && (target.includes('!') || target.startsWith('{'))) {
            try {
                execFileSync(EXTRACTOR_EXE, ['shell:AppsFolder\\' + target, iconPath], { timeout: 3500, stdio: 'ignore', windowsHide: true });
            } catch (e2) {}
        }
    }
    return fs.existsSync(iconPath) && fs.statSync(iconPath).size > 100;
}
async function scanAllApps() {
    console.log('--- Scanning ALL Windows Applications (StartApps + Start Menu + Desktop) ---');
    const appMap = new Map();
    const seenNames = new Set();
    try {
        const tempJsonPath = path.join(CACHE_DIR, 'startapps_' + process.pid + '.json');
        const psCmd = `$ErrorActionPreference='Stop'; @(Get-StartApps) | ConvertTo-Json -Depth 2 | Set-Content -LiteralPath '${tempJsonPath.replace(/'/g, "''")}' -Encoding utf8`;
        execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psCmd], { timeout: 20000, stdio: 'ignore', windowsHide: true });
        if (fs.existsSync(tempJsonPath)) {
            let rawContent = fs.readFileSync(tempJsonPath, 'utf8');
            rawContent = rawContent.replace(/^\uFEFF/, '').trim();
            const parsed = JSON.parse(rawContent);
            const rawApps = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
            fs.unlinkSync(tempJsonPath);
            console.log(`[Source A: Get-StartApps] Returned ${rawApps.length} entries cleanly encoded.`);
            for (const item of rawApps) {
                const name = (item.Name || '').trim();
                const appId = (item.AppID || '').trim();
                if (!name || !appId) continue;
                if (isJunkItem(name, appId)) continue;
                const cleanName = cleanAppName(name);
                const lowerKey = cleanName.toLowerCase();
                if (seenNames.has(lowerKey)) continue;
                const hash = getHash(appId);
                const iconFilename = `${hash}.png`;
                const iconPath = path.join(ICONS_DIR, iconFilename);
                extractAppIcon(appId, iconPath);
                const hasIcon = fs.existsSync(iconPath) && fs.statSync(iconPath).size > 100;
                appMap.set(appId, {
                    id: hash,
                    name: cleanName,
                    appId: appId,
                    icon: hasIcon ? `assets/icons/${iconFilename}` : null,
                    category: categorizeApp(cleanName, appId),
                    isUwp: appId.includes('!')
                });
                seenNames.add(lowerKey);
            }
            try { fs.unlinkSync(tempJsonPath); } catch (e) {}
        }
    } catch (err) {
        console.error('[Source A] Error scanning Get-StartApps:', err.message);
    }
    const startMenuDirs = [
        path.join(process.env.ProgramData || 'C:\\ProgramData', 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
        path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
        path.join(process.env.USERPROFILE || 'C:\\Users\\acer', 'Desktop'),
        path.join(process.env.PUBLIC || 'C:\\Users\\Public', 'Desktop')
    ];
    let foundShortcutsCount = 0;
    for (const sDir of startMenuDirs) {
        const shortcuts = scanShortcutsRecursively(sDir);
        for (const sc of shortcuts) {
            if (isJunkItem(sc.name, sc.fullPath)) continue;
            const cleanName = cleanAppName(sc.name);
            const lowerKey = cleanName.toLowerCase();
            if (seenNames.has(lowerKey)) {
                const existing = [...appMap.values()].find(app => app.name.toLowerCase() === lowerKey);
                if (existing) existing.shortcutPaths = [...new Set([...(existing.shortcutPaths || []), sc.fullPath])];
                continue;
            }
            foundShortcutsCount++;
            const hash = getHash(sc.fullPath);
            const iconFilename = `${hash}.png`;
            const iconPath = path.join(ICONS_DIR, iconFilename);
            extractAppIcon(sc.fullPath, iconPath);
            const hasIcon = fs.existsSync(iconPath) && fs.statSync(iconPath).size > 100;
            appMap.set(sc.fullPath, {
                id: hash,
                name: cleanName,
                appId: sc.fullPath,
                icon: hasIcon ? `assets/icons/${iconFilename}` : null,
                category: categorizeApp(cleanName, sc.fullPath),
                isUwp: false
            });
            seenNames.add(lowerKey);
        }
    }
    console.log(`[Source B: Filesystem Shortcuts] Discovered ${foundShortcutsCount} additional unique applications.`);
    const essentials = [
        { name: 'File Explorer', appId: 'explorer.exe', category: 'Utilities & System' },
        { name: 'Settings', appId: 'windows.immersivecontrolpanel_cw5n1h2txyewy!microsoft.windows.immersivecontrolpanel', category: 'Utilities & System' },
        { name: 'Task Manager', appId: 'taskmgr.exe', category: 'Utilities & System' },
        { name: 'Terminal / PowerShell', appId: 'powershell.exe', category: 'Developer Tools' },
        { name: 'Command Prompt', appId: 'cmd.exe', category: 'Developer Tools' }
    ];
    for (const ess of essentials) {
        const lowerKey = ess.name.toLowerCase();
        if (!seenNames.has(lowerKey) && !appMap.has(ess.appId)) {
            const hash = getHash(ess.appId);
            const iconFilename = `${hash}.png`;
            const iconPath = path.join(ICONS_DIR, iconFilename);
            extractAppIcon(ess.appId, iconPath);
            const hasIcon = fs.existsSync(iconPath) && fs.statSync(iconPath).size > 100;
            appMap.set(ess.appId, {
                id: hash,
                name: ess.name,
                appId: ess.appId,
                icon: hasIcon ? `assets/icons/${iconFilename}` : null,
                category: ess.category,
                isUwp: ess.appId.includes('!')
            });
            seenNames.add(lowerKey);
        }
    }
    const appList = Array.from(appMap.values());
    appList.sort((a, b) => a.name.localeCompare(b.name, 'vi', { sensitivity: 'base' }));
    const cacheTemp = path.join(CACHE_DIR, 'apps.' + process.pid + '.tmp');
    fs.writeFileSync(cacheTemp, JSON.stringify(appList, null, 2), 'utf8');
    fs.renameSync(cacheTemp, path.join(CACHE_DIR, 'apps.json'));
    console.log(`✅ Successfully cataloged and classified ${appList.length} total applications to cache/apps.json!`);
    const categoryCounts = {};
    for (const a of appList) {
        categoryCounts[a.category] = (categoryCounts[a.category] || 0) + 1;
    }
    console.log('Category breakdown:', categoryCounts);
    return appList;
}
if (require.main === module) {
    scanAllApps().catch(error => { console.error(error); process.exitCode = 1; });
}
module.exports = { scanAllApps, categorizeApp };