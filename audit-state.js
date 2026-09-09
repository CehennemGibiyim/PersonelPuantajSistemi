import { loadState, saveState } from './storage.js';
import { getCurrentUnitId, getUnitName, getRole } from './state.js';
import { getYear, getMonth } from './utils.js';

const MAX_ENTRIES = 300;
let entries = [];
let loadedUnitId = '';

function storageKey(unitId = getCurrentUnitId()) {
  return unitId ? `puantaj_${unitId}_audit_log` : '';
}

function cleanEntry(value) {
  if (!value || typeof value !== 'object') return null;
  const action = String(value.action || '').trim();
  if (!action) return null;
  return {
    id: String(value.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    action,
    detail: typeof value.detail === 'string' ? value.detail.slice(0, 240) : '',
    actor: String(value.actor || '').trim().slice(0, 100),
    unitId: String(value.unitId || getCurrentUnitId()),
    unitName: String(value.unitName || getUnitName()),
    year: Number(value.year) || getYear(),
    month: Number(value.month),
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString()
  };
}

function cleanList(value) {
  const list = Array.isArray(value) ? value : Array.isArray(value?.entries) ? value.entries : [];
  return list.map(cleanEntry).filter(Boolean).slice(0, MAX_ENTRIES);
}

async function persist() {
  const key = storageKey();
  if (key) await saveState({ entries }, key);
}

export async function initAuditLog() {
  const unitId = String(getCurrentUnitId() || '');
  if (!unitId || loadedUnitId === unitId) return entries;
  loadedUnitId = unitId;
  try {
    entries = cleanList(await loadState(storageKey(unitId)));
  } catch {
    entries = [];
  }
  return entries;
}

export async function recordAudit(action, detail = '') {
  const unitId = String(getCurrentUnitId() || '');
  if (!unitId) return false;
  if (loadedUnitId !== unitId) await initAuditLog();
  const entry = cleanEntry({
    action,
    detail: typeof detail === 'string' ? detail : '',
    actor: getRole(),
    unitId,
    unitName: getUnitName(),
    year: getYear(),
    month: getMonth(),
    createdAt: new Date().toISOString()
  });
  if (!entry) return false;
  entries = [entry, ...entries].slice(0, MAX_ENTRIES);
  await persist();
  return true;
}

export function getAuditLog({ currentPeriod = false } = {}) {
  const list = [...entries];
  if (!currentPeriod) return list;
  return list.filter(item => item.year === getYear() && item.month === getMonth());
}

export function getAuditSnapshot() {
  return getAuditLog();
}

export async function importAuditSnapshot(snapshot) {
  const unitId = String(getCurrentUnitId() || '');
  if (!unitId) return false;
  entries = cleanList(snapshot).filter(item => item.unitId === unitId || !item.unitId);
  loadedUnitId = unitId;
  await persist();
  return true;
}
