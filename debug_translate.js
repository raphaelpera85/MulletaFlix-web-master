const fs = require('fs');
const content = fs.readFileSync('dist/assets/index--876D5oI.js', 'utf8');

// Find the glob maps (CT, AT, OT) which map paths to lazy imports
// CT = dashboardControllers, AT = wizardControllers, OT = defaultControllers
// The pattern is: const CT = Object.assign({...paths...})

// Search for HTML paths that are resolved via dynamic import
const htmlPathRegex = /\"\.\.\/\.\.\/(?:apps\/(?:dashboard|wizard)\/controllers|controllers)\/[^"]+\.html\"/g;
let match;
const htmlPaths = [];
while ((match = htmlPathRegex.exec(content)) !== null) {
  const start = match.index;
  // Get more context around each match
  const context = content.substring(start, start + 200);
  htmlPaths.push(context);
}

console.log('HTML paths in controller globs:');
htmlPaths.forEach((p, i) => console.log(`${i}: ${p.substring(0, 150)}`));
