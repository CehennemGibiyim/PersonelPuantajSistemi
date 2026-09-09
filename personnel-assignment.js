import { loadState, saveState } from './storage.js';
import { getDaysInMonth, getMonth, getYear } from './utils.js';

function periodKey(unitId) {
  return `puantaj_${unitId}_${getYear()}_${getMonth()}`;
}

function ensurePerson(saved, name, type, updateExisting = false) {
  const next = saved && typeof saved === 'object' ? { ...saved } : {};
  const list = Array.isArray(next.personnelList) ? [...next.personnelList] : [];
  const types = { ...(next.personnelTypes || {}) };
  const schedule = { ...(next.scheduleData || {}) };
  const totals = { ...(next.weeklyTotals || {}) };
  const nights = { ...(next.nightHours || {}) };
  if (list.includes(name)) {
    if (!updateExisting) return null;
    types[name] = type || types[name] || 'worker';
    return { ...next, personnelList: list, personnelTypes: types, scheduleData: schedule, weeklyTotals: totals, nightHours: nights };
  }
  list.push(name);
  types[name] = type || 'worker';
  schedule[name] = {};
  totals[name] = {};
  nights[name] = {};
  for (let day = 1; day <= getDaysInMonth(); day += 1) schedule[name][String(day)] = '';
  return {
    ...next,
    personnelList: list,
    personnelTypes: types,
    scheduleData: schedule,
    weeklyTotals: totals,
    nightHours: nights,
    manualTotals: next.manualTotals || {},
    manualNightHours: next.manualNightHours || {},
    dutyColumns: next.dutyColumns || [],
    dutyRecords: next.dutyRecords || []
  };
}

async function syncUnits(name, type, unitIds, currentUnitId, updateExisting) {
  const targets = [...new Set((unitIds || []).map(String))].filter(id => id && id !== String(currentUnitId));
  const changed = [];
  for (const unitId of targets) {
    try {
      const saved = await loadState(periodKey(unitId));
      const next = ensurePerson(saved, name, type, updateExisting);
      if (!next) continue;
      await saveState(next, periodKey(unitId));
      changed.push(unitId);
    } catch (error) {
      console.error('Personnel department assignment failed:', error);
    }
  }
  return changed;
}

export async function addPersonnelToOtherUnits(name, type, unitIds, currentUnitId) {
  return syncUnits(name, type, unitIds, currentUnitId, false);
}

export async function syncPersonnelToOtherUnits(name, type, unitIds, currentUnitId) {
  return syncUnits(name, type, unitIds, currentUnitId, true);
}
