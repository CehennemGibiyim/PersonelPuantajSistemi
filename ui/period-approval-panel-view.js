import { canEdit, getRole, isAdmin } from '../state.js';
import { getPeriodApprovalState, submitPeriodApproval, reviewPeriodApproval } from '../period-approval-state.js';
import { isPeriodLocked } from '../period-lock-state.js';
import { t } from '../utils.js';
import { showToast } from './toast-view.js';
import { recordAudit } from '../audit-state.js';
import { refreshAuditPanel } from './audit-panel-view.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));

function formatDate(value) {
  if (!value) return '';
  try { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); } catch { return value; }
}

function statusText(status) {
  return t(`periodApproval.status.${status}`);
}

function renderDetail(state) {
  if (state.status === 'submitted') return t('periodApproval.submittedDetail', { date: formatDate(state.submittedAt), by: state.submittedBy || t('audit.system') });
  if (state.status === 'approved') return t('periodApproval.approvedDetail', { date: formatDate(state.reviewedAt), by: state.reviewedBy || t('audit.system') });
  if (state.status === 'rejected') return t('periodApproval.rejectedDetail', { date: formatDate(state.reviewedAt), by: state.reviewedBy || t('audit.system') });
  return t('periodApproval.draftDetail');
}

export function renderPeriodApprovalSection() {
  const state = getPeriodApprovalState();
  const locked = isPeriodLocked();
  const admin = isAdmin();
  const editable = canEdit() && !locked;
  const canSubmit = editable && ['draft', 'rejected'].includes(state.status);
  const canReview = admin && !locked && state.status === 'submitted';
  const note = state.reviewerNote ? `<p class="period-approval-note"><strong>${t('periodApproval.reviewerNote')}:</strong> ${esc(state.reviewerNote)}</p>` : '';
  const actions = [
    canSubmit ? `<button class="btn btn-primary" id="periodApprovalSubmit">${t('periodApproval.submit')}</button>` : '',
    canReview ? `<button class="btn btn-primary" id="periodApprovalApprove">${t('periodApproval.approve')}</button><button class="btn" id="periodApprovalReject">${t('periodApproval.reject')}</button>` : ''
  ].join('');
  const reviewForm = canReview ? `<textarea class="modal-input period-approval-comment" id="periodApprovalComment" rows="2" placeholder="${esc(t('periodApproval.commentPlaceholder'))}"></textarea>` : '';
  return `<section class="advanced-section period-approval-section" id="periodApprovalSection"><div class="period-approval-heading"><div><h3>${t('periodApproval.title')}</h3><p class="advanced-muted">${t('periodApproval.description')}</p></div><span class="period-approval-badge is-${state.status}">${statusText(state.status)}</span></div><p class="period-approval-detail">${renderDetail(state)}</p>${note}${reviewForm}<div class="advanced-grid">${actions}</div>${locked ? `<p class="advanced-muted">${t('periodApproval.lockedHint')}</p>` : !admin && state.status === 'submitted' ? `<p class="advanced-muted">${t('periodApproval.waitingHint')}</p>` : ''}</section>`;
}

function refresh(root, onUpdate) {
  const section = root.querySelector('#periodApprovalSection');
  if (!section) return;
  section.outerHTML = renderPeriodApprovalSection();
  bindPeriodApprovalPanel(root, onUpdate);
}

export function bindPeriodApprovalPanel(root, onUpdate = () => {}) {
  const section = root.querySelector('#periodApprovalSection');
  if (!section) return;
  section.querySelector('#periodApprovalSubmit')?.addEventListener('click', async event => {
    event.currentTarget.disabled = true;
    const ok = await submitPeriodApproval(getRole());
    if (!ok) return showToast(t('periodApproval.saveFailed'), 'error');
    await recordAudit('period_submitted', getRole());
    refreshAuditPanel(root);
    showToast(t('periodApproval.submittedToast'), 'success');
    onUpdate();
    refresh(root, onUpdate);
  });
  section.querySelector('#periodApprovalApprove')?.addEventListener('click', async event => {
    event.currentTarget.disabled = true;
    const note = section.querySelector('#periodApprovalComment')?.value || '';
    const ok = await reviewPeriodApproval('approved', getRole(), note);
    if (!ok) return showToast(t('periodApproval.saveFailed'), 'error');
    await recordAudit('period_approved', note);
    refreshAuditPanel(root);
    showToast(t('periodApproval.approvedToast'), 'success');
    onUpdate();
    refresh(root, onUpdate);
  });
  section.querySelector('#periodApprovalReject')?.addEventListener('click', async event => {
    event.currentTarget.disabled = true;
    const note = section.querySelector('#periodApprovalComment')?.value || '';
    const ok = await reviewPeriodApproval('rejected', getRole(), note);
    if (!ok) return showToast(t('periodApproval.saveFailed'), 'error');
    await recordAudit('period_rejected', note);
    refreshAuditPanel(root);
    showToast(t('periodApproval.rejectedToast'), 'info');
    onUpdate();
    refresh(root, onUpdate);
  });
}
