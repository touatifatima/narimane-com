const express = require('express');
const { createHash } = require('node:crypto');
const { Prisma } = require('@prisma/client');
const { limiter } = require('../lib/rate-limits');
const multer = require('multer');
const sharp = require('sharp');
const storage = require('../storage');

const customImageUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 3.5 * 1024 * 1024, files: 1, fields: 10, parts: 11 }, fileFilter(req, file, next) {
  next(['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype) ? null : new CheckoutError(400, 'Use a JPG, PNG or WebP reference image.'), true);
} }).single('custom_image');

class CheckoutError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function validate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new CheckoutError(400, 'A checkout object is required.');
  }
  const data = {};
  for (const [key, max] of Object.entries({ customer_name: 120, phone: 30, wilaya_code: 10, commune: 120, address: 300 })) {
    if (typeof body[key] !== 'string' || !body[key].trim() || body[key].trim().length > max) {
      throw new CheckoutError(400, `A valid ${key} is required (maximum ${max} characters).`);
    }
    data[key] = body[key].trim();
  }
  data.phone = data.phone.replace(/[\s()-]/g, '');
  if (!/^\+?\d{8,15}$/.test(data.phone)) throw new CheckoutError(400, 'Invalid phone number.');
  if (body.notes !== undefined && (typeof body.notes !== 'string' || body.notes.length > 1000)) {
    throw new CheckoutError(400, 'Notes must be text of at most 1000 characters.');
  }
  data.notes = (body.notes || '').trim();
  let rawItems = body.items;
  if (typeof rawItems === 'string') { try { rawItems = JSON.parse(rawItems); } catch { throw new CheckoutError(400, 'Invalid cart items.'); } }
  if (!Array.isArray(rawItems) || rawItems.length < 1 || rawItems.length > 50) {
    throw new CheckoutError(400, 'The cart must contain between 1 and 50 items.');
  }
  const quantities = new Map();
  for (const item of rawItems) {
    if (!item || !Number.isInteger(item.variant_id) || item.variant_id < 1 || item.variant_id > 2147483647
      || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) {
      throw new CheckoutError(400, 'Each item needs a valid variant_id and quantity from 1 to 99.');
    }
    const quantity = (quantities.get(item.variant_id) || 0) + item.quantity;
    if (quantity > 99) throw new CheckoutError(400, 'Maximum quantity per variant is 99.');
    quantities.set(item.variant_id, quantity);
  }
  data.items = [...quantities].sort((a, b) => a[0] - b[0]).map(([variant_id, quantity]) => ({ variant_id, quantity }));
  if (body.custom_product_id !== undefined && body.custom_product_id !== '') {
    const productId = Number(body.custom_product_id);
    if (!Number.isSafeInteger(productId) || productId < 1 || productId > 2147483647) throw new CheckoutError(400, 'Invalid customization product.');
    data.custom_product_id = productId;
  }
  return data;
}

function confirmation(order) {
  return {
    reference: order.reference, status: order.status, currency: 'DZD',
    subtotal: order.subtotal.toFixed(2), delivery_fee: order.delivery_fee.toFixed(2),
    total: order.total.toFixed(2), payment_method: order.payment_method,
  };
}

module.exports = function orderRoutes(db) {
  const router = express.Router();
  router.post('/', limiter(db, 'checkout', 20, 15 * 60 * 1000,
    'Too many checkout attempts. Please try again in 15 minutes.'), customImageUpload, async (req, res, next) => {
    let storedImageUrl = '';
    try {
      const key = req.get('Idempotency-Key');
      if (!key || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) {
        throw new CheckoutError(400, 'Provide a UUID v4 Idempotency-Key header for this checkout.');
      }
      const data = validate(req.body);
      let customizationProductName = '';
      if (data.custom_product_id !== undefined) {
        const matchingVariants = await db.product_variants.findMany({
          where: { id: { in: data.items.map(item => item.variant_id) }, product_id: data.custom_product_id,
            is_active: true, products: { is_active: true, customization_enabled: true } },
          select: { products: { select: { name: true } } },
        });
        if (!matchingVariants.length) throw new CheckoutError(400, 'Customization is not available for the selected product.');
        customizationProductName = matchingVariants[0].products.name;
      } else if (req.file) throw new CheckoutError(400, 'Select a product before attaching a reference image.');
      let customImageHash = '';
      if (req.file) {
        try {
          const image = sharp(req.file.buffer, { limitInputPixels: 25000000, failOn: 'warning' });
          const metadata = await image.metadata();
          if (!['jpeg', 'png', 'webp'].includes(metadata.format) || (metadata.pages || 1) > 1) throw new Error('Unsupported image');
          const webp = await image.rotate().resize({ width: 1800, height: 1800, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
          customImageHash = createHash('sha256').update(webp).digest('hex');
          storedImageUrl = (await storage.save(webp, data.custom_product_id)).url;
        } catch (error) {
          if (error instanceof CheckoutError) throw error;
          throw new CheckoutError(400, 'Invalid image. Use a non-animated JPG, PNG or WebP image up to 25 megapixels.');
        }
      }
      const hash = createHash('sha256').update(JSON.stringify({ ...data, custom_image_hash: customImageHash })).digest('hex');
      const replay = order => {
        if (order.checkout_hash !== hash) throw new CheckoutError(409, 'This checkout key was already used for a different order.');
        return { order, repeated: true };
      };
      let result;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          result = await db.$transaction(async tx => {
            const existing = await tx.orders.findUnique({ where: { checkout_key: key } });
            if (existing) return replay(existing);
            const rate = await tx.delivery_rates.findFirst({ where: { wilaya_code: data.wilaya_code, is_active: true } });
            if (!rate) throw new CheckoutError(422, 'Delivery is unavailable for this wilaya.');
            let subtotal = new Prisma.Decimal(0);
            const items = [];
            for (const item of data.items) {
              const variant = await tx.product_variants.findFirst({
                where: { id: item.variant_id, is_active: true, products: { is_active: true } },
                include: { products: true },
              });
              if (!variant) throw new CheckoutError(409, 'A selected article is no longer available.');
              if (variant.products.id === data.custom_product_id && !variant.products.customization_enabled) {
                throw new CheckoutError(409, 'Customization is no longer available for the selected product.');
              }
              const updated = await tx.product_variants.updateMany({
                where: { id: variant.id, is_active: true, stock: { gte: item.quantity } },
                data: { stock: { decrement: item.quantity } },
              });
              if (updated.count !== 1) throw new CheckoutError(409, 'Insufficient stock for a selected article.');
              subtotal = subtotal.plus(variant.products.price.mul(item.quantity));
              items.push({ variant_id: variant.id, product_name: variant.products.name,
                size: variant.size, color: variant.color, unit_price: variant.products.price, quantity: item.quantity });
            }
            if (subtotal.gte('10000000000')) throw new CheckoutError(400, 'Order total exceeds the supported limit.');
            const order = await tx.orders.create({ data: {
              checkout_key: key, checkout_hash: hash,
              customer_name: data.customer_name, phone: data.phone, wilaya: rate.wilaya_name,
              commune: data.commune, address: data.address, notes: data.notes,
              customization_product_name: customizationProductName, customization_image_url: storedImageUrl || null,
              subtotal, delivery_fee: rate.fee, order_items: { create: items },
            } });
            await tx.admin_notifications.create({ data: { order_id: order.id, kind: 'new_order', status: order.status } });
            return { order, repeated: false };
          }, { isolationLevel: 'Serializable', timeout: 15000 });
          break;
        } catch (error) {
          if (error.code === 'P2002') {
            const existing = await db.orders.findUnique({ where: { checkout_key: key } });
            if (existing) { result = replay(existing); break; }
          }
          if (error.code === 'P2034') {
            if (attempt < 2) continue;
            throw new CheckoutError(409, 'Checkout is busy. Retry with the same checkout key.');
          }
          throw error;
        }
      }
      if (result.repeated && storedImageUrl) { await storage.remove(storedImageUrl).catch(() => {}); storedImageUrl = ''; }
      res.status(result.repeated ? 200 : 201).json({ order: confirmation(result.order) });
    } catch (error) {
      if (storedImageUrl) await storage.remove(storedImageUrl).catch(() => {});
      if (error instanceof CheckoutError) return res.status(error.status).json({ error: error.message });
      next(error);
    }
  });
  return router;
};
