const { app, BrowserWindow, ipcMain, shell } = require('electron');
const fs = require('fs');
const path = require('path');

let mainWindow;

function localePath(code) {
  return path.join(__dirname, 'locales', code === 'en' ? 'en.json' : 'tr.json');
}

function settingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsPath(), 'utf8')) || {};
  } catch {
    return {};
  }
}

function writeSettings(next) {
  const file = settingsPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(next, null, 2), 'utf8');
}

function registerDesktopBridge() {
  ipcMain.on('desktop-read-locale', event => {
    const settings = readSettings();
    const code = settings.locale === 'en' ? 'en' : 'tr';
    try {
      event.returnValue = {
        code,
        catalog: JSON.parse(fs.readFileSync(localePath(code), 'utf8'))
      };
    } catch {
      event.returnValue = { code: 'tr', catalog: {} };
    }
  });

  ipcMain.on('desktop-save-locale', (event, code) => {
    const settings = readSettings();
    writeSettings({ ...settings, locale: code === 'en' ? 'en' : 'tr' });
    event.returnValue = true;
  });

  ipcMain.on('desktop-read-file', (event, relativePath) => {
    const safePath = String(relativePath || '').replaceAll('\\', '/');
    const allowed = safePath === 'index.html'
      || safePath === 'package.json'
      || safePath === 'miniapp.i18n.json'
      || safePath === 'WINDOWS-KURULUM.md'
      || /^(styles|duty-system|main|state|duty-state|storage|utils|export|project-download|desktop-i18n)\.(js|css)$/.test(safePath)
      || /^electron-(main|preload)\.cjs$/.test(safePath)
      || /^(locales|ui)\//.test(safePath);
    if (!allowed) {
      event.returnValue = null;
      return;
    }
    try {
      event.returnValue = fs.readFileSync(path.join(__dirname, safePath), 'utf8');
    } catch {
      event.returnValue = null;
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: '#0f2027',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'electron-preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url === 'about:blank') return { action: 'allow' };
    if (url.startsWith('mailto:') || url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  registerDesktopBridge();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
