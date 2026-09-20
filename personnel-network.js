import { loadState, saveState } from './storage.js';
import { getDaysInMonth, getMonth, getYear, getShiftMetrics, roundHours } from './utils.js';
import { getPersonnelPhoto } from './personnel-photo-state.js';
import { getPersonnelList, addPersonnel } from './state.js';
import { formatPersonnelName } from './name-format.js';

const MEMBERSHIP_KEY = 'puantaj_personnel_departments_v1';

function periodKey(unitId, year = getYear(), month = getMonth()) {
  return `puantaj_${unitId}_${year}_${month}`;
}

function cleanName(value) {
  return formatPersonnelName(value);
}

async function loadMembershipDirectory() {
  try {
    const saved = await loadState(MEMBERSHIP_KEY);
    if (!saved || typeof saved !== 'object') return {};
    const normalized = {};
    Object.entries(saved).forEach(([name, unitIds]) => {
      const person = cleanName(name);
      if (!person) return;
      normalized[person] = [...new Set([...(normalized[person] || []), ...(Array.isArray(unitIds) ? unitIds.map(String) : [])])];
    });
    return normalized;
  } catch {
    return {};
  }
}

function emptyState(saved) {
  const next = saved && typeof saved === 'object' ? { ...saved } : {};
  const original = Array.isArray(next.personnelList) ? next.personnelList : [];
  const nameMap = new Map(original.map(value => {
    const raw = String(value || '').trim();
    return [raw, cleanName(raw)];
  }).filter(([, name]) => name));
  const remap = source => Object.entries(source || {}).reduce((result, [rawName, value]) => {
    const name = nameMap.get(rawName) || cleanName(rawName);
    if (name && result[name] === undefined) result[name] = value;
    return result;
  }, {});
  next.personnelList = [...new Set(original.map(value => cleanName(value)).filter(Boolean))];
  next.personnelTypes = remap(next.personnelTypes);
  next.scheduleData = remap(next.scheduleData);
  next.weeklyTotals = remap(next.weeklyTotals);
  next.nightHours = remap(next.nightHours);
  next.manualTotals = remap(next.manualTotals);
  next.manualNightHours = remap(next.manualNightHours);
  next.dutyRecords = (Array.isArray(next.dutyRecords) ? next.dutyRecords : []).map(item => ({
    ...item,
    person: nameMap.get(String(item?.person || '').trim()) || cleanName(item?.person)
  }));
  return next;
}

function addToState(saved, name, type) {
  const next = emptyState(saved);
  if (next.personnelList.includes(name)) return next;
  next.personnelList.push(name);
  next.personnelList.sort((a, b) => a.localeCompare(b, 'tr'));
  next.personnelTypes[name] = type || 'worker';
  next.scheduleData[name] = {};
  next.weeklyTotals[name] = {};
  next.nightHours[name] = {};
  for (let day = 1; day <= getDaysInMonth(); day += 1) next.scheduleData[name][String(day)] = '';
  return next;
}

function removeFromState(saved, name) {
  const next = emptyState(saved);
  if (!next.personnelList.includes(name)) return null;
  next.personnelList = next.personnelList.filter(item => item !== name);
  ['personnelTypes', 'scheduleData', 'weeklyTotals', 'nightHours', 'manualTotals', 'manualNightHours'].forEach(key => delete next[key][name]);
  next.dutyRecords = next.dutyRecords.filter(item => item?.person !== name);
  return next;
}

export async function getPersonnelMembership(name, units) {
  const person = cleanName(name);
  const directory = await loadMembershipDirectory();
  const stored = Array.isArray(directory[person]) ? directory[person].map(String) : [];
  if (stored.length) return stored.filter(id => (units || []).some(unit => String(unit.id) === id));
  const result = [];
  for (const unit of units || []) {
    try {
      const saved = emptyState(await loadState(periodKey(unit.id)));
      if (saved.personnelList.includes(person)) result.push(unit.id);
    } catch (error) {
      console.warn('Personnel membership read failed:', error);
    }
  }
  return result;
}

export async function syncPersonnelDepartments(name, type, unitIds, currentUnitId, units) {
  const person = cleanName(name);
  const selected = new Set((unitIds || []).map(String));
  const directory = await loadMembershipDirectory();
  directory[person] = [...selected];
  await saveState(directory, MEMBERSHIP_KEY);
  const changed = [];
  for (const unit of units || []) {
    const id = String(unit.id);
    if (id === String(currentUnitId)) continue;
    try {
      const saved = emptyState(await loadState(periodKey(id)));
      const hasPerson = Boolean(saved?.personnelList?.includes(person));
      if (selected.has(id) && !hasPerson) {
        await saveState(addToState(saved, person, type), periodKey(id));
        changed.push(id);
      } else if (!selected.has(id) && hasPerson) {
        const next = removeFromState(saved, person);
        if (next) {
          await saveState(next, periodKey(id));
          changed.push(id);
        }
      }
    } catch (error) {
      console.error('Personnel department sync failed:', error);
    }
  }
  return changed;
}

export async function ensureCurrentUnitMemberships(units, currentUnitId) {
  const directory = await loadMembershipDirectory();
  const current = String(currentUnitId || '');
  if (!current) return;
  for (const [person, unitIds] of Object.entries(directory)) {
    if (!Array.isArray(unitIds) || !unitIds.map(String).includes(current)) continue;
    if (!getPersonnelList().includes(person)) addPersonnel(person, 'worker');
  }
}

export async function renamePersonnelMembership(oldName, newName) {
  const oldKey = cleanName(oldName);
  const newKey = cleanName(newName);
  if (!oldKey || !newKey || oldKey === newKey) return;
  const directory = await loadMembershipDirectory();
  if (directory[oldKey] && !directory[newKey]) directory[newKey] = directory[oldKey];
  delete directory[oldKey];
  await saveState(directory, MEMBERSHIP_KEY);
}

export async function removePersonnelFromDepartment(name, unitId) {
  const person = cleanName(name);
  const directory = await loadMembershipDirectory();
  const next = Array.isArray(directory[person]) ? directory[person].map(String).filter(id => id !== String(unitId)) : [];
  if (next.length) directory[person] = next;
  else delete directory[person];
  await saveState(directory, MEMBERSHIP_KEY);
}

export async function copyPersonnelPhotoToDepartments(name, unitIds, currentUnitId) {
  const person = cleanName(name);
  const photo = getPersonnelPhoto(person);
  if (!photo?.url) return;
  for (const unitId of new Set((unitIds || []).map(String))) {
    if (!unitId || unitId === String(currentUnitId)) continue;
    try {
      const key = `puantaj_${unitId}_personnel_photos_v1`;
      const saved = await loadState(key);
      const next = saved && typeof saved === 'object' ? { ...saved } : {};
      next[person] = photo;
      await saveState(next, key);
    } catch (error) {
      console.warn('Personnel photo department sync failed:', error);
    }
  }
}

function dutyMetrics(item) {
  const worked = Number(item.netHours ?? item.hours) || 0;
  return {
    worked: roundHours(worked),
    night: roundHours(Number(item.netNightHours ?? item.nightHours) || 0),
    extra: roundHours(Number(item.extraNetHours ?? item.extraHours) || 0),
    holiday: roundHours(Number(item.netHolidayHours ?? item.holidayHours) || 0)
  };
}

export async function loadPersonAttendance(name, units, year = getYear(), month = getMonth()) {
  const person = cleanName(name);
  const rows = [];
  const memberships = [];
  const total = { worked: 0, night: 0, extra: 0, holiday: 0 };
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (const unit of units || []) {
    let saved = null;
    try { saved = await loadState(periodKey(unit.id, year, month)); } catch { saved = null; }
    const storedPerson = saved?.personnelList?.find(item => cleanName(item) === person);
    if (!storedPerson) continue;
    memberships.push({ id: unit.id, name: unit.name });
    const schedule = saved.scheduleData?.[storedPerson] || saved.scheduleData?.[person] || {};
    const duties = (saved.dutyRecords || []).filter(item => cleanName(item?.person) === person);
    for (let day = 1; day <= daysInMonth; day += 1) {
      const dayDuties = duties.filter(item => Number(item.day) === day);
      if (dayDuties.length) {
        dayDuties.forEach(item => {
          const metrics = dutyMetrics(item);
          rows.push({ unit: unit.name, day, label: item.service || item.shiftLabel || 'NB', kind: 'duty', ...metrics });
          Object.keys(total).forEach(key => { total[key] += metrics[key]; });
        });
        continue;
      }
      const code = String(schedule[String(day)] || '').trim();
      const metrics = getShiftMetrics(code, day);
      if (!code || !metrics.worked) continue;
      rows.push({ unit: unit.name, day, label: code, kind: 'shift', ...metrics });
      Object.keys(total).forEach(key => { total[key] += metrics[key]; });
    }
  }
  return { person, memberships, rows, total: Object.fromEntries(Object.entries(total).map(([key, value]) => [key, roundHours(value)])) };
}
