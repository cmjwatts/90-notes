import type { ItemType } from '../lib/types.ts';

interface Props {
  type: ItemType;
}

const TYPE_LABEL: Record<ItemType, string> = {
  issue: 'Issue',
  todo: 'To-Do',
  headline: 'Headline',
};

const TYPE_GLYPH: Record<ItemType, string> = {
  issue: '!',
  todo: '✓',
  headline: '★',
};

export function TypeChip({ type }: Props) {
  return (
    <span className="type-chip">
      <span className="glyph">{TYPE_GLYPH[type]}</span>
      {TYPE_LABEL[type]}
    </span>
  );
}
