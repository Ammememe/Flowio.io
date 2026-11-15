# Flowio

Working name -- `flowio.io`/`flowio.com` are both already registered to
someone else, so this is a placeholder until a real domain is picked.

See `Live Slides Phase Plan.md` for the full phase plan (written before the
rename; the plan's content still applies). This is the **Phase 1
(Foundation)** monorepo: a deck format and a deployable skeleton everything
else builds on. The throwaway Phase 0 spike (speech-following feel test)
lives in `live-slides-spike/` and is unrelated to this workspace.

## Packages (P1-1)

pnpm workspace, five packages:

| Package | What it is |
| --- | --- |
| `shared` | Deck schema v1 in Zod (P1-2) and other types shared by everything below. |
| `web` | The browser app: the P1-6 hello world, the Phase 2 slide renderer/themes/present mode, and the Phase 3 sign-in/dashboard/editor. |
| `api` | Lambda handlers behind API Gateway, backed by DynamoDB. |
| `mcp` | Empty placeholder. Built out in Phase 5 (Claude connector). |
| `infra` | AWS CDK app (P1-4). See `infra/README.md` before deploying anything. |

## Run the P1-6 hello world locally

No AWS deploy needed -- `api` has a local dev server backed by an in-memory
store with the same request/response shape as the deployed Lambda handlers.

```bash
pnpm install

# terminal 1
pnpm --filter api run dev        # local API on http://localhost:8787

# terminal 2
pnpm --filter web run dev        # web app on http://localhost:5174
```

Open http://localhost:5174 and click the button: it creates a deck through
the API, fetches it back, and checks the result validates against the deck
schema and round-trips unchanged -- the P1-6 exit test, run by hand.

(Phase 3 added auth to every `/decks` call -- this page signs itself in
with a fixed dev identity automatically so it still works standalone.)

## Present a deck (Phase 2)

```bash
pnpm --filter web run dev        # same server as above, now also serves /present.html
```

Open http://localhost:5174/present.html. It presents `web/src/deck/sampleDeck.ts`
-- the Phase 0 spike's "How airplanes fly" deck ported into schema v1, plus
a few extra slides added to exercise all six layouts. Keys: `→`/`←`/`Space`/
`PageUp`/`PageDown` to navigate, `1`-`9` to emphasise the nth bullet on the
current slide (a manual stand-in for Phase 4's matcher), `0`/`Escape` to
clear emphasis, `t` to swap the static/animated theme, `f` for fullscreen.

## Sign up and build a deck (Phase 3)

```bash
pnpm --filter api run dev        # local API, now with auth + full deck CRUD + uploads
pnpm --filter web run dev        # same server as above, now also serves /dashboard.html etc.
```

Open http://localhost:5174/dashboard.html. There's no deployed Cognito yet
(P3-1 still needs a real AWS deploy), so sign-in is a local stand-in:
type any email at `/signin.html` and it's remembered in `localStorage` --
that becomes the `Authorization: Bearer dev:<email>` header the API's
`DevVerifier` accepts. Real email/password + Google sign-in replace this
once the user pool is deployed; nothing else changes.

From the dashboard: **New deck** → the editor. The canvas *is* the editor --
click any title/bullet to edit it in place (Tiptap, P3-5), drag images onto
the "Replace image" overlay to upload one (P3-7, local dev stores the file
in memory instead of real S3), use the sidebar to add/duplicate/delete/drag-
reorder slides (P3-4), the top bar to pick a layout or theme per slide/deck
(P3-6), and the right panel to add cue phrases per bullet (P3-9). Every
change autosaves with a version number (P3-8) -- two tabs open on the same
deck will get a 409 and a "reload" prompt instead of silently clobbering
each other. **Present** opens `/present.html?deckId=...` with the real deck.

## Checks

```bash
pnpm run typecheck   # every package
pnpm run test        # shared + api unit tests
pnpm run build       # shared, api, mcp, infra compile; web builds with Vite
pnpm run synth        # validate the CDK stacks (no AWS credentials needed)

pnpm --filter web exec playwright install chromium   # one-time
pnpm --filter web run test:visual                     # P2-8 visual snapshot tests
```

## What's deployed so far

Both stacks, to the `dev` stage in `eu-north-1`:

- Web: https://d2ikpxu6qtx85h.cloudfront.net
- API: `Flowio-Api-dev`'s `ApiUrl` output (Cognito user pool, DynamoDB, 6
  Lambdas, media bucket + its own CloudFront distribution)

Deployed manually (`cdk deploy`), not yet through `deploy.yml` -- the
GitHub Actions OIDC role from P1-5 still isn't set up (see `infra/README.md`).

**Known gap:** the deployed site's sign-in (`/signin.html`) is still the
local dev stand-in (P3-1) -- it produces a fake token the real deployed API
correctly rejects (`401`, verified). Real decks only work end-to-end
through the deployed API right now via a real Cognito token (verified by
hand with the AWS CLI: create/list/get/update/409-on-conflict/delete/upload
all confirmed against the live stack). The web app needs real Cognito
Hosted UI auth wired in before a real user can sign in on the deployed site
-- not yet done.

Four real bugs were only visible once actually deployed (all fixed):
1. The CDK bootstrap bucket's KMS key was disabled (pre-existing in this
   AWS account) -- asset publishing failed until re-enabled.
2. The media bucket's CORS rule had `allowedMethods: []` -- S3 rejected the
   bucket creation outright ("XML ... did not validate").
3. S3 presigned-POST uploads failed in Lambda (temporary STS credentials)
   but worked from a local long-lived IAM user: the POST policy needed a
   `starts-with x-amz-security-token` condition, *and* the multipart form
   fields need `key` and the `X-Amz-*` fields in an exact relative order
   that the SDK's own `fields` object isn't sorted into -- fixed in both
   `api/src/uploads/s3Presigner.ts` and `web/src/api/upload.ts`.
4. The API/media CORS allowlist only had `localhost` -- the deployed site's
   own CloudFront origin was never allowed, so its own browser requests
   were silently blocked until the real URL was added to `webAppUrls`.

## Phase 1 status

| Issue | Status |
| --- | --- |
| P1-1 Monorepo with pnpm workspaces | Done |
| P1-2 Deck schema v1 in Zod | Done |
| P1-3 AWS accounts, SSO, billing alarm | Deferred -- single AWS account for now, revisit once there's a team |
| P1-4 CDK: web hosting, API, DynamoDB, media bucket | **Deployed** to `dev` (`eu-north-1`), manually via `cdk deploy` |
| P1-5 CI/CD via GitHub Actions + OIDC | Workflows written; OIDC role and GitHub repo variable still need setting up (`infra/README.md`) -- deploys so far have been manual |
| P1-6 End-to-end hello world | **Verified against the real deployment**: create/get round-trips unchanged through the live API with a real Cognito token |
| P1-7 Logging and error tracking | Structured logging (API, now flowing to real CloudWatch) and a browser error reporter; no external error-tracking service wired up yet |
| P1-8 Domain and certificate | Deferred -- using the CloudFront/API Gateway default addresses for now |

**Exit test** ("a merge to main deploys web and API to the dev address, and
a deck round-trips through the API unchanged") -- the round-trip half is
now verified for real (see above). The "a merge deploys" half isn't: there
is no CI/CD deploy yet, every deploy so far has been run by hand. P1-5's
AWS-side OIDC setup is the remaining gap.

## Phase 2 status

| Issue | Status |
| --- | --- |
| P2-1 Slide renderer | Done -- deck JSON + theme renders at a fixed 1280x720 logical size, scaled/centered to fill its container (`web/src/render/scale.ts`) |
| P2-2 Six layout templates | Done -- `web/src/render/layouts/*` (title, bullets, bullets-image, full-image, quote, section-break) |
| P2-3 Theme system | Done -- `web/src/themes/tokens.ts`, applied as CSS custom properties |
| P2-4 Theme A, static | Done -- plain CSS opacity transitions only, no Motion |
| P2-5 Theme B, animated | Done -- entrance, emphasis, exit and slide-transition all go through Motion (`motion` package) |
| P2-6 Emphasis interface | Done -- `setEmphasis({ activeElementId, intensity })`, the only thing Phase 4's matcher will call |
| P2-7 Present mode | Done -- `web/present.html`, fullscreen (`f`), keyboard/clicker navigation, theme toggle (`t`) |
| P2-8 Visual snapshot tests | Done -- Playwright, 4 snapshots across both themes/several layouts (`web/tests/`); CI job runs on `windows-latest` to match where the baselines were captured |

**Exit test** ("the spike deck presents in both themes, and pressing a key
triggers emphasis on any bullet"): verified by hand in a real browser --
`web/src/deck/sampleDeck.ts` is the Phase 0 spike's airplane deck, presents
correctly in both themes, and digit keys emphasise bullets correctly in
each. No manual-control present mode existed before this phase, so there's
nothing from Phase 1 it could regress.

## Phase 3 status

| Issue | Status |
| --- | --- |
| P3-1 Sign-in with Cognito (email + Google) | CDK written (user pool, Hosted UI domain, app client; Google IdP wired but needs real `GOOGLE_CLIENT_ID`/`SECRET` from Google Cloud Console), not deployed. Local dev uses a stand-in (`web/src/auth/devAuth.ts`) |
| P3-2 Deck API: create/list/get/update/delete, owner-only | Done -- owner checks return 404 (not 403) for someone else's deck, so existence isn't leaked |
| P3-3 Dashboard | Done -- `web/dashboard.html`: list, create, rename, delete |
| P3-4 Editor shell | Done -- `web/editor.html` sidebar: add, duplicate, delete, drag-to-reorder |
| P3-5 Edit titles/bullets in place with Tiptap | Done -- minimal single-line Tiptap editors mounted directly onto the rendered elements (`web/src/editor/inlineEditor.ts`) |
| P3-6 Layout + theme picker | Done -- per-slide layout, per-deck theme (`web/src/editor/pickers.ts`) |
| P3-7 Image upload: presigned, size/type limits, CloudFront | Done -- real S3 presigned POST + its own CloudFront distribution in CDK (not deployed); local dev stores uploads in memory with the same size/type checks (`shared/src/uploadLimits.ts`) |
| P3-8 Autosave with a version number, undo/redo | Done -- optimistic concurrency (`expectedVersion`, 409 on conflict), debounced autosave, whole-deck undo/redo history |
| P3-9 Cue editor | Done -- per-bullet cue phrases in the editor's right panel |

**Exit test** ("a new user signs up, builds a 5-slide deck with one image,
reloads the page, and nothing is lost"): verified by hand in a real browser
for everything except real sign-up and a real S3 image -- sign-in,
dashboard, slide add/edit/reorder, theme/layout changes, cues, and autosave
all survive a hard reload against the local dev API. P3-1 and the S3 half
of P3-7 need an actual `cdk deploy` (still blocked, see Phase 1 above)
before they're real rather than local stand-ins.

Two real bugs were caught and fixed in this pass: Tiptap was duplicating
text (it appends into the mount element rather than replacing it -- fixed
by clearing the element first) and the editor canvas was silently missing
all slide-content CSS (it lived only in `present/style.css`; pulled the
shared rules into `web/src/render/slideContent.css`, imported by both).
