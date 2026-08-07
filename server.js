const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;
const publicDir = path.join(__dirname, 'public');

app.disable('x-powered-by');
app.use(express.static(publicDir, {
  extensions: ['html'],
  maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
}));

app.get('/', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.get('/product/:slug', (_req, res) => {
  res.sendFile(path.join(publicDir, 'product.html'));
});

app.get('/cart', (_req, res) => {
  res.sendFile(path.join(publicDir, 'cart.html'));
});

app.use((_req, res) => {
  res.status(404).send('Страница не найдена');
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`SOTT store is running on port ${port}`);
  });
}

module.exports = app;
