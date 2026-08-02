import { getAdmins, updateAdmin, getUnitName, getCurrentUnitId, editUnit } from '../state.js';
import { t } from '../utils.js';

let overlay = null;
let onUpdate = null;

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

function showError(msg) {
  const el = overlay.querySelector('#adminError');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function clearErrors() {
  overlay.querySelectorAll('.modal-error').forEach(el => el.style.display = 'none');
  overlay.querySelectorAll('.modal-input').forEach(el => el.style.borderColor = '');
}

function showAdminModal() {
  createOverlay();
  const admins = getAdmins();
  const currentUnit = getUnitName();

  overlay.innerHTML = `
    <div class="modal glass" style="max-width:440px">
      <h2 class="modal-title">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;margin-right:6px">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
        ${t('modal.adminTitle')}
      </h2>

      <div style="display:flex;flex-direction:column;gap:14px">
        <div>
          <label class="modal-label" for="adminUnitName">${t('modal.unitName')}</label>
          <input type="text" id="adminUnitName" class="modal-input" value="${currentUnit}" autocomplete="off" placeholder="${t('modal.unitNamePlaceholder')}">
        </div>
        <div>
          <label class="modal-label" for="adminHeadNurse">${t('modal.adminHeadNurse')}</label>
          <input type="text" id="adminHeadNurse" class="modal-input" value="${admins.headNurse}" autocomplete="off">
        </div>
        <div>
          <label class="modal-label" for="adminManager">${t('modal.adminManager')}</label>
          <input type="text" id="adminManager" class="modal-input" value="${admins.manager}" autocomplete="off">
        </div>
        <div>
          <label class="modal-label" for="adminChiefDoctor">${t('modal.adminChiefDoctor')}</label>
          <input type="text" id="adminChiefDoctor" class="modal-input" value="${admins.chiefDoctor}" autocomplete="off">
        </div>
      </div>

      <p class="modal-error" id="adminError" style="display:none"></p>

      <div class="modal-actions">
        <button class="btn" id="adminCancel">${t('modal.cancel')}</button>
        <button class="btn btn-primary" id="adminSave">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px">
            <polyline points="20 6 9 17 4 12"/>
          </svg> ${t('modal.save')}
        </button>
      </div>
    </div>
  `;

  overlay.querySelector('#adminCancel').addEventListener('click', hide);
  overlay.querySelector('#adminSave').addEventListener('click', handleSave);

  overlay.querySelectorAll('.modal-input').forEach(input => {
    input.addEventListener('keydown', e => {
      if (e.key === 'Escape') hide();
      if (e.key === 'Enter') handleSave();
    });
    input.addEventListener('input', clearErrors);
  });

  overlay.classList.add('active');
  overlay.setAttribute('aria-label', t('modal.adminTitle'));
  setTimeout(() => overlay.querySelector('#adminUnitName').focus(), 100);
}

function handleSave() {
  clearErrors();
  const unit = overlay.querySelector('#adminUnitName').value.trim();
  const headNurse = overlay.querySelector('#adminHeadNurse').value.trim();
  const manager = overlay.querySelector('#adminManager').value.trim();
  const chiefDoctor = overlay.querySelector('#adminChiefDoctor').value.trim();

  if (!headNurse || !manager || !chiefDoctor) {
    showError(t('modal.nameRequired'));
    return;
  }

  editUnit(getCurrentUnitId(), unit);
  updateAdmin('headNurse', headNurse);
  updateAdmin('manager', manager);
  updateAdmin('chiefDoctor', chiefDoctor);
  hide();
  if (onUpdate) onUpdate();
}

export function initAdminModal(btn, callback) {
  onUpdate = callback;
  btn.addEventListener('click', showAdminModal);
}
