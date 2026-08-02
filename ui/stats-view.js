import { getPersonnelList, getTotalNightHours, getMonthlyTotal } from '../state.js';
import { t } from '../utils.js';

export function renderStats(container) {
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
    <div class="glass-dark stat-card">
      <div class="stat-num">${personnel.length}</div>
      <div class="stat-label">${t('app.personnel')}</div>
    </div>
    <div class="glass-dark stat-card">
      <div class="stat-num">${totalWorked}</div>
      <div class="stat-label">${t('app.totalHours')}</div>
    </div>
    <div class="glass-dark stat-card">
      <div class="stat-num">${totalNight}</div>
      <div class="stat-label">${t('app.nightShift')}</div>
    </div>
    <div class="glass-dark stat-card">
      <div class="stat-num">${totalExtra}</div>
      <div class="stat-label">${t('app.overtime')}</div>
    </div>
    <div class="glass-dark stat-card">
      <div class="stat-num">${totalHoliday}</div>
      <div class="stat-label">${t('app.holiday')}</div>
    </div>
  `;
}
