import { init, getAdmins, setCurrentWeek, getCurrentWeek, getUnitName, getCurrentUnitId, setCurrentUnit, getUnits, isAdmin, canEdit } from './state.js';
import { getYear, getMonth, MONTHS_TR, t, initDesktopI18n } from './utils.js';
import { renderTabs } from './ui/tabs-view.js';
import { renderWeekTable } from './ui/week-table-view.js?v=32';
import { renderMonthlyTable } from './ui/monthly-table-view.js';
import { renderMonthSelector } from './ui/month-selector-view.js?v=2';
import { initModal } from './ui/modal-view.js';
import { initAdminModal } from './ui/admin-modal-view.js';
import { initUnitModal } from './ui/unit-modal-view.js';
import { initRoleModal } from './ui/role-modal-view.js';
import { initPersonnelDetailModal } from './ui/personnel-detail-modal-view.js';
import { showPersonnelDirectory } from './ui/personnel-directory-view.js';
import { initReportsPanel } from './ui/reports-panel-view.js';
import { initContactPanel } from './ui/contact-panel-view.js';
import { initWarningsPanel } from './ui/warnings-panel-view.js';
import { initLanguageModal } from './ui/language-view.js';
import { initSwapRequestsPanel } from './ui/swap-request-view.js';
import { showToast } from './ui/toast-view.js';
import { initExport, exportToExcel, exportToCsv } from './export.js?v=24';
import { initPrintView, doPrint, showPrintOptions } from './ui/print-view.js?v=28';
import { doDutyPrint } from './ui/duty-print-view.js?v=22';
import { initAdvancedPanel, maybeAutoBackup } from './ui/advanced-panel-view.js?v=14';
import { renderDutySystem } from './ui/duty-system-view.js?v=21';
import { downloadProject } from './project-download.js';
import { renderSidebar } from './ui/sidebar-view.js?v=4';
import { exportJson } from './ui/advanced-panel-view.js?v=14';
import { initAvailability } from './availability-state.js';
import { initLeaveRequests, syncCurrentMonthLeaveRequests } from './leave-state.js';
import { showAvailabilityCalendar } from './ui/availability-calendar-view.js';
import { initDutyTemplates } from './duty-template-state.js';
import { initPeriodLock, isPeriodLocked } from './period-lock-state.js';
import { initPeriodApproval } from './period-approval-state.js';
import { initAuditLog } from './audit-state.js';
import { renderOnboarding } from './ui/onboarding-view.js';
import { verifyAppShell } from './ui/startup-checks.js';
import { renderDashboard } from './ui/dashboard-view.js';
import { renderFavorites } from './ui/favorites-view.js';
import { renderSecurityStatus } from './ui/security-status-view.js';
import { initUnitAdmins, syncCurrentUnitAdmins } from './admin-state.js';

let tabContainer, tableContainer, weekLabel, monthlyContainer, monthSelectorContainer, workspaceView, dutySystemView, viewToolbar;
let activeSystem = 'punch';
let activeMenu = 'punch';
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));

function renderAll() {
  const year = getYear();
  const month = getMonth();
  const unit = getUnitName();
  const isDutySystem = activeSystem === 'duty';
  const subtitle = document.getElementById('appSubtitle');
  const title = document.querySelector('[data-i18n="app.title"]');
  if (title) title.textContent = t('app.title');
  if (subtitle) subtitle.textContent = t('dutySystem.subtitle', { unit, month: MONTHS_TR[month], year });

  renderIcons();
  renderSidebar(document.getElementById('sidebar'), { activeSystem, activeAction: activeMenu, actions: sidebarActions() });
  renderHeaderActions();
  renderViewToolbar();
  const dashboard = document.getElementById('dashboardView');
  if (dashboard) {
    dashboard.style.display = isDutySystem ? 'none' : '';
    if (!isDutySystem) {
      const actions = dashboardActions();
      renderDashboard(dashboard, actions);
      renderFavorites(dashboard.querySelector('[data-favorites-host]'), actions);
      renderSecurityStatus(dashboard.querySelector('[data-security-status]'), actions.security);
    }
  }
  if (workspaceView) workspaceView.style.display = isDutySystem ? 'none' : '';
  if (dutySystemView) dutySystemView.style.display = isDutySystem ? 'block' : 'none';
  if (isDutySystem) {
    renderUnitSelector();
    renderDutySystem(dutySystemView, renderAll);
    updateEditability();
    return;
  }
  updateBottomActions();
  renderLegend();
  renderUnitSelector();
  renderTabs(tabContainer, renderAll);

  const week = getCurrentWeek();
  if (week === -1) {
    document.getElementById('monthlyLabel').style.display = 'none';
    monthlyContainer.style.display = 'none';
    tableContainer.innerHTML = '';
    weekLabel.style.display = 'none';
    renderReportsIfActive();
  } else {
    document.getElementById('monthlyLabel').style.display = 'block';
    monthlyContainer.style.display = 'block';
    renderMonthlyTable(monthlyContainer, renderAll);
    renderWeekTable(tableContainer, weekLabel, renderAll);
  }

  renderFooter();
  updateEditability();
}

function renderIcons() {
  const unitIcon = document.getElementById('unitIcon');
  const calendarIcon = document.getElementById('calendarIcon');
  if (unitIcon) unitIcon.textContent = '🏥';
  if (calendarIcon) calendarIcon.textContent = '📅';
}

function renderHeaderActions() {
  const container = document.getElementById('headerActions');
  if (!container) return;
  if (!container.querySelector('#projectDownloadBtn') || !container.querySelector('#editAdminsBtn')) {
    container.innerHTML = `<button class="btn" id="projectDownloadBtn" style="display:none">${t('advanced.projectDownload')}</button><button class="btn" id="editAdminsBtn" style="display:none">${t('app.editAdmins')}</button>`;
  }
}

function renderViewToolbar() {
  if (!viewToolbar) return;
  const isDutySystem = activeSystem === 'duty';
  viewToolbar.innerHTML = `
    <div class="view-toolbar-context">
      <span class="view-toolbar-label">${t(isDutySystem ? 'dutySystem.pageTitle' : 'app.punchSystem')}</span>
      <span class="view-toolbar-hint">${t('app.viewActionsHint')}</span>
      <span class="period-lock-inline ${isPeriodLocked() ? 'is-locked' : 'is-open'}">${t(isPeriodLocked() ? 'periodLock.closed' : 'periodLock.open')}</span>
    </div>
    <div class="view-toolbar-actions">
      <button class="btn btn-primary" id="contextPrintBtn" type="button"><span class="toolbar-icon" aria-hidden="true">⎙</span>${t('app.printBtn')}</button>
      <button class="btn" id="contextExcelBtn" type="button"><span class="toolbar-icon" aria-hidden="true">⇩</span>${t('app.exportBtn')}</button>
    </div>`;
  viewToolbar.querySelector('#contextPrintBtn')?.addEventListener('click', isDutySystem ? doDutyPrint : showPrintOptions);
  viewToolbar.querySelector('#contextExcelBtn')?.addEventListener('click', exportToExcel);
}

async function handleProjectDownload(button) {
  if (!button || button.disabled) return;
  const menuButton = button.classList.contains('sidebar-item');
  const idleLabel = menuButton ? t('sidebar.project') : t('advanced.projectDownload');
  button.disabled = true;
  button.textContent = t('advanced.projectDownloadLoading');
  try {
    await downloadProject();
    showToast(t('advanced.projectDownloaded'), 'success');
  } catch (error) {
    console.error('Project download failed:', error);
    showToast(t('advanced.projectDownloadFailed'), 'error');
  } finally {
    button.disabled = false;
    button.textContent = idleLabel;
  }
}

function renderBottomActions() {
  const container = document.getElementById('bottomActions');
  if (!container) return;

  container.innerHTML = `
    <button class="btn btn-primary" id="addPersonnelBtn" data-i18n="app.addPersonnel">${t('app.addPersonnel')}</button>
    <button class="btn" id="swapRequestsBtn" data-i18n="app.swapRequestsBtn">${t('app.swapRequestsBtn')}</button>
    <button class="btn" id="warningsBtn" data-i18n="app.warningsBtn">${t('app.warningsBtn')}</button>
    <button class="btn" id="contactBtn" data-i18n="app.contactBtn">${t('app.contactBtn')}</button>
    <button class="btn" id="exportBtn" data-i18n="app.exportBtn">${t('app.exportBtn')}</button>
    <button class="btn" id="printBtn" data-i18n="app.printBtn">${t('app.printBtn')}</button>
    <button class="btn" id="refreshBtn" data-i18n="app.refreshBtn">${t('app.refreshBtn')}</button>
    <button class="btn" id="languageBtn" data-i18n="app.languageBtn">${t('app.languageBtn')}</button>
    <button class="btn btn-primary" id="advancedBtn">${t('app.advancedBtn')}</button>
  `;
}

function sidebarActions() {
  const click = id => document.getElementById(id)?.click();
  const markMenu = action => {
    activeMenu = action;
    renderSidebar(document.getElementById('sidebar'), { activeSystem, activeAction: activeMenu, actions: sidebarActions() });
  };
  const decorateWorkspaceOverlay = () => {
    let attempts = 0;
    const findOverlay = () => {
      const activeOverlay = [...document.querySelectorAll('.modal-overlay.active')].pop();
      if (activeOverlay) {
        activeOverlay.classList.add('workspace-overlay');
        return;
      }
      if (++attempts < 12) setTimeout(findOverlay, 50);
    };
    findOverlay();
  };
  const openWorkspacePanel = (action, callback) => {
    markMenu(action);
    callback();
    decorateWorkspaceOverlay();
  };
  const showPunch = () => { activeMenu = 'punch'; activeSystem = 'punch'; setCurrentWeek(0); renderAll(); };
  const showDuty = () => { activeMenu = 'duty'; activeSystem = 'duty'; renderAll(); };
  const showReports = (followUp = '') => {
    activeMenu = followUp ? 'backup' : 'fairness';
    activeSystem = 'punch';
    setCurrentWeek(-1);
    renderAll();
    if (followUp) setTimeout(() => click(followUp), 100);
  };
  return {
    punch: showPunch,
    duty: showDuty,
    personnel: () => { activeMenu = 'personnel'; showPersonnelDirectory(renderAll); renderSidebar(document.getElementById('sidebar'), { activeSystem, activeAction: activeMenu, actions: sidebarActions() }); },
    departments: () => openWorkspacePanel('departments', () => click('manageUnitsBtn')),
    leave: () => openWorkspacePanel('leave', () => showAvailabilityCalendar(renderAll)),
    swap: () => openWorkspacePanel('swap', () => click('swapRequestsBtn')),
    templates: () => openWorkspacePanel('templates', () => click('advancedBtn')),
    query: () => { showPunch(); activeMenu = 'query'; renderSidebar(document.getElementById('sidebar'), { activeSystem, activeAction: activeMenu, actions: sidebarActions() }); setTimeout(() => { click('advancedBtn'); decorateWorkspaceOverlay(); }, 0); },
    fairness: () => showReports(),
    users: () => openWorkspacePanel('users', () => click('roleBtn')),
    admins: () => openWorkspacePanel('admins', () => click('editAdminsBtn')),
    requests: () => openWorkspacePanel('requests', () => click('swapRequestsBtn')),
    warnings: () => openWorkspacePanel('warnings', () => click('warningsBtn')),
    contact: () => openWorkspacePanel('contact', () => click('contactBtn')),
    backup: () => showReports('backupCurrentBtn'),
    json: () => { markMenu('json'); exportJson(); },
    excel: () => { markMenu('excel'); exportToExcel(); },
    pdf: () => { markMenu('pdf'); activeSystem === 'duty' ? doDutyPrint() : showPrintOptions(); },
    csv: () => { markMenu('csv'); exportToCsv(); },
    print: () => { markMenu('print'); activeSystem === 'duty' ? doDutyPrint() : showPrintOptions(); },
    refresh: () => { markMenu('refresh'); renderAll(); showToast(t('app.toastRefreshed'), 'info'); },
    project: button => { markMenu('project'); handleProjectDownload(button); }
  };
}

function dashboardActions() {
  return {
    personnel: () => {
      activeMenu = 'personnel';
      renderSidebar(document.getElementById('sidebar'), { activeSystem, activeAction: activeMenu, actions: sidebarActions() });
      if (canEdit() && !isPeriodLocked()) document.getElementById('addPersonnelBtn')?.click();
      else showPersonnelDirectory(renderAll);
    },
    duty: () => { activeMenu = 'duty'; activeSystem = 'duty'; renderAll(); },
    leave: () => {
      activeMenu = 'leave';
      renderSidebar(document.getElementById('sidebar'), { activeSystem, activeAction: activeMenu, actions: sidebarActions() });
      showAvailabilityCalendar(renderAll);
      setTimeout(() => document.querySelector('.modal-overlay.active')?.classList.add('workspace-overlay'), 40);
    },
    reports: () => { activeMenu = 'fairness'; setCurrentWeek(-1); renderAll(); },
    alerts: () => {
      activeMenu = 'warnings';
      renderSidebar(document.getElementById('sidebar'), { activeSystem, activeAction: activeMenu, actions: sidebarActions() });
      document.getElementById('warningsBtn')?.click();
      setTimeout(() => document.querySelector('.modal-overlay.active')?.classList.add('workspace-overlay'), 40);
    },
    security: () => { activeMenu = 'backup'; setCurrentWeek(-1); renderAll(); setTimeout(() => document.getElementById('backupCurrentBtn')?.click(), 100); }
  };
}

function updateBottomActions() {
  const addBtn = document.getElementById('addPersonnelBtn');
  if (addBtn) addBtn.style.display = canEdit() && !isPeriodLocked() ? '' : 'none';
}

function renderLegend() {
  const container = document.getElementById('legendContainer');
  if (!container) return;
  container.innerHTML = [
    ['empty', t('app.legendEmpty')],
    ['G', t('app.legendG')],
    ['G2', t('app.legendG2')],
    ['N', t('app.legendN')],
    ['N2', t('app.legendN2')],
    ['Hf', t('app.legendHf')],
    ['B', t('app.legendB')],
    ['B2', t('app.legendB2')],
    ['Leave', t('app.legendLeave')],
    ['NB', t('app.legendNB')]
  ].map(([key, text]) => `
    <div class="leg-item"><span class="leg-dot leg-${key}"></span><span>${text}</span></div>
  `).join('');
}

function renderUnitSelector() {
  const container = document.getElementById('unitSelector');
  if (!container) return;
  const units = getUnits();
  const currentId = getCurrentUnitId();

  let html = `<select id="unitSelect" class="day-input" style="min-width:160px;padding:6px 10px;font-size:13px;background:rgba(255,255,255,0.12);border-color:rgba(255,255,255,0.2)">`;
  units.forEach(u => {
    html += `<option value="${esc(u.id)}" ${u.id === currentId ? 'selected' : ''}>${esc(u.name)}</option>`;
  });
  html += `</select>`;

  if (isAdmin()) {
    html += `<button class="btn" id="manageUnitsBtn" style="padding:6px 10px;font-size:12px" aria-label="Birim Yönetimi">⋯</button>`;
  }

  container.innerHTML = html;

  const select = container.querySelector('#unitSelect');
  if (select) {
    select.addEventListener('change', async () => {
      setCurrentUnit(select.value);
      await init();
      await initAvailability();
      await initLeaveRequests();
      syncCurrentMonthLeaveRequests();
      await initDutyTemplates();
      await initPeriodLock(getCurrentUnitId(), getYear(), getMonth());
      await initPeriodApproval(getCurrentUnitId(), getYear(), getMonth());
      await initAuditLog();
      await initUnitAdmins();
      await syncCurrentUnitAdmins();
      renderAll();
      showToast(`${getUnitName()} birimi yüklendi.`, 'info');
    });
  }

  const manageBtn = container.querySelector('#manageUnitsBtn');
  if (manageBtn) {
    manageBtn.addEventListener('click', () => {
      import('./ui/unit-modal-view.js').then(m => m.showUnitModal());
    });
  }
}

function renderReportsIfActive() {
  const panel = document.getElementById('reportsPanel');
  if (!panel) return;
  const week = getCurrentWeek();
  panel.style.display = week === -1 ? 'block' : 'none';
  if (week === -1) {
    initReportsPanel(panel);
  }
}

function renderFooter() {
  const a = getAdmins();
  const unit = getUnitName();
  const footer = document.getElementById('footerBar');
  if (footer) {
    footer.replaceChildren();
    const addEntry = (labelKey, value, separator = '') => {
      if (separator) footer.append(document.createTextNode(separator));
      footer.append(document.createTextNode(`${labelKey === 'advanced.headNurse' ? `${unit} ` : ''}${t(labelKey)}: `));
      const strong = document.createElement('strong');
      strong.textContent = value || '';
      footer.append(strong);
    };
    addEntry('advanced.headNurse', a.headNurse);
    addEntry('advanced.manager', a.manager, '  |  ');
    addEntry('advanced.chiefDoctor', a.chiefDoctor, '  |  ');
  }
}

function updateEditability() {
  const editable = canEdit() && !isPeriodLocked();
  document.querySelectorAll('.day-input').forEach(el => {
    if (el.id === 'unitSelect' || el.id === 'monthSelect' || el.id === 'yearSelect') return;
    el.disabled = !editable;
  });
  document.querySelectorAll('[data-edit], [data-edit-m], [data-delete], [data-delete-m], #addPersonnelBtn').forEach(el => {
    el.style.display = editable ? '' : 'none';
  });
}

async function handleMonthChange() {
  setCurrentWeek(0);
  await init();
  await initAvailability();
  await initLeaveRequests();
  syncCurrentMonthLeaveRequests();
  await initPeriodLock(getCurrentUnitId(), getYear(), getMonth());
  await initPeriodApproval(getCurrentUnitId(), getYear(), getMonth());
  await initAuditLog();
  await initUnitAdmins();
  await syncCurrentUnitAdmins();
  renderAll();
  showToast(`${MONTHS_TR[getMonth()]} ${getYear()} yüklendi.`, 'info');
}

function bindButtons() {
  const addBtn = document.getElementById('addPersonnelBtn');
  if (addBtn) {
    initModal(addBtn, (action) => {
      renderAll();
      if (action === 'add') showToast(t('app.toastPersonnelAdded'), 'success');
      else if (action === 'edit') showToast(t('app.toastPersonnelEdited'), 'success');
      else if (action === 'delete') showToast(t('app.toastPersonnelDeleted'), 'success');
    });
  }

  const adminBtn = document.getElementById('editAdminsBtn');
  if (adminBtn) {
    initAdminModal(adminBtn, () => {
      renderAll();
      showToast(t('app.toastAdminsUpdated'), 'success');
    });
  }

  const projectDownloadBtn = document.getElementById('projectDownloadBtn');
  if (projectDownloadBtn) projectDownloadBtn.addEventListener('click', () => handleProjectDownload(projectDownloadBtn));

  initUnitModal(() => renderAll());
  initRoleModal(document.getElementById('roleBtn'), () => renderAll());
  initPersonnelDetailModal();

  const swapRequestsBtn = document.getElementById('swapRequestsBtn');
  if (swapRequestsBtn) initSwapRequestsPanel(swapRequestsBtn);

  const warningsBtn = document.getElementById('warningsBtn');
  if (warningsBtn) initWarningsPanel(warningsBtn);

  const contactBtn = document.getElementById('contactBtn');
  if (contactBtn) initContactPanel(contactBtn);

  const exportBtn = document.getElementById('exportBtn');
  if (exportBtn) initExport(exportBtn);

  initPrintView(document.getElementById('printView'));

  const printBtn = document.getElementById('printBtn');
  if (printBtn) printBtn.addEventListener('click', showPrintOptions);

  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      renderAll();
      showToast(t('app.toastRefreshed'), 'info');
    });
  }

  const languageBtn = document.getElementById('languageBtn');
  if (languageBtn) {
    initLanguageModal(languageBtn, () => {
      window.location.reload();
    });
  }

  initAdvancedPanel(document.getElementById('advancedBtn'), () => renderAll());
}

document.addEventListener('DOMContentLoaded', async () => {
  tabContainer = document.getElementById('weekTabs');
  tableContainer = document.getElementById('tableContainer');
  weekLabel = document.getElementById('weekLabel');
  monthlyContainer = document.getElementById('monthlyContainer');
  monthSelectorContainer = document.getElementById('monthSelector');
  workspaceView = document.getElementById('workspaceView');
  dutySystemView = document.getElementById('dutySystemView');
  viewToolbar = document.getElementById('viewToolbar');

  await initDesktopI18n();
  await init();
  await initAvailability();
  await initLeaveRequests();
  syncCurrentMonthLeaveRequests();
  await initDutyTemplates();
  await initPeriodLock(getCurrentUnitId(), getYear(), getMonth());
  await initPeriodApproval(getCurrentUnitId(), getYear(), getMonth());
  await initAuditLog();
  await initUnitAdmins();
  await syncCurrentUnitAdmins();
  maybeAutoBackup();
  try {
    const savedTheme = await window.miniappsAI?.storage?.getItem('themePreference');
    if (['light', 'dark', 'sage', 'sand'].includes(savedTheme)) document.documentElement.dataset.theme = savedTheme;
  } catch (e) { /* theme preference is optional */ }
  renderMonthSelector(monthSelectorContainer, handleMonthChange);
  renderHeaderActions();
  renderBottomActions();
  bindButtons();
  renderAll();
  await renderOnboarding(document.getElementById('onboardingView'));
  verifyAppShell();
});
