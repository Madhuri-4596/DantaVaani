# 🪔 DantaVaani: a Hinglish voice receptionist for Indian dental clinics

**Track:** 🎙️ Voice — Listen & Act · Diwali Festiverse Agent-to-Agent Hackathon (India Edition)

Small clinics in India miss calls during procedures, at lunch and after hours. Patients call in Hindi, English or a mix of both, and they hang up if nobody answers.
**DantaVaani answers every call.** It books, reschedules and cancels appointments, answers questions about fees and timings, and, most importantly, **spots dental emergencies and alerts the on-duty dentist immediately**.

## How the agents work together

```
 Caller (voice)
     │  speech-to-text (browser, en-IN / hi-IN)
     ▼
┌──────────────┐  HANDOFF JSON   ┌──────────────┐  verdict   ┌──────────────┐  skills   ┌───────────────┐
│ Voice Agent  │ ──────────────▶ │ Triage Agent │ ─────────▶ │ Action Agent │ ────────▶ │ Clinic system │
│ (Lyzr)       │                 │ (Lyzr)       │            │ (skills)     │ ◀──────── │ slots / appts │
│ intent +     │ ◀────────────────────────────────────────── │ book/cancel/ │           │ doctor alerts │
│ slot filling │        result + message_for_caller          │ escalate     │           └───────────────┘
└──────────────┘                                             └──────────────┘
     │  text-to-speech reply in the caller's language
     ▼
 Caller hears the answer          (every arrow is logged live and can be mirrored to BAND)
```

| Agent | Role | Built with |
|---|---|---|
| **Voice Agent** | Understands English, Hindi and Hinglish; detects intent (book / reschedule / cancel / query / emergency); collects one missing detail at a time; emits a structured `HANDOFF` | Lyzr agent (offline rule-based fallback) |
| **Triage Agent** | Safety gate. Reviews every booking hand-off and the transcript, scores severity (routine / urgent / critical), and writes a doctor summary plus safe advice for the caller. Never diagnoses or names medicines | Lyzr agent (offline rule-based fallback) |
| **Action Agent** | Does the work through deterministic clinic skills (`check_slots`, `book_appointment`, `reschedule_appointment`, `cancel_appointment`, `escalate_to_doctor`, …), so slots and bookings are never invented | Skill functions (can be registered as Finch skills / Lyzr tools) |

**Why this design:** LLMs handle the conversation and the judgement calls, and deterministic skills handle anything that touches the calendar. The Triage Agent sits between them, so a booking can never hide an emergency.

## Features
- 🎙️ Real voice in and out in the browser (Chrome or Edge), with Hinglish support
- 🚨 Emergency triage: swelling with fever is marked **critical**, the doctor is alerted with a summary, the caller gets safe advice, and the earliest slot is held
- 📅 Booking, rescheduling and cancelling, including Sunday-closed handling and "slot full → 3 nearest options → *'doosra wala'*"
- 💬 Answers fee, timing and address questions
- 🤝 Live **agent-to-agent hand-off log** showing every message, verdict and tool call
- 🛟 Works offline: if Lyzr is down, each agent falls back to its rule-based brain and the demo keeps running

## Run it

```bash
npm install
npm start            # → http://localhost:3000
npm test             # runs 5 demo conversations in the terminal
```
Open it in **Chrome** and click 🎙️, or use the ▶ demo buttons.
To use Lyzr, see **[LYZR_SETUP.md](LYZR_SETUP.md)**: create two agents, put the keys in `.env` and restart.

## Demo script (90 s)
1. **▶ Hinglish booking:** "mujhe appointment book karna hai… daant mein dard… kal shaam…" The booking appears on the clinic dashboard.
2. **▶ Emergency:** "mere daant mein bahut swelling hai aur bukhar bhi hai." The Triage Agent escalates it as **CRITICAL**, a red alert appears for the doctor, and the caller gets safe advice.
3. **▶ Reschedule** in English, to show the same agents switching language.
4. Point to the hand-off log: three agents, structured messages and tool calls, all visible.

## Project structure
```
server.js              Express server + API
src/orchestrator.js    Routes each turn: Voice → Triage → Action → Voice; emits hand-off events (+ BAND mirror)
src/agents/voice.js    Voice Agent (Lyzr + offline NLU fallback)
src/agents/triage.js   Triage Agent (Lyzr + offline rules)
src/agents/action.js   Action Agent (clinic skills)
src/clinic.js          Mock clinic backend: slots, appointments, doctor alerts
src/nlu.js             Hinglish date/time/name/phone/intent parsing
public/index.html      Call UI, agent log, clinic dashboard
```

## Roadmap
Phone-line calls (Exotel/Twilio), WhatsApp confirmations, Kannada/Tamil/Telugu, a real clinic PMS integration, and deployment on Agent37 sandboxes.

> Demo system with simulated clinic data. Triage routes urgent cases to a human dentist; it does not give medical advice.
