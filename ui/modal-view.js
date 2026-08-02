import { addPersonnel, editPersonnel, deletePersonnel, personExists, getPersonnelType } from '../state.js';
import { t } from '../utils.js';

let overlay = null;
let onUpdate = null;

// Mode: 'add' | 'edit' | 'delete'
let currentMode = 'add';
let currentName = '';

function createOverlay() {
  if (overlay) return;
  overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) hide(); });
}

function buildForm() {
  overlay.innerHTML = `
    <div class="modal glass">
      <h2 class="modal-title" id="modalTitle"></h2>
      <div id="modalBody"></div>
      <p class="modal-error" id="modalError" style="display:none"></p>
      <div class="modal-actions" id="modalActions"></div>
    </div>
  `;
}

function hide() {
  if (overlay) overlay.classList.remove('active');
}

function showError(msg) {
  const el = overlay.querySelector('#modalError');
  el.textContent = msg;
  el.style.display = 'block';
}

function clearError() {
  const el = overlay.querySelector('#modalError');
  el.style.display = 'none';
  const input = overlay.querySelector('#modalNameInput');
  if (input) input.style.borderColor = '';
}

function getTypeSelectorHTML(selectedType = 'worker') {
  return `
    <label class="modal-label" style="margin-top:14px">${t('modal.personnelType')}</label>
    <div style="display:flex;gap:8px;margin-top:4px">
      <label style="flex:1;display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:8px;border:1px solid ${selectedType === 'worker' ? 'rgba(56,189,248,0.6)' : 'rgba(255,255,255,0.15)'};background:${selectedType === 'worker' ? 'rgba(56,189,248,0.15)' : 'rgba(255,255,255,0.06)'};cursor:pointer;transition:all 0.2s">
        <input type="radio" name="personnelType" value="worker" ${selectedType === 'worker' ? 'checked' : ''} style="accent-color:#38bdf8">
        <div>
          <div style="font-size:13px;color:#fff;font-weight:500">${t('modal.typeWorker')}</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.5)">${t('modal.typeWorkerDesc')}</div>
        </div>
      </label>
      <label style="flex:1;display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:8px;border:1px solid ${selectedType === 'civil' ? 'rgba(167,139,250,0.6)' : 'rgba(255,255,255,0.15)'};background:${selectedType === 'civil' ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.06)'};cursor:pointer;transition:all 0.2s">
        <input type="radio" name="personnelType" value="civil" ${selectedType === 'civil' ? 'checked' : ''} style="accent-color:#a78bfa">
        <div>
          <div style="font-size:13px;color:#fff;font-weight:500">${t('modal.typeCivil')}</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.5)">${t('modal.typeCivilDesc')}</div>
        </div>
      </label>
    </div>
  `;
}

function getSelectedType() {
  const radio = overlay.querySelector('input[name="personnelType"]:checked');
  return radio ? radio.value : 'worker';
}

// ─── ADD MODE ───

function showAdd() {
  currentMode = 'add';
  createOverlay();
  buildForm();

  overlay.querySelector('#modalTitle').textContent = t('app.modalAddTitle');
  overlay.querySelector('#modalBody').innerHTML = `
    <label class="modal-label" for="modalNameInput">${t('app.modalNameLabel')}</label>
    <input type="text" id="modalNameInput" class="modal-input"
      placeholder="${t('app.modalNamePlaceholder')}" autocomplete="off">
    ${getTypeSelectorHTML('worker')}
  `;
  overlay.querySelector('#modalActions').innerHTML = `
    <button class="btn" id="modalCancel">${t('modal.cancel')}</button>
    <button class="btn btn-primary" id="modalConfirm">${t('modal.confirmAdd')}</button>
  `;

  wireFormEvents('add');
  wireTypeRadioUpdate();
  overlay.classList.add('active');
  overlay.setAttribute('aria-label', t('app.modalAddTitle'));
  setTimeout(() => overlay.querySelector('#modalNameInput').focus(), 100);
}

// ─── EDIT MODE ───

function showEdit(name) {
  currentMode = 'edit';
  currentName = name;
  createOverlay();
  buildForm();

  const currentType = getPersonnelType(name);

  overlay.querySelector('#modalTitle').textContent = t('modal.editTitle');
  overlay.querySelector('#modalBody').innerHTML = `
    <label class="modal-label" for="modalNameInput">${t('app.modalNameLabel')}</label>
    <input type="text" id="modalNameInput" class="modal-input" value="${name}" autocomplete="off">
    ${getTypeSelectorHTML(currentType)}
  `;
  overlay.querySelector('#modalActions').innerHTML = `
    <button class="btn" id="modalCancel">${t('modal.cancel')}</button>
    <button class="btn btn-primary" id="modalConfirm">${t('modal.save')}</button>
  `;

  wireFormEvents('edit');
  wireTypeRadioUpdate();
  overlay.classList.add('active');
  overlay.setAttribute('aria-label', t('modal.editTitle'));
  const input = overlay.querySelector('#modalNameInput');
  setTimeout(() => { input.focus(); input.select(); }, 100);
}

// ─── DELETE MODE ───

function showDelete(name) {
  currentMode = 'delete';
  currentName = name;
  createOverlay();
  buildForm();

  overlay.querySelector('#modalTitle').textContent = t('modal.deleteTitle');
  overlay.querySelector('#modalBody').innerHTML = `
    <p style="color:rgba(255,255,255,0.8);font-size:14px;line-height:1.6">
      ${t('modal.deleteConfirm', { name: `<strong style="color:#fca5a5">${name}</strong>` })}
    </p>
  `;
  overlay.querySelector('#modalActions').innerHTML = `
    <button class="btn" id="modalCancel">${t('modal.cancel')}</button>
    <button class="btn" id="modalConfirm" style="background:rgba(255,100,100,0.3);border-color:rgba(255,100,100,0.5);color:#fca5a5">${t('modal.delete')}</button>
  `;

  wireFormEvents('delete');
  overlay.classList.add('active');
  overlay.setAttribute('aria-label', t('modal.deleteTitle'));
  setTimeout(() => overlay.querySelector('#modalConfirm').focus(), 100);
}

// ─── SHARED EVENT WIRING ───

function wireFormEvents(mode) {
  const cancelBtn = overlay.querySelector('#modalCancel');
  const confirmBtn = overlay.querySelector('#modalConfirm');

  cancelBtn.addEventListener('click', hide);
  confirmBtn.addEventListener('click', () => handleConfirm(mode));

  const input = overlay.querySelector('#modalNameInput');
  if (input) {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') handleConfirm(mode);
      if (e.key === 'Escape') hide();
    });
    input.addEventListener('input', clearError);
  }

  if (mode === 'delete') {
    const handler = e => {
      if (e.key === 'Escape') { hide(); document.removeEventListener('keydown', handler); }
      if (e.key === 'Enter') { handleConfirm(mode); document.removeEventListener('keydown', handler); }
    };
    document.addEventListener('keydown', handler);
  }
}

function wireTypeRadioUpdate() {
  overlay.querySelectorAll('input[name="personnelType"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const selected = radio.value;
      overlay.querySelectorAll('input[name="personnelType"]').forEach(r => {
        const label = r.closest('label');
        const isThis = r.value === selected;
        const color = r.value === 'worker' ? '56,189,248' : '167,139,250';
        label.style.borderColor = isThis ? `rgba(${color},0.6)` : 'rgba(255,255,255,0.15)';
        label.style.background = isThis ? `rgba(${color},0.15)` : 'rgba(255,255,255,0.06)';
      });
    });
  });
}

function handleConfirm(mode) {
  clearError();

  if (mode === 'add') {
    const input = overlay.querySelector('#modalNameInput');
    const name = input.value.trim();
    if (!name) { showError(t('modal.nameRequired')); input.focus(); return; }
    if (personExists(name)) { showError(t('modal.nameDuplicate')); input.focus(); return; }
    const type = getSelectedType();
    addPersonnel(name, type);
    hide();
    if (onUpdate) onUpdate('add');

  } else if (mode === 'edit') {
    const input = overlay.querySelector('#modalNameInput');
    const newName = input.value.trim();
    if (!newName) { showError(t('modal.nameRequired')); input.focus(); return; }
    if (newName !== currentName && personExists(newName)) { showError(t('modal.nameDuplicate')); input.focus(); return; }
    const type = getSelectedType();
    editPersonnel(currentName, newName, type);
    hide();
    if (onUpdate) onUpdate('edit');

  } else if (mode === 'delete') {
    deletePersonnel(currentName);
    hide();
    if (onUpdate) onUpdate('delete');
  }
}

// ─── PUBLIC API ───

export function initModal(addBtn, callback) {
  onUpdate = callback;
  addBtn.addEventListener('click', showAdd);
}

export { showEdit, showDelete };
