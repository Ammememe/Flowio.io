# Live Slides: Phase Plan

Nov 12, 2026 · @Amir

## Overview

The MVP is Phases 0 to 4: a user builds a deck in the browser and presents it while the bullet they are talking about highlights by itself. Phase 5 adds the Claude connector, Phase 6 makes it safe on stage, and Phase 7 onward adds growth features one at a time.

&#91;embedded content: phase roadmap · 8 phases, MVP after Phase 4\]

How to read the plan:

- **Each phase** has a goal, an issue list and an exit test. Start the next phase only when the exit test passes.
- **Issue ids** such as P0-1 or P3-7 are meant to be copied into your tracker. Each is sized at roughly one to three days for one developer.
- **Parallel work:** Phase 5 depends only on Phase 3, so a second developer can build it alongside Phase 4.
- **Assumptions:** TypeScript everywhere, hosted on AWS, Swedish and English as first languages.

## AWS architecture

The browser does the real-time work, so AWS only has to store decks, hand out credentials and serve Claude. That keeps the backend serverless and cheap while usage is low.

&#91;embedded content: AWS architecture · 2 clients, 7 services\]

Audio goes straight from the browser to the transcription service and is never stored. Claude reaches the same deck logic as the web app, through a separate MCP entry point.

| Job | AWS service | Why | Alternative |
| --- | --- | --- | --- |
| Host the web app | S3 + CloudFront | Static files served close to the user | Amplify Hosting for simpler setup |
| API | API Gateway + Lambda | Pay per request, nothing to keep running | ECS Fargate if you later need long-lived connections |
| Deck storage | DynamoDB | Decks are documents; cheap and works well with Lambda | Aurora Serverless Postgres once teams and reporting arrive |
| Images | S3 with presigned uploads | Uploads skip the API, delivery goes through CloudFront | None needed |
| Sign-in | Cognito | Accounts for the app and the OAuth sign-in the Claude connector needs | Auth0 or Clerk: smoother to set up, one more vendor |
| Speech to text | Amazon Transcribe streaming | Stays inside AWS, one bill | Deepgram, if it wins the P0-8 comparison |
| MCP server | Lambda | Stateless tool calls fit the same model as the API | Fargate if you add streaming or sessions |
| Infrastructure as code | AWS CDK in TypeScript | Same language as the app | SST or Terraform |
| Deploys | GitHub Actions with OIDC | No AWS keys stored in GitHub | AWS CodePipeline |
| Logs and alarms | CloudWatch | Built in | Add Sentry for browser errors |
| Later: AI generation | Amazon Bedrock | Claude models without leaving AWS | Direct model API |
| Later: live audience sync | API Gateway WebSockets | Push slide state to phones | AppSync Events |

Use the Stockholm region (eu-north-1) if every service you pick is offered there; check Transcribe streaming for Swedish before committing.

## Phase 0: Spike

Goal: find out whether speech-following feels smooth or twitchy before building anything else. This code is throwaway and needs no AWS setup apart from the Transcribe test.

- [ ] **P0-1** Hardcode a 3-slide deck as JSON and render it as plain HTML
- [ ] **P0-2** Capture the microphone and show a live transcript with the browser Web Speech API
- [ ] **P0-3** Load a small embedding model in a Web Worker with Transformers.js and embed every bullet
- [ ] **P0-4** Matcher v0: score the last 5 seconds of transcript against the bullets on the current slide, combining embedding similarity with keyword overlap
- [ ] **P0-5** Stability rules: confidence threshold, minimum hold time, and do nothing when unsure
- [ ] **P0-6** One highlight animation: the active bullet scales up and the others dim
- [ ] **P0-7** Measure two numbers on a 5-minute test talk in Swedish and in English: delay from starting a point to the highlight, and wrong highlights per 10 bullets
- [ ] **P0-8** Compare transcription providers on delay and Swedish accuracy: Web Speech API, Amazon Transcribe streaming, Deepgram

**Exit test (proposed targets):** with 3 different speakers, the highlight lands within 1.5 seconds and is wrong at most once per 10 bullets. If it misses, rework the matcher before starting Phase 1.

## Phase 1: Foundation

Goal: a deployed skeleton on AWS and a deck format everything else builds on.

- [ ] **P1-1** Monorepo with pnpm workspaces: `web`, `api`, `mcp`, `shared`, `infra`
- [ ] **P1-2** Deck schema v1 in Zod, in `shared`: deck, slide, element (title, bullet, image), cues per element, theme id, schema version number
- [ ] **P1-3** AWS accounts: separate dev and prod, a billing alarm, single sign-on for the team
- [ ] **P1-4** Infrastructure as code with AWS CDK: S3 and CloudFront for the web app, API Gateway and Lambda for the API, a DynamoDB table, an S3 media bucket
- [ ] **P1-5** CI/CD with GitHub Actions: deploy to dev on merge, signing in to AWS through OIDC so no keys are stored
- [ ] **P1-6** End-to-end hello world: the web app calls the API, which saves and returns a deck that passes schema validation
- [ ] **P1-7** Logging and error tracking: CloudWatch for the API, an error reporter for the browser
- [ ] **P1-8** Domain and certificate with Route 53 and ACM

**Exit test:** a merge to main deploys web and API to the dev address, and a deck round-trips through the API unchanged.

## Phase 2: Renderer and themes

Goal: a deck presents well with manual control, in a static theme and an animated one.

- [ ] **P2-1** Slide renderer: deck JSON plus a theme becomes a 16:9 slide that scales to any screen
- [ ] **P2-2** Six layout templates: title, bullets, bullets with image, full image, quote, section break
- [ ] **P2-3** Theme system: tokens for colour, type, spacing and motion level
- [ ] **P2-4** Theme A, static: no motion beyond simple fades
- [ ] **P2-5** Theme B, animated, built with Motion: entrance, emphasis, exit and slide transitions
- [ ] **P2-6** Emphasis interface: the renderer accepts "active element id plus intensity from 0 to 1". This is the only thing the live engine will call
- [ ] **P2-7** Present mode: fullscreen, keyboard and clicker navigation
- [ ] **P2-8** Visual snapshot tests with Playwright so theme changes do not break layouts unnoticed

**Exit test:** the spike deck presents in both themes, and pressing a key triggers emphasis on any bullet.

## Phase 3: Editor, accounts and storage

Goal: a new user can sign up and build a deck in the browser.

- [ ] **P3-1** Sign-in with Amazon Cognito: email and Google, with the API checking the token on every request
- [ ] **P3-2** Deck API: create, list, get, update, delete, with owner-only access
- [ ] **P3-3** Dashboard: list, create, rename and delete decks
- [ ] **P3-4** Editor shell: slide list in a sidebar with add, duplicate, delete and drag to reorder
- [ ] **P3-5** Edit titles and bullets in place with Tiptap
- [ ] **P3-6** Layout picker and theme picker
- [ ] **P3-7** Image upload: presigned upload to S3, size and type limits, delivery through CloudFront
- [ ] **P3-8** Autosave with a version number so two tabs cannot overwrite each other, plus undo and redo
- [ ] **P3-9** Cue editor: optional "what I will say" phrases per bullet

**Exit test:** a new user signs up, builds a 5-slide deck with one image, reloads the page, and nothing is lost.

## Phase 4: Live engine (completes the MVP)

Goal: while presenting, the bullet being talked about highlights by itself.

- [ ] **P4-1** Production transcription with the provider chosen in P0-8: an API endpoint issues short-lived credentials and the browser streams audio directly to the provider
- [ ] **P4-2** Move the matcher from the spike into its own package, with tests that replay recorded transcripts
- [ ] **P4-3** Compute embeddings for bullets and cues when a deck loads, and cache the model in the browser
- [ ] **P4-4** Connect the matcher to the emphasis interface from P2-6
- [ ] **P4-5** Presenter controls: microphone on and off, following on and off, a visible listening state, and manual control always wins
- [ ] **P4-6** Microphone permission, device picker and a pre-talk sound check
- [ ] **P4-7** Failure behaviour: if transcription drops, fall back to manual control without any on-screen error, then reconnect
- [ ] **P4-8** Language setting per deck, Swedish and English first
- [ ] **P4-9** Usage metering: transcription minutes per user, for cost tracking and later pricing
- [ ] **P4-10** Privacy: audio is never stored, a clear consent text, a privacy policy, and data kept in an EU region
- [ ] **P4-11** Pilot with 5 to 10 real presenters and record the wrong-highlight rate

**Exit test:** a pilot user builds a deck and presents it to an audience with following switched on for the whole talk. This is the MVP.

## Phase 5: MCP server for Claude

Goal: a Claude user asks for a deck in chat and it appears in the app, ready to present.

- [ ] **P5-1** Sign-in spike: confirm Claude's custom connector can complete an OAuth sign-in against Cognito. Do this first, because it decides the auth design
- [ ] **P5-2** MCP server package with the official TypeScript SDK, using the Streamable HTTP transport, deployed as a Lambda behind a public HTTPS address
- [ ] **P5-3** Read tools: `list_themes`, `list_layouts`, `get_deck`, `list_decks`
- [ ] **P5-4** Write tools: `create_deck`, `add_slide`, `update_slide`, `delete_slide`, `reorder_slides`
- [ ] **P5-5** Tool inputs generated from the shared Zod schema, with validation errors written so Claude can correct itself
- [ ] **P5-6** Cue fields on bullets, with tool descriptions telling Claude to write two or three likely spoken phrases per bullet
- [ ] **P5-7** Every write returns the deck link, and an open editor picks up Claude's changes by refetching
- [ ] **P5-8** Rate limits and per-user quotas
- [ ] **P5-9** Test with the MCP Inspector, then as a custom connector in Claude, and write a short setup guide
- [ ] **P5-10** Optional: inline slide preview in the chat using MCP Apps

**Exit test:** in Claude, "make a 6-slide deck about airplanes in the animated theme" produces a deck that opens in the app and follows speech when presented.

## Phase 6: Stage-ready presenting and the voice analyzer

Goal: safe to use in front of a real audience, with emphasis that reacts to how the speaker talks.

- [ ] **P6-1** Speaker notes in the schema and the editor
- [ ] **P6-2** Presenter view with notes, next slide and a timer, synced to a separate audience window
- [ ] **P6-3** Voice analyzer: measure loudness and pitch in an AudioWorklet, and take speaking pace from the transcript's word timings
- [ ] **P6-4** Calibrate to each speaker during the first 30 seconds
- [ ] **P6-5** Map the emphasis score to animation intensity, with a setting to switch the analyzer off
- [ ] **P6-6** Opt-in suggestion to advance when the last bullet on a slide is done
- [ ] **P6-7** Live captions overlay
- [ ] **P6-8** Poor-network mode: deck assets cached locally and an on-device speech fallback
- [ ] **P6-9** Billing with Stripe: plans limited by transcription minutes
- [ ] **P6-10** Cost and load review: cost per presenting hour, and behaviour with many simultaneous talks

**Exit test:** a 20-minute talk on conference Wi-Fi runs without the presenter touching the laptop except to change slides.

## Phase 7 onward: growth features

These are in suggested build order, cheapest first. Each becomes its own phase with its own issue list once the MVP pilot shows what users ask for.

1. **Rehearsal mode:** a report after a practice run with skipped bullets, pace, filler words and time per slide.
2. **Follow-up package:** summary, transcript aligned to slides, and a shareable replay.
3. **Time-aware pacing:** ahead or behind against a target length, with skip suggestions.
4. **Voice-summoned content:** prepared hidden elements that appear when mentioned.
5. **Q&A mode:** the presenter view suggests the most relevant slide for an audience question.
6. **Caption translation:** captions shown in a second language.
7. **Audience companion view:** current slide, captions and questions on attendees' phones, using API Gateway WebSockets.
8. **Speaker profile:** stored voice baseline and vocabulary per user.
9. **PowerPoint and Google Slides import.**
10. **Live-generated slides:** new slides created from speech during the talk, using a model on Amazon Bedrock.
11. **Video call integration:** virtual camera or overlay for Zoom, Teams and Meet.
12. **Gesture and gaze cues** from the webcam.

## Risks and open decisions

Five questions are still open, and each has a phase where it gets answered.

| Open question | Why it matters | Answered in |
| --- | --- | --- |
| Which transcription provider? | Amazon Transcribe keeps everything inside AWS; Deepgram looked faster in earlier research. Swedish accuracy is unknown for both | P0-8 |
| Does following feel smooth enough? | If highlights jump or lag, the product has no core | Phase 0 exit test |
| DynamoDB or Postgres? | DynamoDB is cheap and fits Lambda and decks stored as documents. Postgres is better once teams, sharing and reporting arrive | P1-4 |
| Does Cognito work with Claude's connector sign-in? | Not verified. If it fails, use a dedicated auth provider in front of the MCP server | P5-1 |
| Is in-browser matching fast enough on an ordinary laptop? | Older machines without WebGPU run the model more slowly | P0-7 |

Two things are not in this plan yet: durations and owners. Both depend on team size, so add them per issue once you know who is building.
