import type { UseQueryResult } from '@tanstack/react-query';
import type { AttributeInfo } from '../protocol';
import { LoadingMessage } from './Spinner';
import { AttributeRow } from './AttributeRow';

interface Props {
  query: UseQueryResult<AttributeInfo[], Error>;
  onAttrContextMenu: (attr: AttributeInfo, x: number, y: number) => void;
}

export function AttributeList({ query, onAttrContextMenu }: Props) {
  const { isPending, isError, error, data } = query;
  let body: React.ReactNode;

  if (isPending) {
    body = <LoadingMessage label="Loading…" />;
  } else if (isError) {
    body = <div className="message error">{error.message}</div>;
  } else if (!data || !data.length) {
    body = <div className="message">No attributes found.</div>;
  } else {
    body = data.map(a => <AttributeRow key={a.logicalName} attr={a} onContextMenu={onAttrContextMenu} />);
  }

  return <div className="attributes">{body}</div>;
}
