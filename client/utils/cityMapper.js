// Normalize "Tel Aviv-Yafo", "tel aviv", "Tel-Aviv Jaffa", etc. → "תל אביב-יפו"
const normalizeCityKey = (s = "") =>
  String(s)
    .toLowerCase()
    .normalize("NFKD")                            // strip accents
    .replace(/[^\p{Letter}\p{Number}]+/gu, "")    // remove spaces/hyphens/apostrophes
    .trim();

// Most common cities (aliases → Hebrew). Add/remove as you like.
const CITY_MAP = {
    // Tel Aviv
    'telaviv': 'תל אביב-יפו',
    'telavivyafo': 'תל אביב-יפו',
    'telavivjaffa': 'תל אביב-יפו',
    'yafo': 'תל אביב-יפו',
    'jaffa': 'תל אביב-יפו',

    // Center (Gush Dan)
    'ramatgan': 'רמת גן',
    'givatayim': 'גבעתיים',
    'givatshmuel': 'גבעת שמואל',
    'givatshmuel': 'גבעת שמואל',
    'givatshmuell': 'גבעת שמואל',
    'givatshmuel': 'גבעת שמואל',
    'beneibrak': 'בני ברק',
    'beneibrak': 'בני ברק',
    'bneibrak': 'בני ברק',
    'bneibrack': 'בני ברק',
    'petahTikva': 'פתח תקווה',
    'petatikva': 'פתח תקווה',
    'petachtikva': 'פתח תקווה',
    'rishonlezion': 'ראשון לציון',
    'rishonletzion': 'ראשון לציון',
    'rishon': 'ראשון לציון',
    'rehovot': 'רחובות',
    'herzliya': 'הרצליה',
    'kfarsaba': 'כפר סבא',
    'kfarsabba': 'כפר סבא',
    'raanana': 'רעננה',
    'raanana': 'רעננה',
    'hodhasharon': 'הוד השרון',
    'oraqiva': 'אור עקיבא',

    // Coastal / North
    'haifa': 'חיפה',
    'netanya': 'נתניה',
    'hadera': 'חדרה',
    'nahariya': 'נהריה',
    'akko': 'עכו',
    'acre': 'עכו',
    'tzfat': 'צפת',
    'safed': 'צפת',
    'tiberias': 'טבריה',
    'mashhad':'נוף הגליל',

    // South
    'ashdod': 'אשדוד',
    'ashkelon': 'אשקלון',
    'eilat': 'אילת',
    'beersheba': 'באר שבע',
    'beersheva': 'באר שבע',
    'beershebaa': 'באר שבע',
    'beersheba': 'באר שבע',
    'beersheva': 'באר שבע',
    'beerSheva': 'באר שבע',
    'beersheva': 'באר שבע',

    // Jerusalem & surrounds
    'jerusalem': 'ירושלים',
    'modiinmaccabimreut': 'מודיעין-מכבים-רעות',
    'modiin': 'מודיעין-מכבים-רעות',
    'lod': 'לוד',
    'ramla': 'רמלה',
    'beitShemesh': 'בית שמש',
    'beitshemesh': 'בית שמש',

    // Tel Aviv satellites
    'holon': 'חולון',
    'batyam': 'בת ים',
};

export const toHebrewCity = (raw) => {
  const key = normalizeCityKey(raw);
  return CITY_MAP[key] || null;
};
