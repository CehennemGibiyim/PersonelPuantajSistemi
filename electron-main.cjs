const { app, BrowserWindow, ipcMain, shell } = require('electron');
const fs = require('fs');
const path = require('path');

// Geliştirme terminalindeki Electron güvenlik bilgilendirmesini kapatır.
// contextIsolation ve nodeIntegration ayarları güvenli bırakılır.
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

const APP_TITLE = 'Personel Nöbet + Puantaj Sistemi';
const DARK_WINDOW_BACKGROUND = '#0f2027';
let mainWindow = null;
let bridgeRegistered = false;
let windowShown = false;

if (process.platform === 'win32') {
  // Bazı Windows ekran kartı sürücülerinde Electron 37 ile görülen GPU
  // başlangıç sorununu uygulama arayüzünden bağımsız hale getirir.
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('disable-gpu');
}

function errorText(error) {
  if (error instanceof Error) return `${error.message}\n${error.stack || ''}`;
  if (error && typeof error === 'object') return JSON.stringify(error, null, 2);
  return String(error || 'Bilinmeyen hata');
}

function logError(label, error) {
  console.error(`[Electron] ${label}: ${errorText(error)}`);
}

process.on('uncaughtException', error => logError('Yakalanmamış ana süreç hatası', error));
process.on('unhandledRejection', error => logError('Yakalanmamış Promise hatası', error));

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
  if (bridgeRegistered) return;
  bridgeRegistered = true;

  ipcMain.on('desktop-read-locale', event => {
    const settings = readSettings();
    const code = settings.locale === 'en' ? 'en' : 'tr';
    try {
      event.returnValue = {
        code,
        catalog: JSON.parse(fs.readFileSync(localePath(code), 'utf8'))
      };
    } catch (error) {
      logError('Dil dosyası okunamadı', error);
      event.returnValue = { code: 'tr', catalog: {} };
    }
  });

  ipcMain.on('desktop-save-locale', (event, code) => {
    try {
      const settings = readSettings();
      writeSettings({ ...settings, locale: code === 'en' ? 'en' : 'tr' });
      event.returnValue = true;
    } catch (error) {
      logError('Dil tercihi kaydedilemedi', error);
      event.returnValue = false;
    }
  });

  ipcMain.on('desktop-read-file', (event, relativePath) => {
    const safePath = String(relativePath || '').replaceAll('\\', '/');
    const allowed = safePath === 'index.html'
      || safePath === 'package.json'
      || safePath === 'miniapp.i18n.json'
      || safePath === 'WINDOWS-KURULUM.md'
      || /^[^/]+\.(js|css|cjs)$/.test(safePath)
      || /^(locales|ui)\//.test(safePath);
    if (!allowed || safePath.includes('..')) {
      event.returnValue = null;
      return;
    }
    try {
      event.returnValue = fs.readFileSync(path.join(__dirname, safePath), 'utf8');
    } catch {
      event.returnValue = null;
    }
  });

  ipcMain.on('window-minimize', event => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });
  ipcMain.on('window-toggle-maximize', event => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return;
    if (window.isMaximized()) window.unmaximize();
    else window.maximize();
  });
  ipcMain.on('window-close', event => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });

}

function showWindow(reason = 'unknown') {
  if (!mainWindow || mainWindow.isDestroyed() || windowShown) return;
  windowShown = true;
  mainWindow.show();
  mainWindow.focus();
  console.log(`[Electron] Arayüz penceresi gösterildi (${reason}).`);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[character]));
}

async function showFatalPage(title, detail) {
  logError(title, detail);
  if (!mainWindow || mainWindow.isDestroyed()) return;
  showWindow('hata tanı ekranı');
  const safeTitle = escapeHtml(title);
  const safeDetail = escapeHtml(errorText(detail));
  const html = `<!doctype html><html lang="tr"><head><meta charset="UTF-8"><title>${safeTitle}</title><style>body{margin:0;padding:32px;background:#102b35;color:#effcf8;font:16px Segoe UI,Arial,sans-serif}main{max-width:900px;margin:0 auto;background:#183d47;border:1px solid #6ca8a3;border-radius:14px;padding:28px}h1{margin:0 0 16px;font-size:24px}p{line-height:1.6}pre{white-space:pre-wrap;overflow:auto;background:#0b2027;padding:16px;border-radius:8px;color:#ffd5d5}small{color:#b7d4d1}</style></head><body><main><h1>${safeTitle}</h1><p>Uygulama penceresi açıldı ancak arayüz başlatılamadı.</p><pre>${safeDetail}</pre><small>Proje klasöründe npm install komutunu çalıştırıp tekrar deneyin.</small></main></body></html>`;
  try {
    await mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    showWindow('hata sayfası');
  } catch (error) {
    logError('Hata ekranı gösterilemedi', error);
  }
}

function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    showWindow('mevcut pencere');
    return mainWindow;
  }

  windowShown = false;
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 980,
    minHeight: 680,
    show: false,
    backgroundColor: DARK_WINDOW_BACKGROUND,
    frame: false,
    thickFrame: false,
    roundedCorners: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'electron-preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.once('ready-to-show', () => showWindow('ready-to-show'));
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[Electron] index.html başarıyla yüklendi.');
    showWindow('did-finish-load');
  });
  mainWindow.webContents.on('console-message', (_event, details) => {
    const level = String(details?.level ?? 'log').toUpperCase();
    const message = String(details?.message ?? '');
    const source = details?.sourceId ? ` (${details.sourceId}:${details.lineNumber || 0})` : '';
    console.log(`[Renderer ${level}]${source} ${message}`);
  });
  mainWindow.webContents.on('dom-ready', () => {
    console.log('[Electron] DOM hazır; renderer modülleri bekleniyor.');
  });
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (isMainFrame) showFatalPage('Arayüz dosyası yüklenemedi', `${errorDescription} (${errorCode})\n${validatedURL}`);
  });
  mainWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
    logError(`Preload yüklenemedi: ${preloadPath}`, error);
  });
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    logError('Renderer süreci kapandı', details);
    showFatalPage('Arayüz süreci kapandı', details);
  });
  mainWindow.webContents.on('unresponsive', () => {
    console.error('[Electron] Arayüz yanıt vermiyor.');
  });

  // ready-to-show bazı grafik sürücülerinde hiç gelmez. Bu süre sonunda
  // did-finish-load da gecikmiş olsa bile pencereyi kullanıcıya gösteririz.
  setTimeout(() => showWindow('açılış zaman aşımı güvenliği'), 3000);

  mainWindow.loadFile(path.join(__dirname, 'index.html')).catch(error => {
    showFatalPage('Arayüz dosyası yüklenemedi', error);
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url === 'about:blank') return { action: 'allow' };
    if (/^(https?:|mailto:)/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.on('closed', () => {
    console.log('[Electron] Pencere kapatıldı.');
    mainWindow = null;
    windowShown = false;
  });
  return mainWindow;
}

app.whenReady().then(() => {
  console.log(`[Electron] Başlatılıyor: ${__dirname}`);
  registerDesktopBridge();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else showWindow('activate');
  });
}).catch(error => {
  logError('Başlatma hatası', error);
  app.quit();
});

app.on('window-all-closed', () => {
  console.log('[Electron] Tüm pencereler kapandı.');
  if (process.platform !== 'darwin') app.quit();
});
