#!/usr/bin/env node
/**
 * Accessibility + behaviour QA: injects axe-core into every view of the app (landing, question
 * screens, results, letter, about) at a phone viewport and reports violations; also checks a few
 * behaviours that the persona walk-through does not cover (self entry → A+, early exit, back, about).
 *
 * Usage: node scripts/qa-a11y.mjs [baseUrl]   — needs playwright + axe-core (global installs OK via NODE_PATH)
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { PERSONAS } from '../tests/fixtures/personas.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const BASE = process.argv[2] || 'http://127.0.0.1:8080';
const TODAY = '2026-09-15';
const TTS_STUB = `Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[{lang:'he-IL',name:'Carmit'}],cancel(){},speak(u){(window.__spoken||=[]).push(u.text)},addEventListener(){}}}); window.SpeechSynthesisUtterance=function(t){this.text=t};`;
const failures = [];
const check = (c, m) => { if (!c) failures.push(m); return c; };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'he-IL' });
const page = await ctx.newPage();
await page.addInitScript(TTS_STUB);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const seed = async (state) => {
  await page.evaluate((s) => sessionStorage.setItem('zchuyot.state.v1', JSON.stringify({ letterValues: {}, tracked: { q: [], cards: false, results: false, letters: [] }, earlyExit: false, letter: null, entry: 'parent', ...s })), state);
  await page.reload();
};
async function axe(label) {
  await page.evaluate(axeSource);
  const res = await page.evaluate(async () => await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } }));
  const serious = res.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
  const all = res.violations;
  console.log(`${all.length === 0 ? 'PASS' : serious.length ? 'FAIL' : 'WARN'} axe ${label}: ${all.length} violation(s)` + (all.length ? ' — ' + all.map((v) => `${v.id}(${v.impact}×${v.nodes.length})`).join(', ') : ''));
  for (const v of all) for (const n of v.nodes.slice(0, 3)) console.log(`     ${v.id}: ${n.html.slice(0, 120)} — ${n.failureSummary?.split('\n')[1] || v.help}`);
  check(serious.length === 0, `axe ${label}: ${serious.map((v) => v.id).join(', ')}`);
  // structural checks on every view
  check((await page.locator('h1').count()) === 1, `${label}: one h1`);
  check((await page.locator('html').getAttribute('dir')) === 'rtl', `${label}: rtl`);
  const small = await page.$$eval('body *', (els) => els.filter((e) => { const cs = getComputedStyle(e); return e.children.length === 0 && e.textContent.trim() && cs.display !== 'none' && parseFloat(cs.fontSize) < 18; }).map((e) => e.tagName + ':' + e.textContent.trim().slice(0, 30)));
  check(small.length === 0, `${label}: text under 18px: ${small.slice(0, 5).join(' | ')}`);
}

// landing
await page.goto(`${BASE}/?today=${TODAY}`);
await page.waitForSelector('[data-action="start"]');
await axe('landing');
// about
await page.locator('[data-action="about"]').click();
await page.waitForSelector('ol.sources li');
check((await page.locator('ol.sources li').count()) === 28, 'about: 28 rights listed with sources');
await axe('about');
await page.locator('[data-action="home"]').click();

// self entry → A+ and read-aloud hint, S1 skipped
await page.evaluate(() => localStorage.removeItem('zchuyot.textsize'));
await page.locator('label:has(input[name="entry"][value="self"])').click();
await page.locator('[data-action="start"]').click();
await page.waitForSelector('[data-qid="gender"]');
check((await page.locator('html').getAttribute('class')).includes('size-a1'), 'self entry starts at A+');
check(await page.locator('.hint.tts-only').isVisible(), 'self entry suggests read-aloud');
check((await page.locator('.progress').textContent()).includes('שלב 2'), 'self entry lands on S2');
await axe('S2 (self)');
// validation message when pressing next without answering
await page.locator('[data-action="next"]').click();
check(await page.locator('.field-error').first().isVisible(), 'inline error when required answer missing');
check((await page.locator('.progress').textContent()).includes('שלב 2'), 'stays on S2 after validation error');
await axe('S2 with error');
// back to landing from S2 (self) → goes to S1 (for_whom shown) then landing
await page.locator('[data-action="back"]').click();
await page.waitForSelector('[data-qid="for_whom"]');
await page.locator('[data-action="back"]').click();
await page.waitForSelector('[data-action="start"]');
await page.evaluate(() => localStorage.removeItem('zchuyot.textsize'));

// P3-like flow to S3 with siud_level revealed, then S6 (housing with_family → no arnona qs), then S8 (ww2 → survivor_payment revealed)
const P3 = PERSONAS.P3.answers;
await seed({ view: 'question', screen: 'S3', answers: { for_whom: 'parent', name: 'סימה', gender: 'f', birth_year: 1938, birth_month: 6 } });
await page.waitForSelector('[data-qid="benefits"]');
check((await page.locator('[data-qid="adl_help"]').count()) === 1, 'S3: adl_help shown before benefits answered');
await page.locator('[data-qid="benefits"] label:has(input[value="old_age"])').click();
await page.locator('[data-qid="benefits"] label:has(input[value="siud"])').click();
await page.waitForSelector('[data-qid="siud_level"]');
check((await page.locator('[data-qid="adl_help"]').count()) === 0, 'S3: adl_help hidden once siud is ticked');
check(await page.locator('[data-qid="benefits"] input[value="siud"]').isChecked(), 'S3: siud stays checked after re-render');
// exclusive "none" unchecks others
await page.locator('[data-qid="benefits"] label:has(input[value="none"])').click();
check(!(await page.locator('[data-qid="benefits"] input[value="siud"]').isChecked()), 'S3: exclusive "none" unchecks siud');
await page.locator('[data-qid="benefits"] label:has(input[value="siud"])').click();
check(!(await page.locator('[data-qid="benefits"] input[value="none"]').isChecked()), 'S3: ticking siud unchecks "none"');
await page.locator('[data-qid="benefits"] label:has(input[value="old_age"])').click();
await page.locator('[data-qid="siud_level"] label:has(input[value="5"])').click();
await axe('S3 (benefits + siud_level)');
// early exit not offered before S4
check((await page.locator('[data-action="early-exit"]').count()) === 0, 'S3: no early-exit button');
await page.locator('[data-action="next"]').click();
await page.waitForSelector('[data-qid="seniors_in_home"]');
check((await page.locator('[data-action="early-exit"]').count()) === 1, 'S4: early-exit button offered');
await axe('S4');
// early exit → results with the note; unreached → check
await page.locator('[data-action="early-exit"]').click();
await page.waitForSelector('article.card');
check((await page.locator('.note').count()) >= 1 && (await page.locator('main').textContent()).includes('יצאתם לפני הסוף'), 'early exit note shown');
check((await page.locator('#card-transport_67').getAttribute('class')).includes('card--check'), 'early exit: transport_67 becomes check (ravkav unknown)');
check((await page.locator('#card-electricity').count()) === 1 && (await page.locator('#card-electricity').getAttribute('class')).includes('card--likely'), 'early exit: electricity stays likely (siud level 5 met; unknown contract only affects the variant)');
check((await page.locator('#card-electricity h3').textContent()).includes('צריך להעביר') === false, 'early exit: contract_other variant not applied when contract unknown');
await axe('results (early exit)');
// back to questions returns to S4 and clears early-exit
await page.locator('[data-action="back-questions"]').click();
await page.waitForSelector('[data-qid="seniors_in_home"]');
check((await page.locator('.progress').textContent()).includes('שלב 4'), 'back to questions returns to S4');

// S6 for a renter with arnona in name → three questions; S8 ww2 reveals survivor_payment
await seed({ view: 'question', screen: 'S6', answers: { ...P3, housing: undefined, electricity_contract: undefined, ww2: undefined, survivor_payment: undefined } });
await page.waitForSelector('[data-qid="housing"]');
check((await page.locator('[data-qid="arnona_in_name"]').count()) === 0, 'S6: arnona_in_name hidden before housing');
await page.locator('[data-qid="housing"] label:has(input[value="renter"])').click();
await page.waitForSelector('[data-qid="arnona_in_name"]');
await page.locator('[data-qid="arnona_in_name"] label:has(input[value="yes"])').click();
await page.waitForSelector('[data-qid="arnona_discount"]');
check((await page.locator('[data-qid]').count()) === 3, 'S6: three questions for renter with arnona in name');
await axe('S6 (3 questions)');
await page.locator('[data-qid="housing"] label:has(input[value="with_family"])').click();
check((await page.locator('[data-qid]').count()) === 1, 'S6: only housing for with_family');
await seed({ view: 'question', screen: 'S8', answers: { ...P3, ww2: undefined, survivor_payment: undefined } });
await page.waitForSelector('[data-qid="ww2"]');
check((await page.locator('[data-qid="survivor_payment"]').count()) === 0, 'S8: survivor_payment hidden before ww2');
await page.locator('[data-qid="ww2"] label:has(input[value="north_africa"])').click();
await page.waitForSelector('[data-qid="survivor_payment"]');
await page.locator('[data-qid="ww2"] label:has(input[value="dontknow"])').click();
check((await page.locator('[data-qid="survivor_payment"]').count()) === 1, 'S8: survivor_payment stays for ww2=dontknow (unknown predicate)');
check(!(await page.locator('[data-qid="ww2"] input[value="north_africa"]').isChecked()), 'S8: dontknow is exclusive');
await page.locator('[data-qid="ww2"] label:has(input[value="elsewhere"])').click();
check((await page.locator('[data-qid="survivor_payment"]').count()) === 0, 'S8: survivor_payment hidden for elsewhere');
await axe('S8');

// results for P5 + letter L2 + L3, A++ size
await seed({ view: 'results', screen: 'S10', answers: PERSONAS.P5.answers });
await page.waitForSelector('article.card');
await page.evaluate(() => localStorage.setItem('zchuyot.textsize', 'a2'));
await page.reload(); await page.waitForSelector('article.card');
check((await page.locator('html').getAttribute('class')).includes('size-a2'), 'A++ persisted across reload');
check(Math.abs(await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize)) - 28) < 0.5, 'A++ root font-size 28px');
check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no horizontal overflow at A++');
await axe('results P5 (A++)');
// tts toggle persists
await page.locator('[data-action="tts-toggle"]').click();
check((await page.locator('[data-action="tts-toggle"]').getAttribute('aria-pressed')) === 'true', 'auto-read toggle on');
await page.reload(); await page.waitForSelector('article.card');
check((await page.locator('[data-action="tts-toggle"]').getAttribute('aria-pressed')) === 'true', 'auto-read persists');
check((await page.evaluate(() => (window.__spoken || []).length)) > 0, 'auto-read spoke on load');
await page.locator('[data-action="tts-toggle"]').click();
// letters
await page.locator('#card-arnona_100_income_supplement [data-action="letter"]').click();
await page.waitForSelector('#letter-paper .ph');
check((await page.locator('#letter-paper').textContent()).includes('תוספת השלמת הכנסה לקצבת אזרח ותיק'), 'L2 benefit_name default');
await axe('letter L2 (A++)');
await page.locator('[data-action="back-results"]').click();
await page.waitForSelector('article.card');
await page.locator('#card-electricity [data-action="letter"]').click();
await page.waitForSelector('#letter-paper .ph');
check((await page.locator('#letter-paper').textContent()).includes('מקבל/ת תוספת השלמת הכנסה'), 'L3 eligibility_basis default');
check(await page.locator('.letter-note').isVisible(), 'L3 user note shown outside the letter');
await axe('letter L3 (A++)');
await page.evaluate(() => localStorage.removeItem('zchuyot.textsize'));

// P4 pre-retirement results
await seed({ view: 'results', screen: 'S2', answers: PERSONAS.P4.answers, entry: 'self' });
await page.waitForSelector('article.card');
check((await page.locator('h1').textContent()).trim() === 'הרשימה שלך', 'self h1 "הרשימה שלך"');
check((await page.locator('.note--info').textContent()).includes('גיל הפרישה'), 'pre-retirement note');
await axe('results P4');

// browser back button returns from results to the question flow
await seed({ view: 'question', screen: 'S10', answers: PERSONAS.P1.answers });
await page.waitForSelector('[data-qid="ravkav_gold"]');
await page.locator('[data-action="next"]').click();
await page.waitForSelector('article.card');
await page.goBack();
await page.waitForSelector('[data-qid="ravkav_gold"]');
check((await page.locator('.progress').textContent()).includes('שלב 8'), 'browser back returns to S10');

check(errors.length === 0, `console/page errors: ${errors.join(' | ')}`);
await browser.close();
if (failures.length) { console.log('\nFAILURES:'); failures.forEach((f) => console.log(' - ' + f)); process.exit(1); }
console.log('\nAll accessibility + behaviour checks passed.');
