import { loadState, saveState } from './storage.js';
import { getAdmins, getCurrentUnitId, getUnits, updateAdmin } from './state.js';

const STORAGE_KEY = 'puantaj_unit_admin_directory_v1';
let directory = {};
let loaded = false;

function clean(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    headNurse: String(source.headNurse || '').trim(),
    manager: String(source.manager || '').trim(),
    chiefDoctor: String(source.chiefDoctor || '').trim()
  };
}

async function persist() {
  try {
    return await saveState(directory, STORAGE_KEY);
  } catch (error) {
    console.error('Unit admin directory save failed:', error);
    return false;
  }
}

export async function initUnitAdmins() {
  if (!loaded) {
    try {
      const saved = await loadState(STORAGE_KEY);
      directory = saved && typeof saved === 'object' ? saved : {};
    } catch (error) {
      console.error('Unit admin directory load failed:', error);
      directory = {};
    }
    loaded = true;
  }
  const currentId = getCurrentUnitId();
  if (currentId && !directory[currentId]) {
    directory[currentId] = clean(getAdmins());
    await persist();
  }
  return getUnitAdmin(currentId);
}

export function getUnitAdmin(unitId = getCurrentUnitId()) {
  const fallback = clean(getAdmins());
  const stored = directory[String(unitId || '')];
  return stored ? { ...fallback, ...clean(stored) } : fallback;
}

export async function setUnitAdmin(unitId, key, value) {
  const id = String(unitId || '').trim();
  const field = String(key || '').trim();
  const nextValue = String(value || '').trim();
  if (!id || !['headNurse', 'manager', 'chiefDoctor'].includes(field) || !nextValue) return false;
  directory[id] = { ...getUnitAdmin(id), [field]: nextValue };
  const saved = await persist();
  if (!saved) return false;
  if (id === getCurrentUnitId()) updateAdmin(field, nextValue);
  return true;
}

export async function setUnitAdmins(unitId, values) {
  const id = String(unitId || '').trim();
  if (!id || !getUnits().some(unit => unit.id === id)) return false;
  const next = clean(values);
  if (!next.headNurse || !next.manager || !next.chiefDoctor) return false;
  const previous = directory[id];
  directory[id] = next;
  if (!await persist()) {
    if (previous) directory[id] = previous;
    else delete directory[id];
    return false;
  }
  if (id === getCurrentUnitId()) {
    Object.entries(next).forEach(([key, value]) => updateAdmin(key, value));
  }
  return true;
}

export async function syncCurrentUnitAdmins() {
  const id = getCurrentUnitId();
  if (!id) return false;
  const values = getUnitAdmin(id);
  if (!values.headNurse || !values.manager || !values.chiefDoctor) return false;
  Object.entries(values).forEach(([key, value]) => updateAdmin(key, value));
  directory[id] = values;
  return true;
}

export function getUnitAdminSnapshot() {
  return JSON.parse(JSON.stringify(directory));
}

export async function importUnitAdminSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return false;
  const previous = directory;
  const next = {};
  Object.entries(snapshot).slice(0, 100).forEach(([id, value]) => {
    const cleanValue = clean(value);
    if (id && cleanValue.headNurse && cleanValue.manager && cleanValue.chiefDoctor) next[String(id)] = cleanValue;
  });
  directory = next;
  if (!await persist()) {
    directory = previous;
    return false;
  }
  await syncCurrentUnitAdmins();
  return true;
}
