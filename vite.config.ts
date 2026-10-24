import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function localContentApi() {
    return {
        name: 'local-content-api',
        configureServer(server: import('vite').ViteDevServer) {
            server.middlewares.use(async (req, res, next) => {
                if (!req.url?.startsWith('/api/v1/')) return next();
                if (req.method !== 'GET') {
                    res.statusCode = 405;
                    res.setHeader('Allow', 'GET');
                    res.setHeader('Content-Type', 'application/json; charset=utf-8');
                    res.end(JSON.stringify({ error: '目前只支援 GET。' }));
                    return;
                }
                const url = new URL(req.url, 'http://localhost');
                let parts: string[];
                try {
                    parts = url.pathname.slice('/api/v1/'.length).split('/').map(decodeURIComponent);
                } catch {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: '無效的資源網址。' }));
                    return;
                }

                try {
                    const data = await server.ssrLoadModule('/src/data/fixtures/content.ts');
                    let value: unknown;
                    if (parts.length === 2 && parts[0] === 'events' && parts[1] === data.EVENT_ID) value = data.event;
                    else if (parts.length === 2 && parts[0] === 'scenes') {
                        value = parts[1] === 'dusk-street' ? data.sceneView : parts[1] === 'test-yard' ? data.testScene : undefined;
                    } else if (parts.length === 3 && parts[0] === 'events' && parts[1] === data.EVENT_ID && parts[2] === 'booths') value = data.boothData();
                    else if (parts.length === 4 && parts[0] === 'events' && parts[1] === data.EVENT_ID && parts[2] === 'booths') value = data.boothData().find((booth: { participation: { id: string } }) => booth.participation.id === parts[3]);
                    else if (parts.length === 4 && parts[0] === 'events' && parts[1] === data.EVENT_ID && parts[2] === 'works') value = data.workData(parts[3]);
                    else if (parts.length === 3 && parts[0] === 'events' && parts[1] === data.EVENT_ID && parts[2] === 'campaigns') value = data.campaigns;

                    res.setHeader('Content-Type', 'application/json; charset=utf-8');
                    res.setHeader('Cache-Control', 'no-store');
                    if (value === undefined) {
                        res.statusCode = 404;
                        res.end(JSON.stringify({ error: '找不到這份內容。' }));
                    } else {
                        res.statusCode = 200;
                        res.end(JSON.stringify(value));
                    }
                } catch (error) {
                    server.config.logger.error('Local content API failed', { error });
                    res.statusCode = 500;
                    res.setHeader('Content-Type', 'application/json; charset=utf-8');
                    res.end(JSON.stringify({ error: '內容服務暫時無法使用。' }));
                }
            });
        }
    };
}

function adminGuideAsset() {
    return {
        name: 'admin-guide-asset',
        generateBundle(this: { emitFile: (asset: { type: 'asset'; fileName: string; source: string }) => void }) {
            this.emitFile({
                type: 'asset',
                fileName: 'docs/ADMIN_BACKEND_GUIDE.md',
                source: readFileSync(resolve(process.cwd(), 'docs/ADMIN_BACKEND_GUIDE.md'), 'utf8')
            });
        }
    };
}

export default defineConfig({
    base: './',
    plugins: [localContentApi(), adminGuideAsset()],
    resolve: { preserveSymlinks: true },
    server: { port: 5173, strictPort: true, watch: { ignored: ['**/docs/**', '**/test-results/**', '**/playwright-report/**', '**/.local/**'] } },
    build: { rollupOptions: { input: { main: 'index.html', admin: 'admin.html' } } },
    test: { include: ['src/tests/**/*.test.ts'] }
} as Parameters<typeof defineConfig>[0]);
