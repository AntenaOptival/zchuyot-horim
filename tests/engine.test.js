import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  UNKNOWN, NA, ev, get, derive, resolveFlow, evaluate, estimateScreens, countScreens,
  withEarlyExit, womenRetirementAge, parseAgeStr, equals, createEngine,
} from '../engine.js';

const rules = JSON.parse(readFileSync(new URL('../rules.json', import.meta.url), 'utf8'));
const questions = JSON.parse(readFileSync(new URL('../questions.json', import.meta.url), 'utf8'));
const TODAY = { year: 2026, month: 9 };
const engine = createEngine(rules, questions);

// A shown-set containing every plain field used below, so tests exercise the operators, not NA.
const ALL = new Set(['a', 'b', 'list', 'n', 'housing', 'benefits', 'birth_year']);

describe('predicates — three-valued logic', () => {
  test('eq', () => {
    assert.equal(ev({ eq: ['a', 'x'] }, { a: 'x' }, ALL), true);
    assert.equal(ev({ eq: ['a', 'x'] }, { a: 'y' }, ALL), false);
    assert.equal(ev({ eq: ['a', 'x'] }, { a: 'dontknow' }, ALL), UNKNOWN);
    assert.equal(ev({ eq: ['a', 'x'] }, {}, ALL), false, 'missing answer is not applicable → false');
    assert.equal(ev({ eq: ['a', 'x'] }, { a: 'x' }, new Set()), false, 'never shown → false even if a value exists');
    assert.equal(ev({ eq: ['derived.is_67plus', true] }, { 'derived.is_67plus': true }, new Set()), true, 'derived fields ignore the shown-set');
    assert.equal(ev({ eq: ['derived.is_67plus', true] }, {}, new Set()), false, 'missing derived → false');
  });
  test('in', () => {
    assert.equal(ev({ in: ['a', ['x', 'y']] }, { a: 'y' }, ALL), true);
    assert.equal(ev({ in: ['a', ['x', 'y']] }, { a: 'z' }, ALL), false);
    assert.equal(ev({ in: ['a', ['x', 'y']] }, { a: 'dontknow' }, ALL), UNKNOWN);
    assert.equal(ev({ in: ['a', ['x']] }, { a: ['x'] }, ALL), false, 'a list value is not "in" a list of strings');
  });
  test('includes (multi-select)', () => {
    assert.equal(ev({ includes: ['list', 'siud'] }, { list: ['old_age', 'siud'] }, ALL), true);
    assert.equal(ev({ includes: ['list', 'siud'] }, { list: ['old_age'] }, ALL), false);
    assert.equal(ev({ includes: ['list', 'siud'] }, { list: 'dontknow' }, ALL), UNKNOWN);
    assert.equal(ev({ includes: ['list', 'siud'] }, { list: ['dontknow'] }, ALL), UNKNOWN);
    assert.equal(ev({ includes: ['list', 'siud'] }, { list: [] }, ALL), false, 'empty list → not applicable');
    assert.equal(ev({ includes: ['a', 'x'] }, { a: 'x' }, ALL), false, 'includes on a scalar → false');
  });
  test('gte / lte', () => {
    assert.equal(ev({ gte: ['n', 62] }, { n: 62 }, ALL), true);
    assert.equal(ev({ gte: ['n', 62] }, { n: 61 }, ALL), false);
    assert.equal(ev({ lte: ['n', 1945] }, { n: 1945 }, ALL), true);
    assert.equal(ev({ lte: ['n', 1945] }, { n: '1946' }, ALL), false, 'numeric strings are coerced');
    assert.equal(ev({ lte: ['n', 1945] }, { n: 'dontknow' }, ALL), UNKNOWN);
    assert.equal(ev({ lte: ['n', 1945] }, {}, ALL), false);
  });
  test('unknown', () => {
    assert.equal(ev({ unknown: 'a' }, { a: 'dontknow' }, ALL), true);
    assert.equal(ev({ unknown: 'a' }, { a: 'x' }, ALL), false);
    assert.equal(ev({ unknown: 'a' }, {}, ALL), false, 'missing is NA, not unknown');
    assert.equal(ev({ unknown: 'a' }, { a: 'dontknow' }, new Set()), false, 'never shown is NA, not unknown');
  });
  test('all', () => {
    const T = { eq: ['a', 'x'] }, F = { eq: ['a', 'y'] }, U = { eq: ['b', 'x'] };
    const env = { a: 'x', b: 'dontknow' };
    assert.equal(ev({ all: [T, T] }, env, ALL), true);
    assert.equal(ev({ all: [T, F] }, env, ALL), false);
    assert.equal(ev({ all: [T, U] }, env, ALL), UNKNOWN);
    assert.equal(ev({ all: [U, F] }, env, ALL), false, 'false beats unknown');
    assert.equal(ev({ all: [] }, env, ALL), true);
  });
  test('any', () => {
    const T = { eq: ['a', 'x'] }, F = { eq: ['a', 'y'] }, U = { eq: ['b', 'x'] };
    const env = { a: 'x', b: 'dontknow' };
    assert.equal(ev({ any: [F, T] }, env, ALL), true);
    assert.equal(ev({ any: [F, F] }, env, ALL), false);
    assert.equal(ev({ any: [F, U] }, env, ALL), UNKNOWN);
    assert.equal(ev({ any: [U, T] }, env, ALL), true, 'true beats unknown');
    assert.equal(ev({ any: [] }, env, ALL), false);
  });
  test('not', () => {
    assert.equal(ev({ not: { eq: ['a', 'x'] } }, { a: 'x' }, ALL), false);
    assert.equal(ev({ not: { eq: ['a', 'x'] } }, { a: 'y' }, ALL), true);
    assert.equal(ev({ not: { eq: ['a', 'x'] } }, { a: 'dontknow' }, ALL), UNKNOWN);
    assert.equal(ev({ not: { eq: ['a', 'x'] } }, {}, ALL), true, 'not(NA→false) → true');
  });
  test('malformed predicates throw', () => {
    assert.throws(() => ev({ eq: ['a', 'x'], in: ['a', []] }, {}, ALL));
    assert.throws(() => ev({ bogus: ['a', 1] }, { a: 1 }, ALL));
    assert.throws(() => ev(null, {}, ALL));
  });
  test('get / equals helpers', () => {
    assert.equal(get({ a: '' }, 'a', ALL), NA);
    assert.equal(get({ a: [] }, 'a', ALL), NA);
    assert.equal(get({ a: 0 }, 'a', ALL), 0, 'zero is a value');
    assert.equal(equals(['a', 'b'], ['a', 'b']), true);
    assert.equal(equals(['a'], 'a'), false);
  });
});

describe('derived fields', () => {
  test('retirement-age table (women) and men 67', () => {
    assert.deepEqual(parseAgeStr('62y4m'), [62, 4]);
    assert.deepEqual(womenRetirementAge(rules, 1960, 5), [62, 4], 'born 1960-05 → 62y4m');
    assert.deepEqual(womenRetirementAge(rules, 1959, 12), [62, 0]);
    assert.deepEqual(womenRetirementAge(rules, 1944, 6), [60, 0]);
    assert.deepEqual(womenRetirementAge(rules, 1944, 7), [60, 4]);
    assert.deepEqual(womenRetirementAge(rules, 1975, 1), [65, 0]);
    // Rivka (P2's wife): born 1960-05, today 2026-09 → 66y4m ≥ 62y4m → reached
    const d = derive({ gender: 'f', birth_year: 1960, birth_month: 5 }, TODAY, rules);
    assert.equal(d['derived.age'], 66);
    assert.equal(d['derived.retirement_age_reached'], true);
    // a woman born 1964-06 is 62y3m in 2026-09; her retirement age is 63y6m → not reached
    assert.equal(derive({ gender: 'f', birth_year: 1964, birth_month: 6 }, TODAY, rules)['derived.retirement_age_reached'], false);
    // men: 67. Born 1959-09 → exactly 67y0m today → reached; born 1959-10 → not yet
    assert.equal(derive({ gender: 'm', birth_year: 1959, birth_month: 9 }, TODAY, rules)['derived.retirement_age_reached'], true);
    assert.equal(derive({ gender: 'm', birth_year: 1959, birth_month: 10 }, TODAY, rules)['derived.retirement_age_reached'], false);
  });
  test('age flags and pension_income', () => {
    const d = derive({ gender: 'f', birth_year: 1938, birth_month: 6, pension_status: 'pension_161d_unknown' }, TODAY, rules);
    assert.equal(d['derived.age'], 88);
    assert.equal(d['derived.is_65plus'], true);
    assert.equal(d['derived.is_90plus'], false);
    assert.equal(d['derived.pension_income'], 'yes');
    assert.equal(derive({ pension_status: 'no_pension' }, TODAY, rules)['derived.pension_income'], 'no');
    assert.equal(derive({ pension_status: 'dontknow' }, TODAY, rules)['derived.pension_income'], 'dontknow');
    assert.equal('derived.pension_income' in derive({}, TODAY, rules), false);
    assert.equal('derived.age' in derive({ birth_year: 1950 }, TODAY, rules), false, 'month missing → no age');
  });
  test('today accepts a Date', () => {
    const d = derive({ gender: 'm', birth_year: 1950, birth_month: 1 }, new Date(2026, 8, 15), rules);
    assert.equal(d['derived.age'], 76);
  });
});

describe('flow', () => {
  test('skip_if answers silently with default_when_skipped and the screen is not rendered', () => {
    const a = { for_whom: 'parent', gender: 'f', birth_year: 1946, birth_month: 1, benefits: ['old_age', 'income_supplement'], adl_help: 'no' };
    const f = resolveFlow(questions, a, TODAY, rules);
    assert.equal(f.env.seniors_in_home, '1');
    assert.equal(f.env.income_band, 'b1');
    assert.ok(f.shown.has('income_band'), 'skipped questions count as shown (real answers)');
    assert.ok(!f.rendered.has('income_band'));
    assert.ok(!f.renderedScreens.includes('S4'));
    assert.equal(f.nextScreen, 'S5');
    // the default is a REAL answer: income tests evaluate true, not unknown
    assert.equal(ev({ in: ['income_band', ['b1', 'b2']] }, f.env, f.shown), true);
  });
  test('show_if hides a question → not applicable → definite false downstream', () => {
    const a = { for_whom: 'parent', gender: 'f', birth_year: 1938, birth_month: 6, benefits: ['old_age', 'siud'], siud_level: '5', seniors_in_home: '1', income_band: 'b2', pension_status: 'no_pension', housing: 'with_family' };
    const f = resolveFlow(questions, a, TODAY, rules);
    assert.ok(!f.shown.has('arnona_in_name'));
    assert.ok(!f.shown.has('adl_help'), 'adl_help hidden for siud recipients');
    assert.ok(f.shown.has('siud_level'));
    assert.equal(ev({ eq: ['arnona_in_name', 'yes'] }, f.env, f.shown), false);
  });
  test('a persona never asked survivor_payment must not get survivor cards', () => {
    const a = { for_whom: 'parent', gender: 'f', birth_year: 1952, birth_month: 3, benefits: ['old_age'], adl_help: 'no', seniors_in_home: '1', income_band: 'b1', pension_status: 'no_pension', housing: 'owner', arnona_in_name: 'yes', arnona_discount: '25', disability: ['none'], ravkav_gold: 'no' };
    const ids = evaluate(rules, a, TODAY, questions).map((r) => r.right);
    assert.ok(!ids.includes('survivor_check'));
    assert.ok(!ids.includes('survivor_benefits'));
    assert.ok(!ids.includes('arnona_survivor'));
  });
  test('pre-retirement shortcut after S2', () => {
    const f = resolveFlow(questions, { for_whom: 'self', gender: 'm', birth_year: 1960, birth_month: 4 }, TODAY, rules);
    assert.equal(f.preRetirement, true);
    assert.deepEqual(f.renderedScreens, ['S1', 'S2']);
    assert.equal(f.nextScreen, null, 'flow ends → results');
    assert.ok(!f.shown.has('benefits'), 'remaining questions are not applicable');
    // a woman born 1964-06 (63y6m needed, is 62y3m) → shortcut too, but not for 1960-05
    assert.equal(resolveFlow(questions, { for_whom: 'self', gender: 'f', birth_year: 1964, birth_month: 6 }, TODAY, rules).preRetirement, true);
    assert.equal(resolveFlow(questions, { for_whom: 'self', gender: 'f', birth_year: 1960, birth_month: 5 }, TODAY, rules).preRetirement, false);
  });
  test('no shortcut before birth is answered; nextScreen walks forward', () => {
    let f = resolveFlow(questions, {}, TODAY, rules);
    assert.equal(f.preRetirement, false);
    assert.equal(f.nextScreen, 'S1');
    f = resolveFlow(questions, { for_whom: 'parent' }, TODAY, rules);
    assert.equal(f.nextScreen, 'S2', 'name is optional and does not block');
    f = resolveFlow(questions, { for_whom: 'parent', gender: 'f' }, TODAY, rules);
    assert.equal(f.nextScreen, 'S2', 'birth (month_year) incomplete');
    f = resolveFlow(questions, { for_whom: 'parent', gender: 'f', birth_year: 1950, birth_month: 1 }, TODAY, rules);
    assert.equal(f.nextScreen, 'S3');
  });
  test('early exit: unreached questions become dontknow → rights surface as check, hidden ones stay hidden', () => {
    const reached = { for_whom: 'parent', gender: 'f', birth_year: 1952, birth_month: 3, benefits: ['old_age'], adl_help: 'no', seniors_in_home: '1', income_band: 'b1' };
    const a = withEarlyExit(questions, reached);
    assert.equal(a.pension_status, 'dontknow');
    assert.equal(a.housing, 'dontknow');
    assert.equal(a.ravkav_gold, 'dontknow');
    assert.equal(a.name, undefined, 'text questions are left alone');
    assert.equal(a.birth_year, 1952);
    const res = Object.fromEntries(evaluate(rules, a, TODAY, questions).map((r) => [r.right, r.status]));
    assert.equal(res.tax_161d, 'check', 'depends on pension_status=dontknow → partial');
    assert.equal(res.transport_67, 'check', 'ravkav_gold unknown → check');
    assert.equal(res.income_supplement, 'likely', 'fully answered → still likely');
    assert.ok(!('survivor_check' in res), 'ww2 hidden by show_if (born 1952) stays not applicable');
    assert.ok(!('arnona_30' in res), 'arnona_in_name never shown (housing unknown) → not applicable → hidden');
    const f = resolveFlow(questions, a, TODAY, rules);
    assert.equal(f.nextScreen, null, 'nothing left to ask');
  });
  test('countScreens counts screens of rendered questions only', () => {
    assert.equal(countScreens(questions, new Set(['for_whom', 'name', 'gender'])), 2);
    assert.equal(countScreens(questions, new Set()), 0);
  });
  test('estimateScreens shrinks (never grows) as answers arrive', () => {
    const steps = [
      {},
      { for_whom: 'parent' },
      { for_whom: 'parent', gender: 'f', birth_year: 1952, birth_month: 3 },
      { for_whom: 'parent', gender: 'f', birth_year: 1952, birth_month: 3, benefits: ['old_age'], adl_help: 'no' },
      { for_whom: 'parent', gender: 'f', birth_year: 1952, birth_month: 3, benefits: ['old_age'], adl_help: 'no', seniors_in_home: '1', income_band: 'b1', pension_status: 'no_pension', housing: 'owner', arnona_in_name: 'yes', arnona_discount: '25' },
      { for_whom: 'parent', gender: 'f', birth_year: 1952, birth_month: 3, benefits: ['old_age'], adl_help: 'no', seniors_in_home: '1', income_band: 'b1', pension_status: 'no_pension', housing: 'owner', arnona_in_name: 'yes', arnona_discount: '25', disability: ['none'], ravkav_gold: 'no' },
    ];
    let prev = Infinity;
    for (const a of steps) {
      const n = estimateScreens(questions, a, TODAY, rules).length;
      assert.ok(n <= prev, `estimate grew from ${prev} to ${n}`);
      prev = n;
    }
    assert.equal(estimateScreens(questions, {}, TODAY, rules).length, 10, 'nothing answered → all 10 screens possible');
    assert.equal(estimateScreens(questions, steps[2], TODAY, rules).length, 9, 'born 1952 → WW2 screen closed');
    assert.equal(estimateScreens(questions, steps[4], TODAY, rules).length, 9, 'disability unanswered → electricity screen still possible (IDF path)');
    assert.equal(prev, 8, 'P1 fully answered → exactly the 8 rendered screens');
    assert.equal(estimateScreens(questions, { for_whom: 'self', gender: 'm', birth_year: 1960, birth_month: 4 }, TODAY, rules).length, 2, 'pre-retirement → 2');
    assert.equal(estimateScreens(questions, { for_whom: 'parent', gender: 'f', birth_year: 1946, birth_month: 1, benefits: ['old_age', 'income_supplement'] }, TODAY, rules).includes('S4'), false, 'S4 auto-filled → not counted');
  });
});

describe('evaluate', () => {
  test('always rights are info; partial → status_if_partial; hidden omitted', () => {
    const res = evaluate(rules, { for_whom: 'self', gender: 'm', birth_year: 1960, birth_month: 4 }, TODAY, questions);
    const ids = res.map((r) => r.right).sort();
    assert.deepEqual(ids, ['har_hakesef', 'health_65', 'hotlines']);
    assert.ok(res.every((r) => r.status === 'info'));
  });
  test('variants: first matching variant overrides status', () => {
    const a = { for_whom: 'parent', gender: 'm', birth_year: 1958, birth_month: 2, benefits: ['old_age'], adl_help: 'no', seniors_in_home: '2', income_band: 'b4', pension_status: 'pension_161d_unknown', housing: 'owner', arnona_in_name: 'yes', arnona_discount: '25', disability: ['none'], ravkav_gold: 'yes' };
    const tax = evaluate(rules, a, TODAY, questions).find((r) => r.right === 'tax_161d');
    assert.deepEqual(tax, { right: 'tax_161d', status: 'check', variant: 'unknown_161d' });
    const notFiled = evaluate(rules, { ...a, pension_status: 'pension_161d_not_filed' }, TODAY, questions).find((r) => r.right === 'tax_161d');
    assert.deepEqual(notFiled, { right: 'tax_161d', status: 'likely', variant: null });
  });
  test('dontknow on a condition → partial (check), never likely', () => {
    const a = { for_whom: 'parent', gender: 'f', birth_year: 1952, birth_month: 3, benefits: ['old_age'], adl_help: 'no', seniors_in_home: '1', income_band: 'dontknow', pension_status: 'no_pension', housing: 'owner', arnona_in_name: 'yes', arnona_discount: '25', disability: ['none'], ravkav_gold: 'no' };
    const res = Object.fromEntries(evaluate(rules, a, TODAY, questions).map((r) => [r.right, r.status]));
    assert.equal(res.arnona_30, 'check');
    assert.equal(res.income_supplement, 'check');
    assert.equal(res.arnona_low_income, 'check');
  });
  test('siud recipient level 4 aged 90+ gets electricity; level 4 aged 88 does not', () => {
    const base = { for_whom: 'parent', gender: 'f', birth_year: 1938, birth_month: 6, benefits: ['old_age', 'siud'], siud_level: '4', seniors_in_home: '1', income_band: 'b2', pension_status: 'no_pension', housing: 'with_family', ravkav_gold: 'yes' };
    assert.ok(!evaluate(rules, base, TODAY, questions).some((r) => r.right === 'electricity'));
    const old = { ...base, birth_year: 1935, electricity_contract: 'self' };
    const el = evaluate(rules, old, TODAY, questions).find((r) => r.right === 'electricity');
    assert.equal(el?.status, 'likely');
  });
  test('createEngine binds rules and questions', () => {
    const r = engine.evaluate({ for_whom: 'self', gender: 'm', birth_year: 1960, birth_month: 4 }, TODAY);
    assert.equal(r.length, 3);
    assert.equal(engine.resolveFlow({}, TODAY).nextScreen, 'S1');
  });
});

describe('data sanity (rules.json / questions.json)', () => {
  test('every field referenced by a predicate is a question, a month_year field, or a derived field', () => {
    const fields = new Set();
    for (const q of questions.questions) {
      fields.add(q.id);
      if (q.type === 'month_year') q.fields.forEach((f) => fields.add(f.id));
    }
    const derived = new Set(Object.keys(questions.derived_fields).map((k) => `derived.${k}`));
    const seen = [];
    const walk = (p) => {
      if (!p || typeof p !== 'object') return;
      if ('all' in p) return p.all.forEach(walk);
      if ('any' in p) return p.any.forEach(walk);
      if ('not' in p) return walk(p.not);
      if ('unknown' in p) return seen.push(p.unknown);
      const [op] = Object.keys(p);
      seen.push(p[op][0]);
    };
    rules.rights.forEach((r) => { walk(r.conditions); Object.values(r.variants || {}).forEach((v) => walk(v.when)); });
    questions.questions.forEach((q) => { walk(q.show_if); walk(q.skip_if); });
    for (const f of seen) assert.ok(fields.has(f) || derived.has(f), `unknown field ${f}`);
  });
  test('every option value used in eq/in/includes exists on that question', () => {
    const opts = Object.fromEntries(questions.questions.filter((q) => q.options).map((q) => [q.id, new Set(q.options.map((o) => o.value))]));
    const check = (p) => {
      if (!p || typeof p !== 'object') return;
      if ('all' in p) return p.all.forEach(check);
      if ('any' in p) return p.any.forEach(check);
      if ('not' in p) return check(p.not);
      if ('unknown' in p) return;
      const [op] = Object.keys(p);
      const [field, arg] = p[op];
      if (!opts[field]) return;
      const vals = op === 'in' ? arg : [arg];
      for (const v of vals) assert.ok(opts[field].has(v), `${field} has no option ${v}`);
    };
    rules.rights.forEach((r) => { check(r.conditions); Object.values(r.variants || {}).forEach((v) => check(v.when)); });
    questions.questions.forEach((q) => { check(q.show_if); check(q.skip_if); });
  });
  test('statuses and letters referenced by rights exist', () => {
    const statuses = new Set(Object.keys(rules._meta.statuses));
    for (const r of rules.rights) {
      assert.ok(statuses.has(r.status_if_met), `${r.id}: status_if_met`);
      assert.ok(statuses.has(r.status_if_partial), `${r.id}: status_if_partial`);
      for (const v of Object.values(r.variants || {})) if (v.status) assert.ok(statuses.has(v.status));
      if (r.letter) assert.ok(['L1', 'L2', 'L3'].includes(r.letter), `${r.id}: letter ${r.letter}`);
      assert.ok(r.sources && r.sources.length > 0 && r.sources[0].name && r.sources[0].verified, `${r.id}: needs sources[0].name + verified`);
    }
  });
  test('every question has a screen and every screen lists its questions', () => {
    const screenQs = Object.fromEntries(questions.screens.map((s) => [s.id, new Set(s.questions)]));
    for (const q of questions.questions) {
      assert.ok(screenQs[q.screen], `${q.id}: screen ${q.screen}`);
      assert.ok(screenQs[q.screen].has(q.id), `${q.id} missing from screen ${q.screen}`);
    }
  });
});
