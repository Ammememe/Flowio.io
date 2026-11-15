import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { httpBackend } from "./httpBackend.js";
import { registerDeckTools } from "./tools.js";

/**
 * Local entry point (P5-9): runs over stdio, which Claude Desktop and the
 * MCP Inspector both launch directly -- no public HTTPS endpoint needed for
 * this kind of testing. `mcp/README.md` has the deployed-Lambda endpoint
 * (`lambda.ts`), which is what a Claude.ai custom connector needs instead.
 */
const server = new McpServer({ name: "flowio", version: "0.0.1" });
registerDeckTools(server, httpBackend);

await server.connect(new StdioServerTransport());
