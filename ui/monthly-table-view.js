import { getWeeks, isWeekend, isHoliday, t } from '../utils.js';
import { getPersonnelList, getPersonnelType, getTotalNightHours, getMonthlyTotal } from '../state.js';
import { showEdit, showDelete } from './modal-view.js';
import { icon } from './icons.js';

const WEEKLY_HOURS = { worker: 45, civil: 40 };

function getDailyRequired(type) {
  return (WEEKLY_HOURS[type] || 45) / 6;
}

export function renderMonthlyTable(container, onUpdate) {
  if (!container) return;
  const personnel = getPersonnelList();
  const allDays = getWeeks().flatMap(w => w.days).filter(d => !isWeekend(d) && !isHoliday(d));

  let html = `<table class="monthly-table"><thead><tr>
    <th class="name-col">${t('app.nameCol')}</th>
    <th>${t('app.monthlyRequired')}</th>
    <th>${t('app.monthlyWorked')}</th>
    <th>${t('app.monthlyNightOvertime')}</th>
    <th>${t('app.monthlyOvertime')}</th>
    <th>${t('app.monthlyHoliday')}</th>
    <th>${t('app.monthlyStatus')}</th>
    <th style="width:70px"></th>
  </tr></thead><tbody>`;

  personnel.forEach(name => {
    const pType = getPersonnelType(name) || 'worker';
    const required = Math.round(allDays.length * getDailyRequired(pType));
    const worked = getMonthlyTotal(name, 'worked');
    const extra = getMonthlyTotal(name, 'extra');
    const holiday = getMonthlyTotal(name, 'holiday');
    const night = getTotalNightHours(name);
    const diff = worked - required;

    const statusHTML = diff >= 0
      ? `<span style="color:#6ee7b7;font-size:11px">+${diff}s fazla</span>`
      : `<span style="color:#fca5a5;font-size:11px">${diff}s eksik</span>`;

    const typeBadge = pType === 'civil'
      ? `<span style="font-size:9px;padding:2px 5px;border-radius:4px;background:rgba(167,139,250,0.25);color:#c4b5fd;margin-left:6px;vertical-align:middle">${t('modal.typeCivil')}</span>`
      : `<span style="font-size:9px;padding:2px 5px;border-radius:4px;background:rgba(56,189,248,0.2);color:#7dd3fc;margin-left:6px;vertical-align:middle">${t('modal.typeWorker')}</span>`;

    html += `<tr class="row-hover" data-name="${name}">
      <td class="name-td" data-person="${name}" style="cursor:pointer" title="${t('detail.openTooltip')}">${name}${typeBadge}</td>
      <td class="total-cell" data-m-required>${required}</td>
      <td class="total-cell" data-m-worked style="color:${worked >= required ? '#6ee7b7' : '#fca5a5'};font-size:14px">${worked}</td>
      <td class="total-cell" data-m-night style="color:#c4b5fd">${night}</td>
      <td class="total-cell" data-m-extra style="color:#f9a8d4">${extra}</td>
      <td class="total-cell" data-m-holiday style="color:#fde68a">${holiday}</td>
      <td data-m-status>${statusHTML}</td>
      <td style="white-space:nowrap;padding:4px 6px">
        <button class="action-btn" data-edit-m="${name}" title="${t('modal.editTitle')}" aria-label="${t('modal.editTitle')}: ${name}">${icon('pencil')}</button>
        <button class="action-btn action-btn-danger" data-delete-m="${name}" title="${t('modal.deleteTitle')}" aria-label="${t('modal.deleteTitle')}: ${name}">${icon('trash')}</button>
      </td>
    </tr>`;
  });

  html += '</tbody></table>';
  container.innerHTML = html;

  container.querySelectorAll('[data-edit-m]').forEach(btn => {
    btn.addEventListener('click', () => showEdit(btn.dataset.editM));
  });
  container.querySelectorAll('[data-delete-m]').forEach(btn => {
    btn.addEventListener('click', () => showDelete(btn.dataset.deleteM));
  });
}
