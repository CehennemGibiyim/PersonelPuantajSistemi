import { getCurrentUnitId } from '../state.js';
import { getYear, getMonth, t } from '../utils.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));

export async function renderSecurityStatus(container, onBackup) {
  if (!container) return;
  let createdAt = '';
  try {
    const key = `puantaj_auto_backup_${getCurrentUnitId()}_${getYear()}_${getMonth()}`;
    const raw = await window.miniappsAI?.storage?.getItem(key);
    const record = raw ? JSON.parse(raw) : null;
    createdAt = record?.createdAt || '';
  } catch { createdAt = ''; }

  const dateLabel = createdAt
    ? new Date(createdAt).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })
    : t('dashboard.securityNever');
  container.innerHTML = `<div class="security-heading"><div><span class="dashboard-eyebrow">${t('dashboard.securityEyebrow')}</span><h3>${t('dashboard.securityTitle')}</h3></div><span class="security-shield" aria-hidden="true">✓</span></div><div class="security-status-line"><span class="security-dot ${createdAt ? 'is-safe' : 'is-pending'}"></span><strong>${createdAt ? t('dashboard.securitySafe') : t('dashboard.securityPending')}</strong></div><p>${t('dashboard.securityLastBackup', { date: esc(dateLabel) })}</p><button class="dashboard-empty-action" type="button" data-security-backup>${t('dashboard.securityBackup')}</button>`;
  container.querySelector('[data-security-backup]')?.addEventListener('click', () => onBackup?.());
}
