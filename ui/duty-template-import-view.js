import { readSpreadsheetFile, normalizedHeader } from '../excel-import.js';
import { addDutyTemplate } from '../duty-template-state.js';
import { setDutyColumns } from '../state.js';
import { t } from '../utils.js';
import { showToast } from './toast-view.js';
import { columnKey, normalizeColumns } from './duty-roster-utils.js';

let overlay = null;
let columns = [];
let currentRecords = 0;
let onComplete = () => {};
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
const timePattern = /(\d{1,2}[.:]\d{2}\s*[-–]\s*\d{1,2}[.:]\d{2})/;
const serviceKeys = ['servis', 'hizmet alani', 'departman', 'birim', 'service', 'department', 'unit'];
const shiftKeys = ['vardiya', 'saat', 'saat araligi', 'shift', 'hours', 'shift hours'];

function valueByKeys(row, keys) {
  const map = Object.keys(row).reduce((out, key) => { out[normalizedHeader(key)] = row[key]; return out; }, {});
  const found = keys.map(normalizedHeader).find(key => map[key] !== undefined && String(map[key]).trim());
  return found ? String(map[found] || '').trim() : '';
}

function inferColumns(rows) {
  const result = [];
  const first = rows[0] || {};
  Object.keys(first).forEach(header => {
    const match = String(header).match(timePattern);
    if (!match) return;
    const service = String(header).replace(match[0], '').replace(/[()\[\]_-]+$/g, '').trim() || t('dutySystem.generalService');
    result.push({ service, shiftLabel: match[1] });
  });
  rows.forEach(row => {
    const service = valueByKeys(row, serviceKeys) || t('dutySystem.generalService');
    const rawShift = valueByKeys(row, shiftKeys);
    const shiftLabel = rawShift.match(timePattern)?.[1] || rawShift;
    if (shiftLabel) result.push({ service, shiftLabel });
  });
  return normalizeColumns(result.map(item => ({ ...item, key: columnKey(item.service, item.shiftLabel) })));
}

function hide() {
  overlay?.classList.remove('active');
  columns = [];
}

function render() {
  const body = overlay.querySelector('#dutyImportRows');
  body.innerHTML = columns.map((column, index) => `<tr data-duty-import-row="${index}"><td><input class="modal-input import-cell" data-duty-field="service" value="${esc(column.service)}" aria-label="${esc(t('dutySystem.service'))}"></td><td><input class="modal-input import-cell" data-duty-field="shiftLabel" value="${esc(column.shiftLabel)}" aria-label="${esc(t('dutySystem.shiftLabel'))}"></td><td><button class="action-btn action-btn-danger" type="button" data-duty-remove="${index}" aria-label="${esc(t('dutyImport.removeColumn'))}">×</button></td></tr>`).join('') || `<tr><td colspan="3" class="directory-no-results">${esc(t('dutyImport.noColumns'))}</td></tr>`;
  overlay.querySelector('#dutyImportSave').disabled = !columns.length;
  body.querySelectorAll('[data-duty-field]').forEach(input => input.addEventListener('change', event => {
    const row = event.target.closest('[data-duty-import-row]');
    const item = columns[Number(row.dataset.dutyImportRow)];
    if (item) {
      item[event.target.dataset.dutyField] = event.target.value.trim();
      item.key = columnKey(item.service, item.shiftLabel);
    }
    columns = normalizeColumns(columns);
    render();
  }));
  body.querySelectorAll('[data-duty-remove]').forEach(button => button.addEventListener('click', () => {
    columns.splice(Number(button.dataset.dutyRemove), 1);
    render();
  }));
}

function readEditedColumns() {
  overlay.querySelectorAll('[data-duty-import-row]').forEach(row => {
    const item = columns[Number(row.dataset.dutyImportRow)];
    if (!item) return;
    item.service = row.querySelector('[data-duty-field="service"]')?.value.trim() || '';
    item.shiftLabel = row.querySelector('[data-duty-field="shiftLabel"]')?.value.trim() || '';
    item.key = columnKey(item.service, item.shiftLabel);
  });
  columns = normalizeColumns(columns);
}

async function save() {
  readEditedColumns();
  const name = overlay.querySelector('#dutyImportName').value.trim();
  if (!name || !columns.length) return showToast(t('dutyImport.required'), 'error');
  if (!addDutyTemplate(name, columns)) return showToast(t('dutyImport.saveFailed'), 'error');
  if (!currentRecords) setDutyColumns(columns);
  hide();
  onComplete();
  showToast(currentRecords ? t('dutyImport.savedTemplateOnly') : t('dutyImport.saved'), 'success');
}

export function showDutyTemplateImport(records = [], callback = () => {}) {
  currentRecords = records.length;
  onComplete = callback;
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'modal-overlay duty-import-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    document.body.appendChild(overlay);
    overlay.addEventListener('click', event => { if (event.target === overlay) hide(); });
  }
  overlay.innerHTML = `<div class="modal glass duty-import-modal"><div class="directory-heading"><div><h2 class="modal-title">${esc(t('dutyImport.title'))}</h2><p class="directory-unit">${esc(t(currentRecords ? 'dutyImport.existingRecords' : 'dutyImport.hint'))}</p></div><button class="action-btn" id="dutyImportClose" type="button" aria-label="${esc(t('modal.cancel'))}">×</button></div><div class="advanced-form-grid"><input class="modal-input" id="dutyImportName" placeholder="${esc(t('dutySystem.templateName'))}"><label class="btn btn-primary" for="dutyImportFile">${esc(t('dutyImport.chooseFile'))}</label><input id="dutyImportFile" type="file" accept=".xlsx,.xls,.csv,.tsv,.txt" hidden></div><p id="dutyImportFileName" class="advanced-muted">${esc(t('personnelImport.noFile'))}</p><p id="dutyImportError" class="modal-error" style="display:none"></p><div class="directory-table-wrap"><table class="directory-table duty-import-table"><thead><tr><th>${esc(t('dutySystem.service'))}</th><th>${esc(t('dutySystem.shiftLabel'))}</th><th>${esc(t('directory.action'))}</th></tr></thead><tbody id="dutyImportRows"></tbody></table></div><p class="directory-hint">${esc(t('dutyImport.columns'))}</p><div class="modal-actions"><button class="btn" id="dutyImportCancel" type="button">${esc(t('modal.cancel'))}</button><button class="btn btn-primary" id="dutyImportSave" type="button" disabled>${esc(t('dutyImport.save'))}</button></div></div>`;
  overlay.querySelector('#dutyImportClose').onclick = hide;
  overlay.querySelector('#dutyImportCancel').onclick = hide;
  overlay.querySelector('#dutyImportSave').onclick = save;
  overlay.querySelector('#dutyImportFile').onchange = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    overlay.querySelector('#dutyImportFileName').textContent = file.name;
    try {
      columns = inferColumns(await readSpreadsheetFile(file));
      render();
      const error = overlay.querySelector('#dutyImportError');
      error.style.display = columns.length ? 'none' : 'block';
      error.textContent = columns.length ? '' : t('dutyImport.noColumns');
    } catch {
      columns = [];
      overlay.querySelector('#dutyImportError').textContent = t('dutyImport.readFailed');
      overlay.querySelector('#dutyImportError').style.display = 'block';
      render();
    }
  };
  columns = [];
  render();
  overlay.classList.add('active');
}
