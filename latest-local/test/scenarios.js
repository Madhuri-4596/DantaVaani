// Runs the demo conversations end-to-end in offline mode: `npm test`
const assert = require('node:assert/strict');
process.env.TZ = 'Asia/Kolkata';
const NativeDate = Date;
global.Date = class extends NativeDate {
  constructor(...args) { super(...(args.length ? args : ['2026-11-24T10:00:00+05:30'])); }
  static now() { return new NativeDate('2026-11-24T10:00:00+05:30').valueOf(); }
};
const { handleTurn, sessions } = require('../src/orchestrator');
const clinic = require('../src/clinic');

const SCENARIOS = {
  'Hinglish booking': ['Hello, mujhe appointment book karna hai', 'Daant mein dard hai', 'kal', 'shaam ko', 'Mera naam Demo Caller hai', 'demo contact A'],
  'Emergency triage': ['Hello, mere daant mein bahut swelling hai aur bukhar bhi hai', 'demo contact B'],
  'English reschedule': ['Hi, I want to reschedule my appointment', 'It is demo contact A', 'Friday', 'morning please'],
  'Query + cancel': ['What are your timings and how much is a cleaning?', 'Please cancel my appointment', 'demo contact C'],
  'Sunday + full slot choice': ['I need a cleaning on Sunday', 'monday', '1 pm', 'my name is Demo Caller D', 'demo contact D', 'second one'],
};

(async () => {
  const results = {};
  for (const [name, lines] of Object.entries(SCENARIOS)) {
    console.log(`\n=== ${name} ===`);
    const sid = name.replace(/\s/g, '-');
    results[name] = [];
    for (const l of lines) {
      const r = await handleTurn(sid, l);
      results[name].push(r);
      console.log(`👤 ${l}\n🤖 ${r.reply}`);
      const flow = r.events.filter((e) => !['utterance', 'reply'].includes(e.type)).map((e) => `${e.from}→${e.to}:${e.type}${e.payload.tool ? '(' + e.payload.tool + ')' : ''}`);
      if (flow.length) console.log('   ' + flow.join(' | '));
    }
  }
  const st = clinic.state();
  const event = (r, tool) => r.events.find(e => e.payload?.tool === tool);
  const booking = results['Hinglish booking'].at(-1);
  assert.ok(event(booking, 'book_appointment'));
  assert.match(booking.reply, /SMS nahi bheja gaya/);
  const emergencies = results['Emergency triage'];
  assert.equal(event(emergencies[0], 'escalate_to_doctor').payload.result.severity, 'critical');
  assert.match(emergencies[0].reply, /contact nahi kiya gaya/);
  assert.ok(event(emergencies[1], 'update_alert'));
  assert.equal(st.alerts[0].status, 'demo_callback_recorded');
  assert.equal(st.alerts[0].phone, 'demo-contact-b');
  assert.equal(event(results['English reschedule'].at(-1), 'reschedule_appointment').payload.result.appointment.date, '2026-11-27');
  const cancelQuery = results['Query + cancel'];
  assert.match(cancelQuery[0].reply, /No real clinic price list/);
  assert.match(cancelQuery[0].reply, /Sundays are excluded/);
  assert.equal(event(cancelQuery.at(-1), 'cancel_appointment').payload.result.appointment.status, 'cancelled');
  const sunday = results['Sunday + full slot choice'];
  assert.match(sunday[0].reply, /closed on Sundays/i);
  assert.equal(event(sunday.at(-2), 'book_appointment'), undefined);
  const options = event(sunday.at(-2), 'nearest_alternatives').payload.result;
  assert.ok(options.length >= 2);
  assert.equal(event(sunday.at(-1), 'book_appointment').payload.result.slotId, options[1].id);
  for (const locale of ['hi-IN','kn-IN','ta-IN','te-IN','mr-IN','bn-IN']) {
    const id='lang-'+locale;
    const result=await handleTurn(id,'What are your timings?',locale);
    assert.equal(sessions.get(id).langHint,locale);
    assert.match(result.reply,/Practice calendar only/);
  }
  await handleTurn('bad-lang','What are your timings?','xx-unlisted');
  assert.equal(sessions.get('bad-lang').langHint,undefined);
  console.log('5 offline scenario checks and 7 locale cases passed.');
  console.log(`\nAppointments: ${st.appointments.length}, alerts: ${st.alerts.length}`);
})().catch(error => { console.error(error); process.exitCode = 1; });
