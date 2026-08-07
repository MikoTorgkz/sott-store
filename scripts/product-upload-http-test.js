const assert = require('assert');
const express = require('express');
const { uploadProductImages, validateUploadedImage } = require('../product-upload');

async function run() {
  const app = express();
  app.post('/upload', uploadProductImages, (req, res, next) => {
    try {
      return res.json({ formats: req.files.map(validateUploadedImage) });
    } catch (error) {
      return next(error);
    }
  });
  app.use((error, _req, res, _next) => {
    if (error.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Файл слишком большой' });
    if (['LIMIT_FILE_COUNT', 'LIMIT_UNEXPECTED_FILE'].includes(error.code)) return res.status(400).json({ error: 'Можно загрузить не более 8 фотографий' });
    if (error.code === 'INVALID_IMAGE_UPLOAD') return res.status(400).json({ error: error.message });
    return res.status(500).json({ error: 'Ошибка сервера' });
  });

  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    const valid = new FormData();
    valid.append('images', new Blob([Buffer.from([0xff, 0xd8, 0xff, 0x00])], { type: 'image/jpeg' }), 'photo.jpg');
    valid.append('images', new Blob([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])], { type: 'image/png' }), 'photo.png');
    valid.append('images', new Blob([Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')])], { type: 'image/webp' }), 'photo.webp');
    let response = await fetch(`${base}/upload`, { method: 'POST', body: valid });
    assert.equal(response.status, 200);
    assert.deepStrictEqual((await response.json()).formats, ['jpg', 'png', 'webp']);

    const invalid = new FormData();
    invalid.append('images', new Blob([Buffer.from('<svg></svg>')], { type: 'image/svg+xml' }), 'image.svg');
    response = await fetch(`${base}/upload`, { method: 'POST', body: invalid });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, 'Поддерживаются JPEG, PNG и WebP');

    const tooMany = new FormData();
    for (let index = 0; index < 9; index += 1) tooMany.append('images', new Blob([Buffer.from([0xff,0xd8,0xff])], { type: 'image/jpeg' }), `photo-${index}.jpg`);
    response = await fetch(`${base}/upload`, { method: 'POST', body: tooMany });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, 'Можно загрузить не более 8 фотографий');

    const tooLarge = new FormData();
    const largeJpeg = Buffer.alloc((8 * 1024 * 1024) + 1);
    largeJpeg[0] = 0xff; largeJpeg[1] = 0xd8; largeJpeg[2] = 0xff;
    tooLarge.append('images', new Blob([largeJpeg], { type: 'image/jpeg' }), 'large.jpg');
    response = await fetch(`${base}/upload`, { method: 'POST', body: tooLarge });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, 'Файл слишком большой');

    console.log('Product upload HTTP passed: multipart JPEG/PNG/WebP, 8 MB limit, 8-file limit and unsafe type rejection verified.');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
