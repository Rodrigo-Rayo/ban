// Static server for dist/ with the production CSP from vercel.json (used by playwright.prod.config.ts).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('dist/bandyou/browser');
const vercel = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
const csp = vercel.headers[0].headers.find(h => h.key === 'Content-Security-Policy').value
  .replace('; upgrade-insecure-requests', ''); // local http
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.woff': 'font/woff' };

http.createServer((req, res) => {
  let file = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Content-Security-Policy': csp });
  fs.createReadStream(file).pipe(res);
}).listen(4300, () => console.log('dist on http://localhost:4300'));
