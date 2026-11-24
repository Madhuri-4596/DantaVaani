// VOICE AGENT — talks to the caller, detects intent, collects details,
// and hands a structured HANDOFF to the other agents. Never books anything itself.
const nlu = require('../nlu');
const lyzr = require('../lyzr');
const { CLINIC, ymd, parseYmd } = require('../clinic');

const AGENT_ID = () => process.env.LYZR_VOICE_AGENT_ID;

const Q = {
  greet: { en: `Namaste! This is DantaVaani from ${CLINIC.name}. Would you like to book, reschedule or cancel an appointment?`, hinglish: `Namaste! Main DantaVaani, ${CLINIC.name} se. Appointment book, reschedule ya cancel karna hai?` },
  reason: { en: "Sure! What's the problem — a check-up, tooth pain, cleaning, or something else?", hinglish: 'Zaroor! Kya problem hai — checkup, daant dard, cleaning ya kuch aur?' },
  date: { en: 'Which day would you like to come in?', hinglish: 'Aap kis din aana chahenge?' },
  newdate: { en: 'Which new day works for you?', hinglish: 'Naya din kaunsa theek rahega?' },
  time_pref: { en: 'Morning, afternoon or evening?', hinglish: 'Subah, dopahar ya shaam — kaunsa time theek rahega?' },
  name: { en: 'May I have your name, please?', hinglish: 'Aapka naam bataiye?' },
  phone: { en: 'And your 10-digit mobile number?', hinglish: 'Aur aapka 10-digit mobile number?' },
  phone_lookup: { en: 'Sure. What mobile number is the appointment under?', hinglish: 'Theek hai. Appointment kis mobile number par hai?' },
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
  if (s.intent === 'EMERGENCY') sl.reason = sl.reason && sl.reason !== 'Tooth pain' ? sl.reason : 'Emergency';

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

// ---------------- Lyzr-powered brain ----------------
async function processLyzr(s, text) {
  const today = new Date();
  const msg = `[Context: today is ${ymd(today)} (${today.toLocaleDateString('en-IN', { weekday: 'long' })}). Clinic: ${CLINIC.name}. Hours: ${CLINIC.hours}]\nCaller: ${text}`;
  const out = await lyzr.chat(AGENT_ID(), s.id, msg);
  s.lang = nlu.detectLang(text, s.lang);
  const idx = out.indexOf('HANDOFF');
  if (idx < 0) return { reply: out.trim(), handoff: null };
  const reply = out.slice(0, idx).replace(/[*`]+$/g, '').trim();
  const h = lyzr.extractJson(out.slice(idx));
  if (!h) return { reply: reply || out.trim(), handoff: null };
  // normalise fields so the Action Agent can trust them
  h.intent = String(h.intent || '').toUpperCase();
  if (h.phone) h.phone = nlu.parsePhone(String(h.phone)) || h.phone;
  if (h.date && !/^\d{4}-\d{2}-\d{2}$/.test(h.date)) h.date = nlu.parseDate(String(h.date));
  if (h.time_pref) h.time_pref = nlu.parseTime(String(h.time_pref)) || String(h.time_pref).toLowerCase();
  if (h.date) { try { parseYmd(h.date); } catch { h.date = null; } }
  h.language = h.language || s.lang;
  h.utterance = text;
  if (h.intent === 'QUERY' && !h.topics) h.topics = nlu.queryTopics(text);
  Object.assign(s.slots, { name: h.name || s.slots.name, phone: h.phone || s.slots.phone });
  s.intent = h.intent;
  return { reply, handoff: h };
}

async function process_(s, text, emit) {
  s.lastUtterance = text;
  if (lyzr.enabled(AGENT_ID())) {
    try {
      const r = await processLyzr(s, text);
      return { ...r, engine: 'lyzr' };
    } catch (e) {
      emit('Voice Agent', 'System', 'fallback', { reason: e.message.slice(0, 160), now: 'offline brain' });
    }
  }
  return { ...processLocal(s, text), engine: 'local' };
}

function resetTask(s) { s.intent = null; s.awaiting = null; s.slots = { name: s.slots.name, phone: s.slots.phone }; }

module.exports = { process: process_, resetTask };
