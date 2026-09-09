# ForumThread (React-Frontend)

React-Komponente `<ForumThread>` (strukturierte Pro/Contra/Differenzierung-Argumentation + klassische
Kommentar-Popups, siehe `../forum-service-plan.md`) fuer die Einbindung in FreiSchule & Co., plus ein
Web-Component-Build (`<forum-thread node-id="...">`) fuer TYPO3/PHP-Seiten ohne eigenes React.

## Setup

```bash
cp .env.example .env   # VITE_FORUM_API_URL, VITE_AUTH_SERVICE_URL eintragen
npm install
npm run dev             # Demo-App mit Mocks (siehe unten) oder gegen echtes Backend
npm run typecheck
npm test                 # Vitest + React Testing Library
npm run build             # baut beide Ziele: dist/lib (React-Bibliothek) und dist/webcomponent
```

### Ohne laufendes Backend/AuthService entwickeln

`VITE_USE_MOCKS=true` in `.env` aktiviert einen [MSW](https://mswjs.io/)-Mock-Layer
(`src/mocks/`) mit einer realistischen Beispiel-Diskussion (Tempolimit-Thema mit
Pro/Contra/Differenzierung-Argumenten, Kommentaren, Demo-Login `demo@flussmark.de` /
`demo1234`). Damit laesst sich die komplette UI lokal im Browser sehen und bedienen, ohne dass
ForumService-Backend oder AuthService erreichbar sein muessen. **Niemals in Produktion aktivieren.**

`public/mockServiceWorker.js` ist bereits eingecheckt (generiert via `npx msw init public/ --save`
- bei einem MSW-Versions-Update neu generieren, sonst meldet die Konsole eine
Integrity-Checksum-Warnung).

### Gegen die echten (Remote-)Services entwickeln

CORS wird laut `Architecture.md` zentral auf NGINX-Ebene gehandhabt, nicht in den einzelnen
Services. `npm run dev` läuft aber standardmäßig auf `http://localhost:5173` ohne diesen
NGINX-Layer davor - ein `VITE_USE_MOCKS=false`-Dev-Server, der direkt gegen
`https://forum.freischule.info`/`https://auth.freischule.info` spricht, schlägt deswegen lokal
mit einem CORS-Fehler im Browser fehl (kein Backend-Defekt). Für echte End-to-End-Tests lokal
entweder einen Reverse-Proxy vorschalten, der die Produktions-NGINX-Konfiguration nachbildet, oder
CORS für den jeweiligen Dev-Origin am Zielservice temporär erlauben.

## Mit festem Startthema oder mit allgemeiner Themenuebersicht

`nodeId` (React) bzw. `node-id` (Web Component) ist optional:

- **Gesetzt** - zeigt direkt die angegebene Wurzel-Diskussion, ohne "+"-Button zum Anlegen neuer
  Themen (z.B. FreiSchule bindet ein bestimmtes Unterrichtsthema fest ein).
- **Weggelassen** - zeigt zunaechst die allgemeine Themenuebersicht (alle Themen, sortierbar) samt
  "+"-Button zum Anlegen eines neuen Themas. Auswahl eines Themas wechselt in die Diskussionsansicht
  und steuert sich ab dann ueber den `?thema=`-Deep-Link-Parameter (siehe unten).

Die Ueberschrift "Diskussionsforum" wird in **beiden** Faellen immer angezeigt und ist immer
klickbar - sie fuehrt jederzeit zur allgemeinen Themenuebersicht, auch wenn `nodeId`/`node-id` fest
vorgegeben wurde. Der Weg zurueck zur Gesamtuebersicht des Forums bleibt so auch aus einer fest
eingebundenen Einzeldiskussion heraus immer erreichbar.

## Nutzung als React-Bibliothek

```tsx
import { ForumThread } from '@forumservice/frontend';
import '@forumservice/frontend/style.css';

<ForumThread nodeId="<themaId>" />
```

Eigenstaendig: `<ForumThread>` bringt einen kompletten Login/Register-Flow mit (Email-first,
automatisches Login via Refresh-Cookie, stilles Refresh kurz vor Ablauf). Ist die Host-App (z.B.
FreiSchule) bereits eingeloggt, per `externalAuth` deaktivieren, damit nicht zwei Apps gleichzeitig
gegen den rotierenden Refresh-Token des AuthService laufen:

```tsx
<ForumThread nodeId="<themaId>" externalAuth={{ accessToken: myAppToken, onNeedRefresh: myRefreshFn }} />
```

Mehrere `<ForumThread>`-Instanzen auf einer Seite koennen sich einen Login teilen, indem man selbst
einen `<ForumAuthProvider>` aussenrum legt und `<ForumThreadView>` (statt `<ForumThread>`) verwendet
- siehe `src/App.tsx` fuer ein Beispiel.

## Nutzung als Web Component (TYPO3 / PHP)

```html
<link rel="stylesheet" href="/style.css" />
<script src="/forum-thread.iife.js"></script>
<forum-thread node-id="<themaId>"></forum-thread>
```

Hier laeuft immer der volle eigenstaendige Login/Register-Flow (kein `externalAuth` moeglich, da
kein React-Host-Kontext existiert, durch den ein Token gereicht werden koennte).

## Dark Mode / `theme`-Prop

`darkMode` in `tailwind.config.js` steht auf `'class'`, nicht auf Tailwinds Default `'media'` - eine
Host-App, die ihr eigenes Dark-Theme per Klasse umschaltet (z.B. `<html class="dark">`), statt sich
rein auf die OS-Einstellung `prefers-color-scheme` zu verlassen, wurde von `'media'` schlicht
ignoriert (ForumService Issue #6: die Themen-Startseite blieb weiss, obwohl das Dark-Theme der
Host-App aktiv war). Tailwinds `'class'`-Strategie matcht **jeden** Vorfahren mit `.dark`, nicht nur
einen direkten Wrapper - ein bereits vorhandener Host-Toggle auf `<html>`/`<body>` greift also ohne
weiteres Zutun.

Ohne jede Host-Steuerung bleibt das bisherige Verhalten erhalten: `<ForumThread>` erkennt
`prefers-color-scheme` selbst (per `useResolvedDarkMode`, siehe `src/hooks/`) und setzt/entfernt
dafuer eine eigene `dark`-Klasse auf einem Wrapper um sich selbst. Ein Host, der sein Theme aktiv
selbst trackt, kann es explizit durchreichen - analog zu `externalAuth` fuer den Login-State:

```tsx
<ForumThread nodeId="<themaId>" theme={hostIsDarkMode ? 'dark' : 'light'} />
```

```html
<forum-thread node-id="<themaId>" theme="dark"></forum-thread>
```

`theme` ist optional (Default `'auto'` = OS-Praeferenz) und akzeptiert `'light' | 'dark' | 'auto'`.

**Grenze:** `theme` ersetzt nur ForumThreads eigene OS-Praeferenz-Erkennung, nicht die CSS-Kaskade -
`theme="light"` kann eine `.dark`-Klasse auf einem Vorfahren, in den ForumThread eingebettet ist,
nicht "uebersteuern" (reine CSS-Vererbung). Ein Host, der ForumThread bewusst anders themen will als
den Rest der Seite, muss es ausserhalb dieses `.dark`-Scopes einbinden.

## Deep-Linking

Folgt dem URL-Contract aus Spec Abschnitt 12: `?thema=<id>&fokus=<id>&kommentare=<id>`.
- `thema` bestimmt, welche Wurzel-Diskussion geladen wird (ueberschreibt die `nodeId`-Prop).
- `kommentare` oeffnet automatisch das Kommentar-Popup fuer den genannten Node.
- `fokus` laedt den vollstaendigen Pfad von der Thema-Wurzel bis zum Ziel-Node (`GET
  /nodes/:id/pfad`) und klappt jeden `ArgumentNode` auf diesem Pfad automatisch auf, statt den
  Ziel-Node nur hervorzuheben, wenn er zufaellig schon geladen war.

## Referenzen und Like-Status

- Jeder Node liefert `liked_by_me: boolean | null` (`null` = anonym/unbekannt) direkt vom Backend
  mit - der `LikeButton` startet mit diesem Wert statt einem lokalen Rate-Mechanismus.
- Jedes Argument hat einen "Referenzen anzeigen"-Button (`GET /nodes/:id/referenzen`), der die
  ausgehenden Referenzen dieses Nodes auflistet - zusaetzlich zum bestehenden
  "Referenzieren"-Button zum Anlegen neuer Referenzen (`POST /nodes/:id/referenz`).

## Moderation (FORUM_MODERATOR/ADMIN)

Ein "Moderation"-Block erscheint unterhalb jedes Nodes (Thema-Header und jedes `ArgumentNode`),
sobald `user.roles` aus dem dekodierten JWT (`src/auth/roles.ts`) `FORUM_MODERATOR` oder `ADMIN`
enthaelt - fuer alle anderen Aufrufer bleibt er unsichtbar. Die eigentliche Autorisierung liegt
weiterhin allein beim Backend (`requireRole(...)` in `src/routes/nodes.js`); die Client-Rolle
steuert nur, welche Buttons ueberhaupt gerendert werden.

- **Text bearbeiten** (`PUT /nodes/:id/text`, Mod/Admin) - oeffnet `EditTextModal` mit dem
  aktuell angezeigten Text vorausgefuellt, speichert eine neue Textversion.
- **Privat/Oeffentlich schalten** (`PUT /nodes/:id/sichtbarkeit`, nur Admin, nur `typ: "thema"`).
- **Loeschen** (`DELETE /nodes/:id`, Mod/Admin) - Soft-Delete mit optionalem Grund; nach Erfolg
  verschwindet der Node aus der jeweiligen Liste (Spalten-Reload bzw. Zurueck zur Themenuebersicht
  beim geloeschten Thema-Root).

**Kein Restore/Undelete:** Das Backend hat aktuell keinen Undelete-Endpunkt, und ein
soft-geloeschter Node liefert fuer jeden Aufrufer (auch Mod/Admin) `404` auf jedem weiteren
Abruf - er ist ab dem Loeschen also serverseitig nicht mehr erreichbar. Eine Restore-UI liesse
sich daher ohne einen neuen Backend-Endpunkt nicht sinnvoll bauen.

## Struktur

```
src/
  api/          typisierter ForumService-Client + Typen (spiegeln src/utils/serialize.js exakt)
  auth/         ForumAuthProvider, AuthService-Client, JWT-Decode, Refresh-Mutex/-Scheduler
  components/   ForumThread und alle Unterkomponenten (ForumUIContext buendelt sort/focus/
                Callback-Props fuer den rekursiven Argumentbaum, statt sie durchzureichen)
  hooks/        useCursorPaginated, useDeepLinkParams
  mocks/        MSW-Handler + Demo-Daten (nur VITE_USE_MOCKS=true)
```
