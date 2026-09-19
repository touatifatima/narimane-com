const prisma = require('./db');

const app = require('./app')(prisma);
const port = process.env.PORT || 3000;

async function start() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('PostgreSQL connected');
    app.listen(port, () => {
      console.log(`API running at http://localhost:${port}`);
    });
  } catch {
    console.error('Cannot connect to PostgreSQL. Check DATABASE_URL in server/.env and make sure PostgreSQL is running.');
    await prisma.$disconnect();
    process.exitCode = 1;
  }
}

start();
