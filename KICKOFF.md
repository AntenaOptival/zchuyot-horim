# KICKOFF — paste this into Claude Code from the repo root

You are building **בודקים זכויות להורים** — a static, Hebrew, phone-first web tool that asks 8–10 short questions (adaptive; 2 for a pre-retiree) about a person aged 60+ and returns the short list of rights they are probably not claiming, with the exact next step and, where the step is a letter, the letter. Public good, MIT, no backend, no login, nothing stored server-side. A nonprofit must be able to fork it, edit one JSON, and host it on GitHub Pages.

Read these first, in this order: `SPEC.md` (product), `questions.json` (flow), `rules.json` (rights, criteria, copy, sources), `letters/L1..L3` (templates), `VERIFICATION.md` (what was fact-checked and what is still open — seed `OPEN_QUESTIONS.md` from its last section), `research/*.md` (the source research behind every threshold — consult when copy needs detail; do not invent facts that are not there).

## Hard constraints

1. **Vanilla only**: `index.html`, `styles.css`, `app.js` (ES modules OK, no bundler), `rules.json`, `questions.json`, `strings.he.json`. No framework, no build step, no npm dependency at runtime. `node --test` for tests is fine.
2. **Hebrew, RTL, `lang="he"`, `dir="rtl"`** throughout, and **built for older users** (SPEC §3a is binding): base 20px body on phones (never < 18), headings 28–32px, `rem` units, never `user-scalable=no`; text-size control A / A+ / A++ (20/24/28px) on every screen, persisted in `localStorage`; **read-aloud** on every question screen and every result card via `speechSynthesis` (`lang="he-IL"`), a persisted global auto-read toggle, buttons hidden when no Hebrew voice exists after `voiceschanged`, speech cancelled on navigation; body-text contrast ≥ 7:1, status never by colour alone; full-width choice cards ≥ 56px, one fixed primary button ≥ 56px per screen; no modals/toasts/timers/motion; plain Hebrew (acronyms expanded, ₪ with thousands separators); semantic HTML, one `h1` per screen, `aria-live="polite"`, focus moved to the new question, visible focus ring. System font stack; no external fonts, no CDN scripts.
3. **Privacy**: answers live in memory + `sessionStorage` (so a page refresh does not lose them); nothing else. No cookies. Analytics = GoatCounter events only (see §Analytics); every call guarded (`window.goatcounter?.count`). Never send answers anywhere.
4. **Calibrated copy**: statuses exactly as `rules.json → _meta.statuses`. Never render "זכאי/ת" without "כנראה". Every card renders the source line `מקור: {sources[0].name} · נבדק {verified}` and the caveat if present.
5. **Rules engine and flow are data-driven**: implement the predicate grammar in SPEC §5 exactly (`all/any/not/eq/in/includes/gte/lte/unknown`) with its **three-valued logic**: `dontknow` → unknown; a question that was never shown → *not applicable* → definite false (a persona who was never asked `survivor_payment` must not get a 'check' card for it). Flow rules from `questions.json`: `screens` group 1–3 questions per screen; `show_if` hides; `skip_if` + `default_when_skipped` answers silently (a real answer, and a screen whose questions were all skipped is not rendered); **pre-retirement shortcut** after S2; **early exit** button from S4 that records unreached questions as `dontknow`. `met / partial / hidden`, `always: true`, and `variants` (first matching variant overrides `status` and appends `title_suffix` / `note`). Derived fields per `questions.json → derived_fields` (incl. `pension_income` from `pension_status`), women's retirement age from `rules.json → derived.retirement_age_women` (born 1960-05 → 62y4m; men 67). **`tests/reference_engine.py` is the executable definition — port it 1:1 to `engine.js` and keep its five fixtures green, including the rendered-screen counts.**
6. Do not "improve" thresholds, legal statements or phone numbers. If you believe one is wrong, write it to `OPEN_QUESTIONS.md` and keep the JSON as is.

## Build order (commit after each step; conventional commits; short Hebrew-or-English messages)

1. `engine.js` — pure functions: `derive(answers, today)`, `resolveFlow(questions, answers, today)` → `{env, shown, rendered, nextScreen}`, `evaluate(rules, answers, today)` → `[{right, status, variant}]`. Unit tests in `tests/engine.test.js` covering each predicate, the partial/unknown logic, skip_if defaults, the pre-retirement shortcut and early exit.
2. `tests/personas.test.js` — the five personas below must produce exactly the expected surfaced right ids (order-insensitive), statuses, variants and rendered-screen counts. Make them pass before touching UI.
3. `index.html` + `app.js` — screens: landing (two entry buttons; the "self" entry starts at A+ and suggests read-aloud) → question screens per `questions.json → screens` (progress "שלב N מתוך ~M" recomputed as branches close, back, "לא יודע/ת" auto-added unless `no_dontknow`, early-exit button from S4, read-aloud button + auto-read toggle, text-size control) → results (groups: כנראה זכאי/ת · שווה לבדוק · כדאי לדעת) → letter view. `{{name}}` templating (default "ההורה"; for `for_whom = self` use "את/ה"). Sticky footer on results: וואטסאפ · הדפסה/שמירה · בדיקה חדשה.
4. Letters — render `letters/*.md` bodies (the part after `---`) with the placeholders filled from answers plus a large-type editable form for the fields we do not have (full name, ID, address, municipality, property size, account no.) — these are asked here only, never in the questionnaire. Buttons: העתקה · הדפסה. Print CSS: A4, margins 20mm, hide chrome.
5. WhatsApp share: `https://wa.me/?text=` with a plain-text list: title, statuses, the site URL, and the line "נבדק לפי כל זכות וביטוח לאומי, 14.9.2026".
6. `README.md` (Hebrew first, English below): what it is; run locally (open `index.html` or `npx serve`); edit `rules.json`; deploy to GitHub Pages in 5 minutes (Settings → Pages → main /root); add GoatCounter (one script tag + site code); add a language (`strings.<lang>.json`); report an error (issue template). `LICENSE` = MIT. `DISCLAIMER.md` (Hebrew): not legal advice, sources and dates, how the statuses are meant.
7. `scripts/check-links.mjs` — HEAD/GET every URL in `rules.json` and print the failures (Kol Zchut is fetchable; gov.il pages may 403 from CI — report, don't fail the build).
8. Lighthouse (mobile) a11y ≥ 95, performance ≥ 90. Fix what it flags.
9. Deploy to GitHub Pages; verify on a real phone; run the personas once more against the live URL by hand.

## Analytics (GoatCounter)

Events (`event: true`): `start`, `q_<questionId>` (fired when a question screen is shown), `results`, `card_<rightId>` (fired once per surfaced card on results render), `letter_<L1|L2|L3>`, `share_whatsapp`, `print`. Completion metric = `results`. Site code goes in one place at the top of `app.js` (`const GOATCOUNTER = ''` → empty disables everything).

## Personas (expected results — write these as the test fixtures; today = 2026-09-15; answers not listed were never shown)

**P1 — רחל, 74, אלמנה, גרה לבד** · f · 1952-03 · benefits [old_age] · adl_help no · seniors_in_home 1 · income_band b1 · pension_status no_pension · housing owner · arnona_in_name yes · arnona_discount 25 · disability [none] · ravkav_gold no · (ww2, electricity_contract not shown)
→ likely: `income_supplement`, `arnona_30`, `transport_67` · check: `arnona_low_income` · info: `health_72`, `health_65`, `health_67_ceiling`, `har_hakesef`, `hotlines` · **8 screens** (S1–S7, S10).

**P2 — יוסף, 68, נשוי לרבקה (66, ילידת 1960-05 → בגיל פרישה)** · m · 1958-02 · benefits [old_age] · adl_help no · seniors_in_home 2 · income_band b4 · pension_status pension_161d_unknown · housing owner · arnona_in_name yes · arnona_discount 25 · disability [none] · ravkav_gold yes
→ likely: `arnona_30` · check: `tax_161d` (variant `unknown_161d`) · info: `health_67_ceiling`, `health_65`, `har_hakesef`, `hotlines` · hidden: `income_supplement`, `electricity`, `transport_67`, `health_72`, `arnona_25` · **8 screens**.

**P3 — סימה, 88, ילידת מרוקו, גרה אצל הבת** · f · 1938-06 · benefits [old_age, siud] · siud_level 5 · seniors_in_home 1 · income_band b2 · pension_status no_pension · housing with_family · ww2 [north_africa] · survivor_payment no · electricity_contract other · ravkav_gold dontknow · (arnona_in_name/discount, disability not shown)
→ likely: `electricity` (variant `contract_other`) · check: `survivor_check`, `water`, `income_supplement` (variant `single_b2`), `transport_67` · info: `arnona_not_holder`, `health_72`, `health_65`, `health_67_ceiling`, `har_hakesef`, `hotlines` · **9 screens**.

**P4 — משה, 66, עדיין עובד** · m · 1960-04 · (pre-retirement shortcut after S2 — nothing else asked)
→ info: `health_65`, `har_hakesef`, `hotlines` · results note `strings.pre_retirement_note` · **2 screens**.

**P5 — מרים, 80, מקבלת השלמת הכנסה, שוכרת** · f · 1946-01 · benefits [old_age, income_supplement] · adl_help no · (S4 auto-filled: seniors_in_home 1, income_band b1 — screen not rendered) · pension_status no_pension · housing renter · arnona_in_name yes · arnona_discount 25 · disability [none] · electricity_contract self · ravkav_gold yes · (ww2 not shown: born 1946)
→ likely: `arnona_100_income_supplement`, `electricity` · check: `water`, `health_income_supplement` · info: `heating_grant`, `bezeq`, `health_72`, `health_65`, `health_67_ceiling`, `har_hakesef`, `hotlines` · hidden: `arnona_30`, `income_supplement`, `arnona_25` · **8 screens**.

If a persona's expectation contradicts `rules.json`, the JSON wins — fix the fixture, note it in `OPEN_QUESTIONS.md`.

## Copy that is not in the JSON (put in `strings.he.json`)

- Landing h1: "בודקים זכויות להורים" · sub: "10 שאלות. 2 דקות. רשימה קצרה של זכויות שכנראה לא נוצלו — ומה בדיוק לעשות." · CTA: "מתחילים" · privacy: "שום דבר לא נשמר. הבדיקה נעשית בטלפון שלך בלבד." · footer: "מבוסס על כל זכות, ביטוח לאומי ודוחות מבקר המדינה · קוד פתוח (MIT) · אינו ייעוץ משפטי".
- Results h1: "הרשימה של {{name}}" · group titles from `rules.json → _meta.statuses` · `pre_retirement_note`: "רוב הזכויות מתחילות בגיל הפרישה (67 לגברים, 62–65 לנשים) — כדאי לחזור אז." · read-aloud labels: "הקראה", "קריאה קולית: פועלת", "קריאה קולית: כבויה" · text-size labels: "א", "א+", "א++" · early exit: "הצג תוצאות עכשיו" · empty-state: "לא מצאנו זכויות שלא נוצלו לפי התשובות — זה טוב. שני הטלפונים למטה עוזרים בכל שאלה."
- Buttons: "לדף בכל זכות" · "הפקת מכתב" · "התקשר/י" · "שיתוף בוואטסאפ" · "הדפסה / שמירה כ-PDF" · "בדיקה חדשה" · "חזרה" · "לא יודע/ת".

## Done means

All of SPEC §10 is true, `node --test` is green (five personas incl. screen counts), read-aloud works in Hebrew on iOS and Android, the live URL works on a phone at text size A++, and `README.md` lets a stranger redeploy in 5 minutes. Then stop and report: URL, test output, Lighthouse scores, and the contents of `OPEN_QUESTIONS.md`.
