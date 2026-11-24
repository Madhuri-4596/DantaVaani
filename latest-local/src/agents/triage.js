// TRIAGE AGENT — reviews every booking/emergency hand-off and decides whether
// the simulated dashboard should show a review request. Never diagnoses or prescribes.
const { has } = require('../nlu');


const CRITICAL = ['saans', 'breathing', 'breathe', 'nigal', 'swallow', 'eye', 'aankh', 'neck', 'gardan', 'accident', 'unconscious', 'behosh', "won't stop", 'ruk nahi', 'not stopping'];
const URGENT = ['swelling', 'swollen', 'sujan', 'soojan', 'sooja', 'suja', 'bleeding', 'khoon', 'blood', 'severe', 'unbearable', 'bahut dard', 'bohot dard',
  'bahut zyada dard', 'bahut tez dard', 'broken', 'toot', 'tut gaya', 'tuta', 'fever', 'bukhar', 'pus', "can't open", 'cannot open', 'muh nahi khul', 'सूजन', 'खून', 'बहुत दर्द', 'बुखार'];

function assessLocal(handoff, transcript) {
  const text = transcript.filter(t => t.role === 'caller').map((t) => t.text).join(' ').toLowerCase();
  const symptoms = URGENT.filter((k) => text.includes(k));
  let severity = 'routine';
  if (has(text, CRITICAL) || (symptoms.some((k) => /swell|sujan|soojan|sooj|suj|सूजन/.test(k)) && symptoms.some((k) => /fever|bukhar|बुखार/.test(k)))) severity = 'critical';
  else if (symptoms.length) severity = 'urgent';
  const escalate = severity !== 'routine';
  return {
    escalate, severity,
    symptoms,
    summary_for_doctor: escalate
      ? 'Test example flagged for a simulated review. No clinical advice, notification or call was provided.'
      : null,
    advice_for_caller: null,
  };
}

async function assess(s, handoff) {
  return {...assessLocal(handoff,s.transcript),engine:'local'};
}

module.exports = { assess };
