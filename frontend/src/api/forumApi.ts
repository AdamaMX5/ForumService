import type {
  ForumChildNode,
  ForumComment,
  ForumNode,
  NewNodeInput,
  Paginated,
  ReferenzEdge,
  ReferenzListItem,
  SortMode,
} from './types';

export interface ForumApiAuthAdapter {
  getAccessToken(): string | null;
  /** Resolves with a fresh access token, or throws if no session could be established. */
  refreshAccessToken(): Promise<string>;
}

export class ForumApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ForumApiError';
  }
}

export interface KinderQuery {
  typ?: 'pro' | 'contra' | 'differenzierung';
  sort?: SortMode;
  cursor?: string | null;
  limit?: number;
}

export interface ThemenQuery {
  tags?: string[];
  sort?: SortMode;
  cursor?: string | null;
  limit?: number;
}

function toQueryString(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

/**
 * Builds a typed ForumService client. Every method attaches the access token from `auth` when
 * present and, on a 401 from a request that *did* carry a token, refreshes exactly once (via
 * `auth.refreshAccessToken`, which itself is expected to be mutex-guarded - see
 * `auth/refreshLock.ts`) and retries the request a single time before giving up.
 */
export function createForumApi(baseUrl: string, auth: ForumApiAuthAdapter) {
  async function request<T>(path: string, init: RequestInit = {}, isRetry = false): Promise<T> {
    const token = auth.getAccessToken();
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...((init.headers as Record<string, string>) || {}),
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${baseUrl}${path}`, { ...init, headers });

    if (res.status === 401 && token && !isRetry) {
      await auth.refreshAccessToken();
      return request<T>(path, init, true);
    }

    if (res.status === 204) return undefined as T;

    const text = await res.text();
    const body = text ? JSON.parse(text) : undefined;

    if (!res.ok) {
      const message =
        res.status === 429
          ? 'Zu viele Anfragen - bitte kurz warten und erneut versuchen.'
          : (body && (body.error || body.message)) || `ForumService request failed (${res.status})`;
      throw new ForumApiError(res.status, message);
    }
    return body as T;
  }

  return {
    getThemen(query: ThemenQuery = {}): Promise<Paginated<ForumNode>> {
      const qs = toQueryString({
        tags: query.tags?.join(','),
        sort: query.sort,
        cursor: query.cursor,
        limit: query.limit,
      });
      return request(`/themen${qs}`);
    },

    getNode(id: string): Promise<ForumNode> {
      return request(`/nodes/${id}`);
    },

    getKinder(nodeId: string, query: KinderQuery = {}): Promise<Paginated<ForumChildNode>> {
      const qs = toQueryString({
        typ: query.typ,
        sort: query.sort,
        cursor: query.cursor,
        limit: query.limit,
      });
      return request(`/nodes/${nodeId}/kinder${qs}`);
    },

    createNode(input: NewNodeInput): Promise<ForumNode> {
      return request('/nodes', { method: 'POST', body: JSON.stringify(input) });
    },

    addReferenz(nodeId: string, targetNodeId: string): Promise<ReferenzEdge> {
      return request(`/nodes/${nodeId}/referenz`, {
        method: 'POST',
        body: JSON.stringify({ target_node_id: targetNodeId }),
      });
    },

    getReferenzen(nodeId: string, limit?: number): Promise<{ data: ReferenzListItem[] }> {
      const qs = toQueryString({ limit });
      return request(`/nodes/${nodeId}/referenzen${qs}`);
    },

    /** Root-to-node ancestor chain (thema first), for fully expanding a `?fokus=` deep link. */
    getPfad(nodeId: string): Promise<{ data: ForumChildNode[] }> {
      return request(`/nodes/${nodeId}/pfad`);
    },

    like(nodeId: string): Promise<{ likes_count: number }> {
      return request(`/nodes/${nodeId}/likes`, { method: 'POST' });
    },

    unlike(nodeId: string): Promise<{ likes_count: number }> {
      return request(`/nodes/${nodeId}/likes`, { method: 'DELETE' });
    },

    getKommentare(nodeId: string, cursor?: string | null, limit?: number): Promise<Paginated<ForumComment>> {
      const qs = toQueryString({ cursor, limit });
      return request(`/nodes/${nodeId}/kommentare${qs}`);
    },

    postKommentar(nodeId: string, text: string, parentCommentId?: string | null): Promise<ForumComment> {
      return request(`/nodes/${nodeId}/kommentare`, {
        method: 'POST',
        body: JSON.stringify({ text, parent_comment_id: parentCommentId || undefined }),
      });
    },

    suche(q: string, limit?: number): Promise<{ data: ForumNode[] }> {
      const qs = toQueryString({ q, limit });
      return request(`/suche${qs}`);
    },
  };
}

export type ForumApi = ReturnType<typeof createForumApi>;
