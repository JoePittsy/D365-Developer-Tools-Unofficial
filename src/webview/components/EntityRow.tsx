import type { AttributeInfo, EntityInfo } from '../protocol';
import type { AttrEntry } from '../hooks/useExtensionState';
import { iconKey } from '../helpers';
import { EntityIcon } from './EntityIcon';
import { AttributeList } from './AttributeList';

interface Props {
  entity: EntityInfo;
  isExpanded: boolean;
  attrEntry: AttrEntry | undefined;
  iconSvg?: string;
  requestIcon: (key: string) => void;
  onToggle: (logicalName: string) => void;
  onEntityContextMenu: (entity: EntityInfo, x: number, y: number) => void;
  onAttrContextMenu: (attr: AttributeInfo, x: number, y: number) => void;
}

export function EntityRow({
  entity,
  isExpanded,
  attrEntry,
  iconSvg,
  requestIcon,
  onToggle,
  onEntityContextMenu,
  onAttrContextMenu,
}: Props) {
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    onEntityContextMenu(entity, e.clientX, e.clientY);
  };

  return (
    <div>
      <div
        className={'entity-header' + (isExpanded ? ' expanded' : '')}
        onClick={() => onToggle(entity.logicalName)}
        onContextMenu={handleContextMenu}
      >
        <EntityIcon iconKey={iconKey(entity)} svg={iconSvg} requestIcon={requestIcon} />
        <span className="entity-name">{entity.displayName || entity.logicalName}</span>
        <span className="entity-lname">{entity.logicalName}</span>
      </div>
      {isExpanded && <AttributeList entry={attrEntry} onAttrContextMenu={onAttrContextMenu} />}
    </div>
  );
}
