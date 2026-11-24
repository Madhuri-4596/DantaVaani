// Lightweight English / Hindi / Hinglish understanding used by the offline
// Voice Agent for fixed hosted demo steps.
const { ymd, addDays, parseYmd } = require('./clinic');

const HINDI_WORDS = ['hai', 'hain', 'mera', 'meri', 'mere', 'mujhe', 'muje', 'kal', 'aaj', 'parso', 'naam', 'chahiye', 'karna', 'karni',
  'kya', 'haan', 'nahi', 'nahin', 'bahut', 'daant', 'dant', 'dard', 'subah', 'shaam', 'sham', 'dopahar', 'baje', 'kitna', 'kitne',
  'kab', 'kahan', 'ji', 'hoon', 'hu', 'aap', 'apna', 'mein', 'main', 'ko', 'ka', 'ki', 'ke', 'bhi', 'aur', 'tha', 'gaya', 'raha', 'rahi', 'dijiye', 'kijiye'];

function detectLang(text, prev = 'en') {
  if (/[ऀ-ॿ]/.test(text)) return 'hi';
  const words = text.toLowerCase().match(/[a-z]+/g) || [];
  const hits = words.filter((w) => HINDI_WORDS.includes(w)).length;
  if (hits >= 1 && (hits >= 2 || words.length <= 3)) return 'hinglish';
  if (words.length >= 4 && hits === 0) return 'en';
  return prev;
}

const has = (t, list) => list.some((k) => (k instanceof RegExp ? k.test(t) : t.includes(k)));

const EMERGENCY = ['request a demo callback'];
const CANCEL = ['cancel', 'radd', 'रद्द'];
const RESCHEDULE = ['reschedule', 're-schedule', 'postpone', 'prepone', 'badal', 'change my appointment', 'change appointment', 'shift my', 'move my', 'appointment change'];
const BOOK = ['book', 'appointment', 'appoint', 'milna', 'dikhana', 'dikhaana', 'check up', 'checkup', 'check-up', 'consult', 'visit', 'aana hai', 'slot', 'बुक'];
const QUERY = { hours: ['timing', 'timings', 'hours', 'open', 'khula', 'khulta', 'kab tak', 'band hota', 'closed'], fees: ['how much', 'fee', 'fees', 'charge', 'cost', 'price', 'kitna', 'kitne', 'paisa', 'rate'], address: ['address', 'location', 'kahan', 'where', 'direction', 'pata'] };

function detectIntent(t) {
  t = t.toLowerCase();
  if (has(t, EMERGENCY)) return 'EMERGENCY';
  if (has(t, CANCEL)) return 'CANCEL';
  if (has(t, RESCHEDULE)) return 'RESCHEDULE';
  if (has(t, BOOK)) return 'BOOK';
  if (queryTopics(t).length) return 'QUERY';
  if (parseReason(t)) return 'BOOK';
  return null;
}

function queryTopics(t) {
  t = t.toLowerCase();
  return Object.keys(QUERY).filter((k) => has(t, QUERY[k]));
}

function parsePhone(t) {
  const match=t.toLowerCase().match(/\bdemo[ -]contact[ -]([a-e])\b/);
  return match ? 'demo-contact-'+match[1] : null;
}

function stripPhone(t) { return t.replace(/\bdemo[ -]contact[ -][a-e]\b/gi,' '); }

const WEEKDAYS = [
  ['sunday', 'ravivar', 'itwar'], ['monday', 'somvar', 'somwar'], ['tuesday', 'mangalvar', 'mangalwar'], ['wednesday', 'budhvar', 'budhwar'],
  ['thursday', 'guruvar', 'guruwar', 'veervar'], ['friday', 'shukravar', 'shukrawar'], ['saturday', 'shanivar', 'shaniwar'],
];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function parseDate(t, now = new Date()) {
  t = stripPhone(t.toLowerCase());
  if (/^\d{4}-\d{2}-\d{2}$/.test(t.trim())) return t.trim();
  if (/\b(day after tomorrow|parso|parson)\b/.test(t)) return ymd(addDays(now, 2));
  if (/\b(today|aaj|abhi|आज)\b/.test(t)) return ymd(now);
  if (/\b(tomorrow|kal|कल)\b/.test(t)) return ymd(addDays(now, 1));
  for (let i = 0; i < 7; i++) {
    if (WEEKDAYS[i].some((w) => new RegExp('\\b' + w + '\\b').test(t))) {
      let diff = (i - now.getDay() + 7) % 7; if (diff === 0) diff = 7;
      if (/\bnext\b|\bagle\b/.test(t) && diff < 7) diff += 0;
      return ymd(addDays(now, diff));
    }
  }
  const m = t.match(/\b(\d{1,2})\s*(st|nd|rd|th|tarikh|tareekh)?\s*(jan\w*|feb\w*|mar\w*|apr\w*|may|jun\w*|jul\w*|aug\w*|sep\w*|oct\w*|nov\w*|dec\w*)?\b/);
  if (m && (m[2] || m[3])) {
    const day = Number(m[1]);
    let month = m[3] ? MONTHS.indexOf(m[3].slice(0, 3)) : now.getMonth();
    let year = now.getFullYear();
    let d = new Date(year, month, day);
    if (d < new Date(now.getFullYear(), now.getMonth(), now.getDate())) d = m[3] ? new Date(year + 1, month, day) : new Date(year, month + 1, day);
    if (day >= 1 && day <= 31) return ymd(d);
  }
  return null;
}

function parseTime(t) {
  t = stripPhone(t.toLowerCase());
  const evening = /\b(evening|shaam|sham|शाम|night|raat)\b/.test(t);
  const afternoon = /\b(afternoon|dopahar|dopehar|lunch|दोपहर)\b/.test(t);
  const morning = /\b(morning|subah|subha|सुबह)\b/.test(t);
  const m = t.match(/\b(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.|baje|o'?clock|bje)\b/);
  if (m) {
    let h = Number(m[1]); const min = m[2] || '00';
    const ap = m[3];
    if (/p/.test(ap) && h < 12) h += 12;
    if (/a/.test(ap) && h === 12) h = 0;
    if (!/[ap]/.test(ap)) { if (evening || afternoon || h < 8) { if (h < 12) h += 12; } }
    if (h >= 0 && h < 24) return `${String(h).padStart(2, '0')}:${min === '00' || min === '30' ? min : (Number(min) < 30 ? '00' : '30')}`;
  }
  if (evening) return 'evening';
  if (afternoon) return 'afternoon';
  if (morning) return 'morning';
  if (/\b(any ?time|kabhi bhi|koi bhi)\b/.test(t)) return 'any';
  return null;
}

function parseReason(t) {
  return /practice visit|example visit/i.test(t) ? 'Practice visit' : null;
}

const STOP = new Set(['hai', 'he', 'h', 'ji', 'hoon', 'hu', 'here', 'speaking', 'and', 'aur', 'my', 'is', 'mera', 'naam', 'name', 'the', 'a', 'please']);
function cleanName(raw) {
  const words = raw.replace(/[^a-zA-Zऀ-ॿ\s]/g, ' ').split(/\s+/).filter((w) => w && !STOP.has(w.toLowerCase()));
  if (!words.length || words.length > 3) return null;
  return words.map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

function parseName(t, awaitingName = false) {
  const m = t.match(/(?:my name is|mera naam|naam hai|name is|naam)\s+([a-zA-Zऀ-ॿ]+(?:\s+[a-zA-Zऀ-ॿ]+){0,2})/i);
  if (m) return cleanName(m[1]);
  if (awaitingName) {
    const m2 = t.match(/(?:this is|i am|i'm|main)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+){0,2})/i);
    if (m2) return cleanName(m2[1]);
    const plain = stripPhone(t).trim();
    if (plain && plain.split(/\s+/).length <= 4 && !/\d/.test(plain)) return cleanName(plain);
  }
  return null;
}

function parseChoice(t, options) {
  t = t.toLowerCase();
  const ord = [/\b(first|pehla|pehli|pahla|1st|option 1|number 1)\b/, /\b(second|doosra|dusra|doosri|dusri|2nd|option 2|number 2)\b/, /\b(third|teesra|tisra|teesri|3rd|option 3|number 3)\b/];
  for (let i = 0; i < options.length && i < 3; i++) if (ord[i].test(t)) return options[i];
  if (/^(one|two|three)$/.test(t.trim())) return options[['one', 'two', 'three'].indexOf(t.trim())] || null;
  const time = parseTime(t); const date = parseDate(t);
  if (time && /\d/.test(time)) { const o = options.find((x) => x.time === time && (!date || x.date === date)); if (o) return o; }
  if (date) { const o = options.find((x) => x.date === date); if (o) return o; }
  if (/\b(yes|haan|ha|ok|okay|theek|thik|sure|chalega)\b/.test(t)) return options[0];
  return null;
}

// --------- formatting for spoken replies ---------
function fmtTime(t) {
  let [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ap}`;
}
function fmtDate(d, lang = 'en') {
  const now = new Date(); const today = ymd(now); const tmrw = ymd(addDays(now, 1));
  const date = parseYmd(d);
  const label = date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
  if (d === today) return lang === 'en' ? `today (${label})` : `aaj (${label})`;
  if (d === tmrw) return lang === 'en' ? `tomorrow (${label})` : `kal (${label})`;
  return label;
}

module.exports = { detectLang, detectIntent, queryTopics, parsePhone, parseDate, parseTime, parseReason, parseName, parseChoice, fmtTime, fmtDate, has, EMERGENCY };
