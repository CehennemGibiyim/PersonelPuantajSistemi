import { t } from '../utils.js';
import { getRole } from '../state.js';

const sections = [
  {
    id: 'operations',
    title: 'sidebar.operations',
    icon: '⌂',
    items: [
      ['duty', 'sidebar.dutyList', '▤'],
      ['punch', 'sidebar.payroll', '▦'],
      ['personnel', 'sidebar.personnel', '●'],
      ['departments', 'sidebar.departments', '◇'],
      ['leave', 'sidebar.leave', '◷'],
      ['swap', 'sidebar.swap', '↔'],
      ['templates', 'sidebar.templates', '≡'],
      ['query', 'sidebar.query', '⌕'],
      ['fairness', 'sidebar.fairness', '△']
    ]
  },
  {
    id: 'management',
    title: 'sidebar.management',
    icon: '⚙',
    items: [
      ['users', 'sidebar.users', '♙'],
      ['admins', 'sidebar.admins', '✎'],
      ['requests', 'sidebar.requests', '□'],
      ['warnings', 'sidebar.warnings', '!'],
      ['contact', 'sidebar.contact', '@']
    ]
  },
  {
    id: 'exports',
    title: 'sidebar.export',
    icon: '⇩',
    items: [
      ['excel', 'sidebar.excel', 'X'],
      ['pdf', 'sidebar.pdf', 'P'],
      ['csv', 'sidebar.csv', 'C'],
      ['print', 'sidebar.print', '▣']
    ]
  },
  {
    id: 'system',
    title: 'sidebar.system',
    icon: '◌',
    items: [
      ['backup', 'sidebar.backup', '↺'],
      ['json', 'sidebar.dataBackup', '↓'],
      ['refresh', 'sidebar.refresh', '↻'],
      ['project', 'sidebar.project', '↓']
    ]
  }
];

const expandedSections = new Set(['operations', 'management']);
const restrictedActions = {
  editor: new Set(['departments', 'users', 'admins', 'project', 'json']),
  viewer: new Set(['departments', 'templates', 'query', 'fairness', 'users', 'admins', 'requests', 'backup', 'json', 'project'])
};

function visibleSections() {
  const blocked = restrictedActions[getRole()] || new Set();
  return sections.map(section => ({
    ...section,
    items: section.items.filter(([action]) => !blocked.has(action))
  })).filter(section => section.items.length);
}

function itemMarkup(action, key, icon, active) {
  return `<button class="sidebar-item${active ? ' active' : ''}" data-sidebar-action="${action}"${active ? ' aria-current="page"' : ''} type="button"><span class="sidebar-icon" aria-hidden="true">${icon}</span><span>${t(key)}</span></button>`;
}

function sectionMarkup(section, activeSystem, activeAction) {
  const expanded = expandedSections.has(section.id);
  const isActive = action => action === activeAction || (activeAction === 'punch' && action === 'punch' && activeSystem === 'punch') || (activeAction === 'duty' && action === 'duty' && activeSystem === 'duty');
  const active = section.items.some(([action]) => isActive(action));
  return `<div class="sidebar-group${expanded ? ' expanded' : ''}" data-sidebar-group="${section.id}">
    <button class="sidebar-group-toggle${active ? ' has-active' : ''}" type="button" aria-expanded="${expanded}" aria-controls="sidebar-group-${section.id}">
      <span class="sidebar-group-name"><span class="sidebar-group-icon" aria-hidden="true">${section.icon}</span><span>${t(section.title)}</span></span>
      <span class="sidebar-chevron" aria-hidden="true">⌄</span>
    </button>
    <div class="sidebar-group-items" id="sidebar-group-${section.id}"${expanded ? '' : ' hidden'}>
      ${section.items.map(([action, key, icon]) => itemMarkup(action, key, icon, isActive(action))).join('')}
    </div>
  </div>`;
}

export function renderSidebar(container, { activeSystem = 'punch', activeAction = activeSystem, actions = {} } = {}) {
  if (!container) return;
  const menuSections = visibleSections();
  container.innerHTML = `
    <div class="sidebar-head">
      <div class="sidebar-mark" aria-hidden="true">P+</div>
      <div><strong>${t('app.title')}</strong><small>${t('sidebar.subtitle')}</small></div>
      <button class="sidebar-close" id="sidebarClose" type="button" aria-label="${t('sidebar.close')}">×</button>
    </div>
    <nav class="sidebar-nav" aria-label="${t('sidebar.menu')}">
      ${menuSections.map(section => sectionMarkup(section, activeSystem, activeAction)).join('')}
    </nav>`;

  const close = () => {
    container.classList.remove('open');
    document.getElementById('sidebarBackdrop')?.classList.remove('active');
  };
  container.querySelector('#sidebarClose')?.addEventListener('click', close);
  const backdrop = document.getElementById('sidebarBackdrop');
  if (backdrop) backdrop.onclick = close;
  const toggle = document.querySelector('#sidebarToggle');
  if (toggle) toggle.onclick = () => {
    container.classList.toggle('open');
    backdrop?.classList.toggle('active');
  };

  container.querySelectorAll('[data-sidebar-group]').forEach(group => {
    const toggleButton = group.querySelector('.sidebar-group-toggle');
    toggleButton?.addEventListener('click', () => {
      const isExpanded = expandedSections.has(group.dataset.sidebarGroup);
      if (isExpanded) expandedSections.delete(group.dataset.sidebarGroup);
      else expandedSections.add(group.dataset.sidebarGroup);
      group.classList.toggle('expanded', !isExpanded);
      toggleButton.setAttribute('aria-expanded', String(!isExpanded));
      const items = group.querySelector('.sidebar-group-items');
      if (items) items.hidden = isExpanded;
    });
  });

  container.querySelectorAll('[data-sidebar-action]').forEach(button => {
    button.addEventListener('click', async () => {
      close();
      document.querySelectorAll('.modal-overlay.active').forEach(overlay => overlay.classList.remove('active'));
      const action = button.dataset.sidebarAction;
      try {
        if (typeof actions[action] === 'function') await actions[action](button);
      } catch (error) {
        console.error('Sidebar action failed:', error);
      }
    });
  });
}
