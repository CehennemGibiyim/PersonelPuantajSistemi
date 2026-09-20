import { t } from '../utils.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));

export function openPhotoCrop(file) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay photo-crop-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = `<div class="modal glass photo-crop-modal"><div class="photo-crop-head"><div><h2 class="modal-title">${esc(t('photoCrop.title'))}</h2><p class="photo-crop-hint">${esc(t('photoCrop.hint'))}</p></div><button class="action-btn" type="button" data-crop-cancel aria-label="${esc(t('modal.cancel'))}">×</button></div><div class="photo-crop-stage" data-crop-stage><img src="${esc(url)}" alt="${esc(t('photoCrop.preview'))}" data-crop-image draggable="false"><div class="photo-crop-frame" aria-hidden="true"></div></div><label class="photo-crop-zoom">${esc(t('photoCrop.zoom'))}<input type="range" min="1" max="3" step="0.01" value="1" data-crop-zoom></label><div class="modal-actions"><button class="btn" type="button" data-crop-cancel>${esc(t('modal.cancel'))}</button><button class="btn btn-primary" type="button" data-crop-confirm>${esc(t('photoCrop.use'))}</button></div></div>`;
    document.body.appendChild(overlay);
    const stage = overlay.querySelector('[data-crop-stage]');
    const image = overlay.querySelector('[data-crop-image]');
    const zoom = overlay.querySelector('[data-crop-zoom]');
    let scale = 1;
    let offsetX = 0;
    let offsetY = 0;
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let baseWidth = 0;
    let baseHeight = 0;
    const finish = value => { URL.revokeObjectURL(url); overlay.remove(); resolve(value); };
    const clamp = () => {
      const frameWidth = 180;
      const frameHeight = 220;
      const width = baseWidth * scale;
      const height = baseHeight * scale;
      offsetX = Math.min(0, Math.max(frameWidth - width, offsetX));
      offsetY = Math.min(0, Math.max(frameHeight - height, offsetY));
    };
    const render = () => {
      image.style.width = `${baseWidth * scale}px`;
      image.style.height = `${baseHeight * scale}px`;
      image.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
    };
    image.addEventListener('load', () => {
      const ratio = Math.max(180 / image.naturalWidth, 220 / image.naturalHeight);
      baseWidth = image.naturalWidth * ratio;
      baseHeight = image.naturalHeight * ratio;
      offsetX = (180 - baseWidth) / 2;
      offsetY = (220 - baseHeight) / 2;
      render();
    }, { once: true });
    zoom.addEventListener('input', () => { scale = Number(zoom.value) || 1; clamp(); render(); });
    stage.addEventListener('pointerdown', event => { dragging = true; startX = event.clientX - offsetX; startY = event.clientY - offsetY; stage.setPointerCapture(event.pointerId); });
    stage.addEventListener('pointermove', event => { if (!dragging) return; offsetX = event.clientX - startX; offsetY = event.clientY - startY; clamp(); render(); });
    stage.addEventListener('pointerup', () => { dragging = false; });
    stage.addEventListener('pointercancel', () => { dragging = false; });
    overlay.querySelectorAll('[data-crop-cancel]').forEach(button => button.addEventListener('click', () => finish(null)));
    overlay.querySelector('[data-crop-confirm]').addEventListener('click', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 360;
      canvas.height = 440;
      const context = canvas.getContext('2d');
      if (!context) return finish(null);
      const sourceScale = (baseWidth * scale) / image.naturalWidth;
      const sourceX = Math.max(0, -offsetX / sourceScale);
      const sourceY = Math.max(0, -offsetY / sourceScale);
      const sourceW = Math.min(image.naturalWidth - sourceX, 180 / sourceScale);
      const sourceH = Math.min(image.naturalHeight - sourceY, 220 / sourceScale);
      context.drawImage(image, sourceX, sourceY, sourceW, sourceH, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => finish(blob ? new File([blob], file.name.replace(/\.[^.]+$/, '') + '-vesikalik.jpg', { type: 'image/jpeg' }) : null), 'image/jpeg', .88);
    });
    overlay.classList.add('active');
  });
}
