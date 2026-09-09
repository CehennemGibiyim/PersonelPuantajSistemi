import { MONTHS_TR, setPeriod, getYear, getMonth, getCurrentPeriod, isCurrentPeriod, t } from '../utils.js';

export function renderMonthSelector(container, onMonthChange) {
  const year = getYear();
  const month = getMonth();
  const current = getCurrentPeriod();
  const currentLabel = `${MONTHS_TR[current.month]} ${current.year}`;

  const monthOptions = MONTHS_TR.map((m, i) =>
    `<option value="${i}" ${i === month ? 'selected' : ''}>${m}</option>`
  ).join('');

  const years = [];
  for (let y = current.year - 30; y <= current.year + 30; y++) {
    years.push(y);
  }
  const yearOptions = years.map(y =>
    `<option value="${y}" ${y === year ? 'selected' : ''}>${y}</option>`
  ).join('');

  container.innerHTML = `
    <div class="period-selector">
      <div class="period-selector-row">
        <label class="modal-label" for="monthSelect">${t('app.monthLabel')}</label>
        <select id="monthSelect" class="day-input" aria-label="${t('app.monthLabel')}" style="width:auto;min-width:100px;padding:6px 10px;font-size:13px;color:#fff;background:rgba(255,255,255,0.12);border-color:rgba(255,255,255,0.2)">${monthOptions}</select>
        <select id="yearSelect" class="day-input" aria-label="${t('app.yearLabel')}" style="width:auto;min-width:70px;padding:6px 10px;font-size:13px;color:#fff;background:rgba(255,255,255,0.12);border-color:rgba(255,255,255,0.2)">${yearOptions}</select>
        <button id="currentPeriodBtn" class="period-current-btn" type="button" ${isCurrentPeriod(year, month) ? 'disabled' : ''}>${t('app.currentPeriodBtn')}</button>
      </div>
      <span class="period-current-note">${t('app.currentPeriodNote', { period: currentLabel })}</span>
    </div>
  `;

  const monthSelect = container.querySelector('#monthSelect');
  const yearSelect = container.querySelector('#yearSelect');
  const currentPeriodBtn = container.querySelector('#currentPeriodBtn');

  const handleChange = () => {
    const newMonth = parseInt(monthSelect.value, 10);
    const newYear = parseInt(yearSelect.value, 10);
    if (!Number.isInteger(newMonth) || !Number.isInteger(newYear)) return;

    if (!isCurrentPeriod(newYear, newMonth) && !window.confirm(t('app.periodChangeConfirm'))) {
      renderMonthSelector(container, onMonthChange);
      return;
    }

    setPeriod(newYear, newMonth);
    renderMonthSelector(container, onMonthChange);
    onMonthChange();
  };

  monthSelect.addEventListener('change', handleChange);
  yearSelect.addEventListener('change', handleChange);
  currentPeriodBtn?.addEventListener('click', () => {
    setPeriod(current.year, current.month);
    renderMonthSelector(container, onMonthChange);
    onMonthChange();
  });
}
