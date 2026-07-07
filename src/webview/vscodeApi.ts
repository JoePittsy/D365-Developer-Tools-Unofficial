import type { OutboundMessage } from './protocol';

interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

const vscode = acquireVsCodeApi();

/** Post a typed message to the extension host. */
export function post(message: OutboundMessage): void {
  vscode.postMessage(message);
}
