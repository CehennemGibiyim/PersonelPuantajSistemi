import { getDutyRecords, getDutyColumns, getAdmins, getUnitName, getPersonnelList } from '../state.js';
import { getDaysInMonth, getDayName, getMonth, getYear, MONTHS_TR, isWeekend, isSaturday, isHoliday, t } from '../utils.js';
import { showToast } from './toast-view.js';
import { esc, effectiveColumns, formatColumn, recordMatchesColumn } from './duty-roster-utils.js?v=3';

const number = value => Number(value) || 0;

function metrics(records) {
  return records.reduce((sum, item) => {
    sum.gross += number(item.grossHours ?? item.hours);
    sum.net += number(item.netHours ?? item.hours);
    sum.night += number(item.netNightHours ?? item.nightHours);
    sum.extra += number(item.extraNetHours ?? item.extraHours);
    sum.holiday += number(item.netHolidayHours ?? item.holidayHours);
    return sum;
  }, { gross: 0, net: 0, night: 0, extra: 0, holiday: 0 });
}

function serviceSummary(columns) {
  const groups = [];
  columns.forEach(column => {
    let group = groups.find(item => item.service === column.service);
    if (!group) {
      group = { service: column.service, shifts: [] };
      groups.push(group);
    }
    if (!group.shifts.includes(column.shiftLabel)) group.shifts.push(column.shiftLabel);
  });
  return groups.map(group => `<div><strong>${esc(group.service)}:</strong> <span>${group.shifts.map(esc).join(' | ')}</span></div>`).join('');
}

function cellContent(dayRecords, column) {
  const matches = dayRecords.filter(item => recordMatchesColumn(item, column));
  if (!matches.length) return '<span class="duty-print-empty">&nbsp;</span>';
  return matches.map(item => `<div class="duty-print-person">${esc(item.person)}${item.note ? `<small>${esc(item.note)}</small>` : ''}</div>`).join('');
}

function printDayClasses(day, hasRecords) {
  const classes = hasRecords ? [] : ['duty-print-no-record'];
  if (isHoliday(day)) classes.push('duty-print-holiday-row');
  if (isSaturday(day)) classes.push('duty-print-saturday-row');
  if (isWeekend(day)) classes.push('duty-print-sunday-row', 'duty-print-weekend-row');
  return classes.join(' ');
}

function buildReport() {
  const records = getDutyRecords().slice().sort((a, b) => Number(a.day) - Number(b.day));
  const columns = effectiveColumns(getDutyColumns(), records);
  const totals = metrics(records);
  const admins = getAdmins();
  const month = MONTHS_TR[getMonth()].toUpperCase();
  const year = getYear();
  const unit = getUnitName();
  const personnelCount = getPersonnelList().length;

  let html = `<main class="duty-print-page"><div class="duty-print-content"><header class="duty-print-header"><h1>${esc(month)} ${year} ${esc(t('dutySystem.printTitle'))}</h1><p>${esc(unit)} · ${esc(t('dutySystem.printSubtitle'))}</p></header>`;
  html += `<section class="duty-print-meta"><div><strong>${esc(t('dutySystem.printServices'))}:</strong><div class="duty-print-services">${serviceSummary(columns)}</div><div class="duty-print-target">${esc(t('dutySystem.printTarget'))}: 195 ${esc(t('dutySystem.printHoursUnit'))}</div></div><div class="duty-print-totals"><strong>${esc(t('dutySystem.printTotals'))}</strong><span>${esc(t('dutySystem.printPersonnelCount'))}: ${personnelCount}</span><span>${esc(t('dutySystem.printGross'))}: ${totals.gross}</span><span>${esc(t('dutySystem.printNet'))}: ${totals.net}</span><span>${esc(t('dutySystem.printNight'))}: ${totals.night}</span><span>${esc(t('dutySystem.printExtra'))}: ${totals.extra}</span><span>${esc(t('dutySystem.printHoliday'))}: ${totals.holiday}</span></div></section>`;
  html += `<div class="duty-print-table-wrap"><table class="duty-print-table"><thead><tr><th>${esc(t('dutySystem.printDate'))}</th><th>${esc(t('dutySystem.printDay'))}</th>${columns.map(column => `<th>${esc(formatColumn(column))}</th>`).join('')}</tr></thead><tbody>`;
  for (let day = 1; day <= getDaysInMonth(); day += 1) {
    const dayRecords = records.filter(item => Number(item.day) === day);
    const date = `${day}.${String(getMonth() + 1).padStart(2, '0')}.${year}`;
    const classes = printDayClasses(day, dayRecords.length > 0);
    html += `<tr class="${classes}"><td>${date}</td><td>${esc(getDayName(day))}</td>${columns.map(column => `<td>${cellContent(dayRecords, column)}</td>`).join('')}</tr>`;
  }
  html += `</tbody></table></div><section class="duty-print-approval"><h2>${esc(t('dutySystem.printApproval'))}</h2><div class="duty-print-signatures"><div>${esc(t('dutySystem.approvalSupervisor'))}<br><strong>${esc(admins.headNurse)}</strong></div><div>${esc(t('dutySystem.approvalManager'))}<br><strong>${esc(admins.manager)}</strong></div><div>${esc(t('dutySystem.approvalChief'))}<br><strong>${esc(admins.chiefDoctor)}</strong></div></div></section></div></main>`;
  return html;
}

export function doDutyPrint() {
  const popup = window.open('about:blank', '_blank', 'width=1650,height=1100,scrollbars=yes,resizable=yes');
  if (!popup) return showToast(t('dutySystem.popupBlocked'), 'error');
  const cssHref = new URL('duty-system.css?v=13', document.baseURI).href;
  popup.document.open();
  popup.document.write(`<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(t('dutySystem.printTitle'))}</title><link rel="stylesheet" href="${cssHref}"><style>html,body{margin:0;background:#e9eef1;color:#172a33;font-family:Arial,sans-serif}.duty-preview-toolbar{position:sticky;top:0;z-index:5;display:flex;justify-content:flex-end;gap:8px;padding:12px 18px;background:#172a33;box-shadow:0 2px 8px rgba(0,0,0,.18)}.duty-preview-toolbar button{min-height:44px;padding:9px 20px;border:1px solid #a9b9bf;border-radius:6px;background:#fff;color:#172a33;font:600 14px Arial;cursor:pointer}.duty-preview-toolbar .primary{background:#1677a8;border-color:#1677a8;color:#fff}@media print{.duty-preview-toolbar{display:none!important}html,body{background:#fff}.duty-print-page{margin-top:0!important}}</style></head><body><div class="duty-preview-toolbar"><button class="primary" id="dutyPreviewPrint">${esc(t('app.printBtn'))}</button><button id="dutyPreviewClose">${esc(t('modal.cancel'))}</button></div>${buildReport()}</body></html>`);
  popup.document.close();
  const fitDutyPrintToPage = () => {
    const page = popup.document.querySelector('.duty-print-page');
    const content = popup.document.querySelector('.duty-print-content');
    if (!page || !content) return;
    page.style.setProperty('--duty-print-scale', '1');
    const pageStyle = popup.getComputedStyle(page);
    const paddingX = parseFloat(pageStyle.paddingLeft) + parseFloat(pageStyle.paddingRight);
    const paddingY = parseFloat(pageStyle.paddingTop) + parseFloat(pageStyle.paddingBottom);
    const availableWidth = page.clientWidth - paddingX;
    const availableHeight = page.clientHeight - paddingY;
    const naturalWidth = content.scrollWidth;
    const naturalHeight = content.scrollHeight;
    if (!availableWidth || !availableHeight || !naturalWidth || !naturalHeight) return;
    const scale = Math.min(1, availableWidth / naturalWidth, availableHeight / naturalHeight);
    page.style.setProperty('--duty-print-scale', String(Math.max(0.1, scale)));
  };
  popup.addEventListener('beforeprint', fitDutyPrintToPage);
  popup.document.getElementById('dutyPreviewPrint')?.addEventListener('click', () => { fitDutyPrintToPage(); popup.focus(); popup.print(); });
  popup.document.getElementById('dutyPreviewClose')?.addEventListener('click', () => popup.close());
  setTimeout(() => popup.focus(), 100);
}
