import { getPersonnelList, getMonthlyTotal, getTotalNightHours, getCurrentUnitId, getUnitName, getScheduleData, getStateSnapshot, importStateSnapshot } from '../state.js';
import { getYear, getMonth, MONTHS_TR, t, uid } from '../utils.js';
import { loadState, saveState } from '../storage.js';
import { showToast } from './toast-view.js';
import { getAvailabilitySnapshot, importAvailabilitySnapshot } from '../availability-state.js';
import { getLeaveSnapshot, importLeaveSnapshot } from '../leave-state.js';
import { getDutyTemplatesSnapshot, importDutyTemplatesSnapshot } from '../duty-template-state.js';
import { getPeriodLockState, importPeriodLockSnapshot, isPeriodLocked } from '../period-lock-state.js';
import { getPeriodApprovalState, importPeriodApprovalSnapshot } from '../period-approval-state.js';
import { getAuditSnapshot, importAuditSnapshot } from '../audit-state.js';
import { sanitizeSnapshot } from '../data-guard.js';

function archiveKey() {
  return `puantaj_archive_${getCurrentUnitId()}`;
}

function backupKey() {
  return `puantaj_backup_${getCurrentUnitId()}`;
}

const MAX_BACKUPS = 10;
const MAX_BACKUP_BYTES = 850000;

function backupStoragePath() {
  return backupKey();
}

function backupFileName(item) {
  const unit = String(item?.label || getUnitName()).split(' — ')[0]
    .replace(/[^\p{L}\p{N}_-]+/gu, '-')
    .replace(/^-+|-+$/g, '') || 'birim';
  const year = Number(item?.year) || getYear();
  const month = String((Number(item?.month) || 0) + 1).padStart(2, '0');
  const stamp = calendarDay(item?.createdAt).replace(/-/g, '') || 'yedek';
  return `puantaj-${unit}-${year}-${month}-${stamp}.json`;
}

function getMonthLabel(y, m) {
  return `${MONTHS_TR[m]} ${y}`;
}

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));

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
  const data = personnel.map(name => ({
    name,
    worked: getMonthlyTotal(name, 'worked'),
    night: getTotalNightHours(name),
    extra: getMonthlyTotal(name, 'extra')
  }));
  const avgNight = data.length ? data.reduce((sum, person) => sum + person.night, 0) / data.length : 0;
  const avgExtra = data.length ? data.reduce((sum, person) => sum + person.extra, 0) / data.length : 0;
  const warnings = [];

  data.forEach(person => {
    const signals = [];
    if (avgNight > 0) {
      const ratio = person.night / avgNight;
      if (ratio >= 1.5) signals.push('high');
      else if (ratio <= 0.5 && person.night > 0) signals.push('low');
      if (ratio >= 1.5 || (ratio <= 0.5 && person.night > 0)) {
        warnings.push({ type: ratio >= 1.5 ? 'high' : 'low', person: person.name, field: t('reports.fieldNight'), ratio: ratio.toFixed(1) });
      }
    }
    if (avgExtra > 0) {
      const ratio = person.extra / avgExtra;
      if (ratio >= 1.5) signals.push('high');
      else if (ratio <= 0.5 && person.extra > 0) signals.push('low');
      if (ratio >= 1.5 || (ratio <= 0.5 && person.extra > 0)) {
        warnings.push({ type: ratio >= 1.5 ? 'high' : 'low', person: person.name, field: t('reports.fieldExtra'), ratio: ratio.toFixed(1) });
      }
    }
    person.status = signals.includes('high') ? 'high' : signals.includes('low') ? 'low' : 'balanced';
  });

  return { data, avgNight, avgExtra, warnings };
}

function renderFairness(container) {
  const analysis = calculateFairness();
  const { data, avgNight, avgExtra, warnings } = analysis;
  const statusKey = status => status === 'high' ? 'reports.fairnessHigh' : status === 'low' ? 'reports.fairnessLow' : 'reports.fairnessBalanced';

  if (!data.length) {
    container.innerHTML = `<div class="fairness-empty">${t('reports.fairnessNoData')}</div>`;
    return;
  }

  container.innerHTML = `
    <div class="fairness-stats" aria-label="${esc(t('reports.fairnessTitle'))}">
      <div class="fairness-stat accent"><strong>${data.length}</strong><span>${t('reports.fairnessPeople')}</span></div>
      <div class="fairness-stat"><strong>${avgNight.toFixed(1)}</strong><span>${t('reports.fairnessAverageNight')}</span></div>
      <div class="fairness-stat"><strong>${avgExtra.toFixed(1)}</strong><span>${t('reports.fairnessAverageExtra')}</span></div>
      <div class="fairness-stat"><strong>${warnings.length}</strong><span>${t('reports.fairnessWarningCount')}</span></div>
    </div>
    <div class="fairness-table-wrap">
      <table class="fairness-table">
        <thead><tr><th>${t('app.nameCol')}</th><th>${t('app.totalHours')}</th><th>${t('app.nightShift')}</th><th>${t('app.overtime')}</th><th>${t('reports.fairnessStatus')}</th></tr></thead>
        <tbody>${data.map(person => `
          <tr>
            <td class="fairness-person">${esc(person.name)}</td>
            <td>${person.worked}</td>
            <td>${person.night}</td>
            <td>${person.extra}</td>
            <td><span class="fairness-status is-${person.status}">${esc(t(statusKey(person.status)))}</span></td>
          </tr>
        `).join('')}</tbody>
      </table>
    </div>
    <div class="fairness-alerts">
      <span class="fairness-alerts-title">${t('reports.fairnessAlerts')}</span>
      ${warnings.length ? warnings.map(item => `<div class="fairness-alert is-${item.type}">${esc(item.type === 'high' ? t('reports.fairnessDetailHigh', { name: item.person, field: item.field, ratio: item.ratio }) : t('reports.fairnessDetailLow', { name: item.person, field: item.field, ratio: item.ratio }))}</div>`).join('') : `<div class="fairness-empty">${t('reports.fairnessBalanced')}</div>`}
    </div>
  `;
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
        <div style="font-size:13px;color:#fff">${esc(item.label)}</div>
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
    const trimmed = list.slice(-MAX_BACKUPS);
    while (trimmed.length > 1 && JSON.stringify(trimmed).length > MAX_BACKUP_BYTES) trimmed.shift();
    return await saveState(trimmed, backupKey());
  } catch (e) {
    console.error('Backup save failed', e);
    return false;
  }
}

function calendarDay(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function createBackup() {
  const list = await loadBackups();
  const createdAt = new Date().toISOString();
  const today = calendarDay(createdAt);
  const remaining = list.filter(item => calendarDay(item.createdAt) !== today);
  const replacedExisting = remaining.length < list.length;
  const backup = {
    id: uid('bak'),
    label: `${getUnitName()} — ${getMonthLabel(getYear(), getMonth())}`,
    unitId: getCurrentUnitId(),
    year: getYear(),
    month: getMonth(),
    snapshot: { schemaVersion: 4, exportedAt: createdAt, ...getStateSnapshot(), leaveRequests: getLeaveSnapshot(), availability: getAvailabilitySnapshot(), dutyTemplates: getDutyTemplatesSnapshot(), periodLock: getPeriodLockState(), periodApproval: getPeriodApprovalState(), auditLog: getAuditSnapshot() },
    createdAt
  };
  remaining.push(backup);
  if (!await saveBackups(remaining)) {
    showToast(t('reports.backupSaveFailed'), 'error');
    return false;
  }
  showToast(replacedExisting ? t('reports.backupReplaced') : t('reports.backupCreated'), 'success');
  return true;
}

function downloadBackup(item) {
  if (!item?.snapshot) return;
  const blob = new Blob([JSON.stringify(item.snapshot, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = backupFileName(item);
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  showToast(t('reports.backupDownloaded'), 'success');
}

async function deleteBackup(id) {
  const list = await loadBackups();
  const next = list.filter(item => item.id !== id);
  if (next.length === list.length) return false;
  return saveBackups(next);
}

async function deleteAutomaticBackups() {
  const store = window.miniappsAI?.storage;
  const unitId = getCurrentUnitId();
  if (!store || !unitId) return true;
  const indexKey = `puantaj_auto_backup_index_${unitId}`;
  try {
    const raw = await store.getItem(indexKey);
    const index = raw ? JSON.parse(raw) : [];
    if (Array.isArray(index)) {
      for (const item of index) {
        if (item?.key) await store.removeItem(item.key);
      }
    }
    await store.removeItem(indexKey);
    return true;
  } catch (error) {
    console.error('Automatic backup cleanup failed:', error);
    return false;
  }
}

async function deleteAllBackups() {
  if (!await saveBackups([])) return false;
  return deleteAutomaticBackups();
}

async function renderBackups(container) {
  const list = await loadBackups();
  if (!list.length) {
    container.innerHTML = `<p style="font-size:12px;color:rgba(255,255,255,0.4);text-align:center;padding:14px">${t('reports.noBackups')}</p>`;
    return;
  }

  container.innerHTML = list.slice().reverse().map(item => `
    <div class="reports-backup-item">
      <div class="reports-backup-copy">
        <strong>${esc(item.label)}</strong>
        <small>${new Date(item.createdAt).toLocaleString('tr-TR')}</small>
        <small>${esc(t('reports.backupStoragePath', { path: backupStoragePath() }))}</small>
        <small>${esc(t('reports.backupFileName', { name: backupFileName(item) }))}</small>
      </div>
      <div class="reports-backup-actions">
        <button class="action-btn backup-download" data-id="${esc(item.id)}" aria-label="${esc(t('reports.backupDownload'))}">⇩</button>
        <button class="action-btn backup-restore" data-id="${esc(item.id)}" aria-label="${esc(t('reports.backupRestore'))}">↩</button>
        <button class="action-btn action-btn-danger backup-delete" data-id="${esc(item.id)}" aria-label="${esc(t('reports.backupDelete'))}">×</button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.backup-download').forEach(btn => {
    btn.addEventListener('click', () => downloadBackup(list.find(item => item.id === btn.dataset.id)));
  });
  container.querySelectorAll('.backup-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm(t('reports.backupDeleteConfirm'))) return;
      if (!await deleteBackup(btn.dataset.id)) return showToast(t('reports.backupDeleteFailed'), 'error');
      await renderBackups(container);
      showToast(t('reports.backupDeleted'), 'success');
    });
  });
  container.querySelectorAll('.backup-restore').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (isPeriodLocked()) return showToast(t('periodLock.lockedMessage'), 'error');
      if (!confirm(t('reports.restoreConfirm'))) return;
      const item = list.find(entry => entry.id === btn.dataset.id);
      const snapshot = sanitizeSnapshot(item?.snapshot);
      if (!snapshot || !importStateSnapshot(snapshot)) return showToast(t('reports.restoreFailed'), 'error');
      importAvailabilitySnapshot(snapshot.availability || {});
      if (Array.isArray(snapshot.leaveRequests) && !(await importLeaveSnapshot(snapshot.leaveRequests))) return showToast(t('reports.restoreFailed'), 'error');
      importDutyTemplatesSnapshot(snapshot.dutyTemplates || []);
      if (!(await importPeriodLockSnapshot(snapshot.periodLock || {})) || !(await importPeriodApprovalSnapshot(snapshot.periodApproval || {}))) return showToast(t('reports.restoreFailed'), 'error');
      await importAuditSnapshot(snapshot.auditLog || []);
      showToast(t('reports.backupRestored'), 'success');
      setTimeout(() => window.location.reload(), 250);
    });
  });
}

export async function initReportsPanel(panel) {
  if (!panel) return;

  panel.innerHTML = `
    <div class="reports-shell">
      <section class="reports-hero">
        <div><span class="reports-eyebrow">${t('reports.fairnessEyebrow')}</span><h2>${t('reports.fairnessTitle')}</h2><p>${t('reports.fairnessDescription')}</p></div>
        <span class="reports-period">${esc(getUnitName())} · ${esc(getMonthLabel(getYear(), getMonth()))}</span>
      </section>
    </div>
    <div class="reports-shell">
      <section class="reports-section">
        <div class="reports-section-heading"><div><span class="reports-eyebrow">${t('reports.fairnessEyebrow')}</span><h3>${t('reports.fairnessTitle')}</h3></div><span class="reports-section-mark">≈</span></div>
        <div id="fairnessList"></div>
      </section>
    </div>
    <div class="reports-shell">
      <section class="reports-section">
        <div class="reports-section-heading"><div><span class="reports-eyebrow">${t('reports.comparisonEyebrow')}</span><h3>${t('reports.comparisonTitle')}</h3></div><span class="reports-section-mark">▥</span></div>
      <div id="reportsChart"></div>
      </section>
      <section class="reports-section">
        <div class="reports-section-heading"><div><span class="reports-eyebrow">${t('reports.archiveEyebrow')}</span><h3>${t('reports.archiveTitle')}</h3></div><button class="btn btn-primary" id="archiveCurrentBtn" style="padding:6px 12px;font-size:12px">${t('reports.archiveCurrent')}</button></div>
        <div id="archiveList"></div>
      </section>
      <section class="reports-section">
        <div class="reports-section-heading"><div><span class="reports-eyebrow">${t('reports.backupEyebrow')}</span><h3>${t('reports.backupTitle')}</h3></div><div class="reports-backup-heading-actions"><button class="btn" id="backupDeleteAllBtn" style="padding:6px 12px;font-size:12px">${t('reports.backupDeleteAll')}</button><button class="btn btn-primary" id="backupCurrentBtn" style="padding:6px 12px;font-size:12px">${t('reports.backupCurrent')}</button></div></div>
        <div id="backupList"></div>
      </section>
      <section class="reports-section">
        <div class="reports-section-heading"><div><span class="reports-eyebrow">${t('reports.summaryEyebrow')}</span><h3>${t('reports.summaryTitle')}</h3></div><span class="reports-section-mark">▤</span></div>
        <div id="reportsSummary"></div>
      </section>
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
    if (await createBackup()) await renderBackups(panel.querySelector('#backupList'));
  });

  panel.querySelector('#backupDeleteAllBtn').addEventListener('click', async () => {
    const list = await loadBackups();
    if (!list.length) return showToast(t('reports.noBackups'), 'info');
    if (!confirm(t('reports.backupDeleteAllConfirm'))) return;
    if (!await deleteAllBackups()) return showToast(t('reports.backupDeleteFailed'), 'error');
    await renderBackups(panel.querySelector('#backupList'));
    showToast(t('reports.backupsDeleted'), 'success');
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
            <td style="text-align:left">${esc(name)}</td>
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
