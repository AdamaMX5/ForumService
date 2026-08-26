// Mirrors src/utils/serialize.js on the backend exactly - field names are the wire contract,
// do not rename/translate them.

export type EdgeTyp = 'pro' | 'contra' | 'differenzierung';

export interface TextVersion {
  version: number;
  text: string;
  autor_id: string;
  datum: string;
}

export interface Anhang {
  typ: 'bild' | 'link' | 'studie' | 'quelle';
  url: string;
  titel?: string;
  hinzugefuegt_von: string;
  datum: string;
}

export type NodeTyp = 'thema' | 'argument';
export type Sichtbarkeit = 'oeffentlich' | 'privat';
export type SortMode = 'neu' | 'likes' | 'beste';

export interface ForumNode {
  id: string;
  typ: NodeTyp;
  texte: {
    neutral: TextVersion | null;
    pro: TextVersion | null;
    contra: TextVersion | null;
  };
  tags: string[];
  anhaenge: Anhang[];
  ersteller_id: string;
  erstellt_am: string;
  likes_count: number;
  comments_count: number;
  bearbeitet_von: string[];
  soft_deleted: boolean;
  soft_deleted_grund?: string;
  soft_deleted_von?: string;
  // Only present on typ: "thema" (see serializeNode).
  sichtbarkeit?: Sichtbarkeit;
  // true/false when the request was authenticated, null when anonymous (unknown) - see
  // GET /nodes/:id, GET /nodes/:id/kinder, GET /themen.
  liked_by_me: boolean | null;
}

// Returned only from GET /nodes/:id/kinder and GET /nodes/:id/pfad - which pro/contra/
// differenzierung edge connects this node to its parent. null for the thema root in a /pfad
// response (it has no parent edge).
export interface ForumChildNode extends ForumNode {
  edge_typ: EdgeTyp | null;
}

// Returned only from GET /nodes/:id/referenzen - the target node of an outgoing `referenz` edge,
// plus metadata about the edge itself.
export interface ReferenzListItem extends ForumNode {
  referenz: { id: string; erstellt_am: string; autor_id: string };
}

export interface ForumComment {
  id: string;
  node_id: string;
  parent_comment_id: string | null;
  text: string | null;
  autor_id: string;
  erstellt_am: string;
  soft_deleted: boolean;
}

export interface Paginated<T> {
  data: T[];
  nextCursor: string | null;
}

export interface ReferenzEdge {
  id: string;
  von: string;
  zu: string;
  typ: 'referenz';
}

export interface NewNodeInput {
  typ: NodeTyp;
  texte: { neutral?: string; pro?: string; contra?: string };
  tags?: string[];
  anhaenge?: Array<{ typ: Anhang['typ']; url: string; titel?: string }>;
  parent_id?: string;
  edge_typ?: EdgeTyp;
}
