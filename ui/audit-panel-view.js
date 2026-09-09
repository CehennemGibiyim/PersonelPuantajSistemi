import { getAuditLog } from '../audit-state.js';
import { getYear, getMonth, MONTHS_TR, t } from '../utils.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));

function actionLabel(action) {
  const key = `audit.actions.${action.replaceAll('.', '_')}`;
  const value = t(key);
  return value === key ? action : value;
}

function formatDate(value) {
  try { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); } catch { return value || ''; }
}

function renderRows(currentPeriod) {
  const items = getAuditLog({ currentPeriod }).slice(0, 25);
  if (!items.length) return `<p class="advanced-muted">${t('audit.empty')}</p>`;
  return items.map(item => `<div class="advanced-row audit-row"><span><strong>${esc(actionLabel(item.action))}</strong><small>${esc(item.detail || t('audit.noDetail'))}</small></span><span class="audit-meta">${esc(item.actor || t('audit.system'))}<br>${esc(formatDate(item.createdAt))}</span></div>`).join('');
}

export function renderAuditSection() {
  return `<section class="advanced-section audit-section" id="auditSection"><div class="audit-heading"><div><h3>${t('audit.title')}</h3><p class="advanced-muted">${t('audit.description')}</p></div><span class="audit-count">${getAuditLog().length}</span></div><label class="audit-filter"><input type="checkbox" id="auditCurrentOnly"> <span>${t('audit.currentOnly', { month: MONTHS_TR[getMonth()], year: getYear() })}</span></label><div id="auditList">${renderRows(false)}</div></section>`;
}

export function refreshAuditPanel(root) {
  const section = root.querySelector('#auditSection');
  if (!section) return;
  const checkbox = section.querySelector('#auditCurrentOnly');
  const list = section.querySelector('#auditList');
  const count = section.querySelector('.audit-count');
  if (list) list.innerHTML = renderRows(Boolean(checkbox?.checked));
  if (count) count.textContent = String(getAuditLog().length);
}

export function bindAuditPanel(root) {
  const section = root.querySelector('#auditSection');
  if (!section) return;
  const checkbox = section.querySelector('#auditCurrentOnly');
  checkbox?.addEventListener('change', () => refreshAuditPanel(root));
}
