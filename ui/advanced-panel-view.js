import {
  getPersonnelList, getPersonnelType, getScheduleData, updateShift,
  getApprovalState, setApprovalStep, getLeaveRequests, addLeaveRequest,
  updateLeaveRequest, getCertificates, addCertificate, deleteCertificate,
  getPerformanceNote, setPerformanceNote, getShiftTemplates, addShiftTemplate,
  deleteShiftTemplate, getStateSnapshot, importStateSnapshot, getUnits,
  getCurrentUnitId, getUnitName
} from '../state.js';
import { getYear, getMonth, getDaysInMonth, MONTHS_TR, t, uid } from '../utils.js';
import { loadState } from '../storage.js';
import { exportPayroll } from '../export.js';
// Keep the print module URL identical to main.js so both entry points share its initialized container.
import { doPrint } from './print-view.js?v=11';
import { showToast } from './toast-view.js';
import { showWarningsPanel } from './warnings-panel-view.js';
import { renderDutySection, bindDutySection } from './duty-panel-view.js';

let overlay = null;
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
function personOptions() { return getPersonnelList().map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join(''); }
function statusLabel(status) { return status === 'approved' ? t('advanced.approved') : status === 'rejected' ? t('advanced.rejected') : t('advanced.pending'); }

function renderApproval() {
  const state = getApprovalState();
  const steps = [['headNurse', t('advanced.headNurse')], ['manager', t('advanced.manager')], ['chiefDoctor', t('advanced.chiefDoctor')]];
  return steps.map(([key, label]) => `<div class="advanced-row"><span>${label}</span><span class="status-pill status-${state[key]}">${statusLabel(state[key])}</span><button class="action-btn" data-approve="${key}" aria-label="${label}">✓</button></div>`).join('');
}

function renderRequests() {
  const requests = getLeaveRequests();
  if (!requests.length) return `<p class="advanced-muted">${t('advanced.noRequests')}</p>`;
  return requests.slice().reverse().map(item => `<div class="advanced-row"><span><strong>${esc(item.person)}</strong><small>${esc(item.start)} – ${esc(item.end)} · ${esc(item.type)}</small></span><span class="status-pill status-${item.status}">${statusLabel(item.status)}</span><span class="advanced-actions"><button class="action-btn" data-leave-status="approved" data-id="${item.id}">✓</button><button class="action-btn action-btn-danger" data-leave-status="rejected" data-id="${item.id}">×</button></span></div>`).join('');
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
  const button = overlay?.querySelector('#themeToggle');
  if (button) button.textContent = theme === 'light' ? t('advanced.darkTheme') : t('advanced.lightTheme');
}

function showSearch(value) {
  const query = String(value || '').trim().toLocaleLowerCase('tr-TR');
  document.querySelectorAll('#tableContainer [data-name], #monthlyContainer tr[data-name]').forEach(row => {
    row.style.display = !query || String(row.dataset.name || '').toLocaleLowerCase('tr-TR').includes(query) ? '' : 'none';
  });
}

function exportJson() {
  const blob = new Blob([JSON.stringify(getStateSnapshot(), null, 2)], { type: 'application/json' });
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
  reader.onload = () => {
    try {
      if (!importStateSnapshot(JSON.parse(reader.result))) throw new Error('invalid');
      hide(); onUpdate(); showToast(t('advanced.imported'), 'success');
    } catch { showToast(t('advanced.importFailed'), 'error'); }
  };
  reader.readAsText(file);
}

function applyTemplate(id, person, startDay) {
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
      <section class="advanced-section"><h3>${t('advanced.quickTitle')}</h3><div class="advanced-grid">
        <button class="btn" id="themeToggle">${theme === 'light' ? t('advanced.darkTheme') : t('advanced.lightTheme')}</button><button class="btn" id="payrollBtn">${t('advanced.payroll')}</button><button class="btn" id="weeklyPdfBtn">${t('advanced.weeklyPdf')}</button><button class="btn" id="jsonExportBtn">${t('advanced.exportJson')}</button><button class="btn" id="jsonImportBtn">${t('advanced.importJson')}</button><input type="file" id="jsonFile" accept="application/json" hidden>
      </div><label class="modal-label" for="personSearch">${t('advanced.search')}</label><input class="modal-input" id="personSearch" placeholder="${t('advanced.searchPlaceholder')}"></section>
      <section class="advanced-section"><h3>${t('advanced.approvalTitle')}</h3><div id="approvalList">${renderApproval()}</div></section>
      <section class="advanced-section"><h3>${t('advanced.leaveRequestTitle')}</h3><div class="advanced-form-grid"><select class="modal-input" id="leavePerson">${personOptions()}</select><select class="modal-input" id="leaveType"><option value="annual">${t('advanced.annual')}</option><option value="sick">${t('advanced.sick')}</option><option value="unpaid">${t('advanced.unpaid')}</option></select><input class="modal-input" id="leaveStart" type="date"><input class="modal-input" id="leaveEnd" type="date"></div><input class="modal-input" id="leaveNote" placeholder="${t('advanced.notePlaceholder')}"><button class="btn btn-primary" id="leaveAddBtn">${t('advanced.sendRequest')}</button><div id="leaveRequestList">${renderRequests()}</div></section>
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
  q('#themeToggle').onclick = () => setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
  q('#payrollBtn').onclick = exportPayroll; q('#weeklyPdfBtn').onclick = doPrint;
  q('#jsonExportBtn').onclick = exportJson; q('#jsonImportBtn').onclick = () => q('#jsonFile').click(); q('#jsonFile').onchange = e => importJson(e.target.files[0]);
  q('#personSearch').oninput = e => showSearch(e.target.value);
  bindDutySection(overlay, onUpdate);
  q('#approvalList').onclick = e => { const key = e.target.dataset.approve; if (key) { setApprovalStep(key, 'approved'); q('#approvalList').innerHTML = renderApproval(); } };
  q('#leaveAddBtn').onclick = () => { addLeaveRequest({ person:q('#leavePerson').value, type:q('#leaveType').value, start:q('#leaveStart').value, end:q('#leaveEnd').value, note:q('#leaveNote').value }); q('#leaveRequestList').innerHTML = renderRequests(); showToast(t('advanced.requestSent'), 'success'); };
  q('#leaveRequestList').onclick = e => { const status = e.target.dataset.leaveStatus; if (status) { updateLeaveRequest(e.target.dataset.id, status); q('#leaveRequestList').innerHTML = renderRequests(); } };
  q('#certPerson').onchange = e => { q('#certList').innerHTML = renderCertificates(e.target.value); q('#performanceNote').value = getPerformanceNote(e.target.value); };
  q('#certAddBtn').onclick = () => { if (addCertificate(q('#certPerson').value, { title:q('#certTitle').value, expiry:q('#certExpiry').value })) { q('#certList').innerHTML = renderCertificates(q('#certPerson').value); q('#certTitle').value = ''; q('#certExpiry').value = ''; showToast(t('advanced.saved'), 'success'); } };
  q('#certList').onclick = e => { const id = e.target.dataset.certDelete; if (id) { deleteCertificate(e.target.dataset.person, id); q('#certList').innerHTML = renderCertificates(q('#certPerson').value); } };
  q('#notePerson').onchange = e => { q('#performanceNote').value = getPerformanceNote(e.target.value); }; q('#performanceNote').value = getPerformanceNote(firstPerson); q('#noteSaveBtn').onclick = () => { setPerformanceNote(q('#notePerson').value, q('#performanceNote').value); showToast(t('advanced.saved'), 'success'); };
  q('#bulkApplyBtn').onclick = () => { const day = Number(q('#bulkDay').value); const people = q('#bulkPerson').value === '*' ? getPersonnelList() : [q('#bulkPerson').value]; if (!day || day > getDaysInMonth() || !q('#bulkCode').value.trim()) return showToast(t('advanced.bulkInvalid'), 'error'); people.forEach(name => updateShift(name, day, q('#bulkCode').value)); onUpdate(); showToast(t('advanced.bulkApplied'), 'success'); };
  q('#templateAddBtn').onclick = () => { if (addShiftTemplate(q('#templateName').value, q('#templatePattern').value)) { q('#templateList').innerHTML = renderTemplates(); q('#templateName').value = ''; q('#templatePattern').value = ''; } };
  q('#templateList').onclick = e => { const id = e.target.dataset.templateDelete; const applyId = e.target.dataset.templateApply; if (id) { deleteShiftTemplate(id); q('#templateList').innerHTML = renderTemplates(); } if (applyId) { applyTemplate(applyId, q('#templatePerson').value, q('#templateStart').value); onUpdate(); showToast(t('advanced.templateApplied'), 'success'); } };
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
      await storage().setItem(key, JSON.stringify({ createdAt: new Date().toISOString(), snapshot: getStateSnapshot() }));
    }
  } catch (e) { /* backup is best effort */ }
}

export function initAdvancedPanel(button, callback) { onUpdate = callback || (() => {}); button?.addEventListener('click', showAdvancedPanel); }
