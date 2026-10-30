'use strict';
const fs = require('fs');
const path = require('path');
function windowSourceHwnd(sourceId) {
    const match = /^window:(\d+):/.exec(sourceId || '');
    return match ? Number(match[1]) : null;
}
function usableThumbnail(image) {
    if (!image || image.isEmpty()) return false;
    const bytes = image.toBitmap();
    if (bytes.length < 16) return false;
    const stride = Math.max(4, Math.floor(bytes.length / 256 / 4) * 4);
    let bright = 0;
    for (let i = 0; i + 3 < bytes.length; i += stride) {
        if (bytes[i] + bytes[i + 1] + bytes[i + 2] > 24) bright++;
    }
    return bright > 2;
}
class WindowPreviews {
    constructor(capturer, directory) {
        this.capturer = capturer; this.directory = directory; this.pending = null;
        this.entries = new Map(); this.lastCapture = 0;
        fs.mkdirSync(directory, { recursive: true });
        try {
            const entries = JSON.parse(fs.readFileSync(path.join(directory, 'preview-index.json'), 'utf8'));
            for (const entry of entries) if (/^preview_\d+_\d+\.jpg$/.test(entry.file) &&
                fs.existsSync(path.join(directory, entry.file))) this.entries.set(entry.key, entry);
        } catch {}
    }
    key(win) { return `${Number(win.hwnd)}_${Number(win.pid) || 0}`; }
    lookup(win) {
        const entry = this.entries.get(this.key(win));
        if (!entry || (entry.processPath && win.processPath && entry.processPath !== win.processPath)) return null;
        return `cache/snapshots/${entry.file}?t=${entry.capturedAt}`;
    }
    async refresh(windows, force = false) {
        if (this.pending) return this.pending;
        if (!this.capturer || (!force && Date.now() - this.lastCapture < 1200)) return;
        const requested = new Map(windows.slice(0, 64).map(win => [Number(win.hwnd), win]));
        this.pending = (async () => {
            const sources = await this.capturer.getSources({ types: ['window'],
                thumbnailSize: { width: 640, height: 360 }, fetchWindowIcons: false });
            for (const source of sources) {
                const win = requested.get(windowSourceHwnd(source.id));
                if (!win || win.isMinimized || !usableThumbnail(source.thumbnail)) continue;
                const key = this.key(win), file = `preview_${key}.jpg`;
                const target = path.join(this.directory, file);
                await fs.promises.writeFile(target + '.tmp', source.thumbnail.toJPEG(72));
                await fs.promises.rename(target + '.tmp', target);
                this.entries.set(key, { key, file, processPath: win.processPath || '',
                    appId: win.appId || '', capturedAt: Date.now(), bytes: (await fs.promises.stat(target)).size });
            }
            this.lastCapture = Date.now();
            let bytes = 0;
            const sorted = [...this.entries.values()].sort((a, b) => b.capturedAt - a.capturedAt);
            for (let i = 0; i < sorted.length; i++) {
                bytes += sorted[i].bytes || 0;
                if (i >= 64 || bytes > 32 * 1024 * 1024) {
                    this.entries.delete(sorted[i].key);
                    await fs.promises.unlink(path.join(this.directory, sorted[i].file)).catch(() => {});
                }
            }
            const indexPath = path.join(this.directory, 'preview-index.json');
            await fs.promises.writeFile(indexPath + '.tmp', JSON.stringify([...this.entries.values()]));
            await fs.promises.rename(indexPath + '.tmp', indexPath);
        })().catch(error => { console.warn('Window previews:', error.message); }).finally(() => { this.pending = null; });
        return this.pending;
    }
    forApp(appId) {
        const entry = [...this.entries.values()].filter(item => item.appId === appId)
            .sort((a,b) => b.capturedAt - a.capturedAt)[0];
        return entry ? `cache/snapshots/${entry.file}?t=${entry.capturedAt}` : null;
    }
}
module.exports = { WindowPreviews, windowSourceHwnd, usableThumbnail };