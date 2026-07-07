import type { AttributeInfo, EntityInfo } from '../protocol';
import type { ExtensionState } from '../hooks/useExtensionState';
import { iconKey } from '../helpers';
import { LoadingMessage } from './Spinner';
import { EntityRow } from './EntityRow';
import type { ContextTarget } from './ContextMenu';

interface Props {
  state: ExtensionState;
  entities: EntityInfo[];
  requestIcon: (key: string) => void;
  onToggle: (logicalName: string) => void;
  onOpenContextMenu: (target: ContextTarget, x: number, y: number) => void;
}

export function EntityList({ state, entities, requestIcon, onToggle, onOpenContextMenu }: Props) {
  if (state.entitiesLoading) {
    return <div id="entity-list"><LoadingMessage label="Loading entities…" /></div>;
  }
  if (state.entitiesError) {
    return <div id="entity-list"><div className="message error">{state.entitiesError}</div></div>;
  }
  if (!entities.length) {
    return <div id="entity-list"><div className="message">No entities match the current filters.</div></div>;
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
    <div id="entity-list">
      {entities.map(e => {
        const key = iconKey(e);
        return (
          <EntityRow
            key={e.logicalName}
            entity={e}
            isExpanded={state.expanded.has(e.logicalName)}
            attrEntry={state.attrCache[e.logicalName]}
            iconSvg={key ? state.iconCache[key] : undefined}
            requestIcon={requestIcon}
            onToggle={onToggle}
            onEntityContextMenu={onEntityContextMenu}
            onAttrContextMenu={onAttrContextMenu(e.logicalName)}
          />
        );
      })}
    </div>
  );
}
