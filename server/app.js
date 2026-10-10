const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const productRoutes = require('./routes/products');

module.exports = function createApp(prisma) {
  const app = express();
  if (process.env.VERCEL) app.set('trust proxy', 1);
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
    } catch (error) {
      console.error('Database health check failed:', error.code || error.name);
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

  const clientDist = path.resolve(__dirname, '../client/dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
    app.use((req, res, next) => {
      if (req.method === 'GET' && !req.path.startsWith('/api/')) {
        return res.sendFile(path.join(clientDist, 'index.html'));
      }
      next();
    });
  }

  app.use((req, res) => res.status(404).json({ error: 'Route not found.' }));
  app.use((error, req, res, next) => {
    if (error.name === 'MulterError') {
      return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({
        error: error.code === 'LIMIT_FILE_SIZE' ? 'Reference image must be 3.5 MB or smaller.' : 'Invalid reference image upload.',
      });
    }
    if (Number.isInteger(error.status) && error.status >= 400 && error.status < 500) {
      return res.status(error.status).json({ error: error.message });
    }
    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Invalid JSON body.' });
    }
    if (error.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request body is too large.' });
    }
    console.error('API request failed:', error.code || error.name);
    res.status(500).json({ error: 'Unable to process the request. Please try again.' });
  });
  return app;
};
