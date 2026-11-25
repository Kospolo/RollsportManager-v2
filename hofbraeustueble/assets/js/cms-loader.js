/*!
 * Hofbräustüble – gemeinsamer CMS-Loader für alle Design-Varianten.
 * Lädt cms/content.json und stellt Hilfsfunktionen bereit (window.HBS).
 *
 * Reihenfolge der Datenquellen:
 *  1. window.HBS_INLINE_CONTENT (falls gesetzt – z. B. für Offline-Vorschau)
 *  2. localStorage "hbs_demo_content", NUR wenn das Admin-Panel im Demo-Modus
 *     lief (localStorage "hbs_demo_mode" === "1", also ohne PHP-Server)
 *  3. <root>/cms/content.json (Standard auf dem echten Webserver)
 */
(function () {
  'use strict';

  // Projekt-Wurzel aus der eigenen Script-URL ableiten (…/assets/js/cms-loader.js)
  var self = document.currentScript && document.currentScript.src;
  var ROOT = self ? self.replace(/assets\/js\/cms-loader\.js(\?.*)?$/, '') : '../';

  function asset(path) {
    if (!path) return '';
    if (/^(https?:|data:|blob:|\/)/.test(path)) return path;
    return ROOT + path.replace(/^\.?\//, '');
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Mehrzeiligen Text sicher als <p>-Absätze ausgeben
  function paragraphs(str) {
    return String(str || '').split(/\n{2,}/).map(function (p) {
      return '<p>' + escapeHtml(p).replace(/\n/g, '<br>') + '</p>';
    }).join('');
  }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // Nur kommende (inkl. heute) Termine, chronologisch sortiert
  function upcomingEvents(content, limit) {
    var t = todayISO();
    var list = (content.events || []).filter(function (e) { return e.date && e.date >= t; })
      .sort(function (a, b) { return (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')); });
    return limit ? list.slice(0, limit) : list;
  }

  var MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  var MONTHS_LONG = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  var WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

  // "2026-12-31" -> { day:"31", month:"Dez", monthLong:"Dezember", year:"2026", weekday:"Donnerstag", long:"Donnerstag, 31. Dezember 2026" }
  function formatDate(iso) {
    var p = String(iso || '').split('-');
    if (p.length !== 3) return { day: '', month: '', monthLong: '', year: '', weekday: '', long: iso || '' };
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    var wd = WEEKDAYS[d.getDay()];
    return {
      day: String(+p[2]), month: MONTHS[+p[1] - 1], monthLong: MONTHS_LONG[+p[1] - 1], year: p[0], weekday: wd,
      long: wd + ', ' + (+p[2]) + '. ' + MONTHS_LONG[+p[1] - 1] + ' ' + p[0]
    };
  }

  // Index (0–6) des heutigen Eintrags in openingHours (Liste beginnt mit Montag)
  function todayHoursIndex() { return (new Date().getDay() + 6) % 7; }

  function fullAddress(c) {
    c = c || {};
    return [c.street, [c.zip, c.city].filter(Boolean).join(' ') + (c.district ? '-' + c.district : '')].filter(Boolean).join(', ');
  }

  function telHref(phone) { return 'tel:' + String(phone || '').replace(/[^\d+]/g, ''); }

  function load() {
    if (window.HBS_INLINE_CONTENT) return Promise.resolve(window.HBS_INLINE_CONTENT);
    try {
      if (localStorage.getItem('hbs_demo_mode') === '1') {
        var demo = localStorage.getItem('hbs_demo_content');
        if (demo) return Promise.resolve(JSON.parse(demo));
      }
    } catch (e) { /* localStorage evtl. gesperrt */ }
    return fetch(ROOT + 'cms/content.json?v=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  }

  /* ================================================================
   * Zusatzfunktionen (Funktionen-Schalter, Speisekarte, Tisch-Anfrage,
   * Anmeldung zu Terminen, Fußball-Programm). Reine Hilfsfunktionen –
   * das Aussehen bauen die Design-Varianten selbst (variante-x/extras.js).
   * ================================================================ */

  var FEATURE_DEFAULTS = { tippspiel: true, team: true, reservierung: false, speisekarte: true, anmeldung: false, programm: true, preise: false, kasse: false };

  /** Schalter aus content.features (fehlende Werte → Standard) */
  function features(c) {
    var f = (c && c.features && typeof c.features === 'object') ? c.features : {};
    var out = {};
    Object.keys(FEATURE_DEFAULTS).forEach(function (k) { out[k] = typeof f[k] === 'boolean' ? f[k] : FEATURE_DEFAULTS[k]; });
    return out;
  }

  /** Entfernt alle Elemente mit data-feature="x", deren Funktion ausgeschaltet ist (z. B. Menüpunkte). */
  function applyFeatures(c, root) {
    var f = features(c);
    Array.prototype.slice.call((root || document).querySelectorAll('[data-feature]')).forEach(function (el) {
      var keys = String(el.getAttribute('data-feature')).split(/\s+/);
      if (keys.some(function (k) { return f.hasOwnProperty(k) && !f[k]; })) el.remove();
    });
    return f;
  }

  /** Vorschau ohne PHP (Demo der Verwaltung im selben Browser)? */
  function isDemo() {
    try { return localStorage.getItem('hbs_demo_mode') === '1'; } catch (e) { return false; }
  }

  function pad2(n) { return String(n).padStart(2, '0'); }
  function isoOf(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function hhmm(min) { return pad2(Math.floor(min / 60) % 24) + ':' + pad2(min % 60); }

  /** "16:00 – 01:00" → [[960, 1500]]; "Ruhetag" → []; nicht auswertbar → null (gleiche Regeln wie gast-api.php) */
  function parseHours(str) {
    var s = String(str || '').trim();
    if (!s) return null;
    var re = /(\d{1,2})(?:[:.](\d{2}))?\s*(?:uhr)?\s*(?:–|—|-|bis)\s*(\d{1,2})(?:[:.](\d{2}))?/gi;
    var out = [], m;
    while ((m = re.exec(s))) {
      var o = +m[1] * 60 + (+m[2] || 0), c = +m[3] * 60 + (+m[4] || 0);
      if (o > 1440 || c > 1440) continue;
      if (c <= o) c += 1440;
      out.push([o, c]);
    }
    if (out.length) return out;
    if (/ruhetag|geschlossen|zu\b|closed/i.test(s)) return [];
    return null;
  }

  var RES_DEFAULTS = { title: 'Tisch anfragen', text: '', maxPersons: 12, leadHours: 3, maxDaysAhead: 60, useOpeningHours: true, deleteAfterDays: 30, successText: '', privacyText: '', consentText: 'Ich bin einverstanden, dass meine Angaben zur Bearbeitung der Anfrage gespeichert werden.' };
  var ANM_DEFAULTS = { maxPersons: 6, successText: '', privacyText: '', consentText: 'Ich bin einverstanden, dass meine Angaben für die Anmeldung gespeichert werden.' };
  function merge(def, obj) {
    var out = {};
    Object.keys(def).forEach(function (k) { out[k] = obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== '' ? obj[k] : def[k]; });
    return out;
  }
  function reservationSettings(c) { return merge(RES_DEFAULTS, c && c.reservierung); }
  function signupSettings(c) { return merge(ANM_DEFAULTS, c && c.anmeldung); }

  /**
   * Erlaubte Uhrzeiten (30-Minuten-Schritte) für eine Tisch-Anfrage an einem Tag – nach Öffnungszeiten,
   * Vorlaufzeit und „höchstens N Tage im Voraus“. → { open: bool, reason: '', times: ['16:00', …] }
   */
  function reservationTimes(c, iso, now) {
    var s = reservationSettings(c);
    now = now || new Date();
    var p = String(iso || '').split('-');
    if (p.length !== 3) return { open: false, reason: 'Bitte ein Datum wählen.', times: [] };
    var day = new Date(+p[0], +p[1] - 1, +p[2]);
    var last = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (+s.maxDaysAhead || 60));
    if (day > last) return { open: false, reason: 'Zu weit in der Zukunft.', times: [] };
    var ranges = null;
    var hours = Array.isArray(c && c.openingHours) && c.openingHours.length === 7 ? c.openingHours : null;
    if (s.useOpeningHours !== false && hours) ranges = parseHours(hours[(day.getDay() + 6) % 7] && hours[(day.getDay() + 6) % 7].hours);
    if (ranges && !ranges.length) return { open: false, reason: 'Ruhetag', times: [] };
    var slots = [];
    (ranges || [[10 * 60, 24 * 60]]).forEach(function (r) {
      var end = Math.min(r[1] - 30, 23 * 60 + 30);
      for (var t = Math.ceil(r[0] / 30) * 30; t <= end; t += 30) if (slots.indexOf(t) < 0) slots.push(t);
    });
    slots.sort(function (a, b) { return a - b; });
    var earliest = now.getTime() + (+s.leadHours || 0) * 3600e3;
    var times = slots.filter(function (t) {
      return new Date(+p[0], +p[1] - 1, +p[2], Math.floor(t / 60), t % 60).getTime() >= earliest;
    }).map(hhmm);
    return { open: times.length > 0, reason: times.length ? '' : (slots.length ? 'Zu kurzfristig' : 'Geschlossen'), times: times };
  }

  /** Tage, an denen eine Anfrage möglich ist: [{ iso, label, times }] */
  function reservationDays(c, now) {
    var s = reservationSettings(c);
    now = now || new Date();
    var out = [];
    for (var i = 0; i <= (+s.maxDaysAhead || 60); i++) {
      var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      var iso = isoOf(d);
      var r = reservationTimes(c, iso, now);
      if (!r.open) continue;
      var f = formatDate(iso);
      out.push({ iso: iso, label: (i === 0 ? 'Heute, ' : i === 1 ? 'Morgen, ' : f.weekday + ', ') + f.day + '. ' + f.monthLong + (d.getFullYear() !== now.getFullYear() ? ' ' + f.year : ''), times: r.times });
    }
    return out;
  }

  /** Preis "3,2" / "3.20" → "3,20 €" (leer → "") */
  function formatPrice(p) {
    var s = String(p == null ? '' : p).trim().replace('.', ',');
    if (!s) return '';
    if (/^\d+$/.test(s)) s += ',00';
    else if (/^\d+,\d$/.test(s)) s += '0';
    return s + ' €';
  }

  /**
   * Speisekarte für die Anzeige: nur verfügbare Einträge; aufeinanderfolgende Einträge mit gleichem Namen
   * werden zu einer Zeile mit mehreren Größen zusammengefasst (Pils 0,3 l / 0,5 l).
   */
  function menuCategories(c) {
    var m = (c && c.speisekarte) || {};
    return (Array.isArray(m.categories) ? m.categories : []).map(function (cat) {
      var rows = [];
      (Array.isArray(cat && cat.items) ? cat.items : []).forEach(function (it) {
        if (!it || !it.name || it.available === false) return;
        var prev = rows[rows.length - 1];
        var v = { size: it.size || '', price: formatPrice(it.price) };
        if (prev && prev.name === it.name && (prev.note || '') === (it.note || '') && (prev.badge || '') === (it.badge || '')) prev.variants.push(v);
        else rows.push({ name: it.name, note: it.note || '', badge: it.badge || '', variants: [v] });
      });
      return { name: (cat && cat.name) || '', note: (cat && cat.note) || '', rows: rows };
    }).filter(function (cat) { return cat.rows.length; });
  }

  /* ---------------------------------------------------------------- Gäste-Schnittstelle (cms/gast-api.php) */

  function PreviewError() { this.preview = true; this.message = 'In der Vorschau werden keine Anfragen verschickt.'; }
  PreviewError.prototype = Object.create(Error.prototype);

  /**
   * Aufruf von cms/gast-api.php. Antwortet der Server nicht mit der erwarteten Schnittstelle (statische Vorschau
   * ohne PHP, Datei-Ansicht), wird mit {preview: true} abgelehnt. Fehler des Servers: {message, field, code, status}.
   */
  function gast(action, data) {
    if (location.protocol === 'file:') return Promise.reject(new PreviewError());
    var init = { method: data ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } };
    if (data) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(data); }
    return fetch(ROOT + 'cms/gast-api.php?action=' + encodeURIComponent(action), init).then(function (r) {
      return r.text().then(function (txt) {
        var j = null;
        try { j = JSON.parse(txt); } catch (e) { /* kein JSON */ }
        if (!j || j.api !== 'hbs-gast') throw new PreviewError();
        if (!r.ok || j.ok === false) {
          var err = new Error(j.error || 'Das hat leider nicht geklappt. Bitte rufen Sie uns an.');
          err.field = j.field || ''; err.code = j.code || ''; err.status = r.status; err.free = j.free;
          throw err;
        }
        return j;
      });
    }, function () {
      var err = new Error('Keine Verbindung. Bitte prüfen Sie Ihre Internetverbindung und versuchen Sie es noch einmal.');
      err.offline = true;
      throw err;
    });
  }

  /** Formular-Zeitstempel holen (beim Öffnen des Formulars) */
  function gastToken() { return gast('token').then(function (j) { return j.token; }); }

  /** Freie Plätze der Termine mit Anmeldung: { <eventId>: {max, taken, free, open, reason} } oder null (Vorschau) */
  function signupStatus() {
    return gast('plaetze').then(function (j) { return j.events || {}; }, function () { return null; });
  }

  /** Termine, für die man sich anmelden kann (Schalter „Anmeldung möglich“) */
  function signupEnabled(c, ev) { return features(c).anmeldung && !!(ev && ev.signup === true); }

  /* ---------------------------------------------------------------- Fußball-Programm (cms/programm-api.php) */

  function demoProgramm() {
    var now = new Date(), d = function (add, h, m) { var x = new Date(now.getFullYear(), now.getMonth(), now.getDate() + add, h, m); return isoOf(x) + ' ' + hhmm(h * 60 + m); };
    return { ok: true, enabled: true, available: true, demo: true, matches: [
      { competition: 'Bundesliga (Beispiel)', kickoff: d(1, 20, 30), home: 'VfB Stuttgart', away: 'FC Bayern München' },
      { competition: 'Bundesliga (Beispiel)', kickoff: d(3, 15, 30), home: 'TSG Hoffenheim', away: 'Borussia Dortmund' },
      { competition: 'Champions League (Beispiel)', kickoff: d(5, 21, 0), home: 'Real Madrid', away: 'Bayer 04 Leverkusen' }
    ] };
  }

  /** Spiele der nächsten Tage → {enabled, available, matches:[{competition, kickoff, home, away, home_logo, away_logo}]} oder null */
  function programm() {
    if (location.protocol === 'file:') return Promise.resolve(isDemo() ? demoProgramm() : null);
    return fetch(ROOT + 'cms/programm-api.php', { credentials: 'same-origin', headers: { Accept: 'application/json' } }).then(function (r) {
      return r.text().then(function (txt) {
        var j = null;
        try { j = JSON.parse(txt); } catch (e) { /* kein JSON */ }
        if (!j || j.api !== 'hbs-programm') return isDemo() ? demoProgramm() : null;
        return j;
      });
    }, function () { return isDemo() ? demoProgramm() : null; });
  }

  /** "2026-11-28 15:30" → { iso, time, dayLabel: "Heute" | "Morgen" | "Samstag, 28. November" } */
  function formatKickoff(k) {
    var m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/.exec(String(k || ''));
    if (!m) return { iso: '', time: '', dayLabel: '' };
    var t = todayISO(), now = new Date();
    var tm = isoOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
    var f = formatDate(m[1]);
    var rest = f.weekday + ', ' + f.day + '. ' + f.monthLong;
    return { iso: m[1], time: m[2], dayLabel: m[1] === t ? 'Heute · ' + rest : m[1] === tm ? 'Morgen · ' + rest : rest };
  }

  window.HBS = {
    ROOT: ROOT,
    load: load,
    asset: asset,
    escapeHtml: escapeHtml,
    paragraphs: paragraphs,
    upcomingEvents: upcomingEvents,
    formatDate: formatDate,
    todayHoursIndex: todayHoursIndex,
    fullAddress: fullAddress,
    telHref: telHref,
    // Zusatzfunktionen
    FEATURE_DEFAULTS: FEATURE_DEFAULTS,
    features: features,
    applyFeatures: applyFeatures,
    isDemo: isDemo,
    todayISO: todayISO,
    parseHours: parseHours,
    reservationSettings: reservationSettings,
    signupSettings: signupSettings,
    reservationTimes: reservationTimes,
    reservationDays: reservationDays,
    formatPrice: formatPrice,
    menuCategories: menuCategories,
    gast: gast,
    gastToken: gastToken,
    signupStatus: signupStatus,
    signupEnabled: signupEnabled,
    programm: programm,
    formatKickoff: formatKickoff
  };
})();
