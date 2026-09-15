#!/usr/bin/env node
/**
 * check-links.mjs — HEAD/GET every URL in rules.json (and questions.json, strings.*.json,
 * letters/*.md, README.md, DISCLAIMER.md) and print the failures.
 *
 * Usage:
 *   node scripts/check-links.mjs                 # live check with fetch (HEAD, then GET)
 *   node scripts/check-links.mjs --browser       # load every URL in headless Chromium (Playwright) —
 *                                                #   needed for Kol Zchut, which answers 403 to plain fetch
 *   node scripts/check-links.mjs --offline       # syntax/duplicate pass only (no network)
 *   node scripts/check-links.mjs --all           # also scan research/*.md notes
 *   node scripts/check-links.mjs --timeout=20000 --concurrency=4
 *
 * Behind a corporate proxy Node's fetch needs: NODE_USE_ENV_PROXY=1 (Node ≥ 22.21).
 *
 * Classification: 2xx = OK · 403 / bot challenge = "blocked for bots" (reported, does NOT fail —
 * gov.il and Kol Zchut do this from CI; verify those in a browser or with --browser) ·
 * 404 / 410 / 5xx / network error / MediaWiki "page does not exist" = FAILED.
 * Exit codes: 0 = no failures; 1 = at least one failure; 2 = usage/offline-syntax error.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const OFFLINE = !!args.offline;
const BROWSER = !!args.browser;
const SCAN_ALL = !!args.all;
const TIMEOUT = Number(args.timeout || 15000);
const CONCURRENCY = Number(args.concurrency || 4);
const UA = 'Mozilla/5.0 (compatible; zchuyot-horim-linkcheck/1.0; +https://github.com/AntenaOptival/zchuyot-horim)';

// A 403 (or a bot challenge page) from ANY host means "the server refused this client", not "the page
// is gone" — reported, never fatal. github.com answers 404 to anonymous clients while the repo is private.
const SOFT_GITHUB = /^github\.com$/i;

// ---- collect URLs --------------------------------------------------------------
const found = new Map(); // url → Set(where)
const add = (url, where) => { if (!found.has(url)) found.set(url, new Set()); found.get(url).add(where); };

function walkJson(node, path, file) {
  if (typeof node === 'string') {
    if (/^https?:\/\//i.test(node.trim())) add(node.trim(), `${file} → ${path}`);
    return;
  }
  if (Array.isArray(node)) node.forEach((v, i) => walkJson(v, `${path}[${i}]`, file));
  else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) walkJson(v, path ? `${path}.${k}` : k, file);
}
function walkText(text, file) {
  for (const m of text.matchAll(/https?:\/\/[^\s<>()\[\]"'`|]+/g)) {
    const url = m[0].replace(/[.,;:!?…*]+$/u, ''); // trailing punctuation
    if (/^https?:\/\/?$/.test(url) || /localhost|127\.0\.0\.1/.test(url) || /\/\.\.\.$|…/.test(m[0]) || /^https?:\/\/[^/]+\/(he\/)?$/.test(url)) continue; // examples in docs
    add(url, `${file}:${text.slice(0, m.index).split('\n').length}`);
  }
}

for (const f of ['rules.json', 'questions.json', ...readdirSync(ROOT).filter((x) => /^strings\.[a-z-]+\.json$/i.test(x))]) {
  if (!existsSync(join(ROOT, f))) continue;
  const data = JSON.parse(readFileSync(join(ROOT, f), 'utf8'));
  walkJson(data, '', f);
  // rules.json rights: name the right in the location for nicer output
  if (f === 'rules.json') for (const r of data.rights || []) {
    for (const l of r.links || []) add(l.url, `rules.json → ${r.id}.links "${l.label}"`);
    for (const s of r.sources || []) add(s.url, `rules.json → ${r.id}.sources "${s.name}"`);
  }
}
for (const f of ['README.md', 'DISCLAIMER.md', 'OPEN_QUESTIONS.md', 'VERIFICATION.md']) if (existsSync(join(ROOT, f))) walkText(readFileSync(join(ROOT, f), 'utf8'), f);
if (existsSync(join(ROOT, 'letters'))) for (const f of readdirSync(join(ROOT, 'letters'))) if (f.endsWith('.md')) walkText(readFileSync(join(ROOT, 'letters', f), 'utf8'), `letters/${f}`);
if (SCAN_ALL && existsSync(join(ROOT, 'research'))) for (const f of readdirSync(join(ROOT, 'research'))) if (f.endsWith('.md')) walkText(readFileSync(join(ROOT, 'research', f), 'utf8'), `research/${f}`);

// ---- offline syntax pass -----------------------------------------------------------
const syntaxErrors = [];
const hosts = new Map();
for (const url of found.keys()) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') syntaxErrors.push(`${url} — not https`);
    if (/\s/.test(url) && !/kolzchut|btl\.gov\.il/.test(url)) syntaxErrors.push(`${url} — contains whitespace`);
    hosts.set(u.hostname, (hosts.get(u.hostname) || 0) + 1);
  } catch { syntaxErrors.push(`${url} — invalid URL`); }
}
console.log(`Collected ${found.size} unique URLs across ${[...hosts.keys()].length} hosts:`);
for (const [h, n] of [...hosts.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}  ${h}`);
if (syntaxErrors.length) { console.log('\nSyntax problems:'); syntaxErrors.forEach((e) => console.log('  ✗ ' + e)); }
if (OFFLINE) { console.log(syntaxErrors.length ? '\nOffline pass: FAIL' : '\nOffline pass: OK (no network requests made)'); process.exit(syntaxErrors.length ? 2 : 0); }

// ---- live check --------------------------------------------------------------------
const hostOf = (url) => { try { return new URL(url).hostname; } catch { return ''; } };
const CHROME_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36';

async function probeFetch(url) {
  const target = encodeURI(decodeURI(url)); // normalise Hebrew paths / spaces once
  const attempt = async (method, ua) => {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), TIMEOUT);
    try {
      const res = await fetch(target, { method, redirect: 'follow', signal: ctl.signal, headers: { 'user-agent': ua, accept: 'text/html,application/xhtml+xml,application/pdf,*/*;q=0.8', 'accept-language': 'he-IL,he;q=0.9,en;q=0.7' } });
      return { status: res.status, finalUrl: res.url, ok: res.ok };
    } finally { clearTimeout(t); }
  };
  try {
    let r = await attempt('HEAD', UA);
    if (!r.ok) r = await attempt('GET', UA); // many servers reject HEAD
    if (r.status === 403) r = await attempt('GET', CHROME_UA); // some only dislike the UA
    return { url, ...r, error: null, via: 'fetch' };
  } catch (e) {
    const cause = e.cause ? (e.cause.code || e.cause.message || String(e.cause)) : '';
    return { url, status: 0, ok: false, finalUrl: null, error: [e.name, cause].filter(Boolean).join(': '), via: 'fetch' };
  }
}

/** Browser mode: real Chromium via Playwright. Detects bot challenges and MediaWiki "no such page". */
async function makeBrowserProbe() {
  let chromium;
  try { ({ chromium } = await import('playwright')); } catch {
    try { const { createRequire } = await import('node:module'); ({ chromium } = createRequire(import.meta.url)('playwright')); } catch {
      console.error('--browser needs playwright: npm i -g playwright && npx playwright install chromium (or set NODE_PATH to the global node_modules)');
      process.exit(2);
    }
  }
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ locale: 'he-IL', userAgent: CHROME_UA, viewport: { width: 412, height: 915 } });
  const probe = async (url) => {
    const page = await ctx.newPage();
    try {
      const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
      const status = res ? res.status() : 0;
      const finalUrl = page.url();
      const title = await page.title().catch(() => '');
      const missing = await page.evaluate(() => !!document.querySelector('.noarticletext, .mw-newarticletext') || /אין (טקסט|מאמר) בדף|הדף המבוקש לא נמצא|Page not found/i.test(document.body?.innerText?.slice(0, 4000) || '')).catch(() => false);
      const challenge = /just a moment|attention required|access denied|checking your browser/i.test(title) || (status === 403 && /cloudflare|captcha/i.test(await page.content().catch(() => '')));
      const ok = status >= 200 && status < 300 && !missing && !challenge;
      return { url, status: challenge ? 403 : status, finalUrl, ok, error: missing ? 'MediaWiki: page does not exist' : null, title, via: 'browser' };
    } catch (e) {
      return { url, status: 0, ok: false, finalUrl: null, error: e.message.split('\n')[0], via: 'browser' };
    } finally { await page.close(); }
  };
  return { probe, close: () => browser.close() };
}

const urls = [...found.keys()];
const results = [];
const bp = BROWSER ? await makeBrowserProbe() : null;
const probe = bp ? bp.probe : probeFetch;
let i = 0;
await Promise.all(Array.from({ length: BROWSER ? Math.min(CONCURRENCY, 3) : CONCURRENCY }, async () => {
  while (i < urls.length) { const u = urls[i++]; results.push(await probe(u)); }
}));
if (bp) await bp.close();

const okList = results.filter((r) => r.ok);
const soft = results.filter((r) => !r.ok && (r.status === 403 || (r.status === 404 && SOFT_GITHUB.test(hostOf(r.url)))));
const hard = results.filter((r) => !r.ok && !soft.includes(r));

console.log(`\n${okList.length} OK · ${soft.length} blocked-for-bots / private (reported, not failing) · ${hard.length} FAILED   [mode: ${BROWSER ? 'browser' : 'fetch'}]`);
const show = (r) => {
  console.log(`  ${r.status ? `HTTP ${r.status}` : `ERR ${r.error}`}${r.status && r.error ? ` (${r.error})` : ''}  ${r.url}`);
  if (r.finalUrl && decodeURI(r.finalUrl).replace(/\/$/, '') !== decodeURI(r.url).replace(/\/$/, '')) console.log(`      → redirected to ${decodeURI(r.finalUrl)}`);
  if (r.title) console.log(`      title: ${r.title.slice(0, 90)}`);
  for (const where of found.get(r.url)) console.log(`      used in: ${where}`);
};
if (soft.length) { console.log('\nBlocked for non-browser clients / private (verify manually in a browser, or run with --browser):'); soft.forEach(show); }
if (hard.length) { console.log('\nFAILED:'); hard.forEach(show); }
const redirected = okList.filter((r) => r.finalUrl && decodeURI(r.finalUrl).replace(/\/$/, '') !== decodeURI(r.url).replace(/\/$/, ''));
if (redirected.length) { console.log('\nOK but redirected (check the destination is still the intended page):'); redirected.forEach(show); }
if (okList.length && BROWSER) { console.log('\nOK (browser):'); okList.forEach((r) => console.log(`  HTTP ${r.status}  ${r.url}  — ${(r.title || '').slice(0, 70)}`)); }
process.exit(hard.length ? 1 : 0);
