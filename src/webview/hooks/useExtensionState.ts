import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { AttributeInfo, EntityInfo, InboundMessage } from '../protocol';
import { post } from '../vscodeApi';
import { decodeSvg } from '../helpers';

export interface AttrEntry {
  data?: AttributeInfo[];
  loading?: boolean;
  error?: string;
}

export interface SolutionFilter {
  name: string;
  entityIds: Set<string>;
}

export interface ExtensionState {
  connected: boolean;
  restoring: boolean;
  entitiesLoading: boolean;
  entities: EntityInfo[];
  entitiesError: string | null;
  attrCache: Record<string, AttrEntry>;
  expanded: Set<string>;
  /** decoded SVG markup keyed by icon key */
  iconCache: Record<string, string>;
  solutionFilter: SolutionFilter | null;
}

const initialState: ExtensionState = {
  connected: false,
  restoring: false,
  entitiesLoading: false,
  entities: [],
  entitiesError: null,
  attrCache: {},
  expanded: new Set(),
  iconCache: {},
  solutionFilter: null,
};

type Action =
  | InboundMessage
  | { type: 'local/expand'; logicalName: string }
  | { type: 'local/collapse'; logicalName: string }
  | { type: 'local/clearSolution' };

function reducer(state: ExtensionState, action: Action): ExtensionState {
  switch (action.type) {
    case 'connectionState':
      return { ...state, connected: action.connected, restoring: action.restoring };

    case 'entitiesLoading':
      return { ...state, entitiesLoading: true, entitiesError: null };

    case 'entities':
      // Fresh entity set: reset per-environment caches (icons/attrs/expansion).
      return {
        ...state,
        entities: action.data,
        entitiesLoading: false,
        entitiesError: null,
        attrCache: {},
        expanded: new Set(),
        iconCache: {},
      };

    case 'entitiesError':
      return { ...state, entitiesLoading: false, entitiesError: action.message };

    case 'iconLoaded':
      return { ...state, iconCache: { ...state.iconCache, [action.key]: decodeSvg(action.content) } };

    case 'attributes':
      return { ...state, attrCache: { ...state.attrCache, [action.entityLogicalName]: { data: action.data } } };

    case 'attributesError':
      return { ...state, attrCache: { ...state.attrCache, [action.entityLogicalName]: { error: action.message } } };

    case 'solutionFilter':
      return { ...state, solutionFilter: { name: action.name, entityIds: new Set(action.entityIds) } };

    case 'local/clearSolution':
      return { ...state, solutionFilter: null };

    case 'local/expand': {
      const expanded = new Set(state.expanded);
      expanded.add(action.logicalName);
      const cached = state.attrCache[action.logicalName];
      const attrCache = cached
        ? state.attrCache
        : { ...state.attrCache, [action.logicalName]: { loading: true } };
      return { ...state, expanded, attrCache };
    }

    case 'local/collapse': {
      const expanded = new Set(state.expanded);
      expanded.delete(action.logicalName);
      return { ...state, expanded };
    }

    default:
      return state;
  }
}

export interface ExtensionApi {
  state: ExtensionState;
  connect(): void;
  toggleEntity(logicalName: string): void;
  showSolutionPicker(): void;
  clearSolutionFilter(): void;
  requestIcon(key: string): void;
  makeInterface(entityLogicalName: string, entityDisplayName: string): void;
  makeEnum(
    entityLogicalName: string,
    attributeLogicalName: string,
    attributeDisplayName: string,
    attributeType: string,
  ): void;
}

export function useExtensionState(): ExtensionApi {
  const [state, dispatch] = useReducer(reducer, initialState);
  // Icon keys already requested from the extension (dedupe across re-renders/scroll).
  const iconRequested = useRef<Set<string>>(new Set());
  // Always-current mirror of state so stable callbacks can read the latest without re-binding.
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const onMessage = (e: MessageEvent<InboundMessage>) => {
      const m = e.data;
      if (m && typeof m.type === 'string') { dispatch(m); }
      // Re-requesting icons is possible after an `entities` reset; clear the dedupe set.
      if (m?.type === 'entities') { iconRequested.current = new Set(); }
    };
    window.addEventListener('message', onMessage);
    post({ type: 'ready' });
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const connect = useCallback(() => post({ type: 'connect' }), []);
  const showSolutionPicker = useCallback(() => post({ type: 'showSolutionPicker' }), []);
  const clearSolutionFilter = useCallback(() => dispatch({ type: 'local/clearSolution' }), []);

  const toggleEntity = useCallback((logicalName: string) => {
    const s = stateRef.current;
    if (s.expanded.has(logicalName)) {
      dispatch({ type: 'local/collapse', logicalName });
    } else {
      // Fetch attributes only the first time this entity is expanded.
      if (!s.attrCache[logicalName]) { post({ type: 'loadAttributes', entityLogicalName: logicalName }); }
      dispatch({ type: 'local/expand', logicalName });
    }
  }, []);

  const requestIcon = useCallback((key: string) => {
    if (!key || iconRequested.current.has(key)) { return; }
    iconRequested.current.add(key);
    post({ type: 'loadIcon', key });
  }, []);

  const makeInterface = useCallback((entityLogicalName: string, entityDisplayName: string) => {
    post({ type: 'makeInterface', entityLogicalName, entityDisplayName });
  }, []);

  const makeEnum = useCallback(
    (entityLogicalName: string, attributeLogicalName: string, attributeDisplayName: string, attributeType: string) => {
      post({ type: 'makeEnum', entityLogicalName, attributeLogicalName, attributeDisplayName, attributeType });
    },
    [],
  );

  return {
    state,
    connect,
    toggleEntity,
    showSolutionPicker,
    clearSolutionFilter,
    requestIcon,
    makeInterface,
    makeEnum,
  };
}
