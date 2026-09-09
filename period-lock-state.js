import { loadState, saveState } from './storage.js';

let context = { unitId: '', year: 0, month: 0 };
let lockState = { locked: false, closedAt: '', closedBy: '' };
let loadedKey = '';

function storageKey() {
  return context.unitId ? `puantaj_${context.unitId}_period_lock_${context.year}_${context.month}` : '';
}

function clean(value) {
  if (!value || typeof value !== 'object') return { locked: false, closedAt: '', closedBy: '' };
  return {
    locked: value.locked === true,
    closedAt: typeof value.closedAt === 'string' ? value.closedAt : '',
    closedBy: String(value.closedBy || '').trim().slice(0, 100)
  };
}

export async function initPeriodLock(unitId, year, month) {
  context = { unitId: String(unitId || ''), year: Number(year), month: Number(month) };
  const key = storageKey();
  if (!key || loadedKey === key) return getPeriodLockState();
  try { lockState = clean(await loadState(key)); } catch { lockState = clean(null); }
  loadedKey = key;
  return getPeriodLockState();
}

export function getPeriodLockState() { return { ...lockState }; }
export function isPeriodLocked() { return lockState.locked === true; }
export function getPeriodLockContext() { return { ...context }; }

export async function lockPeriod(closedBy = '') {
  if (!storageKey()) return false;
  const previous = { ...lockState };
  lockState = { locked: true, closedAt: new Date().toISOString(), closedBy: String(closedBy || '').trim().slice(0, 100) };
  try {
    const saved = await saveState(lockState, storageKey());
    if (saved) return true;
  } catch { /* restore below */ }
  lockState = previous;
  return false;
}

export async function unlockPeriod() {
  if (!storageKey()) return false;
  const previous = { ...lockState };
  lockState = clean(null);
  try {
    const saved = await saveState(lockState, storageKey());
    if (saved) return true;
  } catch { /* restore below */ }
  lockState = previous;
  return false;
}

export async function importPeriodLockSnapshot(snapshot) {
  if (!storageKey()) return false;
  const previous = { ...lockState };
  lockState = clean(snapshot);
  try {
    const saved = await saveState(lockState, storageKey());
    if (saved) return true;
  } catch { /* restore below */ }
  lockState = previous;
  return false;
}
