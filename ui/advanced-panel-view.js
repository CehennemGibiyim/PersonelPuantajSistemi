import {
  getPersonnelList, getPersonnelType, getScheduleData, updateShift,
  getCertificates, addCertificate, deleteCertificate,
  getPerformanceNote, setPerformanceNote, getShiftTemplates, addShiftTemplate,
  deleteShiftTemplate, getStateSnapshot, importStateSnapshot, getUnits,
  getCurrentUnitId, getUnitName
} from '../state.js';
import { getYear, getMonth, getDaysInMonth, MONTHS_TR, t, uid } from '../utils.js';
import { loadState } from '../storage.js';
import { exportPayroll } from '../export.js';
// Keep the print module URL identical to main.js so both entry points share its initialized container.
import { showPrintOptions } from './print-view.js?v=27';
import { showToast } from './toast-view.js';
import { showWarningsPanel } from './warnings-panel-view.js';
import { renderDutySection, bindDutySection } from './duty-panel-view.js';
import { getAvailabilitySnapshot, importAvailabilitySnapshot } from '../availability-state.js';
import { getDutyTemplatesSnapshot, importDutyTemplatesSnapshot } from '../duty-template-state.js';
import { isPeriodLocked, getPeriodLockState, importPeriodLockSnapshot } from '../period-lock-state.js';
import { getPeriodApprovalState, importPeriodApprovalSnapshot } from '../period-approval-state.js';
import { renderPeriodLockSection, bindPeriodLockPanel } from './period-lock-panel-view.js';
import { renderPeriodApprovalSection, bindPeriodApprovalPanel } from './period-approval-panel-view.js';
import { getAuditSnapshot, importAuditSnapshot, recordAudit } from '../audit-state.js';
import { renderAuditSection, bindAuditPanel } from './audit-panel-view.js';
import { sanitizeSnapshot } from '../data-guard.js';
import { getUnitAdminSnapshot, importUnitAdminSnapshot } from '../admin-state.js';
import { loadMonthlyNote, setMonthlyNote } from '../period-note-state.js';
import {
  getLeaveRequests, getLeaveRequest, getLeaveSnapshot, importLeaveSnapshot,
  addLeaveRequest, updateLeaveRequestStatus, editLeaveRequest, deleteLeaveRequest,
  validateLeaveRequest, isCurrentMonthRequest
} from '../leave-state.js';

let overlay = null;
let editingLeaveId = '';
let onUpdate = () => {};

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
const storage = () => window.miniappsAI?.storage;

function createOverlay() {
  if (overlay) return;
  overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  document.body.appendChild(overlay);
  overlay.addEventListener('click', event => { if (event.target === overlay) hide(); });
}
function hide() { overlay?.classList.remove('active'); }
function lockGuard() { if (!isPeriodLocked()) return false; showToast(t('periodLock.lockedMessage'), 'error'); return true; }
function personOptions() { return getPersonnelList().map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join(''); }
function statusLabel(status) { return status === 'approved' ? t('advanced.approved') : status === 'rejected' ? t('advanced.rejected') : t('advanced.pending'); }
function leaveTypeLabel(type) { return t(`advanced.${type}`); }
function leaveValidationMessage(code) {
  return code === 'person' ? t('advanced.leavePersonRequired')
    : code === 'type' ? t('advanced.leaveTypeRequired')
      : code === 'range' ? t('advanced.leaveRangeInvalid')
        : t('advanced.leaveDateInvalid');
}

function renderRequests() {
  const requests = getLeaveRequests();
  if (!requests.length) return `<p class="advanced-muted">${t('advanced.noRequests')}</p>`;
  return requests.slice().reverse().map(item => `<div class="advanced-row"><span><strong>${esc(item.person)}</strong><small>${esc(item.start)} – ${esc(item.end)} · ${esc(leaveTypeLabel(item.type))}${item.note ? ` · ${esc(item.note)}` : ''}${isCurrentMonthRequest(item) ? '' : ` · ${esc(t('advanced.otherMonth'))}`}</small></span><span class="status-pill status-${item.status}">${statusLabel(item.status)}</span><span class="advanced-actions"><button class="action-btn" data-leave-edit="${esc(item.id)}" aria-label="${t('advanced.editRequest')}">✎</button><button class="action-btn action-btn-danger" data-leave-delete="${esc(item.id)}" aria-label="${t('advanced.deleteRequest')}">×</button><button class="action-btn" data-leave-status="${item.status === 'approved' ? 'pending' : 'approved'}" data-id="${esc(item.id)}" aria-label="${item.status === 'approved' ? t('advanced.withdrawApproval') : t('advanced.approveRequest')}">${item.status === 'approved' ? '↶' : '✓'}</button>${item.status === 'pending' ? `<button class="action-btn action-btn-danger" data-leave-status="rejected" data-id="${esc(item.id)}" aria-label="${t('advanced.rejectRequest')}">×</button>` : ''}</span></div>`).join('');
}

function renderCertificates(name) {
  if (!name) return `<p class="advanced-muted">${t('advanced.selectPerson')}</p>`;
  const list = getCertificates(name);
  return `<div class="advanced-list">${list.length ? list.map(item => `<div class="advanced-row"><span><strong>${esc(item.title)}</strong><small>${item.expiry ? esc(item.expiry) : t('advanced.noExpiry')}</small></span><button class="action-btn action-btn-danger" data-cert-delete="${item.id}" data-person="${esc(name)}">×</button></div>`).join('') : `<p class="advanced-muted">${t('advanced.noCertificates')}</p>`}</div>`;
}

function renderTemplates() {
  const list = getShiftTemplates();
  return list.length ? list.map(item => `<div class="advanced-row"><span><strong>${esc(item.name)}</strong><small>${esc(item.pattern)}</small></span><span class="advanced-actions"><button class="action-btn" data-template-apply="${item.id}" aria-label="${t('advanced.applyTemplate')}">↗</button><button class="action-btn action-btn-danger" data-template-delete="${item.id}">×</button></span></div>`).join('') : `<p class="advanced-muted">${t('advanced.noTemplates')}</p>`;
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  if (storage()) storage().setItem('themePreference', theme).catch(() => {});
  overlay?.querySelectorAll('[data-theme-choice]').forEach(button => {
    button.classList.toggle('is-selected', button.dataset.themeChoice === theme);
  });
}

function showSearch(value) {
  const query = String(value || '').trim().toLocaleLowerCase('tr-TR');
  document.querySelectorAll('#tableContainer [data-name], #monthlyContainer tr[data-name]').forEach(row => {
    row.style.display = !query || String(row.dataset.name || '').toLocaleLowerCase('tr-TR').includes(query) ? '' : 'none';
  });
}

export async function exportJson() {
  let monthlyNote = '';
  try { monthlyNote = await loadMonthlyNote(); } catch { monthlyNote = ''; }
  const snapshot = { schemaVersion: 4, exportedAt: new Date().toISOString(), ...getStateSnapshot(), leaveRequests: getLeaveSnapshot(), unitAdmins: getUnitAdminSnapshot(), availability: getAvailabilitySnapshot(), dutyTemplates: getDutyTemplatesSnapshot(), periodLock: getPeriodLockState(), periodApproval: getPeriodApprovalState(), auditLog: getAuditSnapshot(), monthlyNote };
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `puantaj-${getUnitName()}-${getYear()}-${getMonth() + 1}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast(t('advanced.exported'), 'success');
}

function importJson(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const snapshot = sanitizeSnapshot(JSON.parse(reader.result));
      if (!snapshot || !importStateSnapshot(snapshot)) throw new Error('invalid');
      if (snapshot.unitAdmins && !(await importUnitAdminSnapshot(snapshot.unitAdmins))) throw new Error('save-failed');
      importAvailabilitySnapshot(snapshot.availability || {});
      if (Array.isArray(snapshot.leaveRequests) && !(await importLeaveSnapshot(snapshot.leaveRequests))) throw new Error('save-failed');
      if (typeof snapshot.monthlyNote === 'string') await setMonthlyNote(snapshot.monthlyNote);
      importDutyTemplatesSnapshot(snapshot.dutyTemplates || []);
      if (!(await importPeriodLockSnapshot(snapshot.periodLock || {}))) throw new Error('save-failed');
      if (!(await importPeriodApprovalSnapshot(snapshot.periodApproval || {}))) throw new Error('save-failed');
      await importAuditSnapshot(snapshot.auditLog || []);
      hide(); onUpdate(); showToast(t('advanced.imported'), 'success');
    } catch { showToast(t('advanced.importFailed'), 'error'); }
  };
  reader.readAsText(file);
}

function applyTemplate(id, person, startDay) {
  if (lockGuard()) return false;
  const template = getShiftTemplates().find(item => item.id === id);
  if (!template || !person) return false;
  template.pattern.split(',').map(value => value.trim()).filter(Boolean).forEach((code, index) => {
    const day = Number(startDay) + index;
    if (day <= getDaysInMonth()) updateShift(person, day, code);
  });
  return true;
}

function buildSuggestion() {
  const data = getScheduleData();
  const day = Array.from({ length: getDaysInMonth() }, (_, i) => i + 1).find(d => getPersonnelList().some(name => !String(data[name]?.[d] || '').trim()));
  if (!day) return t('advanced.noSuggestion');
  const empty = getPersonnelList().filter(name => !String(data[name]?.[day] || '').trim());
  return t('advanced.suggestion', { day, people: empty.slice(0, 3).join(', ') });
}

async function runAiSuggestion() {
  if (!window.miniappsAI?.callModel) throw new Error('ai-unavailable');
  const prompt = `${getUnitName()} biriminde ${MONTHS_TR[getMonth()]} ${getYear()} için vardiya planı öner. Personel: ${getPersonnelList().join(', ')}. Çizelge: ${JSON.stringify(getScheduleData()).slice(0, 5000)}. Mesai limitlerini ve en az bir günlük dinlenmeyi gözet. Kısa Türkçe öneriler yaz; vardiyaları otomatik kaydetme.`;
  const result = await window.miniappsAI.callModel({
    modelId: 'dc2db118-7888-466a-a8d1-bf9d96bab4b6',
    messages: [
      { role: 'system', content: 'Sen hastane puantaj planlama yardımcısısın. Tıbbi karar verme; yalnızca vardiya planlama önerisi üret.' },
      { role: 'user', content: prompt }
    ],
    timeoutMs: 30000
  });
  return window.miniappsAI.extractText(result) || t('advanced.noSuggestion');
}

export function showAdvancedPanel() {
  createOverlay();
  const firstPerson = getPersonnelList()[0] || '';
  const theme = document.documentElement.dataset.theme || 'dark';
  overlay.innerHTML = `<div class="modal glass advanced-modal">
    <div class="advanced-heading"><h2 class="modal-title">${t('advanced.title')}</h2><button class="action-btn" id="advancedClose" aria-label="${t('modal.cancel')}">×</button></div>
    <div class="advanced-scroll">
      <section class="advanced-section"><h3>${t('advanced.quickTitle')}</h3><div class="theme-choices" aria-label="${t('advanced.themeChoices')}"><button class="theme-choice theme-choice-light${theme === 'light' ? ' is-selected' : ''}" type="button" data-theme-choice="light">${t('advanced.lightTheme')}</button><button class="theme-choice theme-choice-sage${theme === 'sage' ? ' is-selected' : ''}" type="button" data-theme-choice="sage">${t('advanced.sageTheme')}</button><button class="theme-choice theme-choice-sand${theme === 'sand' ? ' is-selected' : ''}" type="button" data-theme-choice="sand">${t('advanced.sandTheme')}</button><button class="theme-choice theme-choice-dark${theme === 'dark' ? ' is-selected' : ''}" type="button" data-theme-choice="dark">${t('advanced.darkTheme')}</button></div><div class="advanced-grid"><button class="btn" id="payrollBtn">${t('advanced.payroll')}</button><button class="btn" id="weeklyPdfBtn">${t('advanced.weeklyPdf')}</button><button class="btn" id="jsonExportBtn">${t('advanced.exportJson')}</button><button class="btn" id="jsonImportBtn">${t('advanced.importJson')}</button><input type="file" id="jsonFile" accept="application/json" hidden></div><label class="modal-label" for="personSearch">${t('advanced.search')}</label><input class="modal-input" id="personSearch" placeholder="${t('advanced.searchPlaceholder')}"></section>
      ${renderPeriodLockSection()}
      ${renderPeriodApprovalSection()}
      ${renderAuditSection()}
      <section class="advanced-section"><h3>${t('advanced.leaveRequestTitle')}</h3><div class="advanced-form-grid"><select class="modal-input" id="leavePerson">${personOptions()}</select><select class="modal-input" id="leaveType"><option value="annual">${t('advanced.annual')}</option><option value="sick">${t('advanced.sick')}</option><option value="unpaid">${t('advanced.unpaid')}</option></select><input class="modal-input" id="leaveStart" type="date"><input class="modal-input" id="leaveEnd" type="date"></div><input class="modal-input" id="leaveNote" placeholder="${t('advanced.notePlaceholder')}"><div class="advanced-actions"><button class="btn btn-primary" id="leaveAddBtn">${t('advanced.sendRequest')}</button><button class="btn" id="leaveCancelEditBtn" type="button" style="display:none">${t('advanced.cancelEdit')}</button></div><div id="leaveRequestList">${renderRequests()}</div></section>
      <section class="advanced-section"><h3>${t('advanced.certTitle')}</h3><select class="modal-input" id="certPerson">${personOptions()}</select><div class="advanced-form-grid"><input class="modal-input" id="certTitle" placeholder="${t('advanced.certName')}"><input class="modal-input" id="certExpiry" type="date"></div><button class="btn btn-primary" id="certAddBtn">${t('advanced.addCert')}</button><div id="certList">${renderCertificates(firstPerson)}</div></section>
      <section class="advanced-section"><h3>${t('advanced.performanceTitle')}</h3><select class="modal-input" id="notePerson">${personOptions()}</select><textarea class="modal-input" id="performanceNote" rows="3" placeholder="${t('advanced.notePlaceholder')}"></textarea><button class="btn btn-primary" id="noteSaveBtn">${t('modal.save')}</button></section>
      <section class="advanced-section"><h3>${t('advanced.bulkTitle')}</h3><div class="advanced-form-grid"><select class="modal-input" id="bulkPerson"><option value="*">${t('advanced.allPersonnel')}</option>${personOptions()}</select><input class="modal-input" id="bulkDay" type="number" min="1" max="31" placeholder="${t('advanced.day')}"><input class="modal-input" id="bulkCode" maxlength="3" placeholder="G / N / İ"></div><button class="btn btn-primary" id="bulkApplyBtn">${t('advanced.applyBulk')}</button></section>
      ${renderDutySection()}
      <section class="advanced-section"><h3>${t('advanced.templateTitle')}</h3><div class="advanced-form-grid"><input class="modal-input" id="templateName" placeholder="${t('advanced.templateName')}"><input class="modal-input" id="templatePattern" placeholder="G, G, N, İ..."></div><button class="btn btn-primary" id="templateAddBtn">${t('advanced.addTemplate')}</button><div class="advanced-form-grid" style="margin-top:8px"><select class="modal-input" id="templatePerson">${personOptions()}</select><input class="modal-input" id="templateStart" type="number" min="1" max="31" value="1" placeholder="${t('advanced.day')}"></div><div id="templateList">${renderTemplates()}</div></section>
      <section class="advanced-section"><h3>${t('advanced.integrationTitle')}</h3><div class="advanced-grid"><button class="btn" id="compareBtn">${t('advanced.compareUnits')}</button><button class="btn" id="noticeBtn">${t('advanced.showNotice')}</button><button class="btn" id="mailBtn">${t('advanced.emailReport')}</button><button class="btn" id="apiBtn">${t('advanced.copyApi')}</button><button class="btn" id="suggestBtn">${t('advanced.suggestionBtn')}</button><button class="btn btn-primary" id="aiBtn">${t('advanced.aiSuggestion')}</button></div><p id="advancedResult" class="advanced-result"></p></section>
    </div><div class="modal-actions"><button class="btn" id="advancedDone">${t('modal.cancel')}</button></div>
  </div>`;

  const q = selector => overlay.querySelector(selector);
  q('#advancedClose').onclick = hide; q('#advancedDone').onclick = hide;
  overlay.querySelectorAll('[data-theme-choice]').forEach(button => button.onclick = () => setTheme(button.dataset.themeChoice));
  bindPeriodLockPanel(overlay, onUpdate);
  bindPeriodApprovalPanel(overlay, onUpdate);
  bindAuditPanel(overlay);
  q('#payrollBtn').onclick = exportPayroll; q('#weeklyPdfBtn').onclick = showPrintOptions;
  q('#jsonExportBtn').onclick = exportJson; q('#jsonImportBtn').onclick = () => { if (!lockGuard()) q('#jsonFile').click(); }; q('#jsonFile').onchange = e => { if (!lockGuard()) importJson(e.target.files[0]); };
  q('#personSearch').oninput = e => showSearch(e.target.value);
  bindDutySection(overlay, onUpdate);
  const leaveFields = () => ({ person: q('#leavePerson').value, type: q('#leaveType').value, start: q('#leaveStart').value, end: q('#leaveEnd').value, note: q('#leaveNote').value });
  const resetLeaveForm = () => {
    editingLeaveId = '';
    q('#leaveAddBtn').textContent = t('advanced.sendRequest');
    q('#leaveCancelEditBtn').style.display = 'none';
    q('#leaveStart').value = '';
    q('#leaveEnd').value = '';
    q('#leaveNote').value = '';
  };
  const beginLeaveEdit = id => {
    const item = getLeaveRequest(id);
    if (!item) return;
    editingLeaveId = id;
    q('#leavePerson').value = item.person;
    q('#leaveType').value = item.type;
    q('#leaveStart').value = item.start;
    q('#leaveEnd').value = item.end;
    q('#leaveNote').value = item.note || '';
    q('#leaveAddBtn').textContent = t('advanced.saveRequest');
    q('#leaveCancelEditBtn').style.display = '';
    q('#leaveStart').focus();
  };
  q('#leaveAddBtn').onclick = () => {
    if (lockGuard()) return;
    const fields = leaveFields();
    const validation = validateLeaveRequest(fields);
    if (validation) return showToast(leaveValidationMessage(validation), 'error');
    if (editingLeaveId) {
      if (!editLeaveRequest(editingLeaveId, fields)) return showToast(t('advanced.requestUpdateFailed'), 'error');
      showToast(t('advanced.requestUpdated'), 'success');
    } else {
      const item = addLeaveRequest(fields);
      if (!item) return showToast(t('advanced.requestUpdateFailed'), 'error');
      recordAudit('leave_requested', fields.person);
      showToast(t('advanced.requestSent'), 'success');
    }
    resetLeaveForm();
    q('#leaveRequestList').innerHTML = renderRequests();
    onUpdate();
  };
  q('#leaveCancelEditBtn').onclick = resetLeaveForm;
  q('#leaveRequestList').onclick = e => {
    const editButton = e.target.closest('[data-leave-edit]');
    const deleteButton = e.target.closest('[data-leave-delete]');
    const statusButton = e.target.closest('[data-leave-status]');
    if (editButton && !lockGuard()) return beginLeaveEdit(editButton.dataset.leaveEdit);
    if (deleteButton && !lockGuard()) {
      if (!confirm(t('advanced.deleteRequestConfirm'))) return;
      if (deleteLeaveRequest(deleteButton.dataset.leaveDelete)) {
        if (editingLeaveId === deleteButton.dataset.leaveDelete) resetLeaveForm();
        q('#leaveRequestList').innerHTML = renderRequests();
        onUpdate();
        showToast(t('advanced.requestDeleted'), 'success');
      }
      return;
    }
    if (statusButton && !lockGuard()) {
      if (updateLeaveRequestStatus(statusButton.dataset.id, statusButton.dataset.leaveStatus)) {
        q('#leaveRequestList').innerHTML = renderRequests();
        onUpdate();
        showToast(statusButton.dataset.leaveStatus === 'approved' ? t('advanced.requestApproved') : statusButton.dataset.leaveStatus === 'pending' ? t('advanced.approvalWithdrawn') : t('advanced.requestRejected'), 'success');
      }
    }
  };
  q('#certPerson').onchange = e => { q('#certList').innerHTML = renderCertificates(e.target.value); q('#performanceNote').value = getPerformanceNote(e.target.value); };
  q('#certAddBtn').onclick = () => { if (lockGuard()) return; if (addCertificate(q('#certPerson').value, { title:q('#certTitle').value, expiry:q('#certExpiry').value })) { q('#certList').innerHTML = renderCertificates(q('#certPerson').value); q('#certTitle').value = ''; q('#certExpiry').value = ''; showToast(t('advanced.saved'), 'success'); } };
  q('#certList').onclick = e => { const id = e.target.dataset.certDelete; if (id && !lockGuard()) { deleteCertificate(e.target.dataset.person, id); q('#certList').innerHTML = renderCertificates(q('#certPerson').value); } };
  q('#notePerson').onchange = e => { q('#performanceNote').value = getPerformanceNote(e.target.value); }; q('#performanceNote').value = getPerformanceNote(firstPerson); q('#noteSaveBtn').onclick = () => { if (lockGuard()) return; setPerformanceNote(q('#notePerson').value, q('#performanceNote').value); showToast(t('advanced.saved'), 'success'); };
  q('#bulkApplyBtn').onclick = () => { if (lockGuard()) return; const day = Number(q('#bulkDay').value); const people = q('#bulkPerson').value === '*' ? getPersonnelList() : [q('#bulkPerson').value]; if (!day || day > getDaysInMonth() || !q('#bulkCode').value.trim()) return showToast(t('advanced.bulkInvalid'), 'error'); people.forEach(name => updateShift(name, day, q('#bulkCode').value)); onUpdate(); showToast(t('advanced.bulkApplied'), 'success'); };
  q('#templateAddBtn').onclick = () => { if (lockGuard()) return; if (addShiftTemplate(q('#templateName').value, q('#templatePattern').value)) { q('#templateList').innerHTML = renderTemplates(); q('#templateName').value = ''; q('#templatePattern').value = ''; } };
  q('#templateList').onclick = e => { if (lockGuard()) return; const id = e.target.dataset.templateDelete; const applyId = e.target.dataset.templateApply; if (id) { deleteShiftTemplate(id); q('#templateList').innerHTML = renderTemplates(); } if (applyId) { applyTemplate(applyId, q('#templatePerson').value, q('#templateStart').value); onUpdate(); showToast(t('advanced.templateApplied'), 'success'); } };
  q('#compareBtn').onclick = async () => { const other = getUnits().find(unit => unit.id !== getCurrentUnitId()); if (!other) return q('#advancedResult').textContent = t('advanced.noOtherUnit'); const raw = await loadState(`puantaj_${other.id}_${getYear()}_${getMonth()}`); const total = raw?.weeklyTotals ? Object.values(raw.weeklyTotals).reduce((sum, weeks) => sum + Object.values(weeks).reduce((s, row) => s + (row.worked || 0), 0), 0) : 0; q('#advancedResult').textContent = t('advanced.compareResult', { unit: other.name, hours: total }); };
  q('#noticeBtn').onclick = () => { hide(); showWarningsPanel(); };
  q('#mailBtn').onclick = () => { window.location.href = `mailto:?subject=${encodeURIComponent(`${getUnitName()} ${MONTHS_TR[getMonth()]} ${getYear()}`)}&body=${encodeURIComponent(t('advanced.mailBody'))}`; };
  q('#apiBtn').onclick = async () => { try { await navigator.clipboard.writeText(JSON.stringify(getStateSnapshot())); q('#advancedResult').textContent = t('advanced.copied'); } catch { q('#advancedResult').textContent = t('advanced.copyFailed'); } };
  q('#suggestBtn').onclick = () => { q('#advancedResult').textContent = buildSuggestion(); };
  q('#aiBtn').onclick = async () => { q('#aiBtn').disabled = true; q('#advancedResult').textContent = t('advanced.aiLoading'); try { q('#advancedResult').textContent = await runAiSuggestion(); } catch { q('#advancedResult').textContent = t('advanced.aiFailed'); } finally { q('#aiBtn').disabled = false; } };
  overlay.classList.add('active'); q('#personSearch').focus();
}

export async function maybeAutoBackup() {
  if (!storage()) return;
  try {
    const key = `puantaj_auto_backup_${getCurrentUnitId()}_${getYear()}_${getMonth()}`;
    const raw = await storage().getItem(key);
    let lastTime = 0;
    try { lastTime = raw ? Date.parse(JSON.parse(raw).createdAt) || 0 : 0; } catch (e) { lastTime = 0; }
    if (!lastTime || Date.now() - lastTime > 24 * 60 * 60 * 1000) {
      await storage().setItem(key, JSON.stringify({ createdAt: new Date().toISOString(), snapshot: { ...getStateSnapshot(), leaveRequests: getLeaveSnapshot(), availability: getAvailabilitySnapshot(), dutyTemplates: getDutyTemplatesSnapshot(), periodLock: getPeriodLockState(), periodApproval: getPeriodApprovalState(), auditLog: getAuditSnapshot() } }));
    }
  } catch (e) { /* backup is best effort */ }
}

export function initAdvancedPanel(button, callback) { onUpdate = callback || (() => {}); button?.addEventListener('click', showAdvancedPanel); }
