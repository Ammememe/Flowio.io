# Infra (P1-4)

AWS CDK app with two stacks, both parameterised by `stage` ("dev" for now --
see P1-3 in the phase plan for why there's no "prod" account yet):

- **`LiveSlides-Api-{stage}`**: DynamoDB table for decks, S3 media bucket,
  two Lambda functions (`createDeck`, `getDeck`) behind an HTTP API.
- **`LiveSlides-Web-{stage}`**: S3 bucket + CloudFront distribution serving
  the built `web` app.

## Before you can deploy anything

Nothing here has been deployed yet. `cdk synth` (below) needs no AWS
credentials and is safe to run any time; `cdk deploy` needs the one-time
setup below, done once per AWS account.

```bash
# 1. Build the web app first -- the web stack bundles web/dist as-is.
pnpm --filter web run build

# 2. Validate the stacks without touching AWS.
pnpm --filter infra run synth

# 3. One-time per account/region: give CDK a place to stage assets.
cd infra && npx cdk bootstrap aws://<ACCOUNT_ID>/eu-north-1

# 4. Deploy both stacks.
pnpm --filter infra run deploy
```

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

None of this has been run against the account yet -- do it when you're
ready to actually deploy, not before.
