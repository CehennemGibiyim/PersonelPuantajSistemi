import { getWeeks, getDayName, isWeekend, isSaturday, isHoliday, t } from '../utils.js';
import { getPersonnelList, getCurrentWeek, getScheduleData, getDutyRecords, updateShift, getPersonnelType, getNightHours, setNightHours, getTotalNightHours, getWeeklyTotal, setWeeklyTotal, getMonthlyTotal } from '../state.js';
import { showEdit, showDelete } from './modal-view.js';
import { icon } from './icons.js';
import { punchCodeForDuty, punchLabelForDuty } from './duty-roster-utils.js?v=5';

const WEEKLY_HOURS = { worker: 45, civil: 40 };

function getDailyRequired(type) {
  return (WEEKLY_HOURS[type] || 45) / 6;
}

function getRequired(days, type) {
  const eligible = days.filter(d => !isWeekend(d) && !isHoliday(d)).length;
  return Math.round(eligible * getDailyRequired(type));
}

function dayClasses(day) {
  const classes = [];
  if (isHoliday(day)) classes.push('holiday');
  if (isSaturday(day)) classes.push('saturday');
  if (isWeekend(day)) classes.push('sunday', 'weekend');
  return classes.join(' ');
}

function toNum(v) {
  const n = parseInt(String(v).trim(), 10);
  return isNaN(n) ? 0 : n;
}

function safeText(selector, value, root = document) {
  const el = root.querySelector(selector);
  if (el) el.textContent = value;
}

function safeValue(selector, value, root = document) {
  const el = root.querySelector(selector);
  if (el) el.value = value ?? '';
}

function dutyRecordFor(records, name, day) {
  return records.find(item => item.person === name && Number(item.day) === Number(day));
}

function punchValueFor(records, schedule, name, day) {
  const duty = dutyRecordFor(records, name, day);
  return duty ? punchCodeForDuty(duty) : ((schedule[name] && schedule[name][day]) || '');
}

function refreshRow(row, days) {
  if (!row) return;
  const name = row.dataset.name;
  if (!name) return;
  const pType = getPersonnelType(name) || 'worker';
  const required = getRequired(days, pType);

  const worked = getWeeklyTotal(name, getCurrentWeek(), 'worked');
  const extra = getWeeklyTotal(name, getCurrentWeek(), 'extra');
  const holiday = getWeeklyTotal(name, getCurrentWeek(), 'holiday');
  const night = getNightHours(name, getCurrentWeek());

  safeValue('[data-input-worked]', worked || '', row);
  safeValue('[data-input-extra]', extra || '', row);
  safeValue('[data-input-holiday]', holiday || '', row);
  safeValue('[data-input-night]', night || '', row);

  safeText('[data-stat-required]', required, row);
  safeText('[data-stat-worked-label]', worked, row);
  safeText('[data-stat-night-label]', night, row);
  safeText('[data-stat-extra-label]', extra, row);
  safeText('[data-stat-holiday-label]', holiday, row);

  const diffEl = row.querySelector('[data-stat-diff]');
  if (diffEl) {
    const diff = worked - required;
    diffEl.textContent = diff >= 0 ? `+${diff}` : `${diff}`;
    diffEl.style.color = diff >= 0 ? '#6ee7b7' : '#fca5a5';
  }

  refreshMonthlyRow(name);
}

function refreshMonthlyRow(name) {
  try {
    const monthlyContainer = document.getElementById('monthlyContainer');
    if (!monthlyContainer) return;
    const row = monthlyContainer.querySelector(`tr[data-name="${name}"]`);
    if (!row) return;

    const pType = getPersonnelType(name) || 'worker';
    const allDaysCount = getWeeks().flatMap(w => w.days).filter(d => !isWeekend(d) && !isHoliday(d)).length;
    const required = Math.round(allDaysCount * getDailyRequired(pType));
    const worked = getMonthlyTotal(name, 'worked');
    const extra = getMonthlyTotal(name, 'extra');
    const holiday = getMonthlyTotal(name, 'holiday');
    const night = getTotalNightHours(name);
    const diff = worked - required;

    safeText('[data-m-required]', required, row);
    safeText('[data-m-worked]', worked, row);
    safeText('[data-m-night]', night, row);
    safeText('[data-m-extra]', extra, row);
    safeText('[data-m-holiday]', holiday, row);

    const statusEl = row.querySelector('[data-m-status]');
    if (statusEl) {
      statusEl.innerHTML = diff >= 0
        ? `<span style="color:#6ee7b7;font-size:11px">+${diff}s fazla</span>`
        : `<span style="color:#fca5a5;font-size:11px">${diff}s eksik</span>`;
    }
  } catch (e) {
    console.error('refreshMonthlyRow error', e);
  }
}

function refreshStats() {
  try {
    const container = document.getElementById('statsRow');
    if (!container) return;

    const personnel = getPersonnelList();
    let totalWorked = 0, totalNight = 0, totalExtra = 0, totalHoliday = 0;

    personnel.forEach(name => {
      totalWorked += getMonthlyTotal(name, 'worked');
      totalExtra += getMonthlyTotal(name, 'extra');
      totalHoliday += getMonthlyTotal(name, 'holiday');
      totalNight += getTotalNightHours(name);
    });

    container.innerHTML = `
      <div class="stat-card glass"><div class="stat-num">${personnel.length}</div><div class="stat-label">${t('app.personnel')}</div></div>
      <div class="stat-card glass"><div class="stat-num">${totalWorked}</div><div class="stat-label">${t('app.totalHours')}</div></div>
      <div class="stat-card glass"><div class="stat-num">${totalNight}</div><div class="stat-label">${t('app.nightShift')}</div></div>
      <div class="stat-card glass"><div class="stat-num">${totalExtra}</div><div class="stat-label">${t('app.overtime')}</div></div>
      <div class="stat-card glass"><div class="stat-num">${totalHoliday}</div><div class="stat-label">${t('app.holiday')}</div></div>
    `;
  } catch (e) {
    console.error('refreshStats error', e);
  }
}

export function renderWeekTable(tableContainer, weekLabel, onUpdate) {
  if (!tableContainer || !weekLabel) return;
  const week = getCurrentWeek();

  if (week < 0) {
    tableContainer.innerHTML = '';
    weekLabel.style.display = 'none';
    return;
  }

  const weeks = getWeeks();
  const wk = weeks[week];
  if (!wk) { tableContainer.innerHTML = ''; weekLabel.style.display = 'none'; return; }

  weekLabel.textContent = `${wk.label} — ${wk.days[0]}-${wk.days[wk.days.length - 1]}. günler`;
  weekLabel.style.display = 'block';

  const personnel = getPersonnelList();
  const days = wk.days;

  if (window.innerWidth <= 768) {
    renderMobileCardView(tableContainer, weekLabel, week, wk, personnel, days);
    return;
  }

  let html = `<table><thead><tr>
    <th class="name-col">${t('app.nameCol')}</th>
    ${days.map(d => `<th class="day-head ${dayClasses(d)}">${d}<br><span style="font-size:10px;opacity:0.6">${getDayName(d)}</span></th>`).join('')}
    <th class="week-divider" style="color:#7dd3fc">${t('app.required')}<br><span style="font-size:10px">${t('app.hoursSuffix')}</span></th>
    <th style="color:#7dd3fc">${t('app.worked')}<br><span style="font-size:10px">${t('app.hoursSuffix')}</span></th>
    <th style="color:#a78bfa">${t('app.night')}<br><span style="font-size:10px">${t('app.hoursSuffix')}</span></th>
    <th style="color:#f9a8d4">${t('app.extra')}<br><span style="font-size:10px">${t('app.hoursSuffix')}</span></th>
    <th style="color:#fcd34d">${t('app.holiday')}<br><span style="font-size:10px">${t('app.hoursSuffix')}</span></th>
    <th style="width:70px"></th>
  </tr></thead><tbody>`;

  personnel.forEach(name => {
    const pType = getPersonnelType(name) || 'worker';
    const required = getRequired(days, pType);
    const nightVal = getNightHours(name, week);
    const workedVal = getWeeklyTotal(name, week, 'worked');
    const extraVal = getWeeklyTotal(name, week, 'extra');
    const holidayVal = getWeeklyTotal(name, week, 'holiday');
    const typeBadge = pType === 'civil'
      ? `<span style="font-size:9px;padding:2px 5px;border-radius:4px;background:rgba(167,139,250,0.25);color:#c4b5fd;margin-left:6px;vertical-align:middle">${t('modal.typeCivil')}</span>`
      : `<span style="font-size:9px;padding:2px 5px;border-radius:4px;background:rgba(56,189,248,0.2);color:#7dd3fc;margin-left:6px;vertical-align:middle">${t('modal.typeWorker')}</span>`;

    html += `<tr class="row-hover" data-name="${name}"><td class="name-td" data-person="${name}" style="cursor:pointer" title="${t('detail.openTooltip')}">${name}${typeBadge}</td>`;

    days.forEach(d => {
      const cls = dayClasses(d);
      html += `<td><input class="day-input ${cls}" value=""
        data-name="${name}" data-day="${d}"
        title="${d} ${getDayName(d)}"
        aria-label="${name} – ${d} ${getDayName(d)}"
        maxlength="5" placeholder="${t('app.shiftInputPlaceholder')}"></td>`;
    });

    html += `
      <td class="sum-cell week-divider" data-stat-required>${required}</td>
      <td class="sum-cell"><span data-stat-worked-label>${workedVal}</span><br><input class="day-input" data-input-worked value="${workedVal || ''}" placeholder="0" style="color:#7dd3fc;width:46px"></td>
      <td class="sum-cell"><span data-stat-night-label>${nightVal}</span><br><input class="day-input" data-input-night type="text" value="${nightVal || ''}" placeholder="0" style="color:#c4b5fd;width:42px;border-color:rgba(167,139,250,0.3)"></td>
      <td class="sum-cell"><span data-stat-extra-label>${extraVal}</span><br><input class="day-input" data-input-extra value="${extraVal || ''}" placeholder="0" style="color:#f9a8d4;width:42px"></td>
      <td class="sum-cell"><span data-stat-holiday-label>${holidayVal}</span><br><input class="day-input" data-input-holiday value="${holidayVal || ''}" placeholder="0" style="color:#fde68a;width:42px"></td>
      <td style="white-space:nowrap;padding:4px 6px">
        <button class="action-btn" data-edit="${name}" title="${t('modal.editTitle')}" aria-label="${t('modal.editTitle')}: ${name}">${icon('pencil')}</button>
        <button class="action-btn action-btn-danger" data-delete="${name}" title="${t('modal.deleteTitle')}" aria-label="${t('modal.deleteTitle')}: ${name}">${icon('trash')}</button>
      </td>
    </tr>`;
  });

  html += '</tbody></table>';
  tableContainer.innerHTML = html;

  // Vardiya kodlarını state'den doldur (görsel amaçlı)
  const schedule = getScheduleData();
  const dutyRecords = getDutyRecords();
  personnel.forEach(name => {
    days.forEach(d => {
      const input = tableContainer.querySelector(`.day-input[data-name="${name}"][data-day="${d}"]`);
      const duty = dutyRecordFor(dutyRecords, name, d);
      if (input) {
        input.value = punchValueFor(dutyRecords, schedule, name, d);
        if (duty) input.title = `${d} ${getDayName(d)} — ${punchLabelForDuty(duty, true)}`;
      }
    });
  });

  // Vardiya kodu inputları — saatleri otomatik hesapla
  tableContainer.querySelectorAll('.day-input[data-day]').forEach(input => {
    input.addEventListener('input', () => {
      const name = input.dataset.name;
      const day = parseInt(input.dataset.day);
      const value = input.value.toUpperCase();
      input.value = value;
      updateShift(name, day, value);
      refreshRow(input.closest('tr'), days);
      refreshStats();
    });
  });

  // Manuel saat düzeltmeleri — otomatik hesaplamanın üzerine yazılabilir
  ['worked', 'extra', 'holiday'].forEach(field => {
    tableContainer.querySelectorAll(`[data-input-${field}]`).forEach(input => {
      input.addEventListener('input', () => {
        input.value = input.value.replace(',', '.').replace(/[^0-9.]/g, '');
        const row = input.closest('tr');
        const name = row?.dataset?.name;
        if (!name) return;
        setWeeklyTotal(name, week, field, input.value);
        refreshRow(row, days);
        refreshStats();
      });
    });
  });

  // Gece mesai saatleri (manuel)
  tableContainer.querySelectorAll('[data-input-night]').forEach(input => {
    input.addEventListener('input', () => {
      input.value = input.value.replace(/[^0-9]/g, '');
      const row = input.closest('tr');
      const name = row?.dataset?.name;
      if (!name) return;
      setNightHours(name, week, input.value);
      refreshMonthlyRow(name);
      refreshStats();
    });
  });

  tableContainer.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => showEdit(btn.dataset.edit));
  });
  tableContainer.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => showDelete(btn.dataset.delete));
  });

  personnel.forEach(name => {
    const row = tableContainer.querySelector(`tr[data-name="${name}"]`);
    if (row) refreshRow(row, days);
  });
  refreshStats();
}

function renderMobileCardView(tableContainer, weekLabel, week, wk, personnel, days) {
  weekLabel.textContent = `${wk.label} — ${wk.days[0]}-${wk.days[wk.days.length - 1]}. günler`;
  weekLabel.style.display = 'block';

  let html = '<div class="mobile-cards">';

  personnel.forEach(name => {
    const pType = getPersonnelType(name) || 'worker';
    const required = getRequired(days, pType);
    const nightVal = getNightHours(name, week);
    const workedVal = getWeeklyTotal(name, week, 'worked');
    const extraVal = getWeeklyTotal(name, week, 'extra');
    const holidayVal = getWeeklyTotal(name, week, 'holiday');
    const typeBadge = pType === 'civil'
      ? `<span class="mobile-badge mobile-badge-civil">${t('modal.typeCivil')}</span>`
      : `<span class="mobile-badge mobile-badge-worker">${t('modal.typeWorker')}</span>`;

    html += `
      <div class="mobile-card" data-name="${name}">
        <div class="mobile-card-header" data-person="${name}">
          <span class="mobile-card-name">${name}</span>
          ${typeBadge}
        </div>
        <div class="mobile-card-days">
          ${days.map(d => {
            const cls = dayClasses(d);
            return `
              <div class="mobile-day">
                <span class="mobile-day-label ${cls}">${d}<br>${getDayName(d)}</span>
                <input class="day-input ${cls}" value=""
                  data-name="${name}" data-day="${d}"
                  title="${d} ${getDayName(d)}"
                  aria-label="${name} – ${d} ${getDayName(d)}"
                  maxlength="5" placeholder="${t('app.shiftInputPlaceholder')}">
              </div>
            `;
          }).join('')}
        </div>
        <div class="mobile-card-stats">
          <div class="mobile-stat"><span>${t('app.required')}</span><strong data-stat-required>${required}</strong></div>
          <div class="mobile-stat"><span>${t('app.worked')}</span><input class="day-input" data-input-worked value="${workedVal || ''}" placeholder="0"></div>
          <div class="mobile-stat"><span>${t('app.night')}</span><input class="day-input" data-input-night value="${nightVal || ''}" placeholder="0"></div>
          <div class="mobile-stat"><span>${t('app.extra')}</span><input class="day-input" data-input-extra value="${extraVal || ''}" placeholder="0"></div>
          <div class="mobile-stat"><span>${t('app.holiday')}</span><input class="day-input" data-input-holiday value="${holidayVal || ''}" placeholder="0"></div>
        </div>
        <div class="mobile-card-actions">
          <button class="btn" data-edit="${name}">${t('modal.editTitle')}</button>
          <button class="btn action-btn-danger" data-delete="${name}">${t('modal.deleteTitle')}</button>
        </div>
      </div>
    `;
  });

  html += '</div>';
  tableContainer.innerHTML = html;

  const schedule = getScheduleData();
  const dutyRecords = getDutyRecords();
  personnel.forEach(name => {
    days.forEach(d => {
      const input = tableContainer.querySelector(`.day-input[data-name="${name}"][data-day="${d}"]`);
      const duty = dutyRecordFor(dutyRecords, name, d);
      if (input) {
        input.value = punchValueFor(dutyRecords, schedule, name, d);
        if (duty) input.title = `${d} ${getDayName(d)} — ${punchLabelForDuty(duty, true)}`;
      }
    });
  });

  tableContainer.querySelectorAll('.day-input[data-day]').forEach(input => {
    input.addEventListener('input', () => {
      const name = input.dataset.name;
      const day = parseInt(input.dataset.day);
      const value = input.value.toUpperCase();
      input.value = value;
      updateShift(name, day, value);
      refreshMobileCard(input.closest('.mobile-card'), days);
      refreshStats();
    });
  });

  ['worked', 'extra', 'holiday'].forEach(field => {
    tableContainer.querySelectorAll(`[data-input-${field}]`).forEach(input => {
      input.addEventListener('input', () => {
        input.value = input.value.replace(',', '.').replace(/[^0-9.]/g, '');
        const card = input.closest('.mobile-card');
        const name = card?.dataset?.name;
        if (!name) return;
        setWeeklyTotal(name, week, field, input.value);
        refreshMobileCard(card, days);
        refreshStats();
      });
    });
  });

  tableContainer.querySelectorAll('[data-input-night]').forEach(input => {
    input.addEventListener('input', () => {
      input.value = input.value.replace(/[^0-9]/g, '');
      const card = input.closest('.mobile-card');
      const name = card?.dataset?.name;
      if (!name) return;
      setNightHours(name, week, input.value);
      refreshMobileCard(card, days);
      refreshMonthlyRow(name);
      refreshStats();
    });
  });

  tableContainer.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => showEdit(btn.dataset.edit));
  });
  tableContainer.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => showDelete(btn.dataset.delete));
  });

  personnel.forEach(name => {
    const card = tableContainer.querySelector(`.mobile-card[data-name="${name}"]`);
    if (card) refreshMobileCard(card, days);
  });
  refreshStats();
}

function refreshMobileCard(card, days) {
  if (!card) return;
  const name = card.dataset.name;
  const pType = getPersonnelType(name) || 'worker';
  const required = getRequired(days, pType);
  safeText('[data-stat-required]', required, card);
  const week = getCurrentWeek();
  safeValue('[data-input-worked]', getWeeklyTotal(name, week, 'worked') || '', card);
  safeValue('[data-input-extra]', getWeeklyTotal(name, week, 'extra') || '', card);
  safeValue('[data-input-holiday]', getWeeklyTotal(name, week, 'holiday') || '', card);
  safeValue('[data-input-night]', getNightHours(name, week) || '', card);
  refreshMonthlyRow(name);
}
