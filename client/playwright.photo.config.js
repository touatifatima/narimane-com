import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: ['product-photo.spec.js', 'admin-session.spec.js'],
  use: { baseURL: 'http://localhost:5181', headless: true },
  webServer: { command: 'npm run dev -- --port 5181', url: 'http://localhost:5181', reuseExistingServer: false },
});
