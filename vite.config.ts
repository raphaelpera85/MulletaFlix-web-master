/// <reference types="vitest" />
/// <reference types="vite/client" />
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import fs from 'fs';

const htmlPlugin = () => ({
    name: 'html-transform',
    enforce: 'pre' as const,
    async resolveId(source: string, importer: string | undefined) {
        // Redireciona imports de HTML para ?html-string
        if (source.endsWith('.html') && !source.endsWith('index.html')) {
            const resolved = await this.resolve(source, importer, { skipSelf: true });
            if (resolved) {
                return resolved.id + '?html-string';
            }
        }
        // Redireciona imports de Workers para ?worker nativo do Vite
        if (source.endsWith('.worker.ts') || source.endsWith('.worker.js')) {
            if (!source.includes('?')) {
                const resolved = await this.resolve(source, importer, { skipSelf: true });
                if (resolved) {
                    return resolved.id + '?worker';
                }
            }
        }
        return null;
    },
    load(id: string) {
        if (id.endsWith('?html-string')) {
            const filePath = id.replace(/\?html-string$/, '');
            const content = fs.readFileSync(filePath, 'utf-8');
            return `export default ${JSON.stringify(content)};`;
        }
        return null;
    }
});

export default defineConfig({
    resolve: {
        alias: [
            { find: /^~/, replacement: '' }
        ]
    },
    base: './',
    root: 'src',
    plugins: [ tsconfigPaths(), htmlPlugin() ],
    define: {
        __COMMIT_SHA__: JSON.stringify('release'),
        __JF_BUILD_VERSION__: JSON.stringify('Release'),
        __PACKAGE_JSON_NAME__: JSON.stringify('MulletaFlix-web'),
        __PACKAGE_JSON_VERSION__: JSON.stringify('12.0.0'),
        __USE_SYSTEM_FONTS__: 'false',
        __WEBPACK_SERVE__: 'false'
    },
    build: {
        outDir: '../dist',
        emptyOutDir: true
    },
    test: {
        coverage: {
            include: [ 'src' ]
        },
        environment: 'jsdom',
        restoreMocks: true
    }
});
