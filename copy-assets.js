const fs = require('fs');
const path = require('path');

function copySync(src, dest) {
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }
    fs.cpSync(src, dest, { recursive: true, force: true });
    console.log(`Copied: ${src} -> ${dest}`);
}

const rootDir = __dirname;
const srcDir = path.join(rootDir, 'src');
const distDir = path.join(rootDir, 'dist');

// 1. Copy static assets
copySync(path.join(srcDir, 'assets'), path.join(distDir, 'assets'));
copySync(path.join(srcDir, 'config.json'), path.join(distDir, 'config.json'));
copySync(path.join(srcDir, 'robots.txt'), path.join(distDir, 'robots.txt'));
copySync(path.join(srcDir, 'manifest.json'), path.join(distDir, 'manifest.json'));
copySync(path.join(srcDir, 'serviceworker.js'), path.join(distDir, 'serviceworker.js'));

// 2. Copy themes and compile SCSS
copySync(path.join(srcDir, 'themes'), path.join(distDir, 'themes'));

const sass = require('sass');
const themes = ['appletv', 'blueradiance', 'dark', 'light', 'purplehaze', 'wmc'];
themes.forEach(theme => {
    const scssPath = path.join(srcDir, 'themes', theme, 'theme.scss');
    const destPath = path.join(distDir, 'themes', theme, 'theme.css');
    if (fs.existsSync(scssPath)) {
        try {
            const result = sass.compile(scssPath);
            fs.writeFileSync(destPath, result.css);
            console.log(`Compiled theme SCSS: ${theme} -> ${destPath}`);
        } catch (e) {
            console.error(`Failed to compile theme ${theme}:`, e);
        }
    }
});

// 3. Copy libraries from node_modules
const libraries = [
    { from: 'libarchive.js/dist/worker-bundle.js', to: 'worker-bundle.js' },
    { from: 'libarchive.js/dist/libarchive.wasm', to: 'libarchive.wasm' },
    { from: '@jellyfin/libass-wasm/dist/js/default.woff2', to: 'default.woff2' },
    { from: '@jellyfin/libass-wasm/dist/js/subtitles-octopus-worker.js', to: 'subtitles-octopus-worker.js' },
    { from: '@jellyfin/libass-wasm/dist/js/subtitles-octopus-worker.wasm', to: 'subtitles-octopus-worker.wasm' },
    { from: '@jellyfin/libass-wasm/dist/js/subtitles-octopus-worker-legacy.js', to: 'subtitles-octopus-worker-legacy.js' },
    { from: 'pdfjs-dist/build/pdf.worker.js', to: 'pdf.worker.js' },
    { from: 'libpgs/dist/libpgs.worker.js', to: 'libpgs.worker.js' }
];

libraries.forEach(lib => {
    const srcPath = path.join(rootDir, 'node_modules', lib.from);
    const destPath = path.join(distDir, 'libraries', lib.to);
    if (fs.existsSync(srcPath)) {
        copySync(srcPath, destPath);
    } else {
        console.warn(`Library asset not found: ${srcPath}`);
    }
});

console.log('Static assets copying completed!');
