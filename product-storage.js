const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
const localUploadDir = path.join(publicDir, 'uploads', 'products');

function getUploadDirectory() {
  const railwayMount = String(process.env.RAILWAY_VOLUME_MOUNT_PATH || '').trim();
  if (railwayMount && path.isAbsolute(railwayMount)) return path.join(railwayMount, 'products');
  if (String(process.env.PRODUCT_STORAGE || '').trim().toLowerCase() === 'local' && process.env.NODE_ENV !== 'production') return localUploadDir;
  return null;
}

function getStorageStatus() {
  const railwayMount = String(process.env.RAILWAY_VOLUME_MOUNT_PATH || '').trim();
  const uploadDir = getUploadDirectory();
  return {
    configured: Boolean(uploadDir),
    mode: railwayMount && uploadDir ? 'railway-volume' : uploadDir ? 'local' : 'unconfigured',
    message: uploadDir ? '' : 'Хранилище изображений ещё не настроено',
  };
}

async function saveImage(buffer, extension) {
  const status = getStorageStatus();
  if (!status.configured) {
    const error = new Error(status.message);
    error.code = 'STORAGE_NOT_CONFIGURED';
    throw error;
  }
  const uploadDir = getUploadDirectory();
  await fs.mkdir(uploadDir, { recursive: true });
  const filename = `${crypto.randomBytes(24).toString('hex')}.${extension}`;
  const destination = path.join(uploadDir, filename);
  await fs.writeFile(destination, buffer, { flag: 'wx', mode: 0o600 });
  return `/uploads/products/${filename}`;
}

async function removeImage(imageUrl) {
  const uploadDir = getUploadDirectory();
  if (!uploadDir || typeof imageUrl !== 'string' || !imageUrl.startsWith('/uploads/products/')) return false;
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

module.exports = { getStorageStatus, getUploadDirectory, saveImage, removeImage };
