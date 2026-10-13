import { defineConfig } from 'vite';
export default defineConfig({ base: './', resolve: { preserveSymlinks: true }, server: { port: 5173, strictPort: true, watch: { ignored: ['**/docs/**', '**/test-results/**', '**/playwright-report/**', '**/.local/**'] } }, test: { include: ['src/tests/**/*.test.ts'] } } as Parameters<typeof defineConfig>[0]);
