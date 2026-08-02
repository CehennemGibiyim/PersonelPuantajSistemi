let desktopCatalog = null;
let desktopLocale = 'tr';
let catalogPromise = null;

function readPath(source, key) {
  return String(key).split('.').reduce((value, part) => value?.[part], source);
}

function interpolate(value, values) {
  return String(value).replace(/\{([^}]+)\}/g, (_, key) => String(values?.[key] ?? `{${key}}`));
}

function replaceStaticText() {
  if (!desktopCatalog || typeof document === 'undefined') return;
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const value = readPath(desktopCatalog, element.dataset.i18n);
    if (typeof value === 'string') element.textContent = value;
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
    const value = readPath(desktopCatalog, element.dataset.i18nPlaceholder);
    if (typeof value === 'string') element.setAttribute('placeholder', value);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(element => {
    const value = readPath(desktopCatalog, element.dataset.i18nTitle);
    if (typeof value === 'string') element.setAttribute('title', value);
  });
  document.querySelectorAll('[data-i18n-aria-label]').forEach(element => {
    const value = readPath(desktopCatalog, element.dataset.i18nAriaLabel);
    if (typeof value === 'string') element.setAttribute('aria-label', value);
  });
}

function browserLocale() {
  const documentLanguage = String(typeof document !== 'undefined' ? document.documentElement?.lang : '').toLowerCase();
  if (documentLanguage.startsWith('en')) return 'en';
  if (documentLanguage.startsWith('tr')) return 'tr';
  const language = String(typeof navigator !== 'undefined' ? navigator.language : '').toLowerCase();
  return language.startsWith('en') ? 'en' : 'tr';
}

async function loadBrowserCatalog() {
  desktopLocale = browserLocale();
  const candidates = [desktopLocale, 'tr'];
  for (const code of candidates) {
    try {
      const url = new URL(`locales/${code}.json`, import.meta.url);
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) continue;
      desktopCatalog = await response.json();
      desktopLocale = code;
      return;
    } catch {
      // file:// pages may block fetch; Electron uses the synchronous bridge below.
    }
  }
  desktopCatalog = {};
}

export function initDesktopI18n() {
  if (window.miniappI18n) return Promise.resolve();
  if (catalogPromise) return catalogPromise;

  catalogPromise = (async () => {
    if (window.desktopAPI?.isDesktop) {
      const result = window.desktopAPI.readLocale();
      desktopLocale = result?.code === 'en' ? 'en' : 'tr';
      desktopCatalog = result?.catalog || {};
    } else {
      // The preview CSP can block the platform i18n script. Load the local
      // catalog so the UI never replaces normal labels with raw keys such as
      // "app.title" or "advanced.projectDownload".
      await loadBrowserCatalog();
    }
    replaceStaticText();
  })();

  return catalogPromise;
}

export function desktopTranslate(key, values) {
  const value = readPath(desktopCatalog, key);
  return typeof value === 'string' ? interpolate(value, values) : key;
}

export function setDesktopLocale(code) {
  if (window.desktopAPI?.isDesktop) {
    desktopLocale = code === 'en' ? 'en' : 'tr';
    window.desktopAPI.saveLocale(desktopLocale);
    return;
  }
  desktopLocale = code === 'en' ? 'en' : 'tr';
}

export function getDesktopLocale() {
  return desktopLocale;
}
