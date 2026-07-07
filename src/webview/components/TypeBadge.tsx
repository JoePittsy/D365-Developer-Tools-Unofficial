import { shortType, typeClass } from '../helpers';

export function TypeBadge({ attributeType }: { attributeType: string }) {
  return <span className={'type-badge ' + typeClass(attributeType)}>{shortType(attributeType)}</span>;
}
