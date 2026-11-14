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

new ApiStack(app, `Flowio-Api-${stage}`, { stage, env });
new WebStack(app, `Flowio-Web-${stage}`, { stage, env });
