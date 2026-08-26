# Forum-Microservice – Technische Spezifikation

## 1. Ziel

Ein Diskussionsforum-Microservice, der strukturierte Argumentation (Pro / Contra / Differenzierung,
verlinkte Argumente als Graph) mit klassischer, linearer Forumsfunktion (Kommentare) kombiniert.
Einbindung in mehrere bestehende Frontends (React, TYPO3, PHP/HTML) über eine gemeinsame API.

## 2. Architektur

- Eigenständiger Microservice, **Node.js mit Express.js** als Backend, MongoDB als Datenbank.
- **Frontend**: Eine einzige React-Codebasis für die UI (Themen-/Argumentbaum, Kommentar-Popups,
  Like-/Sortier-Steuerung). Kein separates Frontend pro Einbindung.
  - **FreiSchule**: React-Komponente wird direkt nativ eingebunden (`<ForumThread nodeId={...} />`).
  - **INWO (TYPO3) und PHP/HTML-Seiten**: Dieselbe React-Komponente wird zusätzlich als
    **Web Component** verpackt (z. B. mit `react-to-webcomponent` oder einem schlanken
    Custom-Element-Wrapper um `ReactDOM.render`), sodass sie dort als `<forum-thread node-id="...">`
    ohne eigenes Frontend-Rebuild eingebunden werden kann. Kein iframe nötig, kein zweiter
    UI-Stack — nur ein zusätzlicher Build-Output (Web-Component-Bundle) derselben Komponente.
- Auth über JWT, validiert mit Public Key vom bestehenden AuthService. Der Public Key wird
  **ausschließlich zur Laufzeit vom AuthService abgerufen** (nie aus der `.env` gelesen oder
  hartkodiert) — nur die AuthService-URL selbst steht in der `.env`. Einmaliger Fetch beim
  Service-Start, Key rotiert im Betrieb nicht — trotzdem defensiv cachen mit Reload-Möglichkeit
  per Admin-Endpoint oder Neustart, falls der Key doch mal wechselt.
  - **Token-Lebenszyklus**: JWT läuft nach 15 Minuten ab. Refresh alle 10 Minuten über den
    Refresh-Token beim AuthService (also mit Puffer vor Ablauf, nicht erst wenn der Token schon
    ungültig ist). Das Frontend übernimmt das Refresh automatisch im Hintergrund (Timer/Interceptor),
    ohne dass der User etwas davon merkt.
  - **Automatisches Login**: Ist beim Laden der Seite bereits ein gültiger Refresh-Token im Browser
    gespeichert (z. B. HttpOnly-Cookie), erfolgt der Login automatisch beim ersten Aufruf — kein
    manuelles erneutes Einloggen nötig, solange der Refresh-Token gültig ist.
- Rollen/Berechtigungen kommen aus dem JWT (`roles`, `permissions`). Forum-eigene Rollen
  (z. B. `forum_moderator`) werden im AuthService angelegt/mitgespeichert, nicht lokal im Forum.
- Anbindung an bestehende Services:
  - **AuthService**: JWT-Validierung via Public Key (JWKS oder statischer Key).
  - **EmailService**: Trigger "Antwort auf mein Argument/Kommentar" (fest verdrahtet, synchron
    per API-Call oder Event).
  - **ProfilService**: Speichert "letzte Ansicht" (`nodeId`, Timestamp) und später
    Benachrichtigungspräferenzen. Forum ruft `POST/GET /profil/{userId}/...` auf.
  - **MediaService**: Bild-Uploads laufen über den MediaService, das Forum speichert nur die
    zurückgegebene URL. Alles andere (Studien, Artikel, Videos) wird vorerst nur als externer Link
    gespeichert, keine eigene Spiegelung. (Später denkbar: PDFs/Bilder auf MediaService spiegeln,
    Videos über eigenen PeerTube-Server — nicht Teil des ersten Wurfs.)

## 3. Datenmodell (MongoDB)

### 3.1 Collection `nodes`

Ein Node ist entweder ein **Thema** oder ein **Argument**. Beide teilen sich dieselbe Struktur.

```js
{
  _id: ObjectId,
  typ: "thema" | "argument",
  texte: {
    neutral: [{ version: 1, text: "...", autor_id, datum, }],
    pro:     [{ version: 1, text: "...", autor_id, datum }],
    contra:  [{ version: 1, text: "...", autor_id, datum }]
    // "neutral" ist die Differenzierungs-/Kontext-Spalte bei Argumenten,
    // bei Themen der einleitende neutrale Text.
    // Nur letzte Version wird angezeigt, komplette History bleibt im Array erhalten
    // (kein Konflikt-Handling nötig, "letzte Version gewinnt").
  },
  tags: [ObjectId, ...],       // Referenzen auf tags-Collection, many-to-many
  anhaenge: [
    { typ: "bild" | "link" | "studie" | "quelle", url: String, titel: String, hinzugefuegt_von, datum }
  ],
  ersteller_id: ObjectId,
  erstellt_am: Date,
  likes_count: Number,         // denormalisiert für Sortierung
  bearbeitet_von: [ObjectId],  // wer je editiert hat (nur Mod/Admin dürfen editieren)
  soft_deleted: Boolean,       // Soft-Delete-Flag, default false
  soft_deleted_grund: String,
  soft_deleted_von: ObjectId,
  sichtbarkeit: "oeffentlich" | "privat",  // nur relevant bei typ: "thema", default "oeffentlich"
}
```

`sichtbarkeit` gilt nur auf Themen-Ebene (Wurzel einer Diskussion) und wird beim Lesen auf die
gesamte darunterliegende Diskussion angewendet — einzelne Argumente/Kommentare haben kein eigenes
Sichtbarkeits-Flag, sie erben es vom zugehörigen Thema. Nur Admins dürfen `sichtbarkeit` umschalten
(`PUT /nodes/{id}/sichtbarkeit`, nur `typ: "thema"`). Nicht eingeloggte oder nicht-privilegierte
User bekommen private Themen weder in Listen (`GET /themen`) noch per Direktaufruf (`GET /nodes/{id}`)
angezeigt (403/404, kein Unterschied nach außen, um Existenz nicht zu verraten).

### 3.2 Collection `edges`

```js
{
  _id: ObjectId,
  von: ObjectId,     // Kind-Node (das Argument)
  zu: ObjectId,       // Eltern-Node (Thema oder übergeordnetes Argument)
  typ: "pro" | "contra" | "differenzierung" | "referenz",
  autor_id: ObjectId,
  erstellt_am: Date
}
```

- `typ: "referenz"` verweist auf einen bereits existierenden Node in einer anderen Diskussion,
  statt Inhalte zu duplizieren (siehe Abschnitt 6 – Referenzierung).
- Indizes: `{ zu: 1, typ: 1 }`, `{ von: 1 }` für schnelle Traversierung in beide Richtungen.
- `$graphLookup` **immer** mit `maxDepth` verwenden — für "ganzen Unterbaum laden" (falls je
  gebraucht), niemals unbegrenzt. Standard-Ladepfad ist aber "lade direkte Kinder pro Klick/Scroll",
  kein rekursives Laden des gesamten Baums auf einmal (siehe Pagination, Abschnitt 8).

### 3.3 Collection `likes`

```js
{
  _id: ObjectId,
  node_id: ObjectId,
  user_id: ObjectId,
  datum: Date
}
```
Unique Index auf `{ node_id: 1, user_id: 1 }`, um Mehrfach-Likes zu verhindern.
Bei Like/Unlike: `likes_count` am Node per `$inc` synchron mitführen.

### 3.4 Collection `comments` (klassische Forumsfunktion)

Linearer, unstrukturierter Kommentarbereich pro Node — bewusst getrennt von der
Pro/Contra/Differenzierung-Struktur, um den Argumentbaum sauber zu halten. Für Rückfragen,
Meta-Diskussion, Feedback, ohne dass jede Nebenbemerkung als eigener Argument-Knoten angelegt
werden muss.

```js
{
  _id: ObjectId,
  node_id: ObjectId,        // an welchem Argument/Thema hängt der Kommentar
  parent_comment_id: ObjectId | null,  // einfache Verschachtelung, keine Graph-Logik nötig
  text: String,
  autor_id: ObjectId,
  erstellt_am: Date,
  soft_deleted: Boolean
}
```

### 3.5 Collection `tags`

```js
{
  _id: ObjectId,
  name: String,             // z.B. "Klimawandel"
  parent_tag_id: ObjectId | null,  // optionale Hierarchie für Navigations-/Browsing-Ansicht
  beschreibung: String
}
```
Tags bilden die Navigationsstruktur (z. B. Umwelt > Klimawandel), sind aber rein zur Anzeige/Filterung
gedacht — nicht die tatsächliche Speicherhierarchie. Ein Node kann mehrere Tags haben.

## 4. Referenzierung von Argumenten zwischen Diskussionen

Ein Argument kann als eigenständiges Thema *und* als Referenz in einer anderen Diskussion auftreten,
ohne dupliziert zu werden.

- Beispiel: Das Thema "Ist CO2 wirklich gefährlich?" hat einen Pro-Zweig-Knoten
  ("CO2 ist Haupttreiber der Erwärmung") und einen Contra-Zweig-Knoten
  ("CO2 fördert Pflanzenwachstum, geringe Mengen unbedenklich").
- Ein Argument in der Tempolimit-Diskussion, das sagen will "CO2 ist gefährlich, deshalb reduzieren",
  legt eine `referenz`-Edge auf den **konkreten Pro-Zweig-Knoten** an (nicht auf das Thema allgemein).
- Ein gegenteiliges Argument referenziert entsprechend den passenden Contra-Zweig-Knoten, oder legt
  einen neuen Teilknoten unter CO2 an, falls noch keiner passt.
- Kein zusätzliches "Stance"-Feld auf der Referenz-Kante nötig — der referenzierte Node weiß selbst,
  ob er im CO2-Baum ein Pro- oder Contra-Argument ist. Die UI zeigt das entsprechend eingefärbt an.
- **Zyklenschutz:** Bei Anzeige referenzierter Knoten (Karte mit Zusammenfassung + Link) besuchte
  IDs auf Anwendungsebene tracken, um Endlosschleifen bei zirkulären Referenzen zu verhindern.
  Für Referenz-Traversierung `$graphLookup` mit striktem `maxDepth` (z. B. 1, da meist nur die
  Zusammenfassung des Zielknotens angezeigt wird, kein weiteres Aufklappen).

## 5. Sortier-Algorithmen

Drei Modi, umschaltbar in der UI, pro Node-Ebene (Kinder eines Threads):

1. **Neueste zuerst**: Index `{ parent: 1, erstellt_am: -1 }`.
2. **Meistgelikt**: Index `{ parent: 1, likes_count: -1 }`. Reine absolute Like-Zahl.
3. **Beste/Ausgewogen** (dritter Modus, **Standardeinstellung**): Verhindert, dass gute neue Argumente wegen niedriger
   absoluter Like-Zahl ganz unten landen, lässt aber ältere, stark gelikte Argumente bewusst oben
   stehen (kein Verfall über Zeit wie bei Hacker-News-Ranking — explizit gewünscht: "ältere oft
   gelikte Argumente sollen oben bleiben"). Vorschlag: **Wilson-Score-Intervall** auf
   Likes/Views-Basis (Konfidenz-basiertes Ranking, kein Zeitfaktor). Alternativ einfacher Startpunkt:
   `likes_count` als Primärsortierung, `erstellt_am` nur als Tie-Breaker — Wilson-Score kann iterativ
   nachgerüstet werden, falls die einfache Variante nicht überzeugt.

## 6. Moderation

- **Admins**: alle Rechte.
- **Moderatoren**: dürfen Nodes bearbeiten (neue Version anlegen), soft-deleten, Kommentare
  soft-deleten.
- **Normale User**: dürfen neue Nodes (Themen/Argumente) und Kommentare anlegen, liken. Bearbeiten
  von bestehenden Nodes ist ihnen **nicht** erlaubt (abweichend vom initial genannten
  "wiki-style für alle" — nach Rücksprache: nur Mod/Admin editieren direkt).
- **Später (nicht Teil des ersten Wurfs)**: Bearbeitungsvorschläge durch normale User als eigener
  Dokumenttyp (`edit_proposals`), die vom Ersteller oder einem Moderator übernommen werden können.
- Soft-Delete statt Hard-Delete für Nodes und Kommentare (`soft_deleted: true` + Grund), damit
  nichts unwiderruflich verschwindet und Referenzen auf gelöschte Nodes nicht ins Leere zeigen.
- **User bannen**: Ein Bann (Konto komplett sperren) sollte im **AuthService** verwaltet werden,
  nicht im Forum — dann greift die Sperre automatisch überall (Login/Refresh schlägt fehl, JWT wird
  nicht mehr ausgestellt), nicht nur im Forum. Das Forum selbst prüft dafür nichts Zusätzliches,
  ein gesperrter User bekommt schlicht kein gültiges JWT mehr vom AuthService.
  Da aktuell kein Spam erwartet wird, ist das erstmal ausreichend. Falls später ein leichterer,
  forum-lokaler Mechanismus gewünscht ist (z. B. "User darf 24h nicht posten", ohne gleich das
  ganze Konto zu sperren), wäre das ein späterer Ausbau (eigenes `gesperrt_bis`-Feld pro User,
  geprüft bei schreibenden Endpunkten) — nicht Teil des ersten Wurfs.

## 7. E-Mail-Benachrichtigung

- Erster Wurf: fest verdrahteter Trigger bei folgenden Ereignissen, jeweils an den Ersteller des
  betroffenen Nodes:
  - Neues Argument (Edge `pro`/`contra`/`differenzierung`) wird unter meinem Argument angelegt.
  - Neuer Kommentar wird auf meinem Argument oder Thema angelegt.
  - Keine Benachrichtigung bei eigener Aktivität (User antwortet/kommentiert auf eigenen Node).
  - → synchroner Call oder Event an EmailService.
- Benachrichtigungspräferenzen (z. B. "nur direkte Antworten") werden vom ProfilService verwaltet
  und dort abgefragt — das Forum speichert selbst keine Präferenzen.
- **Später denkbar**: täglicher Digest-Report (Like-Schwellen erreicht, Aktivität in beobachteten
  Diskussionen) — bewusst nicht Teil des ersten Wurfs, da deutlich komplexer (Aggregation über
  Zeitraum, mehrere Diskussionen).

## 8. Pagination / Nachladen

- Es wird erwartet, dass Diskussionen sehr lang werden (hunderte Argumente pro Ebene).
- Kein Laden des kompletten Unterbaums auf einmal. Stattdessen: paginiertes Laden der Kinder pro
  Ebene, sortiert nach gewähltem Modus (Abschnitt 5), mit "mehr laden" / automatischem Nachladen
  beim Scrollen (Cursor-basierte Pagination, z. B. `{ parent, sort_val, _id }` als Cursor, kein
  Offset-basiertes Paging wegen Skip-Performance bei MongoDB).

## 9. Volltextsuche

- Ziel: verhindern, dass Duplikat-Diskussionen entstehen ("gibt es das Argument nicht schon?"),
  und generelles Auffinden von Themen/Argumenten.
- Start: MongoDB Atlas Search (falls Atlas gehostet) oder klassischer Text-Index auf
  `texte.neutral.text`, `texte.pro.text`, `texte.contra.text`.
- **Später/parallel geplant**: Auf einem anderen Projekt existiert bereits ein Ansatz mit
  500-Wörter-Chunks und 738-dimensionalen Vektor-Embeddings für semantische Suche. Für das Forum
  wäre eine hybride Suche denkbar (klassischer Volltext-Index + Vektor-Ähnlichkeitssuche über
  Node-Texte), um auch inhaltlich ähnliche, aber anders formulierte Argumente zu finden — als
  spätere Ausbaustufe, nicht Teil des ersten Wurfs. Sollte beim Datenmodell aber mitgedacht werden
  (z. B. `embedding_chunks`-Collection analog zum anderen Projekt, damit die Migration später
  nicht das Node-Schema bricht).

## 10. Klassische Forumsfunktion

Siehe `comments`-Collection (Abschnitt 3.4). Linearer Kommentarbereich pro Node, getrennt von der
Pro/Contra/Differenzierung-Struktur. Nutzer, die nicht in Argumentbäumen denken wollen, können hier
klassisch diskutieren, ohne die strukturierte Debatte zu verwässern. Wer aus einem Kommentar ein
echtes Gegenargument machen will, legt bewusst einen neuen Argument-Node an.

Da `comments` generisch an `node_id` hängt (kein Unterschied zwischen `typ: "thema"` und
`typ: "argument"`), gilt die Kommentarfunktion automatisch für **beide** Node-Typen — sowohl das
Diskussionsthema selbst als auch jedes einzelne Argument kann kommentiert werden, ohne zusätzliche
Modellierung.

**Darstellung als Popup:** Kommentare werden nicht inline im Baum angezeigt, sondern über ein
Kommentar-Icon mit Zähler (`comments_count`, denormalisiert am Node analog zu `likes_count`) am
jeweiligen Thema- oder Argument-Node geöffnet. Klick öffnet ein Popup/Modal mit dem paginierten
Kommentarbereich dieses Nodes (siehe Abschnitt 8, gleiche Cursor-Pagination), ohne den Hauptbaum zu
verlassen oder neu zu laden.

Das Popup ist per eigenem Query-Parameter direkt verlinkbar (siehe Abschnitt 12 für den vollen
URL-Contract), z. B. `&kommentare=<nodeId>` — öffnet beim Laden der Seite automatisch das
Kommentar-Popup für den angegebenen Node.

## 11. API-Grobskizze

```
GET    /themen?tags=...                          Liste Themen (gefiltert nach Tag)
GET    /nodes/{id}                                 Einzelner Node inkl. aktueller Textversionen
GET    /nodes/{id}/kinder?typ=pro|contra|differenzierung&sort=neu|likes|beste&cursor=...
                                                    Paginierte Kinder einer Ebene
POST   /nodes                                      Neuer Node (Thema oder Argument)
PUT    /nodes/{id}/text                            Neue Textversion (nur Mod/Admin)
PUT    /nodes/{id}/sichtbarkeit                     Öffentlich/privat umschalten (nur Admin, nur Themen)
DELETE /nodes/{id}                                  Soft-Delete (nur Mod/Admin)
POST   /nodes/{id}/referenz                        Referenz-Edge auf bestehenden Node anlegen
POST   /nodes/{id}/likes                            Like setzen
DELETE /nodes/{id}/likes                            Like entfernen
GET    /nodes/{id}/kommentare?cursor=...            Paginierte Kommentare
POST   /nodes/{id}/kommentare                       Neuer Kommentar
GET    /suche?q=...                                 Volltextsuche über Themen/Argumente
```

Alle schreibenden Endpunkte prüfen Rolle/Berechtigung aus dem validierten JWT.

## 12. Einbindung in bestehende Frontends

Siehe Abschnitt 2 für den Tech-Stack (eine React-Codebasis, zusätzlich als Web Component paketiert
für TYPO3/PHP). Hier nur der URL-Contract für Deep-Linking:
- **Deep-Linking**: `https://forum.example.de/diskussion?thema=<themaId>&fokus=<argumentId>&kommentare=<nodeId>`.
  `thema` lädt die Wurzel-Diskussion, `fokus` scrollt zum/highlighted das spezifische Argument und
  klappt den Pfad dorthin automatisch auf, `kommentare` öffnet zusätzlich automatisch das
  Kommentar-Popup für den angegebenen Node (Thema oder Argument, siehe Abschnitt 10). `fokus` und
  `kommentare` können auch kombiniert auftreten (z. B. Link direkt zu einem Argument samt offenem
  Kommentar-Popup). Gilt für alle Einbindungsarten (eigene Seite, Web Component, iframe) — gleicher
  Parameter-Contract.
- **Letzte Ansicht**: Beim Betreten/Verlassen eines Node-Views meldet das Frontend
  `nodeId + timestamp` an den ProfilService (`POST /profil/{userId}/last-view`), unabhängig vom
  einbindenden Frontend.

## 14. Betrieb & Sicherheit

- **Lesezugriff öffentlich, mit Ausnahme**: Diskussionen (Themen, Argumente, Kommentare) sind ohne
  Login lesbar — nur schreibende Aktionen (Node/Kommentar anlegen, Liken, Editieren) erfordern ein
  gültiges JWT. Admins können jedoch einzelne Themen (z. B. sensible Debatten bei der INWO) auf
  `sichtbarkeit: "privat"` setzen (siehe Abschnitt 3.1) — dann ist die gesamte Diskussion nur für
  eingeloggte User mit entsprechender Berechtigung sichtbar.
- **Rate-Limiting**: Schreibende Endpunkte (Node anlegen, Kommentar anlegen, Like setzen) bekommen
  ein Rate-Limit pro User (z. B. via `express-rate-limit`), um Spam/Missbrauch einzudämmen.
- **Service-Konfiguration**: URLs von AuthService, EmailService, ProfilService und MediaService
  werden über Umgebungsvariablen konfiguriert (nicht hartkodiert), damit sich der Service
  problemlos zwischen Umgebungen (lokal/staging/prod) verschieben lässt. Der ForumService pflegt
  eine `.env.example` im Repo mit allen benötigten Variablen (Service-URLs, MongoDB-Connection-
  String, Port etc.), damit Admins beim Aufsetzen wissen, was einzutragen ist. Der JWT-Public-Key
  gehört **nicht** in die `.env` (siehe Abschnitt 2 — wird ausschließlich vom AuthService geladen).

## 15. Offene Punkte für später (bewusst nicht im ersten Wurf)

- Bearbeitungsvorschläge durch normale User (eigener Dokumenttyp, Freigabe-Workflow).
- Digest-E-Mails (tägliche Zusammenfassung statt nur Antwort-Trigger).
- Spiegelung externer Medien (Bilder/PDFs auf MediaService, Videos über eigenen PeerTube-Server)
  statt reiner externer Verlinkung.
- Hybride Volltext- + Vektor-Embedding-Suche.
- Wilson-Score-Verfeinerung des dritten Sortiermodus, falls die einfache Variante nicht ausreicht.
