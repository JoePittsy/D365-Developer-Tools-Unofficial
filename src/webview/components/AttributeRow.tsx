import type { AttributeInfo } from '../protocol';
import { OPTION_SET_TYPES } from '../helpers';
import { TypeBadge } from './TypeBadge';

interface Props {
  attr: AttributeInfo;
  onContextMenu: (attr: AttributeInfo, x: number, y: number) => void;
}

export function AttributeRow({ attr, onContextMenu }: Props) {
  const marker = attr.isPrimaryId
    ? <span className="pk-marker" title="Primary ID">⚿</span>
    : attr.isPrimaryName
      ? <span className="pk-marker" title="Primary Name">✎</span>
      : null;

  const handleContextMenu = (e: React.MouseEvent) => {
    // Only option-set attributes have a context action (Make Enum) — leave others alone.
    if (!OPTION_SET_TYPES.has(attr.attributeType)) { return; }
    e.preventDefault();
    onContextMenu(attr, e.clientX, e.clientY);
  };

  return (
    <div className="attr-row" onContextMenu={handleContextMenu}>
      {marker}
      <span className="attr-name">{attr.displayName || attr.logicalName}</span>
      <span className="attr-lname">{attr.logicalName}</span>
      <TypeBadge attributeType={attr.attributeType} />
    </div>
  );
}
