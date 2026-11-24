// TRIAGE AGENT — reviews every booking/emergency hand-off and decides whether
// the on-duty dentist must be alerted right now. Never diagnoses or prescribes.
const lyzr = require('../lyzr');
const { has } = require('../nlu');
const { CLINIC } = require('../clinic');

const AGENT_ID = () => process.env.LYZR_TRIAGE_AGENT_ID;

const CRITICAL = ['saans', 'breathing', 'breathe', 'nigal', 'swallow', 'eye', 'aankh', 'neck', 'gardan', 'accident', 'unconscious', 'behosh', "won't stop", 'ruk nahi', 'not stopping'];
const URGENT = ['swelling', 'swollen', 'sujan', 'soojan', 'sooja', 'suja', 'bleeding', 'khoon', 'blood', 'severe', 'unbearable', 'bahut dard', 'bohot dard',
  'bahut zyada dard', 'bahut tez dard', 'broken', 'toot', 'tut gaya', 'tuta', 'fever', 'bukhar', 'pus', "can't open", 'cannot open', 'muh nahi khul', 'सूजन', 'खून', 'बहुत दर्द', 'बुखार'];

function advice(lang, severity) {
  const doc = CLINIC.doctorOnDuty;
  if (lang === 'en') {
    return severity === 'critical'
      ? `I'm alerting ${doc} right now. If you have any difficulty breathing or swallowing, please go to the nearest hospital emergency immediately.`
      : `I'm alerting ${doc} right now and she will call you back shortly. Meanwhile, keep a cold compress on your cheek and avoid very hot or cold food.`;
  }
  return severity === 'critical'
    ? `Main abhi ${doc} ko alert kar rahi hoon. Agar saans lene ya nigalne mein dikkat ho, toh turant nazdeeki hospital emergency jaiye.`
    : `Main abhi ${doc} ko alert kar rahi hoon, woh aapko jaldi call karengi. Tab tak gaal par thanda sek lagaiye aur bahut garam ya thanda khana avoid kijiye.`;
}

function assessLocal(handoff, transcript) {
  const text = transcript.map((t) => t.text).join(' ').toLowerCase();
  const symptoms = URGENT.filter((k) => text.includes(k));
  let severity = 'routine';
  if (has(text, CRITICAL) || (symptoms.some((k) => /swell|sujan|soojan|sooj|suj|सूजन/.test(k)) && symptoms.some((k) => /fever|bukhar|बुखार/.test(k)))) severity = 'critical';
  else if (symptoms.length) severity = 'urgent';
  const escalate = severity !== 'routine';
  return {
    escalate, severity,
    symptoms,
    summary_for_doctor: escalate
      ? `${severity.toUpperCase()}: caller reports ${symptoms.join(', ') || 'acute dental problem'}. Patient: ${handoff.name || 'name pending'}, phone: ${handoff.phone || 'pending'}. Said: "${(handoff.utterance || '').slice(0, 120)}"`
      : null,
    advice_for_caller: escalate ? advice(handoff.language, severity) : null,
  };
}

async function assess(s, handoff, emit) {
  if (lyzr.enabled(AGENT_ID())) {
    try {
      const msg = `HANDOFF JSON:\n${JSON.stringify(handoff)}\n\nTRANSCRIPT:\n${s.transcript.map((t) => `${t.role}: ${t.text}`).join('\n')}`;
      const out = await lyzr.chat(AGENT_ID(), s.id + '-' + s.transcript.length, msg);
      const j = lyzr.extractJson(out);
      if (j && typeof j.escalate !== 'undefined') {
        j.escalate = j.escalate === true || j.escalate === 'true';
        j.severity = j.severity || (j.escalate ? 'urgent' : 'routine');
        if (j.escalate && !j.advice_for_caller) j.advice_for_caller = advice(handoff.language, j.severity);
        return { ...j, engine: 'lyzr' };
      }
      throw new Error('Triage agent did not return JSON');
    } catch (e) {
      emit('Triage Agent', 'System', 'fallback', { reason: e.message.slice(0, 160), now: 'offline rules' });
    }
  }
  return { ...assessLocal(handoff, s.transcript), engine: 'local' };
}

module.exports = { assess };
