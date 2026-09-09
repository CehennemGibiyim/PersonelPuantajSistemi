import { t } from '../utils.js';

const STORAGE_KEY = 'favoriteActions';
const DEFAULTS = ['personnel', 'duty', 'leave'];
const OPTIONS = [
  ['personnel', 'dashboard.addPerson', 'dashboard.addPersonHint'],
  ['duty', 'dashboard.openDuty', 'dashboard.openDutyHint'],
  ['leave', 'dashboard.addLeave', 'dashboard.addLeaveHint'],
  ['reports', 'dashboard.openReports', 'dashboard.openReportsHint']
];

let favoriteKeys = [...DEFAULTS];
let loaded = false;

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const storage = () => window.miniappsAI?.storage;

async function loadFavorites() {
  if (loaded) return favoriteKeys;
  loaded = true;
  try {
    const raw = await storage()?.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) {
      const allowed = new Set(OPTIONS.map(([key]) => key));
      favoriteKeys = parsed.filter(key => allowed.has(key)).slice(0, 4);
    }
  } catch { /* defaults are safe when storage is unavailable */ }
  return favoriteKeys;
}

async function saveFavorites(keys) {
  favoriteKeys = keys.filter(Boolean).slice(0, 4);
  try { await storage()?.setItem(STORAGE_KEY, JSON.stringify(favoriteKeys)); } catch { /* local UI remains usable */ }
}

function optionFor(key) { return OPTIONS.find(item => item[0] === key); }

function renderActionMarkup(keys) {
  return keys.map((key, index) => {
    const item = optionFor(key);
    if (!item) return '';
    return `<button class="quick-action favorite-action${index === 0 ? ' primary' : ''}" type="button" data-favorite-action="${esc(key)}"><span class="quick-action-arrow" aria-hidden="true">${index === 0 ? '★' : '↗'}</span><span><strong>${t(item[1])}</strong><small>${t(item[2])}</small></span></button>`;
  }).join('');
}

function openEditor(host, actions) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay active';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.innerHTML = `<div class="modal glass favorite-editor"><div class="advanced-heading"><h2 class="modal-title">${t('dashboard.favoriteEditTitle')}</h2><button class="action-btn" type="button" data-favorite-close aria-label="${t('modal.cancel')}">×</button></div><p class="favorite-editor-hint">${t('dashboard.favoriteEditHint')}</p><div class="favorite-options">${OPTIONS.map(([key, title, hint]) => `<label class="favorite-option"><input type="checkbox" value="${key}" ${favoriteKeys.includes(key) ? 'checked' : ''}><span><strong>${t(title)}</strong><small>${t(hint)}</small></span></label>`).join('')}</div><div class="modal-actions"><button class="btn" type="button" data-favorite-cancel>${t('modal.cancel')}</button><button class="btn btn-primary" type="button" data-favorite-save>${t('modal.save')}</button></div></div>`;
  const close = () => overlay.remove();
  overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
  overlay.querySelector('[data-favorite-close]').addEventListener('click', close);
  overlay.querySelector('[data-favorite-cancel]').addEventListener('click', close);
  overlay.querySelector('[data-favorite-save]').addEventListener('click', async () => {
    const selected = [...overlay.querySelectorAll('input:checked')].map(input => input.value);
    if (!selected.length) selected.push('duty');
    await saveFavorites(selected);
    close();
    await renderFavorites(host, actions);
  });
  document.body.appendChild(overlay);
}

export async function renderFavorites(container, actions = {}) {
  if (!container) return;
  const keys = await loadFavorites();
  container.innerHTML = `<div class="favorite-heading"><span class="favorite-heading-label">${t('dashboard.favoriteLabel')}</span><button class="favorite-edit" type="button" data-favorite-edit>${t('dashboard.favoriteEdit')}</button></div>${keys.length ? renderActionMarkup(keys) : `<p class="favorite-empty">${t('dashboard.favoriteEmpty')}</p>`}`;
  container.querySelector('[data-favorite-edit]')?.addEventListener('click', () => openEditor(container, actions));
  container.querySelectorAll('[data-favorite-action]').forEach(button => {
    button.addEventListener('click', () => actions[button.dataset.favoriteAction]?.());
  });
}
