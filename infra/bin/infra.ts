import { App } from "aws-cdk-lib";
import { ApiStack } from "../lib/api-stack.js";
import { WebStack } from "../lib/web-stack.js";

const app = new App();

// P1-3: a single AWS account for now ("dev"); "prod" gets its own account
// and context values once there's a team to justify the split. Nothing
// below the `stage` variable needs to change when that happens.
const stage = app.node.tryGetContext("stage") ?? process.env.STAGE ?? "dev";

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? "eu-north-1",
};

// Origins the API/media CORS config and Cognito's Hosted UI callback/logout
// URLs must allow. http://localhost:5174 is local dev; the CloudFront URL
// is WebStack's dev domain, known only after its first deploy (chicken-
// and-egg -- it couldn't be here before that deploy existed). Replace with
// the real domain once P1-8 picks one.
const webAppUrls = [
  "http://localhost:5174",
  "https://d2ikpxu6qtx85h.cloudfront.net", // Flowio-Web-dev
  ...(process.env.EXTRA_WEB_APP_URL ? [process.env.EXTRA_WEB_APP_URL] : []),
];

new ApiStack(app, `Flowio-Api-${stage}`, { stage, env, webAppUrls });
new WebStack(app, `Flowio-Web-${stage}`, { stage, env });
