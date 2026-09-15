// The five personas from KICKOFF.md — today = 2026-09-15.
// Answers not listed were never shown (not applicable).
export const TODAY = { year: 2026, month: 9 };

export const PERSONAS = {
  P1: {
    label: 'רחל, 74, אלמנה, גרה לבד',
    answers: {
      for_whom: 'parent', name: 'רחל', gender: 'f', birth_year: 1952, birth_month: 3,
      benefits: ['old_age'], adl_help: 'no', seniors_in_home: '1', income_band: 'b1',
      pension_status: 'no_pension', housing: 'owner', arnona_in_name: 'yes', arnona_discount: '25',
      disability: ['none'], ravkav_gold: 'no',
    },
    expect: {
      income_supplement: 'likely', arnona_30: 'likely', transport_67: 'likely',
      arnona_low_income: 'check',
      health_72: 'info', health_65: 'info', health_67_ceiling: 'info', har_hakesef: 'info', hotlines: 'info',
    },
    variants: {},
    screens: 8,
    renderedScreens: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S10'],
  },
  P2: {
    label: 'יוסף, 68, נשוי לרבקה (66, ילידת 1960-05)',
    answers: {
      for_whom: 'parent', name: 'יוסף', gender: 'm', birth_year: 1958, birth_month: 2,
      benefits: ['old_age'], adl_help: 'no', seniors_in_home: '2', income_band: 'b4',
      pension_status: 'pension_161d_unknown', housing: 'owner', arnona_in_name: 'yes', arnona_discount: '25',
      disability: ['none'], ravkav_gold: 'yes',
    },
    expect: {
      arnona_30: 'likely',
      tax_161d: 'check',
      health_67_ceiling: 'info', health_65: 'info', har_hakesef: 'info', hotlines: 'info',
    },
    variants: { tax_161d: 'unknown_161d' },
    hidden: ['income_supplement', 'electricity', 'transport_67', 'health_72', 'arnona_25'],
    screens: 8,
  },
  P3: {
    label: 'סימה, 88, ילידת מרוקו, גרה אצל הבת',
    answers: {
      for_whom: 'parent', name: 'סימה', gender: 'f', birth_year: 1938, birth_month: 6,
      benefits: ['old_age', 'siud'], siud_level: '5', seniors_in_home: '1', income_band: 'b2',
      pension_status: 'no_pension', housing: 'with_family', ww2: ['north_africa'], survivor_payment: 'no',
      electricity_contract: 'other', ravkav_gold: 'dontknow',
    },
    expect: {
      electricity: 'likely',
      survivor_check: 'check', water: 'check', income_supplement: 'check', transport_67: 'check',
      arnona_not_holder: 'info', health_72: 'info', health_65: 'info', health_67_ceiling: 'info', har_hakesef: 'info', hotlines: 'info',
    },
    variants: { electricity: 'contract_other', income_supplement: 'single_b2' },
    screens: 9,
  },
  P4: {
    label: 'משה, 66, עדיין עובד (pre-retirement shortcut)',
    answers: { for_whom: 'self', gender: 'm', birth_year: 1960, birth_month: 4 },
    expect: { health_65: 'info', har_hakesef: 'info', hotlines: 'info' },
    variants: {},
    screens: 2,
    renderedScreens: ['S1', 'S2'],
    preRetirement: true,
  },
  P5: {
    label: 'מרים, 80, מקבלת השלמת הכנסה, שוכרת',
    answers: {
      for_whom: 'parent', name: 'מרים', gender: 'f', birth_year: 1946, birth_month: 1,
      benefits: ['old_age', 'income_supplement'], adl_help: 'no',
      pension_status: 'no_pension', housing: 'renter', arnona_in_name: 'yes', arnona_discount: '25',
      disability: ['none'], electricity_contract: 'self', ravkav_gold: 'yes',
    },
    expect: {
      arnona_100_income_supplement: 'likely', electricity: 'likely',
      water: 'check', health_income_supplement: 'check',
      heating_grant: 'info', bezeq: 'info', health_72: 'info', health_65: 'info', health_67_ceiling: 'info', har_hakesef: 'info', hotlines: 'info',
    },
    variants: {},
    hidden: ['arnona_30', 'income_supplement', 'arnona_25'],
    screens: 8,
    autoFilled: { seniors_in_home: '1', income_band: 'b1' },
    notRenderedScreens: ['S4'],
  },
};
