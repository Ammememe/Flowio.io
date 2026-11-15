# Infra (P1-4, extended Phase 3)

AWS CDK app with two stacks, both parameterised by `stage` ("dev" for now --
see P1-3 in the phase plan for why there's no "prod" account yet):

- **`Flowio-Api-{stage}`**: a Cognito user pool + Hosted UI domain (P3-1),
  DynamoDB table for decks with an owner GSI (P3-2/P3-8), six Lambda
  functions (deck CRUD + upload presign) behind an HTTP API, and an S3
  media bucket with its own CloudFront distribution (P3-7).
- **`Flowio-Web-{stage}`**: S3 bucket + CloudFront distribution serving
  the built `web` app.

### Google sign-in (part of P3-1)

Email/password works with no extra setup. Google needs a real OAuth client
from [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
(OAuth consent screen + a Web application client, authorized redirect URI
`https://<cognito-domain>/oauth2/idpresponse` -- the domain is a CDK output,
`CognitoHostedUiDomain`, only known after the user pool is deployed once
without Google). Set `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` as env vars
before `cdk deploy` to add it; without them the pool still works with
email/password alone.

### ElevenLabs Scribe (P4-1)

Unlike the other third-party credential above, this one is **not** passed
through CDK as an env var -- it's a real, billable API key, so it's created
directly in Secrets Manager with the AWS CLI, out-of-band, and never
touches a synthesized CloudFormation template:

```bash
aws secretsmanager create-secret \
  --name flowio-elevenlabs-api-key-<stage> \
  --secret-string <your ElevenLabs API key> \
  --region eu-north-1
```

Get a key at https://elevenlabs.io/app/settings/api-keys -- when creating
it, restrict it to **Speech to Text: Access** only, leave every other
endpoint at **No Access** (this key only ever calls the single-use-token
endpoint; least privilege means a leak of this key can't touch voice
generation, dubbing, workspace settings, or anything else on the account).
Also set a credit limit instead of "Unlimited", and leave "Auto-disable if
leaked" on.

`ApiStack` references the secret by name (`flowio-elevenlabs-api-key-<stage>`)
and grants `secretsmanager:GetSecretValue` to exactly one Lambda's execution
role -- nothing else in the account can read it. If the secret doesn't
exist yet, the endpoint cleanly returns 501 and the web app falls back to
the Web Speech API, so deploying without this step first is safe, just
less capable. To rotate the key later: `aws secretsmanager put-secret-value`
with the new value -- no redeploy needed, the Lambda re-reads it on its next
cold start.

### MCP server shared secret (P5-2)

The MCP server (`mcp/`) is deployed as its own Lambda + HTTP API
(`McpUrl`/`McpSharedSecretName` in the stack outputs), separate from the
deck API above and gated by a shared secret instead of real sign-in --
P5-1 (OAuth from Claude's custom connector) is being done last, on purpose.
Same out-of-band pattern as ElevenLabs above, just a secret this stack
generates for itself rather than one from a third party:

```bash
aws secretsmanager create-secret \
  --name flowio-mcp-shared-secret-<stage> \
  --secret-string "$(openssl rand -hex 32)" \
  --region eu-north-1
```

Without it, every call to the MCP endpoint cleanly 500s rather than
silently accepting unauthenticated requests. Send the same value back as
`Authorization: Bearer <value>` from any MCP client -- see `mcp/README.md`
for the Claude custom-connector config. The endpoint's own HTTP API stage
is throttled (2 req/s, burst 5) as a blunt stand-in for P5-8's per-user
quotas, since there's only one fixed identity to quota until P5-1 exists.
Rotate the same way as the ElevenLabs key: `put-secret-value`, no redeploy
needed.

## Deploying

Both stacks are live in `dev`/`eu-north-1` (see the root README's "What's
deployed so far"). `cdk synth` needs no AWS credentials and is safe to run
any time.

```bash
# 1. Build the web app with the real API URL baked in -- the web stack
#    bundles web/dist as-is, and the app reads VITE_API_URL at build time.
VITE_API_URL=<Flowio-Api-dev's ApiUrl output> pnpm --filter web run build

# 2. Validate the stacks without touching AWS.
pnpm --filter infra run synth

# 3. One-time per account/region: give CDK a place to stage assets.
cd infra && npx cdk bootstrap aws://<ACCOUNT_ID>/eu-north-1

# 4. Deploy the API first (its URL is needed for step 1 on a first deploy),
#    then the web app.
npx cdk deploy Flowio-Api-dev --require-approval never
npx cdk deploy Flowio-Web-dev --require-approval never
```

**Gotchas hit on the first real deploy** (all fixed in the code, noted here
so a future from-scratch deploy in a fresh account doesn't need to
rediscover them):
- A disabled KMS key on the CDK bootstrap bucket blocks asset publishing
  with an opaque `"<key arn> is disabled"` error -- `aws kms enable-key`.
- `webAppUrls` in `bin/infra.ts` must include the *real* deployed site
  origin (not just `localhost`), or the API/media CORS preflight silently
  fails for the deployed site's own requests. There's an unavoidable
  chicken-and-egg on a brand new account: `Flowio-Web-dev` doesn't have a
  URL until after its first deploy, so add it and redeploy `Flowio-Api-dev`
  once you have it.
- On Windows with Git Bash: any AWS CLI argument starting with `/` (a log
  group name, an IAM path, a Secrets Manager name with slashes) gets
  silently mangled by MSYS's path conversion into something that looks like
  a Windows path, producing confusing `InvalidParameterException` errors
  with no mention of the real cause. Prefix the command with
  `MSYS_NO_PATHCONV=1` when that happens.

## Wiring up CI/CD (P1-5)

`.github/workflows/deploy.yml` deploys to dev on every merge to `main`,
signing in via OIDC (no long-lived AWS keys in GitHub). It needs, once:

1. **An OIDC identity provider** for `token.actions.githubusercontent.com`
   (skip if the account already has one -- there can only be one per account):

   ```bash
   aws iam create-open-id-connect-provider \
     --url https://token.actions.githubusercontent.com \
     --client-id-list sts.amazonaws.com \
     --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
   ```

2. **A deploy role** that trusts GitHub Actions for this repo only. Replace
   `<ACCOUNT_ID>` and `<GITHUB_ORG>/<REPO>`:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Principal": { "Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com" },
       "Action": "sts:AssumeRoleWithWebIdentity",
       "Condition": {
         "StringEquals": { "token.actions.githubusercontent.com:aud": "sts.amazonaws.com" },
         "StringLike": { "token.actions.githubusercontent.com:sub": "repo:<GITHUB_ORG>/<REPO>:ref:refs/heads/main" }
       }
     }]
   }
   ```

   Attach permissions the CDK deploy needs (start with `AdministratorAccess`
   while the stack set is small and churning, then narrow it once Phase 1
   is deployed and stable).

3. **Save the role's ARN** as a repository variable named
   `AWS_DEPLOY_ROLE_ARN` (Settings > Secrets and variables > Actions >
   Variables) -- the workflow reads it as `${{ vars.AWS_DEPLOY_ROLE_ARN }}`.

None of this OIDC/CI setup has been done yet -- deploys so far have all
been run by hand from a local machine, not through `deploy.yml`.
