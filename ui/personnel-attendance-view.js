import { getPersonnelList, getUnits } from '../state.js';
import { loadPersonAttendance } from '../personnel-network.js';
import { getMonth, getYear, MONTHS_TR, t } from '../utils.js';
import { getPersonnelPhoto } from '../personnel-photo-state.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
let overlay = null;
let selectedName = '';
let attendanceClose = () => {};

function close() {
  overlay?.classList.remove('active');
  attendanceClose();
}
function hours(value) { return `${Number(value || 0).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} s`; }
function photo(name) { const item = getPersonnelPhoto(name); return item?.url ? `<img class="attendance-avatar" src="${esc(item.url)}" alt="${esc(name)}">` : `<span class="attendance-avatar attendance-avatar-empty">${esc(String(name || '?').slice(0, 1))}</span>`; }

function renderResult(container, report) {
  const totals = report.total;
  const rows = report.rows.length ? report.rows.map(row => `<tr><td>${row.day}. ${esc(MONTHS_TR[getMonth()])}</td><td>${esc(row.unit)}</td><td><span class="attendance-kind ${row.kind}">${esc(row.kind === 'duty' ? t('personAttendance.duty') : t('personAttendance.shift'))}</span> ${esc(row.label)}</td><td>${hours(row.worked)}</td><td>${hours(row.night)}</td><td>${hours(row.extra)}</td></tr>`).join('') : `<tr><td colspan="6" class="attendance-empty">${esc(t('personAttendance.noEntries'))}</td></tr>`;
  container.innerHTML = `<div class="attendance-person-head">${photo(report.person)}<div><strong>${esc(report.person)}</strong><span>${esc(t('personAttendance.departmentCount', { count: report.memberships.length }))}</span></div></div><div class="attendance-summary"><div><span>${esc(t('personAttendance.worked'))}</span><strong>${hours(totals.worked)}</strong></div><div><span>${esc(t('personAttendance.night'))}</span><strong>${hours(totals.night)}</strong></div><div><span>${esc(t('personAttendance.extra'))}</span><strong>${hours(totals.extra)}</strong></div><div><span>${esc(t('personAttendance.days'))}</span><strong>${report.rows.length}</strong></div></div><div class="attendance-table-wrap"><table class="attendance-table"><thead><tr><th>${esc(t('personAttendance.day'))}</th><th>${esc(t('personAttendance.department'))}</th><th>${esc(t('personAttendance.record'))}</th><th>${esc(t('personAttendance.worked'))}</th><th>${esc(t('personAttendance.night'))}</th><th>${esc(t('personAttendance.extra'))}</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

async function loadSelected() {
  const result = overlay.querySelector('[data-attendance-result]');
  if (!selectedName || !result) return;
  result.innerHTML = `<p class="attendance-loading">${esc(t('personAttendance.loading'))}</p>`;
  try {
    renderResult(result, await loadPersonAttendance(selectedName, getUnits(), getYear(), getMonth()));
  } catch (error) {
    console.error('Person attendance load failed:', error);
    result.innerHTML = `<p class="attendance-error">${esc(t('personAttendance.failed'))}</p>`;
  }
}

export function showPersonnelAttendance(name = '', onClose = () => {}) {
  const people = getPersonnelList();
  selectedName = name || people[0] || '';
  attendanceClose = onClose;
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'modal-overlay personnel-attendance-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    document.body.appendChild(overlay);
    overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
  }
  overlay.innerHTML = `<div class="modal glass personnel-attendance-modal"><div class="directory-heading"><div><h2 class="modal-title">${esc(t('personAttendance.title'))}</h2><p class="directory-unit">${esc(t('personAttendance.period', { month: MONTHS_TR[getMonth()], year: getYear() }))}</p></div><button class="action-btn" type="button" data-attendance-close aria-label="${esc(t('modal.cancel'))}">×</button></div><div class="attendance-picker"><label for="attendancePerson">${esc(t('personAttendance.choose'))}</label><select class="modal-input" id="attendancePerson">${people.map(person => `<option value="${esc(person)}"${person === selectedName ? ' selected' : ''}>${esc(person)}</option>`).join('')}</select></div><div data-attendance-result>${selectedName ? `<p class="attendance-loading">${esc(t('personAttendance.loading'))}</p>` : `<p class="attendance-empty">${esc(t('personAttendance.noPeople'))}</p>`}</div><div class="modal-actions"><button class="btn" type="button" data-attendance-cancel>${esc(t('modal.cancel'))}</button></div></div>`;
  overlay.querySelectorAll('[data-attendance-close], [data-attendance-cancel]').forEach(button => button.addEventListener('click', close));
  overlay.querySelector('#attendancePerson')?.addEventListener('change', event => { selectedName = event.target.value; loadSelected(); });
  overlay.classList.add('active');
  if (selectedName) loadSelected();
}
