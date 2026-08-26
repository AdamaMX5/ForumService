const request = require('supertest');
const { createApp } = require('../src/app');
const { setupDb, teardownDb, clearDb, makeToken } = require('./testUtils');

let app;

beforeAll(async () => {
  await setupDb();
  app = createApp();
});

afterAll(async () => {
  await teardownDb();
});

afterEach(async () => {
  await clearDb();
});

describe('Themen & Nodes', () => {
  test('anonymous user can create nothing but can read a public thema', async () => {
    const token = makeToken({ sub: 'alice' });

    const createRes = await request(app)
      .post('/nodes')
      .set('Authorization', `Bearer ${token}`)
      .send({ typ: 'thema', texte: { neutral: 'Sollen wir X tun?' } });
    expect(createRes.status).toBe(201);
    expect(createRes.body.typ).toBe('thema');
    expect(createRes.body.sichtbarkeit).toBe('oeffentlich');

    const anonGet = await request(app).get(`/nodes/${createRes.body.id}`);
    expect(anonGet.status).toBe(200);
    expect(anonGet.body.texte.neutral.text).toBe('Sollen wir X tun?');
  });

  test('POST /nodes without auth is rejected', async () => {
    const res = await request(app)
      .post('/nodes')
      .send({ typ: 'thema', texte: { neutral: 'x' } });
    expect(res.status).toBe(401);
  });

  test('creates an argument under a thema and lists it via /kinder', async () => {
    const token = makeToken({ sub: 'alice' });
    const thema = await request(app)
      .post('/nodes')
      .set('Authorization', `Bearer ${token}`)
      .send({ typ: 'thema', texte: { neutral: 'Thema' } });

    const arg = await request(app)
      .post('/nodes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        typ: 'argument',
        texte: { pro: 'Ein gutes Argument' },
        parent_id: thema.body.id,
        edge_typ: 'pro',
      });
    expect(arg.status).toBe(201);

    const kinder = await request(app).get(`/nodes/${thema.body.id}/kinder?typ=pro`);
    expect(kinder.status).toBe(200);
    expect(kinder.body.data).toHaveLength(1);
    expect(kinder.body.data[0].id).toBe(arg.body.id);
    expect(kinder.body.data[0].edge_typ).toBe('pro');
  });

  test('argument creation requires parent_id and edge_typ', async () => {
    const token = makeToken({ sub: 'alice' });
    const res = await request(app)
      .post('/nodes')
      .set('Authorization', `Bearer ${token}`)
      .send({ typ: 'argument', texte: { pro: 'x' } });
    expect(res.status).toBe(400);
  });

  test('a Mongoose ValidationError (e.g. invalid anhang typ) maps to 400, not 500', async () => {
    const token = makeToken({ sub: 'alice' });
    const res = await request(app)
      .post('/nodes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        typ: 'thema',
        texte: { neutral: 'Thema' },
        anhaenge: [{ typ: 'not-a-valid-typ', url: 'https://example.com' }],
      });
    expect(res.status).toBe(400);
  });

  test('like is idempotent-protected and unlike removes it', async () => {
    const token = makeToken({ sub: 'alice' });
    const thema = await request(app)
      .post('/nodes')
      .set('Authorization', `Bearer ${token}`)
      .send({ typ: 'thema', texte: { neutral: 'Thema' } });

    const like1 = await request(app)
      .post(`/nodes/${thema.body.id}/likes`)
      .set('Authorization', `Bearer ${token}`);
    expect(like1.status).toBe(201);
    expect(like1.body.likes_count).toBe(1);

    const like2 = await request(app)
      .post(`/nodes/${thema.body.id}/likes`)
      .set('Authorization', `Bearer ${token}`);
    expect(like2.status).toBe(409);

    const unlike = await request(app)
      .delete(`/nodes/${thema.body.id}/likes`)
      .set('Authorization', `Bearer ${token}`);
    expect(unlike.status).toBe(200);
    expect(unlike.body.likes_count).toBe(0);
  });

  test('only mod/admin can edit node text', async () => {
    const author = makeToken({ sub: 'alice' });
    const thema = await request(app)
      .post('/nodes')
      .set('Authorization', `Bearer ${author}`)
      .send({ typ: 'thema', texte: { neutral: 'v1' } });

    const forbidden = await request(app)
      .put(`/nodes/${thema.body.id}/text`)
      .set('Authorization', `Bearer ${author}`)
      .send({ neutral: 'v2' });
    expect(forbidden.status).toBe(403);

    const mod = makeToken({ sub: 'mod-1', roles: ['FORUM_MODERATOR'] });
    const allowed = await request(app)
      .put(`/nodes/${thema.body.id}/text`)
      .set('Authorization', `Bearer ${mod}`)
      .send({ neutral: 'v2' });
    expect(allowed.status).toBe(200);
    expect(allowed.body.texte.neutral.text).toBe('v2');
    expect(allowed.body.texte.neutral.version).toBe(2);
  });

  test('only admin can toggle sichtbarkeit, and private themes are hidden from anon/non-privileged', async () => {
    const author = makeToken({ sub: 'alice' });
    const admin = makeToken({ sub: 'admin-1', roles: ['ADMIN'] });
    const outsider = makeToken({ sub: 'bob' });

    const thema = await request(app)
      .post('/nodes')
      .set('Authorization', `Bearer ${author}`)
      .send({ typ: 'thema', texte: { neutral: 'geheim' } });

    const forbidden = await request(app)
      .put(`/nodes/${thema.body.id}/sichtbarkeit`)
      .set('Authorization', `Bearer ${author}`)
      .send({ sichtbarkeit: 'privat' });
    expect(forbidden.status).toBe(403);

    const setPrivate = await request(app)
      .put(`/nodes/${thema.body.id}/sichtbarkeit`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ sichtbarkeit: 'privat' });
    expect(setPrivate.status).toBe(200);
    expect(setPrivate.body.sichtbarkeit).toBe('privat');

    const anonGet = await request(app).get(`/nodes/${thema.body.id}`);
    expect(anonGet.status).toBe(404);

    const outsiderGet = await request(app)
      .get(`/nodes/${thema.body.id}`)
      .set('Authorization', `Bearer ${outsider}`);
    expect(outsiderGet.status).toBe(404);

    const adminGet = await request(app)
      .get(`/nodes/${thema.body.id}`)
      .set('Authorization', `Bearer ${admin}`);
    expect(adminGet.status).toBe(200);
  });

  test('private theme excludes its themen-list entry and its children from /kinder & /suche', async () => {
    const author = makeToken({ sub: 'alice' });
    const admin = makeToken({ sub: 'admin-1', roles: ['ADMIN'] });

    const thema = await request(app)
      .post('/nodes')
      .set('Authorization', `Bearer ${author}`)
      .send({ typ: 'thema', texte: { neutral: 'einzigartigerbegriffxyz' } });

    await request(app)
      .post('/nodes')
      .set('Authorization', `Bearer ${author}`)
      .send({
        typ: 'argument',
        texte: { pro: 'einzigartigerbegriffxyz argument' },
        parent_id: thema.body.id,
        edge_typ: 'pro',
      });

    await request(app)
      .put(`/nodes/${thema.body.id}/sichtbarkeit`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ sichtbarkeit: 'privat' });

    const list = await request(app).get('/themen');
    expect(list.body.data.find((n) => n.id === thema.body.id)).toBeUndefined();

    const kinder = await request(app).get(`/nodes/${thema.body.id}/kinder`);
    expect(kinder.status).toBe(404);

    const search = await request(app).get('/suche?q=einzigartigerbegriffxyz');
    expect(search.body.data).toHaveLength(0);
  });

  test('soft delete requires mod/admin and hides the node afterwards', async () => {
    const author = makeToken({ sub: 'alice' });
    const mod = makeToken({ sub: 'mod-1', roles: ['FORUM_MODERATOR'] });

    const thema = await request(app)
      .post('/nodes')
      .set('Authorization', `Bearer ${author}`)
      .send({ typ: 'thema', texte: { neutral: 'weg damit' } });

    const forbidden = await request(app)
      .delete(`/nodes/${thema.body.id}`)
      .set('Authorization', `Bearer ${author}`);
    expect(forbidden.status).toBe(403);

    const deleted = await request(app)
      .delete(`/nodes/${thema.body.id}`)
      .set('Authorization', `Bearer ${mod}`)
      .send({ grund: 'Spam' });
    expect(deleted.status).toBe(204);

    const getAfter = await request(app).get(`/nodes/${thema.body.id}`);
    expect(getAfter.status).toBe(404);
  });

  test('comments: post, list chronologically, count increments on node', async () => {
    const author = makeToken({ sub: 'alice' });
    const commenter = makeToken({ sub: 'bob' });

    const thema = await request(app)
      .post('/nodes')
      .set('Authorization', `Bearer ${author}`)
      .send({ typ: 'thema', texte: { neutral: 'Thema' } });

    const c1 = await request(app)
      .post(`/nodes/${thema.body.id}/kommentare`)
      .set('Authorization', `Bearer ${commenter}`)
      .send({ text: 'Erster Kommentar' });
    expect(c1.status).toBe(201);

    const c2 = await request(app)
      .post(`/nodes/${thema.body.id}/kommentare`)
      .set('Authorization', `Bearer ${commenter}`)
      .send({ text: 'Zweiter Kommentar', parent_comment_id: c1.body.id });
    expect(c2.status).toBe(201);

    const list = await request(app).get(`/nodes/${thema.body.id}/kommentare`);
    expect(list.body.data.map((c) => c.text)).toEqual(['Erster Kommentar', 'Zweiter Kommentar']);

    const node = await request(app).get(`/nodes/${thema.body.id}`);
    expect(node.body.comments_count).toBe(2);
  });

  test('referenz edge can be created between two existing nodes', async () => {
    const token = makeToken({ sub: 'alice' });
    const thema1 = await request(app)
      .post('/nodes')
      .set('Authorization', `Bearer ${token}`)
      .send({ typ: 'thema', texte: { neutral: 'Thema 1' } });
    const thema2 = await request(app)
      .post('/nodes')
      .set('Authorization', `Bearer ${token}`)
      .send({ typ: 'thema', texte: { neutral: 'Thema 2' } });

    const ref = await request(app)
      .post(`/nodes/${thema1.body.id}/referenz`)
      .set('Authorization', `Bearer ${token}`)
      .send({ target_node_id: thema2.body.id });
    expect(ref.status).toBe(201);
    expect(ref.body.typ).toBe('referenz');

    const selfRef = await request(app)
      .post(`/nodes/${thema1.body.id}/referenz`)
      .set('Authorization', `Bearer ${token}`)
      .send({ target_node_id: thema1.body.id });
    expect(selfRef.status).toBe(400);
  });
});
