// Minimal client for Lyzr Agent Studio inference (v3 chat endpoint).
const LYZR_URL = process.env.LYZR_API_URL || 'https://agent-prod.studio.lyzr.ai/v3/inference/chat/';

function enabled(agentId) { return Boolean(process.env.LYZR_API_KEY && agentId); }

async function chat(agentId, sessionId, message, timeoutMs = 25000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(LYZR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.LYZR_API_KEY },
      body: JSON.stringify({
        user_id: process.env.LYZR_USER_ID || 'dantavaani-demo',
        agent_id: agentId,
        session_id: `${agentId}-${sessionId}`,
        message,
      }),
      signal: ctrl.signal,
    });
    const body = await res.text();
    if (!res.ok) throw new Error(`Lyzr HTTP ${res.status}: ${body.slice(0, 200)}`);
    let data; try { data = JSON.parse(body); } catch { return body; }
    return typeof data.response === 'string' ? data.response : JSON.stringify(data.response ?? data);
  } finally { clearTimeout(timer); }
}

// Pull the first {...} JSON object out of an LLM reply.
function extractJson(text) {
  if (!text) return null;
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') { depth--; if (depth === 0) { try { return JSON.parse(text.slice(start, i + 1)); } catch { return null; } } }
  }
  return null;
}

module.exports = { chat, enabled, extractJson };
