import type { EdgeTyp, ForumComment, ForumNode } from '../api/types';

// In-memory demo dataset for VITE_USE_MOCKS=true, so `npm run dev` (and the ultra light preview
// in tests) can render a realistic ForumThread without a live backend/AuthService. Not used in
// production builds.

export interface MockEdge {
  von: string;
  zu: string;
  typ: EdgeTyp | 'referenz';
}

function textVersion(text: string, autor = 'user-1') {
  return { version: 1, text, autor_id: autor, datum: new Date('2026-01-05T10:00:00Z').toISOString() };
}

function node(
  id: string,
  typ: ForumNode['typ'],
  overrides: Partial<ForumNode> & { neutral?: string; pro?: string; contra?: string }
): ForumNode {
  const { neutral, pro, contra, ...rest } = overrides;
  return {
    id,
    typ,
    texte: {
      neutral: neutral ? textVersion(neutral) : null,
      pro: pro ? textVersion(pro) : null,
      contra: contra ? textVersion(contra) : null,
    },
    tags: [],
    anhaenge: [],
    ersteller_id: 'user-1',
    erstellt_am: new Date('2026-01-05T10:00:00Z').toISOString(),
    likes_count: 0,
    comments_count: 0,
    bearbeitet_von: [],
    soft_deleted: false,
    ...(typ === 'thema' ? { sichtbarkeit: 'oeffentlich' as const } : {}),
    ...rest,
  };
}

export const mockNodes = new Map<string, ForumNode>(
  [
    node('t1', 'thema', {
      neutral: 'Sollte auf deutschen Autobahnen ein generelles Tempolimit von 130 km/h gelten?',
      tags: ['Verkehr', 'Klimaschutz'],
      likes_count: 42,
      comments_count: 3,
    }),
    node('a1', 'argument', { neutral: 'Ein Tempolimit senkt den CO2-Ausstoss messbar.', likes_count: 18, comments_count: 1 }),
    node('a2', 'argument', { neutral: 'Weniger Unfaelle mit schwerem Ausgang bei einheitlicher Geschwindigkeit.', likes_count: 9 }),
    node('a3', 'argument', { neutral: 'Deutschland ist eines der letzten Laender ohne generelles Limit - andere zeigen es geht auch so.', likes_count: 5 }),
    node('a4', 'argument', { neutral: 'Die individuelle Freiheit auf der Autobahn ist ein Teil der Verkehrskultur.', likes_count: 12 }),
    node('a5', 'argument', { neutral: 'Die Unfallstatistik zeigt keinen eindeutigen Zusammenhang mit der Hoechstgeschwindigkeit.', likes_count: 7 }),
    node('a6', 'argument', { neutral: 'Der CO2-Effekt haengt stark vom Fahrverhalten ab, nicht nur vom Limit selbst - manche Studien zeigen kleinere Einspareffekte als erwartet.', likes_count: 4 }),
    node('a7', 'argument', { neutral: 'Selbst bei 130 km/h bleibt der Bremsweg deutlich laenger als bei Landstrassentempo.', likes_count: 2 }),
  ].map((n) => [n.id, n])
);

export const mockEdges: MockEdge[] = [
  { von: 'a1', zu: 't1', typ: 'pro' },
  { von: 'a2', zu: 't1', typ: 'pro' },
  { von: 'a3', zu: 't1', typ: 'pro' },
  { von: 'a4', zu: 't1', typ: 'contra' },
  { von: 'a5', zu: 't1', typ: 'contra' },
  { von: 'a6', zu: 't1', typ: 'differenzierung' },
  { von: 'a7', zu: 'a1', typ: 'differenzierung' },
];

export const mockComments: ForumComment[] = [
  {
    id: 'c1',
    node_id: 't1',
    parent_comment_id: null,
    text: 'Gibt es dazu auch Zahlen aus Frankreich, die schon lange ein Limit haben?',
    autor_id: 'user-2',
    erstellt_am: new Date('2026-01-06T09:00:00Z').toISOString(),
    soft_deleted: false,
  },
  {
    id: 'c2',
    node_id: 't1',
    parent_comment_id: 'c1',
    text: 'Ja, das waere ein gutes Argument fuer den Pro-Zweig.',
    autor_id: 'user-1',
    erstellt_am: new Date('2026-01-06T09:15:00Z').toISOString(),
    soft_deleted: false,
  },
  {
    id: 'c3',
    node_id: 't1',
    parent_comment_id: null,
    text: 'Danke fuer die sachliche Aufbereitung!',
    autor_id: 'user-3',
    erstellt_am: new Date('2026-01-07T12:00:00Z').toISOString(),
    soft_deleted: false,
  },
];

export const mockDemoUser = { email: 'demo@flussmark.de', password: 'demo1234' };
