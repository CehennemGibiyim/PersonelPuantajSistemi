import { getUnits, getCurrentUnitId, addUnit, editUnit, deleteUnit, setCurrentUnit } from '../state.js';
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
  const el = overlay.querySelector('#unitError');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function clearErrors() {
  overlay.querySelectorAll('.modal-error').forEach(el => el.style.display = 'none');
  overlay.querySelectorAll('.modal-input').forEach(el => el.style.borderColor = '');
}

function renderList() {
  const list = overlay.querySelector('#unitList');
  if (!list) return;
  const units = getUnits();
  const currentId = getCurrentUnitId();

  list.innerHTML = units.map(u => {
    const isCurrent = u.id === currentId;
    return `
      <div class="unit-row" style="display:flex;align-items:center;gap:8px;padding:8px;border-radius:8px;background:rgba(255,255,255,0.05);margin-bottom:6px">
        <span style="flex:1;font-size:13px;color:#fff;font-weight:${isCurrent ? 600 : 400}">${u.name}${isCurrent ? ' ✓' : ''}</span>
        <button class="action-btn" data-edit="${u.id}" aria-label="Düzenle">✎</button>
        <button class="action-btn action-btn-danger" data-delete="${u.id}" aria-label="Sil">🗑</button>
      </div>
    `;
  }).join('');

  list.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => startEdit(btn.dataset.edit));
  });
  list.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => handleDelete(btn.dataset.delete));
  });
}

function startEdit(id) {
  const u = getUnits().find(x => x.id === id);
  if (!u) return;
  const input = overlay.querySelector('#unitNameInput');
  const formTitle = overlay.querySelector('#unitFormTitle');
  const saveBtn = overlay.querySelector('#unitSaveBtn');
  input.value = u.name;
  input.dataset.editId = id;
  formTitle.textContent = t('unit.editTitle');
  saveBtn.textContent = t('unit.save');
  input.focus();
}

function handleDelete(id) {
  const u = getUnits().find(x => x.id === id);
  if (!u) return;
  if (!confirm(`${u.name} ${t('unit.confirmDelete')}`)) return;
  if (deleteUnit(id)) {
    renderList();
    if (onUpdate) onUpdate();
  } else {
    showError(t('unit.cannotDeleteLast'));
  }
}

function handleSave() {
  clearErrors();
  const input = overlay.querySelector('#unitNameInput');
  const name = input.value.trim().toUpperCase();
  const editId = input.dataset.editId;

  if (!name) {
    showError(t('modal.nameRequired'));
    return;
  }

  if (editId) {
    if (!editUnit(editId, name)) {
      showError(t('unit.duplicateName'));
      return;
    }
    input.removeAttribute('data-edit-id');
    overlay.querySelector('#unitFormTitle').textContent = t('unit.addTitle');
    overlay.querySelector('#unitSaveBtn').textContent = t('unit.add');
  } else {
    const id = addUnit(name);
    if (!id) {
      showError(t('unit.duplicateName'));
      return;
    }
    setCurrentUnit(id);
  }

  input.value = '';
  renderList();
  if (onUpdate) onUpdate();
}

export function showUnitModal() {
  createOverlay();
  overlay.innerHTML = `
    <div class="modal glass" style="max-width:440px">
      <h2 class="modal-title">${t('unit.title')}</h2>
      <div style="display:flex;flex-direction:column;gap:14px">
        <div>
          <label class="modal-label" for="unitNameInput" id="unitFormTitle">${t('unit.addTitle')}</label>
          <input type="text" id="unitNameInput" class="modal-input" autocomplete="off" placeholder="${t('modal.unitNamePlaceholder')}">
        </div>
        <button class="btn btn-primary" id="unitSaveBtn" style="justify-content:center">${t('unit.add')}</button>
      </div>
      <p class="modal-error" id="unitError" style="display:none"></p>
      <div style="margin-top:16px">
        <p class="modal-label">${t('unit.listTitle')}</p>
        <div id="unitList" style="max-height:240px;overflow-y:auto;padding-right:4px"></div>
      </div>
      <div class="modal-actions">
        <button class="btn" id="unitClose">${t('modal.cancel')}</button>
      </div>
    </div>
  `;

  overlay.querySelector('#unitClose').addEventListener('click', hide);
  overlay.querySelector('#unitSaveBtn').addEventListener('click', handleSave);
  overlay.querySelector('#unitNameInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') hide();
  });

  renderList();
  overlay.classList.add('active');
  overlay.setAttribute('aria-label', t('unit.title'));
  setTimeout(() => overlay.querySelector('#unitNameInput').focus(), 100);
}

export function initUnitModal(callback) {
  onUpdate = callback;
}
