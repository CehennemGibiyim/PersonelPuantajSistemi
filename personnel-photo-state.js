import { loadState, saveState } from './storage.js';
import { getCurrentUnitId, getPersonnelList } from './state.js';
import { formatPersonnelName } from './name-format.js';

const STORAGE_SUFFIX = '_personnel_photos_v1';
let photos = {};
let loadedUnitId = '';

function storageKey(unitId = getCurrentUnitId()) {
  return unitId ? `puantaj_${unitId}${STORAGE_SUFFIX}` : '';
}

function cleanPhoto(value) {
  if (typeof value === 'string') {
    const url = value.trim();
    return /^(?:https:\/\/|data:image\/)/i.test(url) ? { url } : null;
  }
  if (!value || typeof value !== 'object') return null;
  const url = String(value.url || value.publicUrl || '').trim();
  if (!/^(?:https:\/\/|data:image\/)/i.test(url)) return null;
  return {
    url,
    fileId: String(value.fileId || '').slice(0, 180),
    name: String(value.name || '').slice(0, 120),
    mimeType: String(value.mimeType || 'image/jpeg').slice(0, 80)
  };
}

export async function initPersonnelPhotos() {
  const unitId = String(getCurrentUnitId() || '');
  if (!unitId || loadedUnitId === unitId) return;
  loadedUnitId = unitId;
  try {
    const saved = await loadState(storageKey(unitId));
    const source = saved && typeof saved === 'object' ? saved : {};
    photos = {};
    const people = new Set(getPersonnelList());
    Object.entries(source).forEach(([name, value]) => {
      const person = formatPersonnelName(name);
      const photo = cleanPhoto(value);
      if (photo && people.has(person)) photos[person] = photo;
    });
  } catch {
    photos = {};
  }
}

export function getPersonnelPhoto(name) {
  return photos[formatPersonnelName(name)] || null;
}

export async function setPersonnelPhoto(name, photo) {
  const person = formatPersonnelName(name);
  const cleaned = cleanPhoto(photo);
  if (!person || !cleaned) return false;
  photos[person] = cleaned;
  return saveState(photos, storageKey());
}

export async function removePersonnelPhoto(name) {
  const person = formatPersonnelName(name);
  if (!person || !photos[person]) return true;
  delete photos[person];
  return saveState(photos, storageKey());
}

export async function renamePersonnelPhoto(oldName, newName) {
  const oldKey = formatPersonnelName(oldName);
  const newKey = formatPersonnelName(newName);
  if (!oldKey || !newKey || oldKey === newKey || !photos[oldKey]) return true;
  photos[newKey] = photos[oldKey];
  delete photos[oldKey];
  return saveState(photos, storageKey());
}

export function getPersonnelPhotosSnapshot() {
  return JSON.parse(JSON.stringify(photos));
}
