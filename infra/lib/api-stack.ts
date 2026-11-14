import { CfnOutput, Duration, RemovalPolicy, SecretValue, Stack, type StackProps } from "aws-cdk-lib";
import { HttpApi, CorsHttpMethod, HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import {
  AccountRecovery,
  OAuthScope,
  UserPool,
  UserPoolClient,
  UserPoolClientIdentityProvider,
  UserPoolIdentityProviderGoogle,
  ProviderAttribute,
} from "aws-cdk-lib/aws-cognito";
import {
  AllowedMethods,
  Distribution,
  ViewerProtocolPolicy,
} from "aws-cdk-lib/aws-cloudfront";
import { S3BucketOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { AttributeType, BillingMode, ProjectionType, Table } from "aws-cdk-lib/aws-dynamodb";
import { Runtime, type Function as LambdaFunction } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction, type NodejsFunctionProps } from "aws-cdk-lib/aws-lambda-nodejs";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { BlockPublicAccess, Bucket } from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";

export interface ApiStackProps extends StackProps {
  /** "dev" or "prod" (P1-3: only "dev" is deployed for now, single AWS account). */
  stage: string;
  /** URLs the web app is served from, for Cognito Hosted UI callback/logout (P3-1). Always includes localhost for local dev against a deployed pool. */
  webAppUrls: string[];
}

/**
 * P1-4 (API Gateway + Lambda + DynamoDB + media bucket), extended by
 * Phase 3: a Cognito user pool for sign-in (P3-1), full deck CRUD with
 * owner-only access and optimistic-concurrency updates (P3-2/P3-8), and
 * presigned image uploads through a CloudFront-fronted media bucket (P3-7).
 */
export class ApiStack extends Stack {
  public readonly apiUrl: string;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);
    const { stage, webAppUrls } = props;
    // Non-prod stacks are throwaway while the product is still taking shape:
    // destroying them on stack deletion avoids orphaned billable resources.
    const removalPolicy = stage === "prod" ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY;

    // ---- P3-1: Cognito -----------------------------------------------
    const userPool = new UserPool(this, "UserPool", {
      userPoolName: `flowio-users-${stage}`,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: { email: { required: true, mutable: true } },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: false,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: AccountRecovery.EMAIL_ONLY,
      removalPolicy,
    });

    const userPoolDomain = userPool.addDomain("UserPoolDomain", {
      cognitoDomain: { domainPrefix: `flowio-${stage}-${this.account}` },
    });

    // Google sign-in needs a real OAuth client from Google Cloud Console --
    // not something this stack can create. Set GOOGLE_CLIENT_ID and
    // GOOGLE_CLIENT_SECRET as env vars before `cdk deploy` to turn it on;
    // without them the pool still works with email/password alone.
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const supportedIdentityProviders: UserPoolClientIdentityProvider[] = [
      UserPoolClientIdentityProvider.COGNITO,
    ];

    let googleProvider: UserPoolIdentityProviderGoogle | undefined;
    if (googleClientId && googleClientSecret) {
      googleProvider = new UserPoolIdentityProviderGoogle(this, "GoogleIdP", {
        userPool,
        clientId: googleClientId,
        clientSecretValue: SecretValue.unsafePlainText(googleClientSecret),
        scopes: ["email", "profile", "openid"],
        attributeMapping: { email: ProviderAttribute.GOOGLE_EMAIL },
      });
      supportedIdentityProviders.push(UserPoolClientIdentityProvider.GOOGLE);
    }

    const userPoolClient = new UserPoolClient(this, "WebClient", {
      userPool,
      generateSecret: false, // public client (browser-based)
      authFlows: { userSrp: true },
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [OAuthScope.EMAIL, OAuthScope.OPENID, OAuthScope.PROFILE],
        callbackUrls: webAppUrls,
        logoutUrls: webAppUrls,
      },
      supportedIdentityProviders,
    });
    if (googleProvider) userPoolClient.node.addDependency(googleProvider);

    // ---- P3-2/P3-8: DynamoDB, with a GSI so the dashboard can list a user's own decks ----
    const decksTable = new Table(this, "DecksTable", {
      tableName: `flowio-decks-${stage}`,
      partitionKey: { name: "id", type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy,
    });
    decksTable.addGlobalSecondaryIndex({
      indexName: "ownerId-index",
      partitionKey: { name: "ownerId", type: AttributeType.STRING },
      sortKey: { name: "updatedAt", type: AttributeType.STRING },
      projectionType: ProjectionType.ALL,
    });

    // ---- P3-7: media bucket + its own CloudFront distribution --------
    const mediaBucket = new Bucket(this, "MediaBucket", {
      bucketName: `flowio-media-${stage}-${this.account}`,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      removalPolicy,
      autoDeleteObjects: stage !== "prod",
      cors: [
        {
          allowedMethods: [],
          allowedOrigins: webAppUrls,
          allowedHeaders: ["*"],
        },
      ],
    });
    const mediaDistribution = new Distribution(this, "MediaDistribution", {
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(mediaBucket),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: AllowedMethods.ALLOW_GET_HEAD,
      },
    });
    const mediaBaseUrl = `https://${mediaDistribution.distributionDomainName}`;

    // ---- Lambdas -------------------------------------------------------
    const commonLambdaProps: Partial<NodejsFunctionProps> = {
      runtime: Runtime.NODEJS_22_X,
      memorySize: 256,
      timeout: Duration.seconds(10),
      bundling: {
        // The API package's own tsconfig/type-checking already runs in CI (P1-5);
        // esbuild here only needs to produce a runnable bundle.
        minify: true,
        sourceMap: true,
      },
    };
    const authEnv = {
      COGNITO_USER_POOL_ID: userPool.userPoolId,
      COGNITO_CLIENT_ID: userPoolClient.userPoolClientId,
    };
    const deckTableEnv = { DECKS_TABLE_NAME: decksTable.tableName };

    const makeFn = (id: string, entry: string, environment: Record<string, string>): LambdaFunction => {
      const functionName = `flowio-${id}-${stage}`;
      const fn = new NodejsFunction(this, `${pascalCase(id)}Function`, {
        ...commonLambdaProps,
        entry,
        handler: "handler",
        functionName,
        environment,
        // P1-7: a bounded retention instead of the "forever" default.
        logGroup: new LogGroup(this, `${pascalCase(id)}LogGroup`, {
          logGroupName: `/aws/lambda/${functionName}`,
          retention: RetentionDays.ONE_MONTH,
          removalPolicy,
        }),
      });
      return fn;
    };

    const createDeckFn = makeFn("create-deck", "../api/src/lambda/createDeck.ts", { ...authEnv, ...deckTableEnv });
    const getDeckFn = makeFn("get-deck", "../api/src/lambda/getDeck.ts", { ...authEnv, ...deckTableEnv });
    const listDecksFn = makeFn("list-decks", "../api/src/lambda/listDecks.ts", { ...authEnv, ...deckTableEnv });
    const updateDeckFn = makeFn("update-deck", "../api/src/lambda/updateDeck.ts", { ...authEnv, ...deckTableEnv });
    const deleteDeckFn = makeFn("delete-deck", "../api/src/lambda/deleteDeck.ts", { ...authEnv, ...deckTableEnv });
    const createUploadUrlFn = makeFn("create-upload-url", "../api/src/lambda/createUploadUrl.ts", {
      ...authEnv,
      MEDIA_BUCKET_NAME: mediaBucket.bucketName,
      MEDIA_BASE_URL: mediaBaseUrl,
    });

    decksTable.grantWriteData(createDeckFn);
    decksTable.grantReadData(getDeckFn);
    decksTable.grantReadData(listDecksFn); // covers Query against the GSI too
    decksTable.grantReadWriteData(updateDeckFn);
    decksTable.grantWriteData(deleteDeckFn);
    mediaBucket.grantPut(createUploadUrlFn); // createPresignedPost signs with the Lambda's own credentials

    // ---- HTTP API --------------------------------------------------------
    const httpApi = new HttpApi(this, "HttpApi", {
      apiName: `flowio-api-${stage}`,
      corsPreflight: {
        allowOrigins: webAppUrls,
        allowMethods: [
          CorsHttpMethod.GET,
          CorsHttpMethod.POST,
          CorsHttpMethod.PATCH,
          CorsHttpMethod.DELETE,
          CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ["content-type", "authorization"],
      },
    });

    httpApi.addRoutes({
      path: "/decks",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("CreateDeckIntegration", createDeckFn),
    });
    httpApi.addRoutes({
      path: "/decks",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("ListDecksIntegration", listDecksFn),
    });
    httpApi.addRoutes({
      path: "/decks/{id}",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("GetDeckIntegration", getDeckFn),
    });
    httpApi.addRoutes({
      path: "/decks/{id}",
      methods: [HttpMethod.PATCH],
      integration: new HttpLambdaIntegration("UpdateDeckIntegration", updateDeckFn),
    });
    httpApi.addRoutes({
      path: "/decks/{id}",
      methods: [HttpMethod.DELETE],
      integration: new HttpLambdaIntegration("DeleteDeckIntegration", deleteDeckFn),
    });
    httpApi.addRoutes({
      path: "/uploads",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("CreateUploadUrlIntegration", createUploadUrlFn),
    });

    this.apiUrl = httpApi.apiEndpoint;

    new CfnOutput(this, "ApiUrl", {
      value: httpApi.apiEndpoint,
      description: "Base URL for the deck API (set as VITE_API_URL for the web app).",
    });
    new CfnOutput(this, "MediaBucketName", { value: mediaBucket.bucketName });
    new CfnOutput(this, "MediaBaseUrl", { value: mediaBaseUrl });
    new CfnOutput(this, "CognitoUserPoolId", { value: userPool.userPoolId });
    new CfnOutput(this, "CognitoClientId", { value: userPoolClient.userPoolClientId });
    new CfnOutput(this, "CognitoHostedUiDomain", {
      value: userPoolDomain.baseUrl(),
      description: "Set as VITE_COGNITO_DOMAIN for the web app.",
    });
  }
}

function pascalCase(kebab: string): string {
  return kebab.split("-").map((part) => part[0].toUpperCase() + part.slice(1)).join("");
}
