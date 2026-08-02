import { saveState, loadState } from './storage.js';
import { getDaysInMonth, getYear, getMonth, uid, getWeeks, getShiftMetrics, getNetWorkedHours, roundHours } from './utils.js';
import { getDutyRecords as listDutyRecords, setDutyRecords, getDutyColumns as listDutyColumns, setDutyColumns as replaceDutyColumns, getDutyForDay, getDutiesForDay, renameDutyPerson, removeDutiesForPerson, removeDutiesForDay, removeOrphanedDuties, addDutyRecord as createDutyRecord, setDutyAssignment as saveDutyCell, removeDutyColumn as removeDutyColumnState, deleteDutyRecord as removeDutyRecord } from './duty-state.js';

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
export function getPersonnelType(name) { return personnelTypes[name] || 'worker'; }

export function addPersonnel(name, type = 'worker') {
  const n = (name || '').trim().toUpperCase();
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

export function editPersonnel(oldName, newName, newType) {
  const newN = (newName || '').trim().toUpperCase();
  if (!newN) return false;
  if (newN !== oldName && personnelList.includes(newN)) return false;
  const idx = personnelList.indexOf(oldName);
  if (idx === -1) return false;

  if (newN !== oldName) {
    personnelList[idx] = newN;
    scheduleData[newN] = scheduleData[oldName];
    delete scheduleData[oldName];
    personnelTypes[newN] = newType || personnelTypes[oldName] || 'worker';
    delete personnelTypes[oldName];
    if (nightHours[oldName]) { nightHours[newN] = nightHours[oldName]; delete nightHours[oldName]; }
    if (weeklyTotals[oldName]) { weeklyTotals[newN] = weeklyTotals[oldName]; delete weeklyTotals[oldName]; }
    if (manualTotals[oldName]) { manualTotals[newN] = manualTotals[oldName]; delete manualTotals[oldName]; }
    if (manualNightHours[oldName]) { manualNightHours[newN] = manualNightHours[oldName]; delete manualNightHours[oldName]; }
    if (leaveBalances[oldName]) { leaveBalances[newN] = leaveBalances[oldName]; delete leaveBalances[oldName]; }
    if (contactInfo[oldName]) { contactInfo[newN] = contactInfo[oldName]; delete contactInfo[oldName]; }
    renameDutyPerson(oldName, newN);
    sortPersonnel();
  } else if (newType) {
    personnelTypes[oldName] = newType;
  }
  save();
  return true;
}

export function deletePersonnel(name) {
  const idx = personnelList.indexOf(name);
  if (idx === -1) return false;
  personnelList.splice(idx, 1);
  delete scheduleData[name];
  delete personnelTypes[name];
  delete nightHours[name];
  delete weeklyTotals[name];
  delete manualTotals[name];
  delete manualNightHours[name];
  delete leaveBalances[name];
  delete contactInfo[name];
  delete certificates[name];
  delete performanceNotes[name];
  removeDutiesForPerson(name);
  save();
  savePersonnelMeta();
  return true;
}

export function personExists(name) {
  return personnelList.includes((name || '').trim().toUpperCase());
}

// ─── Vardiya & Toplamlar ───

export function getScheduleData() { return scheduleData; }
export function getCurrentWeek() { return currentWeek; }
export function setCurrentWeek(week) { currentWeek = week; }

export function updateShift(name, day, value) {
  if (!scheduleData[name]) return;
  removeDutiesForDay(name, day);
  scheduleData[name][String(day)] = (value || '').toUpperCase().trim();
  clearManualOverrides(name, day);
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
  return (nightHours[name] && nightHours[name][weekIndex]) || 0;
}

export function setNightHours(name, weekIndex, hours) {
  if (!nightHours[name]) nightHours[name] = {};
  if (!manualNightHours[name]) manualNightHours[name] = {};
  if (String(hours).trim() === '') {
    delete manualNightHours[name][weekIndex];
    recalculateTotals();
  } else {
    const value = Math.max(0, parseInt(hours) || 0);
    manualNightHours[name][weekIndex] = value;
    nightHours[name][weekIndex] = value;
  }
  save();
}

export function getTotalNightHours(name) {
  const h = nightHours[name];
  if (!h) return 0;
  return Object.values(h).reduce((sum, v) => sum + v, 0);
}

export function getWeeklyTotal(name, weekIndex, field) {
  const w = weeklyTotals[name];
  if (!w || !w[weekIndex]) return 0;
  return w[weekIndex][field] || 0;
}

export function setWeeklyTotal(name, weekIndex, field, value) {
  if (!weeklyTotals[name]) weeklyTotals[name] = {};
  if (!weeklyTotals[name][weekIndex]) weeklyTotals[name][weekIndex] = { worked: 0, extra: 0, holiday: 0 };
  if (!manualTotals[name]) manualTotals[name] = {};
  if (!manualTotals[name][weekIndex]) manualTotals[name][weekIndex] = {};
  if (String(value).trim() === '') {
    delete manualTotals[name][weekIndex][field];
    recalculateTotals();
  } else {
    const numericValue = Math.max(0, Number.parseFloat(String(value).replace(',', '.')) || 0);
    manualTotals[name][weekIndex][field] = numericValue;
    weeklyTotals[name][weekIndex][field] = numericValue;
  }
  save();
}

export function getMonthlyTotal(name, field) {
  const w = weeklyTotals[name];
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
  return contactInfo[name] || { phone: '', email: '', emergency: '', address: '' };
}

export function setContactInfo(name, info) {
  if (!personnelList.includes(name)) return false;
  contactInfo[name] = {
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
  return leaveBalances[name] || { annual: 0, sick: 0, unpaid: 0 };
}

export function setLeaveBalances(name, balances) {
  if (!personnelList.includes(name)) return false;
  leaveBalances[name] = {
    annual: Math.max(0, parseInt(balances.annual) || 0),
    sick: Math.max(0, parseInt(balances.sick) || 0),
    unpaid: Math.max(0, parseInt(balances.unpaid) || 0)
  };
  savePersonnelMeta();
  return true;
}

// ─── İK ve Operasyon Araçları ───

export function getCertificates(name) { return [...(certificates[name] || [])]; }

export function addCertificate(name, certificate) {
  if (!personnelList.includes(name) || !certificate?.title) return false;
  if (!certificates[name]) certificates[name] = [];
  certificates[name].push({
    id: uid('cert'),
    title: String(certificate.title).trim(),
    expiry: certificate.expiry || '',
    note: String(certificate.note || '').trim()
  });
  savePersonnelMeta();
  return true;
}

export function deleteCertificate(name, id) {
  if (!certificates[name]) return false;
  certificates[name] = certificates[name].filter(item => item.id !== id);
  savePersonnelMeta();
  return true;
}

export function getPerformanceNote(name) { return performanceNotes[name] || ''; }
export function setPerformanceNote(name, note) {
  if (!personnelList.includes(name)) return false;
  performanceNotes[name] = String(note || '').trim();
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
  if (!request?.person || !personnelList.includes(request.person)) return null;
  const item = {
    id: uid('leave'),
    person: request.person,
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
  clearManualOverrides(record?.person, record?.day);
  return createDutyRecord(record, personnelList, scheduleData, recalculateTotals, save);
}
export function setDutyAssignment(assignment) {
  if (assignment?.person) clearManualOverrides(assignment.person, assignment.day);
  return saveDutyCell(assignment, personnelList, scheduleData, recalculateTotals, save);
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
  replaceDutyColumns(snapshot.dutyColumns || []);
  setDutyRecords(snapshot.dutyRecords || []);
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
    fromPerson: request.fromPerson,
    fromDay: request.fromDay,
    toPerson: request.toPerson,
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
    replaceDutyColumns(saved.dutyColumns || []);
    setDutyRecords(saved.dutyRecords || []);
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
    ensureAllPersonnelMeta();
    recalculateTotals();
    save();
  } else {
    personnelList = DEFAULT_PERSONNEL.map(p => p.name);
    personnelTypes = {};
    DEFAULT_PERSONNEL.forEach(p => { personnelTypes[p.name] = p.type; });
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
