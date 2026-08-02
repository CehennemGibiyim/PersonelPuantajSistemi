import { getPersonnelList, getScheduleData, getDutyRecords, getAdmins, getPersonnelType, getTotalNightHours, getNightHours, getUnitName, getMonthlyTotal, getWeeklyTotal } from '../state.js';
import { getYear, getMonth, MONTHS_TR, getWeeks, getDayName, isWeekend, isSaturday, isHoliday, t } from '../utils.js';
import { punchLabelForDuty } from './duty-roster-utils.js?v=5';

let container = null;

export function initPrintView(el) {
  container = el;
}

export function doPrint() {
  if (!container) return;
  buildContent();
  container.classList.add('print-active');
  container.style.display = 'block';
  container.style.width = '287mm';
  container.style.height = '200mm';
  fitToSinglePage();

  // Open a clean preview first. The user can review the report and then open
  // the browser's real print preview from the preview window.
  const popup = window.open('about:blank', '_blank', 'width=1400,height=1000,scrollbars=yes,resizable=yes');
  if (popup) {
    const markup = container.innerHTML;
    const cssHref = new URL('styles.css?v=16', document.baseURI).href;
    const printLabel = t('app.printBtn');
    const closeLabel = t('modal.cancel');
    popup.document.open();
    popup.document.write(`<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <title></title>
  <link rel="stylesheet" href="${cssHref}">
  <style>
    html, body { margin: 0; background: #eef2f5; }
    .preview-toolbar {
      position: sticky; top: 0; z-index: 10; display: flex; gap: 8px;
      justify-content: flex-end; padding: 12px 16px; background: #172a33;
      border-bottom: 1px solid #52656d; font: 14px Arial, sans-serif;
    }
    .preview-toolbar button {
      min-height: 40px; padding: 8px 16px; border: 1px solid #9fb0b7;
      border-radius: 6px; background: #fff; color: #172a33; cursor: pointer;
      font: inherit;
    }
    .preview-toolbar button.primary { background: #1677a8; color: #fff; border-color: #1677a8; }
    .preview-toolbar button:focus-visible { outline: 3px solid #7dd3fc; outline-offset: 2px; }
    @media print { .preview-toolbar { display: none !important; } }
  </style>
</head>
<body class="print-popup">
  <div class="preview-toolbar" role="toolbar" aria-label="${printLabel}">
    <button type="button" class="primary" id="previewPrint">${printLabel}</button>
    <button type="button" id="previewClose">${closeLabel}</button>
  </div>
  <div id="printView" class="print-view print-active">${markup}</div>
</body>
</html>`);
    popup.document.close();

    popup.document.getElementById('previewPrint')?.addEventListener('click', () => {
      popup.focus();
      popup.print();
    });
    popup.document.getElementById('previewClose')?.addEventListener('click', () => popup.close());
    setTimeout(() => popup.focus(), 100);
    container.classList.remove('print-active');
    container.style.display = '';
    container.style.width = '';
    container.style.height = '';
    container.innerHTML = '';
    return;
  }

  // Popup engellenirse aynı belgeyi kullan; tarayıcı üstbilgi/altbilgileri
  // yalnızca kendi yazdırma ayarlarından kontrol edilebilir.
  container.classList.add('print-active');
  container.style.display = 'block';
  container.style.width = '287mm';
  container.style.height = '200mm';
  window.print();
  setTimeout(() => {
    container.classList.remove('print-active');
    container.style.display = '';
    container.style.width = '';
    container.style.height = '';
    container.innerHTML = '';
  }, 700);
}

function fitToSinglePage() {
  const sheet = container.querySelector('.print-sheet');
  if (!sheet) return;

  // A4 landscape with 5 mm margins leaves approximately 200 mm of height.
  // Scale the complete report as one unit so the browser creates one PDF page.
  const pageHeightPx = (200 / 25.4) * 96;
  const contentHeight = sheet.scrollHeight;
  const scale = Math.min(1, pageHeightPx / Math.max(contentHeight, 1));
  sheet.style.setProperty('--print-scale', scale.toFixed(4));
}

function getRequired(days, type) {
  const eligible = days.filter(d => !isWeekend(d) && !isHoliday(d)).length;
  return Math.round(eligible * ((type === 'civil' ? 40 : 45) / 6));
}

function buildContent() {
  const personnel = getPersonnelList();
  const schedule = getScheduleData();
  const admins = getAdmins();
  const unit = getUnitName();
  const year = getYear();
  const month = getMonth();
  const weeks = getWeeks();
  const dutyRecords = getDutyRecords();

  let html = `<div class="print-sheet" style="font-family:Arial,sans-serif;padding:20px;color:#000">`;
  html += `<div style="text-align:center;margin-bottom:20px">`;
  html += `<h2 style="margin:0;font-size:18px">${unit} — ${MONTHS_TR[month]} ${year} — PUANTAJ FORMU</h2>`;
  html += `<div style="margin-top:5px;font-size:8px;line-height:1.35;text-align:left;border:1px solid #999;padding:3px 5px"><strong>${t('app.codeDescriptions')}</strong><br>${t('app.shiftCodes')}</div>`;
  html += `</div>`;

  weeks.forEach((wk, wi) => {
    html += buildWeekTable(wk, wi, personnel, schedule, dutyRecords);
  });

  html += buildMonthlySummary(personnel, schedule);

  html += `<div class="print-signatures" style="margin-top:40px;border-top:2px solid #000;padding-top:16px">`;
  html += `<table style="width:100%"><tr>`;
  html += `<td style="width:33%;text-align:center;font-size:12px"><div style="margin-bottom:50px"></div><strong>Sorumlu Hemşire</strong><br>${admins.headNurse}</td>`;
  html += `<td style="width:33%;text-align:center;font-size:12px"><div style="margin-bottom:50px"></div><strong>Sağlık Bakım Hiz. Müdürü</strong><br>${admins.manager}</td>`;
  html += `<td style="width:33%;text-align:center;font-size:12px"><div style="margin-bottom:50px"></div><strong>Başhekim</strong><br>${admins.chiefDoctor}</td>`;
  html += `</tr></table></div>`;

  html += `</div>`;
  container.innerHTML = html;
}

function buildWeekTable(wk, weekIndex, personnel, schedule, dutyRecords) {
  const month = getMonth();

  let html = `<h3 style="margin:16px 0 8px;font-size:14px">${wk.label} (${wk.days[0]}-${wk.days[wk.days.length - 1]} ${MONTHS_TR[month]})</h3>`;
  html += `<table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr>`;
  html += `<th style="border:1px solid #666;padding:4px 6px;background:#e0e0e0;text-align:left;min-width:120px">PERSONEL</th>`;
  wk.days.forEach(d => {
    const dayName = getDayName(d);
    const style = isHoliday(d)
      ? 'background:#ffe2e2;color:#a33a3a'
      : isSaturday(d)
        ? 'background:#e3f5fb;color:#126782'
        : isWeekend(d)
          ? 'background:#fff1d6;color:#8a5a00'
          : 'background:#e0e0e0';
    html += `<th style="border:1px solid #666;padding:4px 3px;text-align:center;${style}">${d}<br><span style="font-size:9px">${dayName}</span></th>`;
  });
  html += `<th style="border:1px solid #666;padding:4px 6px;background:#d4edda;text-align:center">Gereken</th>`;
  html += `<th style="border:1px solid #666;padding:4px 6px;background:#d4edda;text-align:center">Çalışılan</th>`;
  html += `<th style="border:1px solid #666;padding:4px 6px;background:#cce5ff;text-align:center">Gece</th>`;
  html += `<th style="border:1px solid #666;padding:4px 6px;background:#f8d7da;text-align:center">Fazla</th>`;
  html += `<th style="border:1px solid #666;padding:4px 6px;background:#fff3cd;text-align:center">Bayram</th>`;
  html += `</tr></thead><tbody>`;

  personnel.forEach(name => {
    const pType = getPersonnelType(name) || 'worker';
    const required = getRequired(wk.days, pType);
    const worked = getWeeklyTotal(name, weekIndex, 'worked');
    const extra = getWeeklyTotal(name, weekIndex, 'extra');
    const holiday = getWeeklyTotal(name, weekIndex, 'holiday');
    const nightVal = getNightHours(name, weekIndex);
    const pLabel = pType === 'civil' ? ' [M]' : '';
    html += `<tr>`;
    html += `<td style="border:1px solid #666;padding:4px 6px;font-weight:600">${name}${pLabel}</td>`;
    wk.days.forEach(d => {
      const duty = dutyRecords.find(item => item.person === name && Number(item.day) === Number(d));
      const v = duty
        ? punchLabelForDuty(duty, true)
        : ((schedule[name] && schedule[name][d]) || '');
      const calendarBg = isHoliday(d)
        ? 'background:#ffe2e2;'
        : isSaturday(d)
          ? 'background:#e3f5fb;'
          : isWeekend(d)
            ? 'background:#fff1d6;'
            : '';
      const bg = calendarBg || (v ? (v === 'İ' || v === 'R' ? 'background:#fff3cd;' : '') : '');
      html += `<td style="border:1px solid #666;padding:4px 3px;text-align:center;${bg}">${v}</td>`;
    });
    const color = worked >= required ? '#155724' : '#721c24';
    html += `<td style="border:1px solid #666;padding:4px 6px;text-align:center;font-weight:600">${required}</td>`;
    html += `<td style="border:1px solid #666;padding:4px 6px;text-align:center;font-weight:600;color:${color}">${worked}</td>`;
    html += `<td style="border:1px solid #666;padding:4px 6px;text-align:center">${nightVal}</td>`;
    html += `<td style="border:1px solid #666;padding:4px 6px;text-align:center">${extra}</td>`;
    html += `<td style="border:1px solid #666;padding:4px 6px;text-align:center">${holiday}</td>`;
    html += `</tr>`;
  });

  html += `</tbody></table>`;
  return html;
}

function buildMonthlySummary(personnel) {
  const allDays = getWeeks().flatMap(w => w.days);

  let html = `<h3 style="margin:16px 0 8px;font-size:14px">AYLIK ÖZET — ${MONTHS_TR[getMonth()]} ${getYear()}</h3>`;
  html += `<table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr>`;
  html += `<th style="border:1px solid #666;padding:4px 6px;background:#e0e0e0;text-align:left;min-width:120px">PERSONEL</th>`;
  html += `<th style="border:1px solid #666;padding:4px 6px;background:#d4edda;text-align:center">Gereken</th>`;
  html += `<th style="border:1px solid #666;padding:4px 6px;background:#d4edda;text-align:center">Çalışılan</th>`;
  html += `<th style="border:1px solid #666;padding:4px 6px;background:#cce5ff;text-align:center">Gece Mes.</th>`;
  html += `<th style="border:1px solid #666;padding:4px 6px;background:#f8d7da;text-align:center">Fazla Mes.</th>`;
  html += `<th style="border:1px solid #666;padding:4px 6px;background:#fff3cd;text-align:center">Bayram</th>`;
  html += `<th style="border:1px solid #666;padding:4px 6px;background:#e0e0e0;text-align:center">Durum</th>`;
  html += `</tr></thead><tbody>`;

  personnel.forEach(name => {
    const pType = getPersonnelType(name) || 'worker';
    const required = getRequired(allDays, pType);
    const worked = getMonthlyTotal(name, 'worked');
    const extra = getMonthlyTotal(name, 'extra');
    const holiday = getMonthlyTotal(name, 'holiday');
    const totalNight = getTotalNightHours(name);
    const diff = worked - required;
    const status = diff >= 0 ? `+${diff} saat fazla` : `${diff} saat eksik`;
    const statusColor = diff >= 0 ? '#155724' : '#721c24';
    const pLabel = pType === 'civil' ? ' [M]' : '';
    html += `<tr>`;
    html += `<td style="border:1px solid #666;padding:4px 6px;font-weight:600">${name}${pLabel}</td>`;
    html += `<td style="border:1px solid #666;padding:4px 6px;text-align:center">${required}</td>`;
    html += `<td style="border:1px solid #666;padding:4px 6px;text-align:center">${worked}</td>`;
    html += `<td style="border:1px solid #666;padding:4px 6px;text-align:center">${totalNight}</td>`;
    html += `<td style="border:1px solid #666;padding:4px 6px;text-align:center">${extra}</td>`;
    html += `<td style="border:1px solid #666;padding:4px 6px;text-align:center">${holiday}</td>`;
    html += `<td style="border:1px solid #666;padding:4px 6px;text-align:center;color:${statusColor};font-weight:600">${status}</td>`;
    html += `</tr>`;
  });

  html += `</tbody></table>`;
  return html;
}
