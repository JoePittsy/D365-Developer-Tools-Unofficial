import type { AttributeInfo } from '../protocol';
import type { AttrEntry } from '../hooks/useExtensionState';
import { LoadingMessage } from './Spinner';
import { AttributeRow } from './AttributeRow';

interface Props {
  entry: AttrEntry | undefined;
  onAttrContextMenu: (attr: AttributeInfo, x: number, y: number) => void;
}

export function AttributeList({ entry, onAttrContextMenu }: Props) {
  let body: React.ReactNode;

  if (!entry || entry.loading) {
    body = <LoadingMessage label="Loading…" />;
  } else if (entry.error) {
    body = <div className="message error">{entry.error}</div>;
  } else if (!entry.data || !entry.data.length) {
    body = <div className="message">No attributes found.</div>;
  } else {
    body = entry.data.map(a => (
      <AttributeRow key={a.logicalName} attr={a} onContextMenu={onAttrContextMenu} />
    ));
  }

  return <div className="attributes">{body}</div>;
}
