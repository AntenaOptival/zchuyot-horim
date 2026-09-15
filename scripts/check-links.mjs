#!/usr/bin/env node
/**
 * check-links.mjs — HEAD/GET every URL in rules.json (and questions.json, strings.*.json,
 * letters/*.md, README.md, DISCLAIMER.md) and print the failures.
 *
 * Usage:
 *   node scripts/check-links.mjs                 # live check
 *   node scripts/check-links.mjs --offline       # syntax/duplicate pass only (no network)
 *   node scripts/check-links.mjs --timeout=20000 --concurrency=4
 *
 * Behind a corporate proxy Node's fetch needs: NODE_USE_ENV_PROXY=1 (Node ≥ 22.21).
 *
 * Exit codes: 0 = all reachable (gov.il 403s are reported but do not fail — they block
 * non-browser clients); 1 = at least one real failure; 2 = usage/offline-syntax error.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const OFFLINE = !!args.offline;
const TIMEOUT = Number(args.timeout || 15000);
const CONCURRENCY = Number(args.concurrency || 4);
const UA = 'Mozilla/5.0 (compatible; zchuyot-horim-linkcheck/1.0; +https://github.com/AntenaOptival/zchuyot-horim)';

// Hosts that routinely answer 403 to non-browser clients; report, don't fail the build.
const SOFT_HOSTS = [/\.gov\.il$/i, /^gov\.il$/i, /^itur\.mof\.gov\.il$/i, /^www\.iec\.co\.il$/i];

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
if (existsSync(join(ROOT, 'research'))) for (const f of readdirSync(join(ROOT, 'research'))) if (f.endsWith('.md')) walkText(readFileSync(join(ROOT, 'research', f), 'utf8'), `research/${f}`);

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
const isSoft = (url) => { try { return SOFT_HOSTS.some((re) => re.test(new URL(url).hostname)); } catch { return false; } };

async function probe(url) {
  const target = encodeURI(decodeURI(url)); // normalise Hebrew paths / spaces once
  const attempt = async (method) => {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), TIMEOUT);
    try {
      const res = await fetch(target, { method, redirect: 'follow', signal: ctl.signal, headers: { 'user-agent': UA, accept: 'text/html,application/pdf,*/*;q=0.8', 'accept-language': 'he,en;q=0.7' } });
      return { status: res.status, finalUrl: res.url, ok: res.ok };
    } finally { clearTimeout(t); }
  };
  try {
    let r = await attempt('HEAD');
    if (!r.ok) r = await attempt('GET'); // many servers reject HEAD
    return { url, ...r, error: null };
  } catch (e) {
    return { url, status: 0, ok: false, finalUrl: null, error: e.cause?.code || e.name || String(e) };
  }
}

const urls = [...found.keys()];
const results = [];
let i = 0;
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (i < urls.length) { const u = urls[i++]; results.push(await probe(u)); }
}));

const okList = results.filter((r) => r.ok);
const soft = results.filter((r) => !r.ok && isSoft(r.url) && (r.status === 403 || r.status === 0));
const hard = results.filter((r) => !r.ok && !soft.includes(r));

console.log(`\n${okList.length} OK · ${soft.length} blocked-for-bots (gov.il etc., not failing) · ${hard.length} FAILED`);
const show = (r) => {
  console.log(`  ${r.status ? `HTTP ${r.status}` : `ERR ${r.error}`}  ${r.url}`);
  if (r.finalUrl && decodeURI(r.finalUrl) !== decodeURI(r.url)) console.log(`      → redirected to ${r.finalUrl}`);
  for (const where of found.get(r.url)) console.log(`      used in: ${where}`);
};
if (soft.length) { console.log('\nBlocked for non-browser clients (verify manually in a browser):'); soft.forEach(show); }
if (hard.length) { console.log('\nFAILED:'); hard.forEach(show); }
const redirected = okList.filter((r) => r.finalUrl && decodeURI(r.finalUrl).replace(/\/$/, '') !== decodeURI(r.url).replace(/\/$/, ''));
if (redirected.length) { console.log('\nOK but redirected (consider updating the URL):'); redirected.forEach(show); }
process.exit(hard.length ? 1 : 0);
