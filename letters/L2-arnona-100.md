# L2 — בקשה להנחה בארנונה בשיעור 100% לאזרח ותיק המקבל השלמת הכנסה (סעיף 9(ב) לחוק האזרחים הוותיקים)

Placeholders as in L1, plus `{{benefit_name}}` ("תוספת השלמת הכנסה לקצבת אזרח ותיק" / "גמלת הבטחת הכנסה" / "קצבת זקנה לנכה"), `{{subject_basis}}` (the tail of the subject line) and `{{legal_basis}}` (the legal paragraph). Defaults are the ס' 9(ב) texts below (kept verbatim in `strings.he.json → letter.l2_*`); for the card `arnona_100_old_age_disabled` the app fills the legal paragraph with that card's own `why` sentence from `rules.json` (תקנות האזרחים הוותיקים (הטבות לאזרח ותיק שמקבל קצבת זקנה לנכה)) — decision D5(a), 15.9.2026.

---

{{date}}

לכבוד
{{municipality}}
מחלקת הגבייה / ועדת ההנחות בארנונה

**הנדון: בקשה להנחה בארנונה בשיעור 100% {{subject_basis}}**

אני, {{full_name}}, ת.ז. {{id_number}}, מתגורר/ת בדירה בכתובת {{address}} (מספר משלם/נכס: {{property_account}}), אזרח/ית ותיק/ה, ומקבל/ת מהמוסד לביטוח לאומי {{benefit_name}}.

{{legal_basis}}

הצהרה: {{income_line}}. הדירה משמשת למגוריי.

אבקש כי ההנחה תוחל ממועד תחילת שנת הכספים הנוכחית, ככל שכללי הרשות מאפשרים זאת, וכי בהתאם לסעיף 9(ד) לחוק תימשך אוטומטית בשנים הבאות.

מצורפים: צילום תעודת זהות; אישור המוסד לביטוח לאומי על קבלת {{benefit_name}}; {{attachments}}.

אודה לתשובה מנומקת בכתב.

בכבוד רב,
{{signer_name}}
טלפון: {{phone}}
