# DantaVaani • Local browser demo
This version preserves the call screen from the supplied project. It runs a simulated workflow on a private loopback server. It cannot call or message anyone, give medical advice, or interact with a real clinic. Do not enter a real name, email, phone number, or health details. For a practice booking use “Demo Caller” and “demo contact A”. No provider credentials, dependency install, or phone line are needed.

Run npm start, then open http://127.0.0.1:4177 in Chrome or Edge. Use npm test to verify the local scenarios.

Use the “Play agent dialogue” examples for three distinct, prerecorded demo roles. The hands-free “Browser call” uses your browser’s speech recognition and speech synthesis, so browser permissions and available voices matter. The browser’s recognizer may send audio to its own speech provider. Voice errors are reported in the call screen; the typed sample commands and recorded clips are alternatives.

No public deploy. The Vercel adapter is intentionally unavailable for this non-authenticated local sandbox. The former Twilio route was an unsigned prototype, not a configured telephone service. THIRD_PARTY_NOTICES.txt describes bundled example audio.

### Language changes from dantavaani.1.zip
The latest upload adds seven microphone options covering eight conversation modes (English and Hinglish share en-IN), language hints, and script-aware browser speech voice selection. This copy retains all selector options, accepts only listed hints, and uses a matching browser voice if the response contains Kannada, Tamil, Telugu, Bengali or Devanagari. The offline conversation rules remain English and Hindi/Hinglish. It does not call a remote translation model. Three prerecorded, English-language examples are included as a playback fallback.
