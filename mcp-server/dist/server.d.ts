import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
export interface CreateMcpServerOptions {
    /**
     * Register only read tools. The remote HTTP transport sets this so an
     * anonymous caller can never reach the token-backed write tools; stdio
     * (local) use keeps the full tool set.
     */
    readOnly?: boolean;
}
export declare function createMcpServer(options?: CreateMcpServerOptions): McpServer;
//# sourceMappingURL=server.d.ts.map