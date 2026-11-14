import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

const apiPort = Number(process.env.CHEVRON_API_PORT ?? 5174)

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: { '/api': `http://localhost:${apiPort}` },
  },
  test: {
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
  },
})
