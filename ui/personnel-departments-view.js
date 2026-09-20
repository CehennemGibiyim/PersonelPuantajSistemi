import { getPersonnelType, getUnits, getCurrentUnitId, canEdit } from '../state.js';
import { getPersonnelMembership, syncPersonnelDepartments, copyPersonnelPhotoToDepartments } from '../personnel-network.js';
import { t } from '../utils.js';
import { showToast } from './toast-view.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
let overlay = null;
let closeCurrent = () => {};

function close() { overlay?.classList.remove('active'); }

export async function showPersonnelDepartments(name, afterSave = () => {}) {
  if (!name || !canEdit()) return;
  const units = getUnits();
  const currentId = getCurrentUnitId();
  const membership = await getPersonnelMembership(name, units);
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'modal-overlay personnel-departments-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    document.body.appendChild(overlay);
    overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
  }
  overlay.innerHTML = `<div class="modal glass personnel-departments-modal"><div class="directory-heading"><div><h2 class="modal-title">${esc(t('departmentAssign.title'))}</h2><p class="directory-unit">${esc(name)}</p></div><button class="action-btn" type="button" data-departments-close aria-label="${esc(t('modal.cancel'))}">×</button></div><p class="personnel-assignment-hint">${esc(t('departmentAssign.hint'))}</p><div class="personnel-department-list">${units.map(unit => `<label class="personnel-department-option${unit.id === currentId ? ' current' : ''}"><input type="checkbox" value="${esc(unit.id)}"${membership.includes(unit.id) ? ' checked' : ''}${unit.id === currentId ? ' disabled' : ''}><span>${esc(unit.name)}</span>${unit.id === currentId ? `<small>${esc(t('departmentAssign.current'))}</small>` : ''}</label>`).join('')}</div><p class="modal-error" data-departments-error style="display:none"></p><div class="modal-actions"><button class="btn" type="button" data-departments-cancel>${esc(t('modal.cancel'))}</button><button class="btn btn-primary" type="button" data-departments-save>${esc(t('modal.save'))}</button></div></div>`;
  overlay.querySelectorAll('[data-departments-close], [data-departments-cancel]').forEach(button => button.addEventListener('click', close));
  overlay.querySelector('[data-departments-save]').addEventListener('click', async () => {
    const button = overlay.querySelector('[data-departments-save]');
    const error = overlay.querySelector('[data-departments-error]');
    const selected = [...overlay.querySelectorAll('input[type="checkbox"]:checked')].map(input => input.value);
    button.disabled = true;
    try {
      await syncPersonnelDepartments(name, getPersonnelType(name), selected, currentId, units);
      await copyPersonnelPhotoToDepartments(name, selected, currentId);
      close();
      showToast(t('departmentAssign.saved'), 'success');
      afterSave();
    } catch (failure) {
      console.error('Department assignment save failed:', failure);
      error.textContent = t('departmentAssign.failed');
      error.style.display = 'block';
      button.disabled = false;
    }
  });
  overlay.classList.add('active');
  closeCurrent = close;
}

export function closePersonnelDepartments() { closeCurrent(); }
