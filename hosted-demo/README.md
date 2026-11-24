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
