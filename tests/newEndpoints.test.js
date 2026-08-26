const request = require('supertest');
const mongoose = require('mongoose');
const { createApp } = require('../src/app');
const { setupDb, teardownDb, clearDb, makeToken } = require('./testUtils');
const Node = require('../src/models/Node');
const Edge = require('../src/models/Edge');
const Like = require('../src/models/Like');

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

async function createThema(token, text) {
  const res = await request(app)
    .post('/nodes')
    .set('Authorization', `Bearer ${token}`)
    .send({ typ: 'thema', texte: { neutral: text } });
  return res.body;
}

async function createArgument(token, parentId, edgeTyp, texte) {
  const res = await request(app)
    .post('/nodes')
    .set('Authorization', `Bearer ${token}`)
    .send({ typ: 'argument', texte, parent_id: parentId, edge_typ: edgeTyp });
  return res.body;
}

async function setPrivate(themaId, adminToken) {
  await request(app)
    .put(`/nodes/${themaId}/sichtbarkeit`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ sichtbarkeit: 'privat' });
}

describe('GET /nodes/:id/referenzen', () => {
  test('returns an empty list when the node has no outgoing referenzen', async () => {
    const author = makeToken({ sub: 'alice' });
    const source = await createThema(author, 'Ohne Referenzen');

    const res = await request(app).get(`/nodes/${source.id}/referenzen`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [] });
  });

  test('orders newest first and silently filters out private and soft-deleted targets', async () => {
    const author = makeToken({ sub: 'alice' });
    const admin = makeToken({ sub: 'admin-1', roles: ['ADMIN'] });
    const mod = makeToken({ sub: 'mod-1', roles: ['FORUM_MODERATOR'] });

    const source = await createThema(author, 'Quelle');
    const targetPublicOld = await createThema(author, 'Alt Oeffentlich');
    const targetPrivate = await createThema(author, 'Privates Ziel');
    const targetDeleted = await createThema(author, 'Geloeschtes Ziel');
    const targetPublicNew = await createThema(author, 'Neu Oeffentlich');

    await setPrivate(targetPrivate.id, admin);
    await request(app)
      .delete(`/nodes/${targetDeleted.id}`)
      .set('Authorization', `Bearer ${mod}`);

    const now = Date.now();
    await Edge.create({
      von: source.id,
      zu: targetPublicOld.id,
      typ: 'referenz',
      autor_id: 'alice',
      erstellt_am: new Date(now - 3000),
    });
    await Edge.create({
      von: source.id,
      zu: targetPrivate.id,
      typ: 'referenz',
      autor_id: 'alice',
      erstellt_am: new Date(now - 2000),
    });
    await Edge.create({
      von: source.id,
      zu: targetDeleted.id,
      typ: 'referenz',
      autor_id: 'alice',
      erstellt_am: new Date(now - 1000),
    });
    await Edge.create({
      von: source.id,
      zu: targetPublicNew.id,
      typ: 'referenz',
      autor_id: 'alice',
      erstellt_am: new Date(now),
    });

    const res = await request(app).get(`/nodes/${source.id}/referenzen`);
    expect(res.status).toBe(200);
    expect(res.body.data.map((d) => d.id)).toEqual([targetPublicNew.id, targetPublicOld.id]);
    expect(res.body.data[0].referenz).toHaveProperty('id');
    expect(res.body.data[0].referenz).toHaveProperty('erstellt_am');
    expect(res.body.data[0].referenz.autor_id).toBe('alice');
  });

  test('liked_by_me is null when unauthenticated and reflects the caller when logged in', async () => {
    const author = makeToken({ sub: 'alice' });
    const source = await createThema(author, 'Quelle-Like');
    const target = await createThema(author, 'Ziel-Like');
    await Edge.create({ von: source.id, zu: target.id, typ: 'referenz', autor_id: 'alice' });

    const anon = await request(app).get(`/nodes/${source.id}/referenzen`);
    expect(anon.body.data[0].liked_by_me).toBeNull();

    const notLiked = await request(app)
      .get(`/nodes/${source.id}/referenzen`)
      .set('Authorization', `Bearer ${author}`);
    expect(notLiked.body.data[0].liked_by_me).toBe(false);

    await request(app).post(`/nodes/${target.id}/likes`).set('Authorization', `Bearer ${author}`);

    const liked = await request(app)
      .get(`/nodes/${source.id}/referenzen`)
      .set('Authorization', `Bearer ${author}`);
    expect(liked.body.data[0].liked_by_me).toBe(true);
  });

  test('limit parameter is honored and capped at 100', async () => {
    const author = makeToken({ sub: 'alice' });
    const source = await createThema(author, 'Quelle-Limit');

    const targets = await Node.insertMany(
      Array.from({ length: 105 }, (_, i) => ({
        typ: 'thema',
        texte: {
          neutral: [{ version: 1, text: `Ziel ${i}`, autor_id: 'alice', datum: new Date() }],
          pro: [],
          contra: [],
        },
        ersteller_id: 'alice',
        sichtbarkeit: 'oeffentlich',
      }))
    );

    const now = Date.now();
    await Edge.insertMany(
      targets.map((t, i) => ({
        von: source.id,
        zu: t._id,
        typ: 'referenz',
        autor_id: 'alice',
        erstellt_am: new Date(now - i * 1000), // index 0 is newest
      }))
    );

    const defaultRes = await request(app).get(`/nodes/${source.id}/referenzen`);
    expect(defaultRes.body.data).toHaveLength(50);

    const cappedRes = await request(app).get(`/nodes/${source.id}/referenzen?limit=1000`);
    expect(cappedRes.body.data).toHaveLength(100);

    const smallRes = await request(app).get(`/nodes/${source.id}/referenzen?limit=3`);
    expect(smallRes.body.data.map((d) => d.id)).toEqual([
      String(targets[0]._id),
      String(targets[1]._id),
      String(targets[2]._id),
    ]);
  });

  test('returns 404 when the source node itself is not visible or does not exist', async () => {
    const author = makeToken({ sub: 'alice' });
    const admin = makeToken({ sub: 'admin-1', roles: ['ADMIN'] });

    const privateThema = await createThema(author, 'Privates Quellthema');
    await setPrivate(privateThema.id, admin);

    const forbidden = await request(app).get(`/nodes/${privateThema.id}/referenzen`);
    expect(forbidden.status).toBe(404);

    const fakeId = new mongoose.Types.ObjectId().toString();
    const missing = await request(app).get(`/nodes/${fakeId}/referenzen`);
    expect(missing.status).toBe(404);
  });
});

describe('liked_by_me', () => {
  test('is null when unauthenticated and true/false on single GET /nodes/:id', async () => {
    const author = makeToken({ sub: 'alice' });
    const thema = await createThema(author, 'Like-Thema');

    const anonGet = await request(app).get(`/nodes/${thema.id}`);
    expect(anonGet.body.liked_by_me).toBeNull();

    const notLikedGet = await request(app)
      .get(`/nodes/${thema.id}`)
      .set('Authorization', `Bearer ${author}`);
    expect(notLikedGet.body.liked_by_me).toBe(false);

    await request(app)
      .post(`/nodes/${thema.id}/likes`)
      .set('Authorization', `Bearer ${author}`);

    const likedGet = await request(app)
      .get(`/nodes/${thema.id}`)
      .set('Authorization', `Bearer ${author}`);
    expect(likedGet.body.liked_by_me).toBe(true);
  });

  test('is batched into a single Like query and correct per item in GET /nodes/:id/kinder', async () => {
    const author = makeToken({ sub: 'alice' });
    const thema = await createThema(author, 'Kinder-Like-Thema');
    const arg1 = await createArgument(author, thema.id, 'pro', { pro: 'Arg 1' });
    const arg2 = await createArgument(author, thema.id, 'pro', { pro: 'Arg 2' });
    const arg3 = await createArgument(author, thema.id, 'pro', { pro: 'Arg 3' });

    await request(app)
      .post(`/nodes/${arg2.id}/likes`)
      .set('Authorization', `Bearer ${author}`);

    const spy = jest.spyOn(Like, 'find');
    const res = await request(app)
      .get(`/nodes/${thema.id}/kinder?typ=pro`)
      .set('Authorization', `Bearer ${author}`);
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();

    const byId = Object.fromEntries(res.body.data.map((n) => [n.id, n.liked_by_me]));
    expect(byId[arg1.id]).toBe(false);
    expect(byId[arg2.id]).toBe(true);
    expect(byId[arg3.id]).toBe(false);
  });

  test('is batched into a single Like query and correct per item in GET /themen', async () => {
    const author = makeToken({ sub: 'alice' });
    const themaA = await createThema(author, 'Themen-Like-A');
    const themaB = await createThema(author, 'Themen-Like-B');
    const themaC = await createThema(author, 'Themen-Like-C');

    await request(app)
      .post(`/nodes/${themaB.id}/likes`)
      .set('Authorization', `Bearer ${author}`);

    const spy = jest.spyOn(Like, 'find');
    const res = await request(app).get('/themen').set('Authorization', `Bearer ${author}`);

    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();

    const byId = Object.fromEntries(res.body.data.map((n) => [n.id, n.liked_by_me]));
    expect(byId[themaA.id]).toBe(false);
    expect(byId[themaB.id]).toBe(true);
    expect(byId[themaC.id]).toBe(false);
  });
});

describe('GET /nodes/:id/pfad', () => {
  test('pfad for a thema itself is just the thema with edge_typ null', async () => {
    const author = makeToken({ sub: 'alice' });
    const thema = await createThema(author, 'Solo-Thema');

    const res = await request(app).get(`/nodes/${thema.id}/pfad`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(thema.id);
    expect(res.body.data[0].edge_typ).toBeNull();
  });

  test('pfad for a deeply nested argument is root-first with correct edge_typ per level', async () => {
    const author = makeToken({ sub: 'alice' });
    const thema = await createThema(author, 'Tiefes Thema');
    const argA = await createArgument(author, thema.id, 'pro', { pro: 'Argument A' });
    const argB = await createArgument(author, argA.id, 'contra', { contra: 'Argument B' });
    const argC = await createArgument(author, argB.id, 'differenzierung', { neutral: 'Argument C' });

    const res = await request(app).get(`/nodes/${argC.id}/pfad`);
    expect(res.status).toBe(200);
    expect(res.body.data.map((n) => n.id)).toEqual([thema.id, argA.id, argB.id, argC.id]);
    expect(res.body.data.map((n) => n.edge_typ)).toEqual([null, 'pro', 'contra', 'differenzierung']);
  });

  test('liked_by_me is null when unauthenticated and reflects the caller when logged in', async () => {
    const author = makeToken({ sub: 'alice' });
    const thema = await createThema(author, 'Pfad-Like-Thema');
    const arg = await createArgument(author, thema.id, 'pro', { pro: 'Pfad-Like-Argument' });

    const anon = await request(app).get(`/nodes/${arg.id}/pfad`);
    expect(anon.body.data.map((n) => n.liked_by_me)).toEqual([null, null]);

    await request(app).post(`/nodes/${arg.id}/likes`).set('Authorization', `Bearer ${author}`);

    const liked = await request(app)
      .get(`/nodes/${arg.id}/pfad`)
      .set('Authorization', `Bearer ${author}`);
    expect(liked.body.data.map((n) => n.liked_by_me)).toEqual([false, true]);
  });

  test('returns 404 when the requested node itself is not visible or missing', async () => {
    const author = makeToken({ sub: 'alice' });
    const admin = makeToken({ sub: 'admin-1', roles: ['ADMIN'] });

    const fakeId = new mongoose.Types.ObjectId().toString();
    const missing = await request(app).get(`/nodes/${fakeId}/pfad`);
    expect(missing.status).toBe(404);

    const privateThema = await createThema(author, 'Privates Pfad-Thema');
    await setPrivate(privateThema.id, admin);
    const forbidden = await request(app).get(`/nodes/${privateThema.id}/pfad`);
    expect(forbidden.status).toBe(404);
  });

  test('pfad to an argument in a private thema is blocked for outsiders but visible to admin', async () => {
    const author = makeToken({ sub: 'alice' });
    const admin = makeToken({ sub: 'admin-1', roles: ['ADMIN'] });
    const outsider = makeToken({ sub: 'bob' });

    const thema = await createThema(author, 'Geheimes Pfad-Thema');
    const arg = await createArgument(author, thema.id, 'pro', { pro: 'geheimes Argument' });

    await setPrivate(thema.id, admin);

    const outsiderRes = await request(app)
      .get(`/nodes/${arg.id}/pfad`)
      .set('Authorization', `Bearer ${outsider}`);
    expect(outsiderRes.status).toBe(404);

    const adminRes = await request(app)
      .get(`/nodes/${arg.id}/pfad`)
      .set('Authorization', `Bearer ${admin}`);
    expect(adminRes.status).toBe(200);
    expect(adminRes.body.data.map((n) => n.id)).toEqual([thema.id, arg.id]);
  });
});

describe('walkAncestorChain / findRootThemaId refactor regression', () => {
  test('a deeply nested argument (grandchild) still inherits private visibility from its root thema', async () => {
    const author = makeToken({ sub: 'alice' });
    const admin = makeToken({ sub: 'admin-1', roles: ['ADMIN'] });
    const outsider = makeToken({ sub: 'bob' });

    const thema = await createThema(author, 'Tief privates Thema');
    const argA = await createArgument(author, thema.id, 'pro', { pro: 'A' });
    const argB = await createArgument(author, argA.id, 'contra', { contra: 'B' });

    await setPrivate(thema.id, admin);

    const outsiderGet = await request(app)
      .get(`/nodes/${argB.id}`)
      .set('Authorization', `Bearer ${outsider}`);
    expect(outsiderGet.status).toBe(404);

    const outsiderKinder = await request(app).get(`/nodes/${argA.id}/kinder`);
    expect(outsiderKinder.status).toBe(404);

    const adminGet = await request(app)
      .get(`/nodes/${argB.id}`)
      .set('Authorization', `Bearer ${admin}`);
    expect(adminGet.status).toBe(200);
  });
});
