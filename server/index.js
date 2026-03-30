#!/usr/bin/env node

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const REMOTE_MCP_URL = new URL("http://localhost:31126/mcp");

const remoteClient = new Client({
  name: "sketch-mcp-bridge",
  version: "2.0.0",
});

let remoteTransport;
let remoteConnected = false;
let proxyServer;

async function ensureRemoteConnection() {
  if (remoteConnected) {
    return;
  }

  remoteTransport = new StreamableHTTPClientTransport(REMOTE_MCP_URL);
  remoteTransport.onerror = (error) => {
    console.error("MCP transport error from Sketch:", error);
  };
  remoteTransport.onclose = () => {
    remoteConnected = false;
  };

  await remoteClient.connect(remoteTransport);
  remoteConnected = true;
}

function createProxyServer() {
  const remoteInfo = remoteClient.getServerVersion();
  const remoteInstructions = remoteClient.getInstructions();
  const remoteCapabilities = remoteClient.getServerCapabilities();

  const server = new Server(
    {
      name: remoteInfo.name,
      version: remoteInfo.version,
    },
    {
      capabilities: {
        tools: remoteCapabilities.tools,
      },
      instructions: remoteInstructions,
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    await ensureRemoteConnection();
    return remoteClient.listTools();
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    await ensureRemoteConnection();

    return remoteClient.callTool({
      name: request.params.name,
      arguments: request.params.arguments,
    });
  });

  return server;
}

async function main() {
  await ensureRemoteConnection();
  proxyServer = createProxyServer();

  const transport = new StdioServerTransport();
  await proxyServer.connect(transport);
}

main().catch(async (error) => {
  console.error("Proxy server error:", error);

  if (remoteTransport) {
    await remoteTransport.close().catch(() => {});
  }

  process.exit(1);
});

process.on("SIGINT", async () => {
  if (remoteTransport) {
    await remoteTransport.close().catch(() => {});
  }

  process.exit(0);
});
