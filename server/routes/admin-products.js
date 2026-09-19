const express = require('express');

class InputError extends Error {}
function object(body, allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body).some(key => !allowed.includes(key))) throw new InputError('Invalid fields.');
}
function text(value, max, empty = false) {
  if (typeof value !== 'string' || (!empty && !value.trim()) || value.trim().length > max) throw new InputError('Invalid text field.');
  return value.trim();
}
function boolean(value) {
  if (typeof value !== 'boolean') throw new InputError('Active status must be a boolean.');
  return value;
}
function stock(value) {
  if (!Number.isInteger(value) || value < 0 || value > 1000000) throw new InputError('Stock must be an integer from 0 to 1000000.');
  return value;
}
function productData(body, create) {
  object(body, ['name', 'description', 'price', 'image_url', 'is_active', ...(create ? ['variants'] : [])]);
  const data = {};
  if (create || body.name !== undefined) data.name = text(body.name, 150);
  if (body.description !== undefined) data.description = text(body.description, 5000, true);
  if (create || body.price !== undefined) {
    if (!['string', 'number'].includes(typeof body.price) || !/^\d{1,9}(\.\d{1,2})?$/.test(String(body.price))) {
      throw new InputError('Price must be a nonnegative amount with at most two decimal places.');
    }
    data.price = String(body.price);
  }
  if (body.image_url !== undefined) {
    data.image_url = body.image_url === null || body.image_url === '' ? null : text(body.image_url, 2048);
    if (data.image_url) {
      let url;
      try { url = new URL(data.image_url); } catch { throw new InputError('Invalid image URL.'); }
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new InputError('Use an HTTP or HTTPS image URL without credentials.');
    }
  }
  if (body.is_active !== undefined) data.is_active = boolean(body.is_active);
  if (!create && !Object.keys(data).length) throw new InputError('Provide a field to update.');
  return data;
}
function variantData(body, create) {
  object(body, ['size', 'color', 'is_active', ...(create ? ['stock'] : [])]);
  const data = {};
  if (create || body.size !== undefined) data.size = text(body.size, 30).toUpperCase();
  if (create || body.color !== undefined) data.color = text(body.color, 60).toLowerCase();
  if (create) data.stock = stock(body.stock ?? 0);
  if (body.is_active !== undefined) data.is_active = boolean(body.is_active);
  if (!Object.keys(data).length) throw new InputError('Provide a field to update.');
  return data;
}
const include = { images: { orderBy: [{ position: 'asc' }, { id: 'asc' }] }, product_variants: { orderBy: { id: 'asc' } } };
const serialize = ({ product_variants, ...product }) => ({ ...product, price: product.price.toFixed(2), currency: 'DZD', variants: product_variants });

module.exports = function adminProducts(db) {
  const router = express.Router();
  for (const param of ['productId', 'variantId']) router.param(param, (req, res, next, value) => {
    if (!/^[1-9]\d*$/.test(value) || Number(value) > 2147483647) return res.status(400).json({ error: 'Invalid ID.' });
    next();
  });
  router.get('/', async (req, res) => {
    const page = req.query.page ?? '1';
    const search = req.query.search ?? '';
    if (typeof page !== 'string' || !/^[1-9]\d*$/.test(page) || Number(page) > 1000000 || typeof search !== 'string' || search.length > 150) {
      return res.status(400).json({ error: 'Invalid page or search.' });
    }
    const products = await db.products.findMany({ where: { name: { contains: search.trim(), mode: 'insensitive' } },
      include, orderBy: { id: 'desc' }, skip: (Number(page) - 1) * 20, take: 21 });
    res.json({ products: products.slice(0, 20).map(serialize), pagination: { page: Number(page), limit: 20, has_more: products.length > 20 } });
  });
  router.get('/:productId', async (req, res) => {
    const product = await db.products.findUnique({ where: { id: Number(req.params.productId) }, include });
    if (!product) return res.status(404).json({ error: 'Product not found.' });
    res.json({ product: serialize(product) });
  });
  router.post('/', async (req, res) => {
    const data = productData(req.body, true);
    if (!Array.isArray(req.body.variants) || req.body.variants.length < 1 || req.body.variants.length > 100) throw new InputError('Provide between 1 and 100 variants.');
    const variants = req.body.variants.map(variant => variantData(variant, true));
    const product = await db.products.create({ data: { ...data, product_variants: { create: variants } }, include });
    res.status(201).json({ product: serialize(product) });
  });
  router.patch('/:productId', async (req, res) => {
    const product = await db.products.update({ where: { id: Number(req.params.productId) }, data: productData(req.body, false), include });
    res.json({ product: serialize(product) });
  });
  router.post('/:productId/variants', async (req, res) => {
    const variant = await db.product_variants.create({ data: { ...variantData(req.body, true), product_id: Number(req.params.productId) } });
    res.status(201).json({ variant });
  });
  router.patch('/:productId/variants/:variantId', async (req, res) => {
    const variant = await db.product_variants.update({ where: { id: Number(req.params.variantId), product_id: Number(req.params.productId) }, data: variantData(req.body, false) });
    res.json({ variant });
  });
  // Compare the displayed stock before setting a count, so an intervening checkout
  // or cancellation cannot be silently overwritten by a stale admin form.
  router.patch('/:productId/variants/:variantId/stock', async (req, res) => {
    object(req.body, ['stock', 'expected_stock']);
    const value = stock(req.body.stock);
    const expected = stock(req.body.expected_stock);
    const result = await db.product_variants.updateMany({
      where: { id: Number(req.params.variantId), product_id: Number(req.params.productId), stock: expected }, data: { stock: value },
    });
    if (!result.count) {
      const exists = await db.product_variants.findFirst({ where: { id: Number(req.params.variantId), product_id: Number(req.params.productId) } });
      return res.status(exists ? 409 : 404).json({ error: exists ? 'Stock changed. Refresh before editing.' : 'Variant not found.' });
    }
    res.json({ updated: true });
  });
  router.use((error, req, res, next) => {
    if (error instanceof InputError) return res.status(400).json({ error: error.message });
    if (error.code === 'P2002') return res.status(409).json({ error: 'That size and color combination already exists.' });
    if (['P2025', 'P2003'].includes(error.code)) return res.status(404).json({ error: 'Product or variant not found.' });
    next(error);
  });
  return router;
};

