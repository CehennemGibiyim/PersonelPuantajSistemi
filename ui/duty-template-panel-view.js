import { getDutyTemplates, addDutyTemplate, deleteDutyTemplate, getDutyTemplate } from '../duty-template-state.js';
import { setDutyColumns } from '../state.js';
import { t } from '../utils.js';
import { esc, formatColumn } from './duty-roster-utils.js';
import { showToast } from './toast-view.js';
import { isPeriodLocked } from '../period-lock-state.js';

function templateList() {
  const list = getDutyTemplates();
  if (!list.length) return `<p class="advanced-muted">${t('dutySystem.noTemplates')}</p>`;
  return list.map(item => {
    const columns = item.columns.map(formatColumn).join(' · ');
    return `<div class="duty-template-row"><span><strong>${esc(item.name)}</strong><small>${esc(columns)}</small></span><span class="duty-template-actions"><button class="action-btn" data-duty-template-apply="${esc(item.id)}" aria-label="${esc(t('dutySystem.applyTemplate'))}" title="${esc(t('dutySystem.applyTemplate'))}"${isPeriodLocked() ? ' disabled' : ''}>↗</button><button class="action-btn action-btn-danger" data-duty-template-delete="${esc(item.id)}" aria-label="${esc(t('dutySystem.deleteTemplate'))}" title="${esc(t('dutySystem.deleteTemplate'))}"${isPeriodLocked() ? ' disabled' : ''}>×</button></span></div>`;
  }).join('');
}

export function renderDutyTemplatePanel(editable) {
  return `<section class="glass duty-templates-card"><div class="duty-section-heading"><div><h3>${t('dutySystem.templatesTitle')}</h3><p>${t('dutySystem.templatesHint')}</p></div></div><div class="duty-template-save"><input class="modal-input" id="dutyTemplateName" placeholder="${esc(t('dutySystem.templateName'))}"${editable ? '' : ' disabled'}><button class="btn btn-primary" id="dutyTemplateSave"${editable ? '' : ' disabled'}>${t('dutySystem.saveTemplate')}</button></div><div class="duty-template-list" id="dutyTemplateList">${templateList()}</div></section>`;
}

export function bindDutyTemplatePanel(container, columns, records, editable, onUpdate) {
  container.querySelector('#dutyTemplateSave')?.addEventListener('click', () => {
    if (isPeriodLocked()) return showToast(t('periodLock.lockedMessage'), 'error');
    const name = container.querySelector('#dutyTemplateName')?.value.trim() || '';
    if (!name || !columns.length) return showToast(t('dutySystem.templateRequired'), 'error');
    if (!addDutyTemplate(name, columns)) return showToast(t('dutySystem.templateSaveFailed'), 'error');
    onUpdate();
    showToast(t('dutySystem.templateSaved'), 'success');
  });

  container.querySelector('#dutyTemplateList')?.addEventListener('click', event => {
    const deleteId = event.target.dataset.dutyTemplateDelete;
    const applyId = event.target.dataset.dutyTemplateApply;
    if (deleteId) {
      if (isPeriodLocked()) return showToast(t('periodLock.lockedMessage'), 'error');
      if (deleteDutyTemplate(deleteId)) {
        onUpdate();
        showToast(t('dutySystem.templateDeleted'), 'success');
      }
      return;
    }
    if (!applyId) return;
    if (isPeriodLocked()) return showToast(t('periodLock.lockedMessage'), 'error');
    if (records.length) return showToast(t('dutySystem.templateApplyBlocked'), 'error');
    const template = getDutyTemplate(applyId);
    if (!template) return showToast(t('dutySystem.templateApplyFailed'), 'error');
    if (!editable) return;
    setDutyColumns(template.columns);
    onUpdate();
    showToast(t('dutySystem.templateApplied'), 'success');
  });
}
