export function isEquipmentPhoto(value) {
  return typeof value === 'string' && /^(data:image\/|https?:\/\/|file:\/\/|content:\/\/|blob:)/i.test(value);
}

// Store image bytes in SQLite, rather than a temporary picker URI, so photos
// survive a restart on both native devices and the web.
export function equipmentPhotoFromAsset(asset) {
  if (!asset?.base64) throw new Error('Could not read this photo. Please choose another image.');
  if (asset.base64.length > 4 * Math.ceil(5 * 1024 * 1024 / 3))
    throw new Error('This photo is too large. Choose an image smaller than 5 MB.');
  if (asset.uri?.startsWith('data:image/')) return asset.uri;
  // Native pickers can report the original HEIC MIME after producing JPEG bytes.
  const mime = asset.base64.startsWith('/9j/') ? 'image/jpeg'
    : asset.base64.startsWith('iVBORw0KGgo') ? 'image/png'
      : asset.mimeType?.startsWith('image/') ? asset.mimeType : 'image/jpeg';
  return `data:${mime};base64,${asset.base64}`;
}
