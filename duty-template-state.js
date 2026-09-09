import { loadState, saveState } from './storage.js';
import { getCurrentUnitId } from './state.js';
import { uid } from './utils.js';
import { normalizeColumns } from './ui/duty-roster-utils.js';

let templates = [];
let loadedUnit = '';

function storageKey() {
  return `puantaj_${getCurrentUnitId()}_duty_templates`;
}

function cleanTemplate(item) {
  const name = String(item?.name || '').trim();
  const columns = normalizeColumns(item?.columns);
  if (!name || !columns.length) return null;
  return {
    id: String(item.id || uid('duty_tpl')),
    name,
    columns,
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt || item.createdAt || new Date().toISOString()
  };
}

export async function initDutyTemplates() {
  const unitId = getCurrentUnitId();
  if (!unitId || loadedUnit === unitId) return;
  try {
    const saved = await loadState(storageKey());
    templates = Array.isArray(saved) ? saved.map(cleanTemplate).filter(Boolean) : [];
  } catch {
    templates = [];
  }
  loadedUnit = unitId;
}

function persist() {
  saveState(templates, storageKey()).catch(() => {});
}

export function getDutyTemplates() {
  return templates.map(item => ({ ...item, columns: item.columns.map(column => ({ ...column })) }));
}

export function addDutyTemplate(name, columns) {
  const cleanName = String(name || '').trim();
  const cleanColumns = normalizeColumns(columns);
  if (!cleanName || !cleanColumns.length) return false;
  const now = new Date().toISOString();
  const existing = templates.find(item => item.name.toLocaleLowerCase('tr-TR') === cleanName.toLocaleLowerCase('tr-TR'));
  if (existing) {
    existing.columns = cleanColumns;
    existing.updatedAt = now;
  } else {
    templates.push({ id: uid('duty_tpl'), name: cleanName, columns: cleanColumns, createdAt: now, updatedAt: now });
  }
  persist();
  return true;
}

export function deleteDutyTemplate(id) {
  const next = templates.filter(item => item.id !== id);
  if (next.length === templates.length) return false;
  templates = next;
  persist();
  return true;
}

export function getDutyTemplate(id) {
  const item = templates.find(template => template.id === id);
  return item ? { ...item, columns: item.columns.map(column => ({ ...column })) } : null;
}

export function getDutyTemplatesSnapshot() {
  return getDutyTemplates();
}

export function importDutyTemplatesSnapshot(snapshot) {
  templates = Array.isArray(snapshot) ? snapshot.map(cleanTemplate).filter(Boolean) : [];
  loadedUnit = getCurrentUnitId();
  persist();
  return true;
}
