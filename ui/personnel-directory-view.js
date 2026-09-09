import { getPersonnelList, getPersonnelType, getContactInfo, getUnitName, canEdit } from '../state.js';
import { t } from '../utils.js';
import { showPersonnelDetail } from './personnel-detail-modal-view.js';
import { showAdd } from './modal-view.js';
import { showPersonnelImport } from './personnel-import-view.js';
import { printPersonnelDirectory } from './directory-print-view.js';
import { isPeriodLocked } from '../period-lock-state.js';

let overlay = null;
let people = [];
let directoryUpdate = () => {};
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));

function hide() { overlay?.classList.remove('active'); }
function contactValue(value) { return value ? esc(value) : `<span class="directory-empty">${esc(t('directory.empty'))}</span>`; }
function refreshDirectory() {
  people = getPersonnelList();
  const search = overlay?.querySelector('#directorySearch')?.value || '';
  renderRows(search);
  directoryUpdate();
}
function renderRows(filter = '') {
  const body = overlay?.querySelector('#directoryRows');
  const count = overlay?.querySelector('#directoryCount');
  if (!body) return;
  const query = String(filter || '').trim().toLocaleLowerCase('tr-TR');
  const filtered = people.filter(name => {
    const info = getContactInfo(name) || {};
    return !query || [name, info.phone, info.email, info.emergency, info.address].some(value => String(value || '').toLocaleLowerCase('tr-TR').includes(query));
  });
  if (count) count.textContent = t('directory.count', { count: filtered.length });
  if (!filtered.length) {
    body.innerHTML = `<tr><td colspan="6" class="directory-no-results">${esc(t('directory.noResults'))}</td></tr>`;
    return filtered;
  }
  body.innerHTML = filtered.map(name => {
    const info = getContactInfo(name) || {};
    const type = getPersonnelType(name) === 'civil' ? t('modal.typeCivil') : t('modal.typeWorker');
    return `<tr><td class="directory-name">${esc(name)}<small>${esc(type)}</small></td><td>${contactValue(info.phone)}</td><td>${contactValue(info.email)}</td><td>${contactValue(info.emergency)}</td><td>${contactValue(info.address)}</td><td><button class="btn directory-edit" data-person="${esc(name)}" type="button">${esc(t('directory.edit'))}</button></td></tr>`;
  }).join('');
  body.querySelectorAll('.directory-edit').forEach(button => button.addEventListener('click', () => {
    const search = overlay.querySelector('#directorySearch')?.value || '';
    showPersonnelDetail(button.dataset.person, () => { renderRows(search); directoryUpdate(); });
  }));
  return filtered;
}

export function showPersonnelDirectory(onUpdate = () => {}) {
  directoryUpdate = onUpdate;
  people = getPersonnelList();
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'modal-overlay directory-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    document.body.appendChild(overlay);
    overlay.addEventListener('click', event => { if (event.target === overlay) hide(); });
  }
  const editable = canEdit() && !isPeriodLocked();
  overlay.innerHTML = `<div class="modal glass directory-modal"><div class="directory-heading"><div><h2 class="modal-title">${esc(t('directory.title'))}</h2><p class="directory-unit">${esc(getUnitName())}</p></div><button class="action-btn" id="directoryClose" type="button" aria-label="${esc(t('directory.close'))}">×</button></div><div class="directory-tools"><label class="directory-search-label" for="directorySearch">${esc(t('directory.searchLabel'))}</label><input class="modal-input" id="directorySearch" type="search" placeholder="${esc(t('directory.searchPlaceholder'))}" autocomplete="off"><span id="directoryCount" class="directory-count"></span>${editable ? `<button class="btn" id="directoryAdd" type="button">${esc(t('directory.add'))}</button><button class="btn btn-primary" id="directoryImport" type="button">${esc(t('directory.import'))}</button>` : ''}<button class="btn directory-print" id="directoryPrint" type="button">${esc(t('directory.print'))}</button></div><div class="directory-table-wrap"><table class="directory-table"><thead><tr><th>${esc(t('directory.name'))}</th><th>${esc(t('detail.phone'))}</th><th>${esc(t('detail.email'))}</th><th>${esc(t('detail.emergency'))}</th><th>${esc(t('detail.address'))}</th><th>${esc(t('directory.action'))}</th></tr></thead><tbody id="directoryRows"></tbody></table></div><p class="directory-hint">${esc(t('directory.hint'))}</p></div>`;
  overlay.querySelector('#directoryClose').addEventListener('click', hide);
  overlay.querySelector('#directorySearch').addEventListener('input', event => renderRows(event.target.value));
  overlay.querySelector('#directoryAdd')?.addEventListener('click', () => showAdd(refreshDirectory));
  overlay.querySelector('#directoryImport')?.addEventListener('click', () => showPersonnelImport(refreshDirectory));
  overlay.querySelector('#directoryPrint').addEventListener('click', () => printPersonnelDirectory(getFilteredPeople(overlay.querySelector('#directorySearch')?.value || '')));
  renderRows();
  overlay.classList.add('active');
  setTimeout(() => overlay.querySelector('#directorySearch')?.focus(), 80);
}

function getFilteredPeople(filter = '') {
  const query = String(filter || '').trim().toLocaleLowerCase('tr-TR');
  return people.filter(name => {
    const info = getContactInfo(name) || {};
    return !query || [name, info.phone, info.email, info.emergency, info.address].some(value => String(value || '').toLocaleLowerCase('tr-TR').includes(query));
  });
}
