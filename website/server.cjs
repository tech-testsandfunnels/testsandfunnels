/* server.cjs (website/)
   Tiny static file server for hosts that deploy the website as a Node.js app
   (Hostinger Node.js apps ask for an "entry file"). It serves the built Astro
   site from dist/ exactly like the Apache setup did:
     /about/ -> dist/about/index.html, /about -> 301 to /about/,
     unknown paths -> dist/404.html with status 404.
   CommonJS (.cjs) on purpose: Hostinger's launcher loads the entry with require().
   No dependencies. Build first with `npm run build`; start with `node server.cjs`.
   Static hosting (Framework preset "Astro", output "dist") does not need this file. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, 'dist');
const PORT = process.env.PORT || 4321;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.pdf': 'application/pdf',
};

const HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
};

function send(res, status, file, extra = {}) {
  const ext = path.extname(file).toLowerCase();
  const cache = ext === '.html' ? 'no-cache' : /\/_astro\//.test(file) ? 'public, max-age=31536000, immutable' : 'public, max-age=86400';
  res.writeHead(status, { ...HEADERS, 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': cache, ...extra });
  fs.createReadStream(file).pipe(res);
}

function notFound(res) {
  const page = path.join(ROOT, '404.html');
  if (fs.existsSync(page)) return send(res, 404, page);
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
}

http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    return res.end();
  }
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  } catch {
    return notFound(res);
  }
  const file = path.normalize(path.join(ROOT, pathname));
  if (!file.startsWith(ROOT)) return notFound(res); // no ../ escapes

  fs.stat(file, (err, st) => {
    if (!err && st.isFile()) return send(res, 200, file);
    if (!err && st.isDirectory()) {
      if (!pathname.endsWith('/')) {
        const q = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
        res.writeHead(301, { Location: pathname + '/' + q });
        return res.end();
      }
      const index = path.join(file, 'index.html');
      return fs.existsSync(index) ? send(res, 200, index) : notFound(res);
    }
    notFound(res);
  });
}).listen(PORT, () => {
  if (!fs.existsSync(ROOT)) console.warn('dist/ not found: run "npm run build" first');
  console.log('Website listening on http://localhost:' + PORT);
});
