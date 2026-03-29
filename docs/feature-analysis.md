# Feature-Analyse fuer Teilekiste

Stand: Maerz 2026

## Stand heute

Teilekiste ist inzwischen mehr als eine einfache Inventar-App. Der Produktkern ist heute stark in den Bereichen:

- einfache Selbsthostbarkeit
- schneller Materialzugriff
- mobile Bedienung
- Lagerstruktur mit Lagerort, Regal und Fach
- automatische Labels auf Basis von Kategorie + Type
- Auditierbarkeit und Datensicherheit
- standardisierte technische Materialdaten
- qualitaetsgesicherter CSV-Import
- Dubletten-Erkennung und sicheres Merge
- Mengenlogik fuer Meterware
- explizite Lagertransfers

Damit ist Teilekiste aktuell besonders stark als:

- internes Werkstattlager
- Elektronik- und Installationsmaterial-Verwaltung
- Materialbestand fuer kleine Teams
- mobile Such-, Entnahme- und Umlagerungs-App

## Bereits geliefert

### 1. Materialdaten-Standardisierung

Bereits umgesetzt:

- Werte-Normalisierung fuer `CustomField`
- kanonische Werte mit Aliasen und Vorschlaegen
- gesperrte Listen fuer `SELECT` und `MULTI_SELECT`
- verwaltete technische Feldsaetze pro `Kategorie + Type`
- Presets fuer typische technische Materialgruppen
- Sortierung technischer und freier Felder ueber `sortOrder`

Nutzen:

- deutlich bessere Datenqualitaet
- robusterer Import
- bessere Suchbarkeit
- sauberere Grundlage fuer Dubletten-Erkennung

### 2. Typ-spezifische technische Felder

Bereits umgesetzt:

- technische Presets als verwaltete Feldsaetze
- Zuordnung pro `Kategorie + Type`
- Synchronisation der daraus erzeugten `CustomField`-Eintraege
- sichere Deaktivierung alter managed Felder statt Loeschung
- sichtbare Trennung zwischen freien und verwalteten Feldern im Admin

Beispiele, die bereits als Presets vorgesehen sind:

- Widerstand
- Kondensator
- Temperatursensor
- Relais / Schuetz
- Kabel / Litze

### 3. Verbrauch fuer Kabel, Rollen und Meterware

Bereits umgesetzt in V1:

- `unit = M` mit interner Speicherung in `mm`
- Dezimalmengen fuer Bestand, Mindestbestand, Bewegungen und Reservierungen
- korrekte Anzeige in `m` in UI und API
- CSV-Import und Export fuer Meterwerte

Bewusste V1-Grenze:

- noch kein Rollenmodell
- noch keine Restlaenge pro Einzelrolle
- noch keine Mehrgebinde-Logik

### 4. Deduplizierung und Datenqualitaet

Bereits umgesetzt:

- persistiertes `typeId` auf `Item`
- Dubletten-Scoring ueber Name, Hersteller, MPN und Type
- Admin-Ansicht fuer Kandidaten
- Merge-Preview mit Konfliktaufloesung
- sicherer Vollmerge mit Relationen, Audit und Redirect alter Quellitems

Nutzen:

- bessere Datenqualitaet im Bestand
- weniger Wildwuchs bei fast gleichen Artikeln
- weniger Such- und Einkaufsfehler

### 5. Bessere Import-Qualitaet

Bereits umgesetzt:

- dedizierter Admin-Import-Workflow
- speicherbare Import-Profile
- Header-Fingerprint und Profilvorschlaege
- Feldzuordnung fuer Kernfelder, feste Werte und Custom Fields
- Preview mit Fehlern und Warnungen pro Zeile
- striktes Apply nur bei fehlerfreiem Import

### 6. Lagertransfers

Bereits umgesetzt:

- expliziter Einzeltransfer
- explizite Sammelumlagerung
- Validierung fuer Ziel-Lagerort und Ziel-Regal
- eigener Audit-Typ `ITEM_TRANSFER`
- Standortwechsel im normalen Item-Update laufen intern ueber dieselbe Transfer-Logik

Wichtig:

- V1 transferiert immer das gesamte Item
- es gibt keine Teilmengen-Umlagerung
- Transfers erzeugen keine Bestandsbewegung

## Teilweise geliefert oder noch bewusst einfach

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
- Freitextfeld `reservedFor`

Noch offen:

- eigene Projekte / Auftraege / Kunden
- Reservierungen nach Projekt filtern
- Materiallisten pro Projekt
- Rueckgabe oder Verbrauch aus Reservierung

### Scanner

Vorhanden:

- Scan oder Eingabe eines Labelcodes
- direktes Oeffnen des Items
- schneller `-1` Verbrauch aus dem Scanner

Noch offen:

- mehrere Schnellaktionen nach dem Scan
- Sammelmodus fuer viele Scans
- Inventurmodus
- Transfer direkt aus dem Scanner

### Integrationen

Vorhanden:

- Read-only API Tokens

Noch offen:

- dokumentierte API fuer externe Systeme
- Webhooks
- Push in n8n / Home Assistant / ERP-Bridge
- klar definierte Integrationspunkte fuer Fremdsysteme

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

- der Inventarkern ist stark genug
- der operative Hebel im Alltag ist hoch
- Mindestbestand und Einkaufsliste sind bereits vorhanden

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
- ist ein sinnvoller naechster Schritt nach Datenqualitaet und Transfers

### 3. Scanner-Workflow ausbauen

Nutzen: mittel bis hoch  
Aufwand: mittel

Empfehlung:

- Scan -> Aktion auswaehlen
- `+1`, `-1`, reservieren, transferieren, archivieren
- schneller Wechsel zwischen mehreren gescannten Items
- Sammelmodus fuer Inventur

### 4. Lieferfaehige API und Integrationen

Nutzen: mittel bis hoch  
Aufwand: mittel bis hoch

Empfehlung:

- API-Dokumentation
- Webhooks fuer Item-, Bestands- und Reservierungsereignisse
- Integrationsbeispiele fuer n8n
- spaeter optionale ERP- oder Home-Assistant-Anbindung

## Neue sinnvolle Feature-Vorschlaege

### 1. Inventur-Sessions

Statt einzelner Inventur-Buchungen:

- Inventur pro Lagerort
- Zaehlstatus und Fortschritt
- Differenzen gesammelt pruefen
- Freigabe der Inventur als eigener Schritt

Das wuerde Teilekiste operativ deutlich staerker machen.

### 2. Standort-Scan-Workflow

Statt Lagerort manuell zu tippen:

- erst Lagerplatz scannen
- dann Item scannen
- danach Einlagern oder Umlagern bestaetigen

Das passt sehr gut zur neuen Transfer-Logik.

### 3. Chargen, Seriennummern und Verfallsdaten

Sinnvoll fuer:

- Sicherungen
- Relais
- Messgeraete
- Chemie, Kleber, Verbrauchsmaterial
- hochwertige oder rueckverfolgbare Komponenten

### 4. BOM-Picking und Materialausgabe

Aufbauend auf vorhandener BOM-Logik:

- Pickliste fuer Baugruppen
- Materialausgabe fuer Aufbau oder Auftrag
- Teilverbrauch dokumentieren
- Rueckgabe von Restmaterial

### 5. Regeln und Benachrichtigungen

Beispiele:

- Mindestbestand unterschritten
- alte Reservierungen ohne Bewegung
- neue Dubletten-Kandidaten
- offene Einkaufsbedarfe

Ausgabe moeglich als:

- In-App Hinweis
- Mail
- Webhook

### 6. Lagerplatz-Optimierung

Beispiele:

- freie / volle Lagerplaetze sichtbar machen
- bevorzugte Zielplaetze fuer bestimmte Kategorien
- Vorschlaege fuer Einlagerung
- Regal-Labels und Fachkennzeichnung konsistent verwalten

## Empfohlene Priorisierung ab jetzt

### Naechste Ausbaustufe

1. Einkauf wirklich produktiv machen
2. Projekt- oder Auftragsbezug fuer Reservierungen

### Danach

3. Scanner-Workflow ausbauen
4. Inventur-Sessions
5. Integrationen / Webhooks / API-Doku

### Spaeter

6. Chargen- und Seriennummern
7. BOM-Picking und Materialausgabe
8. Lagerplatz-Optimierung

## Klare Empfehlung

Wenn nur ein grosser naechster Schritt gebaut werden soll, ist die beste fachliche Wahl aktuell:

### Einkauf ausbauen

Warum:

- die Datenbasis ist jetzt stark genug
- Mindestbestand, Import, Dubletten und technische Felder sind bereits deutlich reifer
- der groesste praktische Hebel liegt nun im Beschaffungsworkflow

Die zweitbeste direkte Erweiterung waere:

### Reservierungen mit Projektbezug

Warum:

- sehr nah am Werkstattalltag
- fachlich klar
- passt gut zu Bestand, Scanner, BOM und spaeterer Materialausgabe

## Fazit

Teilekiste ist heute nicht mehr nur eine brauchbare Inventar-App, sondern bereits eine recht starke Werkstatt- und Materialverwaltungsbasis.

Die groessten bereits erreichten Fortschritte liegen in:

- standardisierten Materialdaten
- qualitaetsgesichertem Import
- Deduplizierung
- Meterware
- expliziten Lagertransfers

Das naechste groesste Potenzial liegt jetzt weniger im allgemeinen CRUD und mehr in:

- echtem Einkaufsworkflow
- projektbezogener Materialplanung
- operativen Lagerprozessen rund um Scanner, Inventur und Integrationen
