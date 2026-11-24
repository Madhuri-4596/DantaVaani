// DantaVaani — multi-agent voice receptionist for Indian dental clinics.
const fs = require('fs');
const path = require('path');

// tiny .env loader (no extra dependency)
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const express = require('express');
const clinic = require('./src/clinic');
const { handleTurn, feed, sessions } = require('./src/orchestrator');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function mode() {
  const key = Boolean(process.env.LYZR_API_KEY);
  return {
    voice: key && process.env.LYZR_VOICE_AGENT_ID ? 'lyzr' : 'offline',
    triage: key && process.env.LYZR_TRIAGE_AGENT_ID ? 'lyzr' : 'offline',
    action: 'skills',
    band: Boolean(process.env.BAND_WEBHOOK_URL),
  };
}

app.post('/api/chat', async (req, res) => {
  const { sessionId, text } = req.body || {};
  if (!sessionId || !text || !String(text).trim()) return res.status(400).json({ error: 'sessionId and text required' });
  try {
    res.json(await handleTurn(String(sessionId), String(text).trim()));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message, reply: 'Sorry, ek technical problem aa gayi. Please try again.' });
  }
});

app.get('/api/state', (req, res) => res.json({ ...clinic.state(), mode: mode(), feed: feed.slice(-60) }));

app.post('/api/reset', (req, res) => { clinic.seed(); sessions.clear(); feed.length = 0; res.json({ ok: true }); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  const m = mode();
  console.log(`\n🦷 DantaVaani running → http://localhost:${PORT}`);
  console.log(`   Voice Agent: ${m.voice} | Triage Agent: ${m.triage} | Action Agent: ${m.action} | BAND mirror: ${m.band ? 'on' : 'off'}\n`);
});
