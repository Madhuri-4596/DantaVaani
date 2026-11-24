# DantaVaani

[Try the live demo](https://dantavaani.vercel.app/) · Diwali Festiverse Agent-to-Agent Hackathon

## Inspiration

I build software for dental clinics, and the phone doesn't stop ringing just because the dentist is with a patient. Small clinics can't always have someone at the desk, and callers don't always stick to one language. “Kal shaam ka appointment mil sakta hai?” is exactly the kind of request a receptionist should be able to understand.

## What it does

DantaVaani shows what happens after the receptionist hears a request. **Voice** identifies the request, **Triage** identifies where it should go, and **Action** reports what the system can actually do. You can follow each handoff on screen. The public demo has no clinic connected, so it doesn't book appointments, send callbacks, show prices, or assess symptoms.

## How I built it

The live three-panel demo is built from [`hosted-demo/`](hosted-demo/). Its Node.js and Express backend runs fixed examples through the Voice, Triage and Action roles with an isolated test calendar. It plays recorded voices and can use browser speech recognition for allowed commands. It does not send caller audio or transcripts to the app. Live Lyzr is not part of this public build. The root files are the earlier static walkthrough.

## Challenges and lessons

“4 baje” doesn't tell you whether the caller means morning or afternoon. A receptionist would ask instead of guessing. The same principle applies to booking: understanding what someone wants isn't the same as doing it. The agent shouldn't confirm an action until the system confirms it.

## Try it locally

Run `cd hosted-demo`, `npm ci --ignore-scripts`, and `npm start`. Open [localhost:3000](http://localhost:3000), choose **Call DantaVaani**, then **Unmute mic** once. Give a made-up name or say “Skip,” then ask for an appointment in your own words. The mic reopens after each reply. Say “End call” or tap **End call** to hang up. Sample buttons also work without a mic. Never share real patient details. See the [voice command guide](hosted-demo/#try-the-hands-free-browser-call).

## What's next

Connect one clinic's phone line and calendar, test English, Hindi, and Hinglish calls end to end, and have staff review how requests are handed off before piloting.
