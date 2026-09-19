const assert = require('node:assert/strict');
const { once } = require('node:events');
const prisma = require('../db');
const createApp = require('../app');

async function check() {
  const rollback = new Error('Rollback test data');
  try {
    await prisma.$transaction(async tx => {
      const product = await tx.products.create({ data: {
        name: 'API verification', price: '1900.50',
        product_variants: { create: [
          { size: 'M', color: 'Black', stock: 3 },
          { size: 'L', color: 'Black', stock: 0 },
          { size: 'S', color: 'Black', stock: 2, is_active: false },
        ] },
      } });
      const hidden = await tx.products.create({ data: {
        name: 'Hidden verification', price: 1000, is_active: false,
      } });
      const server = createApp(tx).listen(0, '127.0.0.1');
      await once(server, 'listening');
      const base = `http://127.0.0.1:${server.address().port}`;
      try {
        const response = await fetch(`${base}/api/products/${product.id}`);
        assert.equal(response.status, 200);
        const body = await response.json();
        assert.equal(body.product.price, '1900.50');
        assert.equal(body.product.currency, 'DZD');
        assert.equal(body.product.variants.length, 2);
        assert.equal(body.product.variants[0].available, true);
        assert.equal(body.product.variants[1].available, false);
        assert.equal((await fetch(`${base}/api/products/${hidden.id}`)).status, 404);
        for (const suffix of ['abc', '-1', '1.5', '2147483648']) {
          assert.equal((await fetch(`${base}/api/products/${suffix}`)).status, 400);
        }
        for (const query of ['page=0', 'limit=101', 'page=1.5', 'page=1&page=2']) {
          assert.equal((await fetch(`${base}/api/products?${query}`)).status, 400);
        }
        const list = await (await fetch(`${base}/api/products?limit=1`)).json();
        assert.equal(list.products.length, 1);
        assert.equal(list.products[0].id, product.id);
        assert.equal(list.pagination.page, 1);
        assert.equal((await fetch(`${base}/api/health/db`)).status, 200);
      } finally {
        await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      }
      throw rollback;
    }, { timeout: 30000 });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  console.log('Product API checks passed; test records rolled back.');
}

check().catch(error => {
  console.error('Product API check failed:', error.code || error.name);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
