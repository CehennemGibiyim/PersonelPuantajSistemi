import { getPersonnelList, getDutyRecords, addDutyRecord, deleteDutyRecord } from '../state.js';
import { getDaysInMonth, isHoliday, MONTHS_TR, getMonth, getNetWorkedHours, t } from '../utils.js';
import { showToast } from './toast-view.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));

function personOptions() {
  return getPersonnelList().map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join('');
}

function typeLabel(type) {
  return { oncall: t('advanced.dutyOncall'), night: t('advanced.dutyNight'), holiday: t('advanced.dutyHoliday'), day: t('advanced.dutyDay') }[type] || type;
}

function renderList() {
  const records = getDutyRecords().slice().sort((a, b) => a.day - b.day || a.person.localeCompare(b.person, 'tr'));
  if (!records.length) return `<p class="advanced-muted">${t('advanced.noDuties')}</p>`;
  return records.map(item => {
    const gross = item.grossHours ?? item.hours;
    const night = item.netNightHours ?? getNetWorkedHours(item.nightHours);
    const holiday = item.netHolidayHours ?? getNetWorkedHours(item.holidayHours);
    const extra = item.extraNetHours ?? item.extraHours;
    const shownNet = item.netHours ?? getNetWorkedHours(item.hours);
    return `<div class="advanced-row"><span><strong>${esc(item.day)} ${MONTHS_TR[getMonth()]} · ${esc(item.person)}</strong><small>${esc(typeLabel(item.type))} · ${gross}${t('advanced.grossShort')} → ${shownNet}${t('advanced.workedShort')} · ${night}${t('advanced.nightShort')} · ${extra}${t('advanced.extraShort')} · ${holiday}${t('advanced.holidayShort')}${item.note ? ` · ${esc(item.note)}` : ''}</small></span><button class="action-btn action-btn-danger" data-duty-delete="${item.id}" aria-label="${t('advanced.deleteDuty')}">×</button></div>`;
  }).join('');
}

export function renderDutySection() {
  return `<section class="advanced-section"><h3>${t('advanced.dutyTitle')}</h3>
    <p class="advanced-muted">${t('advanced.dutyDescription')}</p>
    <div class="advanced-form-grid">
      <select class="modal-input" id="dutyPerson" aria-label="${t('advanced.selectPerson')}">${personOptions()}</select>
      <input class="modal-input" id="dutyDay" type="number" min="1" max="${getDaysInMonth()}" placeholder="${t('advanced.day')}" aria-label="${t('advanced.day')}">
      <select class="modal-input" id="dutyType" aria-label="${t('advanced.dutyType')}">
        <option value="oncall">${t('advanced.dutyOncall')}</option><option value="night">${t('advanced.dutyNight')}</option><option value="day">${t('advanced.dutyDay')}</option><option value="holiday">${t('advanced.dutyHoliday')}</option>
      </select>
      <input class="modal-input" id="dutyHours" type="number" min="0" max="24" value="16" placeholder="${t('advanced.grossHours')}" aria-label="${t('advanced.grossHours')}">
      <input class="modal-input" id="dutyNight" type="number" min="0" max="24" value="8" placeholder="${t('advanced.nightHours')}" aria-label="${t('advanced.nightHours')}">
      <input class="modal-input" id="dutyExtra" type="number" min="0" max="24" value="8" placeholder="${t('advanced.extraHours')}" aria-label="${t('advanced.extraHours')}">
      <input class="modal-input" id="dutyHoliday" type="number" min="0" max="24" value="0" placeholder="${t('advanced.holidayHours')}" aria-label="${t('advanced.holidayHours')}">
    </div>
    <input class="modal-input" id="dutyNote" placeholder="${t('advanced.notePlaceholder')}" aria-label="${t('advanced.notePlaceholder')}">
    <button class="btn btn-primary" id="dutyAddBtn">${t('advanced.addDuty')}</button>
    <div id="dutyList" style="margin-top:10px">${renderList()}</div>
    <p class="advanced-muted">${t('advanced.dutyCalculationHint')}</p>
  </section>`;
}

export function bindDutySection(root, onUpdate = () => {}) {
  const q = selector => root.querySelector(selector);
  const list = q('#dutyList');
  if (!list || !q('#dutyAddBtn')) return;

  const setPreset = type => {
    const presets = {
      oncall: [16, 8, 7, 0], night: [8, 8, 0, 0], day: [8, 0, 0, 0], holiday: [8, 0, 0, 8]
    };
    const values = presets[type] || presets.oncall;
    ['#dutyHours', '#dutyNight', '#dutyExtra', '#dutyHoliday'].forEach((selector, index) => { q(selector).value = values[index]; });
  };

  q('#dutyType').addEventListener('change', event => setPreset(event.target.value));
  q('#dutyAddBtn').addEventListener('click', () => {
    const day = Number(q('#dutyDay').value);
    const type = q('#dutyType').value;
    let holidayHours = Number(q('#dutyHoliday').value) || 0;
    if (isHoliday(day) && holidayHours === 0) holidayHours = Number(q('#dutyHours').value) || 0;
    const id = addDutyRecord({
      person: q('#dutyPerson').value, day, type,
      hours: q('#dutyHours').value, nightHours: q('#dutyNight').value,
      extraHours: q('#dutyExtra').value, holidayHours, note: q('#dutyNote').value
    });
    if (!id) return showToast(t('advanced.dutyInvalid'), 'error');
    list.innerHTML = renderList();
    q('#dutyDay').value = '';
    q('#dutyNote').value = '';
    onUpdate();
    showToast(t('advanced.dutyAdded'), 'success');
  });

  list.addEventListener('click', event => {
    const id = event.target.dataset.dutyDelete;
    if (!id) return;
    deleteDutyRecord(id);
    list.innerHTML = renderList();
    onUpdate();
    showToast(t('advanced.dutyDeleted'), 'success');
  });
}
