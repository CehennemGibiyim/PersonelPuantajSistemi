import { getPersonnelList, getContactInfo } from '../state.js';
import { t } from '../utils.js';

let overlay = null;
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));

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

function renderContactCard(name) {
  const info = getContactInfo(name) || {};
  const value = (label, text, wide = false) => `<div class="contact-value${wide ? ' contact-value-wide' : ''}"><span>${esc(label)}</span><strong>${text ? esc(text) : '—'}</strong></div>`;
  return `<div class="contact-card" data-name="${esc(name)}" style="padding:12px;border-radius:10px;background:rgba(255,255,255,0.05);margin-bottom:8px"><div class="contact-card-name">${esc(name)}</div><div class="contact-card-grid">${value(t('detail.phone'), info.phone)}${value(t('detail.email'), info.email)}${value(t('detail.emergency'), info.emergency, true)}${value(t('detail.address'), info.address, true)}</div></div>`;
}

export function showContactPanel() {
  createOverlay();
  const personnel = getPersonnelList();
  overlay.innerHTML = `<div class="modal glass contact-modal"><div class="advanced-heading"><h2 class="modal-title">${esc(t('contact.title'))}</h2><button class="action-btn" id="contactCloseTop" type="button" aria-label="${esc(t('modal.cancel'))}">×</button></div><input type="search" id="contactSearch" class="modal-input" style="margin-bottom:12px" placeholder="${esc(t('contact.searchPlaceholder'))}"><div id="contactList" class="contact-list">${personnel.length ? personnel.map(renderContactCard).join('') : `<p class="contact-empty">${esc(t('contact.empty'))}</p>`}</div><div class="modal-actions"><button class="btn" id="contactClose">${esc(t('modal.cancel'))}</button></div></div>`;
  const close = () => hide();
  overlay.querySelector('#contactCloseTop').addEventListener('click', close);
  overlay.querySelector('#contactClose').addEventListener('click', close);
  const searchInput = overlay.querySelector('#contactSearch');
  searchInput.addEventListener('input', () => {
    const term = searchInput.value.trim().toLocaleLowerCase('tr-TR');
    overlay.querySelectorAll('.contact-card').forEach(card => {
      card.style.display = card.dataset.name.toLocaleLowerCase('tr-TR').includes(term) ? '' : 'none';
    });
  });
  overlay.classList.add('active');
  overlay.setAttribute('aria-label', t('contact.title'));
  setTimeout(() => searchInput.focus(), 80);
}

export function initContactPanel(btn) {
  if (btn) btn.addEventListener('click', showContactPanel);
}
