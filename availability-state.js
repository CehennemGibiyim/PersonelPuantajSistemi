import { saveState, loadState } from './storage.js';
import { getDaysInMonth, getMonth, getYear } from './utils.js';
import { getCurrentUnitId, getPersonnelList, getScheduleData, updateShift } from './state.js';

const STATUS_VALUES = new Set(['annual', 'sick', 'unpaid', 'unavailable', 'preferred']);
const STATUS_CODES = { annual: 'İ', sick: 'R', unpaid: 'ÜY' };
const LEAVE_CODES = new Set(Object.values(STATUS_CODES));
let availability = {};
let loadedKey = '';

function storageKey() {
  return `puantaj_${getCurrentUnitId()}_availability_${getYear()}_${getMonth()}`;
}

function cleanData(value) {
  const people = new Set(getPersonnelList());
  const result = {};
  if (!value || typeof value !== 'object') return result;
  Object.entries(value).forEach(([person, days]) => {
    if (!people.has(person) || !days || typeof days !== 'object') return;
    const validDays = {};
    Object.entries(days).forEach(([day, status]) => {
      const number = Number(day);
      if (number >= 1 && number <= getDaysInMonth() && STATUS_VALUES.has(status)) validDays[String(number)] = status;
    });
    if (Object.keys(validDays).length) result[person] = validDays;
  });
  return result;
}

function syncPunchCode(person, day, status, previousStatus = 'available') {
  const schedule = getScheduleData();
  const current = String(schedule[person]?.[String(day)] || '').trim();
  const nextCode = STATUS_CODES[status] || '';
  const previousCode = STATUS_CODES[previousStatus] || '';

  // İzin/rapor durumu kaydedildiğinde puantajdaki boş hücreye kod işler.
  // Dolu bir vardiyayı ezmeyiz; böylece olası çakışma ayrıca görünür kalır.
  if (nextCode && (!current || LEAVE_CODES.has(current) || current === previousCode)) {
    if (current !== nextCode) updateShift(person, day, nextCode);
    return;
  }
  if (!nextCode && previousCode && current === previousCode) updateShift(person, day, '');
}

function syncLoadedStatuses() {
  Object.entries(availability).forEach(([person, days]) => {
    Object.entries(days).forEach(([day, status]) => syncPunchCode(person, Number(day), status));
  });
}

export async function initAvailability() {
  const key = storageKey();
  if (loadedKey === key) return;
  try {
    const saved = await loadState(key);
    availability = cleanData(saved?.availability || saved || {});
    syncLoadedStatuses();
  } catch {
    availability = {};
  }
  loadedKey = key;
}

export function getAvailabilityStatus(person, day) {
  return availability[person]?.[String(day)] || 'available';
}

export function getAvailabilityForPerson(person) {
  return { ...(availability[person] || {}) };
}

export function availabilityStatusForCode(value) {
  const code = String(value ?? '').trim().toUpperCase();
  if (code === 'İ' || code === 'I' || code === 'IZIN') return 'annual';
  if (code === 'R' || code === 'RAPOR') return 'sick';
  if (code === 'ÜY' || code === 'UY' || code === 'UCRETSIZ') return 'unpaid';
  return null;
}

function persist() {
  saveState({ availability }, storageKey()).catch(() => {});
}

export function setAvailabilityStatus(person, day, status) {
  const next = getAvailabilityForPerson(person);
  if (status === 'available' || !STATUS_VALUES.has(status)) delete next[String(day)];
  else next[String(day)] = status;
  return setAvailabilityStatuses(person, next);
}

// Takvimdeki geçici seçimleri tek seferde kaydeder; puantaj kodları ve toplamlar
// yalnızca kullanıcı Kaydet düğmesine bastığında güncellenir.
export function setAvailabilityStatuses(person, statuses) {
  if (!getPersonnelList().includes(person)) return false;
  const previous = getAvailabilityForPerson(person);
  const next = {};
  if (statuses && typeof statuses === 'object') {
    Object.entries(statuses).forEach(([day, status]) => {
      const number = Number(day);
      if (Number.isInteger(number) && number >= 1 && number <= getDaysInMonth() && STATUS_VALUES.has(status)) {
        next[String(number)] = status;
      }
    });
  }

  if (Object.keys(next).length) availability[person] = next;
  else delete availability[person];

  for (let day = 1; day <= getDaysInMonth(); day += 1) {
    const key = String(day);
    const nextStatus = next[key] || 'available';
    const previousStatus = previous[key] || 'available';
    if (nextStatus !== previousStatus) syncPunchCode(person, day, nextStatus, previousStatus);
  }
  persist();
  return true;
}

export function getAvailabilitySnapshot() {
  return JSON.parse(JSON.stringify(availability));
}

export function importAvailabilitySnapshot(snapshot) {
  availability = cleanData(snapshot || {});
  loadedKey = storageKey();
  syncLoadedStatuses();
  persist();
  return true;
}

export function hasAvailabilityData() {
  return Object.keys(availability).length > 0;
}
