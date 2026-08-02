import { getPersonnelList, getContactInfo } from '../state.js';
import { t } from '../utils.js';

let overlay = null;

function createOverlay() {
  if (overlay) return;
  overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) hide(); });
}

function hide() {
  if (overlay) overlay.classList.remove('active');
}

export function showContactPanel() {
  createOverlay();
  const personnel = getPersonnelList();

  overlay.innerHTML = `
    <div class="modal glass" style="max-width:520px;max-height:80vh;display:flex;flex-direction:column">
      <h2 class="modal-title">${t('contact.title')}</h2>
      <input type="text" id="contactSearch" class="modal-input" style="margin-bottom:12px" placeholder="${t('contact.searchPlaceholder')}">
      <div id="contactList" style="overflow-y:auto;flex:1;padding-right:4px">
        ${personnel.length ? personnel.map(name => renderContactCard(name)).join('') : `<p style="color:rgba(255,255,255,0.4);font-size:13px;text-align:center;padding:20px">${t('contact.empty')}</p>`}
      </div>
      <div class="modal-actions">
        <button class="btn" id="contactClose">${t('modal.cancel')}</button>
      </div>
    </div>
  `;

  overlay.querySelector('#contactClose').addEventListener('click', hide);

  const searchInput = overlay.querySelector('#contactSearch');
  searchInput.addEventListener('input', () => {
    const term = searchInput.value.toLowerCase();
    overlay.querySelectorAll('.contact-card').forEach(card => {
      const name = card.dataset.name.toLowerCase();
      card.style.display = name.includes(term) ? '' : 'none';
    });
  });

  overlay.classList.add('active');
  overlay.setAttribute('aria-label', t('contact.title'));
}

function renderContactCard(name) {
  const info = getContactInfo(name);
  return `
    <div class="contact-card" data-name="${name}" style="padding:12px;border-radius:10px;background:rgba(255,255,255,0.05);margin-bottom:8px">
      <div style="font-size:14px;color:#fff;font-weight:500;margin-bottom:6px">${name}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px;color:rgba(255,255,255,0.7)">
        ${info.phone ? `<div>📞 ${info.phone}</div>` : '<div style="color:rgba(255,255,255,0.3)">📞 —</div>'}
        ${info.email ? `<div>✉ ${info.email}</div>` : '<div style="color:rgba(255,255,255,0.3)">✉ —</div>'}
        ${info.emergency ? `<div style="grid-column:1/-1">🚨 ${info.emergency}</div>` : ''}
        ${info.address ? `<div style="grid-column:1/-1">📍 ${info.address}</div>` : ''}
      </div>
    </div>
  `;
}

export function initContactPanel(btn) {
  if (btn) btn.addEventListener('click', showContactPanel);
}
