const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
const uploadDir = path.join(publicDir, 'uploads', 'products');

function getStorageStatus() {
  const mode = String(process.env.PRODUCT_STORAGE || '').trim().toLowerCase();
  const localAllowed = mode === 'local' && process.env.NODE_ENV !== 'production';
  return {
    configured: localAllowed,
    mode: localAllowed ? 'local' : 'unconfigured',
    message: localAllowed ? '' : 'Хранилище изображений ещё не настроено',
  };
}

async function saveImage(buffer, extension) {
  const status = getStorageStatus();
  if (!status.configured) {
    const error = new Error(status.message);
    error.code = 'STORAGE_NOT_CONFIGURED';
    throw error;
  }
  await fs.mkdir(uploadDir, { recursive: true });
  const filename = `${crypto.randomBytes(24).toString('hex')}.${extension}`;
  const destination = path.join(uploadDir, filename);
  await fs.writeFile(destination, buffer, { flag: 'wx', mode: 0o600 });
  return `/uploads/products/${filename}`;
}

async function removeImage(imageUrl) {
  if (getStorageStatus().mode !== 'local' || typeof imageUrl !== 'string' || !imageUrl.startsWith('/uploads/products/')) return false;
  const filename = path.basename(imageUrl);
  if (!/^[a-f0-9]{48}\.(?:jpg|png|webp)$/.test(filename)) return false;
  try {
    await fs.unlink(path.join(uploadDir, filename));
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

module.exports = { getStorageStatus, saveImage, removeImage };
