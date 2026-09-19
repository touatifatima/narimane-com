const express = require('express');
const cors = require('cors');
const productRoutes = require('./routes/products');

module.exports = function createApp(prisma) {
  const app = express();
  app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
  app.use(express.json());
  app.use('/api/uploads/products', express.static(require('./routes/product-images').directory, {
    dotfiles: 'deny', index: false, maxAge: '1d',
    setHeaders(res) { res.setHeader('X-Content-Type-Options', 'nosniff'); },
  }));

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'T-shirt store API is running' });
  });

  app.get('/api/health/db', async (req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ok', database: 'connected' });
    } catch {
      res.status(503).json({ status: 'error', database: 'unavailable' });
    }
  });

  app.use('/api/products', productRoutes(prisma));
  app.use('/api/admin', require('./routes/admin')(prisma));
  app.use('/api/orders', require('./routes/orders')(prisma));
  app.get('/api/delivery-rates', async (req, res) => {
    const rates = await prisma.delivery_rates.findMany({
      where: { is_active: true }, orderBy: { wilaya_code: 'asc' },
      select: { wilaya_code: true, wilaya_name: true, fee: true },
    });
    res.json({ delivery_rates: rates.map(rate => ({ ...rate, fee: rate.fee.toFixed(2), currency: 'DZD' })) });
  });
  app.use((req, res) => res.status(404).json({ error: 'Route not found.' }));
  app.use((error, req, res, next) => {
    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Invalid JSON body.' });
    }
    if (error.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request body is too large.' });
    }
    console.error('API request failed.');
    res.status(500).json({ error: 'Unable to process the request. Please try again.' });
  });
  return app;
};
