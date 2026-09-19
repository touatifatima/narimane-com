const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { once } = require('node:events');
const db = require('../db');
const createApp = require('../app');

async function check() {
  let product, rate, server;
  const keys = [];
  const key = () => { const value = randomUUID(); keys.push(value); return value; };
  try {
    rate = await db.delivery_rates.create({ data: { wilaya_code: randomUUID().slice(0, 8), wilaya_name: 'API test', fee: '450.25' } });
    product = await db.products.create({ data: { name: 'Checkout test', price: '1000.25',
      product_variants: { create: [
        { size: 'M', color: 'Black', stock: 10 }, { size: 'L', color: 'White', stock: 1 },
      ] },
    }, include: { product_variants: { orderBy: { id: 'asc' } } } });
    const [a, b] = product.product_variants;
    server = createApp(db).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}`;
    const body = { customer_name: 'Test customer', phone: '0550000000', wilaya_code: rate.wilaya_code,
      commune: 'Test', address: 'Test address', items: [{ variant_id: a.id, quantity: 1 }, { variant_id: a.id, quantity: 1 }, { variant_id: b.id, quantity: 1 }],
      subtotal: 1, delivery_fee: 0, total: 1,
    };
    const post = async (payload, checkoutKey = key()) => {
      const response = await fetch(`${base}/api/orders`, { method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': checkoutKey }, body: JSON.stringify(payload) });
      return { status: response.status, body: await response.json() };
    };
    const checkoutKey = key();
    const first = await post(body, checkoutKey);
    assert.equal(first.status, 201);
    assert.equal(first.body.order.subtotal, '3000.75');
    assert.equal(first.body.order.total, '3451.00');
    const stored = await db.orders.findUnique({ where: { checkout_key: checkoutKey }, include: { order_items: true } });
    assert.equal(stored.order_items.length, 2);
    assert.equal((await post(body, checkoutKey)).status, 200);
    assert.equal(await db.admin_notifications.count({ where: { order_id: stored.id, kind: 'new_order' } }), 1);
    assert.equal((await db.product_variants.findUnique({ where: { id: a.id } })).stock, 8);
    assert.equal((await post({ ...body, address: 'Changed' }, checkoutKey)).status, 409);
    assert.equal((await post({ ...body, items: [] })).status, 400);
    assert.equal((await post({ ...body, phone: 'bad' })).status, 400);
    assert.equal((await post({ ...body, wilaya_code: 'missing' })).status, 422);
    assert.equal((await post(body)).status, 409);
    // The earlier decrement of variant a must roll back when b is sold out.
    assert.equal((await db.product_variants.findUnique({ where: { id: a.id } })).stock, 8);
    await db.product_variants.update({ where: { id: a.id }, data: { stock: 1 } });
    const lastItem = { ...body, items: [{ variant_id: a.id, quantity: 1 }] };
    const competing = await Promise.all([post(lastItem), post(lastItem)]);
    assert.deepEqual(competing.map(x => x.status).sort(), [201, 409]);
    assert.equal((await db.product_variants.findUnique({ where: { id: a.id } })).stock, 0);
    await db.product_variants.update({ where: { id: a.id }, data: { stock: 2 } });
    const retryKey = key();
    const retries = await Promise.all([post(lastItem, retryKey), post(lastItem, retryKey)]);
    assert.deepEqual(retries.map(x => x.status).sort(), [200, 201]);
    assert.equal(retries[0].body.order.reference, retries[1].body.order.reference);
    assert.equal((await db.product_variants.findUnique({ where: { id: a.id } })).stock, 1);
    await db.products.update({ where: { id: product.id }, data: { is_active: false } });
    assert.equal((await post(lastItem)).status, 409);
    const rates = await (await fetch(`${base}/api/delivery-rates`)).json();
    assert.equal(rates.delivery_rates.find(r => r.wilaya_code === rate.wilaya_code).fee, '450.25');
    console.log('Order API checks passed: multi-item cart, trusted totals, rollback, concurrent stock and duplicate protection.');
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await db.$transaction(async tx => {
      const orders = await tx.orders.findMany({ where: { checkout_key: { in: keys } }, select: { id: true } });
      await tx.order_items.deleteMany({ where: { order_id: { in: orders.map(o => o.id) } } });
      await tx.orders.deleteMany({ where: { checkout_key: { in: keys } } });
      if (product) {
        await tx.product_variants.deleteMany({ where: { product_id: product.id } });
        await tx.products.delete({ where: { id: product.id } });
      }
      if (rate) await tx.delivery_rates.delete({ where: { id: rate.id } });
    });
  }
}
check().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
