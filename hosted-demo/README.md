# DantaVaani isolated workflow demo

This is a sandbox, not a clinic service. The original Voice → Triage → Action workflow runs on the server for a few fixed examples. Users never send caller text, audio or personal details to the app. Microphone recognition can be processed by the browser's speech provider, so do not disclose personal information. No real clinical action or medical guidance is provided. The three voices are recorded examples, not generated live.

Each run uses a fresh worker and discards its records, then returns only allowlisted events and counts for that run. There is no public state or reset endpoint. No environment credentials or external integrations are needed.

```sh
npm ci --ignore-scripts
npm start           # Express, listens on PORT or 3000
npm test            # isolation, redaction and worker outcomes
```

Render: use the included blueprint or equivalent commands; /healthz returns an availability check. The exported Express app can also be detected by Vercel; confirm Worker file tracing and runtime support before claiming that deployment works. Serve the whole project, not public/ alone. The endpoint accepts an empty POST to /api/demo/booking, /api/demo/emergency, or /api/demo/query.

Generated Flite audio and Lucide SVGs are covered in public/THIRD_PARTY_NOTICES.txt.

### Optional ElevenLabs booking audio
The app always includes offline recordings. To create three alternate booking recordings at build time only, set `DANTAVAANI_GENERATE_ELEVENLABS=true` and provision `ELEVENLABS_API_KEY` as a secure build secret, then run `npm run build` before publishing. This uses credits for three fixed sample clips. It never submits caller input and adds no runtime API. Successful builds emit a manifest that labels actual recording provenance; generated MP3s contain only the sample dialogue. If configuration or generation is unavailable, playback uses the bundled offline audio. Urgent callback and fees are offline recordings. Never pass an API key to browser code or commit it.

### Public data boundary
The public workflow endpoint accepts only an empty POST selecting one of three predefined identifiers: booking, emergency (practice review only), or query. It returns the scenario key, simple allowlisted hand-off/status metadata, non-identifying result copy and two aggregate counts for that run. It does not return caller text, contact details, IDs, clinic hours, fees, appointments, session data or a shared feed. No remote text model, telephone webhook or clinic integration is included. Optional build-time synthesis sends only the three reviewed synthetic booking lines, predefined voice IDs, and model configuration to ElevenLabs with a build secret in its authorization header.

### Full-screen browser call
Select Start browser call to open the full-screen conversation. The microphone remains off until you turn it on. Choose a listed example or say an allowed short command, then confirm before any sandbox request is made. End call or Escape stops playback and clears this run’s result from the screen. Locale selection sets browser recognition only; replies are recorded in English. DantaVaani sends no raw voice transcript, and the sandbox confirmation sends a bodyless POST with only the example identifier. To test without microphone permission, use the in-call sample buttons.

### Private live Lyzr handoff for recording

The opt-in recording page is separate from the public sandbox. It sends one fictional, administrative callback request and accepts only two routing outcomes so it never displays raw agent output. It cannot accept arbitrary prompts, patient details, or take real actions.

1. In Lyzr Studio, use a demo agent with no external action tools and no patient data. Instruct it to classify fictional scheduling callback requests and return only `CALLBACK_NOTE_READY` or `REVIEW_REQUIRED`.
2. Set `LYZR_API_KEY`, `LYZR_CALLBACK_AGENT_ID`, and the Lyzr workspace's `LYZR_DEMO_USER_ID` in a private local environment. Do not commit the key or put it in the browser.
3. Run `DANTAVAANI_LYZR_DEMO=1 npm run dev`, then open `http://127.0.0.1:4180/lyzr`. Click **Run live Lyzr handoff**. Only a successful recognized provider response counts as live.
4. `npm test` runs without any provider credentials. The Express production entry point does not expose the recording-only page or API.

### On a protected Vercel preview

The same page is available at `/lyzr` in Vercel Preview only. Production returns 404 for the page and its route. Keep Vercel deployment protection enabled. Set the three Lyzr settings above as server-side Preview settings. Also set `DANTAVAANI_PREVIEW_TOKEN` to a distinct, randomly generated secret of at least 24 characters, scoped to the preview branch; enter that access code on the page. Do not use a Lyzr API key as the access code. With missing credentials the route returns 503 without contacting Lyzr.
