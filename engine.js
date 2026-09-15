/**
 * engine.js — the rules engine and adaptive-flow resolver.
 *
 * Pure functions, no DOM. This is a 1:1 port of tests/reference_engine.py,
 * which is the executable definition of the semantics (see SPEC.md §5 and
 * questions.json → _meta). Keep the two in lock-step; tests/reference_parity.test.js
 * fuzz-compares them when python3 is available.
 *
 * Three-valued logic: every predicate returns true / false / UNKNOWN.
 *  - A field is UNKNOWN only when the user answered "dontknow".
 *  - A field whose question was never shown (show_if false), or that was left
 *    empty, is NOT APPLICABLE (NA) and evaluates as a definite false in
 *    eq/in/includes/gte/lte; the `unknown` predicate returns false for it.
 *  - all: any false → false; else any UNKNOWN → UNKNOWN; else true.
 *  - any: any true → true; else any UNKNOWN → UNKNOWN; else false.
 *  - not: flips true/false, keeps UNKNOWN.
 *
 * "dontknow" is always stored as the string "dontknow" (also for multi-select
 * questions) — the UI guarantees this; the engine also tolerates ["dontknow"]
 * for the comparison operators, exactly like the Python reference.
 */

export const UNKNOWN = Symbol('unknown');
export const NA = Symbol('not-applicable');

const AGE_FLAGS = [
  ['is_65plus', 65],
  ['is_67plus', 67],
  ['is_70plus', 70],
  ['is_72plus', 72],
  ['is_90plus', 90],
];

const PENSION_YES = ['pension_161d_filed', 'pension_161d_not_filed', 'pension_161d_unknown'];

/** Accepts a Date or {year, month} (month 1–12). */
export function normalizeToday(today) {
  if (today instanceof Date) return { year: today.getFullYear(), month: today.getMonth() + 1 };
  if (today && typeof today.year === 'number' && typeof today.month === 'number') return today;
  throw new TypeError('today must be a Date or {year, month}');
}

/** "62y4m" → [62, 4] */
export function parseAgeStr(s) {
  const [y, rest] = String(s).split('y');
  return [parseInt(y, 10), parseInt(String(rest).replace(/m$/, ''), 10)];
}

/** Women's retirement age from the BTL table in rules.derived.retirement_age_women. */
export function womenRetirementAge(rules, birthYear, birthMonth) {
  const key = `${String(birthYear).padStart(4, '0')}-${String(birthMonth).padStart(2, '0')}`;
  for (const row of rules.derived.retirement_age_women) {
    if (key <= row.born_until) return parseAgeStr(row.age);
  }
  return [65, 0];
}

/** Derived fields (prefixed "derived.") computed from the answers. */
export function derive(answers, today, rules) {
  const t = normalizeToday(today);
  const d = {};
  const by = toNumber(answers.birth_year);
  const bm = toNumber(answers.birth_month);
  const g = answers.gender;
  if (by && bm) {
    const months = (t.year - by) * 12 + (t.month - bm);
    d['derived.age'] = Math.floor(months / 12);
    const [ry, rm] = g === 'm' ? [rules.derived.retirement_age_men_years, 0] : womenRetirementAge(rules, by, bm);
    d['derived.retirement_age_reached'] = months >= ry * 12 + rm;
    for (const [k, a] of AGE_FLAGS) d[`derived.${k}`] = d['derived.age'] >= a;
  }
  const ps = answers.pension_status;
  if (PENSION_YES.includes(ps)) d['derived.pension_income'] = 'yes';
  else if (ps === 'no_pension') d['derived.pension_income'] = 'no';
  else if (ps === 'dontknow') d['derived.pension_income'] = 'dontknow';
  return d;
}

function toNumber(v) {
  if (v === undefined || v === null || v === '' || v === 'dontknow') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Python-style equality: primitives by ===, arrays element-wise. */
export function equals(a, b) {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => equals(x, b[i]));
  }
  if (Array.isArray(a) || Array.isArray(b)) return false;
  return a === b;
}

/** Read a field from env, honouring the shown-set (NA when never shown / empty). */
export function get(env, field, shown) {
  if (field.startsWith('derived.')) return field in env ? env[field] : NA;
  if (shown !== null && shown !== undefined && !shown.has(field)) return NA;
  const v = env[field];
  if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) return NA;
  return v;
}

function isDontknow(v) {
  return v === 'dontknow' || (Array.isArray(v) && v.length === 1 && v[0] === 'dontknow');
}

/** Evaluate a predicate → true | false | UNKNOWN. */
export function ev(p, env, shown) {
  if (p === null || typeof p !== 'object') throw new TypeError(`bad predicate: ${JSON.stringify(p)}`);
  if ('all' in p) {
    const vals = p.all.map((x) => ev(x, env, shown));
    return vals.includes(false) ? false : vals.includes(UNKNOWN) ? UNKNOWN : true;
  }
  if ('any' in p) {
    const vals = p.any.map((x) => ev(x, env, shown));
    return vals.includes(true) ? true : vals.includes(UNKNOWN) ? UNKNOWN : false;
  }
  if ('not' in p) {
    const v = ev(p.not, env, shown);
    return v === UNKNOWN ? UNKNOWN : !v;
  }
  if ('unknown' in p) return get(env, p.unknown, shown) === 'dontknow';

  const keys = Object.keys(p);
  if (keys.length !== 1) throw new Error(`predicate must have exactly one operator: ${JSON.stringify(p)}`);
  const op = keys[0];
  const [field, arg] = p[op];
  const v = get(env, field, shown);
  if (v === NA) return false;
  if (isDontknow(v)) return UNKNOWN;
  switch (op) {
    case 'eq':
      return equals(v, arg);
    case 'in':
      return Array.isArray(arg) ? arg.some((a) => equals(a, v)) : false;
    case 'includes':
      return Array.isArray(v) && v.some((x) => equals(x, arg));
    case 'gte':
      return Number(v) >= arg;
    case 'lte':
      return Number(v) <= arg;
    default:
      throw new Error(`unknown operator: ${op}`);
  }
}

function isAnswered(q, env) {
  if (q.type === 'month_year') return q.fields.every((f) => env[f.id] !== undefined && env[f.id] !== null && env[f.id] !== '');
  const v = env[q.id];
  return !(v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0));
}

/** Ordered screen ids that have at least one question in `set`. */
export function screensOf(questions, set) {
  const byId = Object.fromEntries(questions.questions.map((q) => [q.id, q]));
  const hit = new Set([...set].filter((id) => byId[id]).map((id) => byId[id].screen));
  return questions.screens.map((s) => s.id).filter((id) => hit.has(id));
}

/**
 * Walk the flow in order (mirrors what the UI does).
 * Returns { env, shown, rendered, renderedScreens, nextScreen, preRetirement }.
 *  - env: answers + skip-defaults + derived fields
 *  - shown: Set of question/field ids whose question was shown (show_if true)
 *  - rendered: Set of question ids actually put on a screen (shown and not skipped)
 *  - renderedScreens: ordered screen ids with ≥1 rendered question
 *  - nextScreen: first rendered screen with an unanswered non-optional question, or null (→ results)
 *  - preRetirement: true when the pre-retirement shortcut stopped the flow after S2
 */
export function resolveFlow(questions, answers, today, rules) {
  const env = { ...answers };
  const shown = new Set();
  const rendered = new Set();
  let preRetirement = false;
  for (const q of questions.questions) {
    Object.assign(env, derive(env, today, rules));
    const cond = q.show_if;
    if (cond !== undefined && cond !== null && ev(cond, env, shown) !== true) continue; // not applicable
    const ids = [q.id, ...(q.type === 'month_year' ? q.fields.map((f) => f.id) : [])];
    ids.forEach((id) => shown.add(id));
    if (q.skip_if && ev(q.skip_if, env, shown) === true) {
      env[q.id] = q.default_when_skipped; // silent default — counts as a real answer
    } else {
      rendered.add(q.id);
    }
    if (q.id === 'birth') {
      Object.assign(env, derive(env, today, rules));
      if (env['derived.retirement_age_reached'] === false) {
        preRetirement = true;
        break;
      }
    }
  }
  Object.assign(env, derive(env, today, rules));

  const renderedScreens = screensOf(questions, rendered);
  const byId = Object.fromEntries(questions.questions.map((q) => [q.id, q]));
  let nextScreen = null;
  for (const sid of renderedScreens) {
    const qs = [...rendered].map((id) => byId[id]).filter((q) => q.screen === sid && !q.optional);
    if (qs.some((q) => !isAnswered(q, env))) {
      nextScreen = sid;
      break;
    }
  }
  return { env, shown, rendered, renderedScreens, nextScreen, preRetirement };
}

/**
 * Estimate which screens may still be rendered given the answers so far.
 * Like resolveFlow, but a question whose show_if is undecided only because a
 * *shown but not yet answered* question is referenced still counts as
 * "possible". Used for the progress label "שלב N מתוך ~M"; the estimate only
 * shrinks as branches close.
 */
export function estimateScreens(questions, answers, today, rules) {
  const env = { ...answers };
  const shown = new Set();
  const counted = new Set();
  for (const q of questions.questions) {
    Object.assign(env, derive(env, today, rules));
    const probe = { ...env };
    for (const id of shown) if (get(probe, id, shown) === NA) probe[id] = 'dontknow';
    // derived fields that cannot be computed yet (birth not answered) are undecided too
    for (const k of Object.keys(questions.derived_fields || {})) if (!(`derived.${k}` in probe)) probe[`derived.${k}`] = 'dontknow';
    const cond = q.show_if;
    let visible = true;
    if (cond !== undefined && cond !== null) {
      const real = ev(cond, env, shown);
      if (real === true) visible = true;
      else if (real === UNKNOWN) visible = false; // user said dontknow → really hidden
      else visible = ev(cond, probe, shown) !== false; // hidden only because something is unanswered → possible
    }
    if (!visible) continue;
    const ids = [q.id, ...(q.type === 'month_year' ? q.fields.map((f) => f.id) : [])];
    ids.forEach((id) => shown.add(id));
    if (q.skip_if && ev(q.skip_if, env, shown) === true) env[q.id] = q.default_when_skipped;
    else counted.add(q.id);
    if (q.id === 'birth') {
      Object.assign(env, derive(env, today, rules));
      if (env['derived.retirement_age_reached'] === false) break;
    }
  }
  return screensOf(questions, counted);
}

/** Number of screens actually rendered (a screen whose questions were all skipped is not rendered). */
export function countScreens(questions, rendered) {
  return screensOf(questions, rendered).length;
}

/**
 * Early exit: record every reached-or-unreached choice question that has no
 * answer as "dontknow" (NOT as not-applicable). Questions hidden by show_if
 * stay not-applicable because resolveFlow never adds them to `shown`.
 * Text and month/year questions are left untouched.
 */
export function withEarlyExit(questions, answers) {
  const out = { ...answers };
  for (const q of questions.questions) {
    if (q.type !== 'single' && q.type !== 'multi') continue;
    const v = out[q.id];
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) out[q.id] = 'dontknow';
  }
  return out;
}

/**
 * Evaluate every right → [{ right, status, variant }].
 * Hidden rights (conditions false) are omitted. `always` rights are "info".
 * The first variant whose `when` is true overrides status (title_suffix / note are applied by the UI).
 */
export function evaluate(rules, answers, today, questions) {
  const { env, shown } = resolveFlow(questions, answers, today, rules);
  const out = [];
  for (const r of rules.rights) {
    if (r.always) {
      out.push({ right: r.id, status: 'info', variant: null });
      continue;
    }
    const v = ev(r.conditions, env, shown);
    if (v === false) continue;
    let status = v === true ? r.status_if_met : (r.status_if_partial ?? 'check');
    let variant = null;
    for (const [name, def] of Object.entries(r.variants || {})) {
      if (ev(def.when, env, shown) === true) {
        variant = name;
        if (def.status !== undefined) status = def.status;
        break;
      }
    }
    out.push({ right: r.id, status, variant });
  }
  return out;
}

/** Bind rules + questions once and get the KICKOFF-shaped API. */
export function createEngine(rules, questions) {
  return {
    derive: (answers, today) => derive(answers, today, rules),
    resolveFlow: (answers, today) => resolveFlow(questions, answers, today, rules),
    estimateScreens: (answers, today) => estimateScreens(questions, answers, today, rules),
    evaluate: (answers, today) => evaluate(rules, answers, today, questions),
    countScreens: (rendered) => countScreens(questions, rendered),
    withEarlyExit: (answers) => withEarlyExit(questions, answers),
  };
}
