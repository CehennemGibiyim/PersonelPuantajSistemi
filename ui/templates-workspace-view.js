import {
  getPersonnelList,
  getShiftTemplates,
  addShiftTemplate,
  deleteShiftTemplate,
  updateShift
} from '../state.js';
import { getDutyTemplates, deleteDutyTemplate } from '../duty-template-state.js';
import { getDaysInMonth, t } from '../utils.js';
import { isPeriodLocked } from '../period-lock-state.js';
import { showToast } from './toast-view.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[ch]));

function templateRows(editable) {
  const templates = getShiftTemplates();
  if (!templates.length) return `<p class="templates-empty">${esc(t('advanced.noTemplates'))}</p>`;
  return templates.map(template => `
    <article class="template-workspace-row">
      <div class="template-workspace-row-copy">
        <strong>${esc(template.name)}</strong>
        <span>${esc(template.pattern)}</span>
      </div>
      <div class="template-workspace-row-actions">
        <button class="btn btn-small" type="button" data-template-apply="${esc(template.id)}"${editable ? '' : ' disabled'}>${esc(t('advanced.applyTemplate'))}</button>
        <button class="btn btn-small btn-danger" type="button" data-template-delete="${esc(template.id)}"${editable ? '' : ' disabled'}>${esc(t('modal.delete'))}</button>
      </div>
    </article>
  `).join('');
}

function personOptions() {
  return getPersonnelList().map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join('');
}

function dutyTemplateRows() {
  const templates = getDutyTemplates();
  if (!templates.length) return `<p class="templates-empty">${esc(t('dutySystem.noTemplates'))}</p>`;
  return templates.map(template => `
    <article class="template-workspace-row">
      <div class="template-workspace-row-copy">
        <strong>${esc(template.name)}</strong>
        <span>${esc(template.columns.map(column => `${column.service} (${column.shiftLabel})`).join(' · '))}</span>
      </div>
      <div class="template-workspace-row-actions">
        <button class="btn btn-small" type="button" data-duty-template-open="${esc(template.id)}">${esc(t('dutySystem.openDutyTemplate'))}</button>
        <button class="btn btn-small btn-danger" type="button" data-duty-template-delete="${esc(template.id)}">${esc(t('dutySystem.deleteTemplate'))}</button>
      </div>
    </article>
  `).join('');
}

function applyTemplate(container, id) {
  if (isPeriodLocked()) return showToast(t('periodLock.lockedMessage'), 'error');
  const template = getShiftTemplates().find(item => item.id === id);
  const person = container.querySelector('#templateWorkspacePerson')?.value || '';
  const startDay = Number(container.querySelector('#templateWorkspaceStart')?.value || 0);
  if (!template || !person || !startDay) return;
  template.pattern.split(',').map(value => value.trim()).filter(Boolean).forEach((code, index) => {
    const day = startDay + index;
    if (day <= getDaysInMonth()) updateShift(person, day, code);
  });
  showToast(t('advanced.templateApplied'), 'success');
}

export function renderTemplatesWorkspace(container, onUpdate, onBack, onOpenDuty) {
  if (!container) return;
  const editable = !isPeriodLocked();
  container.innerHTML = `
    <section class="templates-workspace glass" aria-labelledby="templatesWorkspaceTitle">
      <header class="templates-workspace-header">
        <div>
          <span class="templates-eyebrow">${esc(t('app.punchSystem'))}</span>
          <h1 id="templatesWorkspaceTitle">${esc(t('advanced.templateTitle'))}</h1>
          <p>${esc(t('advanced.templateName'))} · ${esc(t('advanced.addTemplate'))}</p>
        </div>
        <button class="btn" id="templatesWorkspaceBack" type="button">${esc(t('app.punchSystem'))}</button>
      </header>
      <div class="templates-workspace-grid">
        <section class="templates-workspace-card">
          <div class="templates-card-heading"><div><h2>${esc(t('advanced.addTemplate'))}</h2><p>${esc(t('advanced.templateName'))}</p></div><span class="templates-status ${editable ? 'is-open' : 'is-locked'}">${esc(t(editable ? 'periodLock.open' : 'periodLock.closed'))}</span></div>
          <div class="templates-form">
            <label class="modal-label" for="templateWorkspaceName">${esc(t('advanced.templateName'))}</label>
            <input class="modal-input" id="templateWorkspaceName" type="text" placeholder="${esc(t('advanced.templateName'))}"${editable ? '' : ' disabled'}>
            <label class="modal-label" for="templateWorkspacePattern">${esc(t('advanced.bulkTitle'))}</label>
            <input class="modal-input" id="templateWorkspacePattern" type="text" placeholder="G, G, N, İ..."${editable ? '' : ' disabled'}>
            <button class="btn btn-primary" id="templateWorkspaceSave" type="button"${editable ? '' : ' disabled'}>${esc(t('advanced.addTemplate'))}</button>
          </div>
        </section>
        <section class="templates-workspace-card">
          <div class="templates-card-heading"><div><h2>${esc(t('advanced.applyTemplate'))}</h2><p>${esc(t('advanced.day'))}</p></div></div>
          <div class="templates-form templates-apply-form">
            <label class="modal-label" for="templateWorkspacePerson">${esc(t('advanced.selectPerson'))}</label>
            <select class="modal-input" id="templateWorkspacePerson"${editable ? '' : ' disabled'}>${personOptions()}</select>
            <label class="modal-label" for="templateWorkspaceStart">${esc(t('advanced.day'))}</label>
            <input class="modal-input" id="templateWorkspaceStart" type="number" min="1" max="31" value="1"${editable ? '' : ' disabled'}>
            <p class="templates-apply-help">${esc(t('advanced.applyTemplate'))}</p>
          </div>
        </section>
      </div>
      <section class="templates-workspace-card templates-list-card">
        <div class="templates-card-heading"><div><h2>${esc(t('advanced.templateTitle'))}</h2><p>${esc(t('advanced.noTemplates'))}</p></div><strong class="templates-count">${getShiftTemplates().length}</strong></div>
        <div id="templateWorkspaceList" class="template-workspace-list">${templateRows(editable)}</div>
      </section>
      <section class="templates-workspace-card templates-list-card templates-duty-list-card">
        <div class="templates-card-heading"><div><h2>${esc(t('dutySystem.savedDutyTemplatesTitle'))}</h2><p>${esc(t('dutySystem.savedDutyTemplatesHint'))}</p></div><strong class="templates-count">${getDutyTemplates().length}</strong></div>
        <div id="dutyTemplateWorkspaceList" class="template-workspace-list">${dutyTemplateRows()}</div>
      </section>
    </section>
  `;

  container.querySelector('#templatesWorkspaceBack')?.addEventListener('click', onBack);
  container.querySelector('#templateWorkspaceSave')?.addEventListener('click', () => {
    if (isPeriodLocked()) return showToast(t('periodLock.lockedMessage'), 'error');
    const name = container.querySelector('#templateWorkspaceName')?.value.trim() || '';
    const pattern = container.querySelector('#templateWorkspacePattern')?.value.trim() || '';
    if (!name || !pattern) return showToast(t('advanced.bulkInvalid'), 'error');
    if (!addShiftTemplate(name, pattern)) return showToast(t('advanced.requestUpdateFailed'), 'error');
    showToast(t('advanced.saved'), 'success');
    onUpdate();
  });
  container.querySelector('#templateWorkspaceList')?.addEventListener('click', event => {
    const button = event.target.closest('[data-template-apply], [data-template-delete]');
    if (!button || isPeriodLocked()) return;
    if (button.dataset.templateDelete) {
      deleteShiftTemplate(button.dataset.templateDelete);
      showToast(t('advanced.saved'), 'success');
      onUpdate();
      return;
    }
    applyTemplate(container, button.dataset.templateApply);
    onUpdate();
  });
  container.querySelector('#dutyTemplateWorkspaceList')?.addEventListener('click', event => {
    const button = event.target.closest('[data-duty-template-open], [data-duty-template-delete]');
    if (!button) return;
    if (button.dataset.dutyTemplateDelete) {
      if (isPeriodLocked()) return showToast(t('periodLock.lockedMessage'), 'error');
      if (!deleteDutyTemplate(button.dataset.dutyTemplateDelete)) return showToast(t('dutySystem.templateApplyFailed'), 'error');
      showToast(t('dutySystem.templateDeleted'), 'success');
      onUpdate();
      return;
    }
    onOpenDuty?.(button.dataset.dutyTemplateOpen);
  });
}
