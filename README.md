# Teilekiste

Self-hosted Inventar-Webapp fuer kleine Werkstaetten und Materiallager mit Next.js, Prisma und SQLite.

Der aktuelle Schwerpunkt liegt auf:
- einfacher Bestandsfuehrung
- sauberer Lagerstruktur
- schneller mobiler Nutzung
- Bilder, Labels und Auditierbarkeit
- einfacher Selbsthostbarkeit per Docker Compose

## Stack

- Next.js 14, React 18, TypeScript
- Prisma + SQLite
- NextAuth Credentials Login
- Tailwind CSS
- Uploads auf lokales Volume
- Docker Compose fuer Betrieb und Persistenz

## Aktueller Funktionsumfang

### Inventar

- Items anlegen, bearbeiten, archivieren und in den Papierkorb verschieben
- automatische Label-Vergabe im Format `KATEGORIE-TYPE-NNN`
- fortlaufende Nummern pro Kategorie/Type-Kombination, ohne Wiederverwendung geloeschter Nummern
- Bilder direkt beim Anlegen und Bearbeiten, inklusive Mehrfach-Upload
- Tags direkt beim Anlegen und Bearbeiten
- Custom Fields mit Scope auf Kategorie, Type oder deren Kombination
- Duplikatwarnung bei Name/MPN

### Lagerstruktur

- Kategorien mit 2-stelligen Codes
- Types mit 2-stelligen Codes
- Lagerorte
- Regale pro Lagerort
- Fach/Bin pro Item

### Bestand und Historie

- Bestandsbuchungen
- Reservierungen
- verfuegbarer Bestand als `Bestand - Reservierungen`
- verfuegbarer Bestand wird nie negativ angezeigt
- Mindestbestand pro Item
- Einkaufsliste fuer Items unter Mindestbestand
- Audit-Historie fuer Item-Aenderungen und Reservierungen

### Organisation

- Startseite mit Suche, Filtern und Bulk-Aktionen
- Bulk-Bearbeitung fuer Kategorie, Lagerort, Regal, Fach und Tags
- Bulk-Archivieren und Bulk-Loeschen
- Archiv als Parkbereich fuer inaktive Items
- Papierkorb mit 14 Tagen Wiederherstellungsfrist

### Admin

- Benutzerverwaltung mit Rollen
- Kategorien, Types, Tags, Lagerorte und Regale verwalten
- Custom Fields verwalten
- App-Sprache zwischen Deutsch und Englisch umschalten
- Read-only API Tokens
- CSV Import und Export
- Backup / Restore

### Mobile Nutzung

- responsive Hauptnavigation
- responsive Startseite, Item-Detailseiten und Admin-Bereiche
- Scanner-Seite fuer schnelles Oeffnen von Items ueber Code
- fuer LAN-Nutzung auf Handy geeignet, wenn `APP_BASE_URL` und `NEXTAUTH_URL` korrekt gesetzt sind

## Wichtige Produktregeln

### Label-System

- Labels werden automatisch erzeugt.
- Das Format bleibt `KATEGORIE-TYPE-NUMMER`, z. B. `EL-WI-024`.
- Beim Aendern von Kategorie oder Type wird bei Bedarf automatisch ein neues Label vergeben.
- Nummern werden nicht recycelt.

### Archiv vs. Papierkorb

- `Archiviert` bedeutet: Item bleibt erhalten, ist aber aus aktiven Listen ausgeblendet.
- `Geloescht` bedeutet: Item liegt im Papierkorb.
- Papierkorb-Eintraege koennen 14 Tage lang wiederhergestellt werden und werden danach automatisch entfernt.

### Verfuegbarer Bestand

- Auf Uebersichtsseiten wird der verfuegbare Bestand gezeigt.
- Reservierungen reduzieren die verfuegbare Menge.
- Ueberreservierung und Bestandsaenderungen ins Negative werden serverseitig abgefangen.

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
- `bootstrap:system` erzeugt nur das Grundsystem mit Admin und Standardlager.

## Handy- und LAN-Zugriff

Fuer Login-Redirects auf Handy oder im lokalen Netz muessen diese Werte zur echten Host-Adresse passen:

- `APP_BASE_URL`
- `NEXTAUTH_URL`

Beispiel:

```env
APP_BASE_URL=http://192.168.1.119:3000
NEXTAUTH_URL=http://192.168.1.119:3000
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

- Name, Hersteller, Beschreibung, MPN
- Kategorie und Type bestimmen das Label
- Lagerort, Regal und Fach ordnen den Lagerplatz zu
- Tags und Bilder koennen direkt mit angelegt werden

### Bulk-Bearbeitung

Auf der Startseite koennen mehrere Items gemeinsam geaendert werden:

- Kategorie
- Lagerort
- Regal
- Fach
- Tags
- Archivieren
- Loeschen

### Backup / Restore

- Backup im Admin erstellen und herunterladen
- Restore mit Preview sowie `merge` oder `overwrite`
- ZIP enthaelt Exportdaten plus Upload- und Attachment-Dateien

### API Tokens

- read-only Zugriff fuer externe Systeme
- Nutzung per `x-api-token` oder `Authorization: Bearer ...`

## CSV / Export

Vorhanden sind:

- CSV Export
- JSON Export
- P-touch CSV Export
- CSV Import mit Dry-run / Apply

Der CSV-Import nutzt:

- Kategorie aus jeder CSV-Zeile
- Type als Auswahl im Import-Formular fuer die Label-Vergabe

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

