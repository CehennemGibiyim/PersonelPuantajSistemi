import { MONTHS_TR, setPeriod, getYear, getMonth, t } from '../utils.js';

export function renderMonthSelector(container, onMonthChange) {
  const year = getYear();
  const month = getMonth();
  const now = new Date();
  const currentYear = now.getFullYear();

  const monthOptions = MONTHS_TR.map((m, i) =>
    `<option value="${i}" ${i === month ? 'selected' : ''}>${m}</option>`
  ).join('');

  const years = [];
  for (let y = currentYear - 30; y <= currentYear + 30; y++) {
    years.push(y);
  }
  const yearOptions = years.map(y =>
    `<option value="${y}" ${y === year ? 'selected' : ''}>${y}</option>`
  ).join('');

  container.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      <label class="modal-label" for="monthSelect" style="margin:0;color:rgba(255,255,255,0.7)">${t('app.monthLabel')}</label>
      <select id="monthSelect" class="day-input" style="width:auto;min-width:100px;padding:6px 10px;font-size:13px;color:#fff;background:rgba(255,255,255,0.12);border-color:rgba(255,255,255,0.2)">${monthOptions}</select>
      <select id="yearSelect" class="day-input" style="width:auto;min-width:70px;padding:6px 10px;font-size:13px;color:#fff;background:rgba(255,255,255,0.12);border-color:rgba(255,255,255,0.2)">${yearOptions}</select>
    </div>
  `;

  const monthSelect = container.querySelector('#monthSelect');
  const yearSelect = container.querySelector('#yearSelect');

  const handleChange = () => {
    const newMonth = parseInt(monthSelect.value);
    const newYear = parseInt(yearSelect.value);
    setPeriod(newYear, newMonth);
    onMonthChange();
  };

  monthSelect.addEventListener('change', handleChange);
  yearSelect.addEventListener('change', handleChange);
}
