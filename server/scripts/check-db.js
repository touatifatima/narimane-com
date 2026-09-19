const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const prisma = require('../db');

async function check() {
  await prisma.products.count();
  const rollback = new Error('Rollback verification data');
  try {
    await prisma.$transaction(async tx => {
      const suffix = randomUUID();
      const rate = await tx.delivery_rates.create({ data: {
        wilaya_code: `test-${suffix}`, wilaya_name: 'Test', fee: 500,
      } });
      assert.equal(rate.is_active, true);
      await tx.admins.count();
      const product = await tx.products.create({ data: { name: 'Connection test', price: 1500 } });
      const variant = await tx.product_variants.create({
        data: { product_id: product.id, size: 'M', color: 'Black', stock: 2 },
      });
      const order = await tx.orders.create({
        data: {
          customer_name: 'Test', phone: '0000000000', wilaya: 'Test',
          commune: 'Test', address: 'Test', subtotal: 3000, delivery_fee: rate.fee,
          order_items: { create: {
            variant_id: variant.id, product_name: product.name, size: variant.size,
            color: variant.color, unit_price: product.price, quantity: 2,
          } },
        },
        include: { order_items: true },
      });
      assert.equal(order.total.toString(), '3500');
      assert.equal(order.order_items[0].line_total.toString(), '3000');
      await tx.delivery_rates.update({ where: { id: rate.id }, data: { fee: 700 } });
      const savedOrder = await tx.orders.findUniqueOrThrow({ where: { id: order.id } });
      assert.equal(savedOrder.delivery_fee.toString(), '500');
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  console.log('Prisma reads, writes, relations and generated totals verified; test data rolled back.');
}

check().catch(() => {
  console.error('Database verification failed.');
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
