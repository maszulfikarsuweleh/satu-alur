import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

const abs = (p) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  resolve: {
    alias: [
      // src/cloud.js meng-import './cloud.config.js' yang tidak ada di repo (gitignored).
      { find: /^\.\/cloud\.config\.js$/, replacement: abs('./tests/stubs/cloud.config.js') },
      // SDK WorkBuddy tidak dipakai di test — ganti dengan stub agar tidak butuh jaringan.
      { find: '@tencent-ai/workbuddy-cloud-sdk', replacement: abs('./tests/stubs/workbuddy-sdk.js') },
    ],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.js'],
    restoreMocks: true,
    testTimeout: 15000,
    // Satu fork: jsdom dimuat sekali (banyak worker = banyak kali muat jsdom, lambat & boros).
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
})
