import { MONTHS_TR, setPeriod, getYear, getMonth, getCurrentPeriod, isCurrentPeriod, t } from '../utils.js';

function optionMarkup(values, selected, formatter = value => value) {
  return values.map(value => {
    const optionValue = typeof value === 'number' ? value : String(value);
    return `<option value="${optionValue}" ${value === selected ? 'selected' : ''}>${formatter(value)}</option>`;
  }).join('');
}

export function renderMonthSelector(container, onMonthChange) {
  if (!container) return;
  const year = getYear();
  const month = getMonth();
  const current = getCurrentPeriod();
  const selectedLabel = `${MONTHS_TR[month]} ${year}`;
  const monthLabel = t('app.monthOnlyLabel');
  const periodLabel = t('app.periodLabel');
  const months = MONTHS_TR.map((_, index) => index);
  const monthOptions = optionMarkup(months, month, index => MONTHS_TR[index]);
  const years = [];
  for (let y = current.year - 30; y <= current.year + 30; y += 1) years.push(y);
  const yearOptions = optionMarkup(years, year);

  container.innerHTML = `
    <div class="period-selector" role="group" aria-label="${periodLabel}">
      <div class="period-selector-heading">
        <span class="period-selector-kicker">${periodLabel}</span>
        <span class="period-selector-current">${selectedLabel}</span>
      </div>
      <div class="period-selector-menu">
        <label class="period-choice" for="monthSelect">
          <span>${monthLabel}</span>
          <select id="monthSelect" class="day-input" aria-label="${monthLabel}">${monthOptions}</select>
        </label>
        <label class="period-choice" for="yearSelect">
          <span>${t('app.yearLabel')}</span>
          <select id="yearSelect" class="day-input" aria-label="${t('app.yearLabel')}">${yearOptions}</select>
        </label>
        <button id="currentPeriodBtn" class="period-current-btn" type="button" ${isCurrentPeriod(year, month) ? 'disabled' : ''}>${t('app.currentPeriodBtn')}</button>
      </div>
    </div>
  `;

  const monthSelect = container.querySelector('#monthSelect');
  const yearSelect = container.querySelector('#yearSelect');
  const currentPeriodBtn = container.querySelector('#currentPeriodBtn');
  const handleChange = () => {
    const newMonth = Number.parseInt(monthSelect?.value, 10);
    const newYear = Number.parseInt(yearSelect?.value, 10);
    if (!Number.isInteger(newMonth) || !Number.isInteger(newYear)) return;
    if (!isCurrentPeriod(newYear, newMonth) && !window.confirm(t('app.periodChangeConfirm'))) {
      renderMonthSelector(container, onMonthChange);
      return;
    }
    setPeriod(newYear, newMonth);
    renderMonthSelector(container, onMonthChange);
    onMonthChange();
  };

  monthSelect?.addEventListener('change', handleChange);
  yearSelect?.addEventListener('change', handleChange);
  currentPeriodBtn?.addEventListener('click', () => {
    setPeriod(current.year, current.month);
    renderMonthSelector(container, onMonthChange);
    onMonthChange();
  });
}
