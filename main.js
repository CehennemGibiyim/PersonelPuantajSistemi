import { init, getAdmins, setCurrentWeek, getCurrentWeek, getUnitName, getCurrentUnitId, setCurrentUnit, getUnits, isAdmin, canEdit } from './state.js';
import { getYear, getMonth, MONTHS_TR, t, initDesktopI18n } from './utils.js';
import { renderTabs } from './ui/tabs-view.js';
import { renderWeekTable } from './ui/week-table-view.js?v=33';
import { renderMonthlyTable } from './ui/monthly-table-view.js';
import { renderMonthSelector } from './ui/month-selector-view.js?v=4';
import { initModal } from './ui/modal-view.js';
import { initAdminModal } from './ui/admin-modal-view.js';
import { initUnitModal, showUnitModal } from './ui/unit-modal-view.js';
import { initRoleModal, showRoleModal } from './ui/role-modal-view.js';
import { initPersonnelDetailModal } from './ui/personnel-detail-modal-view.js';
import { showPersonnelDirectory } from './ui/personnel-directory-view.js';
import { initReportsPanel } from './ui/reports-panel-view.js?v=24';
import { initContactPanel, showContactPanel } from './ui/contact-panel-view.js';
import { initWarningsPanel, showWarningsPanel } from './ui/warnings-panel-view.js';
import { initLanguageModal } from './ui/language-view.js';
import { initSwapRequestsPanel, showSwapRequestsPanel } from './ui/swap-request-view.js';
import { showToast } from './ui/toast-view.js';
import { initExport, exportPunchToExcel, exportDutyToExcel, exportPunchToCsv, exportDutyToCsv } from './export.js?v=27';
import { initPrintView, doPrint, showPrintOptions } from './ui/print-view.js?v=29';
import { doDutyPrint } from './ui/duty-print-view.js?v=23';
import { initAdvancedPanel, maybeAutoBackup, showAdvancedPanel } from './ui/advanced-panel-view.js?v=15';
import { renderDutySystem } from './ui/duty-system-view.js?v=27';
import { downloadProject } from './project-download.js';
import { renderSidebar } from './ui/sidebar-view.js?v=6';
import { exportJson } from './ui/advanced-panel-view.js?v=15';
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
import { renderTemplatesWorkspace } from './ui/templates-workspace-view.js?v=6';
import { initUnitAdmins, syncCurrentUnitAdmins } from './admin-state.js';
import { initPersonnelPhotos } from './personnel-photo-state.js';
import { showPersonnelAttendance } from './ui/personnel-attendance-view.js';
import { ensureCurrentUnitMemberships } from './personnel-network.js';

let tabContainer, tableContainer, weekLabel, monthlyContainer, monthSelectorContainer, workspaceView, templatesWorkspaceView, dutySystemView, viewToolbar;
let activeSystem = 'punch';
let activeMenu = 'punch';
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
const titleCaseTr = value => String(value ?? '').trim().toLocaleLowerCase('tr-TR').replace(/(^|[\s\-/])([\p{L}])/gu, (_, prefix, letter) => `${prefix}${letter.toLocaleUpperCase('tr-TR')}`);
function initDesktopWindow() {
  if (!window.desktopAPI?.isDesktop) return;
  document.body.classList.add('desktop-mode');

  const minimize = document.getElementById('windowMinimizeBtn');
  const maximize = document.getElementById('windowMaximizeBtn');
  const close = document.getElementById('windowCloseBtn');
  minimize?.addEventListener('click', () => window.desktopAPI.minimizeWindow());
  maximize?.addEventListener('click', () => window.desktopAPI.toggleMaximizeWindow());
  close?.addEventListener('click', () => window.desktopAPI.closeWindow());

  const titlebar = document.getElementById('desktopTitlebar');
  titlebar?.addEventListener('dblclick', event => {
    if (event.target.closest('.desktop-titlebar__controls')) return;
    window.desktopAPI.toggleMaximizeWindow();
  });

  document.documentElement.dataset.theme = 'dark';
}
function returnToPunchWorkspace() {
  activeSystem = 'punch';
  activeMenu = 'punch';
  setCurrentWeek(0);
  renderAll();
}

function renderAll() {
  const year = getYear();
  const month = getMonth();
  const unit = getUnitName();
  const isDutySystem = activeSystem === 'duty';
  const isPunchSurface = activeSystem === 'punch' && activeMenu === 'punch';
  const isReportsSurface = activeSystem === 'punch' && ['fairness', 'backup'].includes(activeMenu);
  const isTemplatesSurface = activeSystem === 'punch' && activeMenu === 'templates';
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
    dashboard.style.display = isPunchSurface ? '' : 'none';
    if (isPunchSurface) {
      const actions = dashboardActions();
      renderDashboard(dashboard, actions);
      renderFavorites(dashboard.querySelector('[data-favorites-host]'), actions);
      renderSecurityStatus(dashboard.querySelector('[data-security-status]'), actions.security);
    }
  }
  if (document.getElementById('onboardingView')) document.getElementById('onboardingView').style.display = isPunchSurface ? '' : 'none';
  if (viewToolbar) viewToolbar.style.display = isPunchSurface || isDutySystem || isTemplatesSurface ? '' : 'none';
  if (workspaceView) {
    workspaceView.style.display = isPunchSurface || isReportsSurface ? '' : 'none';
    workspaceView.classList.toggle('reports-only', isReportsSurface);
  }
  if (templatesWorkspaceView) {
    templatesWorkspaceView.style.display = isTemplatesSurface ? '' : 'none';
    if (isTemplatesSurface) renderTemplatesWorkspace(templatesWorkspaceView, renderAll, returnToPunchWorkspace, () => {
      activeMenu = 'duty';
      activeSystem = 'duty';
      renderAll();
    });
  }
  if (dutySystemView) dutySystemView.style.display = isDutySystem ? 'block' : 'none';
  if (isDutySystem) {
    renderUnitSelector();
    renderDutySystem(dutySystemView, renderAll);
    updateEditability();
    return;
  }
  if (isTemplatesSurface) {
    updateEditability();
    return;
  }
  updateBottomActions();
  renderLegend();
  renderUnitSelector();
  renderTabs(tabContainer, renderAll);

  const week = getCurrentWeek();
  if (week === -1 || isReportsSurface) {
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
  const exportLabel = t(isDutySystem ? 'dutySystem.exportBtn' : 'app.exportBtn');
  const printLabel = t(isDutySystem ? 'dutySystem.printBtn' : 'app.punchPrintBtn');
  const viewHint = t(isDutySystem ? 'dutySystem.viewActionsHint' : 'app.viewActionsHint');
  viewToolbar.innerHTML = `
    <div class="view-toolbar-context">
      <span class="view-toolbar-label">${t(isDutySystem ? 'dutySystem.pageTitle' : 'app.punchSystem')}</span>
      <span class="view-toolbar-hint">${viewHint}</span>
      <span class="period-lock-inline ${isPeriodLocked() ? 'is-locked' : 'is-open'}">${t(isPeriodLocked() ? 'periodLock.closed' : 'periodLock.open')}</span>
    </div>
    <div class="view-toolbar-actions">
      <button class="btn btn-primary" id="contextPrintBtn" type="button"><span class="toolbar-icon" aria-hidden="true">⎙</span>${printLabel}</button>
      <button class="btn" id="contextExcelBtn" type="button"><span class="toolbar-icon" aria-hidden="true">⇩</span>${exportLabel}</button>
    </div>`;
  viewToolbar.querySelector('#contextPrintBtn')?.addEventListener('click', isDutySystem ? doDutyPrint : showPrintOptions);
  viewToolbar.querySelector('#contextExcelBtn')?.addEventListener('click', isDutySystem ? exportDutyToExcel : exportPunchToExcel);
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
    activeSystem = 'punch';
    activeMenu = action;
    renderAll();
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
    personnel: () => openWorkspacePanel('personnel', () => showPersonnelDirectory(renderAll, returnToPunchWorkspace)),
    personAttendance: () => openWorkspacePanel('personAttendance', () => showPersonnelAttendance('', returnToPunchWorkspace)),
    departments: () => openWorkspacePanel('departments', showUnitModal),
    leave: () => openWorkspacePanel('leave', () => showAvailabilityCalendar(renderAll)),
    swap: () => openWorkspacePanel('swap', showSwapRequestsPanel),
    templates: () => { activeSystem = 'punch'; activeMenu = 'templates'; renderAll(); },
    query: () => { showPunch(); activeMenu = 'query'; renderSidebar(document.getElementById('sidebar'), { activeSystem, activeAction: activeMenu, actions: sidebarActions() }); setTimeout(() => { click('advancedBtn'); decorateWorkspaceOverlay(); }, 0); },
    fairness: () => showReports(),
    users: () => openWorkspacePanel('users', showRoleModal),
    admins: () => openWorkspacePanel('admins', () => document.getElementById('editAdminsBtn')?.click()),
    requests: () => openWorkspacePanel('requests', showSwapRequestsPanel),
    warnings: () => openWorkspacePanel('warnings', showWarningsPanel),
    contact: () => openWorkspacePanel('contact', showContactPanel),
    backup: () => showReports('backupCurrentBtn'),
    json: () => { markMenu('json'); exportJson(); },
    punchExcel: () => { markMenu('punchExcel'); exportPunchToExcel(); },
    punchPdf: () => { markMenu('punchPdf'); showPrintOptions(); },
    punchCsv: () => { markMenu('punchCsv'); exportPunchToCsv(); },
    punchPrint: () => { markMenu('punchPrint'); showPrintOptions(); },
    dutyExcel: () => { markMenu('dutyExcel'); exportDutyToExcel(); },
    dutyPdf: () => { markMenu('dutyPdf'); doDutyPrint(); },
    dutyCsv: () => { markMenu('dutyCsv'); exportDutyToCsv(); },
    dutyPrint: () => { markMenu('dutyPrint'); doDutyPrint(); },
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

  let html = `<div class="unit-selector-bar" role="tablist" aria-label="${esc(t('sidebar.departments'))}">`;
  units.forEach(u => {
    html += `<button class="unit-chip${u.id === currentId ? ' active' : ''}" type="button" role="tab" aria-selected="${u.id === currentId}" data-unit-id="${esc(u.id)}"><span class="unit-chip-dot" aria-hidden="true"></span><span>${esc(titleCaseTr(u.name))}</span></button>`;
  });
  html += `</div>`;

  if (isAdmin()) {
    html += `<button class="btn unit-manage-btn" id="manageUnitsBtn" type="button" aria-label="${esc(t('unit.title'))}">⋯</button>`;
  }

  container.innerHTML = html;

  container.querySelectorAll('[data-unit-id]').forEach(button => {
    button.addEventListener('click', async () => {
      const nextId = button.dataset.unitId;
      if (!nextId || nextId === getCurrentUnitId()) return;
      setCurrentUnit(nextId);
      await init();
      await ensureCurrentUnitMemberships(getUnits(), getCurrentUnitId());
      await initPersonnelPhotos();
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
      showToast(`${titleCaseTr(getUnitName())} birimi yüklendi.`, 'info');
    });
  });

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
  await ensureCurrentUnitMemberships(getUnits(), getCurrentUnitId());
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

export async function startApp() {
  try {
    const markBootStage = stage => {
      window.__miniappBootStage = stage;
      console.log(`[Renderer] Başlangıç aşaması: ${stage}`);
    };
    markBootStage('arayüz alanları hazırlanıyor');
    tabContainer = document.getElementById('weekTabs');
    tableContainer = document.getElementById('tableContainer');
    weekLabel = document.getElementById('weekLabel');
    monthlyContainer = document.getElementById('monthlyContainer');
    monthSelectorContainer = document.getElementById('monthSelector');
    workspaceView = document.getElementById('workspaceView');
    templatesWorkspaceView = document.getElementById('templatesWorkspaceView');
    dutySystemView = document.getElementById('dutySystemView');
    viewToolbar = document.getElementById('viewToolbar');

    markBootStage('dil dosyası yükleniyor');
    await initDesktopI18n();
    initDesktopWindow();
    markBootStage('ana puantaj verisi yükleniyor');
    await init();
    markBootStage('personel birimleri eşitleniyor');
    await ensureCurrentUnitMemberships(getUnits(), getCurrentUnitId());
    markBootStage('personel fotoğrafları hazırlanıyor');
    await initPersonnelPhotos();
    markBootStage('uygunluk ve izin kayıtları yükleniyor');
    await initAvailability();
    await initLeaveRequests();
    syncCurrentMonthLeaveRequests();
    markBootStage('şablon ve dönem ayarları yükleniyor');
    await initDutyTemplates();
    await initPeriodLock(getCurrentUnitId(), getYear(), getMonth());
    await initPeriodApproval(getCurrentUnitId(), getYear(), getMonth());
    await initAuditLog();
    await initUnitAdmins();
    await syncCurrentUnitAdmins();
    markBootStage('ana ekran çiziliyor');
    maybeAutoBackup();
    document.documentElement.dataset.theme = 'dark';
    renderMonthSelector(monthSelectorContainer, handleMonthChange);
    renderHeaderActions();
    renderBottomActions();
    bindButtons();
    renderAll();
    await renderOnboarding(document.getElementById('onboardingView'));
    verifyAppShell();
    document.documentElement.classList.add('app-ready');
    markBootStage('tamamlandı');
    window.__miniappBootComplete?.();
  } catch (error) {
    console.error('[Renderer] Başlangıç hatası:', error);
    window.__miniappReportBootError?.(error?.stack || error?.message || String(error));
  }
}

// Electron ve tarayıcıda module script doğrudan yüklendiğinde uygulamayı
// başlat. startApp yalnızca bir kez çalışır; böylece yanlışlıkla ikinci bir
// başlangıç çağrısı yapılmaz.
let appStartPromise = null;
function startAppOnce() {
  if (!appStartPromise) appStartPromise = startApp();
  return appStartPromise;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startAppOnce, { once: true });
} else {
  startAppOnce();
}
