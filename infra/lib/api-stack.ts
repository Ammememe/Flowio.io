import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import { HttpApi, CorsHttpMethod, HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { AttributeType, BillingMode, Table } from "aws-cdk-lib/aws-dynamodb";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { BlockPublicAccess, Bucket } from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";

export interface ApiStackProps extends StackProps {
  /** "dev" or "prod" (P1-3: only "dev" is deployed for now, single AWS account). */
  stage: string;
}

/**
 * P1-4: API Gateway + Lambda for the API, a DynamoDB table for decks, and
 * an S3 media bucket for uploaded images (used starting P3-7).
 */
export class ApiStack extends Stack {
  public readonly apiUrl: string;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);
    const { stage } = props;
    // Non-prod stacks are throwaway while the product is still taking shape:
    // destroying them on stack deletion avoids orphaned billable resources.
    const removalPolicy = stage === "prod" ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY;

    const decksTable = new Table(this, "DecksTable", {
      tableName: `flowio-decks-${stage}`,
      partitionKey: { name: "id", type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy,
    });

    const mediaBucket = new Bucket(this, "MediaBucket", {
      bucketName: `flowio-media-${stage}-${this.account}`,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      removalPolicy,
      autoDeleteObjects: stage !== "prod",
      cors: [
        {
          allowedMethods: [],
          allowedOrigins: ["*"],
          allowedHeaders: ["*"],
        },
      ],
    });

    const commonLambdaProps = {
      runtime: Runtime.NODEJS_22_X,
      memorySize: 256,
      timeout: Duration.seconds(10),
      environment: {
        DECKS_TABLE_NAME: decksTable.tableName,
      },
      bundling: {
        // The API package's own tsconfig/type-checking already runs in CI (P1-5);
        // esbuild here only needs to produce a runnable bundle.
        minify: true,
        sourceMap: true,
      },
    };

    const createDeckFnName = `flowio-create-deck-${stage}`;
    const createDeckFn = new NodejsFunction(this, "CreateDeckFunction", {
      ...commonLambdaProps,
      entry: "../api/src/lambda/createDeck.ts",
      handler: "handler",
      functionName: createDeckFnName,
      // P1-7: a bounded retention instead of the "forever" default.
      logGroup: new LogGroup(this, "CreateDeckLogGroup", {
        logGroupName: `/aws/lambda/${createDeckFnName}`,
        retention: RetentionDays.ONE_MONTH,
        removalPolicy,
      }),
    });

    const getDeckFnName = `flowio-get-deck-${stage}`;
    const getDeckFn = new NodejsFunction(this, "GetDeckFunction", {
      ...commonLambdaProps,
      entry: "../api/src/lambda/getDeck.ts",
      handler: "handler",
      functionName: getDeckFnName,
      logGroup: new LogGroup(this, "GetDeckLogGroup", {
        logGroupName: `/aws/lambda/${getDeckFnName}`,
        retention: RetentionDays.ONE_MONTH,
        removalPolicy,
      }),
    });

    decksTable.grantWriteData(createDeckFn);
    decksTable.grantReadData(getDeckFn);

    const httpApi = new HttpApi(this, "HttpApi", {
      apiName: `flowio-api-${stage}`,
      corsPreflight: {
        allowOrigins: ["*"], // Tighten once the web app has a fixed domain (P1-8).
        allowMethods: [CorsHttpMethod.GET, CorsHttpMethod.POST, CorsHttpMethod.OPTIONS],
        allowHeaders: ["content-type"],
      },
    });

    httpApi.addRoutes({
      path: "/decks",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("CreateDeckIntegration", createDeckFn),
    });

    httpApi.addRoutes({
      path: "/decks/{id}",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("GetDeckIntegration", getDeckFn),
    });

    this.apiUrl = httpApi.apiEndpoint;

    new CfnOutput(this, "ApiUrl", {
      value: httpApi.apiEndpoint,
      description: "Base URL for the deck API (set as VITE_API_URL for the web app).",
    });

    new CfnOutput(this, "MediaBucketName", {
      value: mediaBucket.bucketName,
    });
  }
}
