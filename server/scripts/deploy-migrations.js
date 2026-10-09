const { spawnSync } = require('node:child_process');

if (process.env.SKIP_DB_MIGRATIONS === '1') {
  console.log('Database migrations skipped for the local prebuilt bundle.');
  process.exit(0);
}

const connectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Supabase database environment variables are missing.');
  process.exit(1);
}

const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(command, ['prisma', 'migrate', 'deploy'], {
  cwd: require('node:path').resolve(__dirname, '..'),
  env: { ...process.env, DATABASE_URL: connectionString },
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
