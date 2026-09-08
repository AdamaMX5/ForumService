import type { ForumNode } from '../api/types';

export type TextColumn = 'neutral' | 'pro' | 'contra';

/**
 * Every node created via NewThemaModal/NewArgumentForm only ever populates `texte.neutral`, but
 * a node can in principle carry any subset of the three columns - this is the single fallback
 * order (neutral -> pro -> contra) used everywhere a node's "the" displayed/edited text is
 * derived from its `texte` map, so all call sites agree on which column is "the" text.
 */
export function primaryTextColumn(texte: ForumNode['texte']): TextColumn {
  if (texte.neutral) return 'neutral';
  if (texte.pro) return 'pro';
  if (texte.contra) return 'contra';
  return 'neutral';
}

export function primaryText(texte: ForumNode['texte']): string {
  return texte[primaryTextColumn(texte)]?.text ?? '';
}
