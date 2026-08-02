import { getPersonnelList, getDutyRecords, getDutyColumns, setDutyColumns, setDutyAssignment, removeDutyColumn, canEdit } from '../state.js';
import { updateDutyColumnLabels } from '../duty-state.js';
import { getDaysInMonth, getMonth, getDayName, isWeekend, isSaturday, isHoliday, t } from '../utils.js';
import { showToast } from './toast-view.js';
import { doDutyPrint } from './duty-print-view.js?v=8';
import { esc, columnKey, effectiveColumns, formatColumn, hoursForShift, recordMatchesColumn } from './duty-roster-utils.js?v=5';

const num = value => Number(value) || 0;

function metrics(records) {
  return records.reduce((sum, item) => {
    sum.count += 1;
    sum.gross += num(item.grossHours ?? item.hours);
    sum.net += num(item.netHours ?? item.hours);
    sum.night += num(item.netNightHours ?? item.nightHours);
    sum.extra += num(item.extraNetHours ?? item.extraHours);
    return sum;
  }, { count: 0, gross: 0, net: 0, night: 0, extra: 0 });
}

function card(label, value, accent = false) {
  return `<div class="duty-summary-card${accent ? ' accent' : ''}"><strong>${esc(value)}</strong><span>${esc(label)}</span></div>`;
}

function recordFor(records, day, column) {
  return records.find(item => Number(item.day) === day && recordMatchesColumn(item, column));
}

function recalculateColumnRecords(columnKey, service, shiftLabel) {
  getDutyRecords().forEach(item => {
    const itemKey = String(item.columnKey || '').trim();
    const matchesKey = itemKey === String(columnKey || '');
    const matchesLegacyLabel = !itemKey
      && String(item.service || '').trim() === String(service || '').trim()
      && String(item.shiftLabel || '').trim() === String(shiftLabel || '').trim();
    if (!matchesKey && !matchesLegacyLabel) return;
    const calculated = hoursForShift(shiftLabel, isHoliday(item.day));
    Object.assign(item, calculated, {
      hours: calculated.netHours,
      nightHours: calculated.netNightHours,
      extraHours: calculated.extraHours,
      extraNetHours: calculated.extraNetHours,
      holidayHours: calculated.netHolidayHours,
      netHolidayHours: calculated.netHolidayHours
    });
  });
}

function rosterDayClasses(day) {
  const classes = [];
  if (isHoliday(day)) classes.push('duty-holiday-row');
  if (isSaturday(day)) classes.push('duty-saturday-row');
  if (isWeekend(day)) classes.push('duty-sunday-row', 'duty-weekend-row');
  return classes.join(' ');
}

function personSelect(personnel, selected, day, column, disabled) {
  const options = [`<option value="">—</option>`, ...personnel.map(name => `<option value="${esc(name)}"${name === selected ? ' selected' : ''}>${esc(name)}</option>`)].join('');
  return `<select class="duty-cell-select" data-duty-day="${day}" data-duty-column="${esc(column.key)}" aria-label="${esc(`${day} ${formatColumn(column)}`)}"${disabled ? ' disabled' : ''}>${options}</select>`;
}

function rosterTable(personnel, records, columns, editable) {
  const rows = [];
  for (let day = 1; day <= getDaysInMonth(); day += 1) {
    const classes = rosterDayClasses(day);
    rows.push(`<tr${classes ? ` class="${classes}"` : ''}><td class="duty-roster-date">${day}.${String(getMonth() + 1).padStart(2, '0')}</td><td class="duty-roster-day">${esc(getDayName(day))}</td>${columns.map(column => { const item = recordFor(records, day, column); return `<td>${personSelect(personnel, item?.person || '', day, column, !editable)}</td>`; }).join('')}</tr>`);
  }
  return `<section class="glass duty-roster-card"><div class="duty-section-heading"><div><h3>${t('dutySystem.rosterTitle')}</h3><p>${t('dutySystem.rosterHint')}</p></div><span class="duty-record-count">${records.length}</span></div><div class="duty-roster-wrap"><table class="duty-roster-table"><thead><tr><th>${t('dutySystem.printDate')}</th><th>${t('dutySystem.printDay')}</th>${columns.map(column => `<th>${esc(formatColumn(column))}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div></section>`;
}

function columnEditor(columns, editable) {
  const items = columns.map((column, index) => `<div class="duty-column-row" data-duty-column-row="${esc(column.key)}"><span class="duty-column-order">${esc(t('dutySystem.columnPosition', { position: index + 1 }))}</span><span class="duty-column-info"><strong>${esc(column.service)}</strong><small>${esc(column.shiftLabel)}</small></span><div class="duty-column-actions"><button class="action-btn" data-duty-column-edit="${esc(column.key)}" aria-label="${t('dutySystem.editColumn')}" title="${t('dutySystem.editColumn')}"${editable ? '' : ' disabled'}>✎</button><button class="action-btn" data-duty-column-move="${esc(column.key)}" data-duty-column-direction="up" aria-label="${t('dutySystem.moveColumnUp')}" title="${t('dutySystem.moveColumnUp')}"${!editable || index === 0 ? ' disabled' : ''}>↑</button><button class="action-btn" data-duty-column-move="${esc(column.key)}" data-duty-column-direction="down" aria-label="${t('dutySystem.moveColumnDown')}" title="${t('dutySystem.moveColumnDown')}"${!editable || index === columns.length - 1 ? ' disabled' : ''}>↓</button><button class="action-btn action-btn-danger" data-duty-column-remove="${esc(column.key)}" aria-label="${t('dutySystem.removeColumn')}"${editable ? '' : ' style="display:none"'}>×</button></div></div>`).join('');
  return `<section class="glass duty-columns-card"><div class="duty-section-heading"><div><h3>${t('dutySystem.columnsTitle')}</h3><p>${t('dutySystem.columnsHint')}</p></div></div><div class="duty-column-form"><label>${t('dutySystem.service')}<input class="modal-input" id="dutyColumnService" placeholder="${t('dutySystem.servicePlaceholder')}"${editable ? '' : ' disabled'}></label><label>${t('dutySystem.shiftLabel')}<input class="modal-input" id="dutyColumnShift" placeholder="${t('dutySystem.shiftPlaceholder')}"${editable ? '' : ' disabled'}></label><button class="btn btn-primary" id="dutyColumnAdd"${editable ? '' : ' disabled'}>${t('dutySystem.addColumn')}</button></div><div class="duty-column-list">${items}</div></section>`;
}

export function renderDutySystem(container, onUpdate = () => {}) {
  const personnel = getPersonnelList();
  const records = getDutyRecords();
  const savedColumns = getDutyColumns();
  const columns = effectiveColumns(savedColumns, records);
  if (!savedColumns.length) setDutyColumns(columns);
  const totals = metrics(records);
  const editable = canEdit();

  container.innerHTML = `<div class="duty-system"><div class="duty-hero"><div><span class="eyebrow">${t('app.dutySystem')}</span><h2>${t('dutySystem.pageTitle')}</h2><p>${t('dutySystem.pageHint')}</p></div><button class="btn duty-print-btn" id="dutyPrintBtn">🖨️ ${t('dutySystem.printRoster')}</button></div><div class="duty-summary">${card(t('dutySystem.totalRecords'), totals.count, true)}${card(t('dutySystem.totalGross'), `${totals.gross}${t('advanced.grossShort')}`)}${card(t('dutySystem.totalNet'), `${totals.net}${t('advanced.workedShort')}`, true)}${card(t('dutySystem.totalNight'), `${totals.night}${t('advanced.nightShort')}`)}${card(t('dutySystem.totalExtra'), `${totals.extra}${t('advanced.extraShort')}`)}</div>${personnel.length ? columnEditor(columns, editable) : `<section class="glass duty-no-personnel"><strong>${t('dutySystem.noPersonnel')}</strong><p>${t('dutySystem.noPersonnelHint')}</p></section>`}${personnel.length ? rosterTable(personnel, records, columns, editable) : ''}</div>`;

  container.querySelector('#dutyPrintBtn')?.addEventListener('click', doDutyPrint);
  container.querySelector('#dutyColumnAdd')?.addEventListener('click', () => {
    const service = container.querySelector('#dutyColumnService').value.trim();
    const shiftLabel = container.querySelector('#dutyColumnShift').value.trim();
    if (!service || !shiftLabel) return showToast(t('dutySystem.columnRequired'), 'error');
    const key = columnKey(service, shiftLabel);
    if (columns.some(column => column.key === key)) return showToast(t('dutySystem.columnExists'), 'error');
    setDutyColumns([...columns, { key, service, shiftLabel }]);
    onUpdate();
    showToast(t('dutySystem.columnAdded'), 'success');
  });

  container.querySelectorAll('[data-duty-column-edit]').forEach(button => button.addEventListener('click', () => {
    const key = button.dataset.dutyColumnEdit;
    const column = columns.find(item => item.key === key);
    const row = button.closest('[data-duty-column-row]');
    if (!column || !row) return;
    row.innerHTML = `<span class="duty-column-order">${esc(t('dutySystem.columnPosition', { position: columns.indexOf(column) + 1 }))}</span><div class="duty-column-edit-form"><input class="modal-input duty-column-edit-service" value="${esc(column.service)}" aria-label="${esc(t('dutySystem.service'))}"><input class="modal-input duty-column-edit-shift" value="${esc(column.shiftLabel)}" aria-label="${esc(t('dutySystem.shiftLabel'))}"><div class="duty-column-edit-actions"><button class="btn btn-primary" data-duty-column-save="${esc(key)}">${t('dutySystem.saveColumn')}</button><button class="btn" data-duty-column-cancel>${t('dutySystem.cancelColumnEdit')}</button></div></div>`;
    row.classList.add('is-editing');
    row.querySelector('.duty-column-edit-service')?.focus();
    row.querySelector('[data-duty-column-save]')?.addEventListener('click', () => {
      const service = row.querySelector('.duty-column-edit-service')?.value.trim() || '';
      const shiftLabel = row.querySelector('.duty-column-edit-shift')?.value.trim() || '';
      if (!service || !shiftLabel) return showToast(t('dutySystem.columnRequired'), 'error');
      if (columns.some(item => item.key !== key && item.service === service && item.shiftLabel === shiftLabel)) return showToast(t('dutySystem.columnExists'), 'error');
      if (!updateDutyColumnLabels(key, service, shiftLabel)) return showToast(t('dutySystem.columnUpdateFailed'), 'error');
      recalculateColumnRecords(key, service, shiftLabel);
      const updatedColumns = columns.map(item => item.key === key ? { ...item, service, shiftLabel } : item);
      setDutyColumns(updatedColumns);
      onUpdate();
      showToast(t('dutySystem.columnUpdated'), 'success');
    });
    row.querySelector('[data-duty-column-cancel]')?.addEventListener('click', onUpdate);
  }));

  container.querySelectorAll('[data-duty-column-move]').forEach(button => button.addEventListener('click', () => {
    const index = columns.findIndex(column => column.key === button.dataset.dutyColumnMove);
    const direction = button.dataset.dutyColumnDirection === 'up' ? -1 : 1;
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= columns.length) return;
    const reordered = [...columns];
    [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];
    setDutyColumns(reordered);
    onUpdate();
    showToast(t('dutySystem.columnMoved'), 'success');
  }));

  container.querySelectorAll('[data-duty-column-remove]').forEach(button => button.addEventListener('click', () => {
    if (columns.length <= 1) return showToast(t('dutySystem.cannotRemoveLastColumn'), 'error');
    removeDutyColumn(button.dataset.dutyColumnRemove);
    onUpdate();
    showToast(t('dutySystem.columnRemoved'), 'success');
  }));

  container.querySelectorAll('.duty-cell-select').forEach(select => select.addEventListener('change', event => {
    const day = Number(event.target.dataset.dutyDay);
    const column = columns.find(item => item.key === event.target.dataset.dutyColumn);
    if (!column) return;
    const calculated = hoursForShift(column.shiftLabel, isHoliday(day));
    const ok = setDutyAssignment({ person: event.target.value, day, columnKey: column.key, service: column.service, shiftLabel: column.shiftLabel, ...calculated });
    if (!ok) return showToast(t('advanced.dutyInvalid'), 'error');
    onUpdate();
    showToast(t('dutySystem.assignmentSaved'), 'success');
  }));
}
