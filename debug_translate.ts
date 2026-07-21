import { readFileSync } from 'node:fs';

const content = readFileSync('dist/assets/index--876D5oI.js', 'utf8');

// Find the glob maps (CT, AT, OT) which map paths to lazy imports
// CT = dashboardControllers, AT = wizardControllers, OT = defaultControllers
// The pattern is: const CT = Object.assign({...paths...})

// Search for HTML paths that are resolved via dynamic import
const htmlPathRegex = /\"\.\.\/\.\.\/(?:apps\/(?:dashboard|wizard)\/controllers|controllers)\/[^"]+\.html\"/g;
let match: RegExpExecArray | null;
const htmlPaths: string[] = [];

while ((match = htmlPathRegex.exec(content)) !== null) {
    const start = match.index;
    const context = content.substring(start, start + 200);
    htmlPaths.push(context);
}

console.log('HTML paths in controller globs:');
htmlPaths.forEach((path, index) => console.log(`${index}: ${path.substring(0, 150)}`));
