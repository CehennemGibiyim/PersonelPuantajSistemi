import { getWeeks, t } from '../utils.js';
import { getCurrentWeek, setCurrentWeek } from '../state.js';

export function renderTabs(container, onUpdate) {
  const current = getCurrentWeek();
  const weeks = getWeeks();

  const tabs = weeks.map((w, i) => {
    const cls = i === current ? 'badge-active' : 'badge-inactive';
    return `<button class="badge ${cls}" role="tab" aria-selected="${i === current}" data-week="${i}">
      ${w.label} <span style="opacity:0.6;font-size:10px">(${w.days[0]}–${w.days[w.days.length - 1]})</span>
    </button>`;
  });

  const monthlyCls = current === -1 ? 'badge-active' : 'badge-inactive';
  tabs.push(`<button class="badge ${monthlyCls}" role="tab" aria-selected="${current === -1}" data-week="-1" style="margin-left:4px">
    ${t('app.monthlyView')}
  </button>`);

  container.innerHTML = tabs.join('');

  container.querySelectorAll('[data-week]').forEach(btn => {
    btn.addEventListener('click', () => {
      setCurrentWeek(parseInt(btn.dataset.week));
      onUpdate();
    });
  });
}
