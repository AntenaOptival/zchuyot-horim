/**
 * app.js — בודקים זכויות להורים. Vanilla ES module, no build step.
 * Data: rules.json (rights), questions.json (flow), strings.<lang>.json (UI copy), letters/*.md.
 * Engine: engine.js (pure). Privacy: answers live in memory + sessionStorage only.
 */
import { createEngine } from './engine.js';
import {
  loadLetter, placeholdersIn, letterDefaults, resolveValues, renderLetterHtml, letterPlainText,
  AUTO_FIELDS, FIELD_ORDER, FIELD_TYPES,
} from './letters.js';

// ---------------------------------------------------------------------------
// Analytics — GoatCounter site code. Empty string disables everything.
// Example: const GOATCOUNTER = 'zchuyot-horim'  →  https://zchuyot-horim.goatcounter.com
// ---------------------------------------------------------------------------
const GOATCOUNTER = '';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const SS_KEY = 'zchuyot.state.v1';
const LS_SIZE = 'zchuyot.textsize';
const LS_AUTOREAD = 'zchuyot.autoread';
const SIZES = ['a', 'a1', 'a2'];
const STATUS_ORDER = ['likely', 'check', 'info'];

let rules, questions, strings, engine, qById, rightById;
const main = $('#main');
const live = $('#live');
const footer = $('#footer');
const controls = $('#controls');

// ---------------------------------------------------------------------------
// State (sessionStorage only — cleared when the tab closes)
// ---------------------------------------------------------------------------
const defaultState = () => ({
  view: 'landing', entry: 'parent', answers: {}, screen: null, earlyExit: false,
  letter: null, letterValues: {}, tracked: { q: [], cards: false, results: false, letters: [] }, suggestTts: false,
});
let state = defaultState();

function saveState() {
  try { sessionStorage.setItem(SS_KEY, JSON.stringify(state)); } catch { /* private mode etc. */ }
}
function loadState() {
  try {
    const s = JSON.parse(sessionStorage.getItem(SS_KEY));
    if (s && s.view) return { ...defaultState(), ...s, tracked: { ...defaultState().tracked, ...(s.tracked || {}) } };
  } catch { /* ignore */ }
  return null;
}
function resetState() {
  state = defaultState();
  try { sessionStorage.removeItem(SS_KEY); } catch { /* ignore */ }
}

/** Today — overridable with ?today=YYYY-MM-DD for reproducible testing. */
function today() {
  const p = new URLSearchParams(location.search).get('today');
  if (p && /^\d{4}-\d{2}-\d{2}$/.test(p)) return { year: +p.slice(0, 4), month: +p.slice(5, 7), day: +p.slice(8, 10) };
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}
function fmtToday() { const t = today(); return `${t.day}.${t.month}.${t.year}`; }
/** "2026-09-14" → "14.9.2026" (any trailing text is kept). */
function fmtDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(.*)$/.exec(String(iso || '').trim());
  if (!m) return esc(iso);
  return esc(`${+m[3]}.${+m[2]}.${m[1]}${m[4] || ''}`);
}

// ---------------------------------------------------------------------------
// Analytics (guarded; never sends answers)
// ---------------------------------------------------------------------------
function initAnalytics() {
  if (!GOATCOUNTER) return;
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://gc.zgo.at/count.js';
  s.dataset.goatcounter = `https://${GOATCOUNTER}.goatcounter.com/count`;
  document.head.appendChild(s);
}
function track(name) {
  try { window.goatcounter?.count?.({ path: name, title: name, event: true }); } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Text size (localStorage) — A / A+ / A++ → 20 / 24 / 28 px root
// ---------------------------------------------------------------------------
function storedSize() { try { return localStorage.getItem(LS_SIZE); } catch { return null; } }
function applySize(size, persist = true) {
  if (!SIZES.includes(size)) size = 'a';
  document.documentElement.classList.remove(...SIZES.map((s) => `size-${s}`));
  document.documentElement.classList.add(`size-${size}`);
  if (persist) { try { localStorage.setItem(LS_SIZE, size); } catch { /* ignore */ } }
  $$('[data-action="size"]', controls).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.size === size)));
}
function currentSize() { return SIZES.find((s) => document.documentElement.classList.contains(`size-${s}`)) || 'a'; }

// ---------------------------------------------------------------------------
// Read-aloud (speechSynthesis, he-IL). Controls are hidden until a Hebrew voice is confirmed.
// ---------------------------------------------------------------------------
const tts = {
  available: false, decided: false, auto: false,
  init() {
    try { this.auto = localStorage.getItem(LS_AUTOREAD) === '1'; } catch { this.auto = false; }
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') { this.setAvailable(false); return; }
    const check = () => {
      const voices = speechSynthesis.getVoices();
      if (!voices.length) return false;
      this.setAvailable(voices.some((v) => this.isHebrew(v)));
      return true;
    };
    if (!check()) {
      speechSynthesis.addEventListener('voiceschanged', () => { check(); });
      // Some browsers never fire voiceschanged when there are no voices at all.
      setTimeout(() => { if (!this.decided) { if (!check()) this.setAvailable(false); } }, 3000);
    }
  },
  isHebrew(v) { return /^(he|iw)([-_]|$)/i.test(v.lang || ''); },
  setAvailable(v) {
    this.decided = true;
    this.available = v;
    document.documentElement.classList.toggle('no-tts', !v);
    renderControls();
  },
  setAuto(on) {
    this.auto = !!on;
    try { localStorage.setItem(LS_AUTOREAD, on ? '1' : '0'); } catch { /* ignore */ }
    renderControls();
    if (!on) this.cancel();
  },
  speak(text) {
    if (!this.available || !text) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'he-IL';
      const voice = speechSynthesis.getVoices().find((v) => this.isHebrew(v));
      if (voice) u.voice = voice;
      u.rate = 0.95;
      speechSynthesis.speak(u);
    } catch { /* ignore */ }
  },
  cancel() { try { if ('speechSynthesis' in window) speechSynthesis.cancel(); } catch { /* ignore */ } },
};

// ---------------------------------------------------------------------------
// Templating: {{name}} → the senior's first name / "ההורה" / second person for self
// ---------------------------------------------------------------------------
function tpl(str, extra = {}) {
  const self = state.answers.for_whom === 'self';
  const name = String(state.answers.name || '').trim();
  let out = String(str ?? '');
  if (self) {
    out = out.replace(/של \{\{name\}\}/g, strings.name_self_of).replace(/ל\{\{name\}\}/g, strings.name_self_to).replace(/\{\{name\}\}/g, strings.name_self);
  } else if (name) {
    out = out.replace(/\{\{name\}\}/g, name);
  } else {
    out = out.replace(/ל\{\{name\}\}/g, strings.name_default_to).replace(/\{\{name\}\}/g, strings.name_default);
  }
  for (const [k, v] of Object.entries(extra)) out = out.split(`{{${k}}}`).join(String(v));
  return out;
}

// ---------------------------------------------------------------------------
// Header controls (text size + read-aloud toggle)
// ---------------------------------------------------------------------------
function renderControls() {
  if (!strings) return;
  const T = strings.textsize;
  const size = currentSize();
  controls.innerHTML = `
    <div class="textsize" role="group" aria-label="${esc(T.label)}">
      ${SIZES.map((s) => `<button type="button" class="ctl ctl--size ctl--${s}" data-action="size" data-size="${s}" aria-pressed="${String(s === size)}" aria-label="${esc(T[s])} – ${esc(T[`${s}_full`])}">${esc(T[s])}</button>`).join('')}
    </div>
    <button type="button" class="ctl ctl--tts tts-only" data-action="tts-toggle" aria-pressed="${String(tts.auto)}">🔊 ${esc(tts.auto ? strings.tts.auto_on : strings.tts.auto_off)}</button>`;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function render(opts = {}) {
  tts.cancel();
  saveState();
  document.body.dataset.view = state.view;
  footer.hidden = true;
  footer.innerHTML = '';
  const views = { landing: renderLanding, question: renderQuestionScreen, results: renderResults, letter: renderLetter, about: renderAbout };
  const p = (views[state.view] || renderLanding)(opts);
  const after = () => {
    if (!opts.preserveFocus) {
      const h1 = main.querySelector('h1');
      if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
      window.scrollTo(0, 0);
      live.textContent = h1 ? h1.textContent : '';
      if (tts.auto) tts.speak(screenSpeech());
    }
  };
  if (p && typeof p.then === 'function') p.then(after); else after();
}

function navigate(mutate) {
  mutate();
  render();
  try { history.pushState({ view: state.view, screen: state.screen, earlyExit: state.earlyExit, letter: state.letter }, ''); } catch { /* ignore */ }
}

// ---- Landing ---------------------------------------------------------------
function renderLanding() {
  const L = strings.landing;
  main.innerHTML = `
    <section class="landing">
      <h1>${esc(L.h1)}</h1>
      <p class="lede">${esc(L.sub)}</p>
      <div class="choices" role="radiogroup" aria-label="${esc(L.entry_label)}">
        <label class="choice"><input type="radio" name="entry" value="parent" ${state.entry !== 'self' ? 'checked' : ''}><span class="choice__label">${esc(L.entry_parent)}</span></label>
        <label class="choice"><input type="radio" name="entry" value="self" ${state.entry === 'self' ? 'checked' : ''}><span class="choice__label">${esc(L.entry_self)}</span></label>
      </div>
      <p class="privacy">🔒 ${esc(L.privacy)}</p>
      <p><a href="#about" data-action="about">${esc(L.how_it_works)}</a></p>
      <p class="footnote">${esc(L.footer)}</p>
    </section>
    <div class="primary-bar"><button type="button" class="btn btn--primary" data-action="start">${esc(L.cta)}</button></div>`;
}

function start() {
  const self = state.entry === 'self';
  resetState();
  state.entry = self ? 'self' : 'parent';
  state.answers.for_whom = self ? 'self' : 'parent';
  if (self) {
    if (!storedSize()) applySize('a1', false); // "self" starts at A+ (without overriding an explicit choice)
    state.suggestTts = true;
  }
  track('start');
  navigate(() => { state.view = 'question'; state.screen = self ? nextScreenAfter(null) : 'S1'; });
}

// ---- Question screens --------------------------------------------------------
function screenOrderIndex(sid) { return questions.screens.findIndex((s) => s.id === sid); }

function isAnswered(q) {
  const a = state.answers;
  if (q.type === 'month_year') return q.fields.every((f) => a[f.id] !== undefined && a[f.id] !== null && a[f.id] !== '');
  const v = a[q.id];
  return !(v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0));
}

function nextScreenAfter(sid) {
  const flow = engine.resolveFlow(state.answers, today());
  const list = flow.renderedScreens;
  if (sid === null) return list.find((s) => s !== 'S1') || list[0] || null;
  const i = list.indexOf(sid);
  return i >= 0 ? list[i + 1] || null : flow.nextScreen;
}

function renderQuestionScreen({ preserveFocus = false, errorFor = null } = {}) {
  const flow = engine.resolveFlow(state.answers, today());
  const est = engine.estimateScreens(state.answers, today());
  const sid = state.screen;
  const screen = questions.screens.find((s) => s.id === sid);
  if (!screen) { state.view = 'landing'; return renderLanding(); }
  const qs = questions.questions.filter((q) => q.screen === sid && flow.rendered.has(q.id));
  const n = Math.max(1, (est.includes(sid) ? est : flow.renderedScreens).indexOf(sid) + 1);
  const m = Math.max(n, est.length);
  const canEarlyExit = screenOrderIndex(sid) >= screenOrderIndex('S4');
  const title = tpl(screen.title);
  const N = strings.nav;

  // analytics: q_<id> once per question per check
  for (const q of qs) if (!state.tracked.q.includes(q.id)) { state.tracked.q.push(q.id); track(`q_${q.id}`); }

  const focusInfo = preserveFocus && document.activeElement && main.contains(document.activeElement)
    ? { name: document.activeElement.name, value: document.activeElement.value, id: document.activeElement.id } : null;

  main.innerHTML = `
    <div class="screen-head">
      <button type="button" class="btn btn--link" data-action="back">‹ ${esc(N.back)}</button>
      <span class="progress" aria-label="${esc(tpl(N.progress, { n, m }))}">${esc(tpl(N.progress, { n, m }))}</span>
    </div>
    <h1 id="screen-title">${esc(title)}</h1>
    ${state.suggestTts && sid === 'S2' ? `<p class="hint tts-only">🔊 ${esc(strings.tts.suggest)}</p>` : ''}
    <button type="button" class="btn btn--tts tts-only" data-action="speak" data-speech="screen">🔊 ${esc(strings.tts.read)}</button>
    <form class="questions" novalidate autocomplete="off">
      ${qs.map((q) => renderQuestion(q, title, errorFor === q.id)).join('')}
    </form>
    ${canEarlyExit ? `<div class="early-exit"><button type="button" class="btn btn--secondary" data-action="early-exit">${esc(N.early_exit)}</button><p class="help">${esc(N.early_exit_help)}</p></div>` : ''}
    <div class="primary-bar"><button type="button" class="btn btn--primary" data-action="next">${esc(N.next)}</button></div>`;

  if (focusInfo) {
    const target = (focusInfo.id && document.getElementById(focusInfo.id))
      || $$(`[name="${focusInfo.name}"]`, main).find((el) => el.value === focusInfo.value)
      || $(`[name="${focusInfo.name}"]`, main);
    if (target) target.focus({ preventScroll: true });
  }
}

function renderQuestion(q, screenTitle, showError) {
  const title = tpl(q.title);
  const help = q.help ? tpl(q.help) : '';
  const dup = title === screenTitle;
  const a = state.answers;
  const N = strings.nav;
  const err = showError ? `<p class="field-error" role="alert" id="err-${q.id}">${esc(q.type === 'month_year' ? N.answer_required_birth : q.no_dontknow ? N.answer_required_choice : N.answer_required)}</p>` : '';
  const describedBy = [help ? `help-${q.id}` : '', showError ? `err-${q.id}` : ''].filter(Boolean).join(' ');

  if (q.type === 'text') {
    return `<div class="q q--text" data-qid="${q.id}" data-type="text">
      <label class="q__title" for="in-${q.id}">${esc(title)}</label>
      ${help ? `<p class="help" id="help-${q.id}">${esc(help)}</p>` : ''}
      <input id="in-${q.id}" class="input" type="text" name="${q.id}" value="${esc(a[q.id] || '')}" placeholder="${esc(q.placeholder || '')}" maxlength="40" autocomplete="off" ${describedBy ? `aria-describedby="${describedBy}"` : ''}>
    </div>`;
  }

  if (q.type === 'month_year') {
    const [mf, yf] = q.fields;
    const months = strings.months.map((name, i) => `<option value="${i + 1}" ${Number(a[mf.id]) === i + 1 ? 'selected' : ''}>${esc(name)}</option>`).join('');
    const years = [];
    for (let y = yf.max; y >= yf.min; y--) years.push(`<option value="${y}" ${Number(a[yf.id]) === y ? 'selected' : ''}>${y}</option>`);
    return `<fieldset class="q" data-qid="${q.id}" data-type="month_year" ${describedBy ? `aria-describedby="${describedBy}"` : ''}>
      <legend class="q__title">${esc(title)}</legend>
      ${help ? `<p class="help" id="help-${q.id}">${esc(help)}</p>` : ''}
      <div class="month-year">
        <label class="field"><span class="field__label">${esc(strings.month_label)}</span>
          <select class="input" name="${mf.id}"><option value="">${esc(strings.select_placeholder)}</option>${months}</select></label>
        <label class="field"><span class="field__label">${esc(strings.year_label)}</span>
          <select class="input" name="${yf.id}"><option value="">${esc(strings.select_placeholder)}</option>${years.join('')}</select></label>
      </div>
      ${err}
    </fieldset>`;
  }

  const multi = q.type === 'multi';
  const cur = a[q.id];
  const isChecked = (v) => (multi ? (Array.isArray(cur) ? cur.includes(v) : cur === v) : cur === v);
  const opts = q.options.map((o) => ({ value: o.value, label: tpl(o.label), exclusive: !!o.exclusive }));
  if (!q.no_dontknow) opts.push({ value: 'dontknow', label: N.dontknow, exclusive: true, dontknow: true });
  const type = multi ? 'checkbox' : 'radio';
  return `<fieldset class="q" data-qid="${q.id}" data-type="${q.type}" ${dup ? 'aria-labelledby="screen-title"' : ''} ${describedBy ? `aria-describedby="${describedBy}"` : ''}>
    <legend class="q__title ${dup ? 'visually-hidden' : ''}">${esc(title)}</legend>
    ${help ? `<p class="help" id="help-${q.id}">${esc(help)}</p>` : ''}
    <div class="choices">
      ${opts.map((o) => `<label class="choice ${o.dontknow ? 'choice--dontknow' : ''}">
        <input type="${type}" name="${q.id}" value="${esc(o.value)}" ${isChecked(o.value) ? 'checked' : ''} ${o.exclusive ? 'data-exclusive="1"' : ''}>
        <span class="choice__label">${esc(o.label)}</span></label>`).join('')}
    </div>
    ${err}
  </fieldset>`;
}

function screenSpeech() {
  const h1 = main.querySelector('h1')?.textContent || '';
  if (state.view === 'question') {
    const parts = [h1];
    for (const fs of $$('[data-qid]', main)) {
      const t = fs.querySelector('.q__title')?.textContent || '';
      if (t && t !== h1) parts.push(t);
      const help = fs.querySelector('.help')?.textContent; if (help) parts.push(help);
      const labels = $$('.choice__label', fs).map((l) => l.textContent);
      if (labels.length) parts.push(`${strings.tts.options_intro} ${labels.join('. ')}`);
    }
    return parts.join('. ');
  }
  if (state.view === 'results') {
    const parts = [h1, main.querySelector('.summary')?.textContent || ''];
    for (const sec of $$('section.group', main)) {
      parts.push(sec.querySelector('h2')?.textContent || '');
      parts.push(...$$('article h3', sec).map((h) => h.textContent));
    }
    return parts.filter(Boolean).join('. ');
  }
  return [h1, ...$$('main p', document).slice(0, 3).map((p) => p.textContent)].join('. ');
}

function cardSpeech(rightId) {
  const card = $(`#card-${rightId}`, main);
  if (!card) return '';
  const parts = [card.querySelector('.badge')?.textContent, card.querySelector('h3')?.textContent, card.querySelector('.card__value')?.textContent, card.querySelector('.card__note')?.textContent];
  const steps = $$('.card__steps ol li', card).map((li, i) => `${i + 1}. ${li.textContent}`);
  if (steps.length) parts.push(strings.tts.steps_intro, ...steps);
  return parts.filter(Boolean).join('. ');
}

function readAnswers() {
  // pull current values from the DOM of the visible screen (radios/checkboxes/selects/text)
  for (const fs of $$('[data-qid]', main)) {
    const qid = fs.dataset.qid; const q = qById[qid];
    if (q.type === 'single') {
      const c = fs.querySelector('input:checked');
      if (c) state.answers[qid] = c.value; else delete state.answers[qid];
    } else if (q.type === 'multi') {
      const vals = $$('input:checked', fs).map((i) => i.value);
      if (vals.includes('dontknow')) state.answers[qid] = 'dontknow';
      else if (vals.length) state.answers[qid] = vals;
      else delete state.answers[qid];
    } else if (q.type === 'month_year') {
      for (const f of q.fields) {
        const v = fs.querySelector(`[name="${f.id}"]`)?.value;
        if (v) state.answers[f.id] = Number(v); else delete state.answers[f.id];
      }
    } else if (q.type === 'text') {
      const v = fs.querySelector('input')?.value.trim();
      if (v) state.answers[qid] = v; else delete state.answers[qid];
    }
  }
  saveState();
}

function goNext() {
  readAnswers();
  const flow = engine.resolveFlow(state.answers, today());
  const sid = state.screen;
  const missing = questions.questions.find((q) => q.screen === sid && flow.rendered.has(q.id) && !q.optional && !isAnswered(q));
  if (missing) {
    renderQuestionScreen({ preserveFocus: true, errorFor: missing.id });
    const fs = $(`[data-qid="${missing.id}"]`, main);
    fs?.scrollIntoView({ block: 'center' });
    fs?.querySelector('input, select')?.focus({ preventScroll: true });
    live.textContent = fs?.querySelector('.field-error')?.textContent || '';
    return;
  }
  const next = nextScreenAfter(sid);
  if (!next) { showResults(); return; }
  navigate(() => { state.screen = next; });
}

function goBack() {
  readAnswers();
  const list = engine.resolveFlow(state.answers, today()).renderedScreens;
  const i = list.indexOf(state.screen);
  if (i <= 0) navigate(() => { state.view = 'landing'; state.screen = null; });
  else navigate(() => { state.screen = list[i - 1]; });
}

function earlyExit() {
  readAnswers();
  state.earlyExit = true;
  showResults();
}

function showResults() {
  navigate(() => { state.view = 'results'; });
}

// ---- Results -------------------------------------------------------------------
function effectiveAnswers() { return state.earlyExit ? engine.withEarlyExit(state.answers) : state.answers; }

function computeResults() {
  const answers = effectiveAnswers();
  const flow = engine.resolveFlow(answers, today());
  const results = engine.evaluate(answers, today());
  const groups = STATUS_ORDER.map((st) => ({ st, title: rules._meta.statuses[st], items: results.filter((r) => r.status === st) }));
  return { answers, flow, results, groups };
}

function cardTitle(r) {
  const right = rightById[r.right];
  const v = r.variant ? right.variants[r.variant] : null;
  return tpl(right.title) + (v?.title_suffix || '');
}

function phoneHref(p) { return `tel:${String(p).replace(/[^\d*#+]/g, '')}`; }

function renderResults() {
  const R = strings.results;
  const { flow, results, groups } = computeResults();
  if (!state.tracked.results) { state.tracked.results = true; track('results'); }
  if (!state.tracked.cards) { state.tracked.cards = true; results.forEach((r) => track(`card_${r.right}`)); }
  const counts = Object.fromEntries(groups.map((g) => [g.st, g.items.length]));
  const nothingActionable = counts.likely + counts.check === 0;

  main.innerHTML = `
    <div class="screen-head">
      <button type="button" class="btn btn--link" data-action="back-questions">‹ ${esc(R.back_to_questions)}</button>
    </div>
    <h1>${esc(tpl(R.h1))}</h1>
    <p class="summary">${esc(tpl(R.summary, counts))}</p>
    ${flow.preRetirement ? `<p class="note note--info">${esc(R.pre_retirement_note)}</p>` : ''}
    ${state.earlyExit && !flow.preRetirement ? `<p class="note">${esc(R.early_exit_note)}</p>` : ''}
    ${nothingActionable ? `<p class="note note--empty">${esc(R.empty)}</p>` : ''}
    <button type="button" class="btn btn--tts tts-only" data-action="speak" data-speech="screen">🔊 ${esc(strings.tts.read)}</button>
    ${groups.filter((g) => g.items.length).map((g) => `
      <section class="group group--${g.st}" aria-labelledby="g-${g.st}">
        <h2 id="g-${g.st}"><span aria-hidden="true">${R.status_icons[g.st]}</span> ${esc(g.title)} <span class="count">(${g.items.length})</span></h2>
        <p class="help">${esc(R.status_help[g.st])}</p>
        ${g.items.map((r) => renderCard(r)).join('')}
      </section>`).join('')}
    <p class="disclaimer">${esc(R.disclaimer)}</p>`;

  footer.innerHTML = `
    <a class="btn btn--secondary" data-action="share" href="${shareHref(groups)}" target="_blank" rel="noopener">${esc(R.share)}</a>
    <button type="button" class="btn btn--secondary" data-action="print">${esc(R.print)}</button>
    <button type="button" class="btn btn--secondary" data-action="restart">${esc(R.new_check)}</button>`;
  footer.hidden = false;
}

function renderCard(r) {
  const R = strings.results;
  const right = rightById[r.right];
  const v = r.variant ? right.variants[r.variant] : null;
  const title = cardTitle(r);
  const kz = (right.links || []).find((l) => /kolzchut\.org\.il/.test(l.url)) || (right.links || [])[0];
  const others = (right.links || []).filter((l) => l !== kz);
  const src = right.sources?.[0];
  return `
    <article class="card card--${r.status}" id="card-${right.id}" aria-labelledby="ct-${right.id}">
      <p class="card__status"><span class="badge badge--${r.status}"><span aria-hidden="true">${R.status_icons[r.status]}</span> ${esc(rules._meta.statuses[r.status])}</span></p>
      <h3 id="ct-${right.id}">${esc(title)}</h3>
      <p class="card__value">${esc(right.value)}</p>
      ${v?.note ? `<p class="card__note">${esc(v.note)}</p>` : ''}
      <details class="card__steps">
        <summary>${esc(R.what_to_do)}</summary>
        <ol>${(right.steps || []).map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
        ${right.why ? `<p class="card__why"><strong>${esc(R.why)}:</strong> ${esc(right.why)}</p>` : ''}
        ${others.length ? `<p class="card__links"><strong>${esc(R.more_links)}</strong> ${others.map((l) => `<a href="${esc(l.url)}">${esc(l.label)}</a>`).join(' · ')}</p>` : ''}
      </details>
      <div class="card__actions">
        ${kz ? `<a class="btn btn--secondary" href="${esc(kz.url)}">${esc(/kolzchut\.org\.il/.test(kz.url) ? R.kolzchut : kz.label)}</a>` : ''}
        ${right.letter ? `<button type="button" class="btn btn--secondary" data-action="letter" data-letter="${right.letter}" data-right="${right.id}">${esc(R.letter)}</button>` : ''}
        ${right.phone ? `<a class="btn btn--secondary" href="${phoneHref(right.phone)}">📞 ${esc(R.call)} <bdi dir="ltr">${esc(right.phone)}</bdi></a>` : ''}
        <button type="button" class="btn btn--tts tts-only" data-action="speak" data-card="${right.id}" aria-label="${esc(strings.tts.read_card)}: ${esc(title)}">🔊 ${esc(strings.tts.read)}</button>
      </div>
      ${src ? `<p class="card__source">${tpl(esc(R.source), { name: esc(src.name), date: fmtDate(src.verified) })}</p>` : ''}
      ${right.caveats ? `<p class="card__caveat"><strong>${esc(R.caveat_label)}</strong> ${esc(right.caveats)}</p>` : ''}
    </article>`;
}

function siteUrl() { return `${location.origin}${location.pathname}`.replace(/index\.html$/, ''); }

function shareText(groups) {
  const R = strings.results;
  const lines = [`${tpl(R.h1)} — ${strings.app_title}`, ''];
  for (const g of groups) {
    if (!g.items.length) continue;
    lines.push(`${R.status_icons[g.st]} ${g.title}:`);
    for (const r of g.items) lines.push(`• ${cardTitle(r)}`);
    lines.push('');
  }
  lines.push(siteUrl());
  lines.push(tpl(R.share_verified_line, { date: fmtDate(rules._meta.verified).replace(/&#39;/g, "'") }));
  return lines.join('\n');
}
function shareHref(groups) { return `https://wa.me/?text=${encodeURIComponent(shareText(groups))}`; }

// ---- Letter ------------------------------------------------------------------------
async function renderLetter() {
  const L = strings.letter;
  const { id, rightId } = state.letter || {};
  const right = rightById[rightId];
  if (!id || !right) { state.view = 'results'; renderResults(); return; }
  main.innerHTML = `<h1>${esc(L.h1_prefix)}…</h1>`;
  let letter;
  try { letter = await loadLetter(id); } catch {
    main.innerHTML = `<div class="screen-head"><button type="button" class="btn btn--link" data-action="back-results">‹ ${esc(L.back)}</button></div><h1>${esc(L.h1_prefix)}${esc(id)}</h1><p class="note note--error">${esc(strings.errors.letter_load)}</p>`;
    return;
  }
  if (state.view !== 'letter') return; // navigated away while loading
  if (!state.tracked.letters.includes(id)) { state.tracked.letters.push(id); track(`letter_${id}`); }

  const { flow } = computeResults();
  const keys = placeholdersIn(letter.body);
  const defaults = letterDefaults({ letterId: id, rightId, env: flow.env, strings, dateStr: fmtToday() });
  state.letterValues[id] ||= {};
  const typed = state.letterValues[id];
  const editable = FIELD_ORDER.filter((k) => keys.includes(k) && !AUTO_FIELDS.has(k));

  const fieldHtml = (k) => {
    const def = FIELD_TYPES[k] || { type: 'text' };
    const label = k === 'address' && id === 'L3' ? L.fields.address_iec : L.fields[k] || k;
    const val = typed[k] ?? defaults[k] ?? '';
    if (def.type === 'select') {
      const options = def.options === 'yes_no' ? [L.yes, L.no] : L[def.options];
      return `<label class="field"><span class="field__label">${esc(label)}</span>
        <select class="input" name="${k}" data-letter-field>${options.map((o) => `<option value="${esc(o)}" ${o === val ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
    }
    return `<label class="field"><span class="field__label">${esc(label)}</span>
      <input class="input" type="${def.type}" name="${k}" data-letter-field value="${esc(val)}" ${def.inputmode ? `inputmode="${def.inputmode}"` : ''} ${def.maxlength ? `maxlength="${def.maxlength}"` : ''} autocomplete="${def.autocomplete || 'off'}"></label>`;
  };

  main.innerHTML = `
    <div class="screen-head no-print"><button type="button" class="btn btn--link" data-action="back-results">‹ ${esc(L.back)}</button></div>
    <h1 class="no-print">${esc(L.h1_prefix)}${esc(letter.title)}</h1>
    <p class="lede no-print">${esc(L.intro)}</p>
    ${right.letter === id && right.caveats && rightId === 'arnona_100_old_age_disabled' ? `<p class="note no-print"><strong>${esc(strings.results.caveat_label)}</strong> ${esc(right.caveats)}</p>` : ''}
    <section class="letter-form no-print" aria-labelledby="lf-title">
      <h2 id="lf-title">${esc(L.form_title)}</h2>
      ${editable.map(fieldHtml).join('')}
    </section>
    <section class="letter-preview" aria-labelledby="lp-title">
      <h2 id="lp-title" class="no-print">${esc(L.preview_title)}</h2>
      <div class="letter-paper" id="letter-paper" lang="he" dir="rtl"></div>
    </section>
    <div class="letter-actions no-print">
      <button type="button" class="btn btn--secondary" data-action="copy-letter">📋 ${esc(L.copy)}</button>
      <button type="button" class="btn btn--secondary" data-action="print">🖨️ ${esc(L.print)}</button>
      <p class="copy-status" id="copy-status" role="status"></p>
    </div>
    ${letter.note ? `<aside class="letter-note no-print"><h2>${esc(L.note_title)}</h2>${renderLetterHtml(letter.note.replace(/^\*|\*$/g, ''), {}, '')}</aside>` : ''}`;

  const updatePreview = () => {
    const values = resolveValues(defaults, typed);
    $('#letter-paper').innerHTML = renderLetterHtml(letter.body, values, L.empty_field);
    $('#letter-paper').dataset.plain = letterPlainText(letter.body, values, L.empty_field);
  };
  updatePreview();
  main.querySelectorAll('[data-letter-field]').forEach((el) => {
    el.addEventListener('input', () => { typed[el.name] = el.value; saveState(); updatePreview(); });
    el.addEventListener('change', () => { typed[el.name] = el.value; saveState(); updatePreview(); });
  });
}

async function copyLetter() {
  const paper = $('#letter-paper');
  const status = $('#copy-status');
  if (!paper) return;
  const text = paper.dataset.plain || paper.innerText;
  let ok = false;
  try { await navigator.clipboard.writeText(text); ok = true; } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); ok = document.execCommand('copy'); document.body.removeChild(ta);
    } catch { ok = false; }
  }
  if (status) status.textContent = ok ? strings.letter.copied : strings.letter.copy_failed;
}

// ---- About -------------------------------------------------------------------------
function renderAbout() {
  const A = strings.about;
  const statuses = STATUS_ORDER.map((st) => `<li><span class="badge badge--${st}"><span aria-hidden="true">${strings.results.status_icons[st]}</span> ${esc(rules._meta.statuses[st])}</span> — ${esc(strings.results.status_help[st])}</li>`).join('');
  const sources = rules.rights.map((r) => {
    const s = r.sources?.[0];
    return `<li><strong>${esc(r.title)}</strong><br>${s ? `<a href="${esc(s.url)}">${esc(s.name)}</a> · ${esc(A.verified_label)} ${fmtDate(s.verified)}` : ''}</li>`;
  }).join('');
  main.innerHTML = `
    <div class="screen-head"><button type="button" class="btn btn--link" data-action="home">‹ ${esc(A.back)}</button></div>
    <h1>${esc(A.h1)}</h1>
    <p class="lede">${esc(A.p1)}</p>
    <h2>${esc(A.statuses_title)}</h2>
    <ul class="plain">${statuses}</ul>
    <h2>${esc(A.privacy_title)}</h2>
    <p>${esc(A.privacy)}</p>
    <h2>${esc(A.disclaimer_title)}</h2>
    <p>${esc(A.disclaimer)} <a href="${esc(A.issues_url)}">${esc(A.report_error)}</a> · <a href="${esc(A.disclaimer_url)}">${esc(A.disclaimer_link)}</a></p>
    <h2>${esc(A.sources_title)}</h2>
    <p>${esc(A.sources_intro)}</p>
    <ol class="sources">${sources}</ol>
    <p class="footnote"><a href="${esc(A.repo_url)}">GitHub</a> · MIT</p>`;
}

// ---------------------------------------------------------------------------
// Events (delegated)
// ---------------------------------------------------------------------------
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;
  switch (action) {
    case 'start': e.preventDefault(); state.entry = $('input[name="entry"]:checked', main)?.value || 'parent'; start(); break;
    case 'about': e.preventDefault(); navigate(() => { state.view = 'about'; }); break;
    case 'home': e.preventDefault(); navigate(() => { state.view = 'landing'; }); break;
    case 'next': goNext(); break;
    case 'back': goBack(); break;
    case 'early-exit': earlyExit(); break;
    case 'back-questions': navigate(() => { state.view = 'question'; state.earlyExit = false; if (!state.screen) state.screen = 'S1'; }); break;
    case 'back-results': navigate(() => { state.view = 'results'; state.letter = null; }); break;
    case 'restart': resetState(); navigate(() => { state.view = 'landing'; }); break;
    case 'letter': navigate(() => { state.view = 'letter'; state.letter = { id: el.dataset.letter, rightId: el.dataset.right }; }); break;
    case 'copy-letter': copyLetter(); break;
    case 'print': track('print'); $$('details', main).forEach((d) => { d.open = true; }); window.print(); break;
    case 'share': track('share_whatsapp'); break; // the anchor navigates
    case 'speak': tts.speak(el.dataset.card ? cardSpeech(el.dataset.card) : screenSpeech()); break;
    case 'tts-toggle': tts.setAuto(!tts.auto); break;
    case 'size': applySize(el.dataset.size); break;
    default: break;
  }
});

main.addEventListener('change', (e) => {
  const input = e.target;
  if (input.name === 'entry') { state.entry = input.value; saveState(); return; }
  const fs = input.closest('[data-qid]');
  if (!fs || state.view !== 'question') return;
  const q = qById[fs.dataset.qid];
  if (q.type === 'multi' && input.type === 'checkbox') {
    const boxes = $$('input[type="checkbox"]', fs);
    if (input.checked && input.dataset.exclusive) boxes.forEach((b) => { if (b !== input) b.checked = false; });
    else if (input.checked) boxes.forEach((b) => { if (b.dataset.exclusive) b.checked = false; });
  }
  readAnswers();
  if (q.type !== 'text') renderQuestionScreen({ preserveFocus: true }); // sibling questions may appear/disappear
});

main.addEventListener('input', (e) => {
  const fs = e.target.closest('[data-qid][data-type="text"]');
  if (fs) readAnswers();
});

window.addEventListener('popstate', (e) => {
  const s = e.state;
  if (!s || !s.view) { state.view = 'landing'; render(); return; }
  readAnswers();
  state.view = s.view; state.screen = s.screen ?? state.screen; state.earlyExit = !!s.earlyExit; state.letter = s.letter || null;
  render();
});

window.addEventListener('beforeprint', () => { $$('details', main).forEach((d) => { d.open = true; }); });

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
async function boot() {
  const lang = new URLSearchParams(location.search).get('lang') || document.documentElement.lang || 'he';
  try {
    const load = async (u) => { const r = await fetch(u, { cache: 'no-cache' }); if (!r.ok) throw new Error(`${u}: HTTP ${r.status}`); return r.json(); };
    [rules, questions, strings] = await Promise.all([load('rules.json'), load('questions.json'), load(`strings.${lang}.json`).catch(() => load('strings.he.json'))]);
  } catch (err) {
    main.innerHTML = `<h1>בודקים זכויות להורים</h1><p class="note note--error">לא הצלחנו לטעון את נתוני הבדיקה. אם פתחתם את הקובץ ישירות מהמחשב, יש להריץ שרת מקומי (למשל: <code>npx serve</code>) או להיכנס דרך כתובת האתר.</p><p class="footnote">${esc(err.message)}</p>`;
    return;
  }
  document.documentElement.lang = strings._meta.lang || 'he';
  document.documentElement.dir = strings._meta.dir || 'rtl';
  document.title = strings.app_title;
  $('#brand').textContent = strings.app_title;
  $('#skip').textContent = strings.nav.skip_to_content;
  engine = createEngine(rules, questions);
  qById = Object.fromEntries(questions.questions.map((q) => [q.id, q]));
  rightById = Object.fromEntries(rules.rights.map((r) => [r.id, r]));

  applySize(storedSize() || 'a', false);
  renderControls();
  tts.init();
  initAnalytics();

  state = loadState() || defaultState();
  if (state.view === 'question' && !state.screen) state.screen = 'S1';
  render();
  try { history.replaceState({ view: state.view, screen: state.screen, earlyExit: state.earlyExit, letter: state.letter }, ''); } catch { /* ignore */ }
}

boot();
