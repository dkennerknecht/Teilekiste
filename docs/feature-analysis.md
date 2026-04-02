# Feature-Analyse fuer Teilekiste

Stand: April 2026

## Stand heute

Teilekiste ist inzwischen keine einfache CRUD-Inventarliste mehr, sondern eine recht klare Werkstatt- und Materialverwaltungs-App mit Fokus auf:

- kleine Teams und Selbsthoster
- Elektronik- und Elektroinstallationsmaterial
- mobile Nutzung im Lager
- nachvollziehbare Lagerplaetze
- robuste Datenqualitaet
- einfache, lokale Betriebsform ohne externe Abhaengigkeiten

Der Produktkern ist heute stark in diesen Bereichen:

- Shelf-/Drawer-basierte Lagerstruktur
- Item-Labels und physische Lagerplatz-Labels
- verwaltete technische Materialdaten
- Import mit Profilen und Preview
- Dubletten-Erkennung und Merge
- Meterware in `m` mit interner `mm`-Logik
- explizite Lagertransfers
- Inventur-Sessions
- Backup/Restore fuer reale Selbsthoster-Szenarien

## Bereits geliefert

### 1. Lagerstruktur mit Shelfs, Drawers und Placement-Status

Bereits umgesetzt:

- `StorageLocation -> StorageShelf -> optional StorageBin -> optional binSlot`
- Shelf-Codes mit zwei Buchstaben pro Lagerort, z. B. `AB`
- Drawer-Codes `01..99` pro Shelf
- sichtbare Drawer-Labels wie `AB01`
- Shelf-Modi `OPEN_AREA` und `DRAWER_HOST`
- Placement-Status `PLACED`, `UNPLACED`, `INCOMING`
- eigene Uebersicht fuer unplatzierte und erwartete Items
- Lagerplatzuebersicht unter `Locations`

Nutzen:

- reale Magazin- und Regalstruktur ist sauber abbildbar
- offene Bereiche und Drawer koennen nebeneinander existieren
- physisch vorhandene, aber noch nicht final eingeordnete Ware ist sichtbar

### 2. Technische Materialdaten

Bereits umgesetzt:

- freie `Custom Fields`
- verwaltete `Technical Field Sets` pro `Kategorie + Type`
- sichtbare Trennung zwischen freien und verwalteten Feldern
- technische Presets nicht nur als Code-Default, sondern im Admin bearbeitbar
- Sortierung von Listenwerten inklusive Drag-and-drop
- Werte-Normalisierung, Alias- und Suggestion-Logik

Nutzen:

- bessere Datenqualitaet
- konsistentere technische Angaben
- sauberere Basis fuer Suche, Import und Dubletten-Erkennung

### 3. Import-Qualitaet

Bereits umgesetzt:

- dedizierter Admin-Import-Workflow
- Import-Profile mit Header-Fingerprint
- Mapping fuer Kernfelder, feste Werte und Custom Fields
- Preview mit strukturierten Fehlern und Warnungen pro Zeile
- striktes Apply nur bei fachlich gueltigem Import

Nutzen:

- deutlich weniger manuelle Nacharbeit
- wiederverwendbare Importe fuer typische Lieferanten- oder Altformate

### 4. Deduplizierung und Datenqualitaet

Bereits umgesetzt:

- persistiertes `typeId` auf `Item`
- Dubletten-Scoring ueber Name, Hersteller, MPN, Type und Lagerkontext
- Admin-Ansicht fuer Kandidaten
- Merge-Preview mit Konfliktentscheidung
- sicherer Vollmerge mit Redirect der alten Quellitems

Nutzen:

- weniger Wildwuchs im Bestand
- bessere Suchbarkeit
- sauberere Stammdaten

### 5. Mengenlogik fuer Meterware

Bereits umgesetzt:

- `unit = M` mit interner Speicherung in `mm`
- Dezimalmengen fuer Bestand, Mindestbestand, Bewegungen und Reservierungen
- korrekte Anzeige in `m`
- CSV-Import und Export fuer Meterware

Bewusste V1-Grenze:

- kein Rollenmodell pro Einzelrolle
- keine Restlaenge je Einzelrolle
- keine automatische Gebinde- oder Rollenoptimierung

### 6. Lagertransfers

Bereits umgesetzt:

- expliziter Einzeltransfer
- explizite Sammelumlagerung
- Bulk-Transfer getrennt von Bulk-Edit
- eigener Audit-Typ `ITEM_TRANSFER`
- Standortwechsel im Item-Update laufen intern ueber dieselbe Transfer-Logik
- Drawer-Move und Drawer-Swap im Drawer-Management

Wichtig:

- V1 transferiert immer das gesamte Item
- es gibt keine Teilmengen-Umlagerung
- Transfers erzeugen keine Bestandsbewegung

### 7. Inventur-Sessions

Bereits umgesetzt:

- Session-basierte Inventur pro Lagerort und optional Shelf/Bereich
- persistenter Entwurf statt sofortiger Direktbuchung
- Review mit Differenzanzeige
- Finalize mit echten Inventurbewegungen
- gesperrte Bearbeitung fuer geschlossene Sessions

Nutzen:

- deutlich robuster als Einzelzaehlungen
- passt besser zu echter Lagerarbeit

### 8. Scanner, Shelf- und Drawer-Labels

Bereits umgesetzt:

- Scanner fuer Item-, Shelf- und Drawer-Codes
- drawer-/shelf-first mit Item-Fallback
- P-touch-Export fuer Shelfs, Drawers oder beides
- waehbares CSV-Trennzeichen fuer den P-touch-Export

Nutzen:

- schnellere Navigation im Lager
- konsistente physische Beschriftung

### 9. Backup / Restore

Bereits umgesetzt:

- ZIP-Backup mit Exportdaten, Uploads und Attachments
- Preview vor Restore
- `merge` und `overwrite`
- Restore von Shelfs, Drawers, Placement-Daten, Inventur-Sessions und relevanten Nutzerdaten

Nutzen:

- sinnvoll fuer echte Selbsthoster
- brauchbar fuer Geraetewechsel, Neuinstallation und Testsysteme

### 10. Host-dynamischer Betrieb

Bereits umgesetzt:

- Browserzugriff ueber `localhost` und wechselnde LAN-IP
- request-basierte Redirects und generierte Links
- keine harte Bindung an eine einmal konfigurierte DHCP-IP

Nutzen:

- deutlich angenehmerer Betrieb im Heimnetz oder kleinen Werkstatt-LAN

## Teilweise geliefert oder bewusst einfach gehalten

### Einkauf

Vorhanden:

- Einkaufsliste auf Basis von Mindestbestand
- `purchaseUrl` pro Item

Noch offen:

- Lieferantenmodell
- Bestellnummer pro Lieferant
- letzter Preis
- Mindestbestellmenge
- Verpackungseinheit
- Bestellstatus
- echter Beschaffungsworkflow

### Reservierungen

Vorhanden:

- Reservierungen mit Menge
- Freitext `reservedFor`

Noch offen:

- eigene Projekte / Auftraege / Kunden
- Reservierungen nach Projekt filtern
- Materiallisten pro Projekt
- Rueckgabe oder Verbrauch aus Reservierung

### BOM

Vorhanden:

- BOM-Grundstruktur
- BOM-Bereich am Item

Noch offen:

- Picking-Workflow
- Materialausgabe
- Teilverbrauch und Rueckgabe
- engerer Bezug zu Reservierungen oder Projekten

### API und Integrationen

Vorhanden:

- Read-only API Tokens

Noch offen:

- dokumentierte API fuer externe Systeme
- Webhooks
- klar definierte Integrationspunkte fuer n8n, Home Assistant oder ERP-nahe Systeme

## Offene Prioritaeten

### 1. Einkauf wirklich produktiv machen

Nutzen: sehr hoch  
Aufwand: mittel bis hoch

Empfehlung:

- Lieferanten pro Item
- Bestellnummer pro Lieferant
- letzter Preis
- Mindestbestellmenge
- Verpackungseinheit
- Bestellnotiz
- Status `offen / bestellt / geliefert`

Warum jetzt:

- Mindestbestand und Einkaufsliste sind schon da
- der groesste praktische Hebel liegt im Alltag oft bei Beschaffung

### 2. Projekt- oder Auftragsbezug fuer Reservierungen

Nutzen: hoch  
Aufwand: mittel

Empfehlung:

- eigene Entitaet fuer Projekt / Auftrag / Kunde
- Reservierungen daran koppeln
- Material pro Projekt gruppieren
- offene Bedarfe und reservierte Mengen je Projekt sichtbar machen

Warum jetzt:

- passt direkt zu realer Werkstattarbeit
- baut auf bestehender Reservierungslogik auf

### 3. Scanner-Workflow weiter ausbauen

Nutzen: mittel bis hoch  
Aufwand: mittel

Empfehlung:

- mehr Schnellaktionen nach dem Scan
- `+1`, `-1`, reservieren, transferieren
- Sammelmodus fuer viele Scans
- staerkerer Lagerprozess direkt aus dem Scanner

### 4. API, Webhooks und Integrationen

Nutzen: mittel bis hoch  
Aufwand: mittel bis hoch

Empfehlung:

- API-Dokumentation
- Webhooks fuer Item-, Bestands- und Reservierungsereignisse
- Integrationsbeispiele fuer n8n
- spaeter optionale ERP- oder Home-Assistant-Anbindung

## Neue sinnvolle Feature-Vorschlaege

### 1. Chargen, Seriennummern und Verfallsdaten

Sinnvoll fuer:

- Sicherungen
- Relais
- Messgeraete
- Chemie, Kleber, Verbrauchsmaterial
- rueckverfolgbare Komponenten

### 2. BOM-Picking und Materialausgabe

Aufbauend auf vorhandener BOM-Logik:

- Picklisten fuer Baugruppen
- Materialausgabe fuer Auftrag oder Aufbau
- Teilverbrauch dokumentieren
- Rueckgabe von Restmaterial

### 3. Regeln und Benachrichtigungen

Beispiele:

- Mindestbestand unterschritten
- alte Reservierungen ohne Bewegung
- neue Dubletten-Kandidaten
- offene Einkaufsbedarfe

Ausgabe moeglich als:

- In-App Hinweis
- Mail
- Webhook

### 4. Lagerplatz-Optimierung

Beispiele:

- freie und volle Lagerplaetze sichtbar machen
- bevorzugte Zielplaetze fuer bestimmte Kategorien
- Vorschlaege fuer Einlagerung
- konsistente Regal- und Shelf-Kennzeichnung ueber groessere Lager hinweg

## Empfohlene Priorisierung ab jetzt

### Naechste Ausbaustufe

1. Einkauf wirklich produktiv machen
2. Projekt- oder Auftragsbezug fuer Reservierungen

### Danach

3. Scanner-Workflow ausbauen
4. API / Webhooks / Integrationen
5. Chargen- und Seriennummern

### Spaeter

6. BOM-Picking und Materialausgabe
7. Regeln und Benachrichtigungen
8. Lagerplatz-Optimierung

## Fazit

Teilekiste ist heute bereits eine recht starke Werkstatt- und Materialverwaltungsbasis fuer kleine Teams und Selbsthoster.

Die groessten bereits erreichten Fortschritte liegen in:

- strukturierter Lagerplatzlogik mit Shelfs und Drawers
- technischen Materialdaten
- qualitaetsgesichertem Import
- Dubletten-Erkennung und Merge
- Meterware
- Inventur-Sessions
- expliziten Lagertransfers
- robustem Backup/Restore

Das groesste verbleibende Potenzial liegt jetzt weniger im allgemeinen CRUD und mehr in:

- echtem Einkaufsworkflow
- projektbezogener Materialplanung
- operativen Scanner-Prozessen
- Integrationen in angrenzende Systeme
