# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A VS Code extension for TypeScript development against Dynamics 365 / Dataverse. It browses entity/attribute metadata, generates typed interfaces and `const enum`s for option sets, publishes web resources, and ships a bundled MCP server so Claude can query live schema. See `README.md` for the full user-facing feature list.

## Commands

```bash
npm run compile        # tsc -p ./  → emits to out/  (also the vscode:prepublish step)
npm run watch          # tsc -watch, use during development
npm run lint           # eslint src
npm test               # mocha (unit tests) — note: pretest runs compile + lint
npx mocha              # run tests WITHOUT the pretest compile/lint gate (what CI uses)

# Run a single test file / test:
npx mocha test/unit/interfaceGenerator.test.ts
npx mocha --grep "generateEnum"

# Versioning & packaging
npm run version:patch|minor|major   # bumps package.json via scripts/bump-version.mjs
npm run package                     # vsce package → .vsix
```

CI (`.github/workflows/ci.yml`) runs `npm ci` → lint → compile → `npx mocha` on PRs to `main`/`develop`. Match that locally before pushing.

Debug the extension itself by launching the VS Code "Run Extension" configuration (`.vscode/launch.json`), which opens an Extension Development Host.

## Architecture

Two separate runtime processes are built from `src/` into `out/`:

1. **The VS Code extension** (`out/extension.js`, entry `src/extension.ts`) — activates on startup (`onStartupFinished`), wires up all commands, providers, and the connection lifecycle.
2. **The MCP server** (`out/mcp-server.js`, entry `src/mcp-server.ts`) — a standalone Node process launched by Claude Code via `.mcp.json`. It does **not** import the extension; it re-implements its own Dataverse fetch helpers.

### Connection & auth flow

`ConnectionManager` (`src/connectionManager.ts`) is the single source of truth for connection state and fires `onDidChangeConnection` — nearly every component subscribes to it (status bar, webview, MCP bridge, and the `d365.connected` context key that drives menu visibility). It holds an `AuthProvider` (`src/auth/`):

- `UserAuthProvider` delegates to VS Code's built-in `microsoft` authentication provider (MSAL under the hood). **Key distinction:** `getAccessToken()` must stay silent (called on every request); `selectAccount()` forces the account picker (only for explicit connect / switch-account actions). Do not swap one for the other.
- `ClientCredentialsProvider` does app-only auth; the client secret lives in VS Code `context.secrets` (OS keychain), keyed by `d365.clientSecret.<envUrl>.<clientId>`.

Connection state persists in `workspaceState` (per-workspace — each window connects independently) and a recent-environments list in `globalState`. `tryRestoreConnection()` runs on activation and silently reconnects, or offers a reconnect prompt on failure.

### Data access

`DataverseClient` (`src/dataverseClient.ts`) is the extension's Web API wrapper. It hits `/api/data/v9.2/`, pulls a fresh token from `ConnectionManager` on every request, handles OData `@odata.nextLink` paging, and maps raw Dataverse metadata (`EntityDefinitions`, `Attributes`, `solutioncomponents`, `webresourceset`, etc.) into the clean domain types `EntityDefinition` / `AttributeDefinition` / `OptionValue`.

Option-set attributes (`Picklist`, `State`, `Status`) need a `$expand` on an OData cast type — see the `OPTION_SET_CAST` map. Labels come through a localized-label shape; `extractLabel()` resolves them (UserLocalizedLabel → LanguageCode 1033 → first).

### Code generation

`src/interfaceGenerator.ts` is pure, dependency-free, and shared by both the extension and the MCP server — the reason it has no `vscode` import. It maps Dataverse attribute types to TypeScript, emits lookup fields as `_logicalname_value` with a companion `@OData.Community.Display.V1.FormattedValue` annotation, and generates `const enum`s from option sets. This is the most test-covered module; keep it side-effect free.

### MCP bridge (extension ↔ MCP server)

The MCP server is a separate process with no VS Code session, so it can't authenticate on its own. The bridge (`src/mcpBridge.ts`) solves this:

- When the extension has an active connection, `McpBridge` starts a localhost-only HTTP server on a random port and writes `~/.d365-mcp-bridge` (port + random nonce, mode `0600`).
- `src/mcp-server.ts` reads that file on **every** request and calls `GET /token` (authenticated with the nonce) to get a fresh token + environment URL. No credentials are ever stored by the MCP server.
- Therefore the MCP server only works while VS Code is open **and** the D365 sidebar is connected. `.mcp.json` is written only when the user runs `D365: Configure MCP Server for this Workspace` (command `d365.configureMcp`) — never automatically.

The five MCP tools mirror the extension's own capabilities (`list_entities`, `get_entity_attributes`, `get_option_values`, `generate_interface`, `generate_enum`).

### UI surfaces

- `entityExplorerWebview.ts` — the sidebar is a **webview** (not a TreeView). Extension ↔ webview communication is message-passing via `post()` / `onDidReceiveMessage`; the HTML/CSS/JS is inlined in `buildHtml()`.
- `d365CodeActionProvider.ts` — the `d365`-autocomplete and `// @d365 <entity>` lightbulb paths for generating interfaces inline in TS/JS files, both routing through the `d365.codeAction.insertInterface` command.
- `webResourceManager.ts` — publish/compare local files as Dataverse web resources; `TYPE_BY_EXTENSION` maps file extensions to Dataverse web resource type codes, and a `TextDocumentContentProvider` (`DIFF_SCHEME`) backs the server-diff feature.
- `statusBar.ts` — connection indicator + `showD365Menu` quick-pick.

## Testing

Unit tests are Mocha + Sinon under `test/unit/`, run through `ts-node` (see `.mocharc.json`). There is **no** `vscode` module outside the Extension Host, so `test/mocks/register.js` patches `Module._load` to redirect `require('vscode')` to the hand-written mock in `test/mocks/vscode.ts`. When testing code that imports new `vscode` APIs, extend that mock rather than reaching for the real module. `test/tsconfig.json` compiles tests as CommonJS separately from the extension's Node16 build.
