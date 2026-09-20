import { getPersonnelType, getContactInfo, setContactInfo, getLeaveBalances, setLeaveBalances, canEdit } from '../state.js';
import { getPersonnelPhoto, setPersonnelPhoto, removePersonnelPhoto } from '../personnel-photo-state.js';
import { preparePersonnelPhoto, photoErrorKey } from '../personnel-photo-service.js';
import { openPhotoCrop } from './photo-crop-view.js';
import { t } from '../utils.js';

let overlay = null;
let currentName = null;
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
  currentName = null;
}

function showError(msg) {
  const el = overlay.querySelector('#detailError');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function photoMarkup(name, photo) {
  if (photo?.url) return `<img class="person-photo-preview" id="detailPhotoPreview" src="${esc(photo.url)}" alt="${esc(name)}">`;
  return `<div class="person-photo-placeholder" id="detailPhotoPreview" aria-hidden="true">${esc(String(name || '?').slice(0, 1))}</div>`;
}

async function save(name, selectedFile, removePhoto) {
  const phone = overlay.querySelector('#detailPhone').value;
  const email = overlay.querySelector('#detailEmail').value;
  const emergency = overlay.querySelector('#detailEmergency').value;
  const address = overlay.querySelector('#detailAddress').value;
  const annual = overlay.querySelector('#detailAnnual').value;
  const sick = overlay.querySelector('#detailSick').value;
  const unpaid = overlay.querySelector('#detailUnpaid').value;

  setContactInfo(name, { phone, email, emergency, address });
  setLeaveBalances(name, { annual, sick, unpaid });
  if (removePhoto) {
    if (!await removePersonnelPhoto(name)) throw new Error('PHOTO_SAVE');
  } else if (selectedFile) {
    const asset = await preparePersonnelPhoto(selectedFile);
    if (!await setPersonnelPhoto(name, asset)) throw new Error('PHOTO_SAVE');
  }
}

export function showPersonnelDetail(name, afterSave = null) {
  if (!name) return;
  currentName = name;
  createOverlay();

  const type = getPersonnelType(name);
  const typeLabel = type === 'civil' ? t('modal.typeCivil') : t('modal.typeWorker');
  const contact = getContactInfo(name);
  const leave = getLeaveBalances(name);
  const photo = getPersonnelPhoto(name);
  const editable = canEdit();

  overlay.innerHTML = `
    <div class="modal glass personnel-detail-modal">
      <div class="personnel-detail-head"><div>${photoMarkup(name, photo)}<div><h2 class="modal-title">${esc(name)}</h2><p class="personnel-detail-type">${esc(typeLabel)}</p></div></div><button class="action-btn" id="detailTopClose" type="button" aria-label="${esc(t('modal.cancel'))}">×</button></div>
      ${editable ? `<div class="person-photo-tools"><label class="btn photo-upload-btn" for="detailPhotoInput">${esc(t('detail.photoChoose'))}</label><input id="detailPhotoInput" type="file" accept="image/jpeg,image/png,image/webp" hidden><button class="btn photo-remove-btn" id="detailPhotoRemove" type="button" ${photo ? '' : 'disabled'}>${esc(t('detail.photoRemove'))}</button><span id="detailPhotoStatus" class="photo-upload-status">${esc(t('detail.photoHint'))}</span></div>` : ''}
      <div class="personnel-detail-sections">
        <div><p class="modal-label personnel-section-title">${t('detail.contactTitle')}</p><div class="personnel-detail-grid">
          <input type="tel" id="detailPhone" class="modal-input" placeholder="${esc(t('detail.phone'))}" value="${esc(contact.phone)}" ${!editable ? 'disabled' : ''}>
          <input type="email" id="detailEmail" class="modal-input" placeholder="${esc(t('detail.email'))}" value="${esc(contact.email)}" ${!editable ? 'disabled' : ''}>
          <input type="text" id="detailEmergency" class="modal-input personnel-detail-wide" placeholder="${esc(t('detail.emergency'))}" value="${esc(contact.emergency)}" ${!editable ? 'disabled' : ''}>
          <input type="text" id="detailAddress" class="modal-input personnel-detail-wide" placeholder="${esc(t('detail.address'))}" value="${esc(contact.address)}" ${!editable ? 'disabled' : ''}>
        </div></div>
        <div><p class="modal-label personnel-section-title">${t('detail.leaveTitle')}</p><div class="personnel-detail-grid leave-grid">
          <label class="detail-number-field"><span>${esc(t('detail.annual'))}</span><input type="number" id="detailAnnual" class="modal-input" value="${esc(leave.annual)}" min="0" ${!editable ? 'disabled' : ''}></label>
          <label class="detail-number-field"><span>${esc(t('detail.sick'))}</span><input type="number" id="detailSick" class="modal-input" value="${esc(leave.sick)}" min="0" ${!editable ? 'disabled' : ''}></label>
          <label class="detail-number-field"><span>${esc(t('detail.unpaid'))}</span><input type="number" id="detailUnpaid" class="modal-input" value="${esc(leave.unpaid)}" min="0" ${!editable ? 'disabled' : ''}></label>
        </div></div>
      </div>
      <p class="modal-error" id="detailError" style="display:none"></p>
      <div class="modal-actions"><button class="btn" id="detailClose">${t('modal.cancel')}</button>${editable ? `<button class="btn" id="detailSwap" style="background:rgba(251,191,36,0.15);border-color:rgba(251,191,36,0.4);color:#fbbf24">${t('swap.create')}</button><button class="btn btn-primary" id="detailSave">${t('modal.save')}</button>` : ''}</div>
    </div>
  `;

  overlay.querySelector('#detailClose').addEventListener('click', hide);
  overlay.querySelector('#detailTopClose').addEventListener('click', hide);
  if (editable) {
    let selectedFile = null;
    let removePhoto = false;
    let previewUrl = '';
    const input = overlay.querySelector('#detailPhotoInput');
    const preview = overlay.querySelector('#detailPhotoPreview');
    const status = overlay.querySelector('#detailPhotoStatus');
    const removeButton = overlay.querySelector('#detailPhotoRemove');
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (!String(file.type || '').startsWith('image/')) { showError(t('detail.photoTypeError')); input.value = ''; return; }
      if (file.size > 5 * 1024 * 1024) { showError(t('detail.photoSizeError')); input.value = ''; return; }
      let croppedFile = null;
      try { croppedFile = await openPhotoCrop(file); } catch (error) {
        console.error('Personnel photo crop failed:', error);
        showError(t('detail.photoUploadFailed'));
      }
      if (!croppedFile) { input.value = ''; return; }
      selectedFile = croppedFile;
      removePhoto = false;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = URL.createObjectURL(croppedFile);
      preview.outerHTML = `<img class="person-photo-preview" id="detailPhotoPreview" src="${esc(previewUrl)}" alt="${esc(name)}">`;
      status.textContent = t('detail.photoCropped');
      removeButton.disabled = false;
    });
    removeButton.addEventListener('click', () => {
      selectedFile = null;
      removePhoto = Boolean(photo);
      input.value = '';
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      overlay.querySelector('#detailPhotoPreview').outerHTML = photoMarkup(name, null);
      status.textContent = t('detail.photoRemoved');
      removeButton.disabled = true;
    });
    overlay.querySelector('#detailSwap').addEventListener('click', () => {
      import('./swap-request-view.js').then(m => m.showSwapRequestForm(name));
    });
    overlay.querySelector('#detailSave').addEventListener('click', async () => {
      const button = overlay.querySelector('#detailSave');
      button.disabled = true;
      try {
        await save(name, selectedFile, removePhoto);
        hide();
        if (typeof afterSave === 'function') afterSave();
      } catch (error) {
        showError(t(photoErrorKey(error)) || t('detail.photoUploadFailed'));
        button.disabled = false;
      }
    });
  }

  overlay.classList.add('active');
  overlay.setAttribute('aria-label', name);
}

export function initPersonnelDetailModal() {
  document.addEventListener('click', e => {
    const row = e.target.closest('[data-person]');
    if (row && row.dataset.person) showPersonnelDetail(row.dataset.person);
  });
}
