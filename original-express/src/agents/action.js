// ACTION AGENT — takes the hand-off and gets the job done with clinic skills
// (check_slots, book_appointment, find/cancel/reschedule, escalate_to_doctor, clinic_info).
const { tools, CLINIC, ymd } = require('../clinic');
const { fmtTime, fmtDate } = require('../nlu');

function makeCaller(emit) {
  return (name, args) => {
    const result = tools[name](args);
    emit('Action Agent', 'Clinic System', 'tool_call', { tool: name, args, result });
    return result;
  };
}

const L = (lang, en, hi) => (lang === 'en' ? en : hi);
const when = (slot, lang) => `${fmtDate(slot.date, lang)}, ${fmtTime(slot.time)}`;
const optionsText = (opts, lang) => opts.map((o, i) => `${i + 1}) ${when(o, lang)}`).join(', ');

function book(h, s, call) {
  const lang = h.language;
  const pref = h.time_pref === 'any' ? null : h.time_pref;
  const slots = call('check_slots', { date: h.date, time_pref: pref });
  if (slots.length) {
    const appt = call('book_appointment', { name: h.name, phone: h.phone, slot_id: slots[0].id, reason: h.reason });
    if (!appt.error) {
      return {
        status: 'success', details: appt,
        message_for_caller: L(lang,
          `Done! ${appt.name}, your ${appt.reason.toLowerCase()} appointment is booked for ${when(appt, lang)}. You'll get an SMS confirmation on ${appt.phone}.`,
          `Ho gaya! ${appt.name} ji, aapka appointment ${when(appt, lang)} ko book hai. Confirmation SMS ${appt.phone} par aa jayega.`),
      };
    }
  }
  const alts = call('nearest_alternatives', { date: h.date, time_pref: pref });
  s.pendingOptions = alts; s.pendingHandoff = h;
  return {
    status: 'needs_choice', details: { alternatives: alts },
    message_for_caller: L(lang,
      `That time is full. The nearest free slots are: ${optionsText(alts, lang)}. Which one should I book?`,
      `Woh time full hai. Sabse nazdeeki slots hain: ${optionsText(alts, lang)}. Kaunsa book karoon?`),
  };
}

function bookChosen(s, slot, call) {
  const h = s.pendingHandoff; const lang = h.language;
  s.pendingOptions = null; s.pendingHandoff = null;
  if (h.intent === 'RESCHEDULE') {
    const r = call('reschedule_appointment', { appointment_id: h.appointment_id, new_slot_id: slot.id });
    return { status: r.error ? 'failed' : 'success', details: r, message_for_caller: L(lang, `Rescheduled! You're now booked for ${when(slot, lang)}.`, `Reschedule ho gaya! Ab aapka appointment ${when(slot, lang)} ko hai.`) };
  }
  const appt = call('book_appointment', { name: h.name, phone: h.phone, slot_id: slot.id, reason: h.reason });
  if (appt.error) return { status: 'failed', details: appt, message_for_caller: L(lang, 'Sorry, that slot just got taken. Shall I find another?', 'Sorry, woh slot abhi abhi book ho gaya. Doosra dhoondhoon?') };
  return { status: 'success', details: appt, message_for_caller: L(lang, `Done! Booked for ${when(appt, lang)}. SMS confirmation is on its way to ${appt.phone}.`, `Ho gaya! ${when(appt, lang)} ko book kar diya. SMS confirmation ${appt.phone} par aa raha hai.`) };
}

function reschedule(h, s, call) {
  const lang = h.language;
  const [appt] = call('find_appointments', { phone: h.phone });
  if (!appt) return { status: 'failed', details: {}, message_for_caller: L(lang, `I couldn't find an upcoming appointment for ${h.phone}. Would you like to book a new one?`, `${h.phone} par koi upcoming appointment nahi mila. Naya book kar doon?`) };
  const pref = h.time_pref === 'any' ? null : h.time_pref;
  const slots = call('check_slots', { date: h.date, time_pref: pref });
  if (slots.length) {
    const r = call('reschedule_appointment', { appointment_id: appt.id, new_slot_id: slots[0].id });
    if (!r.error) return { status: 'success', details: r, message_for_caller: L(lang, `Done, ${appt.name}! I've moved your appointment from ${when(r.from, lang)} to ${when(r.appointment, lang)}.`, `Ho gaya ${appt.name} ji! Aapka appointment ${when(r.from, lang)} se ${when(r.appointment, lang)} par shift kar diya.`) };
  }
  const alts = call('nearest_alternatives', { date: h.date, time_pref: pref });
  s.pendingOptions = alts; s.pendingHandoff = { ...h, appointment_id: appt.id };
  return { status: 'needs_choice', details: { alternatives: alts }, message_for_caller: L(lang, `That time is full. Nearest options: ${optionsText(alts, lang)}. Which one?`, `Woh time full hai. Options hain: ${optionsText(alts, lang)}. Kaunsa chahiye?`) };
}

function cancel(h, s, call) {
  const lang = h.language;
  const [appt] = call('find_appointments', { phone: h.phone });
  if (!appt) return { status: 'failed', details: {}, message_for_caller: L(lang, `I couldn't find an upcoming appointment for ${h.phone}.`, `${h.phone} par koi upcoming appointment nahi mila.`) };
  const r = call('cancel_appointment', { appointment_id: appt.id });
  return { status: 'success', details: r, message_for_caller: L(lang, `Your appointment for ${when(appt, lang)} is cancelled. Call us anytime to rebook.`, `${when(appt, lang)} wala appointment cancel ho gaya. Dobara book karna ho toh call kijiye.`) };
}

function query(h) {
  const lang = h.language; const topics = h.topics && h.topics.length ? h.topics : ['hours'];
  const parts = [];
  if (topics.includes('hours')) parts.push(L(lang, `We're open ${CLINIC.hours}`, `Clinic ${CLINIC.hoursHi}`));
  if (topics.includes('fees')) {
    const f = CLINIC.fees;
    parts.push(L(lang, `Consultation is ₹${f['Consultation']}, cleaning ₹${f['Cleaning']}, filling ₹${f['Filling']}, and root canal starts at ₹${f['Root canal']}.`,
      `Consultation ₹${f['Consultation']}, cleaning ₹${f['Cleaning']}, filling ₹${f['Filling']}, aur root canal ₹${f['Root canal']} se shuru.`));
  }
  if (topics.includes('address')) parts.push(L(lang, `We're at ${CLINIC.address}.`, `Hum ${CLINIC.address} par hain.`));
  parts.push(L(lang, 'Would you like to book an appointment?', 'Appointment book karoon?'));
  return { status: 'success', details: { topics }, message_for_caller: parts.join(' ') };
}

function emergency(h, s, triage, call) {
  const lang = h.language;
  const alert = call('escalate_to_doctor', { summary: triage.summary_for_doctor || `Emergency reported: "${h.utterance}"`, phone: h.phone, name: h.name, severity: triage.severity || 'urgent' });
  let msg = triage.advice_for_caller || L(lang, `I'm alerting ${CLINIC.doctorOnDuty} right now.`, `Main abhi ${CLINIC.doctorOnDuty} ko alert kar rahi hoon.`);
  let held = null;
  if (h.phone) held = holdEarliest(h, call);
  else { s.awaitingEmergencyPhone = alert.id; msg += ' ' + L(lang, 'Please tell me your mobile number so the doctor can call you back.', 'Doctor aapko call kar sakein, iske liye apna mobile number bataiye.'); }
  if (held) msg += ' ' + L(lang, `I've also held the earliest slot for you: ${when(held, lang)}.`, `Maine aapke liye sabse pehla slot bhi hold kar diya hai: ${when(held, lang)}.`);
  return { status: 'escalated', details: { alert, held }, message_for_caller: msg.trim() };
}

function holdEarliest(h, call) {
  const [slot] = call('nearest_alternatives', { date: ymd(new Date()), count: 1 });
  if (!slot) return null;
  const appt = call('book_appointment', { name: h.name || 'Emergency caller', phone: h.phone, slot_id: slot.id, reason: 'EMERGENCY', status: 'emergency-hold' });
  return appt.error ? null : appt;
}

function emergencyPhone(s, phone, lang, call) {
  const alertId = s.awaitingEmergencyPhone; s.awaitingEmergencyPhone = null;
  call('update_alert', { alert_id: alertId, phone, name: s.slots.name });
  const held = holdEarliest({ name: s.slots.name, phone }, call);
  return {
    status: 'escalated', details: { alertId, held },
    message_for_caller: L(lang, `Thank you. ${CLINIC.doctorOnDuty} will call you on ${phone} shortly.${held ? ` I've held the earliest slot for you: ${when(held, lang)}.` : ''}`,
      `Dhanyavaad. ${CLINIC.doctorOnDuty} aapko ${phone} par jaldi call karengi.${held ? ` Aapke liye sabse pehla slot hold hai: ${when(held, lang)}.` : ''}`),
  };
}

function execute(s, h, triage, emit) {
  const call = makeCaller(emit);
  if (triage && triage.escalate) return emergency({ ...h, intent: 'EMERGENCY' }, s, triage, call);
  switch (h.intent) {
    case 'BOOK': return book(h, s, call);
    case 'RESCHEDULE': return reschedule(h, s, call);
    case 'CANCEL': return cancel(h, s, call);
    case 'QUERY': return query(h);
    case 'EMERGENCY': return emergency(h, s, triage || { severity: 'urgent' }, call);
    default: return { status: 'failed', details: {}, message_for_caller: L(h.language, 'Sorry, could you say that again?', 'Sorry, ek baar phir se bataiye?') };
  }
}

module.exports = { execute, bookChosen, emergencyPhone, makeCaller };
