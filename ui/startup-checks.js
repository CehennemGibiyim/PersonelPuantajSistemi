import { t } from '../utils.js';
import { showToast } from './toast-view.js';

const REQUIRED_IDS = ['sidebar', 'unitSelector', 'monthSelector', 'workspaceView', 'dutySystemView', 'tableContainer', 'monthlyContainer'];

export function verifyAppShell() {
  const missing = REQUIRED_IDS.filter(id => !document.getElementById(id));
  if (missing.length) {
    showToast(t('app.shellCheckFailed'), 'error');
    return { ok: false, missing };
  }
  return { ok: true, missing: [] };
}
