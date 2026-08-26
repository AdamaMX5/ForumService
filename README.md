# ForumService
Ein Diskussionsforum-Microservice, der strukturierte Argumentation (Pro / Contra / Differenzierung, verlinkte Argumente als Graph) mit klassischer, linearer Forumsfunktion (Kommentare) kombiniert. Einbindung in mehrere bestehende Frontends (React, TYPO3, PHP/HTML) über eine gemeinsame API.

Vollständige technische Spezifikation: [`forum-service-plan.md`](./forum-service-plan.md).

## Backend (dieses Repo)

Node.js/Express-Service, persistiert direkt in MongoDB (kein ObjectService — dieser Service
verwaltet seine eigenen, forum-spezifischen Objekte selbst). JWT-Verifikation erfolgt gegen
den zur Laufzeit vom AuthService geladenen RS256-Public-Key.

### Setup

```bash
cp .env.example .env   # Werte eintragen (mind. AUTH_SERVICE_URL, MONGODB_URI)
npm install
npm run dev             # Entwicklung, mit nodemon
npm start                # Produktion
npm test                 # Jest + mongodb-memory-server, keine echte DB/kein echter AuthService nötig
```

### Implementierter Umfang (Abschnitt 11 der Spezifikation)

- `GET /themen`, `GET /nodes/:id`, `GET /nodes/:id/kinder` (cursor-paginiert, Sortiermodi `neu`/`likes`/`beste`)
- `POST /nodes`, `PUT /nodes/:id/text` (Mod/Admin), `PUT /nodes/:id/sichtbarkeit` (Admin), `DELETE /nodes/:id` (Soft-Delete, Mod/Admin)
- `POST /nodes/:id/referenz`, `GET /nodes/:id/referenzen` (ausgehende Referenzen auflisten), `POST|DELETE /nodes/:id/likes`
- `GET /nodes/:id/pfad` (Pfad von der Thema-Wurzel bis zum Node, root-first — fürs Aufklappen des Baums entlang eines Deep-Links)
- `GET|POST /nodes/:id/kommentare`
- `GET /suche` (Volltextsuche, respektiert private Themen)
- `POST /admin/refresh-key`

Node-JSON enthält seit Kurzem `liked_by_me` (`true`/`false` wenn eingeloggt, sonst `null`) —
befüllt auf `GET /nodes/:id`, `GET /nodes/:id/kinder`, `GET /themen` und `GET /suche` über eine
einzelne gebatchte `Like`-Abfrage pro Response (kein N+1 pro Item).

E-Mail-Benachrichtigung bei neuem Kind-Argument/Kommentar läuft best-effort über EmailService
(Adresse via ProfileService aufgelöst) und blockiert nie den auslösenden Request.

## Frontend (`frontend/`)

React-Komponente `<ForumThread>` (Vite + React 18 + TypeScript + TailwindCSS) inkl.
Web-Component-Paketierung (`<forum-thread node-id="...">`) für TYPO3/PHP-Einbindung sowie
eigenständigem Login/Register- und Token-Refresh-Flow gegen den AuthService — siehe
[`frontend/README.md`](./frontend/README.md) für Setup, Nutzung als React-Bibliothek vs.
Web Component und bekannte Backend-Lücken, die die UI (noch) umschiffen muss.

**Noch nicht Teil dieses Repos** (siehe Abschnitt 15 der Spezifikation): Bearbeitungsvorschläge,
Digest-Mails, Medien-Spiegelung, Vektor-Suche, Wilson-Score-Sortierung.
