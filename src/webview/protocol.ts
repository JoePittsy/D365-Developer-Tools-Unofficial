// Message protocol between the extension host (entityExplorerWebview.ts) and this webview.
// Kept webview-local (a subset of the extension's domain types) so the webview tsconfig
// doesn't have to resolve the extension's Node/`vscode` imports.

export interface EntityInfo {
  metadataId: string;
  logicalName: string;
  displayName: string;
  /** Logical name of the SVG web resource used as this table's icon, if any. */
  iconVectorName?: string;
  /** Numeric entity type code — resolves the built-in /_imgs/svg_<otc>.svg icon. */
  objectTypeCode?: number;
}

export interface AttributeInfo {
  logicalName: string;
  displayName: string;
  attributeType: string;
  isPrimaryId: boolean;
  isPrimaryName: boolean;
}

// ── Extension → Webview ───────────────────────────────────────────────────────
export type InboundMessage =
  | { type: 'connectionState'; connected: boolean; restoring: boolean }
  | { type: 'entitiesLoading' }
  | { type: 'entities'; data: EntityInfo[] }
  | { type: 'iconLoaded'; key: string; content: string }
  | { type: 'entitiesError'; message: string }
  | { type: 'attributes'; entityLogicalName: string; data: AttributeInfo[] }
  | { type: 'attributesError'; entityLogicalName: string; message: string }
  | { type: 'solutionFilter'; name: string; entityIds: string[] };

// ── Webview → Extension ───────────────────────────────────────────────────────
export type OutboundMessage =
  | { type: 'ready' }
  | { type: 'connect' }
  | { type: 'loadAttributes'; entityLogicalName: string }
  | { type: 'loadIcon'; key: string }
  | { type: 'showSolutionPicker' }
  | { type: 'makeInterface'; entityLogicalName: string; entityDisplayName: string }
  | {
      type: 'makeEnum';
      entityLogicalName: string;
      attributeLogicalName: string;
      attributeDisplayName: string;
      attributeType: string;
    };
