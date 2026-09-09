import { readSpreadsheetFile, normalizedHeader } from '../excel-import.js';
import { addPersonnelToUnits, editPersonnel, getUnits, getCurrentUnitId, setContactInfo, personExists } from '../state.js';
import { syncPersonnelToOtherUnits } from '../personnel-assignment.js';
import { t } from '../utils.js';
import { showToast } from './toast-view.js';

let overlay = null;
let rows = [];
let rawRows = [];
let headers = [];
let mapping = {};
let onComplete = () => {};

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
const normalizeName = value => String(value || '').replace(/\s+/g, ' ').trim().toLocaleUpperCase('tr-TR');

const fields = [
  { key: 'name', label: 'personnelImport.mapName', aliases: ['ad soyad', 'adi soyadi', 'personel adi soyadi', 'personel adı soyadı', 'ad', 'adi', 'first name', 'given name', 'full name', 'fullname', 'name'] },
  { key: 'surname', label: 'personnelImport.mapSurname', aliases: ['soyad', 'soyadı', 'soyisim', 'soyadi', 'surname', 'last name'] },
  { key: 'type', label: 'personnelImport.mapType', aliases: ['tur', 'tür', 'personel turu', 'personel türü', 'tip', 'type'] },
  { key: 'phone', label: 'personnelImport.mapPhone', aliases: ['telefon', 'telefon no', 'telefon numarasi', 'gsm', 'phone', 'mobile'] },
  { key: 'email', label: 'personnelImport.mapEmail', aliases: ['e posta', 'e-posta', 'eposta', 'email', 'mail'] },
  { key: 'emergency', label: 'personnelImport.mapEmergency', aliases: ['acil durum kisisi', 'acil kisi', 'acil kişi', 'emergency contact'] },
  { key: 'address', label: 'personnelImport.mapAddress', aliases: ['adres', 'address'] },
  { key: 'units', label: 'personnelImport.mapUnits', aliases: ['birim', 'departman', 'servis', 'departman birim', 'unit', 'department'] }
];

function createOverlay() {
  if (overlay) return;
  overlay = document.createElement('div');
  overlay.className = 'modal-overlay personnel-import-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  document.body.appendChild(overlay);
  overlay.addEventListener('click', event => { if (event.target === overlay) hide(); });
}

function hide() {
  overlay?.classList.remove('active');
  rows = [];
  rawRows = [];
  headers = [];
  mapping = {};
}

function valueFrom(row, key) {
  const source = mapping[key];
  return source ? String(row[source] ?? '').trim() : '';
}

function autoMapping(nextHeaders) {
  const normalized = nextHeaders.map(header => ({ header, key: normalizedHeader(header) }));
  const used = new Set();
  return fields.reduce((result, field) => {
    const aliases = field.aliases.map(normalizedHeader);
    const exact = normalized.find(item => aliases.includes(item.key) && !used.has(item.header));
    const match = exact || normalized.find(item => aliases.some(alias => item.key.includes(alias) || alias.includes(item.key)) && !used.has(item.header));
    result[field.key] = match?.header || '';
    if (match) used.add(match.header);
    return result;
  }, {});
}

function normalizeRow(row) {
  let name = valueFrom(row, 'name');
  const surname = valueFrom(row, 'surname');
  const normalizedName = normalizedHeader(name);
  const normalizedSurname = normalizedHeader(surname);
  if (name && surname && normalizedName !== normalizedSurname && !normalizedName.endsWith(` ${normalizedSurname}`)) name = `${name} ${surname}`;
  if (!name && surname) name = surname;
  const typeValue = normalizedHeader(valueFrom(row, 'type'));
  return {
    name: normalizeName(name),
    type: typeValue.includes('memur') || typeValue.includes('civil') ? 'civil' : 'worker',
    phone: valueFrom(row, 'phone'),
    email: valueFrom(row, 'email'),
    emergency: valueFrom(row, 'emergency'),
    address: valueFrom(row, 'address'),
    units: valueFrom(row, 'units')
  };
}

function buildRows() {
  const merged = new Map();
  rawRows.forEach(raw => {
    const row = normalizeRow(raw);
    if (!row.name) return;
    const previous = merged.get(row.name);
    if (!previous) {
      merged.set(row.name, row);
      return;
    }
    const unitValues = [previous.units, row.units].filter(Boolean).join('; ');
    Object.keys(row).forEach(key => {
      if (key === 'units') return;
      if (!previous[key] && row[key]) previous[key] = row[key];
    });
    previous.units = unitValues;
  });
  rows = [...merged.values()];
}

function renderMapping() {
  const host = overlay.querySelector('#personnelImportMapping');
  if (!host) return;
  const options = `<option value="">${esc(t('personnelImport.notMapped'))}</option>${headers.map(header => `<option value="${esc(header)}">${esc(header)}</option>`).join('')}`;
  host.innerHTML = fields.map(field => `<label class="personnel-map-field"><span>${esc(t(field.label))}</span><select class="modal-input" data-map-field="${esc(field.key)}">${options}</select></label>`).join('');
  host.querySelectorAll('[data-map-field]').forEach(select => {
    select.value = mapping[select.dataset.mapField] || '';
    select.addEventListener('change', event => {
      mapping[event.target.dataset.mapField] = event.target.value;
      buildRows();
      renderPreview();
    });
  });
}

function syncRow(index, field, value) {
  if (!rows[index]) return;
  rows[index][field] = field === 'name' ? normalizeName(value) : String(value || '').trim();
  renderPreview();
}

function renderPreview() {
  const body = overlay.querySelector('#personnelImportRows');
  const summary = overlay.querySelector('#personnelImportSummary');
  const valid = rows.filter(row => row.name).length;
  summary.textContent = t('personnelImport.summary', { total: rows.length, valid });
  body.innerHTML = rows.map((row, index) => `<tr data-import-row="${index}">
    <td><input class="modal-input import-cell" data-field="name" value="${esc(row.name)}" placeholder="${esc(t('personnelImport.namePlaceholder'))}" aria-label="${esc(t('personnelImport.nameLabel'))}"></td>
    <td><select class="modal-input import-cell" data-field="type" aria-label="${esc(t('modal.personnelType'))}"><option value="worker"${row.type === 'worker' ? ' selected' : ''}>${esc(t('modal.typeWorker'))}</option><option value="civil"${row.type === 'civil' ? ' selected' : ''}>${esc(t('modal.typeCivil'))}</option></select></td>
    <td><input class="modal-input import-cell" data-field="phone" value="${esc(row.phone)}" placeholder="—" aria-label="${esc(t('detail.phone'))}"></td>
    <td><input class="modal-input import-cell" data-field="email" value="${esc(row.email)}" placeholder="—" aria-label="${esc(t('detail.email'))}"></td>
    <td><input class="modal-input import-cell" data-field="units" value="${esc(row.units)}" placeholder="${esc(t('personnelImport.currentUnit'))}" aria-label="${esc(t('personnelImport.department'))}"></td>
    <td><button class="action-btn action-btn-danger" type="button" data-import-remove="${index}" aria-label="${esc(t('personnelImport.removeRow'))}">×</button></td>
  </tr>`).join('') || `<tr><td colspan="6" class="directory-no-results">${esc(t('personnelImport.noRows'))}</td></tr>`;
  overlay.querySelector('#personnelImportSave').disabled = !valid;
  body.querySelectorAll('[data-field]').forEach(input => input.addEventListener('change', event => syncRow(Number(event.target.closest('[data-import-row]').dataset.importRow), event.target.dataset.field, event.target.value)));
  body.querySelectorAll('[data-field="name"], [data-field="phone"], [data-field="email"], [data-field="units"]').forEach(input => input.addEventListener('blur', event => syncRow(Number(event.target.closest('[data-import-row]').dataset.importRow), event.target.dataset.field, event.target.value)));
  body.querySelectorAll('[data-import-remove]').forEach(button => button.addEventListener('click', () => { rows.splice(Number(button.dataset.importRemove), 1); renderPreview(); }));
}

function unitIdsFor(value) {
  const units = getUnits();
  const tokens = String(value || '').split(/[;,/|]+/).map(item => normalizedHeader(item)).filter(Boolean);
  const matched = units.filter(unit => tokens.some(token => token === normalizedHeader(unit.name) || token.includes(normalizedHeader(unit.name)) || normalizedHeader(unit.name).includes(token))).map(unit => unit.id);
  return matched.length ? matched : [getCurrentUnitId()];
}

function readEditedRows() {
  overlay.querySelectorAll('[data-import-row]').forEach(rowElement => {
    const index = Number(rowElement.dataset.importRow);
    const next = {};
    rowElement.querySelectorAll('[data-field]').forEach(field => { next[field.dataset.field] = field.value; });
    if (rows[index]) Object.assign(rows[index], next);
  });
}

async function importRows() {
  readEditedRows();
  const unique = new Map();
  rows.forEach(row => {
    row.name = normalizeName(row.name);
    if (!row.name) return;
    const previous = unique.get(row.name);
    if (!previous) unique.set(row.name, row);
    else {
      previous.units = [previous.units, row.units].filter(Boolean).join('; ');
      Object.keys(row).forEach(key => { if (key !== 'units' && !previous[key]) previous[key] = row[key]; });
    }
  });
  let added = 0;
  let updated = 0;
  try {
    for (const row of unique.values()) {
      const unitIds = unitIdsFor(row.units);
      if (personExists(row.name)) {
        editPersonnel(row.name, row.name, row.type);
        await syncPersonnelToOtherUnits(row.name, row.type, unitIds, getCurrentUnitId());
        updated += 1;
      } else if (await addPersonnelToUnits(row.name, row.type, unitIds)) {
        added += 1;
      }
      if (personExists(row.name)) setContactInfo(row.name, row);
    }
    hide();
    onComplete();
    showToast(t('personnelImport.saved', { added, updated }), 'success');
  } catch {
    showToast(t('personnelImport.saveFailed'), 'error');
  }
}

export function showPersonnelImport(callback = () => {}) {
  onComplete = callback;
  createOverlay();
  overlay.innerHTML = `<div class="modal glass personnel-import-modal"><div class="directory-heading"><div><h2 class="modal-title">${esc(t('personnelImport.title'))}</h2><p class="directory-unit">${esc(t('personnelImport.hint'))}</p></div><button class="action-btn" id="personnelImportClose" type="button" aria-label="${esc(t('modal.cancel'))}">×</button></div><div class="personnel-import-drop"><label class="btn btn-primary" for="personnelImportFile">${esc(t('personnelImport.chooseFile'))}</label><input id="personnelImportFile" type="file" accept=".xlsx,.xls,.csv,.tsv,.txt" hidden><span id="personnelImportFileName">${esc(t('personnelImport.noFile'))}</span></div><p class="personnel-import-edit-hint">${esc(t('personnelImport.editHint'))}</p><div class="personnel-map-grid" id="personnelImportMapping"></div><p id="personnelImportError" class="modal-error" style="display:none"></p><p id="personnelImportSummary" class="advanced-result"></p><div class="directory-table-wrap personnel-import-table-wrap"><table class="directory-table personnel-import-table"><thead><tr><th>${esc(t('directory.name'))}</th><th>${esc(t('modal.personnelType'))}</th><th>${esc(t('detail.phone'))}</th><th>${esc(t('detail.email'))}</th><th>${esc(t('personnelImport.department'))}</th><th>${esc(t('directory.action'))}</th></tr></thead><tbody id="personnelImportRows"></tbody></table></div><p class="directory-hint">${esc(t('personnelImport.columns'))}</p><div class="modal-actions"><button class="btn" id="personnelImportCancel" type="button">${esc(t('modal.cancel'))}</button><button class="btn btn-primary" id="personnelImportSave" type="button" disabled>${esc(t('personnelImport.save'))}</button></div></div>`;
  overlay.querySelector('#personnelImportClose').onclick = hide;
  overlay.querySelector('#personnelImportCancel').onclick = hide;
  overlay.querySelector('#personnelImportSave').onclick = importRows;
  overlay.querySelector('#personnelImportFile').onchange = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    overlay.querySelector('#personnelImportFileName').textContent = file.name;
    overlay.querySelector('#personnelImportError').style.display = 'none';
    try {
      rawRows = await readSpreadsheetFile(file);
      headers = Object.keys(rawRows[0] || {});
      mapping = autoMapping(headers);
      buildRows();
      renderMapping();
      renderPreview();
      if (!rawRows.length) throw new Error('empty');
    } catch {
      rows = [];
      overlay.querySelector('#personnelImportError').textContent = t('personnelImport.readFailed');
      overlay.querySelector('#personnelImportError').style.display = 'block';
      renderMapping();
      renderPreview();
    }
  };
  rows = [];
  rawRows = [];
  headers = [];
  mapping = {};
  renderMapping();
  renderPreview();
  overlay.classList.add('active');
}
