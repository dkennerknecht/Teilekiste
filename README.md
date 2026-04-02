# Teilekiste

Self-hosted Inventar-Webapp fuer kleine Werkstaetten, Elektroniklabore und Materiallager auf Basis von Next.js, Prisma und SQLite.

Der aktuelle Schwerpunkt liegt auf:

- schneller mobiler Nutzung
- sauberer Lagerstruktur mit Shelf- und Drawer-Logik
- nachvollziehbarer Bestandsfuehrung
- technischen Materialdaten
- robustem Import, Backup und Restore
- einfacher Selbsthostbarkeit per Docker Compose

## Stack

- Next.js 14, React 18, TypeScript
- Prisma + SQLite
- NextAuth Credentials Login
- Tailwind CSS
- Uploads auf lokales Volume
- Docker Compose fuer Betrieb und Persistenz

## Aktueller Funktionsumfang

### Inventar und Items

- Items anlegen, bearbeiten, archivieren und in den Papierkorb verschieben
- automatische Label-Vergabe im Format `KATEGORIE-TYPE-NNN`, z. B. `EL-WI-024`
- fortlaufende Nummern pro Kategorie/Type-Kombination ohne Wiederverwendung geloeschter Nummern
- Bilder und Attachments direkt beim Anlegen und Bearbeiten
- Tags direkt beim Anlegen und Bearbeiten
- Dublettenwarnung bei Name/MPN
- Admin-Workflow fuer Dubletten mit Merge-Preview und sicherem Vollmerge

### Lagerstruktur

- Lagerorte
- Shelfs pro Lagerort
- Shelf-Code als feste Positionskennung mit genau zwei Buchstaben pro Lagerort, z. B. `AB`
- Shelf-Modi `OPEN_AREA` und `DRAWER_HOST`
- Drawer unter Shelfs mit zweistelliger Nummer `01..99`
- sichtbare Drawer-Labels als Kombination aus Shelf + Drawer, z. B. `AB01`
- optionale Unterfaecher pro Drawer fuer Items, ohne dass das Unterfach auf dem physischen Drawer-Label erscheinen muss
- eigene Lagerplatzuebersicht unter `Locations`

### Platzierung, Bestand und Historie

- Placement-Status `PLACED`, `UNPLACED`, `INCOMING`
- eigene Ansicht fuer unplatzierte und erwartete Items
- explizite Einzeltransfers und Bulk-Transfers
- Bestandsbewegungen, Reservierungen und verfuegbarer Bestand
- Einkaufsliste fuer Items unter Mindestbestand
- Inventur-Sessions mit Draft, Review und Finalize
- Audit-Historie fuer Updates, Transfers und weitere Admin-Aktionen

### Mengenlogik

- klassische Einheiten wie `STK`, `SET`, `PACK`
- Meterware `M` mit interner Speicherung in `mm`
- Dezimalmengen fuer Bestand, Mindestbestand, Bewegungen und Reservierungen
- Anzeige und API-Ausgabe fuer Meterware in `m`

### Datenqualitaet und Felder

- freie `Custom Fields`
- verwaltete `Technical Field Sets` pro `Kategorie + Type`
- technische Presets sind im Admin bearbeitbar und neu anlegbar
- Listenwerte mit Katalog, Reihenfolge und Drag-and-drop-Sortierung
- Wert-Normalisierung, Aliase und Vorschlaege fuer bessere Datenqualitaet

### Import, Export, Labels und Backup

- Admin-Import mit Profilen, Header-Fingerprint und Preview/Apply
- CSV- und JSON-Export
- P-touch-CSV-Export fuer Shelfs, Drawers oder beide zusammen
- freie Wahl des CSV-Delimiters fuer den P-touch-Export: `;`, `,` oder `Tab`
- ZIP-Backup mit Exportdaten, Uploads und Attachments
- Restore mit Preview sowie `merge` oder `overwrite`
- Restore deckt den heutigen App-Zustand inklusive Shelfs, Drawers, Placement-Daten, Inventur-Sessions und relevanter Nutzerdaten ab

### Admin und Zugriff

- Benutzerverwaltung mit Rollen
- Kategorien, Types, Tags, Lagerorte und Shelfs verwalten
- Drawer-Management mit Einzelanlage, Range-Anlage, Move und Swap
- Custom Fields und Technical Field Sets verwalten
- App-Sprache zwischen Deutsch und Englisch umschalten
- Read-only API Tokens

### Mobile Nutzung und Scanner

- responsive Hauptnavigation
- responsive Startseite, Detailseiten und Admin-Bereiche
- Scanner-Seite fuer Shelf-, Drawer- und Item-Codes
- Drawer-/Shelf-first-Scanner mit Item-Fallback
- fuer LAN-Nutzung auf Handy geeignet

## Wichtige Produktregeln

### Label-System fuer Items

- Item-Labels werden automatisch erzeugt.
- Das Format bleibt `KATEGORIE-TYPE-NUMMER`.
- Beim Aendern von Kategorie oder Type wird bei Bedarf automatisch ein neues Label vergeben.
- Nummern werden nicht recycelt.

### Lagerplatz-Labels

- Shelf-Labels bestehen aus genau zwei Buchstaben pro Lagerort, z. B. `AB`.
- Drawer-Labels bestehen aus Shelf + Drawer-Nummer, z. B. `AB01`.
- Unterfaecher bleiben Item-intern und erscheinen in der App, aber nicht zwingend auf dem physischen Label.

### Placement-Status

- `PLACED`: normal eingelagert und als verfuegbarer Bestand nutzbar
- `UNPLACED`: physisch vorhanden, aber noch ohne finalen Lagerplatz
- `INCOMING`: bestellt oder erwartet, aber noch nicht physisch eingelagert

### Verfuegbarer Bestand

- Auf Uebersichtsseiten wird verfuegbarer Bestand angezeigt.
- Reservierungen reduzieren den verfuegbaren Bestand.
- Ueberreservierung und negative Bestandsbuchungen werden serverseitig abgefangen.

### Archiv vs. Papierkorb

- `Archiviert` bedeutet: Item bleibt erhalten, ist aber aus aktiven Listen ausgeblendet.
- `Geloescht` bedeutet: Item liegt im Papierkorb.
- Papierkorb-Eintraege koennen 14 Tage lang wiederhergestellt werden und werden danach automatisch entfernt.

## Docker Quickstart

1. ENV-Datei anlegen:

```bash
cp .env.example .env
```

2. Container bauen und starten:

```bash
docker compose up -d --build
```

3. Bei einer leeren Datenbank das System initialisieren:

```bash
docker exec teilekiste npm run bootstrap:system
```

4. App oeffnen:

- [http://localhost:3000](http://localhost:3000)

5. Standard-Login nach Bootstrap:

- `admin@local`
- `admin123`

## Source Install Script

Wenn du nicht das vorgebaute Image, sondern das Repository selbst als Quelle verwenden willst, gibt es ein Install-Script in `scripts/install-from-source.sh`.

Typischer One-liner auf einem frischen Debian/Ubuntu-Server:

```bash
curl -fsSL https://raw.githubusercontent.com/dkennerknecht/Teilekiste/main/scripts/install-from-source.sh | bash
```

Beispiele:

```bash
curl -fsSL https://raw.githubusercontent.com/dkennerknecht/Teilekiste/main/scripts/install-from-source.sh | bash
curl -fsSL https://raw.githubusercontent.com/dkennerknecht/Teilekiste/main/scripts/install-from-source.sh | bash -s -- --ref v2.3.0 --public-url https://inventar.example.com
```

Das Script:

- installiert Docker und Grundpakete
- klont oder aktualisiert das Repo in `/opt/teilekiste`
- checkt den gewuenschten Branch oder Tag aus
- erkennt die oeffentliche URL automatisch und fragt nur bei interaktiver Ausfuehrung optional nach einem Override
- erzeugt oder aktualisiert `.env`
- baut die Container lokal aus dem Source-Code
- startet die App per `docker compose up -d --build`
- fuehrt standardmaessig `bootstrap:system` aus, sofern kein Seed aktiviert ist

## GitHub Container Registry

Dieses Repository publisht automatisch ein Docker-Image nach `ghcr.io`.

- Push auf `main` aktualisiert `ghcr.io/<owner>/teilekiste:latest`
- Git-Tag wie `v2.3.0` publisht zusaetzlich `ghcr.io/<owner>/teilekiste:v2.3.0`
- der Workflow ist in `.github/workflows/publish-container.yml`

Typischer Ablauf:

1. Image ziehen:

```bash
docker pull ghcr.io/<owner>/teilekiste:latest
```

2. Container starten:

```bash
docker run -d \
  --name teilekiste \
  -p 3000:3000 \
  -e NEXTAUTH_SECRET=change-me-super-secret \
  -v teilekiste_data:/data \
  ghcr.io/<owner>/teilekiste:latest
```

3. Alternativ versioniertes Release-Image verwenden:

```bash
docker pull ghcr.io/<owner>/teilekiste:v2.3.0
```

Hinweise:

- `ghcr.io` nutzt den GitHub-Benutzer oder die GitHub-Organisation als `<owner>`.
- Wenn du eine Release-Seite in GitHub willst, erstelle das Release auf Basis desselben `v*`-Tags.
- Falls das Package privat bleibt, musst du vor `docker pull` ein `docker login ghcr.io` mit einem GitHub Token durchfuehren.

## Demo-Daten statt leerem System

Wenn du mit Beispieldaten starten willst:

1. In `.env` setzen:

```bash
RUN_SEED_ON_STARTUP=1
```

2. Container neu starten:

```bash
docker compose up -d --build
```

Hinweis:

- `RUN_SEED_ON_STARTUP=1` laedt Demo-Daten.
- `bootstrap:system` erzeugt nur das Grundsystem mit Admin und Standardkonfiguration.

## Handy- und LAN-Zugriff

Fuer Login-Redirects und generierte Links nutzt die App standardmaessig den aktuellen Request-Host.
Dadurch funktionieren `localhost` und wechselnde LAN-IPs ohne manuelles Umstellen der Compose-Datei.

Nur wenn du bewusst eine feste kanonische URL oder einen Reverse-Proxy-Host erzwingen willst, sind diese Werte relevant:

- `APP_BASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_URL_INTERNAL`
- `AUTH_TRUST_HOST=true`

Beispiel:

```env
APP_BASE_URL=http://inventar.lan:3000
NEXTAUTH_URL=http://inventar.lan:3000
NEXTAUTH_URL_INTERNAL=http://127.0.0.1:3000
AUTH_TRUST_HOST=true
```

## Persistenz

Die Compose-Konfiguration nutzt das Volume `teilekiste_data`.

Darauf liegen:

- Datenbank: `/data/sqlite/app.db`
- Bilder: `/data/uploads`
- Anhaenge: `/data/attachments`
- Backups: `/data/backups`

## Wichtige Umgebungsvariablen

- `APP_BASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_URL_INTERNAL=http://127.0.0.1:3000`
- `HOST_PORT=3000`
- `AUTH_TRUST_HOST=true`
- `NEXTAUTH_SECRET`
- `DATABASE_URL=file:/data/sqlite/app.db`
- `UPLOAD_DIR=/data/uploads`
- `ATTACHMENT_DIR=/data/attachments`
- `BACKUP_DIR=/data/backups`
- `BACKUP_RETENTION_COUNT=10`
- `MAX_UPLOAD_SIZE_MB=20`
- `RUN_SEED_ON_STARTUP=0`

## Wichtige Workflows

### Neues Item

- Name, Hersteller, Beschreibung und MPN pflegen
- Kategorie und Type bestimmen das Item-Label
- Placement-Status waehlen
- optional Shelf, Drawer und Unterfach zuweisen
- Tags, Bilder und Felder direkt mitpflegen

### Platzierung und Umlagerung

- Items koennen ohne finalen Lagerplatz angelegt werden
- unplatzierte und erwartete Items erscheinen in `Placements`
- Transfers laufen explizit ueber Transfer-Flows statt ueber implizite Standort-Aenderungen
- Drawer-Move und Drawer-Swap sind im Drawer-Management verfuegbar

### Inventur-Sessions

- Inventur pro Lagerort und optional Shelf/Bereich
- persistente Zaehlsession mit Entwurf
- Review vor dem Buchen
- Bestandsaenderung erst beim Finalize

### P-touch-Export

- Export fuer `alle Labels`, `nur Shelfs` oder `nur Drawers`
- Shelf-CSV enthaelt Shelf-Link und Shelf-Label wie `AB`
- Drawer-CSV enthaelt Drawer-Link und Drawer-Label wie `AB01`
- delimiter waehlbar: `;`, `,`, `Tab`

### Backup / Restore

- Backup im Admin erstellen und herunterladen
- ZIP enthaelt Exportdaten plus Upload- und Attachment-Dateien
- Restore mit Preview sowie `merge` oder `overwrite`

## CSV / Import / Export

Vorhanden sind:

- CSV Export
- JSON Export
- P-touch CSV Export
- profilgestuetzter CSV-Import mit Preview und Apply

Der CSV-Import nutzt:

- Mapping-Profile mit Header-Fingerprint
- Kernfelder, feste Werte und Custom-Field-Mapping
- zeilenweise Fehler- und Warnungsanzeige

## Lokal ohne Docker

Voraussetzung: Node.js 20+

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run bootstrap:system
npm run dev
```

Optional mit Demo-Daten:

```bash
npm run prisma:seed
```

## Tests

```bash
npm run lint
npm test
npm run test:e2e
```

Aktuell abgedeckt:

- TypeScript Checks
- Vitest API- und Logiktests
- Playwright E2E-Smokes fuer Login, Item-Anlage und Admin-Schutz

## Projektstruktur

- `app/` UI und Route Handlers
- `components/` wiederverwendbare UI-Komponenten
- `lib/` Fachlogik, Auth, Labelsystem, Backup, Validierung
- `prisma/schema.prisma` Datenmodell
- `prisma/migrations/` Migrationen
- `scripts/` Hilfsskripte wie Backup, Bootstrap und Label-Sync
- `tests/` Vitest-Tests
- `e2e/` Playwright-Tests

## Weitere Doku

- [Feature-Analyse](docs/feature-analysis.md)
