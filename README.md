# Sketch MCP

The official Sketch MCP server that allows AI clients to interact with your designs:

- Explore designs and Libraries — compare code to components to Sketch and fix inconsistencies
- Expand and iterate on existing designs — try out new directions, generate alternative flows, and more
- Replace placeholders with lifelike data, or even pull from real data sets
- Organize and export assets
- Generate screens and components as code
- …and [much more](https://www.sketch.com/blog/mcp-server-use-cases/).

> [!NOTE]
> This server communicates with the Sketch app, so please ensure the app is running and [the MCP Server option](https://www.sketch.com/docs/mcp-server/) is turned on.

## Usage

### Claude Desktop (Mac)

1. Go to Customize > Connectors, press the `+` button, choose "Browse connectors".
2. Search for "Sketch" and press "Install".

## Development

From a technical standpoint this is an stdio MCP server that simply forwards messages to and from the local Streamable HTTP MCP server that is part of the Sketch Mac app. This "proxy" server is needed for clients like Claude Desktop that only support stdio and _encrypted_ (HTTPS) remote MCPs.

### Setup

```bash
npm ci
```

### Run the server

1. Launch Sketch and activate the MCP server option.
2. `npm run start`

### Archive

This will generate the `.mcpb` archive ready for distribution:

```bash
npm run pack
```
