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
- `POST /nodes/:id/referenz`, `POST|DELETE /nodes/:id/likes`
- `GET|POST /nodes/:id/kommentare`
- `GET /suche` (Volltextsuche, respektiert private Themen)
- `POST /admin/refresh-key`

E-Mail-Benachrichtigung bei neuem Kind-Argument/Kommentar läuft best-effort über EmailService
(Adresse via ProfileService aufgelöst) und blockiert nie den auslösenden Request.

**Noch nicht Teil dieses Repos** (siehe Abschnitt 2/15 der Spezifikation): die React-Frontend-
Komponente inkl. Web-Component-Paketierung für TYPO3/PHP-Einbindung, Frontend-seitiges
Token-Refresh, sowie die in Abschnitt 15 aufgeführten späteren Ausbaustufen (Bearbeitungsvorschläge,
Digest-Mails, Medien-Spiegelung, Vektor-Suche, Wilson-Score).
