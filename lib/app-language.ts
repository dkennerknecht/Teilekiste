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
