import { loadMonthlyNote, setMonthlyNote } from '../period-note-state.js';
import { t } from '../utils.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));

export async function requestMonthlyNote() {
  let current = '';
  try {
    current = await loadMonthlyNote();
  } catch {
    current = '';
  }

  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = `<div class="modal glass monthly-note-modal"><h2 class="modal-title">${t('printOptions.noteTitle')}</h2><p class="print-options-hint">${t('printOptions.noteHint')}</p><label class="modal-label" for="monthlyNoteInput">${t('printOptions.noteLabel')}</label><textarea class="modal-input" id="monthlyNoteInput" rows="6" maxlength="4000" placeholder="${t('printOptions.notePlaceholder')}">${esc(current)}</textarea><div class="modal-actions"><button class="btn" type="button" data-note-cancel>${t('modal.cancel')}</button><button class="btn btn-primary" type="button" data-note-save>${t('printOptions.noteSave')}</button></div></div>`;
    const close = value => { overlay.remove(); resolve(value); };
    overlay.addEventListener('click', event => { if (event.target === overlay) close(null); });
    overlay.querySelector('[data-note-cancel]').addEventListener('click', () => close(null));
    overlay.querySelector('[data-note-save]').addEventListener('click', async () => {
      const button = overlay.querySelector('[data-note-save]');
      button.disabled = true;
      try {
        const value = overlay.querySelector('#monthlyNoteInput').value;
        // Update the in-memory note and start persistence before closing. The
        // caller can open the preview immediately after this user action,
        // while storage continues without leaving a blank popup behind.
        const savePromise = setMonthlyNote(value);
        close(String(value || '').trim().slice(0, 4000));
        await savePromise;
      } catch {
        button.disabled = false;
      }
    });
    document.body.appendChild(overlay);
    overlay.querySelector('#monthlyNoteInput').focus();
  });
}
