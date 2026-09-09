import { loadState, saveState } from './storage.js';
import { getCurrentUnitId } from './state.js';
import { getMonth, getYear } from './utils.js';

let loadedKey = '';
let monthlyNote = '';

function noteKey() {
  return `puantaj_${getCurrentUnitId()}_note_${getYear()}_${getMonth()}`;
}

export async function loadMonthlyNote() {
  const key = noteKey();
  if (loadedKey === key) return monthlyNote;
  const saved = await loadState(key);
  monthlyNote = typeof saved === 'string' ? saved : String(saved?.note || '');
  loadedKey = key;
  return monthlyNote;
}

export function getMonthlyNote() {
  return monthlyNote;
}

export async function setMonthlyNote(value) {
  monthlyNote = String(value || '').trim().slice(0, 4000);
  loadedKey = noteKey();
  await saveState({ note: monthlyNote, updatedAt: new Date().toISOString() }, loadedKey);
  return monthlyNote;
}
