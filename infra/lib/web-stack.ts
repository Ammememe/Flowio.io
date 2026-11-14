import { CfnOutput, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import {
  AllowedMethods,
  Distribution,
  ViewerProtocolPolicy,
} from "aws-cdk-lib/aws-cloudfront";
import { S3BucketOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { BlockPublicAccess, Bucket } from "aws-cdk-lib/aws-s3";
import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";
import type { Construct } from "constructs";
import path from "node:path";

export interface WebStackProps extends StackProps {
  /** "dev" or "prod" (P1-3: only "dev" is deployed for now, single AWS account). */
  stage: string;
}

/**
 * P1-4: S3 + CloudFront for the web app. CloudFront (not public S3) so a
 * real domain/certificate (P1-8) can be attached later without changing
 * where the site is hosted.
 */
export class WebStack extends Stack {
  constructor(scope: Construct, id: string, props: WebStackProps) {
    super(scope, id, props);
    const { stage } = props;
    const removalPolicy = stage === "prod" ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY;

    const siteBucket = new Bucket(this, "SiteBucket", {
      bucketName: `flowio-web-${stage}-${this.account}`,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      removalPolicy,
      autoDeleteObjects: stage !== "prod",
    });

    const distribution = new Distribution(this, "Distribution", {
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: AllowedMethods.ALLOW_GET_HEAD,
      },
      // The web app is a single-page app (Phase 2+); route unknown paths to
      // index.html instead of CloudFront's own 403/404 pages.
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: "/index.html" },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: "/index.html" },
      ],
    });

    // Run `pnpm --filter web run build` before `cdk synth`/`cdk deploy` -- this
    // asset has to exist on disk already, CDK does not build it for you.
    const webDist = path.resolve(import.meta.dirname, "../../web/dist");
    new BucketDeployment(this, "DeploySite", {
      sources: [Source.asset(webDist)],
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ["/*"],
    });

    new CfnOutput(this, "SiteUrl", {
      value: `https://${distribution.distributionDomainName}`,
    });
  }
}
