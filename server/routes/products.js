const express = require('express');

const selection = {
  id: true, name: true, description: true, price: true, image_url: true, customization_enabled: true,
  images: { orderBy: [{ position: 'asc' }, { id: 'asc' }], select: { id: true, url: true, position: true } },
  product_variants: {
    where: { is_active: true },
    orderBy: { id: 'asc' },
    select: { id: true, size: true, color: true, stock: true },
  },
};

function serialize(product) {
  const { product_variants, ...fields } = product;
  return {
    ...fields,
    image_url: product.images[0]?.url || product.image_url,
    price: product.price.toFixed(2),
    currency: 'DZD',
    variants: product_variants.map(variant => ({ ...variant, available: variant.stock > 0 })),
  };
}

module.exports = function productRoutes(db) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    const pageValue = req.query.page ?? '1';
    const limitValue = req.query.limit ?? '20';
    if (typeof pageValue !== 'string' || typeof limitValue !== 'string'
      || !/^[1-9]\d*$/.test(pageValue) || !/^[1-9]\d*$/.test(limitValue)) {
      return res.status(400).json({ error: 'page and limit must be positive integers.' });
    }
    const page = Number(pageValue);
    const limit = Number(limitValue);
    const skip = (page - 1) * limit;
    if (!Number.isSafeInteger(page) || limit > 100 || !Number.isSafeInteger(skip) || skip > 2147483647) {
      return res.status(400).json({ error: 'Invalid page or limit. Maximum limit is 100.' });
    }
    const products = await db.products.findMany({
      where: { is_active: true }, select: selection, orderBy: { id: 'desc' },
      skip, take: limit + 1,
    });
    res.json({
      products: products.slice(0, limit).map(serialize),
      pagination: { page, limit, has_more: products.length > limit },
    });
  });

  router.get('/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!/^[1-9]\d*$/.test(req.params.id) || !Number.isSafeInteger(id) || id > 2147483647) {
      return res.status(400).json({ error: 'Product ID must be a positive integer.' });
    }
    const product = await db.products.findFirst({
      where: { id, is_active: true }, select: selection,
    });
    if (!product) return res.status(404).json({ error: 'Product not found.' });
    res.json({ product: serialize(product) });
  });

  return router;
};
