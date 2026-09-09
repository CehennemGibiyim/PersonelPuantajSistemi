import { getPersonnelList, getScheduleData, getDutyRecords, getDutyColumns, getAdmins, getPersonnelType, getTotalNightHours, getNightHours, getUnitName, getMonthlyTotal, getWeeklyTotal } from './state.js';
import { getYear, getMonth, MONTHS_TR, getWeeks, getDayName, getFullDayName, isWeekend, isHoliday, isSaturday, t, getDaysInMonth } from './utils.js';
import { showToast } from './ui/toast-view.js';
import { punchLabelForDuty, effectiveColumns, recordMatchesColumn, formatColumn } from './ui/duty-roster-utils.js?v=5';

let excelPromise = null;

function loadExcelJS() {
  if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
  if (excelPromise) return excelPromise;
  excelPromise = new Promise(resolve => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
    script.onload = () => resolve(window.ExcelJS || null);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
  return excelPromise;
}

const colors = {
  ink: 'FF17343D',
  teal: 'FF163F4B',
  tealLight: 'FF2A5D6A',
  cyan: 'FF38BDF8',
  cyanSoft: 'FFD9F3FF',
  weekend: 'FFFFF0C2',
  saturday: 'FFDDF5FF',
  holiday: 'FFFFE0E0',
  purple: 'FFE9DDFE',
  pink: 'FFFFDCEB',
  yellow: 'FFFFF1A8',
  white: 'FFFFFFFF',
  line: 'FFB7CDD3'
};

const border = { top: { style: 'thin', color: { argb: colors.line } }, bottom: { style: 'thin', color: { argb: colors.line } }, left: { style: 'thin', color: { argb: colors.line } }, right: { style: 'thin', color: { argb: colors.line } } };
const fill = argb => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });

function applyPageSetup(ws, landscape = true) {
  ws.pageSetup = { orientation: landscape ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 1, paperSize: 9, horizontalDpi: 300, verticalDpi: 300 };
  ws.pageMargins = { left: 0.25, right: 0.25, top: 0.35, bottom: 0.35, header: 0.15, footer: 0.15 };
  ws.views = [{ showGridLines: false }];
}

function titleRow(ws, rowNumber, text, endColumn) {
  ws.mergeCells(rowNumber, 1, rowNumber, endColumn);
  const cell = ws.getCell(rowNumber, 1);
  cell.value = text;
  cell.font = { name: 'Arial', size: 13, bold: true, color: { argb: colors.white } };
  cell.fill = fill(colors.teal);
  cell.alignment = { horizontal: 'left', vertical: 'middle' };
  ws.getRow(rowNumber).height = 24;
}

function styleHeader(row) {
  row.eachCell(cell => {
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: colors.white } };
    cell.fill = fill(colors.tealLight);
    cell.border = border;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  row.height = 30;
}

function styleBody(row, firstColumnLeft = false) {
  row.eachCell((cell, index) => {
    cell.font = { name: 'Arial', size: 9, color: { argb: colors.ink }, bold: index === 1 };
    cell.border = border;
    cell.alignment = { horizontal: firstColumnLeft && index === 1 ? 'left' : 'center', vertical: 'middle', wrapText: true };
  });
  row.height = 21;
}

function dayFill(day) {
  if (isHoliday(day)) return colors.holiday;
  if (isWeekend(day)) return colors.weekend;
  if (isSaturday(day)) return colors.saturday;
  return null;
}

function codeFill(value) {
  const code = String(value || '').trim().toUpperCase();
  if (code.startsWith('N')) return colors.purple;
  if (code.startsWith('B')) return colors.yellow;
  if (code === 'İ' || code === 'R' || !code) return null;
  return colors.cyanSoft;
}

function monthlyRequired(type, days) {
  const eligible = days.filter(d => !isWeekend(d) && !isHoliday(d)).length;
  return Math.round(eligible * ((type === 'civil' ? 40 : 45) / 6));
}

function addPunchSheet(workbook) {
  const ws = workbook.addWorksheet('PUANTAJ', { properties: { tabColor: colors.cyan } });
  const personnel = getPersonnelList();
  const schedule = getScheduleData();
  const duties = getDutyRecords();
  const weeks = getWeeks();
  const lastColumn = 1 + Math.max(...weeks.map(w => w.days.length), 1) + 5;
  applyPageSetup(ws);
  ws.getColumn(1).width = 23;
  for (let i = 2; i <= lastColumn; i += 1) ws.getColumn(i).width = i > 8 ? 11 : 7;

  let row = 1;
  titleRow(ws, row++, `${getUnitName()} — ${MONTHS_TR[getMonth()]} ${getYear()} — PUANTAJ FORMU`, lastColumn);
  titleRow(ws, row++, t('app.codeDescriptions'), lastColumn);
  ws.getCell(row, 1).value = t('app.shiftCodes');
  ws.mergeCells(row, 1, row, lastColumn);
  ws.getCell(row, 1).font = { name: 'Arial', size: 8, italic: true, color: { argb: colors.ink } };
  ws.getCell(row, 1).alignment = { wrapText: true, vertical: 'middle' };
  ws.getRow(row++).height = 30;

  weeks.forEach((week, weekIndex) => {
    titleRow(ws, row++, `${week.label} (${week.days[0]}-${week.days[week.days.length - 1]} ${MONTHS_TR[getMonth()]})`, week.days.length + 6);
    const header = ws.getRow(row++);
    header.values = [t('app.nameCol'), ...week.days.map(day => `${day}\n${getDayName(day)}`), t('app.required'), t('app.worked'), t('app.night'), t('app.extra'), t('app.holiday')];
    styleHeader(header);
    week.days.forEach((day, index) => { const cell = header.getCell(index + 2); const color = dayFill(day); if (color) cell.fill = fill(color); cell.font = { ...cell.font, color: { argb: colors.ink } }; });

    personnel.forEach(name => {
      const type = getPersonnelType(name) || 'worker';
      const values = [`${name}${type === 'civil' ? ' [M]' : ''}`];
      week.days.forEach(day => {
        const duty = duties.find(item => item.person === name && Number(item.day) === Number(day));
        values.push(duty ? punchLabelForDuty(duty, true) : (schedule[name]?.[day] || ''));
      });
      values.push(monthlyRequired(type, week.days), getWeeklyTotal(name, weekIndex, 'worked'), getNightHours(name, weekIndex), getWeeklyTotal(name, weekIndex, 'extra'), getWeeklyTotal(name, weekIndex, 'holiday'));
      const body = ws.getRow(row++);
      body.values = values;
      styleBody(body, true);
      week.days.forEach((day, index) => {
        const cell = body.getCell(index + 2);
        const color = codeFill(cell.value) || dayFill(day);
        if (color) cell.fill = fill(color);
      });
    });
    row += 1;
  });

  titleRow(ws, row++, 'AYLIK ÖZET', 7);
  const summaryHeader = ws.getRow(row++);
  summaryHeader.values = [t('app.nameCol'), t('app.required'), t('app.worked'), t('app.night'), t('app.extra'), t('app.holiday'), t('app.monthlyStatus')];
  styleHeader(summaryHeader);
  const allDays = Array.from({ length: getDaysInMonth() }, (_, i) => i + 1);
  personnel.forEach(name => {
    const type = getPersonnelType(name) || 'worker';
    const required = monthlyRequired(type, allDays);
    const worked = getMonthlyTotal(name, 'worked');
    const diff = worked - required;
    const body = ws.getRow(row++);
    body.values = [`${name}${type === 'civil' ? ' [M]' : ''}`, required, worked, getTotalNightHours(name), getMonthlyTotal(name, 'extra'), getMonthlyTotal(name, 'holiday'), diff >= 0 ? `+${diff} saat fazla` : `${diff} saat eksik`];
    styleBody(body, true);
    body.getCell(4).fill = fill(colors.purple);
    body.getCell(5).fill = fill(colors.pink);
    body.getCell(6).fill = fill(colors.yellow);
  });

  row += 1;
  titleRow(ws, row++, '───── İMZALAR ─────', 7);
  [['Sorumlu Hemşire', getAdmins().headNurse], ['Sağlık Bakım Hiz. Müdürü', getAdmins().manager], ['Başhekim', getAdmins().chiefDoctor]].forEach(([label, value]) => { ws.getCell(row++, 1).value = `${label}: ${value || ''}`; });
  return ws;
}

function addDutySheet(workbook) {
  const ws = workbook.addWorksheet('NÖBET', { properties: { tabColor: 'FBBF24' } });
  const records = getDutyRecords();
  const columns = effectiveColumns(getDutyColumns(), records);
  const lastColumn = Math.max(columns.length + 2, 3);
  applyPageSetup(ws);
  ws.getColumn(1).width = 13;
  ws.getColumn(2).width = 11;
  columns.forEach((column, index) => { ws.getColumn(index + 3).width = 20; });
  let row = 1;
  titleRow(ws, row++, `${getUnitName()} — ${MONTHS_TR[getMonth()]} ${getYear()} — NÖBET LİSTESİ`, lastColumn);
  titleRow(ws, row++, t('dutySystem.pageHint'), lastColumn);
  const header = ws.getRow(row++);
  header.values = [t('dutySystem.printDate'), t('dutySystem.printDay'), ...columns.map(formatColumn)];
  styleHeader(header);
  for (let day = 1; day <= getDaysInMonth(); day += 1) {
    const body = ws.getRow(row++);
    body.values = [`${day}.${String(getMonth() + 1).padStart(2, '0')}.${getYear()}`, getFullDayName(day), ...columns.map(column => records.find(item => Number(item.day) === day && recordMatchesColumn(item, column))?.person || '')];
    styleBody(body, true);
    const background = dayFill(day);
    if (background) body.eachCell(cell => { cell.fill = fill(background); });
  }
  row += 1;
  titleRow(ws, row++, t('dutySystem.printTotals'), lastColumn);
  const summaryHeader = ws.getRow(row++);
  summaryHeader.values = [t('app.nameCol'), t('dutySystem.totalNet'), t('dutySystem.totalNight'), t('dutySystem.totalExtra')];
  styleHeader(summaryHeader);
  const byPerson = getPersonnelList();
  byPerson.forEach(name => {
    const personRecords = records.filter(record => record.person === name);
    const body = ws.getRow(row++);
    body.values = [name, personRecords.reduce((sum, item) => sum + Number(item.netHours || item.hours || 0), 0), personRecords.reduce((sum, item) => sum + Number(item.netNightHours || item.nightHours || 0), 0), personRecords.reduce((sum, item) => sum + Number(item.extraNetHours || item.extraHours || 0), 0)];
    styleBody(body, true);
  });
  return ws;
}

function downloadBlob(blob, filename) {
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportToExcel() {
  try {
    const ExcelJS = await loadExcelJS();
    if (!ExcelJS) throw new Error('Excel kütüphanesi yüklenemedi');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Personel Nöbet + Puantaj Sistemi';
    workbook.created = new Date();
    addPunchSheet(workbook);
    addDutySheet(workbook);
    const buffer = await workbook.xlsx.writeBuffer();
    downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Puantaj_Nobet_${MONTHS_TR[getMonth()]}_${getYear()}.xlsx`);
    showToast(t('app.toastExportSuccess'), 'success');
  } catch (error) {
    console.error('Excel export failed:', error);
    showToast(t('app.toastExportError'), 'error');
  }
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function exportToCsv() {
  const personnel = getPersonnelList();
  const schedule = getScheduleData();
  const duties = getDutyRecords();
  const rows = [[`${getUnitName()} — ${MONTHS_TR[getMonth()]} ${getYear()}`], [t('app.nameCol'), ...Array.from({ length: getDaysInMonth() }, (_, i) => `${i + 1} ${getDayName(i + 1)}`), t('app.monthlyWorked'), t('app.monthlyNightOvertime'), t('app.monthlyOvertime'), t('app.monthlyHoliday')]];
  personnel.forEach(name => rows.push([name, ...Array.from({ length: getDaysInMonth() }, (_, i) => { const day = i + 1; const duty = duties.find(item => item.person === name && Number(item.day) === day); return duty ? punchLabelForDuty(duty, true) : (schedule[name]?.[day] || ''); }), getMonthlyTotal(name, 'worked'), getTotalNightHours(name), getMonthlyTotal(name, 'extra'), getMonthlyTotal(name, 'holiday')]));
  rows.push([], ['NÖBET LİSTESİ'], [t('dutySystem.printDate'), t('dutySystem.printDay'), ...effectiveColumns(getDutyColumns(), duties).map(formatColumn)]);
  for (let day = 1; day <= getDaysInMonth(); day += 1) rows.push([day, getFullDayName(day), ...effectiveColumns(getDutyColumns(), duties).map(column => duties.find(item => Number(item.day) === day && recordMatchesColumn(item, column))?.person || '')]);
  const csv = '\uFEFF' + rows.map(row => row.map(csvCell).join(';')).join('\n');
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `Puantaj_Nobet_${MONTHS_TR[getMonth()]}_${getYear()}.csv`);
  showToast(t('app.toastCsvSuccess'), 'success');
}

export async function exportPayroll() {
  return exportToExcel();
}

export function initExport(btn) {
  btn?.addEventListener('click', exportToExcel);
}
