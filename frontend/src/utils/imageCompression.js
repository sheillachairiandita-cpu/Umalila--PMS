import imageCompression from 'browser-image-compression';

const DEFAULT_OPTIONS = {
  maxSizeMB: 0.8,
  maxWidthOrHeight: 1600,
  useWebWorker: true,
  initialQuality: 0.85,
};

export function isCompressibleImage(file) {
  return Boolean(file?.type?.startsWith('image/'));
}

export async function compressImage(file, options = {}) {
  const compressed = await imageCompression(file, { ...DEFAULT_OPTIONS, ...options });
  if (compressed instanceof File) return compressed;
  return new File([compressed], file.name, {
    type: compressed.type || file.type,
    lastModified: Date.now(),
  });
}
