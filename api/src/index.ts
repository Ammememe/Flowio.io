/**
 * Library entry point. Only used by the MCP server's deployed Lambda
 * (`mcp/src/directBackend.ts`), which calls this business logic directly
 * against DynamoDB instead of going through API Gateway + the Cognito
 * verifier -- see that file's doc comment for why. Every other Lambda in
 * this package is bundled by CDK straight from its own `src/lambda/*.ts`
 * file and never imports through here.
 */
export { createDeck, deleteDeck, getDeck, listDecks, updateDeck, type HandlerResult } from "./handlers.js";
export { DeckNotFoundError, DeckVersionConflictError, type DeckStore } from "./store/deckStore.js";
export { DynamoDeckStore } from "./store/dynamoStore.js";
export type { AuthContext } from "./auth/types.js";
