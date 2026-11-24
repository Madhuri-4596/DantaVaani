// Runs the demo conversations end-to-end in offline mode: `npm test`
const { handleTurn } = require('../src/orchestrator');
const clinic = require('../src/clinic');

const SCENARIOS = {
  'Hinglish booking': ['Hello, mujhe appointment book karna hai', 'Daant mein dard hai', 'kal', 'shaam ko', 'Mera naam Priya Sharma hai', '98765 43210'],
  'Emergency triage': ['Hello, mere daant mein bahut swelling hai aur bukhar bhi hai', '9123456780'],
  'English reschedule': ['Hi, I want to reschedule my appointment', 'It is 9876543210', 'Friday', 'morning please'],
  'Query + cancel': ['What are your timings and how much is a cleaning?', 'Please cancel my appointment', '9988776655'],
  'Sunday + full slot choice': ['I need a cleaning on Sunday', 'monday', '10 am', 'my name is Arjun', '9000012345', 'second one'],
};

(async () => {
  for (const [name, lines] of Object.entries(SCENARIOS)) {
    console.log(`\n=== ${name} ===`);
    const sid = name.replace(/\s/g, '-');
    for (const l of lines) {
      const r = await handleTurn(sid, l);
      console.log(`👤 ${l}\n🤖 ${r.reply}`);
      const flow = r.events.filter((e) => !['utterance', 'reply'].includes(e.type)).map((e) => `${e.from}→${e.to}:${e.type}${e.payload.tool ? '(' + e.payload.tool + ')' : ''}`);
      if (flow.length) console.log('   ' + flow.join(' | '));
    }
  }
  const st = clinic.state();
  console.log(`\nAppointments: ${st.appointments.length}, alerts: ${st.alerts.length}`);
})();
