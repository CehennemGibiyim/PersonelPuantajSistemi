const MAX_IMPORT_BYTES = 900 * 1024;
const MAX_NODES = 50000;
const MAX_PEOPLE = 500;

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function inspect(value, depth = 0, counter = { count: 0 }) {
  if (depth > 12) return false;
  if (typeof value === 'string') return value.length <= 2000 && !/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value);
  if (value === null || typeof value !== 'object') return true;
  counter.count += 1;
  if (counter.count > MAX_NODES) return false;
  if (Array.isArray(value) && value.length > 2500) return false;
  for (const [key, child] of Object.entries(value)) {
    if (['__proto__', 'prototype', 'constructor'].includes(key)) return false;
    if (!inspect(child, depth + 1, counter)) return false;
  }
  return true;
}

function validPerson(name) {
  return typeof name === 'string' && name.trim().length >= 2 && name.trim().length <= 100 && !/[\u0000-\u001F]/.test(name);
}

function cleanSchedule(schedule, people) {
  if (!isObject(schedule)) return null;
  const result = {};
  for (const person of people) {
    const source = schedule[person];
    if (!isObject(source)) {
      result[person] = {};
      continue;
    }
    result[person] = {};
    for (const [day, value] of Object.entries(source)) {
      const number = Number(day);
      if (Number.isInteger(number) && number >= 1 && number <= 31 && typeof value === 'string' && value.length <= 20) {
        result[person][String(number)] = value.trim();
      }
    }
  }
  return result;
}

function cleanDutyRecords(records, people) {
  if (!Array.isArray(records)) return [];
  return records.slice(0, 2500).filter(item => {
    const day = Number(item?.day);
    const gross = Number(item?.grossHours ?? item?.hours);
    return isObject(item) && people.includes(String(item.person || '')) && Number.isInteger(day) && day >= 1 && day <= 31 && Number.isFinite(gross) && gross >= 0 && gross <= 48;
  }).map(item => ({ ...item, person: String(item.person), day: Number(item.day) }));
}

export function sanitizeSnapshot(input) {
  if (!isObject(input) || !inspect(input)) return null;
  const serialized = JSON.stringify(input);
  if (!serialized || serialized.length > MAX_IMPORT_BYTES) return null;
  if (!Array.isArray(input.personnelList)) return null;
  const people = [...new Set(input.personnelList.filter(validPerson).map(name => name.trim()))];
  if (!people.length || people.length > MAX_PEOPLE || people.length !== input.personnelList.length) return null;
  const scheduleData = cleanSchedule(input.scheduleData, people);
  if (!scheduleData) return null;
  const snapshot = JSON.parse(serialized);
  snapshot.personnelList = people;
  snapshot.scheduleData = scheduleData;
  snapshot.personnelTypes = Object.fromEntries(people.map(name => [name, input.personnelTypes?.[name] === 'civil' ? 'civil' : 'worker']));
  snapshot.dutyRecords = cleanDutyRecords(input.dutyRecords, people);
  snapshot.dutyColumns = Array.isArray(input.dutyColumns) ? input.dutyColumns.slice(0, 50) : [];
  return snapshot;
}

export function isSafeSnapshot(input) {
  return Boolean(sanitizeSnapshot(input));
}
