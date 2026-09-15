// Fuzz-compares engine.js with tests/reference_engine.py (the executable definition).
// Skipped when python3 is not available.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createEngine } from '../engine.js';

const rules = JSON.parse(readFileSync(new URL('../rules.json', import.meta.url), 'utf8'));
const questions = JSON.parse(readFileSync(new URL('../questions.json', import.meta.url), 'utf8'));
const engine = createEngine(rules, questions);

const HARNESS = `
import sys, json, datetime as dt
sys.path.insert(0, ${JSON.stringify(new URL('.', import.meta.url).pathname)})
import reference_engine as R
cases = json.load(sys.stdin)
out = []
for c in cases:
    today = dt.date(c["today"]["year"], c["today"]["month"], 15)
    res, shown = R.evaluate(R.RULES, c["answers"], today)
    out.append({"results": [[rid, st, v] for rid, st, v in res], "screens": R.count_screens(shown)})
print(json.dumps(out))
`;

function hasPython() {
  const r = spawnSync('python3', ['--version'], { encoding: 'utf8' });
  return r.status === 0;
}

// Deterministic PRNG so failures are reproducible.
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}

function randomPersona(rand) {
  const a = {};
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  for (const q of questions.questions) {
    const r = rand();
    if (q.type === 'text') { if (r < 0.5) a[q.id] = 'שם'; continue; }
    if (q.type === 'month_year') {
      if (r < 0.9) { a.birth_year = 1930 + Math.floor(rand() * 41); a.birth_month = 1 + Math.floor(rand() * 12); }
      continue;
    }
    if (r < 0.12) continue; // unanswered
    if (r < 0.27 && !q.no_dontknow) { a[q.id] = 'dontknow'; continue; }
    const values = q.options.map((o) => o.value);
    if (q.type === 'single') { a[q.id] = pick(values); continue; }
    // multi: exclusive option alone, or a random non-empty subset of the others
    const excl = q.options.filter((o) => o.exclusive).map((o) => o.value);
    if (excl.length && rand() < 0.25) { a[q.id] = [pick(excl)]; continue; }
    const rest = values.filter((v) => !excl.includes(v));
    const subset = rest.filter(() => rand() < 0.45);
    a[q.id] = subset.length ? subset : [pick(rest)];
  }
  return a;
}

test('engine.js matches reference_engine.py on 400 random personas', { skip: !hasPython() && 'python3 not available' }, () => {
  const rand = rng(20260915);
  const todays = [{ year: 2026, month: 9 }, { year: 2027, month: 1 }, { year: 2025, month: 6 }];
  const cases = [];
  for (let i = 0; i < 400; i++) cases.push({ answers: randomPersona(rand), today: todays[i % todays.length] });

  const py = spawnSync('python3', ['-c', HARNESS], { input: JSON.stringify(cases), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  assert.equal(py.status, 0, `python harness failed: ${py.stderr}`);
  const expected = JSON.parse(py.stdout);

  let mismatches = 0;
  cases.forEach((c, i) => {
    const got = engine.evaluate(c.answers, c.today).map((r) => [r.right, r.status, r.variant]);
    const flow = engine.resolveFlow(c.answers, c.today);
    const screens = engine.countScreens(flow.rendered);
    try {
      assert.deepEqual(got, expected[i].results);
      assert.equal(screens, expected[i].screens);
    } catch (e) {
      mismatches++;
      if (mismatches <= 3) console.error(`case ${i}`, JSON.stringify(c), '\nJS:', JSON.stringify(got), '\nPY:', JSON.stringify(expected[i].results), e.message);
    }
  });
  assert.equal(mismatches, 0, `${mismatches} mismatching personas`);
});
