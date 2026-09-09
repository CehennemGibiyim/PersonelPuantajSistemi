import { getPersonnelList } from '../state.js';
import { getAvailabilityForPerson, initAvailability, setAvailabilityStatuses } from '../availability-state.js';
import { DAYS_TR, getDaysInMonth, getDayName, getMonth, getYear, isHoliday, isWeekend, t } from '../utils.js';
import { showToast } from './toast-view.js';
import { isPeriodLocked } from '../period-lock-state.js';

let overlay = null;
let selectedPerson = '';
let selectedStatus = 'annual';
let selectedMode = 'mark';
let draftByPerson = {};
let onUpdate = () => {};

const statusKeys = ['annual', 'sick', 'unpaid', 'unavailable', 'preferred'];
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));

function statusLabel(status) { return t(`availability.status.${status}`); }

function draftFor(person) {
  if (!draftByPerson[person]) draftByPerson[person] = getAvailabilityForPerson(person);
  return draftByPerson[person];
}

function statusFor(person, day) {
  return draftFor(person)[String(day)] || 'available';
}

function createOverlay() {
  if (overlay) return;
  overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  document.body.appendChild(overlay);
  overlay.addEventListener('click', event => { if (event.target === overlay) hide(); });
}

function hide() {
  draftByPerson = {};
  overlay?.classList.remove('active');
}

function renderLegend() {
  return `<div class="availability-legend"><span class="availability-key availability-available">${t('availability.status.available')}</span>${statusKeys.map(status => `<span class="availability-key availability-${status}">${statusLabel(status)}</span>`).join('')}</div>`;
}

function renderGrid(person) {
  const firstDay = new Date(getYear(), getMonth(), 1).getDay();
  const cells = [];
  for (let i = 0; i < firstDay; i += 1) cells.push('<span class="availability-empty" aria-hidden="true"></span>');
  for (let day = 1; day <= getDaysInMonth(); day += 1) {
    const status = statusFor(person, day);
    const classes = ['availability-day', `availability-${status}`];
    const savedStatus = getAvailabilityForPerson(person)[String(day)] || 'available';
    if (status !== savedStatus) classes.push('is-pending');
    if (isWeekend(day)) classes.push('is-weekend');
    if (isHoliday(day)) classes.push('is-holiday');
    cells.push(`<button type="button" class="${classes.join(' ')}" data-availability-day="${day}" aria-pressed="${status !== 'available'}" aria-label="${esc(`${day} ${getDayName(day)} — ${statusLabel(status)}`)}"${isPeriodLocked() ? ' disabled' : ''}><strong>${day}</strong><small>${esc(getDayName(day))}</small><span>${esc(statusLabel(status))}</span></button>`);
  }
  return cells.join('');
}

function renderSummary(person) {
  const counts = { annual: 0, sick: 0, unpaid: 0, unavailable: 0, preferred: 0 };
  for (let day = 1; day <= getDaysInMonth(); day += 1) {
    const status = statusFor(person, day);
    if (counts[status] !== undefined) counts[status] += 1;
  }
  return `<div class="availability-summary">${statusKeys.map(status => `<span><strong>${counts[status]}</strong>${esc(statusLabel(status))}</span>`).join('')}</div>`;
}

function renderPanel() {
  const people = getPersonnelList();
  if (!people.length) {
    overlay.innerHTML = `<div class="modal glass availability-modal"><h2 class="modal-title">${t('availability.title')}</h2><p class="advanced-muted">${t('availability.noPersonnel')}</p><div class="modal-actions"><button class="btn" id="availabilityClose">${t('modal.cancel')}</button></div></div>`;
    overlay.querySelector('#availabilityClose').onclick = hide;
    return;
  }
  if (!people.includes(selectedPerson)) selectedPerson = people[0];
  const locked = isPeriodLocked();
  overlay.innerHTML = `<div class="modal glass availability-modal">
    <div class="advanced-heading"><div><h2 class="modal-title">${t('availability.title')}</h2><p class="availability-hint">${t('availability.hint')}</p></div><button class="action-btn" id="availabilityClose" aria-label="${t('modal.cancel')}">×</button></div>
    <div class="availability-controls"><label class="modal-label" for="availabilityPerson">${t('availability.person')}</label><select class="modal-input" id="availabilityPerson">${people.map(name => `<option value="${esc(name)}"${name === selectedPerson ? ' selected' : ''}>${esc(name)}</option>`).join('')}</select><label class="modal-label" for="availabilityStatus">${t('availability.markAs')}</label><select class="modal-input" id="availabilityStatus">${statusKeys.map(status => `<option value="${status}">${statusLabel(status)}</option>`).join('')}</select><div class="availability-mode-actions"><button class="btn availability-mode-btn${selectedMode === 'mark' ? ' is-active' : ''}" id="availabilityMarkMode" type="button"${locked ? ' disabled' : ''}>${t('availability.mark')}</button><button class="btn availability-mode-btn${selectedMode === 'clear' ? ' is-active is-clear' : ''}" id="availabilityClearMode" type="button"${locked ? ' disabled' : ''}>${t('availability.clear')}</button></div></div>
    ${renderSummary(selectedPerson)}${renderLegend()}<div class="availability-weekdays">${DAYS_TR.map(day => `<span>${esc(day)}</span>`).join('')}</div><div class="availability-grid" id="availabilityGrid">${renderGrid(selectedPerson)}</div>
    <p class="availability-footnote">${t('availability.footer')}</p><div class="modal-actions"><button class="btn" id="availabilityCloseBottom">${t('modal.cancel')}</button><button class="btn btn-primary" id="availabilitySave"${locked ? ' disabled' : ''}>${t('availability.save')}</button></div>
  </div>`;

  const close = () => hide();
  overlay.querySelector('#availabilityClose').onclick = close;
  overlay.querySelector('#availabilityCloseBottom').onclick = close;
  overlay.querySelector('#availabilityPerson').onchange = event => { selectedPerson = event.target.value; renderPanel(); };
  overlay.querySelector('#availabilityStatus').value = selectedStatus;
  overlay.querySelector('#availabilityStatus').onchange = event => { selectedStatus = event.target.value; selectedMode = 'mark'; renderPanel(); };
  overlay.querySelector('#availabilityMarkMode').onclick = () => {
    selectedMode = 'mark';
    showToast(t('availability.markReady'), 'info');
    renderPanel();
  };
  overlay.querySelector('#availabilityClearMode').onclick = () => {
    selectedMode = 'clear';
    showToast(t('availability.clearReady'), 'info');
    renderPanel();
  };
  overlay.querySelector('#availabilitySave').onclick = () => {
    if (isPeriodLocked()) return showToast(t('periodLock.lockedMessage'), 'error');
    if (!setAvailabilityStatuses(selectedPerson, draftFor(selectedPerson))) return showToast(t('availability.saveFailed'), 'error');
    delete draftByPerson[selectedPerson];
    onUpdate();
    renderPanel();
    showToast(t('availability.saved'), 'success');
  };
  overlay.querySelectorAll('[data-availability-day]').forEach(button => button.addEventListener('click', () => {
    if (isPeriodLocked()) return showToast(t('periodLock.lockedMessage'), 'error');
    const day = Number(button.dataset.availabilityDay);
    const draft = draftFor(selectedPerson);
    if (selectedMode === 'clear') delete draft[String(day)];
    else draft[String(day)] = selectedStatus;
    renderPanel();
  }));
}

export async function showAvailabilityCalendar(updateCallback = () => {}) {
  onUpdate = updateCallback;
  createOverlay();
  draftByPerson = {};
  try {
    await initAvailability();
    selectedPerson = getPersonnelList()[0] || selectedPerson;
    selectedMode = 'mark';
    renderPanel();
    overlay.classList.add('active');
    overlay.querySelector('#availabilityPerson')?.focus();
  } catch {
    showToast(t('availability.loadFailed'), 'error');
  }
}
