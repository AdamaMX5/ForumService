import { http, HttpResponse } from 'msw';
import type { EdgeTyp, ForumChildNode, ForumComment, ForumNode, ReferenzListItem } from '../api/types';
import { mockComments, mockDemoUser, mockEdges, mockNodes } from './data';

const TREE_EDGE_TYPES: EdgeTyp[] = ['pro', 'contra', 'differenzierung'];

// Mirrors the backend's per-request-authenticated liked_by_me semantics (null = anonymous,
// boolean = authenticated) closely enough for local dev/demo - tracked per node id here since the
// mock has no real per-user session concept.
const mockLikedNodeIds = new Set<string>();

function isAuthenticated(request: Request): boolean {
  return request.headers.get('Authorization') !== null;
}

function withLikedByMe<T extends ForumNode>(node: T, request: Request): T {
  return { ...node, liked_by_me: isAuthenticated(request) ? mockLikedNodeIds.has(node.id) : null };
}

// --- tiny fake JWT (unsigned, decode-only - real signature verification never happens client-side) ---
function base64UrlEncode(obj: unknown): string {
  const json = JSON.stringify(obj);
  return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function makeFakeAccessToken(email: string): string {
  const header = base64UrlEncode({ alg: 'none', typ: 'JWT' });
  const payload = base64UrlEncode({
    sub: 'mock-user-1',
    email,
    roles: [],
    permissions: {},
    exp: Math.floor(Date.now() / 1000) + 15 * 60,
    iat: Math.floor(Date.now() / 1000),
  });
  return `${header}.${payload}.mock-signature`;
}

// Simulates the AuthService refresh_token cookie session, scoped to this mock module only.
let mockSessionActive = false;

// --- pagination helpers (index-based cursor, mock-only encoding - unrelated to the backend's) ---
function encodeCursor(index: number): string {
  return btoa(String(index));
}
function decodeCursor(cursor: string | null): number {
  if (!cursor) return 0;
  try {
    return parseInt(atob(cursor), 10) || 0;
  } catch {
    return 0;
  }
}
function paginate<T>(items: T[], cursor: string | null, limit: number): { data: T[]; nextCursor: string | null } {
  const start = decodeCursor(cursor);
  const page = items.slice(start, start + limit);
  const nextIndex = start + limit;
  return { data: page, nextCursor: nextIndex < items.length ? encodeCursor(nextIndex) : null };
}

function sortNodes(nodes: ForumNode[], sort: string | null): ForumNode[] {
  const copy = [...nodes];
  if (sort === 'neu') return copy.sort((a, b) => b.erstellt_am.localeCompare(a.erstellt_am));
  return copy.sort((a, b) => b.likes_count - a.likes_count); // 'likes' and 'beste' (mock simplification)
}

const authUrl = (path: string) => `*${path}`;
const forumUrl = (path: string) => `*${path}`;

export const handlers = [
  // --- AuthService mocks ---
  http.post(authUrl('/user/check-email'), async ({ request }) => {
    const { email } = (await request.json()) as { email: string };
    return HttpResponse.json({ status: email === mockDemoUser.email ? 'login' : 'register' });
  }),

  http.post(authUrl('/user/login'), async ({ request }) => {
    const { email, password } = (await request.json()) as { email: string; password: string };
    if (email !== mockDemoUser.email || password !== mockDemoUser.password) {
      return HttpResponse.json({ error: 'Ungueltige Zugangsdaten (Demo: demo@flussmark.de / demo1234)' }, { status: 401 });
    }
    mockSessionActive = true;
    return HttpResponse.json({
      id: 'mock-user-1',
      email,
      roles: [],
      access_token: makeFakeAccessToken(email),
      status: 'login',
    });
  }),

  http.post(authUrl('/user/register-complete'), async ({ request }) => {
    const { email, password, repassword } = (await request.json()) as {
      email: string;
      password: string;
      repassword: string;
    };
    if (password !== repassword) {
      return HttpResponse.json({ error: 'Passwoerter stimmen nicht ueberein' }, { status: 400 });
    }
    mockSessionActive = true;
    return HttpResponse.json({
      id: 'mock-user-2',
      email,
      roles: [],
      access_token: makeFakeAccessToken(email),
      status: 'login',
    });
  }),

  http.post(authUrl('/user/refresh'), () => {
    if (!mockSessionActive) return HttpResponse.json({ error: 'No session' }, { status: 401 });
    return HttpResponse.json({ access_token: makeFakeAccessToken(mockDemoUser.email) });
  }),

  http.post(authUrl('/user/logout'), () => {
    mockSessionActive = false;
    return HttpResponse.json({ status: 'ok' });
  }),

  // --- ForumService mocks ---
  http.get(forumUrl('/themen'), ({ request }) => {
    const url = new URL(request.url);
    const themen = [...mockNodes.values()]
      .filter((n) => n.typ === 'thema' && !n.soft_deleted)
      .map((n) => withLikedByMe(n, request));
    const sorted = sortNodes(themen, url.searchParams.get('sort'));
    return HttpResponse.json(paginate(sorted, url.searchParams.get('cursor'), Number(url.searchParams.get('limit')) || 20));
  }),

  http.get(forumUrl('/nodes/:id/kinder'), ({ request, params }) => {
    const url = new URL(request.url);
    const parentId = params.id as string;
    const typFilter = url.searchParams.get('typ') as EdgeTyp | null;
    const edgeTypes: EdgeTyp[] = typFilter ? [typFilter] : TREE_EDGE_TYPES;

    const childEdges = mockEdges.filter((e) => e.zu === parentId && edgeTypes.includes(e.typ as EdgeTyp));
    const children: ForumChildNode[] = childEdges
      .map((e): ForumChildNode | null => {
        const n = mockNodes.get(e.von);
        if (!n || n.soft_deleted) return null;
        return { ...withLikedByMe(n, request), edge_typ: e.typ as EdgeTyp };
      })
      .filter((n): n is ForumChildNode => n !== null);

    const sorted = sortNodes(children, url.searchParams.get('sort')) as ForumChildNode[];
    return HttpResponse.json(paginate(sorted, url.searchParams.get('cursor'), Number(url.searchParams.get('limit')) || 20));
  }),

  // Root-to-node ancestor chain (thema first), walking the same pro/contra/differenzierung edges
  // as GET /nodes/:id/kinder but upward via `von` - mirrors the backend's findRootThemaId-style
  // walk (visited-set guarded against malformed/cyclic mock data).
  http.get(forumUrl('/nodes/:id/pfad'), ({ request, params }) => {
    const leafId = params.id as string;
    const leaf = mockNodes.get(leafId);
    if (!leaf || leaf.soft_deleted) return HttpResponse.json({ error: 'Not found' }, { status: 404 });

    const chain: ForumChildNode[] = [{ ...withLikedByMe(leaf, request), edge_typ: null }];
    const visited = new Set([leafId]);
    let currentId = leafId;
    for (let i = 0; i < 50; i += 1) {
      const parentEdge = mockEdges.find((e) => e.von === currentId && TREE_EDGE_TYPES.includes(e.typ as EdgeTyp));
      if (!parentEdge) break;
      const parent = mockNodes.get(parentEdge.zu);
      if (!parent || parent.soft_deleted || visited.has(parentEdge.zu)) break;
      chain[chain.length - 1].edge_typ = parentEdge.typ as EdgeTyp;
      chain.push({ ...withLikedByMe(parent, request), edge_typ: null });
      visited.add(parentEdge.zu);
      currentId = parentEdge.zu;
      if (parent.typ === 'thema') break;
    }
    chain.reverse();
    return HttpResponse.json({ data: chain });
  }),

  // Outgoing `referenz` edges of a node, resolved to their target nodes.
  http.get(forumUrl('/nodes/:id/referenzen'), ({ request, params }) => {
    const sourceId = params.id as string;
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit')) || 50;

    const data: ReferenzListItem[] = mockEdges
      .filter((e) => e.von === sourceId && e.typ === 'referenz')
      .map((e, i): ReferenzListItem | null => {
        const target = mockNodes.get(e.zu);
        if (!target || target.soft_deleted) return null;
        return {
          ...withLikedByMe(target, request),
          referenz: { id: `ref-${sourceId}-${i}`, erstellt_am: target.erstellt_am, autor_id: target.ersteller_id },
        };
      })
      .filter((n): n is ReferenzListItem => n !== null)
      .slice(0, limit);

    return HttpResponse.json({ data });
  }),

  http.get(forumUrl('/nodes/:id/kommentare'), ({ request, params }) => {
    const url = new URL(request.url);
    const nodeId = params.id as string;
    const comments = mockComments
      .filter((c) => c.node_id === nodeId)
      .sort((a, b) => a.erstellt_am.localeCompare(b.erstellt_am));
    return HttpResponse.json(paginate(comments, url.searchParams.get('cursor'), Number(url.searchParams.get('limit')) || 20));
  }),

  http.post(forumUrl('/nodes/:id/kommentare'), async ({ request, params }) => {
    const nodeId = params.id as string;
    const { text, parent_comment_id: parentCommentId } = (await request.json()) as {
      text: string;
      parent_comment_id?: string | null;
    };
    const comment: ForumComment = {
      id: `c${mockComments.length + 1}`,
      node_id: nodeId,
      parent_comment_id: parentCommentId ?? null,
      text,
      autor_id: 'mock-user-1',
      erstellt_am: new Date().toISOString(),
      soft_deleted: false,
    };
    mockComments.push(comment);
    const parent = mockNodes.get(nodeId);
    if (parent) parent.comments_count += 1;
    return HttpResponse.json(comment, { status: 201 });
  }),

  http.post(forumUrl('/nodes/:id/likes'), ({ params }) => {
    const nodeId = params.id as string;
    const node = mockNodes.get(nodeId);
    if (!node) return HttpResponse.json({ error: 'Not found' }, { status: 404 });
    node.likes_count += 1;
    mockLikedNodeIds.add(nodeId);
    return HttpResponse.json({ likes_count: node.likes_count }, { status: 201 });
  }),

  http.delete(forumUrl('/nodes/:id/likes'), ({ params }) => {
    const nodeId = params.id as string;
    const node = mockNodes.get(nodeId);
    if (!node) return HttpResponse.json({ error: 'Not found' }, { status: 404 });
    node.likes_count = Math.max(0, node.likes_count - 1);
    mockLikedNodeIds.delete(nodeId);
    return HttpResponse.json({ likes_count: node.likes_count });
  }),

  http.post(forumUrl('/nodes/:id/referenz'), async ({ request, params }) => {
    const { target_node_id: targetId } = (await request.json()) as { target_node_id: string };
    if (!mockNodes.has(targetId)) return HttpResponse.json({ error: 'Ziel-Node nicht gefunden' }, { status: 400 });
    const edge = { id: `ref-${Date.now()}`, von: params.id as string, zu: targetId, typ: 'referenz' as const };
    mockEdges.push({ von: edge.von, zu: edge.zu, typ: 'referenz' });
    return HttpResponse.json(edge, { status: 201 });
  }),

  http.post(forumUrl('/nodes'), async ({ request }) => {
    const body = (await request.json()) as {
      typ: 'thema' | 'argument';
      texte: { neutral?: string; pro?: string; contra?: string };
      parent_id?: string;
      edge_typ?: EdgeTyp;
    };
    const id = `mock-${Date.now()}`;
    const created: ForumNode = {
      id,
      typ: body.typ,
      texte: {
        neutral: body.texte.neutral ? { version: 1, text: body.texte.neutral, autor_id: 'mock-user-1', datum: new Date().toISOString() } : null,
        pro: body.texte.pro ? { version: 1, text: body.texte.pro, autor_id: 'mock-user-1', datum: new Date().toISOString() } : null,
        contra: body.texte.contra ? { version: 1, text: body.texte.contra, autor_id: 'mock-user-1', datum: new Date().toISOString() } : null,
      },
      tags: [],
      anhaenge: [],
      ersteller_id: 'mock-user-1',
      erstellt_am: new Date().toISOString(),
      likes_count: 0,
      comments_count: 0,
      bearbeitet_von: [],
      soft_deleted: false,
      liked_by_me: false,
      ...(body.typ === 'thema' ? { sichtbarkeit: 'oeffentlich' as const } : {}),
    };
    mockNodes.set(id, created);
    if (body.parent_id && body.edge_typ) {
      mockEdges.push({ von: id, zu: body.parent_id, typ: body.edge_typ });
    }
    return HttpResponse.json(created, { status: 201 });
  }),

  // Keep this LAST among /nodes/:id routes - it's the catch-all single-node getter.
  http.get(forumUrl('/nodes/:id'), ({ request, params }) => {
    const node = mockNodes.get(params.id as string);
    if (!node || node.soft_deleted) return HttpResponse.json({ error: 'Not found' }, { status: 404 });
    return HttpResponse.json(withLikedByMe(node, request));
  }),
];
