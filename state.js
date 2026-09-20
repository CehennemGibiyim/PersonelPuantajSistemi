import { saveState, loadState } from './storage.js';
import { getDaysInMonth, getYear, getMonth, uid, getWeeks, getShiftMetrics, getNetWorkedHours, roundHours } from './utils.js';
import { getDutyRecords as listDutyRecords, setDutyRecords, getDutyColumns as listDutyColumns, setDutyColumns as replaceDutyColumns, getDutyForDay, getDutiesForDay, renameDutyPerson, removeDutiesForPerson, removeDutiesForDay, removeOrphanedDuties, addDutyRecord as createDutyRecord, setDutyAssignment as saveDutyCell, removeDutyColumn as removeDutyColumnState, deleteDutyRecord as removeDutyRecord } from './duty-state.js';
import { addPersonnelToOtherUnits } from './personnel-assignment.js';
import { formatPersonnelName, personnelNameKey } from './name-format.js';

const DEFAULT_UNITS = [
  { id: 'u_default', name: 'CERRAHİ 1-2' }
];

const DEFAULT_PERSONNEL = [
  { name: 'BURHAN YILDIRIM', type: 'worker' },
  { name: 'AZAM ALTUN', type: 'worker' },
  { name: 'MUSTAFA UYGUR', type: 'worker' },
  { name: 'ÖMER AKBIYIK', type: 'worker' },
  { name: 'EMRAH ALPASLAN', type: 'worker' },
  { name: 'UYGUR AKSU', type: 'worker' },
  { name: 'ECE GÖREN', type: 'worker' }
];

const DEFAULT_ADMINS = {
  headNurse: 'NECLA YILDIZ',
  manager: 'HALİSE YILDIZ',
  chiefDoctor: 'VOLKAN SOYSAL'
};

let units = [];
let currentUnitId = '';
let role = 'admin';
let personnelList = [];
let personnelTypes = {};
let scheduleData = {};
let admins = { ...DEFAULT_ADMINS };
let currentWeek = 0;
let nightHours = {};
let weeklyTotals = {};
// Kullanıcı tarafından haftalık özet alanlarına girilen düzeltmeleri,
// vardiya kodlarından üretilen otomatik değerlerden ayrı tutarız.
let manualTotals = {};
let manualNightHours = {};
let swapRequests = [];
let leaveBalances = {};
let contactInfo = {};
let certificates = {};
let performanceNotes = {};
let approvalState = { headNurse: 'pending', manager: 'pending', chiefDoctor: 'pending' };
let leaveRequests = [];
let shiftTemplates = [];
function sortPersonnel() {
  personnelList.sort((a, b) => a.localeCompare(b, 'tr'));
}

function remapNameKeys(source, nameMap) {
  const result = {};
  Object.entries(source || {}).forEach(([key, value]) => {
    const nextKey = nameMap.get(key) || formatPersonnelName(key);
    if (!nextKey) return;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[nextKey] = { ...(result[nextKey] || {}), ...value };
    } else if (result[nextKey] === undefined) {
      result[nextKey] = value;
    }
  });
  return result;
}

function normalizePersonnelNames() {
  const original = Array.isArray(personnelList) ? personnelList.map(value => String(value || '').trim()).filter(Boolean) : [];
  const nameMap = new Map(original.map(name => [name, formatPersonnelName(name)]));
  personnelList = [...new Set(original.map(name => nameMap.get(name)).filter(Boolean))];
  personnelTypes = remapNameKeys(personnelTypes, nameMap);
  scheduleData = remapNameKeys(scheduleData, nameMap);
  weeklyTotals = remapNameKeys(weeklyTotals, nameMap);
  nightHours = remapNameKeys(nightHours, nameMap);
  manualTotals = remapNameKeys(manualTotals, nameMap);
  manualNightHours = remapNameKeys(manualNightHours, nameMap);
  leaveBalances = remapNameKeys(leaveBalances, nameMap);
  contactInfo = remapNameKeys(contactInfo, nameMap);
  certificates = remapNameKeys(certificates, nameMap);
  performanceNotes = remapNameKeys(performanceNotes, nameMap);
  swapRequests = (Array.isArray(swapRequests) ? swapRequests : []).map(request => ({
    ...request,
    fromPerson: nameMap.get(request.fromPerson) || formatPersonnelName(request.fromPerson),
    toPerson: nameMap.get(request.toPerson) || formatPersonnelName(request.toPerson)
  }));
  leaveRequests = (Array.isArray(leaveRequests) ? leaveRequests : []).map(request => ({
    ...request,
    person: nameMap.get(request.person) || formatPersonnelName(request.person)
  }));
  return nameMap;
}

// ─── Birim Yönetimi ───

export function getUnits() { return [...units]; }
export function getCurrentUnitId() { return currentUnitId; }
export function getUnitName() {
  const u = units.find(x => x.id === currentUnitId);
  return u ? u.name : 'BİRİM SEÇİN';
}

export function setCurrentUnit(id) {
  if (units.some(u => u.id === id)) {
    currentUnitId = id;
    saveGlobal();
    return true;
  }
  return false;
}

export function addUnit(name) {
  const n = (name || '').trim().toUpperCase();
  if (!n || units.some(u => u.name === n)) return null;
  const id = uid('u');
  units.push({ id, name: n });
  saveGlobal();
  return id;
}

export function editUnit(id, newName) {
  const n = (newName || '').trim().toUpperCase();
  if (!n) return false;
  if (units.some(u => u.id !== id && u.name === n)) return false;
  const u = units.find(x => x.id === id);
  if (!u) return false;
  u.name = n;
  saveGlobal();
  return true;
}

export function deleteUnit(id) {
  if (units.length <= 1) return false;
  units = units.filter(u => u.id !== id);
  if (currentUnitId === id) currentUnitId = units[0].id;
  saveGlobal();
  return true;
}

// ─── Rol Yönetimi ───

export function getRole() { return role; }
export function setRole(newRole) {
  if (!['admin', 'editor', 'viewer'].includes(newRole)) return false;
  role = newRole;
  saveGlobal();
  return true;
}
export function canEdit() { return role === 'admin' || role === 'editor'; }
export function isAdmin() { return role === 'admin'; }

// ─── Personel ───

export function getPersonnelList() { return [...personnelList]; }
export function getPersonnelType(name) { return personnelTypes[personnelNameKey(name)] || 'worker'; }

export function addPersonnel(name, type = 'worker') {
  const n = formatPersonnelName(name);
  if (!n || personnelList.includes(n)) return false;
  personnelList.push(n);
  personnelTypes[n] = type;
  scheduleData[n] = {};
  weeklyTotals[n] = {};
  nightHours[n] = {};
  if (!leaveBalances[n]) leaveBalances[n] = { annual: 0, sick: 0, unpaid: 0 };
  if (!contactInfo[n]) contactInfo[n] = { phone: '', email: '', emergency: '', address: '' };
  const daysInMonth = getDaysInMonth();
  for (let d = 1; d <= daysInMonth; d++) scheduleData[n][String(d)] = '';
  sortPersonnel();
  save();
  return true;
}

export async function addPersonnelToUnits(name, type = 'worker', unitIds = []) {
  const normalized = formatPersonnelName(name);
  const selected = [...new Set(unitIds.map(String))].filter(Boolean);
  if (!normalized || !selected.length) return false;
  const currentSelected = selected.includes(String(currentUnitId));
  if (currentSelected && !addPersonnel(normalized, type)) return false;
  await addPersonnelToOtherUnits(normalized, type, selected, currentUnitId);
  return currentSelected || selected.length > 0;
}

export function editPersonnel(oldName, newName, newType) {
  const oldN = personnelNameKey(oldName);
  const newN = formatPersonnelName(newName);
  if (!newN) return false;
  if (newN !== oldN && personnelList.includes(newN)) return false;
  const idx = personnelList.indexOf(oldN);
  if (idx === -1) return false;

  if (newN !== oldN) {
    personnelList[idx] = newN;
    scheduleData[newN] = scheduleData[oldN];
    delete scheduleData[oldN];
    personnelTypes[newN] = newType || personnelTypes[oldN] || 'worker';
    delete personnelTypes[oldN];
    if (nightHours[oldN]) { nightHours[newN] = nightHours[oldN]; delete nightHours[oldN]; }
    if (weeklyTotals[oldN]) { weeklyTotals[newN] = weeklyTotals[oldN]; delete weeklyTotals[oldN]; }
    if (manualTotals[oldN]) { manualTotals[newN] = manualTotals[oldN]; delete manualTotals[oldN]; }
    if (manualNightHours[oldN]) { manualNightHours[newN] = manualNightHours[oldN]; delete manualNightHours[oldN]; }
    if (leaveBalances[oldN]) { leaveBalances[newN] = leaveBalances[oldN]; delete leaveBalances[oldN]; }
    if (contactInfo[oldN]) { contactInfo[newN] = contactInfo[oldN]; delete contactInfo[oldN]; }
    if (certificates[oldN]) { certificates[newN] = certificates[oldN]; delete certificates[oldN]; }
    if (performanceNotes[oldN]) { performanceNotes[newN] = performanceNotes[oldN]; delete performanceNotes[oldN]; }
    swapRequests = swapRequests.map(request => ({ ...request, fromPerson: request.fromPerson === oldN ? newN : request.fromPerson, toPerson: request.toPerson === oldN ? newN : request.toPerson }));
    leaveRequests = leaveRequests.map(request => ({ ...request, person: request.person === oldN ? newN : request.person }));
    renameDutyPerson(oldN, newN);
    sortPersonnel();
  } else if (newType) {
    personnelTypes[oldN] = newType;
  }
  save();
  return true;
}

export function deletePersonnel(name) {
  const person = personnelNameKey(name);
  const idx = personnelList.indexOf(person);
  if (idx === -1) return false;
  personnelList.splice(idx, 1);
  delete scheduleData[person];
  delete personnelTypes[person];
  delete nightHours[person];
  delete weeklyTotals[person];
  delete manualTotals[person];
  delete manualNightHours[person];
  delete leaveBalances[person];
  delete contactInfo[person];
  delete certificates[person];
  delete performanceNotes[person];
  swapRequests = swapRequests.filter(request => request.fromPerson !== person && request.toPerson !== person);
  leaveRequests = leaveRequests.filter(request => request.person !== person);
  removeDutiesForPerson(person);
  save();
  savePersonnelMeta();
  return true;
}

export function personExists(name) {
  return personnelList.includes(personnelNameKey(name));
}

// ─── Vardiya & Toplamlar ───

export function getScheduleData() { return scheduleData; }
export function getCurrentWeek() { return currentWeek; }
export function setCurrentWeek(week) { currentWeek = week; }

export function updateShift(name, day, value) {
  const person = personnelNameKey(name);
  if (!scheduleData[person]) return;
  removeDutiesForDay(person, day);
  scheduleData[person][String(day)] = (value || '').toUpperCase().trim();
  clearManualOverrides(person, day);
  recalculateTotals();
  save();
}

// Günlük puantaj hücresi değiştiğinde, o haftaya ait eski sıfır/manüel
// değerler otomatik hesabın üzerine yazmamalıdır.
function clearManualOverrides(name, day) {
  const weekIndex = getWeeks().findIndex(week => week.days.includes(Number(day)));
  if (weekIndex < 0) return;
  if (manualTotals[name]?.[weekIndex]) {
    delete manualTotals[name][weekIndex].worked;
    delete manualTotals[name][weekIndex].extra;
    delete manualTotals[name][weekIndex].holiday;
  }
  if (manualNightHours[name]) delete manualNightHours[name][weekIndex];
}

function clearEmptyWeekOverrides(name, weekIndex) {
  const week = getWeeks()[weekIndex];
  if (!week) return;
  const hasEntry = week.days.some(day => {
    const code = String(scheduleData[name]?.[String(day)] || '').trim();
    return Boolean(code) || getDutiesForDay(name, day).length > 0;
  });
  if (hasEntry) return;
  if (manualTotals[name]?.[weekIndex]) delete manualTotals[name][weekIndex];
  if (manualNightHours[name]) delete manualNightHours[name][weekIndex];
}

function calculateDayMetrics(name, day) {
  const duties = getDutiesForDay(name, day);
  if (duties.length) {
    return duties.reduce((sum, duty) => {
      const netWorked = duty.netHours !== undefined
        ? Number(duty.netHours) || 0
        : getNetWorkedHours(duty.grossHours !== undefined ? duty.grossHours : duty.hours);
      const netNight = duty.netNightHours !== undefined
        ? Number(duty.netNightHours) || 0
        : getNetWorkedHours(duty.nightHours);
      const netHoliday = duty.netHolidayHours !== undefined
        ? Number(duty.netHolidayHours) || 0
        : getNetWorkedHours(duty.holidayHours);
      const extra = duty.extraNetHours !== undefined
        ? Number(duty.extraNetHours) || 0
        : duty.netHours !== undefined
          ? Number(duty.extraHours) || 0
          : Math.max(0, netWorked - 7.5);
      sum.worked += netWorked;
      sum.night += netNight;
      sum.extra += extra;
      sum.holiday += netHoliday;
      return sum;
    }, { worked: 0, night: 0, extra: 0, holiday: 0 });
  }

  return getShiftMetrics(scheduleData[name]?.[String(day)] || '', day);
}

export function recalculateTotals() {
  const weeks = getWeeks();
  personnelList.forEach(name => {
    if (!weeklyTotals[name]) weeklyTotals[name] = {};
    if (!nightHours[name]) nightHours[name] = {};
    weeks.forEach((week, index) => {
      const totals = week.days.reduce((acc, day) => {
        const m = calculateDayMetrics(name, day);
        acc.worked += m.worked;
        acc.extra += m.extra;
        acc.holiday += m.holiday;
        acc.night += m.night;
        return acc;
      }, { worked: 0, extra: 0, holiday: 0, night: 0 });
      const calculated = {
        worked: totals.worked,
        extra: totals.extra,
        holiday: totals.holiday
      };
      const overrides = manualTotals[name]?.[index] || {};
      // Eski kayıtlarda otomatik vardiya hesabını maskeleyen 0 değerleri
      // bulunabilir. Pozitif manuel düzeltmeleri koru; hesaplanan değer
      // sıfırken girilmiş 0'ı da korumaya devam et.
      const merged = { ...calculated };
      Object.entries(overrides).forEach(([field, value]) => {
        if (Number(value) > 0 || Number(calculated[field]) === 0) merged[field] = value;
      });
      weeklyTotals[name][index] = merged;
      const manualNight = manualNightHours[name]?.[index];
      nightHours[name][index] = manualNight !== undefined && (Number(manualNight) > 0 || totals.night === 0)
        ? manualNight
        : totals.night;
    });
  });
}

export function getNightHours(name, weekIndex) {
  const person = personnelNameKey(name);
  return (nightHours[person] && nightHours[person][weekIndex]) || 0;
}

export function setNightHours(name, weekIndex, hours) {
  const person = personnelNameKey(name);
  if (!personnelList.includes(person)) return;
  if (!nightHours[person]) nightHours[person] = {};
  if (!manualNightHours[person]) manualNightHours[person] = {};
  if (String(hours).trim() === '') {
    delete manualNightHours[person][weekIndex];
    recalculateTotals();
  } else {
    const value = Math.max(0, parseInt(hours) || 0);
    manualNightHours[person][weekIndex] = value;
    nightHours[person][weekIndex] = value;
  }
  save();
}

export function getTotalNightHours(name) {
  const h = nightHours[personnelNameKey(name)];
  if (!h) return 0;
  return Object.values(h).reduce((sum, v) => sum + v, 0);
}

export function getWeeklyTotal(name, weekIndex, field) {
  const w = weeklyTotals[personnelNameKey(name)];
  if (!w || !w[weekIndex]) return 0;
  return w[weekIndex][field] || 0;
}

export function setWeeklyTotal(name, weekIndex, field, value) {
  const person = personnelNameKey(name);
  if (!personnelList.includes(person)) return;
  if (!weeklyTotals[person]) weeklyTotals[person] = {};
  if (!weeklyTotals[person][weekIndex]) weeklyTotals[person][weekIndex] = { worked: 0, extra: 0, holiday: 0 };
  if (!manualTotals[person]) manualTotals[person] = {};
  if (!manualTotals[person][weekIndex]) manualTotals[person][weekIndex] = {};
  if (String(value).trim() === '') {
    delete manualTotals[person][weekIndex][field];
    recalculateTotals();
  } else {
    const numericValue = Math.max(0, Number.parseFloat(String(value).replace(',', '.')) || 0);
    manualTotals[person][weekIndex][field] = numericValue;
    weeklyTotals[person][weekIndex][field] = numericValue;
  }
  save();
}

export function getMonthlyTotal(name, field) {
  const w = weeklyTotals[personnelNameKey(name)];
  if (!w) return 0;
  return Object.values(w).reduce((sum, week) => sum + (week[field] || 0), 0);
}

// ─── Yöneticiler ───

export function getAdmins() { return { ...admins }; }

export function updateAdmin(key, value) {
  const v = (value || '').trim();
  if (!v || !admins.hasOwnProperty(key)) return false;
  admins[key] = v;
  save();
  return true;
}

// ─── İletişim Bilgileri ───

export function getContactInfo(name) {
  return contactInfo[personnelNameKey(name)] || { phone: '', email: '', emergency: '', address: '' };
}

export function setContactInfo(name, info) {
  const person = personnelNameKey(name);
  if (!personnelList.includes(person)) return false;
  contactInfo[person] = {
    phone: (info.phone || '').trim(),
    email: (info.email || '').trim(),
    emergency: (info.emergency || '').trim(),
    address: (info.address || '').trim()
  };
  savePersonnelMeta();
  return true;
}

// ─── İzin Takibi ───

export function getLeaveBalances(name) {
  return leaveBalances[personnelNameKey(name)] || { annual: 0, sick: 0, unpaid: 0 };
}

export function setLeaveBalances(name, balances) {
  const person = personnelNameKey(name);
  if (!personnelList.includes(person)) return false;
  leaveBalances[person] = {
    annual: Math.max(0, parseInt(balances.annual) || 0),
    sick: Math.max(0, parseInt(balances.sick) || 0),
    unpaid: Math.max(0, parseInt(balances.unpaid) || 0)
  };
  savePersonnelMeta();
  return true;
}

// ─── İK ve Operasyon Araçları ───

export function getCertificates(name) { return [...(certificates[personnelNameKey(name)] || [])]; }

export function addCertificate(name, certificate) {
  const person = personnelNameKey(name);
  if (!personnelList.includes(person) || !certificate?.title) return false;
  if (!certificates[person]) certificates[person] = [];
  certificates[person].push({
    id: uid('cert'),
    title: String(certificate.title).trim(),
    expiry: certificate.expiry || '',
    note: String(certificate.note || '').trim()
  });
  savePersonnelMeta();
  return true;
}

export function deleteCertificate(name, id) {
  const person = personnelNameKey(name);
  if (!certificates[person]) return false;
  certificates[person] = certificates[person].filter(item => item.id !== id);
  savePersonnelMeta();
  return true;
}

export function getPerformanceNote(name) { return performanceNotes[personnelNameKey(name)] || ''; }
export function setPerformanceNote(name, note) {
  const person = personnelNameKey(name);
  if (!personnelList.includes(person)) return false;
  performanceNotes[person] = String(note || '').trim();
  savePersonnelMeta();
  return true;
}

export function getApprovalState() { return { ...approvalState }; }
export function setApprovalStep(step, status) {
  if (!Object.prototype.hasOwnProperty.call(approvalState, step)) return false;
  if (!['pending', 'approved', 'rejected'].includes(status)) return false;
  approvalState[step] = status;
  save();
  return true;
}

export function getLeaveRequests() { return [...leaveRequests]; }
export function addLeaveRequest(request) {
  const person = personnelNameKey(request?.person);
  if (!person || !personnelList.includes(person)) return null;
  const item = {
    id: uid('leave'),
    person,
    type: request.type || 'annual',
    start: request.start || '',
    end: request.end || '',
    note: String(request.note || '').trim(),
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  leaveRequests.push(item);
  save();
  return item.id;
}

export function updateLeaveRequest(id, status) {
  const item = leaveRequests.find(r => r.id === id);
  if (!item || !['approved', 'rejected', 'pending'].includes(status)) return false;
  item.status = status;
  save();
  return true;
}

export function getShiftTemplates() { return [...shiftTemplates]; }
export function addShiftTemplate(name, pattern) {
  const title = String(name || '').trim();
  const values = String(pattern || '').trim().toUpperCase();
  if (!title || !values) return false;
  shiftTemplates.push({ id: uid('tpl'), name: title, pattern: values });
  save();
  return true;
}
export function deleteShiftTemplate(id) {
  shiftTemplates = shiftTemplates.filter(item => item.id !== id);
  save();
}

// ─── Nöbet Sistemi ───

export function getDutyRecords() { return listDutyRecords(); }
export function getDutyColumns() { return listDutyColumns(); }
export function setDutyColumns(nextColumns) {
  replaceDutyColumns(nextColumns);
  save();
}
export function addDutyRecord(record) {
  const normalized = { ...record, person: personnelNameKey(record?.person) };
  clearManualOverrides(normalized.person, normalized.day);
  return createDutyRecord(normalized, personnelList, scheduleData, recalculateTotals, save);
}
export function setDutyAssignment(assignment) {
  const normalized = { ...assignment, person: assignment?.person ? personnelNameKey(assignment.person) : '' };
  if (normalized.person) clearManualOverrides(normalized.person, normalized.day);
  return saveDutyCell(normalized, personnelList, scheduleData, recalculateTotals, save);
}
export function removeDutyColumn(columnKey) {
  return removeDutyColumnState(columnKey, scheduleData, recalculateTotals, save);
}
export function deleteDutyRecord(id) {
  const item = listDutyRecords().find(entry => entry.id === id);
  if (item) clearManualOverrides(item.person, item.day);
  return removeDutyRecord(id, scheduleData, recalculateTotals, save);
}

export function getStateSnapshot() {
  return {
    version: 2,
    unitId: currentUnitId,
    personnelList: [...personnelList],
    personnelTypes: { ...personnelTypes },
    scheduleData: JSON.parse(JSON.stringify(scheduleData)),
    admins: { ...admins },
    nightHours: JSON.parse(JSON.stringify(nightHours)),
    weeklyTotals: JSON.parse(JSON.stringify(weeklyTotals)),
    manualTotals: JSON.parse(JSON.stringify(manualTotals)),
    manualNightHours: JSON.parse(JSON.stringify(manualNightHours)),
    swapRequests: JSON.parse(JSON.stringify(swapRequests)),
    leaveBalances: JSON.parse(JSON.stringify(leaveBalances)),
    contactInfo: JSON.parse(JSON.stringify(contactInfo)),
    certificates: JSON.parse(JSON.stringify(certificates)),
    performanceNotes: { ...performanceNotes },
    approvalState: { ...approvalState },
    leaveRequests: JSON.parse(JSON.stringify(leaveRequests)),
    shiftTemplates: JSON.parse(JSON.stringify(shiftTemplates)),
    dutyColumns: JSON.parse(JSON.stringify(listDutyColumns())),
    dutyRecords: JSON.parse(JSON.stringify(listDutyRecords()))
  };
}

export function importStateSnapshot(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.personnelList) || !snapshot.scheduleData) return false;
  personnelList = snapshot.personnelList.map(p => String(p).trim()).filter(Boolean);
  personnelTypes = snapshot.personnelTypes || {};
  scheduleData = snapshot.scheduleData || {};
  admins = { ...DEFAULT_ADMINS, ...(snapshot.admins || {}) };
  nightHours = snapshot.nightHours || {};
  weeklyTotals = snapshot.weeklyTotals || {};
  manualTotals = snapshot.manualTotals || {};
  manualNightHours = snapshot.manualNightHours || {};
  swapRequests = snapshot.swapRequests || [];
  leaveBalances = snapshot.leaveBalances || {};
  contactInfo = snapshot.contactInfo || {};
  certificates = snapshot.certificates || {};
  performanceNotes = snapshot.performanceNotes || {};
  approvalState = { headNurse: 'pending', manager: 'pending', chiefDoctor: 'pending', ...(snapshot.approvalState || {}) };
  leaveRequests = snapshot.leaveRequests || [];
  shiftTemplates = snapshot.shiftTemplates || [];
  const nameMap = normalizePersonnelNames();
  replaceDutyColumns(snapshot.dutyColumns || []);
  setDutyRecords((snapshot.dutyRecords || []).map(record => ({
    ...record,
    person: nameMap.get(record?.person) || formatPersonnelName(record?.person)
  })));
  recalculateTotals();
  sortPersonnel();
  ensureAllPersonnelMeta();
  save();
  savePersonnelMeta();
  return true;
}

// ─── Depolama Anahtarları ───

// ─── Vardiya Değişim Talepleri ───

export function getSwapRequests() { return [...swapRequests]; }

export function addSwapRequest(request) {
  const id = uid('swap');
  swapRequests.push({
    id,
    fromPerson: personnelNameKey(request.fromPerson),
    fromDay: request.fromDay,
    toPerson: personnelNameKey(request.toPerson),
    toDay: request.toDay,
    status: 'pending',
    createdAt: new Date().toISOString()
  });
  save();
  return id;
}

export function updateSwapRequest(id, status) {
  const req = swapRequests.find(r => r.id === id);
  if (!req) return false;
  if (status === 'approved') {
    const fromVal = (scheduleData[req.fromPerson] && scheduleData[req.fromPerson][String(req.fromDay)]) || '';
    const toVal = (scheduleData[req.toPerson] && scheduleData[req.toPerson][String(req.toDay)]) || '';
    if (!scheduleData[req.fromPerson]) scheduleData[req.fromPerson] = {};
    if (!scheduleData[req.toPerson]) scheduleData[req.toPerson] = {};
    scheduleData[req.fromPerson][String(req.fromDay)] = toVal;
    scheduleData[req.toPerson][String(req.toDay)] = fromVal;
    recalculateTotals();
  }
  req.status = status;
  save();
  return true;
}

export function deleteSwapRequest(id) {
  const idx = swapRequests.findIndex(r => r.id === id);
  if (idx === -1) return false;
  swapRequests.splice(idx, 1);
  save();
  return true;
}

function globalKey() { return 'puantaj_global'; }
function periodKey() { return `puantaj_${currentUnitId}_${getYear()}_${getMonth()}`; }
function metaKey() { return `puantaj_${currentUnitId}_personnel_meta`; }

function save() {
  saveState({
    personnelList,
    personnelTypes,
    scheduleData,
    admins,
    nightHours,
    weeklyTotals,
    manualTotals,
    manualNightHours,
    swapRequests,
    approvalState,
    leaveRequests,
    shiftTemplates,
    dutyColumns: listDutyColumns(),
    dutyRecords: listDutyRecords()
  }, periodKey());
}

function saveGlobal() {
  saveState({ units, currentUnitId, role }, globalKey());
}

function savePersonnelMeta() {
  saveState({ leaveBalances, contactInfo, certificates, performanceNotes }, metaKey());
}

async function loadPersonnelMeta() {
  const saved = await loadState(metaKey());
  if (saved) {
    leaveBalances = saved.leaveBalances || {};
    contactInfo = saved.contactInfo || {};
    certificates = saved.certificates || {};
    performanceNotes = saved.performanceNotes || {};
  } else {
    leaveBalances = {};
    contactInfo = {};
    certificates = {};
    performanceNotes = {};
  }
}

async function loadGlobal() {
  const saved = await loadState(globalKey());
  if (saved && saved.units && saved.units.length) {
    units = saved.units;
    currentUnitId = saved.currentUnitId || units[0].id;
    role = saved.role || 'admin';
  } else {
    units = DEFAULT_UNITS.map(u => ({ ...u }));
    currentUnitId = units[0].id;
    role = 'admin';
    saveGlobal();
  }
}

export async function init() {
  await loadGlobal();

  const key = periodKey();
  const saved = await loadState(key);
  const daysInMonth = getDaysInMonth();

  if (saved && saved.personnelList && saved.scheduleData) {
    personnelList = saved.personnelList;
    personnelTypes = saved.personnelTypes || {};
    scheduleData = saved.scheduleData;
    nightHours = saved.nightHours || {};
    weeklyTotals = saved.weeklyTotals || {};
    manualTotals = saved.manualTotals || {};
    manualNightHours = saved.manualNightHours || {};
    swapRequests = saved.swapRequests || [];
    approvalState = { headNurse: 'pending', manager: 'pending', chiefDoctor: 'pending', ...(saved.approvalState || {}) };
    leaveRequests = saved.leaveRequests || [];
    shiftTemplates = saved.shiftTemplates || [];
    const nameMap = normalizePersonnelNames();
    replaceDutyColumns(saved.dutyColumns || []);
    setDutyRecords((saved.dutyRecords || []).map(record => ({
      ...record,
      person: nameMap.get(record?.person) || formatPersonnelName(record?.person)
    })));
    removeOrphanedDuties(scheduleData).forEach(item => clearManualOverrides(item.person, item.day));
    admins = saved.admins ? { ...DEFAULT_ADMINS, ...saved.admins } : { ...DEFAULT_ADMINS };
    sortPersonnel();
    personnelList.forEach(p => {
      if (!personnelTypes[p]) personnelTypes[p] = 'worker';
      if (!scheduleData[p]) scheduleData[p] = {};
      if (!weeklyTotals[p]) weeklyTotals[p] = {};
      if (!nightHours[p]) nightHours[p] = {};
      for (let d = 1; d <= daysInMonth; d++) {
        const k = String(d);
        if (scheduleData[p][k] === undefined) scheduleData[p][k] = '';
      }
    });
    personnelList.forEach(name => getWeeks().forEach((_, index) => clearEmptyWeekOverrides(name, index)));
    await loadPersonnelMeta();
    normalizePersonnelNames();
    ensureAllPersonnelMeta();
    recalculateTotals();
    save();
  } else {
    personnelList = DEFAULT_PERSONNEL.map(p => formatPersonnelName(p.name));
    personnelTypes = {};
    DEFAULT_PERSONNEL.forEach(p => { personnelTypes[formatPersonnelName(p.name)] = p.type; });
    scheduleData = {};
    weeklyTotals = {};
    nightHours = {};
    manualTotals = {};
    manualNightHours = {};
    personnelList.forEach(p => {
      scheduleData[p] = {};
      weeklyTotals[p] = {};
      nightHours[p] = {};
      for (let d = 1; d <= daysInMonth; d++) scheduleData[p][String(d)] = '';
    });
    admins = { ...DEFAULT_ADMINS };
    approvalState = { headNurse: 'pending', manager: 'pending', chiefDoctor: 'pending' };
    leaveRequests = [];
    shiftTemplates = [];
    replaceDutyColumns([]);
    setDutyRecords([]);
    await loadPersonnelMeta();
    ensureAllPersonnelMeta();
    recalculateTotals();
    save();
    savePersonnelMeta();
  }
}

function ensureAllPersonnelMeta() {
  personnelList.forEach(name => {
    if (!leaveBalances[name]) leaveBalances[name] = { annual: 0, sick: 0, unpaid: 0 };
    if (!contactInfo[name]) contactInfo[name] = { phone: '', email: '', emergency: '', address: '' };
  });
}
