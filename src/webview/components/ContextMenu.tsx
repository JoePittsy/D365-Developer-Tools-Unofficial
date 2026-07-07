import { useLayoutEffect, useRef, useState } from 'react';

export type ContextTarget =
  | { kind: 'entity'; logicalName: string; displayName: string }
  | {
      kind: 'attr';
      entityLogicalName: string;
      attributeLogicalName: string;
      attributeDisplayName: string;
      attributeType: string;
    };

interface Props {
  target: ContextTarget;
  x: number;
  y: number;
  onClose: () => void;
  onMakeInterface: (logicalName: string, displayName: string) => void;
  onMakeEnum: (
    entityLogicalName: string,
    attributeLogicalName: string,
    attributeDisplayName: string,
    attributeType: string,
  ) => void;
}

export function ContextMenu({ target, x, y, onClose, onMakeInterface, onMakeEnum }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  // Clamp within the viewport once we know the rendered size (ports showCtx()).
  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) { return; }
    const r = menu.getBoundingClientRect();
    let nx = x;
    let ny = y;
    if (x + r.width > window.innerWidth) { nx = x - r.width; }
    if (y + r.height > window.innerHeight) { ny = y - r.height; }
    setPos({ x: nx, y: ny });
  }, [x, y]);

  // Dismiss on outside click, scroll, or Escape.
  useLayoutEffect(() => {
    const close = () => onClose();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { onClose(); } };
    document.addEventListener('click', close);
    document.addEventListener('scroll', close, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('scroll', close, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const handleInterface = () => {
    onClose();
    if (target.kind === 'entity') { onMakeInterface(target.logicalName, target.displayName); }
  };
  const handleEnum = () => {
    onClose();
    if (target.kind === 'attr') {
      onMakeEnum(
        target.entityLogicalName,
        target.attributeLogicalName,
        target.attributeDisplayName,
        target.attributeType,
      );
    }
  };

  return (
    <div id="ctx-menu" ref={menuRef} style={{ left: pos.x, top: pos.y }}>
      {target.kind === 'entity' && <button onClick={handleInterface}>Make Interface</button>}
      {target.kind === 'attr' && <button onClick={handleEnum}>Make Enum</button>}
    </div>
  );
}
