#!/usr/bin/env node

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const SKETCH_MCP_URL = new URL("http://localhost:31126/mcp");
const SKETCH_NOT_RUNNING_ERROR_MESSAGE =
  "Error: This is a fallback response because the Sketch MCP server is not available. Either Sketch is not running or its MCP Server is not yet enabled. Explain the situation to the user and direct them to this help article: https://www.sketch.com/docs/mcp-server/. Mention that they might need to restart Claude after starting Sketch and enabling the MCP Server to get the full functionality.";
const PLACEHOLDER_TOOL_DESCRIPTION_MESSAGE =
  "This is a placeholder tool description provided while the Sketch MCP server is not available. Try to re-fetch the tool list after the user has started Sketch and enabled the MCP Server";

let proxyServer;

async function withSketchClient(callback) {
  const transport = new StreamableHTTPClientTransport(SKETCH_MCP_URL);
  const client = new Client({
    name: "sketch-mcp-bridge",
    version: "2.1.0",
  });
  try {
    await client.connect(transport);
    return await callback(client);
  } finally {
    await transport.close().catch(() => {});
  }
}

async function createProxyServer() {
  let info;
  let capabilities;

  try {
    await withSketchClient((sketch) => {
      info = sketch.getServerVersion();
      capabilities = sketch.getServerCapabilities();
    });
  } catch (error) {
    // If we fail to connect to Sketch, we still want to start the proxy server, just with placeholder info
    console.error("Failed to connect to Sketch MCP server:", error);
    info = {
      name: "SketchMCP",
      version: "2.0.0",
    };
    capabilities = {
      tools: {
        listChanged: false,
      },
    };
  }

  const server = new Server(
    {
      name: info.name,
      version: info.version,
    },
    {
      capabilities,
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    try {
      return await withSketchClient((sketch) => sketch.listTools());
    } catch (error) {
      // Returning a placeholder list of tools e.g. when Sketch is not running
      return {
        tools: [
          {
            name: "run_code",
            description: `Run ECMAScript 2020 Sketch plugin scripts. (${PLACEHOLDER_TOOL_DESCRIPTION_MESSAGE})`,
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
          {
            name: "get_selection_as_image",
            description: `Returns a visual representation of currently selected Sketch layers as a PNG image. (${PLACEHOLDER_TOOL_DESCRIPTION_MESSAGE})`,
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
        ],
      };
    }
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      return await withSketchClient((sketch) =>
        sketch.callTool({
          name: request.params.name,
          arguments: request.params.arguments,
        }),
      );
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: SKETCH_NOT_RUNNING_ERROR_MESSAGE,
          },
        ],
      };
    }
  });

  return server;
}

async function main() {
  proxyServer = await createProxyServer();

  const transport = new StdioServerTransport();
  await proxyServer.connect(transport);
}

main().catch(async (error) => {
  console.error("Fatal server bootstrap error:", error);
  await proxyServer?.close().catch(() => {});

  process.exit(1);
});

process.on("SIGINT", async () => {
  await proxyServer?.close().catch(() => {});

  process.exit(0);
});
