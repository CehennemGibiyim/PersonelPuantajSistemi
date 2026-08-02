import { getPersonnelType, getContactInfo, setContactInfo, getLeaveBalances, setLeaveBalances, canEdit } from '../state.js';
import { t } from '../utils.js';

let overlay = null;
let currentName = null;

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
  currentName = null;
}

function showError(msg) {
  const el = overlay.querySelector('#detailError');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function save(name) {
  const phone = overlay.querySelector('#detailPhone').value;
  const email = overlay.querySelector('#detailEmail').value;
  const emergency = overlay.querySelector('#detailEmergency').value;
  const address = overlay.querySelector('#detailAddress').value;
  const annual = overlay.querySelector('#detailAnnual').value;
  const sick = overlay.querySelector('#detailSick').value;
  const unpaid = overlay.querySelector('#detailUnpaid').value;

  setContactInfo(name, { phone, email, emergency, address });
  setLeaveBalances(name, { annual, sick, unpaid });
}

export function showPersonnelDetail(name) {
  if (!name) return;
  currentName = name;
  createOverlay();

  const type = getPersonnelType(name);
  const typeLabel = type === 'civil' ? t('modal.typeCivil') : t('modal.typeWorker');
  const contact = getContactInfo(name);
  const leave = getLeaveBalances(name);
  const editable = canEdit();

  overlay.innerHTML = `
    <div class="modal glass" style="max-width:460px">
      <h2 class="modal-title">${name}</h2>
      <p style="font-size:12px;color:rgba(255,255,255,0.5);margin-bottom:16px">${typeLabel}</p>

      <div style="display:flex;flex-direction:column;gap:14px">
        <div>
          <p class="modal-label" style="margin-bottom:8px">${t('detail.contactTitle')}</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <input type="tel" id="detailPhone" class="modal-input" placeholder="${t('detail.phone')}" value="${contact.phone}" ${!editable ? 'disabled' : ''}>
            <input type="email" id="detailEmail" class="modal-input" placeholder="${t('detail.email')}" value="${contact.email}" ${!editable ? 'disabled' : ''}>
          </div>
          <input type="text" id="detailEmergency" class="modal-input" style="margin-top:10px" placeholder="${t('detail.emergency')}" value="${contact.emergency}" ${!editable ? 'disabled' : ''}>
          <input type="text" id="detailAddress" class="modal-input" style="margin-top:10px" placeholder="${t('detail.address')}" value="${contact.address}" ${!editable ? 'disabled' : ''}>
        </div>

        <div>
          <p class="modal-label" style="margin-bottom:8px">${t('detail.leaveTitle')}</p>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
            <div>
              <label class="modal-label" for="detailAnnual">${t('detail.annual')}</label>
              <input type="number" id="detailAnnual" class="modal-input" value="${leave.annual}" min="0" ${!editable ? 'disabled' : ''}>
            </div>
            <div>
              <label class="modal-label" for="detailSick">${t('detail.sick')}</label>
              <input type="number" id="detailSick" class="modal-input" value="${leave.sick}" min="0" ${!editable ? 'disabled' : ''}>
            </div>
            <div>
              <label class="modal-label" for="detailUnpaid">${t('detail.unpaid')}</label>
              <input type="number" id="detailUnpaid" class="modal-input" value="${leave.unpaid}" min="0" ${!editable ? 'disabled' : ''}>
            </div>
          </div>
        </div>
      </div>

      <p class="modal-error" id="detailError" style="display:none"></p>

      <div class="modal-actions">
        <button class="btn" id="detailClose">${t('modal.cancel')}</button>
        ${editable ? `<button class="btn" id="detailSwap" style="background:rgba(251,191,36,0.15);border-color:rgba(251,191,36,0.4);color:#fbbf24">${t('swap.create')}</button>` : ''}
        ${editable ? `<button class="btn btn-primary" id="detailSave">${t('modal.save')}</button>` : ''}
      </div>
    </div>
  `;

  overlay.querySelector('#detailClose').addEventListener('click', hide);
  if (editable) {
    overlay.querySelector('#detailSwap').addEventListener('click', () => {
      import('./swap-request-view.js').then(m => {
        m.showSwapRequestForm(name);
      });
    });
  }
  if (editable) {
    overlay.querySelector('#detailSave').addEventListener('click', () => {
      save(name);
      hide();
    });
  }

  overlay.classList.add('active');
  overlay.setAttribute('aria-label', name);
}

export function initPersonnelDetailModal() {
  document.addEventListener('click', e => {
    const row = e.target.closest('[data-person]');
    if (row && row.dataset.person) {
      showPersonnelDetail(row.dataset.person);
    }
  });
}
