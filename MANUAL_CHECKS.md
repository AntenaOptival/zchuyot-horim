# Manual verification — a prompt for Cowork (browser) and for Harel

> **Status 15.9.2026 ~09:00:** run once. Pages is live, the repo is public, all 39 pages loaded, three URLs were updated, decisions D5/D7/D8/D15 applied, two UI bugs fixed. Still pending: E1–E3 (phone calls), E11–E12 (phone tests). Re-run Tasks B–C after every content update to `rules.json`.

Everything the build session could not do from its sandbox (no access to Israeli government sites, Kol Zchut, or the GitHub settings UI). Paste the block between the lines into Cowork with the browser extension; answer the "Decisions" and "Phone" parts yourself; bring the **Report** back to the build session, which will apply the results to `rules.json` / the letters / the docs.

---

You are verifying the static web tool **"בודקים זכויות להורים"** (repository `AntenaOptival/zchuyot-horim`, all sources in `rules.json`). You have a browser. Work through the tasks in order, do not edit any repository file, and end with the **Report** in the exact format given at the bottom. Where a task needs the human's decision (visibility change, payment), stop and ask before acting.

## Task A — put the site live on GitHub Pages

1. Open `https://github.com/AntenaOptival/zchuyot-horim/settings/pages`.
2. If GitHub says Pages is unavailable because the repository is private: ask the human whether to make it public (the code is MIT-licensed and meant to be public). If yes: `Settings → General → Danger Zone → Change visibility → Public`, then return to `Settings → Pages`.
3. Set **Source: Deploy from a branch**, **Branch: main**, folder **/ (root)**, Save.
4. Wait about two minutes, reload the Pages settings page and copy the site URL. Open it and confirm the landing page shows the title "בודקים זכויות להורים", two choice cards and a "מתחילים" button.
5. **Custom domain (if Harel buys one, e.g. `zchuyot-horim.org.il`):** after step 4 works, in `Settings → Pages → Custom domain` enter the domain and Save (GitHub adds a `CNAME` file to `main`). At the registrar's DNS: for `www` add a **CNAME** record → `antenaoptival.github.io`; for the bare domain add four **A** records → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`. Wait for the DNS check to pass, tick **Enforce HTTPS**, open the domain on a phone. Report the domain.
6. Optional smoke test on the live URL: choose "אני בודק/ת עבור ההורה", press "מתחילים", answer: אישה · מרץ 1952 · קצבת אזרח ותיק · לא · רק ההורה · עד 4,400 ₪ · לא מקבל/ת פנסיה · בדירה בבעלותו/ה · כן · 25% · לא · לא. Expect 3 cards under "כנראה זכאי/ת" (income supplement, arnona 30%, free transport 67+), 1 under "שווה לבדוק", 5 under "כדאי לדעת". Report any difference.

## Task B — links that no automated client could verify (Kol Zchut and gov.il block bots)

For every URL below: open it in a normal tab, wait for it to render, and record
(a) **status**: `OK` / `MISSING` (Kol Zchut shows "אין טקסט בדף זה" or gov.il shows 404) / `REDIRECT → <where>` / `ERROR <what>`;
(b) **title**: the page's main heading (H1);
(c) **updated**: for Kol Zchut, the date after "עודכן ב-" near the bottom of the article (leave empty for gov.il).

**B1 — priority: 17 pages with no evidence at all**

| # | URL | used by cards | status | title | updated |
|---|---|---|---|---|---|
| 1 | https://www.kolzchut.org.il/he/הנחה_בארנונה_לאזרחים_ותיקים | arnona_100_income_supplement, arnona_100_small_pension, arnona_25, arnona_30, arnona_not_holder |  |  |  |
| 2 | https://www.kolzchut.org.il/he/הנחה_בארנונה_למקבלי_קצבת_זיקנה_לנכה | arnona_100_old_age_disabled |  |  |  |
| 3 | https://www.kolzchut.org.il/he/הנחה_בארנונה_לנכים | arnona_disability |  |  |  |
| 4 | https://www.kolzchut.org.il/he/ארנונה | arnona_not_holder |  |  |  |
| 5 | https://www.kolzchut.org.il/he/הנחה_בחשבון_חשמל_למקבלי_גמלת_סיעוד | electricity |  |  |  |
| 6 | https://www.kolzchut.org.il/he/חשמל | electricity |  |  |  |
| 7 | https://www.kolzchut.org.il/he/חשבון_מים | water |  |  |  |
| 8 | https://www.kolzchut.org.il/he/הגשת_תביעה_לגמלת_סיעוד | siud_claim |  |  |  |
| 9 | https://www.kolzchut.org.il/he/מבחן_הכנסות_לצורך_קבלת_גמלת_סיעוד | siud_claim |  |  |  |
| 10 | https://www.kolzchut.org.il/he/הנחות_ברכישת_תרופות_למקבלי_קצבת_זיקנה_עם_השלמת_הכנסה | health_income_supplement |  |  |  |
| 11 | https://www.kolzchut.org.il/he/סיוע_במימון_מכשירי_שמיעה_למבוגרים | health_65 |  |  |  |
| 12 | https://www.kolzchut.org.il/he/זכויות_ניצולי_שואה | survivor_check |  |  |  |
| 13 | https://www.gov.il/he/service/request_for_farhud_compensation_iraq | survivor_check |  |  |  |
| 14 | https://www.kolzchut.org.il/he/עזרה_סיעודית_לניצולי_שואה_מהקרן_לרווחת_נפגעי_השואה | survivor_benefits |  |  |  |
| 15 | https://www.gov.il/he/service/itc-request-for-fixed-rights-at-retirement-age | tax_161d |  |  |  |
| 16 | https://www.kolzchut.org.il/he/פטור_ממס_במשיכת_כספים_מקופת_גמל_לא_פעילה | har_hakesef |  |  |  |
| 17 | https://www.kolzchut.org.il/he/הנחה_בתשלומי_בזק_למקבלי_קצבת_זיקנה_עם_השלמת_הכנסה | bezeq |  |  |  |

**B2 — 22 pages already seen in a Wayback snapshot (2024–2026); a quick confirmation each**

| # | URL | used by cards | status | title | updated |
|---|---|---|---|---|---|
| 1 | https://www.kolzchut.org.il/he/הנחה_בארנונה_למקבלי_גמלת_סיעוד | arnona_siud |  |  |  |
| 2 | https://www.kolzchut.org.il/he/הנחה_בארנונה_לניצולי_שואה_ולנכי_המלחמה_בנאצים | arnona_survivor |  |  |  |
| 3 | https://www.kolzchut.org.il/he/הנחה_בארנונה_לעיוורים_ולקויי_ראייה | arnona_disability |  |  |  |
| 4 | https://www.kolzchut.org.il/he/הנחה_בארנונה_לנכי_צה"ל | arnona_disability |  |  |  |
| 5 | https://www.kolzchut.org.il/he/הנחה_בארנונה_לבעלי_הכנסה_נמוכה | arnona_low_income |  |  |  |
| 6 | https://www.kolzchut.org.il/he/הנחה_בחשבון_חשמל_למקבלי_קצבת_זיקנה_עם_השלמת_הכנסה | electricity |  |  |  |
| 7 | https://www.kolzchut.org.il/he/הטבה_בחשבון_המים_למקבלי_קצבת_זיקנה_עם_השלמת_הכנסה | water |  |  |  |
| 8 | https://www.kolzchut.org.il/he/תוספת_השלמת_הכנסה_לקצבת_זיקנה | income_supplement |  |  |  |
| 9 | https://www.kolzchut.org.il/he/פטור_מתשלום_על_נסיעה_בתחבורה_ציבורית_לאזרחים_ותיקים_מגיל_67 | transport_67 |  |  |  |
| 10 | https://www.kolzchut.org.il/he/הנחה_בתחבורה_הציבורית_לנשים_מגיל_62 | transport_women_62 |  |  |  |
| 11 | https://www.kolzchut.org.il/he/מענק_חימום | heating_grant |  |  |  |
| 12 | https://www.kolzchut.org.il/he/פטור_מתשלומים_בקופות_החולים_למקבלי_קצבת_זיקנה_עם_השלמת_הכנסה | health_income_supplement |  |  |  |
| 13 | https://www.kolzchut.org.il/he/טיפולי_שיניים_לאזרחים_ותיקים_במסגרת_סל_הבריאות | health_72 |  |  |  |
| 14 | https://www.kolzchut.org.il/he/הנחה_ברכישת_תרופות_לאזרחים_ותיקים | health_72 |  |  |  |
| 15 | https://www.kolzchut.org.il/he/בריאות_בגיל_השלישי | health_65 |  |  |  |
| 16 | https://www.kolzchut.org.il/he/הפחתה_בתקרת_התשלום_לאזרחים_ותיקים_עבור_שירותי_בריאות_בקופות_החולים | health_67_ceiling |  |  |  |
| 17 | https://www.kolzchut.org.il/he/מענק_שנתי_לפי_חוק_ההטבות_לניצולי_שואה | survivor_check |  |  |  |
| 18 | https://www.kolzchut.org.il/he/מדריך_לזכויות_ניצולי_שואה_אשר_טרם_הוכרה_זכאותם_לקצבה_או_מענק | survivor_check |  |  |  |
| 19 | https://www.kolzchut.org.il/he/פטור_מתשלום_עבור_תרופות_לניצולי_שואה_ונכי_המלחמה_בנאצים | survivor_benefits |  |  |  |
| 20 | https://www.gov.il/he/service/pension_savings_search | har_hakesef |  |  |  |
| 21 | https://www.kolzchut.org.il/he/מוקד_8840*_של_אגף_בכיר_אזרחים_ותיקים | hotlines |  |  |  |
| 22 | https://www.kolzchut.org.il/he/מדריך_מיצוי_זכויות_לאזרחים_ותיקים | hotlines |  |  |  |

## Task C — the Ombudsman complaint page

`https://www.mevaker.gov.il/he/Ombudsman` currently lands on the Comptroller's home page. Starting from `https://www.mevaker.gov.il/`, find the page of **נציב תלונות הציבור** that explains how to submit a complaint (or the online complaint form). Report its exact URL and title. If there is a dedicated page about complaints on **ארנונה** or on local authorities, report that too.

## Task D — decisions for Harel (no browser needed)

- **D5 · Letter L2 for recipients of קצבת זקנה לנכה.** The letter's legal paragraph cites ס' 9(ב) (income-supplement recipients). For this card the content owner's own caveat says the basis is *תקנות האזרחים הוותיקים (הטבות לאזרח ותיק שמקבל קצבת זקנה לנכה)*. Choose one:
  (a) add a `{{legal_basis}}` placeholder to L2 and, for this card only, replace the legal paragraph with the card's own `why` sentence from `rules.json` ("לפי תקנות האזרחים הוותיקים (הטבות לאזרח ותיק שמקבל קצבת זקנה לנכה), מי שקיבל/ה קצבת נכות כללית לפני הפרישה וממשיך/ה לקבל קצבת זקנה לנכה זכאי/ת להנחה של 100% בארנונה על עד 100 מ"ר, בכפוף למבחן ההכנסה של חוק האזרחים הוותיקים") — no new legal text is invented;
  (b) write a separate template `letters/L2b-arnona-100-old-age-disabled.md` (you supply the text);
  (c) drop the letter button from this card and keep the steps only.
- **D7 · "self" grammar.** Keep the mapping "של {{name}}" → "שלך", "ל{{name}}" → "לך"? `yes` / `no, use את/ה everywhere`.
- **D8 · Default name for "קרוב/ה אחר/ת".** Keep "ההורה" (KICKOFF) or change to "הקרוב/ה"?
- **D15 · Women aged 62–67 before their retirement age.** They see the pre-retirement note plus the transport-62 card. Keep the note as is, or add a line? (Give the line if so.)
- **D-analytics · GoatCounter.** Site code to enable events (`const GOATCOUNTER = '…'` in `app.js`), or `later`.

## Task E — phone / device checks for a human (optional before launch)

- **E1** Call one municipality's מחלקת גבייה: is the 30% discount under ס' 9 granted retroactively to 1 January of the filing year?
- **E2** Call 103 (חברת החשמל): what is today's channel for transferring a contract to the eligible person — phone, fax 03-7131899, or an online form (URL)?
- **E3** Ask one קופת חולים: hearing-aid participation per ear — 3,426.85 ₪ or 3,141 ₪?
- **E11** On one iPhone and one Android, tap "התקשר/י *6050" on a card: does the dialer open with the star code intact?
- **E12** On an iPhone (Safari) and an Android (Chrome), with the live URL: does "הקראה" speak Hebrew? Does the auto-read toggle speak the next screen by itself? Does text size A++ keep every screen usable?

## Report (paste this back, filled in)

```
PAGES_URL:
CUSTOM_DOMAIN:
REPO_VISIBILITY:
SMOKE_TEST:              # OK / differences
B1: <#> | <status> | <title> | <updated>      (one line per row)
B2: <#> | <status> | <title> | <updated>
OMBUDSMAN_URL:            # + title; arnona page if any
D5: a / b / c             # (b: attach the text)
D7:
D8:
D15:
GOATCOUNTER:
E1:  E2:  E3:  E11:  E12:
```
---
