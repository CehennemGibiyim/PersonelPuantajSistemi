import { getRole, isAdmin } from '../state.js';
import { getPeriodLockState, isPeriodLocked, lockPeriod, unlockPeriod } from '../period-lock-state.js';
import { isPeriodApprovalApproved } from '../period-approval-state.js';
import { t } from '../utils.js';
import { showToast } from './toast-view.js';
import { recordAudit } from '../audit-state.js';
import { refreshAuditPanel } from './audit-panel-view.js';

function formatClosedAt(value) {
  if (!value) return '';
  try { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); } catch { return value; }
}

export function renderPeriodLockSection() {
  const state = getPeriodLockState();
  const locked = isPeriodLocked();
  const admin = isAdmin();
  const detail = locked
    ? t('periodLock.closedDetail', { date: formatClosedAt(state.closedAt), by: state.closedBy || getRole() })
    : t('periodLock.openDetail');
  return `<section class="advanced-section period-lock-section" id="periodLockSection"><div class="period-lock-heading"><div><h3>${t('periodLock.title')}</h3><p class="advanced-muted">${t('periodLock.description')}</p></div><span class="period-lock-badge ${locked ? 'is-locked' : 'is-open'}">${t(locked ? 'periodLock.closed' : 'periodLock.open')}</span></div><p class="period-lock-detail">${detail}</p><div class="advanced-grid">${locked && admin ? `<button class="btn btn-primary" id="periodUnlockBtn">${t('periodLock.reopen')}</button>` : !locked && admin ? `<button class="btn btn-primary" id="periodLockBtn">${t('periodLock.close')}</button>` : ''}</div>${locked && !admin ? `<p class="advanced-muted">${t('periodLock.adminOnlyReopen')}</p>` : !admin ? `<p class="advanced-muted">${t('periodLock.adminOnlyClose')}</p>` : ''}</section>`;
}

export function bindPeriodLockPanel(root, onUpdate = () => {}) {
  const section = root.querySelector('#periodLockSection');
  if (!section) return;
  section.querySelector('#periodLockBtn')?.addEventListener('click', async () => {
    if (!isPeriodApprovalApproved()) return showToast(t('periodLock.approvalRequired'), 'error');
    if (!window.confirm(t('periodLock.closeConfirm'))) return;
    const button = section.querySelector('#periodLockBtn');
    button.disabled = true;
    const ok = await lockPeriod(getRole());
    if (!ok) return showToast(t('periodLock.saveFailed'), 'error');
    await recordAudit('period_closed', getRole());
    refreshAuditPanel(root);
    showToast(t('periodLock.closedToast'), 'success');
    onUpdate();
    section.outerHTML = renderPeriodLockSection();
    bindPeriodLockPanel(root, onUpdate);
  });
  section.querySelector('#periodUnlockBtn')?.addEventListener('click', async () => {
    if (!window.confirm(t('periodLock.reopenConfirm'))) return;
    const button = section.querySelector('#periodUnlockBtn');
    button.disabled = true;
    const ok = await unlockPeriod();
    if (!ok) return showToast(t('periodLock.saveFailed'), 'error');
    await recordAudit('period_reopened', getRole());
    refreshAuditPanel(root);
    showToast(t('periodLock.reopenedToast'), 'info');
    onUpdate();
    section.outerHTML = renderPeriodLockSection();
    bindPeriodLockPanel(root, onUpdate);
  });
}
