const express = require('express');
const { randomBytes, createHash } = require('node:crypto');
const { limiter: sharedLimiter } = require('../lib/rate-limits');
const { verifyPassword } = require('../lib/passwords');
const digest = token => createHash('sha256').update(token).digest('hex');
const transitions = {
  new: ['confirmed', 'cancelled'], confirmed: ['shipped', 'cancelled'],
  shipped: ['delivered', 'returned'], delivered: ['returned'], cancelled: [], returned: [],
};
const orderSelect = {
  id: true, reference: true, customer_name: true, phone: true, wilaya: true,
  commune: true, address: true, notes: true, status: true, subtotal: true,
  delivery_fee: true, total: true, created_at: true, payment_method: true,
};

module.exports = function adminRoutes(db) {
  const router = express.Router();
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  const limiter = sharedLimiter(db, 'login', 10, 15 * 60 * 1000,
    'Too many login attempts. Try again in 15 minutes.');
  router.post('/login', limiter, async (req, res) => {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || email.length > 254 || typeof password !== 'string' || password.length < 1 || password.length > 128) {
      return res.status(400).json({ error: 'Provide an email and password.' });
    }
    const admin = await db.admins.findUnique({ where: { email: email.trim().toLowerCase() } });
    const valid = await verifyPassword(password, admin?.password_hash);
    if (!valid || !admin?.is_active) return res.status(401).json({ error: 'Invalid email or password.' });
    const token = randomBytes(32).toString('hex');
    const expires_at = new Date(Date.now() + 8 * 60 * 60 * 1000);
    await db.admin_sessions.deleteMany({ where: { expires_at: { lte: new Date() } } });
    await db.admin_sessions.create({ data: { token_hash: digest(token), admin_id: admin.id, expires_at } });
    res.json({ token, expires_at, admin: { id: admin.id, email: admin.email } });
  });

  router.use(async (req, res, next) => {
    const match = /^Bearer ([a-f0-9]{64})$/.exec(req.get('Authorization') || '');
    if (!match) return res.status(401).json({ error: 'Admin login required.' });
    const tokenHash = digest(match[1]);
    const session = await db.admin_sessions.findUnique({ where: { token_hash: tokenHash }, include: { admin: true } });
    if (!session || session.expires_at <= new Date() || !session.admin.is_active) {
      return res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
    }
    req.admin = { id: session.admin.id, email: session.admin.email };
    req.tokenHash = tokenHash;
    next();
  });
  router.get('/me', (req, res) => res.json({ admin: req.admin }));
  router.use('/notifications', require('./notifications')(db));
  router.use('/products/:productId/images', require('./product-images')(db));
  router.use('/products', require('./admin-products')(db));
  router.use('/delivery-rates', require('./admin-delivery')(db));
  router.post('/logout', async (req, res) => {
    await db.admin_sessions.deleteMany({ where: { token_hash: req.tokenHash } });
    res.sendStatus(204);
  });
  router.get('/orders', async (req, res) => {
    const pageText = req.query.page ?? '1';
    const status = req.query.status;
    const search = req.query.search ?? '';
    if (typeof pageText !== 'string' || !/^[1-9]\d*$/.test(pageText) || Number(pageText) > 1000000
      || (status !== undefined && (typeof status !== 'string' || !Object.hasOwn(transitions, status)))
      || typeof search !== 'string' || search.length > 120) {
      return res.status(400).json({ error: 'Invalid page, status or search.' });
    }
    const where = {};
    if (status) where.status = status;
    if (search.trim()) where.OR = [
      { customer_name: { contains: search.trim(), mode: 'insensitive' } },
      { phone: { contains: search.trim() } },
    ];
    const page = Number(pageText);
    const orders = await db.orders.findMany({ where, select: orderSelect,
      orderBy: { id: 'desc' }, skip: (page - 1) * 20, take: 21 });
    res.json({ orders: orders.slice(0, 20), pagination: { page, limit: 20, has_more: orders.length > 20 } });
  });
  router.post('/orders/bulk-delete', async (req, res) => {
    const ids = req.body?.ids;
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > 20
      || ids.some(id => !Number.isInteger(id) || id < 1 || id > 2147483647)
      || new Set(ids).size !== ids.length || Object.keys(req.body).some(key => key !== 'ids')) {
      return res.status(400).json({ error: 'Select between 1 and 20 distinct orders.' });
    }
    try {
      const result = await db.$transaction(async tx => {
        const orders = await tx.orders.findMany({ where: { id: { in: ids } },
          select: { id: true, status: true, order_items: { select: { variant_id: true, quantity: true } } } });
        if (orders.length !== ids.length) return { error: 'One or more orders no longer exist. Refresh the list.', status: 404 };
        const stockToRestore = new Map();
        for (const order of orders) {
          if (order.status === 'new' || order.status === 'confirmed') {
            for (const item of order.order_items) {
              stockToRestore.set(item.variant_id, (stockToRestore.get(item.variant_id) || 0) + item.quantity);
            }
          }
        }
        for (const [variantId, quantity] of [...stockToRestore].sort((a, b) => a[0] - b[0])) {
          await tx.product_variants.update({ where: { id: variantId }, data: { stock: { increment: quantity } } });
        }
        await tx.order_items.deleteMany({ where: { order_id: { in: ids } } });
        // Notifications and their read receipts cascade from the orders table.
        const deleted = await tx.orders.deleteMany({ where: { id: { in: ids } } });
        if (deleted.count !== ids.length) throw new Error('Orders changed during deletion.');
        return { deleted: deleted.count, restocked: orders.filter(order => ['new', 'confirmed'].includes(order.status)).length };
      }, { isolationLevel: 'Serializable', timeout: 15000 });
      if (result.error) return res.status(result.status).json({ error: result.error });
      res.json(result);
    } catch (error) {
      if (error.code === 'P2034') return res.status(409).json({ error: 'Orders changed. Refresh and try again.' });
      throw error;
    }
  });
  router.param('id', (req, res, next, value) => {
    if (!/^[1-9]\d*$/.test(value) || Number(value) > 2147483647) return res.status(400).json({ error: 'Invalid order ID.' });
    req.orderId = Number(value);
    next();
  });
  router.get('/orders/:id', async (req, res) => {
    const order = await db.orders.findUnique({ where: { id: req.orderId }, select: {
      ...orderSelect,
      order_items: { include: { product_variants: { select: { products: { select: {
        image_url: true,
        images: { orderBy: [{ position: 'asc' }, { id: 'asc' }], take: 1, select: { url: true } },
      } } } } } },
    } });
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    order.order_items = order.order_items.map(({ product_variants, ...item }) => ({
      ...item,
      image_url: product_variants.products.images[0]?.url || product_variants.products.image_url,
    }));
    res.json({ order });
  });
  router.patch('/orders/:id/status', async (req, res) => {
    const status = req.body?.status;
    if (typeof status !== 'string' || !Object.hasOwn(transitions, status)) return res.status(400).json({ error: 'Invalid order status.' });
    const result = await db.$transaction(async tx => {
      const order = await tx.orders.findUnique({ where: { id: req.orderId }, include: { order_items: true } });
      if (!order) return { error: 'Order not found.', code: 404 };
      if (order.status === status) return { order: await tx.orders.findUnique({ where: { id: order.id }, select: orderSelect }) };
      if (!transitions[order.status].includes(status)) return { error: 'This status transition is not allowed.', code: 409 };
      // Compare and update prevents two simultaneous cancellations from restocking twice.
      const updated = await tx.orders.updateMany({ where: { id: order.id, status: order.status }, data: { status } });
      if (updated.count !== 1) return { error: 'Order changed. Refresh and try again.', code: 409 };
      if (status === 'cancelled' || status === 'returned') {
        for (const item of order.order_items.sort((a, b) => a.variant_id - b.variant_id)) {
          await tx.product_variants.update({ where: { id: item.variant_id }, data: { stock: { increment: item.quantity } } });
        }
      }
      await tx.admin_notifications.create({ data: { order_id: order.id, kind: 'status_changed', status } });
      return { order: await tx.orders.findUnique({ where: { id: order.id }, select: orderSelect }) };
    });
    if (result.error) return res.status(result.code).json({ error: result.error });
    res.json(result);
  });
  return router;
};
