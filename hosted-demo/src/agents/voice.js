// VOICE AGENT — talks to the caller, detects intent, collects details,
// and hands a structured HANDOFF to the other agents. Never books anything itself.
const nlu = require('../nlu');
const { CLINIC, ymd, parseYmd } = require('../clinic');


const Q = {
  greet: { en: `Namaste! This is DantaVaani from ${CLINIC.name}. Would you like to book, reschedule or cancel an appointment?`, hinglish: `Namaste! Main DantaVaani, ${CLINIC.name} se. Appointment book, reschedule ya cancel karna hai?` },
  reason: { en: "Which example visit are you testing?", hinglish: 'Kaunsa example visit test kar rahe hain?' },
  date: { en: 'Which day would you like to come in?', hinglish: 'Aap kis din aana chahenge?' },
  newdate: { en: 'Which new day works for you?', hinglish: 'Naya din kaunsa theek rahega?' },
  time_pref: { en: 'Morning, afternoon or evening?', hinglish: 'Subah, dopahar ya shaam — kaunsa time theek rahega?' },
  name: { en: 'What demo name should I use? For example: Demo Caller.', hinglish: 'Koi demo naam boliye, jaise Demo Caller.' },
  phone: { en: 'Say “demo contact A” for this practice booking.', hinglish: 'Practice booking ke liye “demo contact A” boliye.' },
  phone_lookup: { en: 'Which demo contact code is on the practice booking?', hinglish: 'Practice booking ka demo contact code bataiye.' },
  sunday: { en: "We're closed on Sundays. Which other day works?", hinglish: 'Ravivar ko clinic band rehta hai. Koi aur din bataiye?' },
};
const say = (key, lang) => Q[key][lang === 'en' ? 'en' : 'hinglish'];

const REQUIRED = {
  BOOK: ['reason', 'date', 'time_pref', 'name', 'phone'],
  RESCHEDULE: ['phone', 'date', 'time_pref'],
  CANCEL: ['phone'],
  QUERY: [],
  EMERGENCY: [],
};

function handoffFrom(s) {
  return {
    intent: s.intent, name: s.slots.name || null, phone: s.slots.phone || null, date: s.slots.date || null,
    time_pref: s.slots.time_pref || null, reason: s.slots.reason || null, topics: s.slots.topics || [],
    language: s.lang, urgency: s.intent === 'EMERGENCY' ? 'high' : 'low', utterance: s.lastUtterance,
  };
}

// ---------------- offline (rule-based) brain ----------------
function processLocal(s, text) {
  s.lang = nlu.detectLang(text, s.lang);
  const intent = nlu.detectIntent(text);

  // switch intent if the caller clearly asks for something else (emergency always wins)
  const switchTo = (i) => { if (i !== s.intent) { s.intent = i; s.awaiting = null; } };
  if (intent === 'EMERGENCY') switchTo('EMERGENCY');
  else if (!s.intent && intent) switchTo(intent);
  else if (s.intent && ['CANCEL', 'RESCHEDULE'].includes(intent)) switchTo(intent);
  else if (intent === 'QUERY' && !s.awaiting) switchTo('QUERY');

  // extract whatever we can from this utterance
  const sl = s.slots;
  const phone = nlu.parsePhone(text); if (phone) sl.phone = phone;
  const name = nlu.parseName(text, s.awaiting === 'name'); if (name) sl.name = name;
  const date = nlu.parseDate(text); if (date) sl.date = date;
  const time = nlu.parseTime(text); if (time) sl.time_pref = time;
  const reason = nlu.parseReason(text);
  if (reason) sl.reason = reason;
  else if (s.awaiting === 'reason' && text.trim().length > 1) sl.reason = text.trim().slice(0, 60);
  if (s.intent === 'QUERY') sl.topics = nlu.queryTopics(text);
  if (s.intent === 'EMERGENCY') sl.reason = 'Practice review';

  if (!s.intent) return { reply: say('greet', s.lang), handoff: null };

  if (sl.date && !require('../clinic').isOpen(sl.date) && ['BOOK', 'RESCHEDULE'].includes(s.intent)) {
    sl.date = null; s.awaiting = 'date';
    return { reply: say('sunday', s.lang), handoff: null };
  }

  for (const field of REQUIRED[s.intent]) {
    if (!sl[field]) {
      s.awaiting = field;
      let key = field;
      if (field === 'phone' && s.intent !== 'BOOK') key = 'phone_lookup';
      if (field === 'date' && s.intent === 'RESCHEDULE') key = 'newdate';
      return { reply: say(key, s.lang), handoff: null };
    }
  }
  s.awaiting = null;
  return { reply: '', handoff: handoffFrom(s) };
}

async function process_(s, text) {
  s.lastUtterance=text;
  return {...processLocal(s,text),engine:'local'};
}

function resetTask(s) { s.intent = null; s.awaiting = null; s.slots = { name: s.slots.name, phone: s.slots.phone }; }

module.exports = { process: process_, resetTask };
