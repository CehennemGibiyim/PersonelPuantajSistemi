function validateFile(file) {
  if (!file || !String(file.type || '').startsWith('image/')) {
    throw new Error('IMAGE_TYPE');
  }
  if (file.size > 5 * 1024 * 1024) throw new Error('IMAGE_SIZE');
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('IMAGE_READ'));
    reader.readAsDataURL(file);
  });
}

function compressDataUrl(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const maxSide = 480;
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round((image.naturalWidth || 1) * scale));
      canvas.height = Math.max(1, Math.round((image.naturalHeight || 1) * scale));
      const context = canvas.getContext('2d');
      if (!context) { reject(new Error('IMAGE_CANVAS')); return; }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve({ url: canvas.toDataURL('image/jpeg', 0.8), name: file.name, mimeType: 'image/jpeg' });
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('IMAGE_READ'));
    };
    image.src = objectUrl;
  });
}

export async function preparePersonnelPhoto(file) {
  validateFile(file);
  try {
    if (window.miniappsAI?.uploadFile) {
      const uploaded = await window.miniappsAI.uploadFile(file, { persistence: 'durable' });
      if (uploaded?.publicUrl) {
        return {
          url: uploaded.publicUrl,
          fileId: uploaded.fileId || '',
          name: uploaded.originalName || file.name,
          mimeType: uploaded.mimeType || file.type
        };
      }
    }
  } catch (error) {
    console.warn('Personnel photo upload fallback:', error);
  }
  const dataUrl = await compressDataUrl(file);
  return dataUrl || { url: await readAsDataUrl(file), name: file.name, mimeType: file.type };
}

export function photoErrorKey(error) {
  const code = error?.message || '';
  if (code === 'IMAGE_TYPE') return 'detail.photoTypeError';
  if (code === 'IMAGE_SIZE') return 'detail.photoSizeError';
  return 'detail.photoUploadFailed';
}
