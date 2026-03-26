# Teilekiste - Self-hosted Werkstatt Inventory (Next.js + Prisma + SQLite)

Self-hostbare Inventar-Webapp fuer kleine Werkstaetten mit Docker Compose, lokaler SQLite, Uploads und serverseitigem RBAC.

## Stack

- Frontend/Backend: Next.js 14 (App Router + Route Handlers, TypeScript)
- DB: SQLite (`/data/sqlite/app.db`)
- ORM: Prisma
- Auth: NextAuth Credentials (bcrypt)
- RBAC: `ADMIN`, `READ_WRITE`, `READ` (serverseitig in API + Storage-Scopes)
- UI: Tailwind CSS
- Uploads: `/data/uploads`, Attachments: `/data/attachments`, Backups: `/data/backups`

## Features (MVP)

- Item CRUD mit Label-Code System (`AREA-TYPE-NUMBER`) und transaktionaler Vergabe
- Volltextsuche, Filter, Sortierung
- Bestand nur ueber Stock Movements
- Reservierungen + verfuegbarer Bestand
- Bilder + Attachments Upload (MIME/Size Validierung) + Thumbnail-Generierung
- Inventurmodus mit Diff-Preview + Apply als INVENTORY Buchungen
- Bulk-Reassign Label Codes (Dry-run + Apply)
- Duplikatwarnung bei Create (Name/MPN/EAN)
- CSV/JSON Export, P-touch CSV Export
- CSV Import (Dry-run/Apply)
- Backup ZIP erstellen (JSON + Upload/Attachment Verzeichnisse)
- Restore ZIP (Merge/Overwrite)
- Papierkorb (Soft Delete / Restore / Hard Delete)
- Admin Bereich: Users, Categories, Tags, Locations, Custom Fields, Label Config, Backup
- Lagerort-Dashboard "Wo liegt was?"
- Einkaufsliste (Items unter Mindestbestand)
- Read-only API Tokens (Admin kann Tokens erstellen/deaktivieren)
- Scanner-Mode (Code eingeben/scannen -> Item oeffnen -> -1 Quick-Buchung)

## Quickstart (Docker Compose)

1. Env kopieren:

```bash
cp .env.example .env
```

2. Starten:

```bash
docker compose up -d --build
```

3. App aufrufen:

- [http://localhost:3000](http://localhost:3000)
- Default Seed Login: `admin@local` / `admin123`

Hinweis: Beim Container-Start laeuft `prisma migrate deploy` automatisch. Demo-Seed-Daten werden nur geladen, wenn `RUN_SEED_ON_STARTUP=1` gesetzt ist.

## Volumes / Persistenz

- DB: `/data/sqlite/app.db`
- Bilder: `/data/uploads`
- Anhaenge: `/data/attachments`
- Backups: `/data/backups`

Im Compose File ist das als Volume `teilekiste_data` gemountet.

## Reverse Proxy

Die App bindet intern auf Port `3000` und ist host-unabhaengig.

Wichtige ENV:

- `APP_BASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `DATABASE_URL=file:/data/sqlite/app.db`
- `UPLOAD_DIR=/data/uploads`
- `ATTACHMENT_DIR=/data/attachments`
- `BACKUP_DIR=/data/backups`

## P-touch Workflow (Brother P-touch Editor)

1. In der App `P-touch CSV` exportieren (Header vorhanden, UTF-8).
2. In P-touch Editor "Database" / "CSV Import" waehlen.
3. Datei `ptouch-labels.csv` laden.
4. Felder mappen (mindestens):
- `labelCode`
- `name`
- `storageLocation`
- `bin`
5. Serien-/Datenbankdruck starten.

Delimiter kann per Query gesetzt werden, z.B.:

- `/api/export/ptouch?delimiter=;`
- `/api/export/ptouch?delimiter=,`

## CSV Import

Admin-Seite -> CSV Import Bereich.

Erwartete Spalten (Beispiel):

- `name`
- `description`
- `category`
- `storageLocation`
- `storageArea`
- `bin`
- `stock`
- `minStock`
- `unit`
- `manufacturer`
- `mpn`
- `barcodeEan`

`areaId` und `typeId` werden beim Import als Formularfelder mitgegeben, damit Label-Codes automatisch vergeben werden.

## Backup / Restore

- Backup: Admin -> "Backup jetzt" -> ZIP in `/data/backups`
- Restore: Admin -> ZIP hochladen + Strategie
- `merge`: vorhandene Daten bleiben, neue werden zusammengefuehrt
- `overwrite`: zentrale Tabellen werden vorab geleert

## RBAC / Scope

- `READ`: nur Lesen
- `READ_WRITE`: Item-/Bestands-/Reservierungsaenderungen
- `ADMIN`: plus Konfiguration, User/Admin APIs, Backup/Restore
- Lagerort-Scope (`UserLocation`) wird serverseitig in API-Queries und Mutationen erzwungen.

## Lokal ohne Docker (optional)

Voraussetzung: Node.js 20+

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run prisma:seed
npm run dev
```

## Tests

```bash
npm run lint
npm test
```

Aktuell enthalten: API-Integrationstests (Vitest + Supertest) fuer ausgewählte Route Handler.

## API Tokens (read-only)

- Admin -> Bereich "Read-only API Tokens"
- Token wird nur einmal bei Erstellung angezeigt
- Nutzung fuer read-only API Calls:
  - Header `x-api-token: tk_...`
  - oder `Authorization: Bearer tk_...`

Beispiele:

```bash
curl -H "x-api-token: tk_xxx" "http://localhost:3000/api/items?limit=20&offset=0"
curl -H "Authorization: Bearer tk_xxx" "http://localhost:3000/api/search?q=EL-KB-023"
curl -H "x-api-token: tk_xxx" "http://localhost:3000/api/shopping-list"
```

## Projektstruktur

- `app/` UI + Route Handlers
- `prisma/schema.prisma` Datenmodell
- `prisma/migrations/` Migrationen
- `prisma/seed.ts` Seed Daten
- `Dockerfile`, `docker-compose.yml`

## Hinweise

- Keine Cloud-Abhaengigkeit.
- OAuth kann spaeter in NextAuth Providers ergaenzt werden.
- Scanner/Keyboard-Mode und API-Tokens koennen als naechste Erweiterung umgesetzt werden.
