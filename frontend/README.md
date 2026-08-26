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

## Deep-Linking

Folgt dem URL-Contract aus Spec Abschnitt 12: `?thema=<id>&fokus=<id>&kommentare=<id>`.
- `thema` bestimmt, welche Wurzel-Diskussion geladen wird (ueberschreibt die `nodeId`-Prop).
- `kommentare` oeffnet automatisch das Kommentar-Popup fuer den genannten Node.
- `fokus` hebt den Ziel-Node optisch hervor und scrollt zu ihm, **sobald** er im aktuell geladenen
  Baum sichtbar ist (siehe "Bekannte Backend-Luecken" unten - automatisches Aufklappen des Pfads
  von der Wurzel bis zum Ziel ist noch nicht moeglich).

## Bekannte Backend-Luecken (nicht in diesem Frontend behebbar, Folge-Tasks fuers Backend)

1. **Keine Route zum Auflisten ausgehender Referenzen eines Nodes.** `POST /nodes/:id/referenz`
   existiert, aber es gibt kein `GET`, um vorhandene Referenzen wieder anzuzeigen. Die UI kann
   Referenzen daher nur *anlegen* ("Referenzieren"-Button an jedem Argument), nicht *auflisten*.
2. **Kein "hat der aktuelle User dieses Node geliked"-Signal.** Der Like-Status (gefuellte/leere
   Herz-Anzeige) wird rein client-seitig in `localStorage` nachgehalten (`LikeButton.tsx`) - nicht
   autoritativ, geraeteuebergreifend inkonsistent.
3. **Keine Route fuer die Vorfahren eines Nodes.** Der `fokus`-Deep-Link-Parameter kann den
   Ziel-Node daher nicht automatisch im Baum freilegen (Pfad von der Thema-Wurzel bis dorthin
   aufklappen) - nur hervorheben, sobald er ohnehin geladen ist.

## Struktur

```
src/
  api/          typisierter ForumService-Client + Typen (spiegeln src/utils/serialize.js exakt)
  auth/         ForumAuthProvider, AuthService-Client, JWT-Decode, Refresh-Mutex
  components/   ForumThread und alle Unterkomponenten
  hooks/        useCursorPaginated, useDeepLinkParams
  mocks/        MSW-Handler + Demo-Daten (nur VITE_USE_MOCKS=true)
```
