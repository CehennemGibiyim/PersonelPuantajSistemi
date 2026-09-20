const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopAPI', {
  isDesktop: true,
  readLocale() {
    return ipcRenderer.sendSync('desktop-read-locale');
  },
  saveLocale(code) {
    return ipcRenderer.sendSync('desktop-save-locale', code);
  },
  readFile(relativePath) {
    return ipcRenderer.sendSync('desktop-read-file', relativePath);
  },
  minimizeWindow() {
    ipcRenderer.send('window-minimize');
  },
  toggleMaximizeWindow() {
    ipcRenderer.send('window-toggle-maximize');
  },
  closeWindow() {
    ipcRenderer.send('window-close');
  }
});
