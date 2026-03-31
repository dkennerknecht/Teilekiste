export const supportedAppLanguages = ["de", "en"] as const;

export type AppLanguage = (typeof supportedAppLanguages)[number];

export const appLanguageOptions: Array<{ value: AppLanguage; label: string }> = [
  { value: "de", label: "Deutsch (Standard)" },
  { value: "en", label: "English" }
];

export function normalizeAppLanguage(value?: string | null): AppLanguage {
  return value === "en" ? "en" : "de";
}

export const appMessages = {
  de: {
    navInventory: "Inventory",
    navNewItem: "Neues Item",
    navInventoryAudit: "Inventur",
    navArchive: "Archiv",
    navLocations: "Lagerorte",
    navShopping: "Einkaufsliste",
    navScanner: "Scanner",
    navAdmin: "Admin",
    navAudit: "Audit",
    navTrash: "Papierkorb",
    navCsvExport: "CSV Export",
    navJsonExport: "JSON Export",
    navPtouchExport: "P-touch CSV",
    navLogout: "Logout",
    navMenu: "Menue",
    navRecent: "Zuletzt genutzt",
    navSearchPlaceholder: "Code oder Name suchen (z.B. EL-KB-023)",
    shoppingTitle: "Einkaufsliste (unter Mindestbestand)",
    shoppingPageTitle: "Einkaufsliste",
    shoppingAvailable: "Verfuegbar",
    shoppingMinimum: "Min",
    shoppingNeeded: "Bedarf",
    shoppingLocation: "Ort",
    shoppingOpenItem: "Item oeffnen",
    shoppingOpen: "Oeffnen",
    signInTitle: "Anmelden",
    signInEmail: "E-Mail",
    signInPassword: "Passwort",
    signInSubmit: "Login",
    signInError: "Login fehlgeschlagen",
    adminTitle: "Admin",
    adminAuditHistory: "Audit History",
    adminAppSettingsTitle: "App Einstellungen",
    adminLabelConfigTitle: "Label-Code Einstellungen",
    adminLanguageLabel: "Sprache",
    adminLanguageHint: "Aendert nur die App-Oberflaeche. Kategorien, Types, Tags und Custom Fields bleiben unveraendert.",
    adminLanguageSave: "Speichern"
  },
  en: {
    navInventory: "Inventory",
    navNewItem: "New Item",
    navInventoryAudit: "Stock Audit",
    navArchive: "Archive",
    navLocations: "Locations",
    navShopping: "Shopping List",
    navScanner: "Scanner",
    navAdmin: "Admin",
    navAudit: "Audit",
    navTrash: "Trash",
    navCsvExport: "CSV Export",
    navJsonExport: "JSON Export",
    navPtouchExport: "P-touch CSV",
    navLogout: "Logout",
    navMenu: "Menu",
    navRecent: "Recently used",
    navSearchPlaceholder: "Search code or name (e.g. EL-KB-023)",
    shoppingTitle: "Shopping List (Below Minimum Stock)",
    shoppingPageTitle: "Shopping List",
    shoppingAvailable: "Available",
    shoppingMinimum: "Min",
    shoppingNeeded: "Needed",
    shoppingLocation: "Location",
    shoppingOpenItem: "Open item",
    shoppingOpen: "Open",
    signInTitle: "Sign In",
    signInEmail: "Email",
    signInPassword: "Password",
    signInSubmit: "Login",
    signInError: "Login failed",
    adminTitle: "Admin",
    adminAuditHistory: "Audit History",
    adminAppSettingsTitle: "App Settings",
    adminLabelConfigTitle: "Label Code Settings",
    adminLanguageLabel: "Language",
    adminLanguageHint: "Changes only the app interface. Categories, types, tags, and custom fields stay unchanged.",
    adminLanguageSave: "Save"
  }
} as const;

export type AppMessageKey = keyof (typeof appMessages)["de"];

export function translateAppMessage(language: AppLanguage, key: AppMessageKey) {
  return appMessages[language][key] || appMessages.de[key];
}

const apiErrorMessages: Record<string, { de: string; en: string }> = {
  Unauthorized: {
    de: "Nicht angemeldet",
    en: "Unauthorized"
  },
  Forbidden: {
    de: "Nicht erlaubt",
    en: "Forbidden"
  },
  "Not found": {
    de: "Nicht gefunden",
    en: "Not found"
  },
  "Storage location not allowed": {
    de: "Lagerort nicht erlaubt",
    en: "Storage location not allowed"
  },
  "Forbidden by storage scope": {
    de: "Durch den Lager-Scope nicht erlaubt",
    en: "Forbidden by storage scope"
  },
  "API tokens are read-only": {
    de: "API-Tokens sind nur lesend",
    en: "API tokens are read-only"
  },
  "Invalid JSON body": {
    de: "Ungueltiger JSON-Body",
    en: "Invalid JSON body"
  },
  "Validation failed": {
    de: "Validierung fehlgeschlagen",
    en: "Validation failed"
  },
  "Ziel ausserhalb des erlaubten Lager-Scope": {
    de: "Ziel ausserhalb des erlaubten Lager-Scope",
    en: "Target is outside the allowed storage scope"
  },
  "Quelle ausserhalb des erlaubten Lager-Scope": {
    de: "Quelle ausserhalb des erlaubten Lager-Scope",
    en: "Source is outside the allowed storage scope"
  },
  "Lagerort ist fuer eingelagerten Bestand erforderlich": {
    de: "Lagerort ist fuer eingelagerten Bestand erforderlich",
    en: "Storage location is required for placed stock"
  },
  "Lagerort nicht gefunden": {
    de: "Lagerort nicht gefunden",
    en: "Storage location not found"
  },
  "Ziel-Lagerort nicht gefunden": {
    de: "Ziel-Lagerort nicht gefunden",
    en: "Target storage location not found"
  },
  "Regal/Bereich ist fuer eingelagerten Bestand erforderlich": {
    de: "Regal/Bereich ist fuer eingelagerten Bestand erforderlich",
    en: "Shelf / area is required for placed stock"
  },
  "Regal/Bereich ist fuer den Lagerort ungueltig": {
    de: "Regal/Bereich ist fuer den Lagerort ungueltig",
    en: "Shelf / area is invalid for this storage location"
  },
  "Regal/Bereich gehoert nicht zum gewaehlten Lagerort": {
    de: "Regal/Bereich gehoert nicht zum gewaehlten Lagerort",
    en: "Shelf / area does not belong to the selected storage location"
  },
  "Regal/Bereich ist fuer den Ziel-Lagerort ungueltig": {
    de: "Regal/Bereich ist fuer den Ziel-Lagerort ungueltig",
    en: "Shelf / area is invalid for the target storage location"
  },
  "Dieses Regal erfordert einen Drawer": {
    de: "Dieses Regal erfordert einen Drawer",
    en: "This shelf requires a drawer"
  },
  "Dieses Regal erlaubt keine Drawer-Belegung": {
    de: "Dieses Regal erlaubt keine Drawer-Belegung",
    en: "This shelf does not allow drawers"
  },
  "Drawer ist erforderlich": {
    de: "Drawer ist erforderlich",
    en: "Drawer is required"
  },
  "Drawer nicht gefunden": {
    de: "Drawer nicht gefunden",
    en: "Drawer not found"
  },
  "Drawer passt nicht zum gewaehlten Lagerort oder Regal": {
    de: "Drawer passt nicht zum gewaehlten Lagerort oder Regal",
    en: "Drawer does not match the selected storage location or shelf"
  },
  "Drawer ist fuer dieses Regal erforderlich": {
    de: "Drawer ist fuer dieses Regal erforderlich",
    en: "Drawer is required for this shelf"
  },
  "Drawer ist fuer das Ziel ungueltig": {
    de: "Drawer ist fuer das Ziel ungueltig",
    en: "Drawer is invalid for the target"
  },
  "Unterfach ist erforderlich": {
    de: "Unterfach ist erforderlich",
    en: "Slot is required"
  },
  "Unterfach liegt ausserhalb der Drawer-Kapazitaet": {
    de: "Unterfach liegt ausserhalb der Drawer-Kapazitaet",
    en: "Slot is outside the drawer capacity"
  },
  "Dieses Unterfach ist bereits belegt": {
    de: "Dieses Unterfach ist bereits belegt",
    en: "This slot is already occupied"
  },
  "Drawer-Tausch ist nur innerhalb desselben Regals moeglich": {
    de: "Drawer-Tausch ist nur innerhalb desselben Regals moeglich",
    en: "Drawer swap is only possible within the same shelf"
  },
  "Bestand darf nicht unter die reservierte Menge fallen": {
    de: "Bestand darf nicht unter die reservierte Menge fallen",
    en: "Stock cannot fall below the reserved quantity"
  },
  "Nicht genug verfuegbarer Bestand fuer diese Reservierung": {
    de: "Nicht genug verfuegbarer Bestand fuer diese Reservierung",
    en: "Not enough available stock for this reservation"
  },
  "Inventur-Session nicht gefunden": {
    de: "Inventur-Session nicht gefunden",
    en: "Inventory session not found"
  },
  "Nicht im Papierkorb gefunden": {
    de: "Nicht im Papierkorb gefunden",
    en: "Not found in trash"
  },
  "Dateiname fehlt": {
    de: "Dateiname fehlt",
    en: "Filename is required"
  },
  "Ungueltiger Dateiname": {
    de: "Ungueltiger Dateiname",
    en: "Invalid filename"
  },
  "Backup nicht gefunden": {
    de: "Backup nicht gefunden",
    en: "Backup not found"
  },
  "categoryId/typeId required": {
    de: "categoryId/typeId ist erforderlich",
    en: "categoryId/typeId required"
  },
  "fieldId is required": {
    de: "fieldId ist erforderlich",
    en: "fieldId is required"
  },
  "Preset not found": {
    de: "Preset nicht gefunden",
    en: "Preset not found"
  },
  "Nur eine Bulk-Aktion gleichzeitig erlaubt": {
    de: "Nur eine Bulk-Aktion gleichzeitig erlaubt",
    en: "Only one bulk action at a time is allowed"
  },
  "Einheitenwechsel ist nur moeglich, solange noch keine Bewegungen oder Reservierungen existieren": {
    de: "Einheitenwechsel ist nur moeglich, solange noch keine Bewegungen oder Reservierungen existieren",
    en: "Unit changes are only allowed while no movements or reservations exist yet"
  },
  "Ein einzelnes Item kann nicht direkt aus einem mehrfach belegten Drawer transferiert werden": {
    de: "Ein einzelnes Item kann nicht direkt aus einem mehrfach belegten Drawer transferiert werden",
    en: "A single item cannot be moved directly out of a drawer with multiple occupied slots"
  },
  "CSV file missing": {
    de: "CSV-Datei fehlt",
    en: "CSV file missing"
  },
  "Scope change not supported": {
    de: "Scope-Aenderung wird nicht unterstuetzt",
    en: "Scope change not supported"
  },
  "Missing file": {
    de: "Datei fehlt",
    en: "Missing file"
  },
  "File too large": {
    de: "Datei ist zu gross",
    en: "File too large"
  },
  "Invalid MIME": {
    de: "Ungueltiger MIME-Type",
    en: "Invalid MIME"
  },
  "order must include all images": {
    de: "Die Sortierung muss alle Bilder enthalten",
    en: "Order must include all images"
  },
  "invalid image id in order": {
    de: "Ungueltige Bild-ID in der Sortierung",
    en: "Invalid image id in order"
  },
  "imageId required": {
    de: "imageId ist erforderlich",
    en: "imageId required"
  },
  "Image not found": {
    de: "Bild nicht gefunden",
    en: "Image not found"
  },
  "Item not found": {
    de: "Item nicht gefunden",
    en: "Item not found"
  },
  "Item nicht gefunden": {
    de: "Item nicht gefunden",
    en: "Item not found"
  },
  "Ein Item kann nicht Teil seiner eigenen Stückliste sein": {
    de: "Ein Item kann nicht Teil seiner eigenen Stückliste sein",
    en: "An item cannot be part of its own bill of materials"
  },
  "Komponente nicht gefunden": {
    de: "Komponente nicht gefunden",
    en: "Component not found"
  },
  "Zyklische Stücklisten sind nicht erlaubt": {
    de: "Zyklische Stücklisten sind nicht erlaubt",
    en: "Cyclic bills of materials are not allowed"
  },
  "Stücklisten-Eintrag nicht gefunden": {
    de: "Stücklisten-Eintrag nicht gefunden",
    en: "Bill of materials entry not found"
  },
  "Zuordnung verweist auf ein fehlendes oder inaktives Custom Field": {
    de: "Zuordnung verweist auf ein fehlendes oder inaktives Custom Field",
    en: "Mapping points to a missing or inactive custom field"
  },
  "Kategorie ist nicht zugeordnet": {
    de: "Kategorie ist nicht zugeordnet",
    en: "Category is not mapped"
  },
  "Type ist nicht zugeordnet": {
    de: "Type ist nicht zugeordnet",
    en: "Type is not mapped"
  },
  "Lagerort ist nicht zugeordnet": {
    de: "Lagerort ist nicht zugeordnet",
    en: "Storage location is not mapped"
  },
  "Lagerort nicht erlaubt": {
    de: "Lagerort nicht erlaubt",
    en: "Storage location not allowed"
  },
  "Drawer-Code muss dem Muster A01 bis Z99 entsprechen": {
    de: "Drawer-Code muss dem Muster A01 bis Z99 entsprechen",
    en: "Drawer code must match the pattern A01 to Z99"
  },
  "Drawer-Code ist bereits vorhanden": {
    de: "Drawer-Code ist bereits vorhanden",
    en: "Drawer code already exists"
  },
  "Drawer ist noch belegt und kann nicht geloescht werden": {
    de: "Drawer ist noch belegt und kann nicht geloescht werden",
    en: "Drawer is still occupied and cannot be deleted"
  },
  "Import-Profil mit diesem Namen existiert bereits.": {
    de: "Import-Profil mit diesem Namen existiert bereits.",
    en: "An import profile with this name already exists."
  },
  "Ein Custom Field mit diesem Namen und Scope existiert bereits.": {
    de: "Ein Custom Field mit diesem Namen und Scope existiert bereits.",
    en: "A custom field with this name and scope already exists."
  },
  "Technische Felder werden ueber den verwalteten Feldsatz gepflegt.": {
    de: "Technische Felder werden ueber den verwalteten Feldsatz gepflegt.",
    en: "Managed technical fields must be edited through the assigned field set."
  },
  "Technische Felder werden ueber den verwalteten Feldsatz geloescht.": {
    de: "Technische Felder werden ueber den verwalteten Feldsatz geloescht.",
    en: "Managed technical fields must be deleted through the assigned field set."
  },
  "Technischer Feldsatz nicht gefunden": {
    de: "Technischer Feldsatz nicht gefunden",
    en: "Technical field set not found"
  },
  "Technischer Feldsatz mit diesem Key existiert bereits.": {
    de: "Technischer Feldsatz mit diesem Key existiert bereits.",
    en: "A technical field preset with this key already exists."
  },
  "Technischer Feldsatz ist noch zugewiesen und kann nicht geloescht werden.": {
    de: "Technischer Feldsatz ist noch zugewiesen und kann nicht geloescht werden.",
    en: "This technical field preset is still assigned and cannot be deleted."
  },
  "Technisches Feld braucht einen stabilen Key": {
    de: "Technisches Feld braucht einen stabilen Key",
    en: "A technical field requires a stable key"
  }
};

function translateQuantityField(language: AppLanguage, field: string) {
  if (language !== "en") return field;
  if (field === "Bestand") return "Stock";
  if (field === "Mindestbestand") return "Minimum stock";
  if (field === "Menge") return "Quantity";
  return field;
}

export function translateApiErrorMessage(language: AppLanguage, message?: string | null) {
  if (!message) return "";
  const exact = apiErrorMessages[message]?.[language];
  if (exact) return exact;

  const missingColumn = message.match(/^Zuordnung verweist auf fehlende Spalte: (.+)$/);
  if (missingColumn) {
    return language === "en" ? `Mapping points to missing column: ${missingColumn[1]}` : message;
  }

  const unknownLookup = message.match(/^(Kategorie|Type|Lagerort|Regal|Drawer) unbekannt: (.+)$/);
  if (unknownLookup) {
    if (language !== "en") return message;
    const labelMap: Record<string, string> = {
      Kategorie: "Category",
      Type: "Type",
      Lagerort: "Storage location",
      Regal: "Shelf",
      Drawer: "Drawer"
    };
    return `${labelMap[unknownLookup[1]] || unknownLookup[1]} unknown: ${unknownLookup[2]}`;
  }

  const inactiveScope = message.match(/^(.+) ist fuer diesen Kategorie-\/Type-Scope nicht aktiv und wird ignoriert$/);
  if (inactiveScope) {
    return language === "en"
      ? `${inactiveScope[1]} is not active for this category/type scope and will be ignored`
      : message;
  }

  const unknownListValue = message.match(/^Unbekannter Listenwert fuer (.+)$/);
  if (unknownListValue) {
    return language === "en" ? `Unknown list value for ${unknownListValue[1]}` : message;
  }

  const duplicateTechnicalFieldKey = message.match(/^Doppelter technischer Feld-Key: (.+)$/);
  if (duplicateTechnicalFieldKey) {
    return language === "en" ? `Duplicate technical field key: ${duplicateTechnicalFieldKey[1]}` : message;
  }

  const invalidField = message.match(/^(.+) ist ungueltig$/);
  if (invalidField) {
    return language === "en" ? `${translateQuantityField(language, invalidField[1])} is invalid` : message;
  }

  const integerField = message.match(/^(.+) muss fuer (.+) ganzzahlig sein$/);
  if (integerField) {
    return language === "en"
      ? `${translateQuantityField(language, integerField[1])} must be an integer for ${integerField[2]}`
      : message;
  }

  const tooLargeField = message.match(/^(.+) ist zu gross$/);
  if (tooLargeField) {
    return language === "en" ? `${translateQuantityField(language, tooLargeField[1])} is too large` : message;
  }

  const negativeField = message.match(/^(.+) darf nicht negativ sein$/);
  if (negativeField) {
    return language === "en" ? `${translateQuantityField(language, negativeField[1])} cannot be negative` : message;
  }

  const zeroField = message.match(/^(.+) darf nicht 0 sein$/);
  if (zeroField) {
    return language === "en" ? `${translateQuantityField(language, zeroField[1])} cannot be 0` : message;
  }

  const minChars = message.match(/^String must contain at least (\d+) character\(s\)$/);
  if (minChars) {
    return language === "de" ? `Text muss mindestens ${minChars[1]} Zeichen enthalten` : message;
  }

  const maxChars = message.match(/^String must contain at most (\d+) character\(s\)$/);
  if (maxChars) {
    return language === "de" ? `Text darf hoechstens ${maxChars[1]} Zeichen enthalten` : message;
  }

  const minNumber = message.match(/^Number must be greater than or equal to (\d+)$/);
  if (minNumber) {
    return language === "de" ? `Zahl muss groesser oder gleich ${minNumber[1]} sein` : message;
  }

  const greaterNumber = message.match(/^Number must be greater than (\d+)$/);
  if (greaterNumber) {
    return language === "de" ? `Zahl muss groesser als ${greaterNumber[1]} sein` : message;
  }

  const maxNumber = message.match(/^Number must be less than or equal to (\d+)$/);
  if (maxNumber) {
    return language === "de" ? `Zahl muss kleiner oder gleich ${maxNumber[1]} sein` : message;
  }

  if (message === "Invalid url") {
    return language === "de" ? "Ungueltige URL" : message;
  }

  if (message === "Invalid uuid") {
    return language === "de" ? "Ungueltige ID" : message;
  }

  if (message === "Required") {
    return language === "de" ? "Erforderlich" : message;
  }

  return message;
}
