/**
 * Eingebaute Standard-Rechtstexte (Impressum, Datenschutz, AGB) — je DE und EN,
 * als Markdown (Teilmenge: ##, ###, -, Absätze; siehe LegalMarkdown.tsx).
 *
 * HERKUNFT (24.07.2026): aus der Produktivseite von v1
 * (RollsportManager/rollsportmanager-backend/www/*.html), wo diese Texte seit
 * Januar 2026 öffentlich stehen.
 *   * Impressum: wörtlich — Angaben über den Betreiber, der derselbe ist.
 *   * Datenschutz: auf v1-Basis, aber ERWEITERT. v1 nennt nur Mitglieder-,
 *     Trainings-, Küren- und Chat-Daten. v2 verarbeitet Heikleres:
 *     Gesundheitsdaten (Krankmeldung mit Freitext, Art. 9), interne
 *     Trainer-Notizen, Fotos mit Einwilligung, Telefonnummern für
 *     Fahrgemeinschaften. Das steht ausdrücklich im Abschnitt „Welche Daten".
 *   * AGB: aus v1, aber Abschnitt 5 an v2 angepasst — v1 hatte ein
 *     Nutzer-Premium + Geschwisterrabatt; v2 rechnet je Verein über eine Lizenz
 *     (Basis/Pro/Premium) ab, Beitragskonditionen legt der Verein fest.
 *
 * DIES IST DER STANDARD, NICHT DIE WAHRHEIT ZUR LAUFZEIT: Hat der Betreiber im
 * (super)/plattform-einstellungen einen eigenen Text hinterlegt (GET
 * /public/legal), gewinnt DER. Diese Blobs erscheinen nur, solange der
 * Override leer ist. Wer hier ein Feature ergänzt, das neue Datenarten anfasst,
 * gehört in den Datenschutz-Abschnitt „Welche Daten".
 */

export type LegalKind = "impressum" | "datenschutz" | "agb";

const IMPRESSUM_DE = `## Angaben gemäß § 5 TMG
Marcel Goldfuss
Beethovenstr. 24
74172 Neckarsulm
Deutschland

## Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV
Marcel Goldfuss
Beethovenstr. 24
74172 Neckarsulm

## Kontakt
Telefon: +49 7132 7049229
E-Mail: info@rollsportmanager.de

## EU-Streitschlichtung
Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: https://ec.europa.eu/consumers/odr/

Unsere E-Mail-Adresse finden Sie oben im Impressum. Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.

## Haftung für Inhalte und Links
Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen.

Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter verantwortlich. Bei Bekanntwerden von Rechtsverletzungen entfernen wir derartige Links umgehend.

## Urheberrecht
Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht. Downloads und Kopien dieser Seite sind nur für den privaten, nicht kommerziellen Gebrauch gestattet. Soweit Inhalte nicht vom Betreiber erstellt wurden, werden die Urheberrechte Dritter beachtet.`;

const IMPRESSUM_EN = `## Information according to § 5 TMG (German Telemedia Act)
Marcel Goldfuss
Beethovenstr. 24
74172 Neckarsulm
Germany

## Responsible for content according to § 55 Abs. 2 RStV
Marcel Goldfuss
Beethovenstr. 24
74172 Neckarsulm

## Contact
Phone: +49 7132 7049229
Email: info@rollsportmanager.de

## EU dispute resolution
The European Commission provides a platform for online dispute resolution (ODR): https://ec.europa.eu/consumers/odr/

You can find our email address in the legal notice above. We are not willing or obliged to participate in dispute resolution proceedings before a consumer arbitration board.

## Liability for content and links
As a service provider we are responsible for our own content on these pages under general law pursuant to § 7 Abs. 1 TMG. Under §§ 8 to 10 TMG we are not obliged to monitor transmitted or stored third-party information.

Our website contains links to external third-party sites over whose content we have no influence. The respective provider is always responsible for the content of linked pages. We remove such links immediately upon becoming aware of legal violations.

## Copyright
Content and works created by the site operators on these pages are subject to German copyright law. Downloads and copies of this page are permitted for private, non-commercial use only. Where content was not created by the operator, third-party copyrights are respected.`;

const DATENSCHUTZ_DE = `## Auf einen Blick
RollsportManager verarbeitet Vereinsdaten ausschließlich, um die Vereinsverwaltung zu ermöglichen — sparsam und zweckgebunden. Ein großer Teil der Nutzenden sind Kinder; deren Daten behandeln wir entsprechend eng.

Wer welche Daten sehen darf, entscheidet nicht die Oberfläche, sondern die Datenbank selbst: Die Trennung der Vereine und die Rechte innerhalb eines Vereins sind dort erzwungen.

## Verantwortliche Stelle
Marcel Goldfuss
Beethovenstr. 24
74172 Neckarsulm
Deutschland

Telefon: +49 7132 7049229
E-Mail: info@rollsportmanager.de

## Welche Daten verarbeitet werden
Bei der Registrierung: E-Mail-Adresse, Passwort (verschlüsselt), Name, Vereinszugehörigkeit.

Im laufenden Betrieb je nach genutzten Modulen: Mitgliederdaten, Teams und Sparten, Termine und Anwesenheiten, Küren samt Musikdateien, Wettkampfergebnisse, Beiträge und Rechnungen, Nachrichten, Dokumente und Fotos.

### Besonders geschützte Daten
- Krankmeldungen zu Terminen können einen Freitext enthalten und sind damit Gesundheitsdaten (Art. 9 DSGVO). Sie sind auf die Familie selbst, den Vorstand und das Trainerteam des betroffenen Mitglieds beschränkt — nicht auf den Verein insgesamt.
- Interne Notizen des Trainerstabs über ein Mitglied sind für die betroffene Familie nicht sichtbar und nur dem Trainerteam dieses Mitglieds sowie der Vereinsleitung zugänglich.
- Fotos, auf denen Mitglieder markiert sind, werden nur mit hinterlegter Einwilligung angezeigt.
- Telefonnummern für Fahrgemeinschaften sind ausschließlich für die unmittelbar Beteiligten sichtbar.

## Hosting & Datenstandort
Die Daten werden in einem Rechenzentrum in Deutschland gespeichert und gesichert. Hosting, Auftragsverarbeitung nach Art. 28 DSGVO und Datenexport halten wir mit jedem Verein vertraglich fest.

## Cookies & Tracking
Wir setzen keine Tracking-Cookies und binden keine Werbe- oder Analysedienste ein. Gespeichert werden technisch notwendige Angaben für die Anmeldung sowie lokale Einstellungen wie Sprache und Farbschema.

## Ihre Rechte
Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch sowie auf Widerruf erteilter Einwilligungen (Art. 15–21 DSGVO). Wenden Sie sich dazu an die oben genannte Kontaktadresse. Ihnen steht außerdem ein Beschwerderecht bei einer Aufsichtsbehörde zu.`;

const DATENSCHUTZ_EN = `## At a glance
RollsportManager processes club data solely to make club management possible — minimal and purpose-bound. A large share of our users are children; their data is treated accordingly narrowly.

Who may see which data is not decided by the interface but by the database itself: separation between clubs and permissions within a club are enforced there.

## Controller
Marcel Goldfuss
Beethovenstr. 24
74172 Neckarsulm
Germany

Phone: +49 7132 7049229
Email: info@rollsportmanager.de

## Which data is processed
On registration: email address, password (encrypted), name, club membership.

During use, depending on the modules in use: member data, teams and divisions, events and attendance, routines including music files, competition results, fees and invoices, messages, documents and photos.

### Specially protected data
- Sickness notices for events may contain free text and are therefore health data (Art. 9 GDPR). They are limited to the family itself, the board and the coaching team of the member concerned — not to the club as a whole.
- Internal notes by the coaching staff about a member are not visible to the family concerned and are accessible only to that member's coaching team and the club leadership.
- Photos in which members are tagged are only shown where consent is on file.
- Phone numbers for carpools are visible only to those directly involved.

## Hosting & data location
Data is stored and backed up in a data centre in Germany. Hosting, the data processing agreement under Art. 28 GDPR and data export are contractually agreed with each club.

## Cookies & tracking
We set no tracking cookies and embed no advertising or analytics services. We store technically necessary information for signing in as well as local preferences such as language and colour scheme.

## Your rights
You have the right to access, rectification, erasure, restriction of processing, data portability and objection, as well as to withdraw consent given (Art. 15–21 GDPR). Please use the contact address above. You also have the right to lodge a complaint with a supervisory authority.`;

const AGB_DE = `## 1. Geltungsbereich
Diese Allgemeinen Geschäftsbedingungen gelten für die Nutzung der RollsportManager-App (iOS, macOS, Android) sowie des Web-Portals unter rollsportmanager.de (nachfolgend „Dienst" genannt). Der Dienst wird betrieben von Marcel Goldfuss, Beethovenstr. 24, 74172 Neckarsulm — E-Mail: info@rollsportmanager.de.

## 2. Leistungsbeschreibung
RollsportManager ist eine Vereinsverwaltungs-Software für Rollsportvereine. Der Dienst umfasst je nach gebuchten Modulen:
- Mitgliederverwaltung und Familien-Konten
- Team-, Sparten- und Trainingsorganisation
- Terminverwaltung mit Zu- und Absagen
- Kürverwaltung für Wettkampf-Choreografien
- Chat-Funktionen (Team-Chat, Direktnachrichten)
- Hallenbelegung, Ausrüstung und Schließfächer
- Beiträge, Rechnungen und Mahnwesen
- Vereinsnachrichten und Benachrichtigungen

## 3. Registrierung und Nutzerkonto
### 3.1 Voraussetzungen
Die Registrierung setzt ein Mindestalter von 16 Jahren voraus. Personen unter 16 Jahren benötigen die Zustimmung eines Erziehungsberechtigten oder werden über ein Eltern-Konto als Familienmitglied verwaltet.
### 3.2 Kontodaten
Der Nutzer verpflichtet sich, bei der Registrierung wahrheitsgemäße Angaben zu machen und seine Zugangsdaten vertraulich zu behandeln. Bei Verdacht auf Missbrauch ist der Nutzer verpflichtet, uns unverzüglich zu informieren.
### 3.3 Vereinszugehörigkeit
Die volle Nutzung des Dienstes erfordert die Zuordnung zu einem registrierten Verein. Die Zuordnung erfolgt über einen Einladungscode oder durch den Vereinsadministrator.

## 4. Nutzungsrechte und -pflichten
### 4.1 Erlaubte Nutzung
Der Nutzer erhält ein nicht-exklusives, nicht übertragbares Recht zur Nutzung des Dienstes im Rahmen der Vereinstätigkeit. Die Nutzung ist auf den vereinsinternen Gebrauch beschränkt.
### 4.2 Verbotene Nutzung
Dem Nutzer ist es untersagt:
- Den Dienst für rechtswidrige Zwecke zu nutzen
- Inhalte zu verbreiten, die gegen geltendes Recht verstoßen
- Die technische Infrastruktur zu stören oder zu manipulieren
- Zugangsdaten anderer Nutzer zu verwenden
- Automatisierte Zugriffe ohne Genehmigung durchzuführen
### 4.3 Inhalte
Der Nutzer ist für alle von ihm hochgeladenen Inhalte (Texte, Bilder, Videos, Musik) selbst verantwortlich und garantiert, dass er alle erforderlichen Rechte an ihnen besitzt.

## 5. Kosten und Vereinslizenz
Die Nutzung durch Mitglieder und Eltern ist kostenlos. Kostenpflichtig ist die Lizenz, die ein Verein für den Dienst bucht (Stufen Basis, Pro und Premium mit unterschiedlichem Funktions- und Mitgliederumfang). Die jeweils gültigen Preise werden vor Vertragsschluss ausgewiesen. Höhe und Konditionen der Mitgliedsbeiträge — einschließlich etwaiger Ermäßigungen, etwa für Geschwister — legt der jeweilige Verein eigenständig fest; sie sind nicht Teil dieses Vertrags.

## 6. Datenschutz
Der Schutz Ihrer personenbezogenen Daten ist uns wichtig. Informationen zur Erhebung, Verarbeitung und Nutzung Ihrer Daten finden Sie in unserer Datenschutzerklärung.

## 7. Verfügbarkeit
Wir bemühen uns um eine hohe Verfügbarkeit des Dienstes. Eine garantierte Erreichbarkeit kann jedoch nicht zugesichert werden. Wartungsarbeiten werden nach Möglichkeit vorab angekündigt.

## 8. Haftung
### 8.1 Haftungsbeschränkung
Wir haften unbeschränkt für Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit sowie bei Vorsatz und grober Fahrlässigkeit. Im Übrigen ist die Haftung auf den vorhersehbaren, typischerweise eintretenden Schaden begrenzt.
### 8.2 Haftung für Inhalte
Für die von Nutzern eingestellten Inhalte übernehmen wir keine Haftung. Bei Kenntnis von Rechtsverstößen werden entsprechende Inhalte umgehend entfernt.

## 9. Kündigung
### 9.1 Kündigung durch den Nutzer
Der Nutzer kann sein Konto jederzeit in den Profileinstellungen löschen oder eine Löschung per E-Mail beantragen. Mit der Löschung werden alle personenbezogenen Daten entfernt, sofern keine gesetzlichen Aufbewahrungspflichten entgegenstehen.
### 9.2 Kündigung durch uns
Wir behalten uns das Recht vor, Nutzerkonten bei schwerwiegenden Verstößen gegen diese AGB zu sperren oder zu löschen. Der Nutzer wird hierüber informiert.

## 10. Änderungen der AGB
Wir behalten uns vor, diese AGB zu ändern. Änderungen werden den Nutzern mitgeteilt. Bei wesentlichen Änderungen wird eine erneute Zustimmung eingeholt. Die weitere Nutzung nach Inkrafttreten der Änderungen gilt als Zustimmung.

## 11. Schlussbestimmungen
### 11.1 Anwendbares Recht
Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts.
### 11.2 Salvatorische Klausel
Sollten einzelne Bestimmungen dieser AGB unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.
### 11.3 Streitbeilegung
Die EU-Kommission stellt eine Plattform zur Online-Streitbeilegung bereit: https://ec.europa.eu/consumers/odr. Wir sind nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.`;

const AGB_EN = `## 1. Scope
These Terms and Conditions apply to the use of the RollsportManager app (iOS, macOS, Android) and the web portal at rollsportmanager.de (hereinafter the "Service"). The Service is operated by Marcel Goldfuss, Beethovenstr. 24, 74172 Neckarsulm — email: info@rollsportmanager.de.

## 2. Service Description
RollsportManager is club management software for roller sports clubs. Depending on the modules booked, the Service includes:
- Member management and family accounts
- Team, division and training organization
- Event management with RSVP functionality
- Routine management for competition choreographies
- Chat functions (team chat, direct messages)
- Facility booking, equipment and lockers
- Fees, invoices and dunning
- Club news and notifications

## 3. Registration and User Account
### 3.1 Requirements
Registration requires a minimum age of 16 years. Persons under 16 require the consent of a legal guardian or are managed as a family member through a parent account.
### 3.2 Account Data
The user agrees to provide truthful information during registration and to keep their access credentials confidential. In case of suspected abuse, the user is obligated to inform us immediately.
### 3.3 Club Membership
Full use of the Service requires assignment to a registered club. Assignment is done via an invitation code or by the club administrator.

## 4. Usage Rights and Obligations
### 4.1 Permitted Use
The user receives a non-exclusive, non-transferable right to use the Service within the scope of club activities. Use is limited to internal club purposes.
### 4.2 Prohibited Use
The user is prohibited from:
- Using the Service for illegal purposes
- Distributing content that violates applicable law
- Disrupting or manipulating the technical infrastructure
- Using access credentials of other users
- Performing automated access without permission
### 4.3 Content
The user is responsible for all content they upload (texts, images, videos, music) and guarantees that they hold all necessary rights to it.

## 5. Costs and Club Licence
Use by members and parents is free of charge. What is chargeable is the licence a club books for the Service (tiers Basis, Pro and Premium, differing in features and member capacity). Applicable prices are shown before the contract is concluded. The amount and conditions of membership fees — including any reductions, for example for siblings — are set independently by the respective club and are not part of this contract.

## 6. Data Protection
The protection of your personal data is important to us. Information about the collection, processing and use of your data can be found in our Privacy Policy.

## 7. Availability
We strive for high availability of the Service. However, guaranteed accessibility cannot be assured. Maintenance work will be announced in advance whenever possible.

## 8. Liability
### 8.1 Limitation of Liability
We are fully liable for damages resulting from injury to life, body or health, as well as for intent and gross negligence. Otherwise, liability is limited to foreseeable, typically occurring damage.
### 8.2 Liability for Content
We assume no liability for content posted by users. Upon becoming aware of legal violations, such content will be removed immediately.

## 9. Termination
### 9.1 Termination by User
The user can delete their account at any time in the profile settings or request deletion by email. Upon deletion, all personal data will be removed, unless legal retention requirements apply.
### 9.2 Termination by Us
We reserve the right to suspend or delete user accounts in case of serious violations of these Terms and Conditions. The user will be informed accordingly.

## 10. Changes to Terms and Conditions
We reserve the right to change these Terms and Conditions. Changes will be communicated to users. For significant changes, renewed consent will be obtained. Continued use after the changes take effect constitutes acceptance.

## 11. Final Provisions
### 11.1 Applicable Law
The law of the Federal Republic of Germany applies, excluding the UN Convention on Contracts for the International Sale of Goods.
### 11.2 Severability Clause
Should individual provisions of these Terms and Conditions be invalid, the validity of the remaining provisions remains unaffected.
### 11.3 Dispute Resolution
The EU Commission provides a platform for online dispute resolution: https://ec.europa.eu/consumers/odr. We are not obligated and not willing to participate in dispute resolution proceedings before a consumer arbitration board.`;

export const DEFAULT_LEGAL: Record<LegalKind, { de: string; en: string }> = {
  impressum: { de: IMPRESSUM_DE, en: IMPRESSUM_EN },
  datenschutz: { de: DATENSCHUTZ_DE, en: DATENSCHUTZ_EN },
  agb: { de: AGB_DE, en: AGB_EN },
};

/** Titel je Dokument und Sprache (die Überschrift über dem Text). */
export const LEGAL_TITLE: Record<LegalKind, { de: string; en: string }> = {
  impressum: { de: "Impressum", en: "Legal notice" },
  datenschutz: { de: "Datenschutzerklärung", en: "Privacy policy" },
  agb: { de: "Allgemeine Geschäftsbedingungen", en: "Terms and conditions" },
};
