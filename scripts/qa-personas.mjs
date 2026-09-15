#!/usr/bin/env node
/**
 * End-to-end QA: drives the real UI (Playwright + Chromium, phone viewport) through the five
 * KICKOFF personas and checks the results screen, letters, WhatsApp share and print view.
 *
 * Usage:  node scripts/qa-personas.mjs [baseUrl]        (default http://127.0.0.1:8080)
 * Needs:  playwright (npm i -g playwright, or NODE_PATH to a global install) and a Chromium.
 * Output: PASS/FAIL per persona + screenshots in ./qa-output (git-ignored).
 */
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import { PERSONAS } from '../tests/fixtures/personas.js';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { console.error('playwright not found — npm i -g playwright && export NODE_PATH=$(npm root -g)'); process.exit(2); }

const BASE = process.argv[2] || 'http://127.0.0.1:8080';
const TODAY = '2026-09-15';
const OUT = new URL('../qa-output/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const questions = JSON.parse(readFileSync(new URL('../questions.json', import.meta.url), 'utf8'));
const rules = JSON.parse(readFileSync(new URL('../rules.json', import.meta.url), 'utf8'));
const qById = Object.fromEntries(questions.questions.map((q) => [q.id, q]));
const rightById = Object.fromEntries(rules.rights.map((r) => [r.id, r]));

// Fake a Hebrew voice so the read-aloud controls render (Chromium headless has no voices).
const TTS_STUB = `
  const spoken = [];
  window.__spoken = spoken;
  const voices = [{ lang: 'he-IL', name: 'Carmit', default: false, localService: true, voiceURI: 'Carmit' }];
  const synth = { getVoices: () => voices, cancel: () => {}, speak: (u) => spoken.push(u.text), speaking: false, pending: false, paused: false,
    addEventListener: () => {}, removeEventListener: () => {} };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
`;

const failures = [];
const check = (cond, msg) => { if (!cond) failures.push(msg); return cond; };

async function answerScreen(page, answers, done = new Set()) {
  const all = await page.$$eval('[data-qid]', (els) => els.map((e) => e.getAttribute('data-qid')));
  const qids = all.filter((id) => !done.has(id));
  for (const qid of qids) {
    done.add(qid);
    const q = qById[qid];
    const fs = page.locator(`[data-qid="${qid}"]`);
    if (!(await fs.count())) continue; // disappeared after a sibling answer (show_if)
    if (q.type === 'text') { if (answers[qid]) await fs.locator('input').fill(String(answers[qid])); continue; }
    if (q.type === 'month_year') {
      if (answers.birth_month) await fs.locator('select[name="birth_month"]').selectOption(String(answers.birth_month));
      if (answers.birth_year) await fs.locator('select[name="birth_year"]').selectOption(String(answers.birth_year));
      continue;
    }
    const v = answers[qid];
    if (v === undefined) { failures.push(`question ${qid} rendered but persona has no answer`); continue; }
    const vals = Array.isArray(v) ? v : [v];
    for (const val of vals) {
      const input = page.locator(`[data-qid="${qid}"] input[value="${val}"]`);
      if (!(await input.count())) { failures.push(`option ${qid}=${val} not rendered`); continue; }
      if (!(await input.isChecked())) await page.locator(`[data-qid="${qid}"] label:has(input[value="${val}"])`).click();
    }
  }
  // questions revealed by the answers above (same screen, e.g. siud_level after benefits)
  const after = await page.$$eval('[data-qid]', (els) => els.map((e) => e.getAttribute('data-qid')));
  if (after.some((id) => !done.has(id))) await answerScreen(page, answers, done);
}

async function runPersona(browser, id, p) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'he-IL' });
  const page = await ctx.newPage();
  await page.addInitScript(TTS_STUB);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${BASE}/?today=${TODAY}`);
  await page.waitForSelector('[data-action="start"]');
  check((await page.locator('html').getAttribute('dir')) === 'rtl', 'dir=rtl');
  check((await page.locator('html').getAttribute('lang')) === 'he', 'lang=he');

  const self = p.answers.for_whom === 'self';
  await page.locator(`input[name="entry"][value="${self ? 'self' : 'parent'}"]`).locator('xpath=ancestor::label').click();
  await page.locator('[data-action="start"]').click();

  const visited = [];
  for (let guard = 0; guard < 15; guard++) {
    const h1 = (await page.locator('h1').first().textContent()).trim();
    if (h1.startsWith('הרשימה')) break;
    const progress = await page.locator('.progress').textContent();
    const screenId = await page.evaluate(() => JSON.parse(sessionStorage.getItem('zchuyot.state.v1')).screen);
    visited.push({ screenId, h1, progress: progress.trim() });
    // read-aloud button present (stubbed Hebrew voice) & text size control present
    check((await page.locator('[data-action="speak"][data-speech="screen"]').isVisible()), `${id}: read-aloud button visible on ${screenId}`);
    check((await page.locator('[data-action="size"]').count()) === 3, `${id}: text-size control on ${screenId}`);
    // one h1
    check((await page.locator('h1').count()) === 1, `${id}: exactly one h1 on ${screenId}`);
    // primary button ≥56px
    const box = await page.locator('[data-action="next"]').boundingBox();
    check(box && box.height >= 56, `${id}: primary button ≥56px on ${screenId} (got ${box?.height})`);
    await answerScreen(page, p.answers);
    if (id === 'P1' && screenId === 'S1') await page.screenshot({ path: `${OUT}${id}-${screenId}.png`, fullPage: true });
    if (screenId === 'S3' || screenId === 'S6') await page.screenshot({ path: `${OUT}${id}-${screenId}.png`, fullPage: true });
    await page.locator('[data-action="next"]').click();
    await page.waitForTimeout(50);
  }
  const h1 = (await page.locator('h1').first().textContent()).trim();
  check(h1.startsWith('הרשימה'), `${id}: reached results (h1="${h1}")`);
  await page.screenshot({ path: `${OUT}${id}-results.png`, fullPage: true });

  // screens visited in the UI vs engine expectation (for "self" the landing replaces S1)
  const expectedUi = p.screens - (self ? 1 : 0);
  check(visited.length === expectedUi, `${id}: UI question screens ${visited.length} (expected ${expectedUi}); visited=${visited.map((v) => v.screenId).join(',')}`);
  if (p.renderedScreens) {
    const exp = p.renderedScreens.filter((s) => !(self && s === 'S1'));
    check(JSON.stringify(visited.map((v) => v.screenId)) === JSON.stringify(exp), `${id}: screen order ${visited.map((v) => v.screenId)} vs ${exp}`);
  }
  // progress label shrinks monotonically and last step equals total
  const totals = visited.map((v) => Number(/~(\d+)/.exec(v.progress)?.[1]));
  const steps = visited.map((v) => Number(/שלב (\d+)/.exec(v.progress)?.[1]));
  check(totals.every((t, i) => i === 0 || t <= totals[i - 1]), `${id}: progress total never grows (${totals})`);
  if (visited.length && !p.preRetirement) check(steps.at(-1) === totals.at(-1) && totals.at(-1) === p.screens, `${id}: final progress "${visited.at(-1).progress}" == ${p.screens}/${p.screens}`);

  // results: cards per status
  const got = {};
  for (const st of ['likely', 'check', 'info']) {
    for (const el of await page.$$(`.group--${st} article.card`)) got[(await el.getAttribute('id')).replace('card-', '')] = st;
  }
  const exp = p.expect;
  const missing = Object.keys(exp).filter((k) => got[k] !== exp[k]);
  const extra = Object.keys(got).filter((k) => !(k in exp));
  check(!missing.length && !extra.length, `${id}: cards mismatch — missing/wrong: ${missing.map((k) => `${k}(${got[k] || 'absent'}≠${exp[k]})`).join(', ') || '-'}; extra: ${extra.join(', ') || '-'}`);
  for (const [rid, variant] of Object.entries(p.variants || {})) {
    const v = rightById[rid].variants[variant];
    const card = page.locator(`#card-${rid}`);
    if (v.title_suffix) check((await card.locator('h3').textContent()).includes(v.title_suffix.trim()), `${id}: ${rid} title suffix`);
    if (v.note) check((await card.locator('.card__note').textContent()).trim() === v.note, `${id}: ${rid} variant note`);
  }
  // copy rules: source line + never "זכאי/ת" without "כנראה" in status labels; calibrated statuses
  for (const el of await page.$$('article.card')) {
    const rid = (await el.getAttribute('id')).replace('card-', '');
    const src = await el.$eval('.card__source', (n) => n.textContent).catch(() => '');
    check(/^מקור: .+ · נבדק \d{1,2}\.\d{1,2}\.\d{4}/.test(src), `${id}: source line on ${rid}: "${src}"`);
    const badge = await el.$eval('.badge', (n) => n.textContent.trim());
    check(['כנראה זכאי/ת', 'שווה לבדוק', 'כדאי לדעת'].some((s) => badge.endsWith(s)), `${id}: badge text "${badge}"`);
    if (rightById[rid].caveats) check((await el.$('.card__caveat')) !== null, `${id}: caveat shown on ${rid}`);
    check((await el.$('[data-action="speak"]')) !== null, `${id}: read-aloud on card ${rid}`);
  }
  if (p.preRetirement) check((await page.locator('.note--info').count()) === 1, `${id}: pre-retirement note shown`);
  // sticky footer
  for (const a of ['share', 'print', 'restart']) check(await page.locator(`#footer [data-action="${a}"]`).isVisible(), `${id}: footer ${a}`);
  const wa = await page.locator('#footer [data-action="share"]').getAttribute('href');
  check(wa.startsWith('https://wa.me/?text='), `${id}: wa.me link`);
  const waText = decodeURIComponent(wa.replace('https://wa.me/?text=', ''));
  check(waText.includes('נבדק לפי כל זכות וביטוח לאומי, 14.9.2026'), `${id}: share text has the verified line`);
  check(waText.includes(BASE) || waText.includes('http'), `${id}: share text has site URL`);
  for (const rid of Object.keys(exp)) check(waText.includes(rightById[rid].title.slice(0, 20)), `${id}: share text lists ${rid}`);
  // read-aloud on results speaks
  await page.locator('[data-action="speak"][data-speech="screen"]').first().click();
  check((await page.evaluate(() => window.__spoken.length)) > 0, `${id}: results read-aloud spoke`);
  // refresh keeps the results (sessionStorage)
  await page.reload();
  await page.waitForSelector('article.card');
  check((await page.locator('h1').first().textContent()).trim().startsWith('הרשימה'), `${id}: results survive refresh`);

  // letter flow for the first card that has one
  const letterBtn = page.locator('[data-action="letter"]').first();
  if (await letterBtn.count()) {
    const letterId = await letterBtn.getAttribute('data-letter');
    const rid = await letterBtn.getAttribute('data-right');
    await letterBtn.click();
    await page.waitForSelector('#letter-paper .ph');
    check((await page.locator('h1').count()) === 1, `${id}: letter has one h1`);
    const paper = page.locator('#letter-paper');
    check((await paper.textContent()).includes('15.9.2026'), `${id}: letter date filled`);
    check(!(await paper.textContent()).includes('{{'), `${id}: no raw placeholders in letter`);
    // fill the form and see it reflected
    const inputs = await page.$$('[data-letter-field]');
    check(inputs.length >= 5, `${id}: letter form has fields (${inputs.length})`);
    for (const el of inputs) {
      const name = await el.getAttribute('name');
      const tag = await el.evaluate((n) => n.tagName);
      if (tag === 'SELECT') continue;
      const sample = { id_number: '012345678', eligible_id: '012345678', property_sqm: '80', phone: '050-1234567', eligible_phone: '050-1234567', contract_number: '123456' }[name] || `בדיקה-${name}`;
      await el.fill(sample);
    }
    const txt = await paper.textContent();
    check(txt.includes('012345678') || txt.includes('בדיקה-'), `${id}: typed values appear in letter`);
    check(!txt.includes('__________') || letterId === 'L3', `${id}: all L1/L2 placeholders filled after typing (${letterId})`);
    if (letterId === 'L1') check(txt.includes(p.answers.seniors_in_home === '2' ? '150%' : 'הכנסתי מכל מקור'), `${id}: income_line auto-filled`);
    if (letterId === 'L3') check(txt.includes('הוראת קבע לתשלום: לא') || txt.includes('הוראת קבע לתשלום: כן'), `${id}: L3 yes/no filled`);
    await page.screenshot({ path: `${OUT}${id}-letter-${letterId}.png`, fullPage: true });
    // copy → plain text on dataset
    const plain = await paper.getAttribute('data-plain');
    check(plain && !plain.includes('**') && !plain.includes('{{'), `${id}: plain text for copy is clean`);
    // print view
    await page.emulateMedia({ media: 'print' });
    check(await page.locator('.letter-form').isHidden(), `${id}: letter form hidden in print`);
    check(await page.locator('.topbar').isHidden(), `${id}: topbar hidden in print`);
    await page.screenshot({ path: `${OUT}${id}-letter-${letterId}-print.png`, fullPage: true });
    await page.emulateMedia({ media: 'screen' });
    await page.locator('[data-action="back-results"]').click();
    await page.waitForSelector('article.card');
    check(rightById[rid].letter === letterId, `${id}: letter id matches right`);
  }
  // results print view
  await page.emulateMedia({ media: 'print' });
  await page.screenshot({ path: `${OUT}${id}-results-print.png`, fullPage: true });
  await page.emulateMedia({ media: 'screen' });

  check(errors.length === 0, `${id}: console/page errors: ${errors.join(' | ')}`);
  await ctx.close();
  return visited;
}

const browser = await chromium.launch();
try {
  for (const [id, p] of Object.entries(PERSONAS)) {
    const before = failures.length;
    const visited = await runPersona(browser, id, p);
    const ok = failures.length === before;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${id} — ${p.label} — screens: ${visited.map((v) => `${v.screenId}[${v.progress}]`).join(' → ')}`);
  }
} finally { await browser.close(); }

if (failures.length) { console.log('\nFAILURES:'); failures.forEach((f) => console.log(' - ' + f)); process.exit(1); }
console.log('\nAll personas passed in the real UI.');
