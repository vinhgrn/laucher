'use strict';
const fs = require('fs');
const path = require('path');
const { findAppWindow } = require('./runtime-policy');
class AppCatalog {
    constructor(shell, root) { this.shell = shell; this.root = root; this.links = new Map(); this.stamp = -1; this.cached = []; }
    resolve(app) {
        const result = { ...app };
        const paths = [...(app.shortcutPaths || []), /\.lnk$/i.test(app.appId || '') ? app.appId : null].filter(Boolean);
        const targets = new Set(app.executablePaths || []), ids = new Set(app.appUserModelIds || []);
        for (const shortcut of paths) {
            try {
                const stamp = fs.statSync(shortcut).mtimeMs;
                let cached = this.links.get(shortcut);
                if (!cached || cached.stamp !== stamp) {
                    cached = { stamp, value: this.shell.readShortcutLink(shortcut) };
                    this.links.set(shortcut, cached);
                }
                const link = cached.value;
                if (link.target) targets.add(link.target);
                if (link.appUserModelId) ids.add(link.appUserModelId);
                result.arguments ||= link.args || '';
            } catch {  }
        }
        if (/\.exe$/i.test(app.appId || '') && !String(app.appId).startsWith('{')) targets.add(app.appId);
        result.executablePaths = [...targets];
        result.executablePath ||= result.executablePaths[0] || '';
        result.appUserModelIds = [...ids];
        result.appUserModelId ||= result.appUserModelIds[0] || (String(app.appId).includes('!') ? app.appId : '');
        return result;
    }
    read() {
        try {
            const file = path.join(this.root, 'cache', 'apps.json'), stamp = fs.statSync(file).mtimeMs;
            if (stamp === this.stamp) return this.cached;
            const raw = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
            this.cached = Array.isArray(raw) ? raw.map(app => this.resolve(app)) : [];
            this.stamp = stamp;
            return this.cached;
        } catch { return []; }
    }
    resolveLaunch(info) {
        const cached = this.read().find(app => app.appId === info.appId);
        return this.resolve({ ...cached, ...info });
    }
    findWindow(windows, info) { return findAppWindow(windows, this.resolveLaunch(info)); }
}
module.exports = { AppCatalog };