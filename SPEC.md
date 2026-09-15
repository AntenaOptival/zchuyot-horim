# בודקים זכויות להורים — Product spec (v1)

Working name: **בודקים זכויות להורים** ("check your parents' rights"). English slug: `zchuyot-horim`.
Owner: Harel (solo, one week: build Tue 15 – Thu 17 Sep 2026, ship Fri 18, measure Sun 20).
License: MIT. Public good, unaffiliated with any company.

## 1. The gap this closes (from Phase 1 — see `research/impact-map` summary)

State Comptroller, Jun 2026 (בשיבה טובה?, ch. השמירה על רווחת האוכלוסייה המזדקנת): of ~450,000 people who retired 2020–2025, National Insurance (בט"ל) invited 148,996 (33%) to a rights information day and 17,428 (4%) came (pp. 14–15). Retirees name **מיצוי זכויות** as one of the three areas retirement preparation should cover (p. 19).
State Comptroller, Jul 2023 (שלטון מקומי, אזרחים ותיקים): in 7 of 9 audited municipalities only 1–5% of seniors held the 30% statutory arnona discount while 18–40% held the 25% one; municipalities "אינן מיידעות באופן יזום"; 84% of seniors were never contacted proactively (pp. 622–623).
State Comptroller, Jan 2024 (74א, חברת החשמל): ~158,000 of ~471,000 eligible households do not receive the electricity discount; it is automatic only when the eligible person is the IEC contract holder (pp. 1209, 1283).
Ombudsman 2023 (elderly special report): 12,882 complaints by people 65+ in 2019–mid-2022; it cites a 2013 BTL study in which 86% of benefit recipients said they would apply "if the process were simpler" (PDF p. 45, section on bureaucratic barriers).

**Mechanism we attack:** rights exist, are documented (Kol Zchut, BTL), and are mostly claimable with one form — but nobody tells the specific person which ones apply to them. The tool asks ~10 questions and returns the short personal list, with the exact next step and, where a letter is the step, the letter.

## 2. Users and job

Primary user: the **adult child (40–60)** of a person 60+, on a phone, in the family WhatsApp. Secondary: the senior themself; a social worker / volunteer at a nonprofit.
Job: "In two minutes, tell me which of my parent's rights are probably unclaimed, and what exactly to do about each."

Success (week one, per brief): one nonprofit agrees to host, **or** 1,000 real completions (results screen reached).

## 3. Product principles

1. Hebrew first, RTL, phone first, no login, no account, nothing stored server-side. Answers live only in the browser tab (in-memory / sessionStorage).
2. Content layer sits **on top of** Kol Zchut / BTL / gov.il: every card links to the canonical page; we match, we do not rewrite the corpus.
3. Every threshold and criterion carries a **source URL and verified date** (in `rules.json`). The UI shows "מקור: כל זכות · נבדק 14.9.2026" on each card.
4. Calibrated language: three statuses — **כנראה זכאי/ת** (criteria met on the answers given), **שווה לבדוק** (partially met / unknown answers), **כדאי לדעת** (universal). Hidden = not relevant. Never "you are entitled".
5. As few questions as possible: every question must be able to change at least one card for this person, or it is not asked (see §4).
6. Static site. Any nonprofit can fork, edit `rules.json`, and host for free.

## 3a. Built for older users — non-negotiable UX requirements

The adult child is the primary user, but the senior is the secondary user and the *reason* for the tool. Every screen must pass as if a 78-year-old with reading glasses and a mid-range Android is the only user.

- **Type**: base 20px on phones (never below 18), headings 28–32px, line-height ≥ 1.5, paragraph width ≤ 60 characters. A **text-size control on every screen** (A / A+ / A++ → 20 / 24 / 28px), persisted in `localStorage`. Use `rem` so OS font scaling is honoured; **never** `user-scalable=no`.
- **Read-aloud**: a speaker button on every question screen and on every result card, using the browser's built-in `speechSynthesis` with `lang="he-IL"` (iOS ships a Hebrew voice; Android with Google TTS does too). Reads the question, the help line and the options; on results, reads the card title, value and steps. A global toggle "קריאה קולית: פועלת/כבויה" (persisted) makes every new screen read itself automatically. If no Hebrew voice is available after `voiceschanged`, hide the buttons — never show a control that does nothing. Speech stops on navigation.
- **Contrast and colour**: body text ≥ 7:1 (AAA) against its background; no light-grey text anywhere; status is conveyed by a word and an icon, never by colour alone.
- **Touch**: choices are full-width cards ≥ 56px tall, whole card tappable, 12px gaps; primary button ≥ 56px, fixed at the bottom, one per screen; no swipe gestures required; no hover-only affordances.
- **One thing at a time**: one topic per screen, ≤ 3 questions; no modals, no toasts that disappear, no timers, no auto-playing motion; `prefers-reduced-motion` respected.
- **Plain Hebrew**: short sentences, every acronym expanded on first use (ביטוח לאומי, not בט"ל), numbers with ₪ and thousands separators, dates as 14.9.2026, no legal citations in the question flow (they belong on the card and in the letter).
- **Forgiving input**: month/year as two large selects (not free text); "לא יודע/ת" always available; Back always available; nothing is lost on refresh (sessionStorage); the ID number is only ever typed on the letter screen and never required to see results.
- **Results that can be handed over**: "הדפסה" produces a large-print A4 sheet with the cards and the phone numbers; WhatsApp share sends a plain-text list; every phone number is a `tel:` link with the number visible in full.
- **Assistive tech**: semantic HTML, one `h1` per screen, labelled controls, `aria-live="polite"` announcing the new screen, logical focus order (focus moves to the new question), visible focus ring. Test once with iOS VoiceOver and Android TalkBack; Lighthouse accessibility ≥ 95.
- **Languages**: v1 Hebrew; the strings file is ready for Russian (largest second audience per Kol Zchut's Russian-site data) and Arabic.

## 4. Flow (adaptive — 8–10 screens for a typical parent, 2 for a pre-retiree)

Screen 0 — Landing: one sentence of value, two big entry buttons ("אני בודק/ת עבור ההורה" / "אני בודק/ת עבור עצמי"), a line on privacy ("שום דבר לא נשמר"), link to "איך זה עובד / מקורות". The "self" entry starts at text size A+ and offers read-aloud.
Screens S1–S10 — see `questions.json → screens`. One topic per screen, 1–3 short questions on it. Progress shows "שלב 4 מתוך ~9" (estimate, recomputed as branches close). Back button always visible. "לא יודע/ת" is always an option and never blocks.

How the flow stays short:
- **Pre-retirement shortcut**: after S2, if the person has not reached retirement age, jump to results (nothing age-gated applies) with the note "רוב הזכויות מתחילות בגיל הפרישה — כדאי לחזור אז".
- **Silent defaults (`skip_if` + `default_when_skipped`)**: an income-supplement recipient is never asked about income or household size — the answer is implied (b1 / 1) and recorded as a real answer.
- **Show-only-if-it-can-matter (`show_if`)**: arnona questions only for people who pay arnona in their own name; disability only when it can change an arnona tier; electricity contract only for people in (or possibly in) a discount group; WWII questions only for people born ≤ 1945; Rav-Kav only at 67+; סיעוד level only if they receive סיעוד.
- **Merged questions**: pension + 161ד = one question with four answers; "for whom" + name on one screen; gender + birth on one screen.
- **Early exit**: from S4 a secondary button "הצג תוצאות עכשיו" — unanswered questions are recorded as "לא יודע/ת", so their rights appear as "שווה לבדוק" rather than vanish.
- **Letter fields are not questionnaire questions**: name, ID, address, municipality, property size, account number are asked on the letter screen only.

Screen R — Results: cards grouped **כנראה זכאי/ת** first, then **שווה לבדוק**, then "כדאי לדעת" (universal: *8840, *9696, הר הכסף). Each card: title · one-line value · "מה עושים" steps (collapsed by default, one tap to open) · button(s): "לדף בכל זכות" / "הפקת מכתב" / "התקשר/י" (tel: link) · source line · read-aloud button. Sticky footer: "שיתוף בוואטסאפ" · "הדפסה / שמירה" · "בדיקה חדשה".
Screen L — Letter: pre-filled from answers; editable fields; copy / print / share; explicit note that we do not send anything.

## 5. Rules engine (implemented by Claude Code)

`rules.json` holds an array of **rights**; each has `conditions` (JSON predicates over the answers object), `status_if_met`, `status_if_partial`, Hebrew copy, links, `sources[]`. Predicate grammar (keep it this small):

```
{"all":[...]} · {"any":[...]} · {"not":{...}}
{"eq":["field", value]} · {"in":["field", [values]]} · {"includes":["field", value]}   // multi-select fields
{"gte":["field", n]} · {"lte":["field", n]}
{"unknown":"field"}   // answer is "dontknow" or missing
```
Evaluation is three-valued (true / false / unknown). A field is *unknown* only when the user answered "לא יודע/ת". A field whose question was never shown (its `show_if` was false) or was skipped as optional is *not applicable* and counts as a definite **false** in `eq/in/includes/gte/lte` (and `unknown` returns false for it). `all`: any false → false, else any unknown → unknown, else true. `any`: any true → true, else any unknown → unknown, else false. `not` flips true/false and keeps unknown. A right is shown with `status_if_met` when true, `status_if_partial` when unknown, hidden when false. `always: true` rights are always shown as `info`. `variants`: the first variant whose `when` is true overrides `status` and appends `title_suffix` / `note`. Derived fields (`age`, `retirement_age_reached`, `is_65plus` … `is_90plus`, `pension_income`) are computed before evaluation from `birth_year`, `birth_month`, `gender`, `pension_status` using the BTL women's table in `rules.json → derived.retirement_age_women`. Flow semantics: a question with `skip_if` true is answered silently with `default_when_skipped` and counts as a real answer; early-exit records unreached questions as `dontknow`; the pre-retirement shortcut stops the flow after S2. `tests/reference_engine.py` is the executable definition of all of this.

## 6. Rights in v1 (see `rules.json` for criteria and copy)

Arnona: 25% (הנחת רשות) · 30% (חוק האזרחים הוותיקים, income ≤ ₪13,623 single / ≤ ₪20,434.5 for two seniors, Jan 2026) · 100% (השלמת/הבטחת הכנסה; or small pension ≤ ₪3,345.87 / ₪5,273.53 via סעיף 13א) · סיעוד up to 70% · ניצולי שואה up to 66% / נכי המלחמה בנאצים 2/3 · disability tiers (90%+ medical → 40%; 75%+ אי-כושר → 80%; blind → 90%; נכה צה"ל → 2/3) · low-income table 2026 · ועדת הנחות (medical expenses).
Utilities: electricity 50% × first 400 kWh/month (≈ ≤ ₪129/month), contract-holder rule, 103 / fax 03-7131899, retroactive with interest · water +3.5 m³/month at low tariff, automatic by ID+address, supplier / *6050 · Bezeq 50% fixed fees (השלמת הכנסה).
BTL: השלמת הכנסה (income ≤ ₪4,375 single / ₪6,912 couple incl. pension disregard ₪1,790/₪2,823; assets rules; retro 12 months; unlocks arnona 100%, electricity, water, drugs 50%, co-pay exemption, heating grant ₪664, Bezeq) · גמלת סיעוד (ADL need; income full ≤ ₪13,769 single / ₪20,654 couple, half up to ₪20,654 / ₪30,980; form 2600; *2637; starts 7 days after filing) · קצבת אזרח ותיק not yet claimed (form 480; retro 12 months; none income test at 70) · מענק חימום ₪664 automatic (October).
Transport: free for all residents 67+ since 25.4.2025 with "זהב-קו" profile (must be loaded); women 62–67: 50%.
Health: השלמת הכנסה → co-pay exemption + 50% drugs (automatic; *6050 if missing) · 72+ → 10% drugs, dental (free exam/X-ray/scaling, subsidized treatments) · 67+ → family quarterly ceiling halved · 65+ → flu & pneumococcal vaccines free; Shingrix in basket with co-pay · hearing aids reimbursement (₪3,141–3,427 per ear / 3.5 yrs — sources disagree; show range).
Holocaust survivors: born ≤ 1945 and lived in Europe / Libya / Tunisia / Morocco / Algeria / Iraq (Farhud) / Romania / Bulgaria during WWII and receiving nothing → check with הרשות לזכויות ניצולי השואה *5105: annual grant ₪7,688 (2026) if immigrated before 1.10.1953; otherwise קצבה ליוצאי מחנות וגטאות or Claims Conference Section 2 (income ≤ ₪173,200/yr); drug exemption; extra סיעוד hours.
Retirement money: קיבוע זכויות (טופס 161ד) — free tax exemption on pension, 2026 up to ₪5,422/month exempt (57.5% of ₪9,430 ceiling); retro up to 6 years · הר הכסף — free search for dormant pension/insurance accounts (*3002) · small inactive provident fund ≤ ₪8,000 → tax-free withdrawal.
Universal: *8840 (המשרד לשוויון חברתי, Sun–Thu 08:00–18:00) · *9696 BTL retiree counseling (Sun–Thu 09:00–13:30) · BTL ימי מידע.

Out of v1 (documented in `rules.json → backlog`): municipal programmes (+60 centres, מועדונים), housing aid, קצבת שאירים details, capital-gains tax benefit 60+, Russian UI.

## 7. Letters (see `letters/`)

L1 — בקשה להנחה בארנונה לאזרח ותיק (30%) לפי סעיף 9 לחוק האזרחים הוותיקים — with the income declaration line and the automatic-renewal clause (9(ד)).
L2 — בקשה להנחה של 100% למקבל/ת השלמת הכנסה (same law, 9(ב)).
L3 — פקס לחברת החשמל: העברת חוזה על שם הזכאי/ת (fields exactly as Kol Zchut lists them).
All letters: plain Hebrew, A4 print CSS, placeholders in `{{double_braces}}`, no legal claims beyond the cited section.

## 8. Measurement (privacy-safe)

GoatCounter (free, no cookies, no PII) with custom events: `start`, `q_<id>` (per question reached), `results`, `card_<right_id>` (surfaced, not clicked), `letter_<id>`, `share_whatsapp`, `print`. The **completion** metric = `results` events. No answers are ever sent. If GoatCounter is not set up, the site must still work (guard every call).

## 9. Non-functional

Vanilla HTML/CSS/JS, no build step, no framework (a nonprofit dev must be able to edit a JSON and redeploy). Single `index.html` + `app.js` + `rules.json` + `questions.json` + `strings.he.json` + `styles.css`. Works offline after first load (optional service worker). Lighthouse a11y ≥ 95. RTL throughout; `lang="he"`. No external fonts required (system stack: -apple-system, "Segoe UI", Arial, "Noto Sans Hebrew"). Hosted on GitHub Pages (or Cloudflare Pages); custom domain later.

## 10. Definition of done (Thu evening)

- All 5 test personas in `KICKOFF.md` produce the expected cards AND the expected number of rendered screens (automated test in `tests/personas.test.js`, run with `node --test`).
- Read-aloud works on an iPhone and an Android phone in Hebrew; text-size control persists; Lighthouse accessibility ≥ 95; one VoiceOver/TalkBack pass done.
- Every right in `rules.json` renders with its source line and a working Kol Zchut link (link checker script `scripts/check-links.mjs`).
- Letters L1–L3 generate, print to one A4 page, and copy to clipboard.
- WhatsApp share produces a readable Hebrew text with the site URL.
- README explains: what it is, how to run locally (open index.html), how to edit rules, how to deploy to GitHub Pages in 5 minutes, how to add GoatCounter, how to add a language.
- Disclaimer page: not legal advice; sources and verification dates; how to report an error (GitHub issue + email).
