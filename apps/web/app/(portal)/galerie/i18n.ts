import type { Dict } from "@/lib/i18n";

/**
 * Kolokalisiertes Dictionary des Galerie-Screens (Fotos & Videos, PRO).
 * Regel: JEDE Ergänzung in beiden Sprachen, deutsche Strings mit echten
 * Umlauten (ä/ö/ü/ß) — nie ae/oe/ue/ss. Das PRO-Gate ist serverseitig
 * verbindlich (HTTP 402 club_pro_required); diese Strings zeigen die
 * Upgrade-Karte bzw. das PRO-Badge.
 */
export const galerieDict = {
  de: {
    pageEyebrow: "Fotos & Videos",
    pageTitle: "Galerie",
    pageSub: "Momente und Videos deines Vereins — nur für Mitglieder sichtbar.",
    proBadge: "PRO",
    upload: "Hochladen",

    allAlbums: "Alle",
    noAlbum: "Ohne Album",
    filterLabel: "Nach Album filtern",

    kindPhoto: "Foto",
    kindVideo: "Video",

    openAria: "Medium öffnen: {title}",
    delete: "Löschen",
    deleteAria: "Medium löschen: {title}",
    byAuthor: "von {name}",
    unknownAuthor: "Unbekannt",

    emptyTitle: "Noch keine Medien",
    emptyBodyTrainer:
      "Lade das erste Foto oder Video hoch — es erscheint sofort in der Galerie aller Mitglieder.",
    emptyBodyMember:
      "Sobald der Trainerstab Fotos oder Videos hochlädt, erscheinen sie hier.",
    emptyCta: "Erstes Medium hochladen",

    loadErrorTitle: "Galerie konnte nicht geladen werden",
    loadErrorRetry: "Erneut versuchen",
    niTitle: "Noch nicht angebunden",
    niBody: "Dieser Bereich hat im api-Modus noch keinen Endpoint.",

    // PRO-Gate (Upgrade-Karte)
    proEyebrow: "PRO-Funktion",
    proTitle: "Galerie ist ein PRO-Feature",
    proBody:
      "Mit RollsportManager PRO teilst du Fotos und Videos von Wettkämpfen, Trainingslagern und Vereinsfesten — sicher und nur für Mitglieder sichtbar.",
    proFeature1: "Fotos & Videos für alle Mitglieder",
    proFeature2: "Alben zur übersichtlichen Gruppierung",
    proFeature3: "Sichtbar nur für deinen Verein",
    proTierLabel: "Aktueller Tarif",
    proHint:
      "Die Galerie wird freigeschaltet, sobald PRO für deinen Verein aktiv ist. Wende dich dazu an die Vereinsleitung.",
    tierFree: "Free",
    tierPro: "PRO",
    tierPremium: "Premium",

    // Lightbox / Detail
    download: "Herunterladen",
    uploadedBy: "Hochgeladen von {name}",
    videoUnsupported: "Dein Browser kann dieses Video nicht abspielen.",
    mediaError: "Medium konnte nicht geladen werden.",
    mediaLoading: "Medium wird geladen …",

    // Upload-Sheet
    formEyebrow: "Neues Medium",
    formTitle: "Foto oder Video hochladen",
    fFile: "Datei",
    fFileHint: "Bild oder Video, bis 25 MB.",
    fFileChoose: "Datei wählen",
    fFileChange: "Andere Datei wählen",
    previewAlt: "Vorschau der gewählten Datei",
    fTitle: "Titel",
    fTitlePh: "z. B. Siegerehrung Kür",
    fAlbum: "Album",
    fAlbumOptional: "Album (optional)",
    fAlbumPh: "z. B. Vereinsmeisterschaft 2025",
    errFile: "Bitte wähle ein Bild oder Video.",
    errFileType: "Nur Bilder und Videos sind erlaubt.",
    errFileSize: "Die Datei ist größer als 25 MB.",
    errTitle: "Bitte gib einen Titel an.",
    submit: "Hochladen",
    submitting: "Wird hochgeladen …",
    cancel: "Abbrechen",
    createdToast: "„{title}“ ist jetzt in der Galerie",

    // Fehler (Schreibpfade)
    errPro: "Galerie ist ein PRO-Feature deines Vereins.",
    errForbidden: "Keine Berechtigung für diese Aktion.",
    errTooLarge: "Die Datei ist zu groß (max. 25 MB).",
    errType: "Dieser Dateityp wird nicht unterstützt.",

    // Löschen
    deleteEyebrow: "Löschen bestätigen",
    deleteTitle: "„{title}“ löschen?",
    deleteBody:
      "Das Medium wird für alle Mitglieder aus der Galerie entfernt. Das lässt sich nicht rückgängig machen.",
    deleteConfirm: "Endgültig löschen",
    deletedToast: "Medium gelöscht",
  },
  en: {
    pageEyebrow: "Photos & videos",
    pageTitle: "Gallery",
    pageSub: "Moments and videos from your club — visible to members only.",
    proBadge: "PRO",
    upload: "Upload",

    allAlbums: "All",
    noAlbum: "No album",
    filterLabel: "Filter by album",

    kindPhoto: "Photo",
    kindVideo: "Video",

    openAria: "Open media: {title}",
    delete: "Delete",
    deleteAria: "Delete media: {title}",
    byAuthor: "by {name}",
    unknownAuthor: "Unknown",

    emptyTitle: "No media yet",
    emptyBodyTrainer:
      "Upload the first photo or video — it appears in every member's gallery right away.",
    emptyBodyMember:
      "As soon as a coach uploads photos or videos, they show up here.",
    emptyCta: "Upload the first media",

    loadErrorTitle: "Gallery could not be loaded",
    loadErrorRetry: "Try again",
    niTitle: "Not connected yet",
    niBody: "This area has no endpoint in api mode yet.",

    // PRO gate (upgrade card)
    proEyebrow: "PRO feature",
    proTitle: "Gallery is a PRO feature",
    proBody:
      "With RollsportManager PRO you share photos and videos from competitions, training camps and club events — securely and visible to members only.",
    proFeature1: "Photos & videos for all members",
    proFeature2: "Albums to keep everything organised",
    proFeature3: "Visible to your club only",
    proTierLabel: "Current plan",
    proHint:
      "The gallery unlocks as soon as PRO is active for your club. Please contact your club management.",
    tierFree: "Free",
    tierPro: "PRO",
    tierPremium: "Premium",

    // Lightbox / detail
    download: "Download",
    uploadedBy: "Uploaded by {name}",
    videoUnsupported: "Your browser cannot play this video.",
    mediaError: "Media could not be loaded.",
    mediaLoading: "Loading media …",

    // Upload sheet
    formEyebrow: "New media",
    formTitle: "Upload photo or video",
    fFile: "File",
    fFileHint: "Image or video, up to 25 MB.",
    fFileChoose: "Choose file",
    fFileChange: "Choose another file",
    previewAlt: "Preview of the selected file",
    fTitle: "Title",
    fTitlePh: "e.g. Awards ceremony",
    fAlbum: "Album",
    fAlbumOptional: "Album (optional)",
    fAlbumPh: "e.g. Club championship 2025",
    errFile: "Please choose an image or video.",
    errFileType: "Only images and videos are allowed.",
    errFileSize: "The file is larger than 25 MB.",
    errTitle: "Please enter a title.",
    submit: "Upload",
    submitting: "Uploading …",
    cancel: "Cancel",
    createdToast: "“{title}” is now in the gallery",

    // Errors (write paths)
    errPro: "Gallery is a PRO feature of your club.",
    errForbidden: "No permission for this action.",
    errTooLarge: "The file is too large (max 25 MB).",
    errType: "This file type is not supported.",

    // Delete
    deleteEyebrow: "Confirm deletion",
    deleteTitle: "Delete “{title}”?",
    deleteBody:
      "The media will be removed from every member's gallery. This cannot be undone.",
    deleteConfirm: "Delete permanently",
    deletedToast: "Media deleted",
  },
} satisfies Dict;
