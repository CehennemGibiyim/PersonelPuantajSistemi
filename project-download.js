const PROJECT_FILES = [
  'index.html',
  'boot-diagnostics.js',
  'boot-entry.js',
  'styles.css',
  'duty-system.css',
  'directory.css',
  'availability.css',
  'onboarding.css',
  'polish.css',
  'dashboard.css',
  'reports.css',
  'period-selector.css',
  'navigation.css',
  'templates-workspace.css',
  'desktop-window.css',
  'data-guard.js',
  'package.json',
  'electron-main.cjs',
  'electron-preload.cjs',
  'desktop-i18n.js',
  'WINDOWS-KURULUM.md',
  'main.js',
  'excel-import.js',
  'leave-state.js',
  'state.js',
  'availability-state.js',
  'duty-template-state.js',
  'period-lock-state.js',
  'period-approval-state.js',
  'period-note-state.js',
  'audit-state.js',
  'admin-state.js',
  'duty-state.js',
  'personnel-assignment.js',
  'personnel-network.js',
  'personnel-photo-state.js',
  'personnel-photo-service.js',
  'name-format.js',
  'storage.js',
  'utils.js',
  'export.js',
  'miniapp.i18n.json',
  'locales/tr.json',
  'locales/en.json',
  'ui/admin-modal-view.js',
  'ui/advanced-panel-view.js',
  'ui/onboarding-view.js',
  'ui/dashboard-view.js',
  'ui/favorites-view.js',
  'ui/security-status-view.js',
  'ui/startup-checks.js',
  'ui/contact-panel-view.js',
  'ui/duty-panel-view.js',
  'ui/duty-print-view.js',
  'ui/duty-roster-utils.js',
  'ui/duty-conflict-utils.js',
  'ui/duty-system-view.js',
  'ui/duty-template-panel-view.js',
  'ui/duty-template-import-view.js',
  'ui/period-lock-panel-view.js',
  'ui/period-approval-panel-view.js',
  'ui/audit-panel-view.js',
  'ui/icons.js',
  'ui/language-view.js',
  'ui/modal-view.js',
  'ui/month-selector-view.js',
  'ui/monthly-table-view.js',
  'ui/monthly-note-view.js',
  'ui/personnel-directory-view.js',
  'ui/personnel-attendance-view.js',
  'ui/personnel-departments-view.js',
  'ui/photo-crop-view.js',
  'ui/directory-print-view.js',
  'ui/personnel-detail-modal-view.js',
  'ui/personnel-import-view.js',
  'ui/print-view.js',
  'ui/reports-panel-view.js',
  'ui/role-modal-view.js',
  'ui/sidebar-view.js',
  'ui/swap-request-view.js',
  'ui/tabs-view.js',
  'ui/toast-view.js',
  'ui/templates-workspace-view.js',
  'ui/unit-modal-view.js',
  'ui/warnings-panel-view.js',
  'ui/availability-calendar-view.js',
  'ui/week-table-view.js',
  'project-download.js'
];

const EXPECTED_SOURCE_FILE_COUNT = 88;

function assertProjectFileList() {
  const uniqueFiles = new Set(PROJECT_FILES);
  if (PROJECT_FILES.length !== EXPECTED_SOURCE_FILE_COUNT) {
    throw new Error(`Proje dosya listesi eksik veya fazla: ${PROJECT_FILES.length}/${EXPECTED_SOURCE_FILE_COUNT}`);
  }
  if (uniqueFiles.size !== PROJECT_FILES.length) {
    throw new Error('Proje dosya listesinde tekrar eden dosya var. ZIP oluşturulmadı.');
  }
  const required = [
    'index.html', 'main.js', 'project-download.js', 'ui/templates-workspace-view.js',
    'electron-main.cjs', 'electron-preload.cjs', 'package.json', 'locales/tr.json', 'locales/en.json'
  ];
  const missing = required.filter(path => !uniqueFiles.has(path));
  if (missing.length) throw new Error(`Proje listesinde zorunlu dosya eksik: ${missing.join(', ')}`);
}

const textEncoder = new TextEncoder();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value) {
  return new Uint8Array([value & 0xff, (value >>> 8) & 0xff]);
}

function u32(value) {
  return new Uint8Array([
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff
  ]);
}

function concat(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  parts.forEach(part => {
    result.set(part, offset);
    offset += part.length;
  });
  return result;
}

function dosDateTime(date = new Date()) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = Math.max(1980, date.getFullYear()) - 1980;
  const stamp = (year << 9) | (month << 5) | day;
  return { time, stamp };
}

function zipStore(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const { time, stamp } = dosDateTime();

  files.forEach(({ name, bytes }) => {
    const nameBytes = textEncoder.encode(name);
    const checksum = crc32(bytes);
    const localHeader = concat([
      u32(0x04034b50), u16(20), u16(0x800), u16(0), u16(time), u16(stamp),
      u32(checksum), u32(bytes.length), u32(bytes.length), u16(nameBytes.length), u16(0), nameBytes
    ]);
    localParts.push(localHeader, bytes);
    centralParts.push(concat([
      u32(0x02014b50), u16(20), u16(20), u16(0x800), u16(0), u16(time), u16(stamp),
      u32(checksum), u32(bytes.length), u32(bytes.length), u16(nameBytes.length), u16(0), u16(0),
      u16(0), u16(0), u32(0), u32(offset), nameBytes
    ]));
    offset += localHeader.length + bytes.length;
  });

  const localData = concat(localParts);
  const centralData = concat(centralParts);
  const endRecord = concat([
    u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
    u32(centralData.length), u32(localData.length), u16(0)
  ]);
  return concat([localData, centralData, endRecord]);
}

function currentIndexSource() {
  const root = document.documentElement.cloneNode(true);
  root.classList.remove('app-ready');
  [
    '#sidebar', '#viewToolbar', '#onboardingView', '#dashboardView',
    '#unitSelector', '#monthSelector', '#appSubtitle', '#headerActions',
    '#weekTabs', '#legendContainer', '#tableContainer', '#monthlyContainer',
    '#reportsPanel', '#bottomActions', '#footerBar', '#templatesWorkspaceView',
    '#dutySystemView', '#printView'
  ].forEach(selector => {
    const element = root.querySelector(selector);
    if (element) element.replaceChildren();
  });
  const bootScreen = root.querySelector('#bootScreen');
  if (bootScreen) bootScreen.hidden = false;
  const bootError = root.querySelector('#bootError');
  if (bootError) {
    bootError.hidden = true;
    bootError.textContent = '';
  }
  const moduleScript = root.querySelector('script[type="module"][src*="main.js"]');
  if (!moduleScript) {
    const script = document.createElement('script');
    script.type = 'module';
    script.src = 'main.js';
    root.querySelector('body')?.appendChild(script);
  }
  return `<!DOCTYPE html>\n${root.outerHTML}`;
}

function isUsableSource(path, text) {
  const value = String(text || '').trim();
  if (!value) return false;
  if (path === 'index.html') return false;
  // A preview 403/HTML error page must never be written over a JavaScript,
  // CSS, JSON or Markdown source file. That creates a ZIP that downloads
  // successfully but cannot boot when opened with Electron.
  if (/^(?:<!doctype\s+html|<html[\s>])/i.test(value)) return false;
  if (/\.json$/i.test(path)) {
    try { JSON.parse(value); } catch { return false; }
  }
  return true;
}

function readViaSourceFrame(url, path) {
  return new Promise(resolve => {
    const frame = document.createElement('iframe');
    let settled = false;
    const finish = value => {
      if (settled) return;
      settled = true;
      frame.remove();
      resolve(isUsableSource(path, value) ? value : null);
    };
    const timer = window.setTimeout(() => finish(null), 5000);
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;width:1px;height:1px;left:-10px;top:-10px;border:0;opacity:0;pointer-events:none';
    frame.onload = () => {
      window.clearTimeout(timer);
      try {
        const doc = frame.contentDocument;
        finish(doc?.body?.textContent || doc?.documentElement?.textContent || null);
      } catch {
        finish(null);
      }
    };
    frame.onerror = () => {
      window.clearTimeout(timer);
      finish(null);
    };
    document.body.appendChild(frame);
    frame.src = url;
  });
}

async function readProjectFile(path) {
  if (window.desktopAPI?.readFile) {
    const desktopSource = window.desktopAPI.readFile(path);
    const usableDesktopSource = path === 'index.html'
      ? /<html[\s>]/i.test(String(desktopSource || '')) && /main\.js(?:\?[^"']*)?["']/i.test(String(desktopSource || ''))
      : isUsableSource(path, desktopSource);
    if (usableDesktopSource) return { name: `puantaj-projesi/${path}`, text: desktopSource };
  }

  // In preview, never use the rendered document or a transformed HTML
  // response for index.html. The preview shell may contain runtime i18n
  // changes, which can turn visible labels into raw keys such as "app.title".
  // Keep the downloaded source shell stable and source-oriented.
  if (path === 'index.html') {
    return { name: `puantaj-projesi/${path}`, text: currentIndexSource() };
  }

  const url = new URL(path, import.meta.url).href;
  // Prefer the current workspace response. A previously cached module can be
  // valid JavaScript while still being an older version of the project.
  const downloadUrl = `${url}${url.includes('?') ? '&' : '?'}download=${Date.now()}`;
  const candidates = [downloadUrl, `${url}${url.includes('?') ? '&' : '?'}source=download`];
  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate, { cache: 'no-store', credentials: 'include' });
      if (!response.ok) continue;
      const text = await response.text();
      if (isUsableSource(path, text)) {
        return { name: `puantaj-projesi/${path}`, text };
      }
    } catch {
      // The preview server may reject direct fetches; try the source frame below.
    }
  }

  // Never use the iframe text fallback for index.html. Browsers render an
  // HTML response inside the iframe, so body.textContent would become the
  // visible UI text rather than the HTML source. Build the fallback from the
  // current live shell instead of an embedded, potentially stale copy.
  const framed = path === 'index.html' ? null : await readViaSourceFrame(downloadUrl, path);
  if (framed) return { name: `puantaj-projesi/${path}`, text: framed };
  if (path === 'index.html') {
    return { name: `puantaj-projesi/${path}`, text: currentIndexSource() };
  }
  throw new Error(`${path}: source unavailable`);
}

async function readProjectFiles() {
  assertProjectFileList();
  const results = [];
  for (const path of PROJECT_FILES) results.push(await readProjectFile(path));
  return results.map(file => ({ ...file, bytes: textEncoder.encode(file.text) }));
}

function fileByName(files, name) {
  return files.find(file => file.name === `puantaj-projesi/${name}`);
}

function assertCurrentProjectSources(files) {
  const required = ['index.html', 'main.js', 'electron-main.cjs', 'electron-preload.cjs', 'package.json'];
  const missing = required.filter(name => !fileByName(files, name));
  if (missing.length) throw new Error(`Eksik proje dosyaları: ${missing.join(', ')}`);

  const index = fileByName(files, 'index.html').text;
  const main = fileByName(files, 'main.js').text;
  const electronMain = fileByName(files, 'electron-main.cjs').text;
  let packageJson;
  try {
    packageJson = JSON.parse(fileByName(files, 'package.json').text);
  } catch {
    throw new Error('package.json geçerli JSON değil. Güncel dosya okunamadı.');
  }

  const checks = [
    [/<script\s+type=["']module["']\s+src=["']main\.js(?:\?[^"']*)?["']\s*><\/script>/i, 'index.html ana modül bağlantısı'],
    [/export\s+async\s+function\s+startApp\s*\(/, 'main.js startApp fonksiyonu'],
    [/window\.__miniappBootComplete\?\./, 'main.js başlangıç tamamlanma bildirimi'],
    [/did-finish-load/, 'electron-main.cjs yükleme bildirimi'],
    [/"start"\s*:\s*"electron\s+\."/, 'package.json Electron başlangıcı']
  ];
  const sources = [index, main, main, electronMain, JSON.stringify(packageJson)];
  const failed = checks.filter(([, label], index) => !checks[index][0].test(sources[index])).map(([, label]) => label);
  if (failed.length) {
    throw new Error(`Güncel başlangıç dosyası doğrulanamadı: ${failed.join(', ')}`);
  }
}

async function sha256(bytes) {
  if (!globalThis.crypto?.subtle) throw new Error('Dosya bütünlük doğrulaması kullanılamıyor.');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function createBuildManifest(files) {
  const createdAt = new Date().toISOString();
  const entries = await Promise.all(files.map(async file => ({
    path: file.name.replace(/^puantaj-projesi\//, ''),
    bytes: file.bytes.length,
    sha256: await sha256(file.bytes)
  })));
  return {
    format: 1,
    buildId: `puantaj-${createdAt.replace(/[-:.TZ]/g, '')}`,
    createdAt,
    entryPoint: 'index.html → main.js',
    sourceMode: window.desktopAPI?.readFile ? 'desktop-workspace' : 'preview-workspace',
    projectFileCount: files.length,
    files: entries
  };
}

export async function downloadProject() {
  const files = await readProjectFiles();
  assertCurrentProjectSources(files);
  const manifest = await createBuildManifest(files);
  const version = textEncoder.encode([
    'PERSONEL NÖBET + PUANTAJ SİSTEMİ',
    `Build ID: ${manifest.buildId}`,
    `Oluşturulma: ${manifest.createdAt}`,
    `Kaynak modu: ${manifest.sourceMode}`,
    `Kaynak dosyası: ${manifest.projectFileCount}`,
    'Başlangıç: index.html → main.js',
    '',
    'Bu dosya, ZIP arşivinin indirme sırasında güncel çalışma alanından oluşturulduğunu doğrulamak için eklenmiştir.',
    'Dosya bütünlük listesi BUILD-MANIFEST.json içindedir.'
  ].join('\n'));
  const manifestBytes = textEncoder.encode(JSON.stringify(manifest, null, 2));
  const readme = textEncoder.encode([
    'Puantaj Sistemi proje kaynakları',
    'Bu arşiv, indirme anında çalışma alanındaki güncel kaynak dosyalardan oluşturuldu.',
    `Build ID: ${manifest.buildId}`,
    `Dosya sayısı: ${manifest.projectFileCount}`,
    `Oluşturulma: ${manifest.createdAt}`,
    '',
    'Kurulum: ZIP içeriğini yeni bir klasöre çıkarın, npm install ve npm start çalıştırın.',
    'Bütünlük kontrolü için BUILD-VERSION.txt ve BUILD-MANIFEST.json dosyalarını saklayın.'
  ].join('\n'));
  const archive = zipStore([
    ...files,
    { name: 'puantaj-projesi/BUILD-VERSION.txt', bytes: version },
    { name: 'puantaj-projesi/BUILD-MANIFEST.json', bytes: manifestBytes },
    { name: 'puantaj-projesi/README.txt', bytes: readme }
  ]);
  const blob = new Blob([archive], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `puantaj-projesi-${new Date().toISOString().slice(0, 10)}.zip`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
