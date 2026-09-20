const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const rawConnectionString = process.env.VERCEL
  ? process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL
  : process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL;

if (!rawConnectionString) {
  throw new Error('Set DATABASE_URL or connect a Supabase Postgres resource before starting the server.');
}

const connectionUrl = new URL(rawConnectionString);
if (connectionUrl.searchParams.get('sslmode') === 'require') {
  connectionUrl.searchParams.set('uselibpqcompat', 'true');
}

const adapter = new PrismaPg({
  connectionString: connectionUrl.toString(),
  max: 1,
  connectionTimeoutMillis: 5000,
});

const prisma = new PrismaClient({ adapter });

module.exports = prisma;
