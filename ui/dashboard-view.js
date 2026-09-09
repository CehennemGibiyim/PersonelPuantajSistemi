import { getPersonnelList, getScheduleData, getDutyRecords, getUnitName, getRole, getMonthlyTotal } from '../state.js';
import { getPeriodApprovalState } from '../period-approval-state.js';
import { isPeriodLocked } from '../period-lock-state.js';
import { getMonth, getYear, MONTHS_TR, t } from '../utils.js';
import { getWarningSummary } from './warnings-panel-view.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));

function statusInfo() {
  const approval = getPeriodApprovalState();
  if (isPeriodLocked()) return { key: 'dashboard.statusClosed', tone: 'closed' };
  if (approval.status === 'approved') return { key: 'dashboard.statusApproved', tone: 'approved' };
  if (approval.status === 'submitted') return { key: 'dashboard.statusReview', tone: 'review' };
  if (approval.status === 'rejected') return { key: 'dashboard.statusCorrection', tone: 'correction' };
  return { key: 'dashboard.statusDraft', tone: 'draft' };
}

function metrics() {
  const personnel = getPersonnelList();
  const schedule = getScheduleData();
  const filled = personnel.reduce((total, name) => total + Object.values(schedule[name] || {}).filter(value => String(value || '').trim()).length, 0);
  const duties = getDutyRecords();
  return { personnel: personnel.length, filled, duties: duties.length };
}

function workload() {
  const personnel = getPersonnelList();
  const schedule = getScheduleData();
  const duties = getDutyRecords();
  const values = personnel.map(name => {
    const dutyCount = duties.filter(item => item.person === name).length;
    const shiftCount = Object.values(schedule[name] || {}).filter(value => String(value || '').trim() && !['İ', 'R', 'ÜY'].includes(String(value).trim().toUpperCase())).length;
    return { name, value: dutyCount || shiftCount, hours: getMonthlyTotal(name, 'worked') };
  });
  const max = Math.max(...values.map(item => item.value), 1);
  const average = values.length ? values.reduce((sum, item) => sum + item.value, 0) / values.length : 0;
  return values.sort((a, b) => b.value - a.value).map(item => ({ ...item, max, tone: average && item.value > average * 1.35 ? 'high' : average && item.value < average * .65 ? 'low' : 'balanced' }));
}

export function renderDashboard(container, actions = {}) {
  if (!container) return;
  const role = getRole();
  const info = statusInfo();
  const data = metrics();
  const alerts = getWarningSummary();
  const period = `${MONTHS_TR[getMonth()]} ${getYear()}`;
  const roleLabel = t(`dashboard.role_${role}`);
  const loads = workload();
  const topLoads = loads.slice(0, 6);

  container.innerHTML = `
    <section class="dashboard-shell" aria-labelledby="dashboardTitle">
      <div class="dashboard-hero">
        <div><span class="dashboard-kicker">${t('dashboard.kicker')}</span><h2 id="dashboardTitle">${t('dashboard.title')}</h2><p>${esc(getUnitName())} · ${esc(period)}</p></div>
        <span class="dashboard-role">${esc(roleLabel)}</span>
      </div>
      <div class="dashboard-metrics" aria-label="${t('dashboard.metricsLabel')}">
        <article class="dashboard-metric"><span class="metric-icon">●</span><strong>${data.personnel}</strong><span>${t('dashboard.personnel')}</span></article>
        <article class="dashboard-metric"><span class="metric-icon">▦</span><strong>${data.filled}</strong><span>${t('dashboard.filledShifts')}</span></article>
        <article class="dashboard-metric"><span class="metric-icon">▤</span><strong>${data.duties}</strong><span>${t('dashboard.dutyRecords')}</span></article>
        <article class="dashboard-metric dashboard-metric-status"><span class="metric-status ${info.tone}"></span><strong>${t(info.key)}</strong><span>${t('dashboard.periodStatus')}</span></article>
      </div>
      <div class="dashboard-grid">
        <section class="dashboard-card quick-card"><div class="dashboard-card-heading"><div><span class="dashboard-eyebrow">${t('dashboard.quickEyebrow')}</span><h3>${t('dashboard.quickTitle')}</h3></div><span class="dashboard-card-mark">★</span></div><div class="quick-action-grid" data-favorites-host></div></section>
        <section class="dashboard-card status-card"><div class="dashboard-card-heading"><div><span class="dashboard-eyebrow">${t('dashboard.statusEyebrow')}</span><h3>${t('dashboard.statusTitle')}</h3></div><span class="status-dot ${info.tone}"></span></div><p class="status-lead">${t(info.key)}</p><p class="status-copy">${isPeriodLocked() ? t('dashboard.closedHint') : data.filled ? t('dashboard.activeHint') : t('dashboard.emptyHint')}</p>${data.filled ? '' : `<button class="dashboard-empty-action" type="button" data-dashboard-action="duty">${t('dashboard.emptyAction')}</button>`}</section>
      </div>
      <div class="dashboard-insights">
        <section class="dashboard-card alert-card"><div class="dashboard-card-heading"><div><span class="dashboard-eyebrow">${t('dashboard.alertEyebrow')}</span><h3>${t('dashboard.alertTitle')}</h3></div><span class="alert-count ${alerts.total ? 'has-alerts' : ''}">${alerts.total}</span></div><p class="status-copy">${alerts.total ? t('dashboard.alertHint', { groups: alerts.groups }) : t('dashboard.alertEmpty')}</p><button class="dashboard-empty-action" type="button" data-dashboard-action="alerts">${t('dashboard.alertOpen')}</button></section>
        <section class="dashboard-card workload-card"><div class="dashboard-card-heading"><div><span class="dashboard-eyebrow">${t('dashboard.workloadEyebrow')}</span><h3>${t('dashboard.workloadTitle')}</h3></div><span class="dashboard-card-mark">≈</span></div>${topLoads.length ? `<div class="workload-list">${topLoads.map(item => `<div class="workload-row"><div class="workload-label"><span>${esc(item.name)}</span><strong>${item.value}</strong></div><div class="workload-track"><span class="workload-fill ${item.tone}" style="width:${Math.max(6, Math.round((item.value / item.max) * 100))}%"></span></div><small>${t(`dashboard.workload_${item.tone}`)}</small></div>`).join('')}</div>` : `<p class="favorite-empty">${t('dashboard.workloadEmpty')}</p>`}</section>
        <section class="dashboard-card security-card" data-security-status></section>
      </div>
    </section>`;

  container.querySelectorAll('[data-dashboard-action]').forEach(button => button.addEventListener('click', () => actions[button.dataset.dashboardAction]?.()));
}
