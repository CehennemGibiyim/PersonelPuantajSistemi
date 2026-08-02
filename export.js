import { getPersonnelList, getScheduleData, getDutyRecords, getAdmins, getPersonnelType, getTotalNightHours, getNightHours, getUnitName, getMonthlyTotal, getWeeklyTotal } from './state.js';
import { getYear, getMonth, MONTHS_TR, getWeeks, getDayName, isWeekend, isHoliday, t } from './utils.js';
import { showToast } from './ui/toast-view.js';
import { punchLabelForDuty } from './ui/duty-roster-utils.js?v=5';

async function loadSheetJS() {
  if (window.XLSX) return true;
  return new Promise(resolve => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

function applyPageSetup(ws) {
  ws['!pageSetup'] = {
    orientation: 'landscape',
    fitToWidth: 1,
    fitToHeight: 1,
    paperSize: 9
  };
  ws['!margins'] = {
    left: 0.25, right: 0.25,
    top: 0.3, bottom: 0.3,
    header: 0.15, footer: 0.15
  };
}

function getAllWorkDays() {
  return getWeeks().flatMap(w => w.days).filter(d => !isWeekend(d) && !isHoliday(d));
}

function getRequired(days, type) {
  const eligible = days.filter(d => !isWeekend(d) && !isHoliday(d)).length;
  return Math.round(eligible * ((type === 'civil' ? 40 : 45) / 6));
}

export async function exportToExcel() {
  const loaded = await loadSheetJS();
  if (!loaded) {
    showToast(t('app.toastExportError'), 'error');
    return;
  }

  const XLSX = window.XLSX;
  const personnel = getPersonnelList();
  const schedule = getScheduleData();
  const admins = getAdmins();
  const dutyRecords = getDutyRecords();
  const unit = getUnitName();
  const year = getYear();
  const month = getMonth();
  const weeks = getWeeks();

  const rows = [];
  const merges = [];
  let currentRow = 0;

  // Ana başlık
  rows.push([`${unit} — ${MONTHS_TR[month]} ${year} — PUANTAJ FORMU`]);
  merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 12 } });
  currentRow++;
  rows.push([t('app.codeDescriptions')]);
  merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 12 } });
  currentRow++;
  rows.push([t('app.shiftCodes')]);
  merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 12 } });
  currentRow++;
  rows.push([]);
  currentRow++;

  weeks.forEach((wk, wi) => {
    // Hafta başlığı
    rows.push([`${wk.label} (${wk.days[0]}-${wk.days[wk.days.length - 1]} ${MONTHS_TR[month]})`]);
    merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: wk.days.length + 5 } });
    currentRow++;

    // Hafta header
    const weekHeaders = [t('app.nameCol')];
    wk.days.forEach(d => weekHeaders.push(`${d}\n${getDayName(d)}`));
    weekHeaders.push(t('app.required'), t('app.worked'), t('app.night'), t('app.extra'), t('app.holiday'));
    rows.push(weekHeaders);
    currentRow++;

    // Hafta verileri
    personnel.forEach(name => {
      const pType = getPersonnelType(name) || 'worker';
      const pLabel = pType === 'civil' ? ' [M]' : '';
      const required = getRequired(wk.days, pType);
      const worked = getWeeklyTotal(name, wi, 'worked');
      const extra = getWeeklyTotal(name, wi, 'extra');
      const holiday = getWeeklyTotal(name, wi, 'holiday');
      const nightManual = getNightHours(name, wi);
      const row = [`${name}${pLabel}`];
      wk.days.forEach(d => {
        const duty = dutyRecords.find(item => item.person === name && Number(item.day) === Number(d));
        row.push(duty ? punchLabelForDuty(duty, true) : ((schedule[name] && schedule[name][d]) || ''));
      });
      row.push(required, worked, nightManual, extra, holiday);
      rows.push(row);
      currentRow++;
    });

    rows.push([]);
    currentRow++;
  });

  // Aylık özet başlığı
  rows.push(['AYLIK ÖZET']);
  merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 7 } });
  currentRow++;

  rows.push(['PERSONEL', 'Gereken', 'Çalışılan', 'Gece Mes.', 'Fazla Mes.', 'Bayram', 'Durum']);
  currentRow++;

  const allWorkDays = getAllWorkDays();
  personnel.forEach(name => {
    const pType = getPersonnelType(name) || 'worker';
    const pLabel = pType === 'civil' ? ' [M]' : '';
    const required = getRequired(allWorkDays, pType);
    const worked = getMonthlyTotal(name, 'worked');
    const extra = getMonthlyTotal(name, 'extra');
    const holiday = getMonthlyTotal(name, 'holiday');
    const totalNight = getTotalNightHours(name);
    const diff = worked - required;
    const status = diff >= 0 ? `+${diff} saat fazla` : `${diff} saat eksik`;
    rows.push([`${name}${pLabel}`, required, worked, totalNight, extra, holiday, status]);
    currentRow++;
  });

  // İmza alanı
  rows.push([]);
  currentRow++;
  rows.push(['───── İMZALAR ─────']);
  merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 7 } });
  currentRow++;
  rows.push([`Sorumlu Hemşire: ${admins.headNurse}`]);
  currentRow++;
  rows.push([`Sağlık Bakım Hiz. Müdürü: ${admins.manager}`]);
  currentRow++;
  rows.push([`Başhekim: ${admins.chiefDoctor}`]);
  currentRow++;

  const ws = XLSX.utils.aoa_to_sheet(rows);

  ws['!cols'] = [
    { wch: 22 }, { wch: 5.5 }, { wch: 5.5 }, { wch: 5.5 },
    { wch: 5.5 }, { wch: 5.5 }, { wch: 5.5 }, { wch: 5.5 },
    { wch: 9 }, { wch: 9 }, { wch: 8 }, { wch: 8 }, { wch: 8 }
  ];

  const rowHeights = [];
  for (let i = 0; i < rows.length; i++) rowHeights.push({ hpt: 18 });
  rowHeights[0] = { hpt: 26 };
  ws['!rows'] = rowHeights;

  ws['!merges'] = merges;
  applyPageSetup(ws);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'PUANTAJ');

  XLSX.writeFile(wb, `Puantaj_${MONTHS_TR[getMonth()]}_${getYear()}.xlsx`);
  showToast(t('app.toastExportSuccess'), 'success');
}

export async function exportPayroll() {
  const loaded = await loadSheetJS();
  if (!loaded) {
    showToast(t('app.toastExportError'), 'error');
    return;
  }
  const XLSX = window.XLSX;
  const rows = [
    [t('advanced.payrollTitle'), getUnitName(), `${MONTHS_TR[getMonth()]} ${getYear()}`],
    [t('app.nameCol'), t('app.monthlyWorked'), t('app.monthlyNightOvertime'), t('app.monthlyOvertime'), t('app.monthlyHoliday')]
  ];
  getPersonnelList().forEach(name => rows.push([
    name, getMonthlyTotal(name, 'worked'), getTotalNightHours(name),
    getMonthlyTotal(name, 'extra'), getMonthlyTotal(name, 'holiday')
  ]));
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 26 }, { wch: 18 }, { wch: 20 }, { wch: 18 }, { wch: 16 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'BORDRO');
  XLSX.writeFile(wb, `Bordro_${MONTHS_TR[getMonth()]}_${getYear()}.xlsx`);
  showToast(t('advanced.payrollExported'), 'success');
}

export function initExport(btn) {
  btn.addEventListener('click', exportToExcel);
}
