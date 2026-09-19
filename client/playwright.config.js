import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', workers: 1, timeout: 60000,
  use: { baseURL: 'http://localhost:5180', headless: true },
  webServer: [
    { command: 'node index.js', cwd: '../server', env: { PORT: '3098' }, url: 'http://localhost:3098/api/health', reuseExistingServer: false },
    { command: 'npm run dev -- --port 5180', env: { API_PROXY_TARGET: 'http://localhost:3098', VITE_API_URL: '' }, url: 'http://localhost:5180', reuseExistingServer: false },
  ],
});
