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
    telHref: telHref
  };
})();
