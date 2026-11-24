// ORCHESTRATOR — routes each caller turn through the agents:
//   Caller → Voice Agent → (HANDOFF) → Triage Agent → Action Agent → Voice Agent → Caller
// Every agent-to-agent message is emitted as an event (shown live in the UI and
// discarded when the local demo is reset).
const voice = require('./agents/voice');
const triage = require('./agents/triage');
const action = require('./agents/action');
const nlu = require('./nlu');

const sessions = new Map();
const feed = []; // global event feed for the dashboard

function getSession(id) {
  if (!sessions.has(id)) sessions.set(id, { id, lang: 'en', intent: null, awaiting: null, slots: {}, transcript: [], pendingOptions: null, awaitingEmergencyPhone: null });
  return sessions.get(id);
}

const HINTS = new Set(['en-IN','hi-IN','kn-IN','ta-IN','te-IN','mr-IN','bn-IN']);
async function handleTurn(sessionId, text, langHint) {
  const s = getSession(sessionId);
  if(HINTS.has(langHint))s.langHint=langHint;
  const events = [];
  const emit = (from, to, type, payload, engine) => {
    const evt = { id: feed.length + 1, at: new Date().toISOString(), sessionId, from, to, type, payload, engine };
    events.push(evt); feed.push(evt); if (feed.length > 500) feed.shift();
  };
  const finish = (reply, lang) => {
    s.transcript.push({ role: 'agent', text: reply });
    emit('Voice Agent', 'Caller', 'reply', { text: reply });
    return { reply, lang, events };
  };

  s.transcript.push({ role: 'caller', text });
  emit('Caller', 'Voice Agent', 'utterance', { text });
  s.lang = nlu.detectLang(text, s.lang);

  // Follow-ups the Action Agent is waiting for (handled directly, no LLM round-trip)
  if (s.awaitingEmergencyPhone) {
    const phone = nlu.parsePhone(text);
    if (phone) {
      s.slots.phone = phone;
      emit('Voice Agent', 'Action Agent', 'handoff', { intent: 'EMERGENCY_CALLBACK_NUMBER', phone });
      const r = action.emergencyPhone(s, phone, s.lang, action.makeCaller(emit));
      emit('Action Agent', 'Voice Agent', 'result', r, 'skills');
      voice.resetTask(s);
      return finish(r.message_for_caller, s.lang);
    }
  }
  if (s.pendingOptions && s.pendingOptions.length) {
    const choice = nlu.parseChoice(text, s.pendingOptions);
    if (choice) {
      emit('Voice Agent', 'Action Agent', 'handoff', { intent: 'CHOOSE_SLOT', slot: choice.id });
      const r = action.bookChosen(s, choice, action.makeCaller(emit));
      emit('Action Agent', 'Voice Agent', 'result', r, 'skills');
      voice.resetTask(s);
      return finish(r.message_for_caller, s.lang);
    }
    s.pendingOptions = null;
  }

  // 1. Voice Agent
  const v = await voice.process(s, text, emit);
  if (!v.handoff) return finish(v.reply, s.lang);
  emit('Voice Agent', 'Triage Agent', 'handoff', v.handoff, v.engine);

  // 2. Triage Agent (safety gate for bookings & emergencies)
  let t = null;
  if (['BOOK', 'RESCHEDULE', 'EMERGENCY'].includes(v.handoff.intent)) {
    t = await triage.assess(s, v.handoff, emit);
    emit('Triage Agent', t.escalate ? 'Action Agent ⚠ ESCALATE' : 'Action Agent', 'triage', t, t.engine);
  } else {
    emit('Triage Agent', 'Action Agent', 'triage', { escalate: false, severity: 'n/a', note: `${v.handoff.intent} — no clinical risk, passed through` }, 'rules');
  }

  // 3. Action Agent
  const a = action.execute(s, v.handoff, t, emit);
  emit('Action Agent', 'Voice Agent', 'result', a, 'skills');
  if (a.status !== 'needs_choice' && !s.awaitingEmergencyPhone) voice.resetTask(s);

  const reply = [v.reply, a.message_for_caller].filter(Boolean).join(' ');
  return finish(reply, v.handoff.language || s.lang);
}

module.exports = { handleTurn, feed, sessions };
