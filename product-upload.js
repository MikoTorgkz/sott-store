const multer = require('multer');
const path = require('path');

const MAX_IMAGES = 8;
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const EXTENSION_MIME = new Map([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
]);

const uploadProductImages = multer({
  storage: multer.memoryStorage(),
  limits: { files: MAX_IMAGES, fileSize: MAX_IMAGE_SIZE, fields: 4 },
  fileFilter(_req, file, callback) {
    const extension = path.extname(String(file.originalname || '')).toLowerCase();
    if (!ALLOWED_MIME.has(file.mimetype) || EXTENSION_MIME.get(extension) !== file.mimetype) {
      return callback(createUploadError('Поддерживаются JPEG, PNG и WebP'));
    }
    return callback(null, true);
  },
}).array('images', MAX_IMAGES);

function validateUploadedImage(file) {
  const extension = path.extname(String(file && file.originalname || '')).toLowerCase();
  if (!file || !Buffer.isBuffer(file.buffer) || !ALLOWED_MIME.has(file.mimetype) || EXTENSION_MIME.get(extension) !== file.mimetype) {
    throw createUploadError('Поддерживаются JPEG, PNG и WebP');
  }
  const buffer = file.buffer;
  if (file.mimetype === 'image/jpeg' && buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (file.mimetype === 'image/png' && buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))) return 'png';
  if (file.mimetype === 'image/webp' && buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  throw createUploadError('Содержимое файла не соответствует формату изображения');
}

function createUploadError(message) {
  const error = new Error(message);
  error.code = 'INVALID_IMAGE_UPLOAD';
  return error;
}

module.exports = { MAX_IMAGES, MAX_IMAGE_SIZE, uploadProductImages, validateUploadedImage };
