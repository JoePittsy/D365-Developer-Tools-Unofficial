import type { RpcOp, RpcRequestMap, RpcResponse } from './protocol';
import { postRaw } from './vscodeApi';

// Promise-based request/response layer over the webview postMessage transport. The extension
// host echoes each request's id back on a { kind: 'response', id, … } envelope, letting us
// resolve the matching promise — this is what lets TanStack Query treat extension data as a
// normal async queryFn.

let nextId = 1;
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

window.addEventListener('message', (e: MessageEvent<RpcResponse>) => {
  const m = e.data;
  if (!m || m.kind !== 'response') { return; }
  const entry = pending.get(m.id);
  if (!entry) { return; }
  pending.delete(m.id);
  if (m.ok) { entry.resolve(m.data); }
  else { entry.reject(new Error(m.error)); }
});

/** Send an RPC request to the extension host and await its typed result. */
export function request<Op extends RpcOp>(
  op: Op,
  params: RpcRequestMap[Op]['params'],
): Promise<RpcRequestMap[Op]['result']> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    postRaw({ kind: 'request', id, op, params });
  });
}
