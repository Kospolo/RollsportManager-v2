/*!
 * Hofbräustüble – Verwaltung: Zusatzfunktionen
 *   Reiter „Reservierungen“, „Anmeldungen“, „Speisekarte“ und „Funktionen“ (Schalter + Fußball-Programm),
 *   dazu die Felder „Anmeldung möglich“ im Termin-Editor.
 *
 * Wird VOR admin.js geladen und meldet sich über window.HBS_ADMIN_EXT an; admin.js ruft init(ctx) mit seinen
 * Bausteinen auf (h, icon, toggle, field, Zustand S …). Inhalte (Texte, Schalter, Speisekarte) werden wie alles
 * andere mit „Speichern“ veröffentlicht. Gäste-Anfragen/Anmeldungen kommen sofort aus ../cms/gast-api.php und
 * werden pro Klick gespeichert. Ohne PHP (Demo) laufen sie mit Beispieldaten im localStorage.
 * CSP: keine Inline-Styles/-Skripte – nur Klassen (admin/extras.css).
 */
(function () {
  'use strict';

  var GAST = '../cms/gast-api.php';
  var PROG = '../cms/programm-api.php';
  var LS_DEMO = 'hbs_gast_demo_v1';
  var X = null;      // Bausteine aus admin.js
  var uid = 0;
  var G = { data: null, counts: { neu: 0, anmNeu: 0 }, error: '', timer: null, lastNeu: null };

  var FEATURE_DEFAULTS = { tippspiel: true, team: true, reservierung: false, speisekarte: true, anmeldung: false, programm: true, preise: false, kasse: false };
  var FEATURES = [
    { key: 'tippspiel', icon: 'trophy', title: 'Tippspiel', text: 'Stammgäste tippen Bundesliga-Spiele und sammeln Punkte.', note: 'Ausschalten: Tippspiel-Abschnitt und Menüpunkt verschwinden von der Website. Spieler, Tipps und Punkte bleiben gespeichert – wer den direkten Link kennt, kommt weiterhin ins Tippspiel.', go: 'tippspiel' },
    { key: 'team', icon: 'users', title: 'Team-Bereich', text: 'Eigener Bereich für Ihre Mitarbeiter (z. B. Dienstplan).', note: 'Ausschalten: Der Team-Bereich wird auf der Website nicht mehr verlinkt. Die gespeicherten Team-Daten bleiben erhalten.' },
    { key: 'speisekarte', icon: 'beer', title: 'Getränke- & Speisekarte', text: 'Ihre Karte mit Preisen als eigener Abschnitt auf der Website.', go: 'speisekarte' },
    { key: 'reservierung', icon: 'table', title: 'Tischreservierung', text: 'Gäste schicken eine Anfrage – Sie rufen zurück und bestätigen. Keine automatische Buchung.', go: 'reservierungen' },
    { key: 'anmeldung', icon: 'ticket', title: 'Anmeldung zu Veranstaltungen', text: 'Gäste melden sich für einzelne Termine an (z. B. Weihnachtsfeier) – mit „noch X Plätze frei“.', go: 'anmeldungen' },
    { key: 'programm', icon: 'tv', title: 'Fußball diese Woche', text: 'Die Spiele der nächsten Tage aus dem Tippspiel als „Diese Woche live bei uns“ auf der Website.' },
    { key: 'preise', icon: 'star', title: 'Preise im Tippspiel', text: 'Preise für die Tippspiel-Sieger anzeigen.' },
    { key: 'kasse', icon: 'coins', title: 'Stammtischkasse', text: 'Stammtischkasse für gemeinsame Feiern (nicht für den Tippsieger).' }
  ];
  var STATUS = [['neu', 'Neu'], ['bestaetigt', 'Bestätigt'], ['abgelehnt', 'Abgelehnt']];
  var PRIVACY_SNIPPET = 'Tischanfragen und Anmeldungen: Wenn Sie über unsere Website einen Tisch anfragen oder sich zu einer Veranstaltung anmelden, speichern wir Ihren Namen, Ihre Telefonnummer, freiwillig Ihre E-Mail-Adresse, den Wunschtermin bzw. die Veranstaltung, die Anzahl der Personen und Ihre Nachricht. Wir verwenden die Angaben ausschließlich, um Ihre Anfrage zu bearbeiten und Sie zurückzurufen (Art. 6 Abs. 1 lit. b DSGVO). Die Daten liegen auf unserem Webspace beim Hosting-Anbieter und werden nicht an Dritte weitergegeben. Tischanfragen löschen wir automatisch 30 Tage nach dem Termin, Anmeldungen eine Woche nach der Veranstaltung. Zum Schutz vor Missbrauch speichern wir außerdem kurzzeitig (höchstens 24 Stunden) einen nicht umkehrbaren Hash-Wert Ihrer IP-Adresse.';

  var ICONS = {
    table: '<path d="M3 9h18M5 9v11M19 9v11M7 5h10l2 4H5z"/>',
    tv: '<rect x="2.5" y="6" width="19" height="12.5" rx="1.5"/><path d="M8 21.5h8M9 2.5 12 6l3-3.5"/>',
    toggle: '<rect x="2" y="7" width="20" height="10" rx="5"/><circle cx="16" cy="12" r="3"/>',
    coins: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>'
  };

  /* ================================================================ Grundlagen */

  function h() { return X.h.apply(null, arguments); }
  function icon(n) { return X.icon(n); }
  function nid() { uid += 1; return 'x' + uid; }
  function S() { return X.S; }
  function C() { return X.S.content; }
  function isDemo() { return X.S.mode === 'demo'; }
  function pad(n) { return String(n).padStart(2, '0'); }
  function todayISO() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function addDays(iso, n) { var p = iso.split('-'); var d = new Date(+p[0], +p[1] - 1, +p[2] + n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  var WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  var WDL = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  var MON = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  var MONL = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  function fdate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
    if (!m) return { day: '?', mon: '', wd: '', long: iso || '' };
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    return { day: String(+m[3]), mon: MON[+m[2] - 1], wd: WD[d.getDay()], long: WDL[d.getDay()] + ', ' + (+m[3]) + '. ' + MONL[+m[2] - 1] + ' ' + m[1], short: WD[d.getDay()] + ', ' + (+m[3]) + '.' + (+m[2]) + '.' };
  }
  function fdt(s) { // "2026-11-25 14:03:11" → "25.11. 14:03"
    var m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}:\d{2})/.exec(s || '');
    return m ? (+m[3]) + '.' + (+m[2]) + '. ' + m[4] + ' Uhr' : (s || '');
  }
  function tel(p) { return 'tel:' + String(p || '').replace(/[^\d+]/g, ''); }
  function features() {
    var f = (C() && C().features) || {};
    var out = {};
    Object.keys(FEATURE_DEFAULTS).forEach(function (k) { out[k] = typeof f[k] === 'boolean' ? f[k] : FEATURE_DEFAULTS[k]; });
    return out;
  }
  function intInput(obj, key, min, max, o) {
    o = o || {};
    var el = h('input', { type: 'number', inputmode: 'numeric', min: String(min), max: String(max), step: '1', class: 'x-num' });
    el.value = obj[key] == null ? '' : String(obj[key]);
    el.addEventListener('input', function () {
      var v = parseInt(el.value, 10);
      var ok = !isNaN(v) && v >= min && v <= max;
      el.classList.toggle('invalid', !ok && el.value !== '');
      if (ok) { obj[key] = v; if (o.onInput) o.onInput(v); else X.changed(); }
    });
    el.addEventListener('blur', function () { if (el.value === '' || el.classList.contains('invalid')) { el.value = String(obj[key]); el.classList.remove('invalid'); } });
    return el;
  }
  function offNotice(key, label) {
    if (features()[key]) return null;
    return h('div', { class: 'notice notice-warn x-off' }, icon('alert'), h('div', null,
      h('strong', null, label + ' ist ausgeschaltet. '), 'Gäste sehen davon auf der Website nichts.',
      h('div', null, X.btn('Jetzt einschalten', 'check', function () {
        C().features = Object.assign({}, features(), (function () { var o = {}; o[key] = true; return o; })());
        X.changed(); X.show(X.S.section, true); syncNav();
        X.toast('Eingeschaltet. Zum Veröffentlichen oben „Speichern“ klicken.', 'info');
      }, 'btn-primary btn-sm'))));
  }
  function contentHint() {
    return h('div', { class: 'notice notice-warn x-hint' }, icon('save'), h('div', null, h('strong', null, 'Mit „Speichern“ veröffentlichen: '), 'Diese Einstellungen sind Texte der Website und werden erst mit dem Knopf „Speichern“ oben rechts übernommen.'));
  }
  function liveHint() {
    return h('div', { class: 'notice notice-success x-hint' }, icon('check'), h('div', null, h('strong', null, 'Wird sofort gespeichert: '), 'Status, Notizen und Löschen gelten direkt – der Knopf „Speichern“ ist dafür nicht nötig.'));
  }

  /* ================================================================ Schnittstelle (oder Demo) */

  function ApiErr(msg, status, data) { var e = new Error(msg); e.status = status || 0; e.data = data || null; return e; }

  function gapi(action, body) {
    var init = { method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } };
    if (body) { init.headers['Content-Type'] = 'application/json'; init.headers['X-CSRF-Token'] = X.S.csrf || ''; init.body = JSON.stringify(body); }
    return fetch(GAST + '?action=' + encodeURIComponent(action), init).then(function (r) {
      return r.text().then(function (t) {
        var j = null;
        try { j = JSON.parse(t); } catch (e) { /* kein JSON */ }
        if (!j || j.api !== 'hbs-gast') throw ApiErr('Die Schnittstelle cms/gast-api.php antwortet nicht (HTTP ' + r.status + ').', r.status);
        if (!r.ok || j.ok === false) throw ApiErr(j.error || 'Fehler (HTTP ' + r.status + ')', r.status, j);
        return j;
      });
    }, function () { throw ApiErr('Keine Verbindung zum Server.', 0); });
  }
  function call(action, body) {
    if (isDemo()) return Promise.resolve().then(function () { return demoCall(action, body); });
    return X.withAuth(function () { return gapi(action, body); });
  }

  /* ---- Demo: Beispieldaten im Browser ---- */
  function demoLoad() {
    var d = null;
    try { d = JSON.parse(localStorage.getItem(LS_DEMO) || 'null'); } catch (e) { d = null; }
    if (!d || !Array.isArray(d.reservierungen)) d = demoSeed();
    return d;
  }
  function demoSave(d) { try { localStorage.setItem(LS_DEMO, JSON.stringify(d)); } catch (e) { /* voll */ } }
  function demoSeed() {
    var t = todayISO(), now = t + ' 10:15:00';
    var evs = (C() && C().events || []).filter(function (e) { return e.signup && e.date >= t; });
    var d = {
      nextId: 20,
      reservierungen: [
        { id: 1, created: now, date: addDays(t, 2), time: '19:00', persons: 4, name: 'Helga Maier', phone: '0171 1234567', email: '', note: 'Gern am Fenster', anlass: '', status: 'neu', internalNote: '', called: false },
        { id: 2, created: now, date: addDays(t, 3), time: '15:00', persons: 8, name: 'Kegelclub Amorbach', phone: '07132 99887', email: 'kegel@example.org', note: 'Wir kommen zum Spiel', anlass: '15:30 Uhr: VfB Stuttgart – FC Bayern München', status: 'neu', internalNote: '', called: false },
        { id: 3, created: now, date: addDays(t, 5), time: '20:00', persons: 2, name: 'Werner K.', phone: '0160 5550123', email: '', note: '', anlass: '', status: 'bestaetigt', internalNote: 'Tisch 3', called: true }
      ],
      anmeldungen: []
    };
    evs.slice(0, 2).forEach(function (e, i) {
      [['Gisela Schneider', '0171 2223334', 2], ['Stammtisch Dienstag', '07132 12345', 6], ['Rolf B.', '0152 7778889', 1]].slice(0, 3 - i).forEach(function (p, k) {
        d.anmeldungen.push({ id: 10 + i * 3 + k, created: now, event: e.id, eventTitle: e.title, eventDate: e.date, name: p[0], phone: p[1], persons: p[2], note: '', seen: k > 0 });
      });
    });
    demoSave(d);
    return d;
  }
  function demoCounts(d) {
    return { neu: d.reservierungen.filter(function (r) { return r.status === 'neu'; }).length, anmNeu: d.anmeldungen.filter(function (a) { return !a.seen; }).length };
  }
  function demoCall(action, b) {
    var d = demoLoad();
    var out = {};
    if (action === 'admin_overview') out = { reservierungen: d.reservierungen.slice(), anmeldungen: d.anmeldungen.slice(), deleteAfterDays: 30, signupKeepDays: 7 };
    else if (action === 'admin_res_update') {
      var r = d.reservierungen.filter(function (x) { return x.id === b.id; })[0];
      if (!r) throw ApiErr('Diese Anfrage gibt es nicht mehr.', 404);
      if (b.status) r.status = b.status;
      if (b.internalNote !== undefined) r.internalNote = b.internalNote;
      if (b.called !== undefined) r.called = b.called;
      out.reservierung = r;
    } else if (action === 'admin_res_delete') d.reservierungen = d.reservierungen.filter(function (x) { return x.id !== b.id; });
    else if (action === 'admin_anm_delete') d.anmeldungen = d.anmeldungen.filter(function (x) { return x.id !== b.id; });
    else if (action === 'admin_anm_seen') d.anmeldungen.forEach(function (a) { a.seen = true; });
    demoSave(d);
    out.counts = demoCounts(d);
    return out;
  }
  function demoAddSample() {
    var d = demoLoad(), t = todayISO();
    d.nextId += 1;
    d.reservierungen.push({ id: d.nextId, created: t + ' ' + pad(new Date().getHours()) + ':' + pad(new Date().getMinutes()) + ':00', date: addDays(t, 1 + (d.nextId % 5)), time: '18:30', persons: 3, name: 'Beispiel-Gast ' + d.nextId, phone: '0170 000' + d.nextId, email: '', note: 'Simulierte Anfrage (Demo)', anlass: '', status: 'neu', internalNote: '', called: false });
    demoSave(d);
  }

  /* ================================================================ Daten laden, Hinweis-Punkte im Menü */

  function loadData() {
    return call('admin_overview').then(function (r) {
      G.data = r; G.error = '';
      setCounts(r.counts || (isDemo() ? demoCounts(demoLoad()) : G.counts));
      return r;
    }, function (e) { G.error = e.message || 'Fehler beim Laden.'; throw e; });
  }
  function setCounts(c) {
    if (!c) return;
    if (G.lastNeu !== null && c.neu > G.lastNeu && X.S.section !== 'reservierungen') X.toast('Neue Tisch-Anfrage eingegangen.', 'info', 6000);
    G.lastNeu = c.neu;
    G.counts = c;
    syncNav();
  }
  function navItem(id) { return document.querySelector('.nav-item[data-id="' + id + '"]'); }
  function badge(item, n, label) {
    if (!item) return;
    var b = item.querySelector('.x-nav-badge');
    if (!n) { if (b) b.remove(); return; }
    if (!b) { b = h('span', { class: 'badge x-nav-badge' }); item.appendChild(b); }
    b.textContent = String(n);
    b.setAttribute('aria-label', n + ' ' + label);
  }
  /** Reiter ausgeschalteter Funktionen ausblenden (außer dem gerade offenen), Hinweis-Punkte setzen */
  function syncNav() {
    var f = features();
    [['reservierungen', 'reservierung'], ['anmeldungen', 'anmeldung'], ['speisekarte', 'speisekarte']].forEach(function (p) {
      var it = navItem(p[0]);
      if (!it) return;
      var hasData = p[0] === 'reservierungen' ? G.counts.neu > 0 : p[0] === 'anmeldungen' ? G.counts.anmNeu > 0 : false;
      it.hidden = !f[p[1]] && !hasData && X.S.section !== p[0];
    });
    badge(navItem('reservierungen'), G.counts.neu, 'neue Anfragen');
    badge(navItem('anmeldungen'), G.counts.anmNeu, 'neue Anmeldungen');
  }
  function pollCounts() {
    if (!X.S.content || !navItem('funktionen')) return;
    if (isDemo()) { setCounts(demoCounts(demoLoad())); return; }
    if (!X.S.csrf || document.visibilityState === 'hidden') return;
    gapi('admin_counts').then(function (r) {
      var before = G.counts.neu + '/' + G.counts.anmNeu;
      setCounts(r.counts);
      if (before !== r.counts.neu + '/' + r.counts.anmNeu && (X.S.section === 'reservierungen' || X.S.section === 'anmeldungen') && !document.querySelector('.modal-backdrop')) refreshSection();
    }, function () { /* still */ });
  }
  function refreshSection() {
    var box = document.querySelector('[data-x-live]');
    if (box && box._refresh) box._refresh();
  }
  function watchApp() {
    var app = document.getElementById('app');
    if (!app || !window.MutationObserver) return;
    new MutationObserver(function () { if (navItem('funktionen')) { syncNav(); if (!G.started) { G.started = true; pollCounts(); } } }).observe(app, { childList: true });
    G.timer = setInterval(pollCounts, 60000);
  }

  /* ================================================================ Reiter: Funktionen */

  function renderFeatures() {
    var c = C();
    c.features = Object.assign({}, features(), c.features || {});
    var wrap = h('div', { class: 'x-features' }, X.sectionHead('Funktionen', 'Hier schalten Sie ganze Bereiche der Website ein oder aus. Ausgeschaltete Bereiche verschwinden von der Website (Abschnitt, Menüpunkt, Knöpfe) – gespeicherte Daten bleiben erhalten.'),
      contentHint());
    FEATURES.forEach(function (f) {
      var cardEl = h('section', { class: 'card x-feature', 'data-feature': f.key });
      function upd() { cardEl.classList.toggle('is-on', !!c.features[f.key]); }
      var sw = X.toggle(c.features, f.key, f.title, 'Eingeschaltet – auf der Website sichtbar', 'Ausgeschaltet – auf der Website versteckt', function () { upd(); syncNav(); });
      sw.classList.add('x-bigswitch');
      sw.querySelector('input').setAttribute('aria-describedby', 'xf-' + f.key);
      cardEl.appendChild(h('div', { class: 'x-feature-head' }, h('span', { class: 'x-feature-icon', 'aria-hidden': 'true' }, icon(f.icon)), sw));
      cardEl.appendChild(h('p', { class: 'x-feature-text', id: 'xf-' + f.key }, f.text));
      if (f.note) cardEl.appendChild(h('p', { class: 'x-feature-note' }, icon('info'), h('span', null, f.note)));
      if (f.go) cardEl.appendChild(h('div', { class: 'x-feature-actions' }, X.btn(f.key === 'tippspiel' ? 'Zum Tippspiel' : 'Einstellungen öffnen', 'chevron', function () { X.go(f.go); }, 'btn-sm')));
      if (f.key === 'programm') cardEl.appendChild(programmSettings());
      upd();
      wrap.appendChild(cardEl);
    });
    return wrap;
  }

  function programmSettings() {
    var c = C();
    c.programm = Object.assign({ title: '', text: '', competitions: [], days: 7 }, c.programm || {});
    var p = c.programm;
    if (!Array.isArray(p.competitions)) p.competitions = [];
    var list = h('div', { class: 'x-comp-list' }, h('p', { class: 'help' }, 'Wettbewerbe werden geladen …'));
    var box = h('details', { class: 'x-sub' },
      h('summary', null, 'Einstellungen: Überschrift, Zeitraum, Wettbewerbe'),
      h('div', { class: 'fields' },
        X.tf('Überschrift', p, 'title', { max: 150, placeholder: 'Diese Woche live bei uns' }),
        X.tf('Kurzer Text', p, 'text', { max: 1000, optional: true, placeholder: 'Alle Spiele auf dem großen Bildschirm …' }),
        X.field('Zeitraum (Tage ab heute)', intInput(p, 'days', 1, 14), { help: '7 = die nächste Woche. Höchstens 14 Tage.' }),
        h('div', { class: 'field' }, h('span', { class: 'label' }, 'Welche Wettbewerbe sollen erscheinen?'),
          h('span', { class: 'help' }, 'Nichts angehakt = alle aktiven Wettbewerbe aus dem Tippspiel.'), list)));
    fetch(PROG + '?action=wettbewerbe', { credentials: 'same-origin', cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j || j.api !== 'hbs-programm') throw new Error('x');
      list.replaceChildren();
      if (!j.competitions || !j.competitions.length) { list.appendChild(h('p', { class: 'help' }, 'Im Tippspiel sind noch keine Wettbewerbe angelegt. Die Spiele kommen aus „Tippspiel → Spiele & Wettbewerbe“.')); return; }
      j.competitions.forEach(function (cp) {
        var id = nid();
        var cb = h('input', { type: 'checkbox', id: id });
        cb.checked = p.competitions.indexOf(cp.id) >= 0;
        cb.addEventListener('change', function () {
          var set = p.competitions.filter(function (x) { return x !== cp.id; });
          if (cb.checked) set.push(cp.id);
          p.competitions = set.sort(function (a, b) { return a - b; });
          X.changed();
        });
        list.appendChild(h('label', { class: 'x-checkrow', for: id }, cb, h('span', null, cp.name, cp.active ? null : h('span', { class: 'badge badge-muted' }, 'Archiv'))));
      });
    }).catch(function () {
      list.replaceChildren(h('p', { class: 'help' }, isDemo() ? 'Demo: Ohne Server gibt es keine Wettbewerbe. Die Website zeigt im Demo-Modus Beispielspiele.' : 'Die Wettbewerbe konnten nicht geladen werden.'));
    });
    return box;
  }

  /* ================================================================ Reiter: Speisekarte */

  function renderMenu() {
    var c = C();
    c.speisekarte = Object.assign({ title: '', intro: '', note: '', categories: [] }, c.speisekarte || {});
    var m = c.speisekarte;
    if (!Array.isArray(m.categories)) m.categories = [];
    var wrap = h('div', { class: 'x-menu-admin' }, X.sectionHead('Speisekarte', 'Getränke und Speisen mit Preisen. Die Reihenfolge hier ist die Reihenfolge auf der Website.',
      [X.btn('Neue Kategorie', 'plus', function () { m.categories.push({ name: 'Neue Kategorie', note: '', items: [] }); X.changed(); rerender(); setTimeout(function () { var l = document.querySelectorAll('.x-cat-name'); if (l.length) l[l.length - 1].focus(); }, 30); }, 'btn-primary')]),
      offNotice('speisekarte', 'Die Speisekarte'), contentHint());
    if (/beispiel/i.test(m.note || '')) wrap.appendChild(h('div', { class: 'notice notice-danger' }, icon('alert'), h('div', null, h('strong', null, 'Beispielpreise! '), 'Die mitgelieferten Preise sind nur Beispiele. Bitte tragen Sie Ihre echten Preise ein und ändern Sie danach den Hinweis unten.')));
    wrap.appendChild(X.card('Überschrift & Hinweise', null,
      h('div', { class: 'fields' },
        X.tf('Überschrift', m, 'title', { max: 150, placeholder: 'Getränke & Speisen' }),
        X.tf('Einleitung', m, 'intro', { max: 1000, optional: true, multiline: true, rows: 2 }),
        X.tf('Hinweis unter der Karte', m, 'note', { max: 1000, optional: true, multiline: true, rows: 2, help: 'z. B. „Alle Preise in Euro inkl. MwSt.“' }))));
    if (!m.categories.length) wrap.appendChild(h('div', { class: 'empty' }, icon('beer'), h('p', null, 'Noch keine Kategorie. Legen Sie z. B. „Bier vom Fass“ an.')));
    m.categories.forEach(function (cat, ci) { wrap.appendChild(categoryCard(m, cat, ci)); });
    return wrap;
  }
  function rerender() { X.show(X.S.section, true); }
  function move(arr, i, d) { var j = i + d; if (j < 0 || j >= arr.length) return; var t = arr[i]; arr[i] = arr[j]; arr[j] = t; X.changed(); rerender(); }
  function priceOk(p) { return !p || /^\d{1,4}([.,]\d{1,2})?$/.test(String(p).trim()); }
  function priceText(p) {
    var s = String(p || '').trim().replace('.', ',');
    if (!s) return '';
    if (/^\d+$/.test(s)) s += ',00'; else if (/^\d+,\d$/.test(s)) s += '0';
    return s + ' €';
  }

  function categoryCard(m, cat, ci) {
    if (!Array.isArray(cat.items)) cat.items = [];
    var nameIn = X.input(cat, 'name', { max: 80, cls: 'x-cat-name', placeholder: 'z. B. Bier vom Fass' });
    var cardEl = h('section', { class: 'card x-cat' },
      h('div', { class: 'x-cat-head' },
        h('div', { class: 'x-cat-fields' }, X.field('Kategorie', nameIn), X.tf('Hinweis zur Kategorie', cat, 'note', { max: 300, optional: true, placeholder: 'z. B. Stuttgarter Hofbräu – frisch gezapft' })),
        h('div', { class: 'x-cat-tools' },
          X.btn('', 'up', function () { move(m.categories, ci, -1); }, 'btn-sm btn-icon', { 'aria-label': 'Kategorie nach oben', disabled: ci === 0 }),
          X.btn('', 'down', function () { move(m.categories, ci, 1); }, 'btn-sm btn-icon', { 'aria-label': 'Kategorie nach unten', disabled: ci === m.categories.length - 1 }),
          X.btn('', 'trash', function () {
            X.confirm('Kategorie „' + (cat.name || 'ohne Namen') + '“ mit ' + cat.items.length + ' Einträgen löschen?', { ok: 'Löschen', danger: true }).then(function (ok) {
              if (!ok) return;
              m.categories.splice(m.categories.indexOf(cat), 1); X.changed(); rerender();
              X.toast('Kategorie gelöscht. Zum Übernehmen „Speichern“ klicken.', 'info');
            });
          }, 'btn-sm btn-icon btn-danger', { 'aria-label': 'Kategorie löschen' }))));
    var list = h('ul', { class: 'x-items' });
    cat.items.forEach(function (it, ii) {
      if (typeof it.available !== 'boolean') it.available = true;
      var avail = X.toggle(it, 'available', 'Verfügbar', 'wird angezeigt', 'ausgeblendet', function () { row.classList.toggle('is-off', !it.available); });
      avail.classList.add('x-avail');
      var row = h('li', { class: 'x-item' + (it.available ? '' : ' is-off') },
        h('button', { type: 'button', class: 'x-item-main', onclick: function () { itemEditor(cat, it); }, 'aria-label': 'Bearbeiten: ' + (it.name || 'Eintrag') + ' ' + (it.size || '') },
          h('span', { class: 'x-item-name' }, it.name || '(ohne Namen)', it.badge ? h('span', { class: 'badge' }, it.badge) : null),
          h('span', { class: 'x-item-meta' }, [it.size, it.note].filter(Boolean).join(' · ')),
          h('span', { class: 'x-item-price' + (priceOk(it.price) ? '' : ' is-bad') }, priceOk(it.price) ? (priceText(it.price) || 'kein Preis') : 'Preis prüfen!')),
        h('div', { class: 'x-item-tools' }, avail,
          X.btn('', 'up', function () { move(cat.items, ii, -1); }, 'btn-sm btn-icon', { 'aria-label': 'Nach oben', disabled: ii === 0 }),
          X.btn('', 'down', function () { move(cat.items, ii, 1); }, 'btn-sm btn-icon', { 'aria-label': 'Nach unten', disabled: ii === cat.items.length - 1 }),
          X.btn('', 'edit', function () { itemEditor(cat, it); }, 'btn-sm btn-icon', { 'aria-label': 'Bearbeiten' })));
      list.appendChild(row);
    });
    cardEl.appendChild(list);
    cardEl.appendChild(h('div', { class: 'x-cat-foot' }, X.btn('Eintrag hinzufügen', 'plus', function () { itemEditor(cat, null); }, 'btn-sm')));
    return cardEl;
  }

  function itemEditor(cat, it) {
    var isNew = !it;
    var d = it ? JSON.parse(JSON.stringify(it)) : { name: '', size: '', price: '', note: '', badge: '', available: true };
    var nameIn = X.input(d, 'name', { max: 120, placeholder: 'z. B. Stuttgarter Hofbräu Pils', onInput: function () {} });
    var priceIn = X.input(d, 'price', { max: 12, inputmode: 'decimal', placeholder: 'z. B. 3,90', onInput: function () { priceIn.classList.toggle('invalid', !priceOk(d.price)); } });
    var err = h('div', { class: 'notice notice-danger', role: 'alert', hidden: true });
    var body = h('div', { class: 'fields' }, err,
      X.field('Name', nameIn),
      h('div', { class: 'grid-2' },
        X.field('Größe / Menge', X.input(d, 'size', { max: 30, placeholder: 'z. B. 0,5 l', onInput: function () {} }), { optional: true }),
        X.field('Preis in Euro', priceIn, { help: 'Nur die Zahl, z. B. 3,90 – das €-Zeichen kommt automatisch.' })),
      X.field('Kennzeichen', X.input(d, 'badge', { max: 30, placeholder: 'z. B. vom Fass, neu, alkoholfrei', onInput: function () {} }), { optional: true, help: 'Erscheint als kleines Schild neben dem Namen.' }),
      X.field('Hinweis', X.input(d, 'note', { max: 200, placeholder: 'z. B. hell oder dunkel', onInput: function () {} }), { optional: true }),
      X.toggle(d, 'available', 'Verfügbar', 'Wird auf der Website angezeigt', 'Zurzeit ausgeblendet (z. B. ausverkauft)', function () {}));
    var m = X.modal({
      title: isNew ? 'Neuer Eintrag' : 'Eintrag bearbeiten', body: body, backdropClose: false, focus: nameIn,
      foot: [
        !isNew ? h('button', { type: 'button', class: 'btn btn-danger', onclick: function () {
          X.confirm('„' + (it.name || 'Eintrag') + (it.size ? ' ' + it.size : '') + '“ löschen?', { ok: 'Löschen', danger: true }).then(function (ok) {
            if (!ok) return;
            cat.items.splice(cat.items.indexOf(it), 1); X.changed(); m.close(); rerender();
          });
        } }, icon('trash'), h('span', { class: 'lbl' }, 'Löschen')) : null,
        h('span', { class: 'spacer' }),
        h('button', { type: 'button', class: 'btn', onclick: function () { m.close(); } }, 'Abbrechen'),
        h('button', { type: 'button', class: 'btn btn-primary', onclick: function () {
          d.name = String(d.name || '').trim(); d.price = String(d.price || '').trim().replace('.', ',');
          var errs = [];
          if (!d.name) errs.push('Bitte einen Namen eingeben.');
          if (!priceOk(d.price)) errs.push('Der Preis muss eine Zahl sein, z. B. 3,90.');
          if (errs.length) { err.hidden = false; err.textContent = errs.join(' '); return; }
          var clean = { name: d.name, size: String(d.size || '').trim(), price: d.price, note: String(d.note || '').trim(), badge: String(d.badge || '').trim(), available: !!d.available };
          if (isNew) cat.items.push(clean); else cat.items[cat.items.indexOf(it)] = clean;
          X.changed(); m.close(); rerender();
          X.toast(isNew ? 'Eintrag hinzugefügt. Zum Veröffentlichen „Speichern“ klicken.' : 'Eintrag geändert. Zum Veröffentlichen „Speichern“ klicken.', 'info');
        } }, icon('check'), isNew ? 'Hinzufügen' : 'Übernehmen')
      ]
    });
  }

  /* ================================================================ Reiter: Reservierungen */

  var resFilter = 'offen';

  function renderRes() {
    var c = C();
    c.reservierung = Object.assign({}, SK.reservierung, c.reservierung || {});
    var list = h('div', { class: 'x-res-list', 'data-x-live': '1' }, h('p', { class: 'help' }, 'Anfragen werden geladen …'));
    var wrap = h('div', null, X.sectionHead('Reservierungen', 'Tisch-Anfragen von der Website. Rufen Sie den Gast an und setzen Sie dann den Status. Erst Ihr Anruf macht die Reservierung fest.',
      [X.btn('Aktualisieren', 'refresh', function () { list._refresh(); }, 'btn-sm')]),
      isDemo() ? h('div', { class: 'notice notice-info' }, icon('info'), h('div', null, h('strong', null, 'Demo – Anfragen werden nur hier simuliert. '), 'Im echten Betrieb kommen sie von der Website.',
        h('div', { class: 'x-row-btns' }, X.btn('Beispiel-Anfrage hinzufügen', 'plus', function () { demoAddSample(); list._refresh(); }, 'btn-sm'),
          X.btn('Demo-Daten zurücksetzen', 'refresh', function () { try { localStorage.removeItem(LS_DEMO); } catch (e) { /* egal */ } list._refresh(); }, 'btn-sm')))) : null,
      offNotice('reservierung', 'Die Tischreservierung'), liveHint(), list);
    list._refresh = function () {
      loadData().then(function () { drawResList(list); }, function (e) { list.replaceChildren(h('div', { class: 'notice notice-danger' }, icon('alert'), h('div', null, e.message))); });
    };
    list._refresh();
    wrap.appendChild(resSettings());
    return wrap;
  }

  function drawResList(list) {
    var all = (G.data && G.data.reservierungen) || [];
    var t = todayISO();
    var upcoming = all.filter(function (r) { return r.date >= t; });
    var past = all.filter(function (r) { return r.date < t; }).reverse();
    var count = function (st) { return upcoming.filter(function (r) { return st === 'offen' || r.status === st; }).length; };
    var filters = [['offen', 'Alle kommenden'], ['neu', 'Neu'], ['bestaetigt', 'Bestätigt'], ['abgelehnt', 'Abgelehnt']];
    var chips = h('div', { class: 'subnav x-filter', role: 'group', 'aria-label': 'Anfragen filtern' }, filters.map(function (f) {
      return h('button', { type: 'button', class: 'subnav-item', 'aria-current': resFilter === f[0] ? 'page' : null, onclick: function () { resFilter = f[0]; drawResList(list); } },
        f[1], h('span', { class: 'badge ' + (f[0] === 'neu' && count('neu') ? 'badge-warn' : 'badge-muted') }, String(count(f[0]))));
    }));
    var shown = upcoming.filter(function (r) { return resFilter === 'offen' || r.status === resFilter; });
    list.replaceChildren(chips);
    if (!shown.length) list.appendChild(h('div', { class: 'empty' }, icon('table'), h('p', null, resFilter === 'neu' ? 'Keine neuen Anfragen.' : 'Keine Anfragen in dieser Auswahl.')));
    shown.forEach(function (r) { list.appendChild(resCard(r, list)); });
    if (past.length) {
      list.appendChild(h('details', { class: 'past-box' },
        h('summary', null, h('span', { class: 'chev' }, icon('chevron')), 'Vergangene Anfragen', h('span', { class: 'badge badge-muted' }, String(past.length))),
        h('div', { class: 'past-inner' }, h('p', { class: 'help' }, 'Werden ' + ((G.data && G.data.deleteAfterDays) || 30) + ' Tage nach dem Termin automatisch gelöscht.'),
          past.map(function (r) { return resCard(r, list, true); }))));
    }
  }

  function resCard(r, list, isPast) {
    var f = fdate(r.date);
    var st = h('div', { class: 'x-seg', role: 'radiogroup', 'aria-label': 'Status' }, STATUS.map(function (s) {
      return h('button', { type: 'button', role: 'radio', class: 'x-seg-btn x-st-' + s[0], 'aria-checked': r.status === s[0] ? 'true' : 'false', onclick: function () {
        if (r.status === s[0]) return;
        update(r, { status: s[0] }, list, s[0] === 'bestaetigt' ? 'Als bestätigt markiert.' : s[0] === 'abgelehnt' ? 'Als abgelehnt markiert.' : 'Wieder auf „neu“ gesetzt.');
      } }, s[0] === 'bestaetigt' ? icon('check') : s[0] === 'abgelehnt' ? icon('x') : icon('info'), s[1]);
    }));
    var calledId = nid();
    var called = h('input', { type: 'checkbox', id: calledId });
    called.checked = !!r.called;
    called.addEventListener('change', function () { update(r, { called: called.checked }, list, called.checked ? 'Vermerkt: Gast angerufen.' : 'Vermerk entfernt.'); });
    var note = h('textarea', { rows: 2, maxlength: 1000, placeholder: 'Interne Notiz, z. B. „Tisch 3“ – sieht nur die Verwaltung' });
    note.value = r.internalNote || '';
    var saveNote = X.btn('Notiz speichern', 'save', function () { update(r, { internalNote: note.value }, list, 'Notiz gespeichert.'); }, 'btn-sm');
    saveNote.hidden = true;
    note.addEventListener('input', function () { saveNote.hidden = note.value === (r.internalNote || ''); });
    return h('article', { class: 'card x-res x-res-' + r.status + (isPast ? ' is-past' : '') },
      h('div', { class: 'x-res-top' },
        h('div', { class: 'ev-date', 'aria-hidden': 'true' }, h('span', { class: 'd' }, f.day), h('span', { class: 'm' }, f.mon), h('span', { class: 'w' }, f.wd)),
        h('div', { class: 'x-res-main' },
          h('p', { class: 'x-res-when' }, f.long + ', ' + r.time + ' Uhr'),
          h('p', { class: 'x-res-who' }, h('strong', null, r.name), ' · ', h('span', { class: 'x-persons' }, icon('users'), r.persons + (r.persons === 1 ? ' Person' : ' Personen'))),
          r.anlass ? h('p', { class: 'x-res-line' }, icon('ball'), 'Spiel: ' + r.anlass) : null,
          r.note ? h('p', { class: 'x-res-line x-res-note' }, '„' + r.note + '“') : null,
          r.email ? h('p', { class: 'x-res-line' }, 'E-Mail: ', h('a', { href: 'mailto:' + r.email }, r.email)) : null,
          h('p', { class: 'x-res-meta' }, 'Eingegangen ' + fdt(r.created))),
        h('a', { class: 'btn btn-primary x-call', href: tel(r.phone), 'aria-label': 'Anrufen: ' + r.phone }, icon('phone'), h('span', null, r.phone))),
      h('div', { class: 'x-res-actions' }, st,
        h('label', { class: 'x-checkrow x-called', for: calledId }, called, h('span', null, 'Gast angerufen'))),
      h('div', { class: 'x-res-note-edit' }, X.field('Interne Notiz', note, { optional: true }), saveNote),
      h('div', { class: 'x-res-foot' }, X.btn('Anfrage löschen', 'trash', function () {
        X.confirm('Anfrage von ' + r.name + ' (' + f.short + ' ' + r.time + ' Uhr) endgültig löschen?', { ok: 'Löschen', danger: true }).then(function (ok) {
          if (!ok) return;
          call('admin_res_delete', { id: r.id }).then(function (x) { setCounts(x.counts); X.toast('Anfrage gelöscht.', 'success'); list._refresh(); }, function (e) { X.toast(e.message, 'error'); });
        });
      }, 'btn-sm btn-danger')));
  }

  function update(r, patch, list, msg) {
    var body = Object.assign({ id: r.id }, patch);
    call('admin_res_update', body).then(function (x) {
      setCounts(x.counts);
      Object.assign(r, x.reservierung || patch);
      X.toast(msg, 'success', 2500);
      drawResList(list);
    }, function (e) { X.toast(e.message, 'error'); drawResList(list); });
  }

  var SK = {
    reservierung: { title: 'Tisch anfragen', text: '', maxPersons: 12, leadHours: 3, maxDaysAhead: 60, useOpeningHours: true, deleteAfterDays: 30, successText: '', privacyText: '', consentText: '', notifyEmail: false, notifyAddress: '' },
    anmeldung: { maxPersons: 6, successText: '', privacyText: '', consentText: '', notifyEmail: false, notifyAddress: '' }
  };

  function mailFields(o) {
    var addr = X.tf('E-Mail-Adresse für den Hinweis', o, 'notifyAddress', { type: 'email', max: 150, autocomplete: 'email', placeholder: 'wirt@beispiel.de' });
    addr.hidden = !o.notifyEmail;
    return [
      X.toggle(o, 'notifyEmail', 'Hinweis per E-Mail', 'Bei jeder neuen Anfrage kommt eine kurze E-Mail', 'Keine E-Mail (Standard)', function (on) { addr.hidden = !on; }),
      addr,
      h('p', { class: 'help x-mailhelp' }, 'Die E-Mail nennt nur Tag, Uhrzeit und Personen – Name und Telefonnummer stehen aus Datenschutzgründen nur hier in der Verwaltung. Achtung: Der E-Mail-Versand über PHP (mail) funktioniert nicht bei jedem Hoster. Schauen Sie deshalb trotzdem regelmäßig hier nach.')
    ];
  }

  function resSettings() {
    var r = C().reservierung;
    var days = (C().openingHours || []).map(function (d) { return d.day + ': ' + d.hours; }).join(' · ');
    return h('details', { class: 'card x-settings' },
      h('summary', null, icon('settings'), 'Einstellungen für das Anfrage-Formular'),
      contentHint(),
      h('div', { class: 'fields' },
        X.tf('Überschrift', r, 'title', { max: 150, placeholder: 'Tisch anfragen' }),
        X.tf('Text über dem Formular', r, 'text', { multiline: true, rows: 3, max: 2000, optional: true }),
        h('div', { class: 'grid-2' },
          X.field('Höchstens Personen pro Anfrage', intInput(r, 'maxPersons', 1, 200), { help: 'Größere Gruppen sollen anrufen.' }),
          X.field('Vorlauf in Stunden', intInput(r, 'leadHours', 0, 336), { help: 'z. B. 3 = frühestens in 3 Stunden.' }),
          X.field('Höchstens Tage im Voraus', intInput(r, 'maxDaysAhead', 1, 365)),
          X.field('Automatisch löschen nach (Tagen)', intInput(r, 'deleteAfterDays', 1, 365), { help: 'Tage nach dem Termin. Standard 30.' })),
        X.toggle(r, 'useOpeningHours', 'Nur zu den Öffnungszeiten', 'Tage und Uhrzeiten wie unter „Öffnungszeiten“ (Ruhetage gesperrt)', 'Jeder Tag, 10–24 Uhr'),
        h('p', { class: 'help' }, 'Aktuelle Öffnungszeiten: ' + days),
        X.tf('Text nach dem Absenden', r, 'successText', { multiline: true, rows: 2, max: 1000, optional: true }),
        X.tf('Datenschutz-Hinweis am Formular', r, 'privacyText', { multiline: true, rows: 3, max: 2000 }),
        X.tf('Text neben dem Häkchen', r, 'consentText', { multiline: true, rows: 2, max: 500 }),
        mailFields(r),
        privacySuggestion()));
  }

  function privacySuggestion() {
    var has = function () { return String((C().datenschutz || {}).text || '').indexOf('Tischanfragen und Anmeldungen:') >= 0; };
    var b = X.btn(has() ? 'Schon in der Datenschutzerklärung' : 'In die Datenschutzerklärung übernehmen', 'file', function () {
      if (has()) return;
      var d = C().datenschutz = C().datenschutz || { text: '' };
      var txt = String(d.text || '');
      var marker = '\n\nSie haben das Recht auf Auskunft';
      var i = txt.indexOf(marker);
      d.text = i >= 0 ? txt.slice(0, i) + '\n\n' + PRIVACY_SNIPPET + txt.slice(i) : txt + '\n\n' + PRIVACY_SNIPPET;
      X.changed();
      b.disabled = true; b.querySelector('.lbl').textContent = 'Übernommen – bitte „Speichern“';
      X.toast('Absatz eingefügt (Bereich „Datenschutz“). Zum Veröffentlichen „Speichern“ klicken.', 'info');
    }, 'btn-sm', { disabled: has() });
    return h('div', { class: 'notice notice-info' }, icon('shield'), h('div', null,
      h('strong', null, 'Datenschutzerklärung ergänzen: '), 'Wenn Sie Anfragen oder Anmeldungen einschalten, sollte die Datenschutzerklärung einen Absatz dazu enthalten. Vorschlag (bitte rechtlich prüfen lassen):',
      h('p', { class: 'x-snippet' }, PRIVACY_SNIPPET), b));
  }

  /* ================================================================ Reiter: Anmeldungen */

  function renderAnm() {
    var c = C();
    c.anmeldung = Object.assign({}, SK.anmeldung, c.anmeldung || {});
    var list = h('div', { class: 'x-anm-list', 'data-x-live': '1' }, h('p', { class: 'help' }, 'Anmeldungen werden geladen …'));
    var wrap = h('div', null, X.sectionHead('Anmeldungen', 'Wer hat sich für welche Veranstaltung angemeldet? „Anmeldung möglich“ schalten Sie im Termin ein (Reiter „Termine“ → Termin bearbeiten).',
      [X.btn('Aktualisieren', 'refresh', function () { list._refresh(); }, 'btn-sm'), X.btn('Zu den Terminen', 'calendar', function () { X.go('termine'); }, 'btn-sm')]),
      isDemo() ? h('div', { class: 'notice notice-info' }, icon('info'), h('div', null, h('strong', null, 'Demo – Anmeldungen werden nur hier simuliert. '), 'Im echten Betrieb kommen sie von der Website.')) : null,
      offNotice('anmeldung', 'Die Anmeldung zu Veranstaltungen'), liveHint(), list);
    list._refresh = function () {
      loadData().then(function () {
        drawAnmList(list);
        if (G.counts.anmNeu) call('admin_anm_seen', {}).then(function (x) { setCounts(x.counts); }, function () { /* egal */ });
      }, function (e) { list.replaceChildren(h('div', { class: 'notice notice-danger' }, icon('alert'), h('div', null, e.message))); });
    };
    list._refresh();
    wrap.appendChild(anmSettings());
    return wrap;
  }

  function drawAnmList(list) {
    var all = (G.data && G.data.anmeldungen) || [];
    var t = todayISO();
    var groups = {}, order = [];
    (C().events || []).filter(function (e) { return e.signup && e.date >= t; }).sort(function (a, b) { return (a.date + a.time).localeCompare(b.date + b.time); }).forEach(function (e) {
      groups[e.id] = { ev: e, id: e.id, title: e.title, date: e.date, rows: [] }; order.push(e.id);
    });
    all.forEach(function (a) {
      if (!groups[a.event]) { var ev = (C().events || []).filter(function (e) { return e.id === a.event; })[0] || null; groups[a.event] = { ev: ev, id: a.event, title: ev ? ev.title : a.eventTitle, date: ev ? ev.date : a.eventDate, rows: [] }; order.push(a.event); }
      groups[a.event].rows.push(a);
    });
    order.sort(function (a, b) { return String(groups[a].date).localeCompare(String(groups[b].date)); });
    list.replaceChildren();
    if (!order.length) {
      list.appendChild(h('div', { class: 'empty' }, icon('ticket'), h('p', null, 'Noch kein Termin mit Anmeldung.'), h('p', { class: 'help' }, 'Unter „Termine“ einen Termin öffnen und „Anmeldung möglich“ einschalten.'), X.btn('Zu den Terminen', 'calendar', function () { X.go('termine'); }, 'btn-primary')));
      return;
    }
    order.forEach(function (id) { list.appendChild(anmCard(groups[id], list)); });
  }

  function anmCard(g, list) {
    var f = fdate(g.date);
    var taken = g.rows.reduce(function (s, a) { return s + (+a.persons || 0); }, 0);
    var max = g.ev && g.ev.signupMax > 0 ? g.ev.signupMax : 0;
    var past = g.date < todayISO();
    var state = !g.ev ? 'Termin gelöscht' : !g.ev.signup ? 'Anmeldung ausgeschaltet' : max ? taken + ' von ' + max + ' Plätzen belegt' + (taken >= max ? ' – ausgebucht' : ' – noch ' + (max - taken) + ' frei') : taken + (taken === 1 ? ' Person' : ' Personen') + ' angemeldet (ohne Begrenzung)';
    var rows = g.rows.map(function (a) {
      return h('li', { class: 'x-anm-row' + (a.seen ? '' : ' is-new') },
        h('div', { class: 'x-anm-who' }, h('strong', null, a.name), a.seen ? null : h('span', { class: 'badge badge-warn' }, 'Neu'),
          h('span', { class: 'x-anm-meta' }, (a.persons === 1 ? '1 Person' : a.persons + ' Personen') + ' · angemeldet ' + fdt(a.created))),
        h('a', { class: 'btn btn-sm x-anm-tel', href: tel(a.phone), 'aria-label': 'Anrufen: ' + a.name + ', ' + a.phone }, icon('phone'), a.phone),
        X.btn('', 'trash', function () {
          X.confirm(a.name + ' (' + a.persons + (a.persons === 1 ? ' Person' : ' Personen') + ') von „' + g.title + '“ abmelden und löschen?', { ok: 'Entfernen', danger: true }).then(function (ok) {
            if (!ok) return;
            call('admin_anm_delete', { id: a.id }).then(function (x) { setCounts(x.counts); X.toast('Anmeldung entfernt.', 'success'); list._refresh(); }, function (e) { X.toast(e.message, 'error'); });
          });
        }, 'btn-sm btn-icon btn-danger', { 'aria-label': 'Entfernen: ' + a.name }));
    });
    return h('section', { class: 'card x-anm' + (past ? ' is-past' : '') },
      h('div', { class: 'x-res-top' },
        h('div', { class: 'ev-date', 'aria-hidden': 'true' }, h('span', { class: 'd' }, f.day), h('span', { class: 'm' }, f.mon), h('span', { class: 'w' }, f.wd)),
        h('div', { class: 'x-res-main' },
          h('h3', { class: 'x-anm-title' }, g.title || '(ohne Titel)'),
          h('p', { class: 'x-res-when' }, f.long + (g.ev && g.ev.time ? ', ' + g.ev.time + ' Uhr' : '')),
          h('p', { class: 'x-anm-state' + (max && taken >= max ? ' is-full' : '') }, state),
          g.ev && g.ev.signupDeadline ? h('p', { class: 'x-res-meta' }, 'Anmeldeschluss: ' + fdate(g.ev.signupDeadline).long) : null)),
      rows.length ? h('ul', { class: 'x-anm-rows' }, rows) : h('p', { class: 'help' }, 'Noch keine Anmeldungen.'),
      h('div', { class: 'x-row-btns' },
        X.btn('Liste drucken', 'printer', function () { printList(g); }, 'btn-sm', { disabled: !rows.length }),
        X.btn('Als Datei speichern', 'download', function () { csvList(g); }, 'btn-sm', { disabled: !rows.length })));
  }

  function printList(g) {
    var f = fdate(g.date);
    var total = g.rows.reduce(function (s, a) { return s + (+a.persons || 0); }, 0);
    var area = h('div', { class: 'x-print-area' },
      h('h1', null, g.title), h('p', null, f.long + (g.ev && g.ev.time ? ', ' + g.ev.time + ' Uhr' : '') + ' · ' + total + (total === 1 ? ' Person' : ' Personen')),
      h('table', null, h('thead', null, h('tr', null, h('th', null, 'Nr.'), h('th', null, 'Name'), h('th', null, 'Telefon'), h('th', null, 'Personen'), h('th', null, 'Da'))),
        h('tbody', null, g.rows.map(function (a, i) { return h('tr', null, h('td', null, String(i + 1)), h('td', null, a.name), h('td', null, a.phone), h('td', null, String(a.persons)), h('td', null, '☐')); }))),
      h('p', { class: 'x-print-foot' }, 'Teilnehmerliste – nur für interne Zwecke. Nach der Veranstaltung vernichten.'));
    document.body.appendChild(area);
    document.body.classList.add('x-printing');
    var done = function () { document.body.classList.remove('x-printing'); area.remove(); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(function () { window.print(); setTimeout(done, 1500); }, 50);
  }

  function csvList(g) {
    var q = function (v) { v = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
    var lines = [['Veranstaltung', 'Datum', 'Name', 'Telefon', 'Personen', 'Angemeldet am'].map(q).join(';')];
    g.rows.forEach(function (a) { lines.push([g.title, g.date, a.name, a.phone, a.persons, a.created].map(q).join(';')); });
    var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = h('a', { href: url, download: 'anmeldungen-' + String(g.id || 'termin').replace(/[^\w-]+/g, '-') + '.csv' });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    X.toast('Datei gespeichert (öffnet sich z. B. mit Excel).', 'success');
  }

  function anmSettings() {
    var a = C().anmeldung;
    return h('details', { class: 'card x-settings' },
      h('summary', null, icon('settings'), 'Einstellungen für das Anmelde-Formular'),
      contentHint(),
      h('div', { class: 'fields' },
        X.field('Höchstens Personen pro Anmeldung', intInput(a, 'maxPersons', 1, 50), { help: 'Wie viele Plätze ein Gast auf einmal buchen darf.' }),
        X.tf('Text nach dem Anmelden', a, 'successText', { multiline: true, rows: 2, max: 1000, optional: true }),
        X.tf('Datenschutz-Hinweis am Formular', a, 'privacyText', { multiline: true, rows: 3, max: 2000 }),
        X.tf('Text neben dem Häkchen', a, 'consentText', { multiline: true, rows: 2, max: 500 }),
        h('p', { class: 'help' }, 'Anmeldungen werden eine Woche nach der Veranstaltung automatisch gelöscht.'),
        mailFields(a),
        privacySuggestion()));
  }

  /* ================================================================ Termin-Editor: „Anmeldung möglich“ */

  function eventFields(draft) {
    var on = !!draft.signup;
    var more = h('div', { class: 'fields x-ev-more', hidden: !on });
    var maxObj = { v: typeof draft.signupMax === 'number' ? draft.signupMax : 0 };
    var maxIn = intInput(maxObj, 'v', 0, 10000, { onInput: function (v) { draft.signupMax = v; } });
    var dl = h('input', { type: 'date' });
    dl.value = draft.signupDeadline || '';
    dl.addEventListener('input', function () { draft.signupDeadline = dl.value || ''; });
    var noteIn = X.input(draft, 'signupNote', { max: 500, placeholder: 'z. B. Bitte bis Mittwoch anmelden – wir planen das Essen.', onInput: function () {} });
    more.appendChild(h('div', { class: 'grid-2' },
      X.field('Höchstens Teilnehmer', maxIn, { help: '0 = ohne Begrenzung. Bei Begrenzung zeigt die Website „noch X Plätze frei“ bzw. „ausgebucht“.' }),
      X.field('Anmeldeschluss', dl, { optional: true, help: 'Leer = bis zum Beginn.' })));
    more.appendChild(X.field('Hinweis für Gäste', noteIn, { optional: true }));
    var sw = X.toggle({ v: on }, 'v', 'Anmeldung möglich', 'Gäste können sich auf der Website anmelden', 'Keine Anmeldung', function (val) {
      draft.signup = val;
      if (val) {
        if (typeof draft.signupMax !== 'number') draft.signupMax = maxObj.v;
        if (typeof draft.signupDeadline !== 'string') draft.signupDeadline = '';
        if (typeof draft.signupNote !== 'string') draft.signupNote = '';
      }
      more.hidden = !val;
    });
    return h('div', { class: 'x-ev-signup' }, sw,
      !features().anmeldung ? h('p', { class: 'help x-warn' }, 'Hinweis: Die Funktion „Anmeldung zu Veranstaltungen“ ist unter „Funktionen“ ausgeschaltet – Gäste sehen den Knopf erst, wenn Sie sie einschalten.') : null,
      more);
  }

  /* ================================================================ Anmeldung bei admin.js */

  function insertAfter(list, afterId, item) {
    if (list.some(function (s) { return s.id === item.id; })) return;
    var i = -1;
    list.forEach(function (s, k) { if (s.id === afterId) i = k; });
    list.splice(i >= 0 ? i + 1 : list.length, 0, item);
  }
  function insertBefore(list, beforeId, item) {
    if (list.some(function (s) { return s.id === item.id; })) return;
    var i = -1;
    list.forEach(function (s, k) { if (s.id === beforeId) i = k; });
    list.splice(i >= 0 ? i : list.length, 0, item);
  }

  function init(ctx) {
    X = ctx;
    Object.keys(ICONS).forEach(function (k) { if (!ctx.ICONS[k]) ctx.ICONS[k] = ICONS[k]; });
    // Inhaltsbereiche, die die Verwaltung beim Laden/Speichern mitführt (Standardwerte für ältere Inhalte)
    Object.assign(ctx.SKELETON, {
      features: Object.assign({}, FEATURE_DEFAULTS),
      speisekarte: { title: 'Getränke & Speisen', intro: '', note: '', categories: [] },
      reservierung: Object.assign({}, SK.reservierung),
      anmeldung: Object.assign({}, SK.anmeldung),
      programm: { title: 'Diese Woche live bei uns', text: '', competitions: [], days: 7 }
    });
    insertAfter(ctx.SECTIONS, 'termine', { id: 'reservierungen', label: 'Reservierungen', icon: 'table', render: renderRes });
    insertAfter(ctx.SECTIONS, 'reservierungen', { id: 'anmeldungen', label: 'Anmeldungen', icon: 'ticket', render: renderAnm });
    insertAfter(ctx.SECTIONS, 'galerie', { id: 'speisekarte', label: 'Speisekarte', icon: 'beer', render: renderMenu });
    insertBefore(ctx.SECTIONS, 'einstellungen', { id: 'funktionen', label: 'Funktionen', icon: 'toggle', render: renderFeatures });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchApp); else watchApp();
  }

  window.HBS_ADMIN_EXT = { init: init, eventFields: eventFields };
})();
