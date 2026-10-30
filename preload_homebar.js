const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('homebarAPI', {
    triggerHome: () => ipcRenderer.send('homebar-click'),
    triggerSwitcher: () => ipcRenderer.send('homebar-hold'),
    onRamUpdate: (cb) => {
        const listener = (_, val) => cb(val);
        ipcRenderer.on('ram-update', listener);
        return () => ipcRenderer.removeListener('ram-update', listener);
    },
    onRamAlert: (cb) => {
        const listener = (_, val) => cb(val);
        ipcRenderer.on('ram-alert', listener);
        return () => ipcRenderer.removeListener('ram-alert', listener);
    }
});