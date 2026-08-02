import { getPersonnelList, getMonthlyTotal, getTotalNightHours, getCurrentUnitId, getUnitName, getScheduleData, getStateSnapshot, importStateSnapshot } from '../state.js';
import { getYear, getMonth, MONTHS_TR, t, uid } from '../utils.js';
import { loadState, saveState } from '../storage.js';
import { showToast } from './toast-view.js';

function archiveKey() {
  return `puantaj_archive_${getCurrentUnitId()}`;
}

function backupKey() {
  return `puantaj_backup_${getCurrentUnitId()}`;
}

function getMonthLabel(y, m) {
  return `${MONTHS_TR[m]} ${y}`;
}

function buildHistory() {
  const personnel = getPersonnelList();
  const currentY = getYear();
  const currentM = getMonth();
  const history = [];

  for (let offset = -5; offset <= 0; offset++) {
    let m = currentM + offset;
    let y = currentY;
    while (m < 0) { m += 12; y--; }
    while (m > 11) { m -= 12; y++; }

    const worked = personnel.reduce((sum, name) => sum + getMonthlyTotal(name, 'worked'), 0);
    const extra = personnel.reduce((sum, name) => sum + getMonthlyTotal(name, 'extra'), 0);
    const holiday = personnel.reduce((sum, name) => sum + getMonthlyTotal(name, 'holiday'), 0);
    const night = personnel.reduce((sum, name) => sum + getTotalNightHours(name), 0);

    history.push({
      label: getMonthLabel(y, m),
      year: y,
      month: m,
      worked,
      extra,
      holiday,
      night,
      personnelCount: personnel.length,
      isCurrent: offset === 0
    });
  }

  return history;
}

function renderChart(container, history) {
  const maxVal = Math.max(...history.map(h => Math.max(h.worked, h.extra, h.holiday, h.night)), 1);

  container.innerHTML = `
    <div style="display:flex;align-items:flex-end;gap:8px;height:160px;padding:10px;border-radius:10px;background:rgba(255,255,255,0.05)">
      ${history.map(h => {
        const workedH = Math.round((h.worked / maxVal) * 120);
        const extraH = Math.round((h.extra / maxVal) * 120);
        const holidayH = Math.round((h.holiday / maxVal) * 120);
        const nightH = Math.round((h.night / maxVal) * 120);
        return `
          <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
            <div style="display:flex;align-items:flex-end;gap:2px;height:120px">
              <div style="width:8px;height:${workedH}px;background:#38bdf8;border-radius:2px" title="${t('app.totalHours')}: ${h.worked}"></div>
              <div style="width:8px;height:${nightH}px;background:#a78bfa;border-radius:2px" title="${t('app.nightShift')}: ${h.night}"></div>
              <div style="width:8px;height:${extraH}px;background:#fbbf24;border-radius:2px" title="${t('app.overtime')}: ${h.extra}"></div>
              <div style="width:8px;height:${holidayH}px;background:#f87171;border-radius:2px" title="${t('app.holiday')}: ${h.holiday}"></div>
            </div>
            <span style="font-size:10px;color:rgba(255,255,255,0.5);white-space:nowrap">${h.label.split(' ')[0]}</span>
          </div>
        `;
      }).join('')}
    </div>
    <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-top:10px;font-size:11px;color:rgba(255,255,255,0.6)">
      <span><span style="display:inline-block;width:8px;height:8px;background:#38bdf8;border-radius:2px;margin-right:4px"></span>${t('app.totalHours')}</span>
      <span><span style="display:inline-block;width:8px;height:8px;background:#a78bfa;border-radius:2px;margin-right:4px"></span>${t('app.nightShift')}</span>
      <span><span style="display:inline-block;width:8px;height:8px;background:#fbbf24;border-radius:2px;margin-right:4px"></span>${t('app.overtime')}</span>
      <span><span style="display:inline-block;width:8px;height:8px;background:#f87171;border-radius:2px;margin-right:4px"></span>${t('app.holiday')}</span>
    </div>
  `;
}

function calculateFairness() {
  const personnel = getPersonnelList();
  if (personnel.length < 2) return [];

  const data = personnel.map(name => ({
    name,
    night: getTotalNightHours(name),
    extra: getMonthlyTotal(name, 'extra')
  }));

  const avgNight = data.reduce((sum, p) => sum + p.night, 0) / data.length;
  const avgExtra = data.reduce((sum, p) => sum + p.extra, 0) / data.length;

  const warnings = [];
  data.forEach(p => {
    if (avgNight > 0) {
      const ratio = p.night / avgNight;
      if (ratio >= 1.5) warnings.push({ type: 'high', person: p.name, field: t('reports.fieldNight'), ratio: ratio.toFixed(1) });
      else if (ratio <= 0.5 && p.night > 0) warnings.push({ type: 'low', person: p.name, field: t('reports.fieldNight'), ratio: ratio.toFixed(1) });
    }
    if (avgExtra > 0) {
      const ratio = p.extra / avgExtra;
      if (ratio >= 1.5) warnings.push({ type: 'high', person: p.name, field: t('reports.fieldExtra'), ratio: ratio.toFixed(1) });
      else if (ratio <= 0.5 && p.extra > 0) warnings.push({ type: 'low', person: p.name, field: t('reports.fieldExtra'), ratio: ratio.toFixed(1) });
    }
  });

  return warnings;
}

function renderFairness(container) {
  const items = calculateFairness();
  if (!items.length) {
    container.innerHTML = `<p style="font-size:12px;color:rgba(255,255,255,0.4);text-align:center;padding:14px">${t('reports.fairnessBalanced')}</p>`;
    return;
  }

  container.innerHTML = items.map(item => `
    <div class="warning-item ${item.type === 'high' ? 'warning-overtime' : 'warning-rest'}" style="padding:10px;border-radius:8px;background:rgba(255,255,255,0.05);margin-bottom:6px;font-size:12px;color:rgba(255,255,255,0.85)">
      ${item.type === 'high'
        ? t('reports.fairnessDetailHigh', { name: item.person, field: item.field, ratio: item.ratio })
        : t('reports.fairnessDetailLow', { name: item.person, field: item.field, ratio: item.ratio })}
    </div>
  `).join('');
}

async function loadArchive() {
  try {
    return (await loadState(archiveKey())) || [];
  } catch (e) {
    return [];
  }
}

async function saveArchive(list) {
  try {
    await saveState(list.slice(-20), archiveKey());
  } catch (e) {
    console.error('Archive save failed', e);
  }
}

async function addToArchive() {
  const list = await loadArchive();
  const label = `${getUnitName()} — ${getMonthLabel(getYear(), getMonth())}`;
  list.push({
    id: uid('pdf'),
    label,
    unitId: getCurrentUnitId(),
    year: getYear(),
    month: getMonth(),
    createdAt: new Date().toISOString()
  });
  await saveArchive(list);
  showToast(t('reports.archived'), 'success');
}

async function renderArchive(container) {
  const list = await loadArchive();
  if (!list.length) {
    container.innerHTML = `<p style="font-size:12px;color:rgba(255,255,255,0.4);text-align:center;padding:14px">${t('reports.noArchive')}</p>`;
    return;
  }

  container.innerHTML = list.slice().reverse().map(item => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px;border-radius:8px;background:rgba(255,255,255,0.05);margin-bottom:6px">
      <div>
        <div style="font-size:13px;color:#fff">${item.label}</div>
        <div style="font-size:11px;color:rgba(255,255,255,0.4)">${new Date(item.createdAt).toLocaleDateString('tr-TR')}</div>
      </div>
      <button class="action-btn archive-download" data-id="${item.id}" aria-label="PDF Indir">PDF</button>
    </div>
  `).join('');

  container.querySelectorAll('.archive-download').forEach(btn => {
    btn.addEventListener('click', () => {
      showToast(t('reports.pdfGenerated'), 'info');
      setTimeout(() => window.print(), 300);
    });
  });
}

async function loadBackups() {
  try {
    return (await loadState(backupKey())) || [];
  } catch (e) {
    return [];
  }
}

async function saveBackups(list) {
  try {
    await saveState(list.slice(-10), backupKey());
  } catch (e) {
    console.error('Backup save failed', e);
  }
}

async function createBackup() {
  const schedule = getScheduleData();
  const list = await loadBackups();
  list.push({
    id: uid('bak'),
    label: `${getUnitName()} — ${getMonthLabel(getYear(), getMonth())}`,
    unitId: getCurrentUnitId(),
    year: getYear(),
    month: getMonth(),
    snapshot: getStateSnapshot(),
    createdAt: new Date().toISOString()
  });
  await saveBackups(list);
  showToast(t('reports.backupCreated'), 'success');
}

async function renderBackups(container) {
  const list = await loadBackups();
  if (!list.length) {
    container.innerHTML = `<p style="font-size:12px;color:rgba(255,255,255,0.4);text-align:center;padding:14px">${t('reports.noBackups')}</p>`;
    return;
  }

  container.innerHTML = list.slice().reverse().map(item => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px;border-radius:8px;background:rgba(255,255,255,0.05);margin-bottom:6px">
      <div>
        <div style="font-size:13px;color:#fff">${item.label}</div>
        <div style="font-size:11px;color:rgba(255,255,255,0.4)">${new Date(item.createdAt).toLocaleDateString('tr-TR')}</div>
      </div>
      <button class="action-btn backup-restore" data-id="${item.id}" aria-label="Geri Yükle">↩</button>
    </div>
  `).join('');

  container.querySelectorAll('.backup-restore').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm(t('reports.restoreConfirm'))) {
        const item = list.find(entry => entry.id === btn.dataset.id);
        if (item?.snapshot && importStateSnapshot(item.snapshot)) {
          showToast(t('reports.backupRestored'), 'success');
          setTimeout(() => window.location.reload(), 250);
        }
      }
    });
  });
}

export async function initReportsPanel(panel) {
  if (!panel) return;

  panel.innerHTML = `
    <div class="glass" style="padding:16px;margin-bottom:16px">
      <h2 class="section-title" style="margin-bottom:14px">${t('reports.comparisonTitle')}</h2>
      <div id="reportsChart"></div>
    </div>
    <div class="glass" style="padding:16px;margin-bottom:16px">
      <h2 class="section-title" style="margin-bottom:12px">${t('reports.fairnessTitle')}</h2>
      <div id="fairnessList"></div>
    </div>
    <div class="glass" style="padding:16px;margin-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <h2 class="section-title" style="margin:0">${t('reports.archiveTitle')}</h2>
        <button class="btn btn-primary" id="archiveCurrentBtn" style="padding:6px 12px;font-size:12px">${t('reports.archiveCurrent')}</button>
      </div>
      <div id="archiveList"></div>
    </div>
    <div class="glass" style="padding:16px;margin-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <h2 class="section-title" style="margin:0">${t('reports.backupTitle')}</h2>
        <button class="btn btn-primary" id="backupCurrentBtn" style="padding:6px 12px;font-size:12px">${t('reports.backupCurrent')}</button>
      </div>
      <div id="backupList"></div>
    </div>
    <div class="glass" style="padding:16px">
      <h2 class="section-title" style="margin-bottom:12px">${t('reports.summaryTitle')}</h2>
      <div id="reportsSummary"></div>
    </div>
  `;

  const history = buildHistory();
  renderChart(panel.querySelector('#reportsChart'), history);
  renderFairness(panel.querySelector('#fairnessList'));

  await renderArchive(panel.querySelector('#archiveList'));
  await renderBackups(panel.querySelector('#backupList'));

  panel.querySelector('#archiveCurrentBtn').addEventListener('click', async () => {
    await addToArchive();
    await renderArchive(panel.querySelector('#archiveList'));
  });

  panel.querySelector('#backupCurrentBtn').addEventListener('click', async () => {
    await createBackup();
    await renderBackups(panel.querySelector('#backupList'));
  });

  const summary = panel.querySelector('#reportsSummary');
  const personnel = getPersonnelList();
  summary.innerHTML = `
    <table class="monthly-table" style="min-width:auto">
      <thead>
        <tr>
          <th>${t('app.nameCol')}</th>
          <th>${t('app.totalHours')}</th>
          <th>${t('app.nightShift')}</th>
          <th>${t('app.overtime')}</th>
          <th>${t('app.holiday')}</th>
        </tr>
      </thead>
      <tbody>
        ${personnel.map(name => `
          <tr>
            <td style="text-align:left">${name}</td>
            <td>${getMonthlyTotal(name, 'worked')}</td>
            <td>${getTotalNightHours(name)}</td>
            <td>${getMonthlyTotal(name, 'extra')}</td>
            <td>${getMonthlyTotal(name, 'holiday')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}
