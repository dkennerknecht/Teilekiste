# Feature-Analyse fuer Teilekiste

## Ausgangslage

Teilekiste ist aktuell stark in den Bereichen:

- einfache Selbsthostbarkeit
- schneller Materialzugriff
- mobile Bedienung
- Lagerstruktur mit Lagerort und Regal
- automatische Labels
- Auditierbarkeit und Datensicherheit

Der aktuelle Produktkern funktioniert gut fuer Werkstatt- und Elektroniklager, besonders wenn Material nicht als ERP-Warenwirtschaft, sondern als schnell verfuegbares internes Inventar gefuehrt werden soll.

## Produktprofil

Teilekiste ist heute am staerksten als:

- internes Werkstattlager
- Elektronik- und Installationsmaterial-Verwaltung
- Materialbestand fuer kleine Teams
- mobile Such- und Entnahme-App

Weniger stark ist es aktuell noch bei:

- Einkauf mit Lieferanten- und Preisdaten
- projektbezogener Materialplanung
- Standardisierung technischer Artikeldaten
- Massenpflege grosser Bestandsmengen

## Empfohlene Feature-Roadmap

### 1. Werte-Normalisierung fuer Custom Fields

Nutzen: hoch  
Aufwand: mittel

Problem:
- Freitextwerte wie `Rot`, `ROT`, `red` oder `1k`, `1 kOhm`, `1000 Ohm` laufen schnell auseinander.

Empfehlung:
- pro Custom Field ein optionales Wertverzeichnis
- Vorschlaege aus bestehenden Werten
- Alias-/Normalisierungslogik
- optional gesperrte Listenwerte pro Feld

Besonders sinnvoll fuer:
- Farbe
- Gehaeuseform
- Toleranz
- Spannung
- Querschnitt
- Steckertyp

### 2. Typ-spezifische technische Felder

Nutzen: hoch  
Aufwand: mittel

Problem:
- Bei Elektronik und Elektro-Installation sind Kategorie und Type schon sauber, aber die technischen Kerndaten fehlen noch als standardisierte Struktur.

Empfehlung:
- Vorlagen pro Type
- Beispiel:
  - Widerstand: Wert, Toleranz, Leistung, Bauform
  - Kondensator: Kapazitaet, Spannung, Dielektrikum, Bauform
  - Temperatursensor: Interface, Messbereich, Versorgung
  - Relais / Schuetz: Spulenspannung, Kontaktart, Schaltstrom
  - Kabel / Litze: Querschnitt, Aderzahl, Farbe, Ring-/Rollenlaenge

Das kann auf den bestehenden Custom Fields aufbauen, sollte aber als vorkonfigurierter Satz pro Type verwaltbar sein.

### 3. Einkauf wirklich produktiv machen

Nutzen: hoch  
Aufwand: mittel bis hoch

Die aktuelle Einkaufsliste ist gut als Mangelanzeige, aber noch keine echte Beschaffungshilfe.

Empfohlene Erweiterungen:
- Lieferanten pro Item
- Bestellnummer pro Lieferant
- letzter Preis
- Mindestbestellmenge
- Verpackungseinheit
- Bestellnotiz
- Status `offen / bestellt / geliefert`

Damit wird aus der Einkaufsliste ein echter Beschaffungsworkflow.

### 4. Verbrauch fuer Kabel, Rollen und Meterware

Nutzen: sehr hoch  
Aufwand: mittel

Fuer `NYM-J`, `Litze`, Schrumpfschlauch oder Meterware ist `Stk` nur bedingt passend.

Empfehlung:
- bessere Unterstuetzung fuer `m`
- Teilentnahmen
- Restlaenge pro Rolle
- optional mehrere Gebinde pro Item
- Sicht auf angebrochene Rollen

Das passt besonders gut zu deinem Materialprofil.

### 5. Projekt- oder Auftragsbezug fuer Reservierungen

Nutzen: hoch  
Aufwand: mittel

Reservierungen existieren bereits, sind aber fachlich noch flach.

Empfehlung:
- Reservierungen an Projekt / Auftrag / Kunde koppeln
- offene Reservierungen nach Projekt filtern
- Material fuer Projekt komplett zusammenstellen
- spaeter auch Rueckbuchung oder Verbrauch aus Reservierung

Das wuerde Teilekiste deutlich naeher an den realen Werkstattalltag bringen.

### 6. Deduplizierung und Datenqualitaet

Nutzen: hoch  
Aufwand: mittel

Mit wachsendem Bestand werden doppelte oder fast gleiche Items ein Thema.

Empfehlung:
- Dubletten-Ansicht mit Merge-Vorschlaegen
- Aehnlichkeit ueber Name, MPN, Hersteller und Type
- optionales Zusammenfuehren von Tags und Bildern
- Warnung bei fast gleichen Artikeln

### 7. Bessere Import-Qualitaet

Nutzen: mittel bis hoch  
Aufwand: mittel

Import ist da, aber bei realen CSVs kommt meist Mapping-Aufwand dazu.

Empfehlung:
- speicherbare Import-Profile
- Feldzuordnung pro Quelle
- Vorschau fuer Kategorien/Types/Custom Fields
- Fehlerbericht pro Zeile
- Normalisierung beim Import

### 8. Scanner-Workflow ausbauen

Nutzen: mittel  
Aufwand: mittel

Scanner ist als schneller Zugriff gut, kann aber noch operativer werden.

Empfehlung:
- Scan -> sofortige Aktion waehlen
- `+1`, `-1`, reservieren, archivieren
- schneller Wechsel zwischen mehreren gescannten Artikeln
- optional Sammelmodus fuer Inventur

### 9. Lagertransfers

Nutzen: mittel  
Aufwand: mittel

Aktuell kann der Lagerplatz geaendert werden, aber es gibt keinen expliziten Transfer-Workflow.

Empfehlung:
- `von Lagerort/Regal/Fach` nach `zu Lagerort/Regal/Fach`
- eigener Audit-Typ fuer Umlagerungen
- spaeter Sammelumlagerung

### 10. Lieferfaehige API / Integrationen

Nutzen: mittel  
Aufwand: mittel bis hoch

Read-only API Tokens existieren bereits. Der naechste Schritt waere eine bewusst dokumentierte Integrationsschicht.

Empfehlung:
- API-Dokumentation fuer externe Tools
- Webhooks fuer Aenderungen
- Export an andere Systeme
- optional Home Assistant / n8n / ERP-Bridge

## Empfohlene Priorisierung

### Sofort sinnvoll

1. Werte-Normalisierung fuer Custom Fields
2. Typ-spezifische technische Felder
3. Einkauf mit Lieferanten- und Verpackungsdaten
4. Kabel- und Meterwaren-Logik

### Danach

5. Projektbezug fuer Reservierungen
6. Dubletten-Management
7. bessere CSV-Importprofile
8. Lagertransfers

### Spaeter

9. Integrationen / Webhooks / API-Doku
10. weitergehende Workflow- und Freigabefunktionen

## Konkrete naechste Ausbaustufe

Wenn nur ein sinnvoller naechster grosser Schritt gebaut werden soll, waere meine Empfehlung:

### Materialdaten-Standardisierung

Konkret:
- Custom Fields pro Kategorie/Type fest definieren
- Werte normalisieren
- technische Felder als Vorlagen bereitstellen

Warum zuerst:
- verbessert Datenqualitaet sofort
- hilft Suche, Einkauf, Import und Dubletten gleichzeitig
- passt direkt zu Elektronik, Elektro-Installation, Befestigung und Kabel

## Zweite klare Empfehlung

### Einkauf ausbauen

Konkret:
- Lieferant
- Bestellnummer
- Packungsinhalt
- Preis
- Mindestbestellmenge
- Bestellstatus

Warum:
- Mindestbestand und Einkaufsliste sind schon da
- der Hebel in der Praxis ist hoch
- geringe fachliche Reibung, weil der bestehende Workflow erweitert statt ersetzt wird

## Fazit

Teilekiste ist bereits eine brauchbare Inventar-App fuer den operativen Werkstattalltag.

Das groesste Potenzial liegt jetzt nicht mehr im generischen CRUD, sondern in zwei Richtungen:

- bessere Materialdaten
- echterer Einkaufs- und Verbrauchsworkflow

Wenn du willst, kann ich aus dieser Analyse direkt einen konkreten Umsetzungsplan fuer die naechsten 3 Releases machen.
