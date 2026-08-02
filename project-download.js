const PROJECT_FILES = [
  'index.html',
  'styles.css',
  'duty-system.css',
  'package.json',
  'electron-main.cjs',
  'electron-preload.cjs',
  'desktop-i18n.js',
  'WINDOWS-KURULUM.md',
  'main.js',
  'state.js',
  'duty-state.js',
  'storage.js',
  'utils.js',
  'export.js',
  'miniapp.i18n.json',
  'locales/tr.json',
  'locales/en.json',
  'ui/admin-modal-view.js',
  'ui/advanced-panel-view.js',
  'ui/contact-panel-view.js',
  'ui/duty-panel-view.js',
  'ui/duty-print-view.js',
  'ui/duty-roster-utils.js',
  'ui/duty-system-view.js',
  'ui/icons.js',
  'ui/language-view.js',
  'ui/modal-view.js',
  'ui/month-selector-view.js',
  'ui/monthly-table-view.js',
  'ui/personnel-detail-modal-view.js',
  'ui/print-view.js',
  'ui/reports-panel-view.js',
  'ui/role-modal-view.js',
  'ui/stats-view.js',
  'ui/swap-request-view.js',
  'ui/system-switcher-view.js',
  'ui/tabs-view.js',
  'ui/toast-view.js',
  'ui/unit-modal-view.js',
  'ui/warnings-panel-view.js',
  'ui/week-table-view.js',
  'project-download.js'
];

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

// The preview server can return 403 for index.html.  Using outerHTML as the
// first choice would capture the already-rendered application, including
// translated/dynamic labels and the current screen state, instead of the
// original source shell. Keep a clean source fallback for that case.
function fallbackIndexSource() {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
  <meta http-equiv="Pragma" content="no-cache">
  <meta http-equiv="Expires" content="0">
  <title>Puantaj Sistemi</title>
  <link rel="stylesheet" href="styles.css?v=20">
  <link rel="stylesheet" href="duty-system.css?v=13">
</head>
<body>
  <div class="app" id="screenView">
    <div class="glass header">
      <div class="brand-block">
        <div class="brand-line"><h1><span id="appTitleIcon"></span><span data-i18n="app.title">Puantaj Sistemi</span></h1><div id="systemSwitcher"></div></div>
        <p id="appSubtitle" data-i18n="app.subtitle">CERRAHİ 1-2 — Haziran 2026</p>
      </div>
      <div class="header-actions" id="headerActions"></div>
    </div>

    <div class="glass" style="padding:14px 18px;margin-bottom:16px;display:flex;align-items:center;gap:16px;flex-wrap:wrap">
      <div style="display:flex;align-items:center;gap:10px">
        <span id="unitIcon"></span>
        <div id="unitSelector"></div>
      </div>
      <div class="divider-v"></div>
      <div style="display:flex;align-items:center;gap:10px">
        <span id="calendarIcon"></span>
        <div id="monthSelector"></div>
      </div>
      <div style="flex:1"></div>
      <button class="btn" id="roleBtn" data-i18n="app.roleBtn">Rol</button>
    </div>

    <div id="workspaceView">
    <div class="tabs" id="weekTabs" role="tablist"></div>

    <div class="stats-row" id="statsRow"></div>

    <div class="glass" style="padding:16px;margin-bottom:16px">
      <div class="legend" id="legendContainer"></div>
      <p style="font-size:11px;color:rgba(255,255,255,0.35)" data-i18n="app.shiftCodes"></p>
    </div>

    <div class="section-title" id="weekLabel">1. HAFTA</div>
    <div class="glass table-wrap" id="tableContainer"></div>

    <div class="section-title" id="monthlyLabel" style="margin-top:16px" data-i18n="app.monthlySummary">AYLIK ÖZET</div>
    <div class="glass table-wrap"><div id="monthlyContainer"></div></div>

    <div id="reportsPanel" style="display:none"></div>

    <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end;flex-wrap:wrap" id="bottomActions"></div>

    <div id="footerBar" style="margin-top:12px;padding:10px 14px;border-radius:8px;background:rgba(255,255,255,0.04);font-size:11px;color:rgba(255,255,255,0.3);text-align:center"></div>
    </div>
    <div id="dutySystemView" style="display:none"></div>
  </div>

  <div id="printView" class="print-view"></div>

  <script type="module" src="main.js?v=24"></script>
</body>
</html>`;
}

async function readFromCache(url) {
  if (!('caches' in window)) return null;
  try {
    const response = await caches.match(url);
    return response?.ok ? response.text() : null;
  } catch {
    return null;
  }
}

function readViaSourceFrame(url) {
  return new Promise(resolve => {
    const frame = document.createElement('iframe');
    let settled = false;
    const finish = value => {
      if (settled) return;
      settled = true;
      frame.remove();
      resolve(value || null);
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
    if (desktopSource != null) return { name: `puantaj-projesi/${path}`, text: desktopSource };
  }

  // In preview, never use the rendered document or a transformed HTML
  // response for index.html. The preview shell may contain runtime i18n
  // changes, which can turn visible labels into raw keys such as "app.title".
  // Keep the downloaded source shell stable and source-oriented.
  if (path === 'index.html') {
    return { name: `puantaj-projesi/${path}`, text: fallbackIndexSource() };
  }

  const url = new URL(path, import.meta.url).href;
  const cached = await readFromCache(url);
  if (cached) return { name: `puantaj-projesi/${path}`, text: cached };

  const candidates = [url, `${url}${url.includes('?') ? '&' : '?'}source=download`];
  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate, { cache: 'no-store', credentials: 'include' });
      if (response.ok) return { name: `puantaj-projesi/${path}`, text: await response.text() };
    } catch {
      // The preview server may reject direct fetches; try the source frame below.
    }
  }

  // Never use the iframe text fallback for index.html. Browsers render an
  // HTML response inside the iframe, so body.textContent would become the
  // visible UI text rather than the HTML source. Use the clean shell below
  // when the original index cannot be fetched.
  const framed = path === 'index.html' ? null : await readViaSourceFrame(url);
  if (framed) return { name: `puantaj-projesi/${path}`, text: framed };
  if (path === 'index.html') {
    return { name: `puantaj-projesi/${path}`, text: fallbackIndexSource() };
  }
  throw new Error(`${path}: source unavailable`);
}

async function readProjectFiles() {
  const results = [];
  for (const path of PROJECT_FILES) results.push(await readProjectFile(path));
  return results.map(file => ({ ...file, bytes: textEncoder.encode(file.text) }));
}

export async function downloadProject() {
  const files = await readProjectFiles();
  const readme = textEncoder.encode([
    'Puantaj Sistemi proje kaynakları',
    'Bu arşiv Miniapp çalışma alanındaki kaynak dosyalardan oluşturuldu.',
    'Kaynaklar önizleme ortamındaki dosya yanıtlarından okunarak paketlendi.',
    `Dosya sayısı: ${files.length}`,
    `Oluşturulma: ${new Date().toISOString()}`
  ].join('\n'));
  const archive = zipStore([...files, { name: 'puantaj-projesi/README.txt', bytes: readme }]);
  const blob = new Blob([archive], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `puantaj-projesi-${new Date().toISOString().slice(0, 10)}.zip`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
