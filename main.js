import { init, getAdmins, setCurrentWeek, getCurrentWeek, getUnitName, getCurrentUnitId, setCurrentUnit, getUnits, isAdmin, canEdit } from './state.js';
import { setPeriod, getYear, getMonth, MONTHS_TR, t, initDesktopI18n } from './utils.js';
import { renderTabs } from './ui/tabs-view.js';
import { renderStats } from './ui/stats-view.js';
import { renderWeekTable } from './ui/week-table-view.js?v=32';
import { renderMonthlyTable } from './ui/monthly-table-view.js';
import { renderMonthSelector } from './ui/month-selector-view.js';
import { initModal } from './ui/modal-view.js';
import { initAdminModal } from './ui/admin-modal-view.js';
import { initUnitModal } from './ui/unit-modal-view.js';
import { initRoleModal } from './ui/role-modal-view.js';
import { initPersonnelDetailModal } from './ui/personnel-detail-modal-view.js';
import { initReportsPanel } from './ui/reports-panel-view.js';
import { initContactPanel } from './ui/contact-panel-view.js';
import { initWarningsPanel } from './ui/warnings-panel-view.js';
import { initLanguageModal } from './ui/language-view.js';
import { initSwapRequestsPanel } from './ui/swap-request-view.js';
import { showToast } from './ui/toast-view.js';
import { initExport } from './export.js?v=20';
import { initPrintView, doPrint } from './ui/print-view.js?v=24';
import { initAdvancedPanel, maybeAutoBackup } from './ui/advanced-panel-view.js?v=10';
import { renderSystemSwitcher } from './ui/system-switcher-view.js';
import { renderDutySystem } from './ui/duty-system-view.js?v=13';
import { downloadProject } from './project-download.js';

let tabContainer, statContainer, tableContainer, weekLabel, monthlyContainer, monthSelectorContainer, workspaceView, dutySystemView;
let activeSystem = 'punch';

function renderAll() {
  const year = getYear();
  const month = getMonth();
  const unit = getUnitName();
  const isDutySystem = activeSystem === 'duty';
  const subtitle = document.getElementById('appSubtitle');
  const title = document.querySelector('[data-i18n="app.title"]');
  if (title) title.textContent = t(isDutySystem ? 'app.dutyTitle' : 'app.title');
  if (subtitle) subtitle.textContent = t('dutySystem.subtitle', { unit, month: MONTHS_TR[month], year });

  renderIcons();
  renderSystemSwitcher(document.getElementById('systemSwitcher'), activeSystem, nextSystem => {
    activeSystem = nextSystem;
    renderAll();
  });
  renderHeaderActions();
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
    statContainer.style.display = 'none';
    document.getElementById('monthlyLabel').style.display = 'none';
    monthlyContainer.style.display = 'none';
    tableContainer.innerHTML = '';
    weekLabel.style.display = 'none';
    renderReportsIfActive();
  } else {
    statContainer.style.display = 'grid';
    document.getElementById('monthlyLabel').style.display = 'block';
    monthlyContainer.style.display = 'block';
    renderStats(statContainer);
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
    container.innerHTML = `<button class="btn btn-primary" id="projectDownloadBtn"><span>⇩</span> <span data-i18n="advanced.projectDownload">${t('advanced.projectDownload')}</span></button><button class="btn" id="editAdminsBtn" style="display:none"><span>⚙</span> <span data-i18n="app.editAdmins">Yönetici Bilgileri</span></button>`;
  }
  const btn = container.querySelector('#editAdminsBtn');
  if (btn) btn.style.display = isAdmin() ? '' : 'none';
}

async function handleProjectDownload(button) {
  if (!button || button.disabled) return;
  button.disabled = true;
  button.innerHTML = `<span>⏳</span> <span>${t('advanced.projectDownloadLoading')}</span>`;
  try {
    await downloadProject();
    showToast(t('advanced.projectDownloaded'), 'success');
  } catch (error) {
    console.error('Project download failed:', error);
    showToast(t('advanced.projectDownloadFailed'), 'error');
  } finally {
    button.disabled = false;
    button.innerHTML = `<span>⇩</span> <span data-i18n="advanced.projectDownload">${t('advanced.projectDownload')}</span>`;
  }
}

function renderBottomActions() {
  const container = document.getElementById('bottomActions');
  if (!container) return;

  container.innerHTML = `
    <button class="btn btn-primary" id="addPersonnelBtn" data-i18n="app.addPersonnel">Personel Ekle</button>
    <button class="btn" id="swapRequestsBtn" data-i18n="app.swapRequestsBtn">Talepler</button>
    <button class="btn" id="warningsBtn" data-i18n="app.warningsBtn">Uyarılar</button>
    <button class="btn" id="contactBtn" data-i18n="app.contactBtn">İletişim</button>
    <button class="btn" id="exportBtn" data-i18n="app.exportBtn">Excel İndir</button>
    <button class="btn" id="printBtn" data-i18n="app.printBtn">Yazdır</button>
    <button class="btn" id="refreshBtn" data-i18n="app.refreshBtn">Yenile</button>
    <button class="btn" id="languageBtn" data-i18n="app.languageBtn">Dil</button>
    <button class="btn btn-primary" id="advancedBtn">${t('app.advancedBtn')}</button>
  `;
}

function updateBottomActions() {
  const addBtn = document.getElementById('addPersonnelBtn');
  if (addBtn) addBtn.style.display = canEdit() ? '' : 'none';
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
    html += `<option value="${u.id}" ${u.id === currentId ? 'selected' : ''}>${u.name}</option>`;
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
    footer.innerHTML =
      `${unit} SORUMLU HEMŞİRESİ: <strong>${a.headNurse}</strong>  |  SAĞLIK BAKIM HİZ. MÜDÜRÜ: <strong>${a.manager}</strong>  |  BAŞHEKİM: <strong>${a.chiefDoctor}</strong>`;
  }
}

function updateEditability() {
  const editable = canEdit();
  document.querySelectorAll('.day-input').forEach(el => el.disabled = !editable);
  document.querySelectorAll('[data-edit], [data-edit-m], [data-delete], [data-delete-m], #addPersonnelBtn').forEach(el => {
    el.style.display = editable ? '' : 'none';
  });
}

async function handleMonthChange() {
  setCurrentWeek(0);
  await init();
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
  if (printBtn) printBtn.addEventListener('click', doPrint);

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
  statContainer = document.getElementById('statsRow');
  tableContainer = document.getElementById('tableContainer');
  weekLabel = document.getElementById('weekLabel');
  monthlyContainer = document.getElementById('monthlyContainer');
  monthSelectorContainer = document.getElementById('monthSelector');
  workspaceView = document.getElementById('workspaceView');
  dutySystemView = document.getElementById('dutySystemView');

  await initDesktopI18n();
  await init();
  maybeAutoBackup();
  try {
    const savedTheme = await window.miniappsAI?.storage?.getItem('themePreference');
    if (savedTheme === 'light' || savedTheme === 'dark') document.documentElement.dataset.theme = savedTheme;
  } catch (e) { /* theme preference is optional */ }
  renderMonthSelector(monthSelectorContainer, handleMonthChange);
  renderHeaderActions();
  renderBottomActions();
  bindButtons();
  renderAll();
});
