# ForumService

> Base URL: `https://forum.freischule.info`

Diskussionsforum-Microservice: strukturierte Argumentation (Pro / Contra / Differenzierung,
verlinkte Argumente als Graph) kombiniert mit klassischer, linearer Forumsfunktion (Kommentare,
als Popup pro Node). Eine React-Codebasis, zusätzlich als Web Component paketiert — Einbindung in
React-Apps (FreeSchool, VirtualOffice, …), TYPO3 und einfache PHP/HTML-Seiten über dieselbe API.

**Auth-Varianten:**
- **JWT** — Bearer Token; für alle schreibenden Endpunkte, sowie um `sichtbarkeit: "privat"`-Themen
  und den eigenen `liked_by_me`-Status zu sehen
- **JWT mit Rolle `FORUM_MODERATOR`** — Node-Text bearbeiten (neue Version), Node/Kommentar soft-deleten
- **JWT mit Rolle `ADMIN`** — zusätzlich Sichtbarkeit umschalten (`oeffentlich`/`privat`), Admin-Endpunkte

**Lesezugriff ist öffentlich** (kein JWT nötig), mit Ausnahme von Themen mit `sichtbarkeit: "privat"` —
diese sind für nicht-privilegierte/anonyme Aufrufer weder einzeln (`GET /nodes/:id`) noch in Listen
(`GET /themen`) sichtbar (`404`, kein Unterschied zu "existiert nicht", um Existenz nicht zu verraten).
Nur schreibende Aktionen (Node/Kommentar anlegen, liken, editieren) erfordern ein gültiges JWT.

---

## Public

| Method | Endpoint | Auth | Description |
|--------|----------|------|--------------|
| `GET` | `/` | — | `{ message: "Hello World! I'm the ForumService: <gitVersionHash>" }` — `gitVersionHash` ist der kurze Git-Commit-Hash des laufenden Deployments (`GIT_COMMIT_SHA`-Env-Var falls gesetzt, sonst `git rev-parse --short HEAD` beim Start, sonst `"unknown"`) |
| `GET` | `/health` | — | `{ status: "ok", service: "ForumService", timestamp }` |

---

## Themen (`/themen`)

| Method | Endpoint | Auth | Query | Description |
|--------|----------|------|-------|--------------|
| `GET` | `/themen` | optional JWT | `tags`, `sort` (`neu`\|`likes`\|`beste`, default `beste`), `cursor`, `limit` (max 100) | Themen (Wurzel-Diskussionen) auflisten — private Themen werden Nicht-Mod/Admin serverseitig ausgefiltert |

---

## Nodes (`/nodes`) — Themen und Argumente teilen sich diese Endpunkte

| Method | Endpoint | Auth | Description |
|--------|----------|------|--------------|
| `GET` | `/nodes/:id` | optional JWT | Einzelner Node (Thema oder Argument) inkl. aktueller Textversionen |
| `GET` | `/nodes/:id/kinder` | optional JWT | Paginierte Kinder einer Ebene — Query: `typ` (`pro`\|`contra`\|`differenzierung`), `sort`, `cursor`, `limit` |
| `GET` | `/nodes/:id/kommentare` | optional JWT | Paginierte Kommentare (chronologisch) — Query: `cursor`, `limit` |
| `GET` | `/nodes/:id/referenzen` | optional JWT | Ausgehende `referenz`-Edges, aufgelöst zu den Ziel-Nodes (für den Ziel-Aufrufer unsichtbare/gelöschte Ziele werden stillschweigend gefiltert) — Query: `limit` |
| `GET` | `/nodes/:id/pfad` | optional JWT | Pfad von der Thema-Wurzel bis `:id` (root-first) — für Deep-Linking (`?fokus=`), damit der Client den Baum entlang aufklappen kann |
| `POST` | `/nodes` | JWT | Neuer Node — Body: `typ` (`thema`\|`argument`)*, `texte: { neutral?, pro?, contra? }` (mind. eine Spalte), `tags?`, `anhaenge?`; bei `typ: "argument"` zusätzlich `parent_id`*, `edge_typ`* (`pro`\|`contra`\|`differenzierung`) → `201` |
| `PUT` | `/nodes/:id/text` | JWT + `FORUM_MODERATOR`/`ADMIN` | Neue Textversion anlegen — Body: `neutral?`, `pro?`, `contra?` (mind. eine) |
| `PUT` | `/nodes/:id/sichtbarkeit` | JWT + `ADMIN` | Nur `typ: "thema"` — Body: `{ sichtbarkeit: "oeffentlich" \| "privat" }` |
| `DELETE` | `/nodes/:id` | JWT + `FORUM_MODERATOR`/`ADMIN` | Soft-Delete — Body optional: `{ grund }` → `204` |
| `POST` | `/nodes/:id/referenz` | JWT | Referenz-Edge auf bestehenden Node anlegen — Body: `{ target_node_id }` → `201` |
| `POST` | `/nodes/:id/likes` | JWT | Like setzen → `201 { likes_count }`; `409` wenn bereits geliked |
| `DELETE` | `/nodes/:id/likes` | JWT | Like entfernen → `{ likes_count }`; `404` wenn kein Like vorhanden |
| `POST` | `/nodes/:id/kommentare` | JWT | Neuer Kommentar — Body: `text`*, `parent_comment_id?` → `201` |

**Node-Response-Shape** (`serializeNode`): `id`, `typ`, `texte: { neutral, pro, contra }` (jeweils nur
die aktuellste Version), `tags`, `anhaenge`, `ersteller_id`, `erstellt_am`, `likes_count`,
`comments_count`, `liked_by_me` (`true`/`false`/`null` — `null` = anonymer oder ungeprüfter Aufrufer),
`bearbeitet_von`, `soft_deleted(_grund/_von)`, und bei `typ: "thema"` zusätzlich `sichtbarkeit`.

---

## Suche (`/suche`)

| Method | Endpoint | Auth | Query | Description |
|--------|----------|------|-------|--------------|
| `GET` | `/suche` | optional JWT | `q`*, `limit` | Volltextsuche über `texte.neutral/pro/contra.text` (MongoDB Text-Index); private Themen werden für Nicht-Mod/Admin herausgefiltert |

---

## Admin (`/admin`) — JWT mit Rolle `ADMIN`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/admin/refresh-key` | Gecachten JWT Public Key force-refreshen (nach Key-Rotation beim AuthService) |

---

## Frontend / Einbindung

Eine React-Codebasis (`frontend/`), gebaut in zwei Zielformaten: eine **React-Bibliothek**
(`@forumservice/frontend`) für native Einbindung in React-Apps, und ein **Web-Component-Bundle**
(`forum-thread.iife.js`, React/ReactDOM bereits eingebaut) für TYPO3/PHP/HTML-Seiten ohne eigenen
React-Stack. Kein iframe, kein zweiter UI-Stack — nur ein zusätzlicher Build-Output derselben
Komponente.

### React

```bash
npm install @forumservice/frontend
```

```tsx
import { ForumThread } from '@forumservice/frontend';
import '@forumservice/frontend/style.css';

<ForumThread nodeId="<themaId>" />
```

`nodeId` ist optional. Ohne `nodeId` (und ohne `?thema=`-Deep-Link-Param) zeigt `<ForumThread>` eine
Startseite mit allen Themen (`GET /themen`) samt einem "+"-Button unten rechts zum Anlegen eines
neuen Themas — nützlich für Seiten, die noch kein festes Thema haben bzw. die generische
Themenübersicht des Forums einbinden wollen. Auswahl eines Themas (oder das Anlegen eines neuen)
schaltet über den `?thema=`-Deep-Link-Param auf die Einzelthema-Ansicht um. Wird `nodeId` fest
übergeben, bleibt das Verhalten sonst wie bisher: nur dieses eine Thema/Argument wird angezeigt,
ohne Startseite/"+"-Button.

Die Überschrift "Diskussionsforum" wird **immer** angezeigt und ist immer klickbar — sie führt in
jedem Fall zur allgemeinen Themenübersicht, auch wenn `nodeId` fest vorgegeben wurde. So bleibt der
Weg zurück zur Gesamtübersicht des Forums auch aus einer fest eingebundenen Einzeldiskussion heraus
immer erreichbar.

`<ForumThread>` bringt eigenständig einen kompletten Login/Register-Flow mit (Email-first,
automatisches Login via Refresh-Cookie, stiller Refresh vor Ablauf). Ist die Host-App bereits
eingeloggt (z. B. FreeSchool), per `externalAuth` deaktivieren, damit nicht zwei Apps gleichzeitig
gegen den rotierenden Refresh-Token des AuthService laufen:

```tsx
<ForumThread
  nodeId="<themaId>"
  externalAuth={{ accessToken: myAppToken, onNeedRefresh: myRefreshFn }}
/>
```

Mehrere `<ForumThread>`-Instanzen auf einer Seite können sich einen Login teilen, indem man selbst
einen `<ForumAuthProvider>` außenrum legt und `<ForumThreadView>` (statt `<ForumThread>`) verwendet.

### TYPO3 (und generisches HTML/PHP)

Web-Component-Build erzeugen (Env-Vars `VITE_FORUM_API_URL`/`VITE_AUTH_SERVICE_URL` werden zur
Buildzeit fest eingebacken — vor dem Build auf die Produktions-URLs setzen):

```bash
cd frontend
npm install
npm run build:webcomponent   # → dist/webcomponent/forum-thread.iife.js + style.css
```

Beide Dateien (z. B. nach `fileadmin/forum/`) deployen, dann im TYPO3-Template bzw. direkt im
Content-Element einbinden:

```html
<link rel="stylesheet" href="/fileadmin/forum/style.css" />
<script src="/fileadmin/forum/forum-thread.iife.js"></script>

<forum-thread node-id="<themaId>"></forum-thread>
```

`node-id` ist das einzige Attribut, das das Custom Element kennt, und optional — ohne `node-id`
(und ohne `?thema=`-Deep-Link-Param) zeigt `<forum-thread>` dieselbe Themen-Startseite samt
"+"-Button wie die React-Variante (s.o.):

```html
<forum-thread></forum-thread>
```

Die Web-Component läuft immer mit dem vollständigen eigenständigen Login/Register-Flow — kein
`externalAuth`-Durchreichen möglich, da kein React-Host-Kontext existiert.

### CORS

CORS wird zentral auf NGINX-Ebene gehandhabt (siehe `Architecture.md`), nicht im Service selbst.
Die einbindende Domain (z. B. die TYPO3-Seite) muss auf der NGINX-Konfiguration von
`forum.freischule.info` **und** `auth.freischule.info` als erlaubter Origin freigegeben sein.

### Deep-Linking

URL-Contract für alle Einbindungsarten identisch: `?thema=<id>&fokus=<id>&kommentare=<id>`.
- `thema` bestimmt die zu ladende Wurzel-Diskussion (überschreibt `nodeId`/`node-id`). Fehlt `thema`
  **und** ist `nodeId`/`node-id` nicht gesetzt, zeigt der Client die Themen-Startseite statt eines
  Threads (s.o.) — Auswahl/Anlegen eines Themas setzt `thema` und schaltet auf die Thread-Ansicht um.
- `fokus` lädt den Pfad von der Thema-Wurzel bis zum Ziel-Node (`GET /nodes/:id/pfad`) und klappt
  den Baum entlang dieses Pfads automatisch auf.
- `kommentare` öffnet automatisch das Kommentar-Popup für den genannten Node.

Beim Betreten/Verlassen eines Node-Views meldet das Frontend `nodeId + timestamp` an den
ProfileService (`POST /profil/{userId}/last-view`), unabhängig von der Einbindungsart.
