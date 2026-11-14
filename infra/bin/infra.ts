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

// P3-1: Cognito Hosted UI callback/logout URLs. http://localhost:5174 lets
// local dev sign in against the deployed pool. Add the real domain here
// once P1-8 picks one -- there's no CloudFront URL to add automatically
// until after WebStack's first deploy.
const webAppUrls = [
  "http://localhost:5174",
  ...(process.env.EXTRA_WEB_APP_URL ? [process.env.EXTRA_WEB_APP_URL] : []),
];

new ApiStack(app, `Flowio-Api-${stage}`, { stage, env, webAppUrls });
new WebStack(app, `Flowio-Web-${stage}`, { stage, env });
