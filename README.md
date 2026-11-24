# DantaVaani

[Try the live demo](https://dantavaani.vercel.app/) · Diwali Festiverse Agent-to-Agent Hackathon

## Inspiration

I build software for dental clinics, and the phone doesn't stop ringing just because the dentist is with a patient. Small clinics can't always have someone at the desk, and callers don't always stick to one language. “Kal shaam ka appointment mil sakta hai?” is exactly the kind of request a receptionist should be able to understand.

## What it does

DantaVaani shows what happens after the receptionist hears a request. **Voice** identifies the request, **Triage** identifies where it should go, and **Action** reports what the system can actually do. You can follow each handoff on screen. The public demo has no clinic connected, so it doesn't book appointments, send callbacks, show prices, or assess symptoms.

## How I built it

This repo contains the public walkthrough: HTML, CSS, and JavaScript, deployed on Vercel. It uses the browser's Web Speech API on supported browsers, with example buttons as a fallback. The separate local prototype uses Node.js and Express to pass structured messages between roles and test scheduling against a test calendar. Live Lyzr integration has not been verified and is not part of this public build.

## Challenges and lessons

“4 baje” doesn't tell you whether the caller means morning or afternoon. A receptionist would ask instead of guessing. The same principle applies to booking: understanding what someone wants isn't the same as doing it. The agent shouldn't confirm an action until the system confirms it.

## Try it locally

From this folder, run `python -m http.server 8000` and open `http://localhost:8000`. Click **Book a visit**, **Urgent callback**, or **Check fees** to see the handoff without microphone access. If trying the mic, use example requests only, never real patient details.

## What's next

Connect one clinic's phone line and calendar, test English, Hindi, and Hinglish calls end to end, and have staff review how requests are handed off before piloting.
