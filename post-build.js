import fs from 'fs';

const htmlPath = './dist/index.html';
const varMap = {
  'bg-dark': '#0a0d14',
  'bg-surface': '#111622',
  'bg-card': 'rgba(18, 24, 38, 0.7)',
  'bg-card-focused': 'rgba(32, 42, 64, 0.9)',
  'border-subtle': 'rgba(255, 255, 255, 0.08)',
  'border-focused': 'rgba(245, 158, 11, 0.9)',
  'accent-gold': '#f59e0b',
  'accent-gold-hover': '#d97706',
  'accent-crimson': '#ef4444',
  'text-main': '#f8fafc',
  'text-secondary': '#94a3b8',
  'text-muted': '#64748b',
  'font-family': "system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans Arabic', sans-serif",
  'border-radius': '8px',
  'transition-speed': '0.18s'
};

try {
  if (fs.existsSync(htmlPath)) {
    let content = fs.readFileSync(htmlPath, 'utf8');
    // Remove crossorigin attributes from all tags
    content = content.replace(/\bcrossorigin\b/g, '');
    
    // Find the polyfill file name and legacy entry file name from dist/assets
    const assetsDir = './dist/assets';
    let polyfillFile = '';
    let legacyEntryFile = '';
    if (fs.existsSync(assetsDir)) {
      const files = fs.readdirSync(assetsDir);
      polyfillFile = files.find(f => f.startsWith('polyfills-legacy-') && f.endsWith('.js')) || '';
      legacyEntryFile = files.find(f => f.startsWith('index-legacy-') && f.endsWith('.js')) || '';
    }
    
    console.log('Detected built assets:', { polyfillFile, legacyEntryFile });

    // Remove Vite-inserted module and nomodule script tags
    content = content.replace(/<script type="module"[\s\S]*?<\/script>/gi, '');
    content = content.replace(/<script nomodule[\s\S]*?<\/script>/gi, '');

    // Inject clean legacy scripts before </body>
    if (polyfillFile && legacyEntryFile) {
      const cleanScripts = `
  <script src="./assets/${polyfillFile}"></script>
  <script src="./assets/${legacyEntryFile}"></script>
`;
      content = content.replace('</body>', `${cleanScripts}</body>`);
    }

    // Also make sure all references to assets are relative (./assets)
    content = content.replace(/href="\/assets\//g, 'href="./assets/');
    content = content.replace(/src="\/assets\//g, 'src="./assets/');
    
    fs.writeFileSync(htmlPath, content, 'utf8');
    console.log('Successfully sanitized dist/index.html for webOS TV!');

    // Sanitize CSS files by prepending static fallback values for all CSS variables
    if (fs.existsSync(assetsDir)) {
      const files = fs.readdirSync(assetsDir);
      files.forEach(file => {
        if (file.endsWith('.css')) {
          const cssPath = `${assetsDir}/${file}`;
          let cssContent = fs.readFileSync(cssPath, 'utf8');
          
          const lines = cssContent.split('\n');
          const newLines = lines.map(line => {
            if (line.includes('var(--')) {
              const idx = line.indexOf(':');
              if (idx > -1) {
                const prop = line.substring(0, idx).trim();
                const val = line.substring(idx + 1).trim();
                if (prop && val && val.includes('var(--') && !prop.startsWith('@') && !prop.startsWith('{') && !prop.startsWith('}')) {
                  const resolvedValue = val.replace(/var\(--([\w-]+)\)/g, (vMatch, varName) => {
                    return varMap[varName] !== undefined ? varMap[varName] : vMatch;
                  });
                  return `  ${prop}: ${resolvedValue}${resolvedValue.endsWith(';') ? '' : ';'}${line}`;
                }
              }
            }
            return line;
          });
          
          fs.writeFileSync(cssPath, newLines.join('\n'), 'utf8');
          console.log(`Successfully injected CSS variable fallbacks into ${file}!`);
        }
      });
    }

    const appinfoPath = './dist/appinfo.json';
    if (fs.existsSync(appinfoPath)) {
      const appinfo = JSON.parse(fs.readFileSync(appinfoPath, 'utf8'));
      console.log(`Verified dist/appinfo.json id: ${appinfo.id}, version: ${appinfo.version}`);
    }
  } else {
    console.error('Build output dist/index.html not found.');
  }
} catch (e) {
  console.error('Error in post-build sanitization:', e);
}
