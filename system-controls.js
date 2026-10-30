'use strict';
const { execFile } = require('child_process');
const path = require('path');
function run(file, args) {
    return new Promise(resolve => execFile(file, args, {
        windowsHide: true, timeout: 12000, encoding: 'utf8', maxBuffer: 1024 * 1024
    }, (error, stdout) => {
        try { resolve(JSON.parse(stdout.replace(/^\uFEFF/, '').trim())); }
        catch { resolve({ success: false, error: error ? error.message : 'Windows trả dữ liệu không hợp lệ.' }); }
    }));
}
function powershell(action, value = 0) {
    return run('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
        '-File', path.join(__dirname, 'windows-control.ps1'), '-Action', action, '-Value', String(value)]);
}
let inflight = null;
let cached = null;
let updated = 0;
async function getControls() {
    if (cached && Date.now() - updated < 2500) return cached;
    if (inflight) return inflight;
    inflight = Promise.all([
        run(path.join(__dirname, 'controls.exe'), ['list']), powershell('radios'), powershell('get-brightness')
    ]).then(([native, radio, brightness]) => {
        cached = { ...native, radios: radio.radios || [], radioError: radio.error,
            brightness: brightness.success ? brightness.brightness : null, brightnessError: brightness.error };
        updated = Date.now(); return cached;
    }).finally(() => { inflight = null; });
    return inflight;
}
async function setControl(params = {}) {
    const { action, value, profile, interface: device } = params;
    let result;
    if (['volume', 'mute'].includes(action) && Number.isInteger(value) && value >= 0 && value <= 100) {
        result = await run(path.join(__dirname, 'controls.exe'), [action, String(value)]);
    } else if (['wifi', 'bluetooth', 'brightness'].includes(action) && Number.isInteger(value) && value >= 0 && value <= 100) {
        result = await powershell(action, value);
    } else if (action === 'connect' && typeof profile === 'string' && profile.length <= 256 &&
        /^\{[a-f0-9-]{36}\}$/i.test(device)) {
        result = await run(path.join(__dirname, 'controls.exe'), ['connect', device, profile]);
    } else return { success: false, error: 'Thao tác không được hỗ trợ.' };
    cached = null;
    return result;
}
module.exports = { getControls, setControl };