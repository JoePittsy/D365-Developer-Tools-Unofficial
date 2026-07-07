import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { AttributeInfo, EntityInfo } from '../protocol';
import type { ExtensionState } from '../hooks/useExtensionState';
import { LoadingMessage } from './Spinner';
import { EntityRow } from './EntityRow';
import type { ContextTarget } from './ContextMenu';

interface Props {
  state: ExtensionState;
  entities: EntityInfo[];
  onToggle: (logicalName: string) => void;
  onOpenContextMenu: (target: ContextTarget, x: number, y: number) => void;
}

export function EntityList({ state, entities, onToggle, onOpenContextMenu }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Window the list so large orgs (1000s of tables) stay smooth. Rows have variable height
  // (a row grows when expanded to show its attributes), so we rely on dynamic measurement
  // via measureElement rather than a fixed row size.
  const virtualizer = useVirtualizer({
    count: entities.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 24,
    overscan: 12,
  });

  let body: React.ReactNode = null;
  if (state.entitiesLoading) {
    body = <LoadingMessage label="Loading entities…" />;
  } else if (state.entitiesError) {
    body = <div className="message error">{state.entitiesError}</div>;
  } else if (!entities.length) {
    body = <div className="message">No entities match the current filters.</div>;
  }

  if (body) {
    return <div className="list-scroll" ref={parentRef}>{body}</div>;
  }

  const onEntityContextMenu = (entity: EntityInfo, x: number, y: number) =>
    onOpenContextMenu(
      { kind: 'entity', logicalName: entity.logicalName, displayName: entity.displayName || entity.logicalName },
      x,
      y,
    );

  const onAttrContextMenu = (entityLogicalName: string) => (attr: AttributeInfo, x: number, y: number) =>
    onOpenContextMenu(
      {
        kind: 'attr',
        entityLogicalName,
        attributeLogicalName: attr.logicalName,
        attributeDisplayName: attr.displayName || attr.logicalName,
        attributeType: attr.attributeType,
      },
      x,
      y,
    );

  return (
    <div className="list-scroll" ref={parentRef}>
      <div id="entity-list" style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map(vi => {
          const e = entities[vi.index];
          return (
            <div
              key={e.logicalName}
              data-index={vi.index}
              ref={virtualizer.measureElement}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vi.start}px)` }}
            >
              <EntityRow
                entity={e}
                isExpanded={state.expanded.has(e.logicalName)}
                onToggle={onToggle}
                onEntityContextMenu={onEntityContextMenu}
                onAttrContextMenu={onAttrContextMenu(e.logicalName)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
