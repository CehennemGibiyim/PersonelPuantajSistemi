import { loadState, saveState } from './storage.js';
import { getCurrentUnitId, getPersonnelList } from './state.js';
import { getAvailabilityStatus, setAvailabilityStatus } from './availability-state.js';
import { getDaysInMonth, getMonth, getYear, uid } from './utils.js';

const LEAVE_TYPES = new Set(['annual', 'sick', 'unpaid']);
const REQUEST_STATUSES = new Set(['pending', 'approved', 'rejected']);
const TYPE_TO_STATUS = { annual: 'annual', sick: 'sick', unpaid: 'unpaid' };
let requests = [];
let loadedUnit = '';

function storageKey() {
  return `puantaj_${getCurrentUnitId()}_leave_requests`;
}

function validIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isInteger(year) && Number.isInteger(month) && Number.isInteger(day)
    && !Number.isNaN(date.getTime())
    && date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function cleanRequest(item) {
  if (!item || typeof item !== 'object') return null;
  const person = String(item.person || '').trim();
  const type = LEAVE_TYPES.has(item.type) ? item.type : '';
  const start = String(item.start || '');
  const end = String(item.end || '');
  if (!person || !type || !validIsoDate(start) || !validIsoDate(end) || start > end) return null;
  if (!getPersonnelList().includes(person)) return null;
  return {
    id: String(item.id || uid('leave')),
    person,
    type,
    start,
    end,
    note: String(item.note || '').trim().slice(0, 1000),
    status: REQUEST_STATUSES.has(item.status) ? item.status : 'pending',
    createdAt: String(item.createdAt || new Date().toISOString()),
    updatedAt: String(item.updatedAt || item.createdAt || new Date().toISOString())
  };
}

function cleanList(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.map(cleanRequest).filter(item => {
    if (!item || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

async function persist() {
  try {
    await saveState({ requests }, storageKey());
    return true;
  } catch {
    return false;
  }
}

function isDateInCurrentMonth(isoDate) {
  const prefix = `${getYear()}-${String(getMonth() + 1).padStart(2, '0')}-`;
  return isoDate.startsWith(prefix);
}

function daysForRequest(request) {
  const days = [];
  for (let day = 1; day <= getDaysInMonth(); day += 1) {
    const iso = `${getYear()}-${String(getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (iso >= request.start && iso <= request.end) days.push(day);
  }
  return days;
}

function clearRequestProjection(request) {
  if (!request || request.status !== 'approved') return;
  daysForRequest(request).forEach(day => {
    if (getAvailabilityStatus(request.person, day) === TYPE_TO_STATUS[request.type]) {
      setAvailabilityStatus(request.person, day, 'available');
    }
  });
}

function applyRequestProjection(request) {
  if (!request || request.status !== 'approved') return;
  daysForRequest(request).forEach(day => setAvailabilityStatus(request.person, day, TYPE_TO_STATUS[request.type]));
}

export async function initLeaveRequests() {
  const unit = String(getCurrentUnitId() || '');
  if (!unit || loadedUnit === unit) {
    syncCurrentMonthLeaveRequests();
    return;
  }
  try {
    const saved = await loadState(storageKey());
    if (saved && Array.isArray(saved.requests)) {
      requests = cleanList(saved.requests);
    } else {
      // Migrate requests created by older versions, which stored them in the monthly snapshot.
      const { getLeaveRequests: getLegacyRequests } = await import('./state.js');
      requests = cleanList(getLegacyRequests());
      if (requests.length) await persist();
    }
  } catch {
    requests = [];
  }
  loadedUnit = unit;
  syncCurrentMonthLeaveRequests();
}

export function getLeaveRequests() {
  return requests.map(item => ({ ...item }));
}

export function getLeaveRequest(id) {
  const item = requests.find(request => request.id === id);
  return item ? { ...item } : null;
}

export function getLeaveSnapshot() {
  return JSON.parse(JSON.stringify(requests));
}

export async function importLeaveSnapshot(snapshot) {
  const previous = requests;
  requests = cleanList(snapshot);
  if (!(await persist())) {
    requests = previous;
    return false;
  }
  syncCurrentMonthLeaveRequests();
  return true;
}

export function validateLeaveRequest(input) {
  const person = String(input?.person || '').trim();
  const type = String(input?.type || '');
  const start = String(input?.start || '');
  const end = String(input?.end || '');
  if (!getPersonnelList().includes(person)) return 'person';
  if (!LEAVE_TYPES.has(type)) return 'type';
  if (!validIsoDate(start) || !validIsoDate(end)) return 'date';
  if (start > end) return 'range';
  return '';
}

export function addLeaveRequest(input) {
  if (validateLeaveRequest(input)) return null;
  const now = new Date().toISOString();
  const item = cleanRequest({
    ...input,
    id: uid('leave'),
    status: 'pending',
    createdAt: now,
    updatedAt: now
  });
  if (!item) return null;
  requests.push(item);
  persist();
  return { ...item };
}

export function updateLeaveRequestStatus(id, status) {
  if (!REQUEST_STATUSES.has(status)) return false;
  const item = requests.find(request => request.id === id);
  if (!item) return false;
  const previous = { ...item };
  if (previous.status === 'approved') clearRequestProjection(previous);
  item.status = status;
  item.updatedAt = new Date().toISOString();
  if (status === 'approved') applyRequestProjection(item);
  persist();
  return true;
}

export function editLeaveRequest(id, changes) {
  const item = requests.find(request => request.id === id);
  if (!item) return false;
  const next = { ...item, ...changes, id: item.id, status: item.status, createdAt: item.createdAt };
  if (validateLeaveRequest(next)) return false;
  const previous = { ...item };
  if (previous.status === 'approved') clearRequestProjection(previous);
  Object.assign(item, cleanRequest({ ...next, updatedAt: new Date().toISOString() }));
  if (item.status === 'approved') applyRequestProjection(item);
  persist();
  return true;
}

export function deleteLeaveRequest(id) {
  const index = requests.findIndex(request => request.id === id);
  if (index < 0) return false;
  const [item] = requests.splice(index, 1);
  if (item.status === 'approved') clearRequestProjection(item);
  persist();
  return true;
}

export function syncCurrentMonthLeaveRequests() {
  requests.filter(request => request.status === 'approved').forEach(applyRequestProjection);
}

export function isCurrentMonthRequest(request) {
  return Boolean(request && (isDateInCurrentMonth(request.start) || isDateInCurrentMonth(request.end) || (request.start < `${getYear()}-${String(getMonth() + 1).padStart(2, '0')}-01` && request.end >= `${getYear()}-${String(getMonth() + 1).padStart(2, '0')}-01`)));
}
