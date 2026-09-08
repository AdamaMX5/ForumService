import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createForumApi, ForumApiError, type ForumApiAuthAdapter } from './forumApi';

const BASE_URL = 'http://localhost:3000';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('forumApi', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let auth: ForumApiAuthAdapter;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    auth = {
      getAccessToken: vi.fn(() => null),
      refreshAccessToken: vi.fn(),
    };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function lastRequest(): { url: string; init: RequestInit } {
    const [url, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as [string, RequestInit];
    return { url, init };
  }

  describe('request shapes', () => {
    it('getThemen sends tags joined, sort and cursor as query params', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ data: [], nextCursor: null }));
      const api = createForumApi(BASE_URL, auth);

      await api.getThemen({ tags: ['a', 'b'], sort: 'neu', cursor: 'cur1', limit: 5 });

      const { url, init } = lastRequest();
      expect(url).toBe(`${BASE_URL}/themen?tags=a%2Cb&sort=neu&cursor=cur1&limit=5`);
      expect(init.method ?? 'GET').toBe('GET');
    });

    it('getThemen omits undefined/empty params entirely', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ data: [], nextCursor: null }));
      const api = createForumApi(BASE_URL, auth);

      await api.getThemen({});

      const { url } = lastRequest();
      expect(url).toBe(`${BASE_URL}/themen`);
    });

    it('getKinder sends typ, sort, cursor as query params on the right node', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ data: [], nextCursor: null }));
      const api = createForumApi(BASE_URL, auth);

      await api.getKinder('node-1', { typ: 'pro', sort: 'beste', cursor: 'c2', limit: 10 });

      const { url } = lastRequest();
      expect(url).toBe(`${BASE_URL}/nodes/node-1/kinder?typ=pro&sort=beste&cursor=c2&limit=10`);
    });

    it('createNode POSTs the full NewNodeInput as JSON body and attaches auth', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'n1' }, 201));
      auth.getAccessToken = vi.fn(() => 'token-abc');
      const api = createForumApi(BASE_URL, auth);

      await api.createNode({
        typ: 'argument',
        texte: { neutral: 'Text' },
        parent_id: 'parent-1',
        edge_typ: 'pro',
      });

      const { url, init } = lastRequest();
      expect(url).toBe(`${BASE_URL}/nodes`);
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toEqual({
        typ: 'argument',
        texte: { neutral: 'Text' },
        parent_id: 'parent-1',
        edge_typ: 'pro',
      });
      expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token-abc');
      expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    });

    it('addReferenz POSTs { target_node_id }', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'ref1', von: 'a', zu: 'b', typ: 'referenz' }, 201));
      const api = createForumApi(BASE_URL, auth);

      await api.addReferenz('a', 'b');

      const { url, init } = lastRequest();
      expect(url).toBe(`${BASE_URL}/nodes/a/referenz`);
      expect(JSON.parse(init.body as string)).toEqual({ target_node_id: 'b' });
    });

    it('like POSTs with no body, unlike sends DELETE', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ likes_count: 1 }, 201));
      const api = createForumApi(BASE_URL, auth);
      await api.like('n1');
      expect(lastRequest().init.method).toBe('POST');
      expect(lastRequest().init.body).toBeUndefined();

      fetchMock.mockResolvedValueOnce(jsonResponse({ likes_count: 0 }));
      await api.unlike('n1');
      expect(lastRequest().init.method).toBe('DELETE');
    });

    it('postKommentar sends text and omits parent_comment_id when absent', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'c1' }, 201));
      const api = createForumApi(BASE_URL, auth);

      await api.postKommentar('n1', 'hello');

      const body = JSON.parse(lastRequest().init.body as string);
      expect(body).toEqual({ text: 'hello' });
      expect('parent_comment_id' in body).toBe(false);
    });

    it('postKommentar includes parent_comment_id when replying', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'c2' }, 201));
      const api = createForumApi(BASE_URL, auth);

      await api.postKommentar('n1', 'reply', 'c1');

      const body = JSON.parse(lastRequest().init.body as string);
      expect(body).toEqual({ text: 'reply', parent_comment_id: 'c1' });
    });

    it('suche sends q and limit as query params', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ data: [] }));
      const api = createForumApi(BASE_URL, auth);

      await api.suche('tempolimit', 5);

      expect(lastRequest().url).toBe(`${BASE_URL}/suche?q=tempolimit&limit=5`);
    });

    it('updateNodeText PUTs the provided columns as JSON body', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'n1' }));
      const api = createForumApi(BASE_URL, auth);

      await api.updateNodeText('n1', { neutral: 'Neue Version' });

      const { url, init } = lastRequest();
      expect(url).toBe(`${BASE_URL}/nodes/n1/text`);
      expect(init.method).toBe('PUT');
      expect(JSON.parse(init.body as string)).toEqual({ neutral: 'Neue Version' });
    });

    it('setSichtbarkeit PUTs { sichtbarkeit }', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'n1', sichtbarkeit: 'privat' }));
      const api = createForumApi(BASE_URL, auth);

      await api.setSichtbarkeit('n1', 'privat');

      const { url, init } = lastRequest();
      expect(url).toBe(`${BASE_URL}/nodes/n1/sichtbarkeit`);
      expect(init.method).toBe('PUT');
      expect(JSON.parse(init.body as string)).toEqual({ sichtbarkeit: 'privat' });
    });

    it('deleteNode DELETEs with a { grund } body when given, and no body otherwise', async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
      const api = createForumApi(BASE_URL, auth);

      await api.deleteNode('n1', 'Spam');

      const { url, init } = lastRequest();
      expect(url).toBe(`${BASE_URL}/nodes/n1`);
      expect(init.method).toBe('DELETE');
      expect(JSON.parse(init.body as string)).toEqual({ grund: 'Spam' });

      fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
      await api.deleteNode('n2');
      expect(lastRequest().init.body).toBeUndefined();
    });
  });

  describe('error mapping', () => {
    it('throws ForumApiError with server-provided message and status on non-ok response', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Node nicht gefunden' }, 404));
      const api = createForumApi(BASE_URL, auth);

      const error = await api.getNode('missing').catch((e) => e);

      expect(error).toBeInstanceOf(ForumApiError);
      expect(error).toMatchObject({ name: 'ForumApiError', status: 404, message: 'Node nicht gefunden' });
    });

    it('falls back to a generic message when the error body has no error/message field', async () => {
      fetchMock.mockResolvedValueOnce(new Response('', { status: 500 }));
      const api = createForumApi(BASE_URL, auth);

      await expect(api.getNode('n1')).rejects.toMatchObject({
        status: 500,
        message: 'ForumService request failed (500)',
      });
    });

    it('treats 204 responses as success with an undefined body', async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
      const api = createForumApi(BASE_URL, auth);

      await expect(api.like('n1')).resolves.toBeUndefined();
    });
  });

  describe('401 -> refresh -> retry-once', () => {
    it('refreshes and retries a single time when a token-bearing request gets a 401', async () => {
      // Mirrors AuthContext's real adapter: getAccessToken reflects whatever refreshAccessToken
      // most recently resolved with, instead of a token frozen at adapter-construction time.
      let currentToken = 'stale-token';
      auth.getAccessToken = vi.fn(() => currentToken);
      auth.refreshAccessToken = vi.fn(async () => {
        currentToken = 'fresh-token';
        return currentToken;
      });
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ error: 'expired' }, 401))
        .mockResolvedValueOnce(jsonResponse({ likes_count: 3 }, 201));
      const api = createForumApi(BASE_URL, auth);

      const result = await api.like('n1');

      expect(result).toEqual({ likes_count: 3 });
      expect(auth.refreshAccessToken).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      // The retried request must carry the freshly refreshed token, not the stale one.
      const secondCallHeaders = fetchMock.mock.calls[1][1].headers as Record<string, string>;
      expect(secondCallHeaders.Authorization).toBe('Bearer fresh-token');
    });

    it('does not retry a second time if the retried request 401s again', async () => {
      auth.getAccessToken = vi.fn(() => 'stale-token');
      auth.refreshAccessToken = vi.fn().mockResolvedValue('still-bad-token');
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ error: 'expired' }, 401))
        .mockResolvedValueOnce(jsonResponse({ error: 'expired again' }, 401));
      const api = createForumApi(BASE_URL, auth);

      await expect(api.like('n1')).rejects.toMatchObject({ status: 401 });
      expect(auth.refreshAccessToken).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('does not attempt a refresh on 401 when the request carried no token at all', async () => {
      auth.getAccessToken = vi.fn(() => null);
      fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'unauth' }, 401));
      const api = createForumApi(BASE_URL, auth);

      await expect(api.getNode('n1')).rejects.toMatchObject({ status: 401 });
      expect(auth.refreshAccessToken).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('pagination cursor passthrough', () => {
    it('forwards nextCursor from getThemen straight into the next getThemen call', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ data: [{ id: 't1' }], nextCursor: 'page2' }));
      const api = createForumApi(BASE_URL, auth);
      const first = await api.getThemen({ sort: 'neu' });

      expect(first.nextCursor).toBe('page2');

      fetchMock.mockResolvedValueOnce(jsonResponse({ data: [{ id: 't2' }], nextCursor: null }));
      const second = await api.getThemen({ sort: 'neu', cursor: first.nextCursor });

      expect(lastRequest().url).toContain('cursor=page2');
      expect(second.nextCursor).toBeNull();
    });

    it('forwards nextCursor from getKommentare into the next getKommentare call', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ data: [], nextCursor: 'k-cursor' }));
      const api = createForumApi(BASE_URL, auth);
      const first = await api.getKommentare('n1');

      fetchMock.mockResolvedValueOnce(jsonResponse({ data: [], nextCursor: null }));
      await api.getKommentare('n1', first.nextCursor);

      expect(lastRequest().url).toBe(`${BASE_URL}/nodes/n1/kommentare?cursor=k-cursor`);
    });
  });
});
