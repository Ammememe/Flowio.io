import type { APIGatewayProxyEventV2 } from "aws-lambda";

/** API Gateway v2 lowercases header names. */
export function getAuthHeader(event: APIGatewayProxyEventV2): string | undefined {
  return event.headers?.authorization ?? event.headers?.Authorization;
}
