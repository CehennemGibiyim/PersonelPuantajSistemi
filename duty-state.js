import { getDaysInMonth, uid, getNetWorkedHours, roundHours } from './utils.js';

let records = [];
let columns = [];

export function getDutyRecords() {
  return [...records];
}

export function setDutyRecords(nextRecords) {
  records = Array.isArray(nextRecords) ? nextRecords : [];
}

export function getDutyColumns() {
  return columns.map(column => ({ ...column }));
}

export function setDutyColumns(nextColumns) {
  columns = Array.isArray(nextColumns) ? nextColumns.map(column => ({ ...column })) : [];
}

// Column keys remain stable identifiers for existing assignments. When a
// visible service or shift title is corrected, keep that identifier and
// update the saved record labels as well so exports and punch-code mapping
// use the corrected shift information.
export function updateDutyColumnLabels(columnKey, service, shiftLabel) {
  const key = String(columnKey || '');
  const nextService = String(service || '').trim();
  const nextShiftLabel = String(shiftLabel || '').trim();
  if (!key || !nextService || !nextShiftLabel) return false;
  const column = columns.find(item => String(item.key || '') === key);
  if (!column) return false;
  const oldService = String(column.service || '').trim();
  const oldShiftLabel = String(column.shiftLabel || '').trim();
  column.service = nextService;
  column.shiftLabel = nextShiftLabel;
  records.forEach(item => {
    const matchesKey = String(item.columnKey || '') === key;
    const matchesLegacyLabel = !String(item.columnKey || '').trim()
      && String(item.service || '').trim() === oldService
      && String(item.shiftLabel || '').trim() === oldShiftLabel;
    if (matchesKey || matchesLegacyLabel) {
      item.service = nextService;
      item.shiftLabel = nextShiftLabel;
    }
  });
  return true;
}

export function getDutyForDay(person, day) {
  return records.find(item => item.person === person && Number(item.day) === Number(day));
}

export function getDutiesForDay(person, day) {
  return records.filter(item => item.person === person && Number(item.day) === Number(day));
}

export function renameDutyPerson(oldName, newName) {
  records.forEach(item => {
    if (item.person === oldName) item.person = newName;
  });
}

export function removeDutiesForPerson(name) {
  records = records.filter(item => item.person !== name);
}

export function removeDutiesForDay(person, day) {
  records = records.filter(item => !(item.person === person && Number(item.day) === Number(day)));
}

export function removeOrphanedDuties(scheduleData) {
  const orphaned = records.filter(item => scheduleData[item.person]?.[String(item.day)] !== 'NB');
  records = records.filter(item => scheduleData[item.person]?.[String(item.day)] === 'NB');
  return orphaned;
}

function restoreOrMark(person, day, scheduleData, previousShift = '') {
  if (!scheduleData[person]) scheduleData[person] = {};
  const stillAssigned = records.some(item => item.person === person && Number(item.day) === Number(day));
  scheduleData[person][String(day)] = stillAssigned ? 'NB' : (previousShift === 'NB' ? '' : previousShift);
}

function normalizeRecord(record, personnelList, scheduleData) {
  const person = String(record?.person || '');
  const day = Number(record?.day);
  const grossHours = Number(record?.grossHours ?? record?.hours);
  if (!personnelList.includes(person) || !Number.isInteger(day) || day < 1 || day > getDaysInMonth() || !grossHours || grossHours < 0) return null;

  const netHours = Number.isFinite(Number(record?.netHours))
    ? Math.max(0, Number(record.netHours))
    : getNetWorkedHours(grossHours);
  const grossNightHours = Math.max(0, Number(record?.nightHours) || 0);
  const grossHolidayHours = Math.max(0, Number(record?.holidayHours) || 0);
  const netNightHours = Number.isFinite(Number(record?.netNightHours))
    ? Math.max(0, Number(record.netNightHours))
    : getNetWorkedHours(grossNightHours);
  const netHolidayHours = Number.isFinite(Number(record?.netHolidayHours))
    ? Math.max(0, Number(record.netHolidayHours))
    : getNetWorkedHours(grossHolidayHours);

  return {
    id: uid('duty'),
    person,
    day,
    type: record.type || 'oncall',
    columnKey: String(record.columnKey || '').trim(),
    service: String(record.service || '').trim(),
    shiftLabel: String(record.shiftLabel || '').trim(),
    grossHours: roundHours(grossHours),
    netHours: roundHours(netHours),
    hours: roundHours(netHours),
    nightHours: roundHours(netNightHours),
    netNightHours: roundHours(netNightHours),
    extraHours: roundHours(Math.max(0, Number(record.extraHours) || 0)),
    extraNetHours: roundHours(Math.max(0, Number(record.extraHours) || 0)),
    holidayHours: roundHours(netHolidayHours),
    netHolidayHours: roundHours(netHolidayHours),
    note: String(record.note || '').trim(),
    previousShift: scheduleData[person]?.[String(day)] || '',
    createdAt: new Date().toISOString()
  };
}

export function addDutyRecord(record, personnelList, scheduleData, recalculateTotals, save) {
  const item = normalizeRecord(record, personnelList, scheduleData);
  if (!item || getDutyForDay(item.person, item.day)) return null;
  records.push(item);
  if (!scheduleData[item.person]) scheduleData[item.person] = {};
  scheduleData[item.person][String(item.day)] = 'NB';
  recalculateTotals();
  save();
  return item.id;
}

export function setDutyAssignment(assignment, personnelList, scheduleData, recalculateTotals, save) {
  const day = Number(assignment?.day);
  const columnKey = String(assignment?.columnKey || '').trim();
  const nextPerson = String(assignment?.person || '').trim();
  if (!columnKey || !Number.isInteger(day) || day < 1 || day > getDaysInMonth()) return false;
  if (nextPerson && !personnelList.includes(nextPerson)) return false;

  const oldIndex = records.findIndex(item => Number(item.day) === day && String(item.columnKey || '') === columnKey);
  const oldItem = oldIndex >= 0 ? records[oldIndex] : null;
  if (oldItem) records.splice(oldIndex, 1);

  if (oldItem) restoreOrMark(oldItem.person, day, scheduleData, oldItem.previousShift || '');
  if (nextPerson) {
    const item = normalizeRecord({ ...assignment, person: nextPerson, day, columnKey }, personnelList, scheduleData);
    if (!item) return false;
    item.previousShift = scheduleData[nextPerson]?.[String(day)] || '';
    records.push(item);
    if (!scheduleData[nextPerson]) scheduleData[nextPerson] = {};
    scheduleData[nextPerson][String(day)] = 'NB';
  }

  recalculateTotals();
  save();
  return true;
}

export function removeDutyColumn(columnKey, scheduleData, recalculateTotals, save) {
  const key = String(columnKey || '');
  const removed = records.filter(item => String(item.columnKey || '') === key);
  records = records.filter(item => String(item.columnKey || '') !== key);
  removed.forEach(item => restoreOrMark(item.person, item.day, scheduleData, item.previousShift || ''));
  columns = columns.filter(column => String(column.key || '') !== key);
  recalculateTotals();
  save();
  return true;
}

export function deleteDutyRecord(id, scheduleData, recalculateTotals, save) {
  const index = records.findIndex(item => item.id === id);
  if (index === -1) return false;
  const item = records[index];
  records.splice(index, 1);
  restoreOrMark(item.person, item.day, scheduleData, item.previousShift || '');
  recalculateTotals();
  save();
  return true;
}
