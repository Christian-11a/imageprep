// Smoke-test the built static app mounted below a repository-style URL path.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const root = resolve('dist');
const mount = '/ImagePrep/';
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (!pathname.startsWith(mount)) { response.writeHead(404).end(); return; }
    const file = resolve(root, pathname.slice(mount.length) || 'index.html');
    if (!file.startsWith(root + sep)) { response.writeHead(403).end(); return; }
    const contents = await readFile(file);
    response.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' });
    response.end(contents);
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}${mount}`;
let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ acceptDownloads: true });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await page.goto(url);
  await page.getByRole('button', { name: 'Try a sample image' }).click();
  await page.getByRole('listitem').waitFor();
  await page.getByRole('button', { name: /Prepare images|Prepare remaining|All images prepared/ }).click();
  await page.getByRole('button', { name: 'Download all', exact: true }).waitFor();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download all', exact: true }).click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), 'imageprep-exports.zip');
  assert.equal(await download.failure(), null);
  assert.deepEqual(errors, []);
  console.log('Production subpath smoke passed: assets, sample, WebP export, lazy ZIP bundle, and download.');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
