/*
 * Hofbräustüble – Team-Client  (window.TeamAPI)
 * Vertrag: team/SPEC.md
 *
 *   await TeamAPI.init({ base: '../cms/team-api.php' })
 *   TeamAPI.mode                      // 'live' | 'demo'
 *   await TeamAPI.call(action, data)  // wirft Error(message) mit .status und .data bei ok:false
 *   TeamAPI.me / .chef / .enabled / .settings
 *   TeamAPI.demoReset()               // Demo-Daten neu erzeugen
 *   TeamAPI.demoSetChef(true|false)   // Demo: Chef „anmelden“ (sessionStorage; auch per URL ?chef=1)
 *   TeamAPI.demoLoginAs(id)           // Demo: als Mitarbeiter anmelden (ohne Passwort)
 *
 * Live-Modus: fetch auf cms/team-api.php (Cookies, X-CSRF-Token; Chef-Aktionen mit dem CSRF der Verwaltung).
 * Demo-Modus: Nachbildung im Browser (localStorage "hbs_team_demo_v1") mit denselben Regeln – keine Netzwerkanfragen.
 */
(function (global) {
  'use strict';

  var DEMO_KEY = 'hbs_team_demo_v1';
  var DEMO_VERSION = 1;
  var DEMO_MAX_AGE_MS = 2 * 24 * 3600 * 1000; // ältere Demo-Daten neu erzeugen (Plan bleibt „diese/nächste Woche“)
  var DEMO_CHEF_KEY = 'hbs_team_demo_chef';
  var DEMO_PASSWORD = 'demo1234';
  var MODULES = ['availability', 'swap', 'tasks', 'hours', 'board', 'ical', 'orders'];
  var DEFAULT_SETTINGS = {
    modules: { availability: true, swap: true, tasks: true, hours: true, board: true, ical: true, orders: true },
    swap_needs_chef: true, take_needs_ok: false, minijob_limit_cents: 60300,
    labels: ['Theke', 'Aufbau', 'Putzen', 'Veranstaltung']
  };
  var ORDER_CATS = ['getraenke', 'kueche', 'putzmittel', 'sonstiges'];
  var ABSENCE_TYPES = ['urlaub', 'krank', 'sonstiges'];
  var INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var PW_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
  var NAME_RE = /^[\p{L}][\p{L} .'\-]*$/u;
  var PHONE_RE = /^\+?[0-9 ()\/\-]{4,30}$/;
  var GET_ACTIONS = { status: 1, invite_check: 1, staff_data: 1, chef_data: 1, chef_hours: 1, chef_thread: 1 };
  var MSG_MAX = 1000;

  /* ================================================================ Hilfen */

  function ApiError(message, status, data) {
    var e = new Error(message);
    e.status = status || 400;
    e.data = data || { ok: false, error: message };
    return e;
  }
  function fail(message, status, extra) {
    var data = { ok: false, api: 'hbs-team', error: message };
    if (extra) for (var k in extra) data[k] = extra[k];
    throw ApiError(message, status || 400, data);
  }
  function clone(x) { return x === undefined ? undefined : JSON.parse(JSON.stringify(x)); }
  function lower(s) { return String(s).toLowerCase(); }
  function strLen(s) { return Array.from(String(s)).length; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function cents(c) { return c === null || c === undefined ? null : Math.round(c) / 100; }

  /* ================================================================== Zeit */

  function berlinNow(date) {
    date = date || new Date();
    try {
      var f = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      });
      var p = {};
      f.formatToParts(date).forEach(function (x) { p[x.type] = x.value; });
      return p.year + '-' + p.month + '-' + p.day + ' ' + (p.hour === '24' ? '00' : p.hour) + ':' + p.minute + ':' + p.second;
    } catch (e) {
      return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + ' ' +
        pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' + pad(date.getSeconds());
    }
  }
  function today() { return berlinNow().slice(0, 10); }
  /** Berliner Wanduhrzeit als UTC-Zahl („naiv“) */
  function naiveMs(str) {
    var m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(str);
    return Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  }
  function fmtDate(ms) { var d = new Date(ms); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
  function fmtFull(ms) { var d = new Date(ms); return fmtDate(ms) + ' ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds()); }
  function addDays(date, n) { return fmtDate(naiveMs(date) + n * 86400000); }
  function daysBetween(a, b) { return Math.round((naiveMs(b) - naiveMs(a)) / 86400000); }
  function mondayOf(date) { var d = new Date(naiveMs(date)); var wd = (d.getUTCDay() + 6) % 7; return addDays(date, -wd); }
  function monthEnd(month) { var y = +month.slice(0, 4), m = +month.slice(5, 7); return month + '-' + pad(new Date(Date.UTC(y, m, 0)).getUTCDate()); }
  function nextMonth(month) { var y = +month.slice(0, 4), m = +month.slice(5, 7) + 1; if (m > 12) { m = 1; y++; } return y + '-' + pad(m); }

  /** Schichtgrenzen (naiv, Ende über Mitternacht → Folgetag) */
  function shiftBounds(date, start, end) {
    var s = naiveMs(date + ' ' + start);
    var e = naiveMs((end <= start ? addDays(date, 1) : date) + ' ' + end);
    return [s, Math.max(e, s + 60000)];
  }
  function shiftMinutes(sh) { var b = shiftBounds(sh.date, sh.start, sh.end); return Math.round((b[1] - b[0]) / 60000); }
  function nowMs() { return naiveMs(berlinNow()); }
  function isPast(sh) { return shiftBounds(sh.date, sh.start, sh.end)[1] < nowMs(); }

  /* ============================================================ Validierung */

  function vInt(v, min, max, label) {
    var n;
    if (typeof v === 'number' && Math.floor(v) === v) n = v;
    else if (typeof v === 'string' && /^\s*-?\d{1,9}\s*$/.test(v)) n = parseInt(v, 10);
    else fail(label + ': bitte eine ganze Zahl angeben.');
    if (n < min || n > max) fail(label + ' muss zwischen ' + min + ' und ' + max + ' liegen.');
    return n;
  }
  function vId(v, label) { return vInt(v, 1, 2147483647, label || 'ID'); }
  function vBool(v, label) {
    if (v === true || v === 1 || v === '1' || v === 'true') return true;
    if (v === false || v === 0 || v === '0' || v === 'false') return false;
    fail(label + ': ungültiger Wert (ja/nein erwartet).');
  }
  function vStr(v, min, max, label, multiline) {
    if (v === null || v === undefined) v = '';
    if (typeof v === 'number') v = String(v);
    if (typeof v !== 'string') fail(label + ': ungültiger Text.');
    v = v.replace(/\r\n?/g, '\n').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F​-‏‪-‮⁦-⁩﻿]/g, '');
    v = multiline ? v.replace(/\t/g, ' ').replace(/\n{3,}/g, '\n\n') : v.replace(/\s+/g, ' ');
    v = v.trim();
    var len = strLen(v);
    if (len < min) fail(min <= 1 ? 'Bitte ' + label + ' ausfüllen.' : label + ' muss mindestens ' + min + ' Zeichen lang sein.');
    if (len > max) fail(label + ' ist zu lang (höchstens ' + max + ' Zeichen).');
    return v;
  }
  function checkDate(y, m, d) { var dt = new Date(Date.UTC(y, m - 1, d)); return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d; }
  function vDate(v, label) {
    var m = typeof v === 'string' && /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
    if (m && checkDate(+m[1], +m[2], +m[3]) && +m[1] >= 2000 && +m[1] <= 2100) return v.trim();
    fail((label || 'Datum') + ': bitte ein gültiges Datum wählen.');
  }
  function vTime(v, label) {
    var m = typeof v === 'string' && /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(v.trim());
    if (m) return pad(+m[1]) + ':' + m[2];
    fail(label + ': bitte eine Uhrzeit wie 18:00 angeben.');
  }
  function vMoney(v, label, maxCents) {
    if (v === null || v === undefined || v === '') return null;
    var f;
    if (typeof v === 'number') f = v;
    else {
      var m = typeof v === 'string' && /^\s*(\d{1,6})(?:[.,](\d{1,2}))?\s*(€|eur)?\s*$/i.exec(v);
      if (!m) fail(label + ': bitte einen Betrag wie 13,90 angeben.');
      f = parseFloat(m[1] + '.' + ((m[2] || '0') + '0').slice(0, 2));
    }
    var c = Math.round(f * 100);
    if (c < 0 || c > maxCents) fail(label + ' ist nicht plausibel.');
    return c;
  }
  function vName(v) {
    var n = vStr(v, 2, 30, 'dein Name');
    if (!NAME_RE.test(n)) fail('Der Name darf nur Buchstaben, Leerzeichen, Punkt und Bindestrich enthalten.');
    return n;
  }
  function vPhone(v) {
    var p = vStr(v, 0, 30, 'Telefonnummer');
    if (p === '') return null;
    if (!PHONE_RE.test(p)) fail('Die Telefonnummer sieht nicht richtig aus (nur Ziffern, Leerzeichen, + - / ( )).');
    return p;
  }
  function vNewPassword(v, label) {
    label = label || 'Das Passwort';
    if (typeof v !== 'string') fail(label + ' ist ungültig.');
    if (strLen(v) < 8) fail(label + ' muss mindestens 8 Zeichen lang sein.');
    if (v.length > 200) fail(label + ' ist zu lang (höchstens 200 Zeichen).');
    return v;
  }
  function normCode(v) {
    if (typeof v !== 'string') return '';
    var c = v.replace(/[\s\-]+/g, '').toUpperCase();
    return /^[A-Z0-9]{4,16}$/.test(c) ? c : '';
  }
  function present(d, k) { return d[k] !== undefined && d[k] !== null && d[k] !== ''; }
  function randomString(alphabet, len) {
    var out = '', buf = new Uint32Array(len);
    try { global.crypto.getRandomValues(buf); } catch (e) { for (var j = 0; j < len; j++) buf[j] = Math.floor(Math.random() * 4294967296); }
    for (var i = 0; i < len; i++) out += alphabet[buf[i] % alphabet.length];
    return out;
  }
  function hex(n) { return randomString('0123456789abcdef', n); }

  /* ============================================================ Live-Modus */

  var state = {
    mode: null, base: '../cms/team-api.php', csrf: null, chefCsrf: null, me: null, chef: false, enabled: true,
    settings: null, status: null
  };

  function buildQuery(data) {
    var parts = [];
    Object.keys(data || {}).forEach(function (k) {
      var v = data[k];
      if (v === undefined || v === null) return;
      parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(v)));
    });
    return parts.length ? '&' + parts.join('&') : '';
  }

  function rememberStatus(res) {
    if (res && res.api === 'hbs-team' && 'me' in res) {
      state.me = res.me || null;
      state.csrf = res.csrf || null;
      if ('chef' in res) { state.chef = !!res.chef; state.chefCsrf = res.chefCsrf || null; }
      if ('enabled' in res) state.enabled = res.enabled !== false;
      if (res.settings) state.settings = res.settings;
      state.status = res;
    }
  }

  async function liveFetch(action, data, timeoutMs) {
    var isGet = !!GET_ACTIONS[action];
    var url = state.base + (state.base.indexOf('?') >= 0 ? '&' : '?') + 'action=' + encodeURIComponent(action) + (isGet ? buildQuery(data) : '');
    var headers = { 'Accept': 'application/json' };
    var opts = { method: isGet ? 'GET' : 'POST', credentials: 'same-origin', headers: headers, cache: 'no-store' };
    if (!isGet) {
      headers['Content-Type'] = 'application/json';
      var token = action.indexOf('chef_') === 0 ? state.chefCsrf : state.csrf;
      if (token) headers['X-CSRF-Token'] = token;
      opts.body = JSON.stringify(data || {});
    }
    var ctrl = null, timer = null;
    if (timeoutMs && typeof AbortController !== 'undefined') {
      ctrl = new AbortController();
      opts.signal = ctrl.signal;
      timer = setTimeout(function () { ctrl.abort(); }, timeoutMs);
    }
    try {
      var resp = await fetch(url, opts);
      var text = await resp.text();
      var json = null;
      try { json = JSON.parse(text); } catch (e) { json = null; }
      return { http: resp.status, json: json };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function liveCall(action, data) {
    var r;
    try {
      r = await liveFetch(action, data, 20000);
    } catch (e) {
      throw ApiError('Keine Verbindung zum Server. Bitte prüf dein Internet und versuch es noch mal.', 0);
    }
    var j = r.json;
    if (!j || typeof j !== 'object') throw ApiError('Der Server hat eine ungültige Antwort geschickt.', r.http || 500);
    if (!j.ok) {
      if (r.http === 401 && j.chef) { state.chef = false; state.chefCsrf = null; }
      else if (r.http === 401 && action.indexOf('chef_') !== 0) { state.me = null; state.csrf = null; }
      if (r.http === 403 && j.teamDisabled) state.enabled = false;
      throw ApiError(j.error || 'Unbekannter Fehler.', r.http, j);
    }
    if (action === 'status' || action === 'login' || action === 'register') rememberStatus(j);
    if (action === 'logout' || action === 'delete_account') { state.me = null; state.csrf = null; }
    if ((action === 'profile_save' || action === 'ical_reset') && j.me) state.me = j.me;
    if (action === 'chef_settings_save' && j.settings) state.settings = publicSettings(j.settings);
    return j;
  }

  /* ============================================================ Demo-Modus */

  var memoryStore = null;
  var demoDb = null;
  var demoChefMem = false;

  function storageGet() { try { return global.localStorage ? global.localStorage.getItem(DEMO_KEY) : null; } catch (e) { return null; } }
  function storageSet(str) {
    try { if (global.localStorage) { global.localStorage.setItem(DEMO_KEY, str); return true; } } catch (e) { /* voll/gesperrt */ }
    return false;
  }
  function demoHash(pw) { // nur Demo – keine echte Kryptografie
    var h = 0x811c9dc5, s = 'hbs-team-demo|' + pw;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return 'demo$' + h.toString(16);
  }

  function demoChef() {
    try { if (global.location && /[?&]chef=1(&|$)/.test(global.location.search || '')) demoSetChef(true); } catch (e) { /* kein location */ }
    try { if (global.sessionStorage) return global.sessionStorage.getItem(DEMO_CHEF_KEY) === '1'; } catch (e) { /* gesperrt */ }
    return demoChefMem;
  }
  function demoSetChef(on) {
    demoChefMem = !!on;
    try { if (global.sessionStorage) { if (on) global.sessionStorage.setItem(DEMO_CHEF_KEY, '1'); else global.sessionStorage.removeItem(DEMO_CHEF_KEY); } } catch (e) { /* Tab */ }
    if (state.mode === 'demo') { state.chef = !!on; state.chefCsrf = on ? 'demo-chef' : null; }
    return !!on;
  }
  function demoTeamEnabled() {
    try { return !(global.location && /[?&]teamaus=1(&|$)/.test(global.location.search || '')); } catch (e) { return true; }
  }

  function emptyDb() {
    return {
      v: DEMO_VERSION, seededAt: Date.now(), session: null,
      seq: { staff: 0, shifts: 0, absences: 0, swaps: 0, messages: 0, board: 0, checklists: 0, orders: 0, catalog: 0 },
      settings: clone(DEFAULT_SETTINGS), staff: [], invites: [], shifts: [], takes: [], absences: [], availability: [],
      swaps: [], messages: [], board: [], board_reads: [], checklists: [], checks: [], orders: [], catalog: []
    };
  }

  function seedDb() {
    var db = emptyDb();
    var now = berlinNow();
    var t = now.slice(0, 10);
    var created = addDays(t, -40) + ' 10:00:00';
    var names = ['Anja', 'Mehmet', 'Sabine', 'Jonas', 'Gerda'];
    var wages = [1390, 1450, 1390, 1500, 1390];
    var phones = ['0171 2345678', '0160 9876543', null, '0152 1112223', '07132 45678'];
    names.forEach(function (n, i) {
      db.staff.push({ id: i + 1, name: n, password_hash: demoHash(DEMO_PASSWORD), phone: phones[i], phone_visible: i === 0 || i === 4 ? 1 : 0,
        active: 1, wage_cents: wages[i], limit_cents: null, ical_token: hex(64), created: created, last_login: addDays(t, -1) + ' 18:00:00' });
    });
    db.seq.staff = names.length;
    db.invites.push({ code: 'DEMOTEAM', note: 'Aushilfe Weihnachtsmarkt', expires: addDays(t, 14), used_by: null, used_at: null, revoked: 0, created: addDays(t, -2) + ' 12:00:00' });

    var nowIso = now;
    function addShift(date, start, end, label, staff, response, extra) {
      var sh = { id: ++db.seq.shifts, date: date, start: start, end: end, label: label, note: '', staff_id: staff || null,
        response: response || 'none', reason: '', responded_at: response && response !== 'none' ? nowIso : null, needs_ok: 0, former: 0,
        series_id: null, created: created, updated: created };
      if (extra) for (var k in extra) sh[k] = extra[k];
      db.shifts.push(sh);
      return sh;
    }
    // Plan: vom Monatsanfang (für die Stunden) bis Ende nächster Woche
    var w0 = mondayOf(t), w1 = addDays(w0, 7), endPlan = addDays(w1, 6);
    var start = t.slice(0, 8) + '01'; if (start > w0) start = w0;
    var rot = [4, 1, 2, 4, 3, 1, 5, 4, 1, 2, 4, 3]; // Jonas (4) arbeitet viel → Minijob-Warnung
    var k = 0;
    for (var d = start; d <= endPlan; d = addDays(d, 1)) {
      var wd = (new Date(naiveMs(d)).getUTCDay() + 6) % 7; // 0 = Montag
      if (wd === 6) { // Sonntag: Putzen
        addShift(d, '11:00', '13:00', 'Putzen', rot[(k++) % rot.length], d < t ? 'yes' : 'yes');
        continue;
      }
      if (wd === 0) continue; // Montag Ruhetag
      var late = (wd === 4 || wd === 5) ? '03:00' : '01:00';
      var a = rot[(k++) % rot.length], b = rot[(k++) % rot.length];
      if (a === b) b = (b % 5) + 1;
      addShift(d, '17:00', '22:00', 'Theke', a, 'yes');
      addShift(d, '22:00', late, 'Theke', b, 'yes');
    }
    // heute: Anja steht gerade hinter der Theke (für Aufgaben abhaken)
    var nowH = +now.slice(11, 13);
    var sH = Math.max(0, nowH - 1), eH = (sH + 5) % 24;
    db.shifts = db.shifts.filter(function (s) { return !(s.date === t && s.staff_id === 1); });
    var todayShift = addShift(t, pad(sH) + ':00', pad(eH) + ':00', 'Theke', 1, 'yes', { note: 'Heute bitte die neue Kasse ausprobieren' });
    // Zukunft etwas gemischter: unbeantwortet, abgesagt, offen
    var future = db.shifts.filter(function (s) { return s.date > t && s.label === 'Theke'; });
    future.forEach(function (s, i) {
      if (i % 4 === 1) { s.response = 'none'; s.responded_at = null; }
    });
    var anjaFuture = future.filter(function (s) { return s.staff_id === 1; });
    if (anjaFuture.length) { anjaFuture[0].response = 'none'; anjaFuture[0].responded_at = null; }
    var sab = future.filter(function (s) { return s.staff_id === 3; });
    if (sab.length) { sab[0].response = 'no'; sab[0].reason = 'Arzttermin, sorry!'; }
    // offene Schichten
    var fri1 = addDays(w1, 4), sat1 = addDays(w1, 5);
    addShift(fri1, '19:00', '23:00', 'Theke', null, 'none', { note: 'Verstärkung fürs Dart-Turnier' });
    var openOk = addShift(sat1, '14:00', '17:00', 'Aufbau', null, 'none', { needs_ok: 1, note: 'Bühne & Bierbänke für die Live-Musik' });
    addShift(sat1, '19:00', '02:00', 'Veranstaltung', 2, 'yes', { note: 'Live-Musik „Die Amorbacher“' });
    db.takes.push({ shift_id: openOk.id, staff_id: 4, created: addDays(t, -1) + ' 20:15:00' });
    db.seq.shifts = db.shifts.length ? Math.max.apply(null, db.shifts.map(function (s) { return s.id; })) : 0;

    // Abwesenheiten
    db.absences.push({ id: 1, staff_id: 3, date_from: addDays(w1, 1), date_to: addDays(w1, 3), type: 'urlaub', note: 'Kurzurlaub an der Ostsee', status: 'pending', chef_comment: '', created: addDays(t, -1) + ' 09:30:00', decided_at: null });
    db.absences.push({ id: 2, staff_id: 5, date_from: addDays(w1, 3), date_to: addDays(w1, 5), type: 'urlaub', note: 'Enkel besuchen', status: 'approved', chef_comment: 'Viel Spaß!', created: addDays(t, -20) + ' 11:00:00', decided_at: addDays(t, -19) + ' 08:00:00' });
    db.absences.push({ id: 3, staff_id: 1, date_from: addDays(t, 21), date_to: addDays(t, 24), type: 'urlaub', note: '', status: 'approved', chef_comment: '', created: addDays(t, -10) + ' 11:00:00', decided_at: addDays(t, -9) + ' 08:00:00' });
    db.seq.absences = 3;
    // Gerda bleibt trotz Urlaub eingeteilt → Konflikt-Hinweis
    var gerdaConflict = db.shifts.filter(function (s) { return s.date >= addDays(w1, 3) && s.date <= addDays(w1, 5) && s.label === 'Theke'; })[0];
    if (gerdaConflict) { gerdaConflict.staff_id = 5; gerdaConflict.response = 'none'; }

    // Verfügbarkeit
    for (var i = 0; i < 28; i++) {
      var day = addDays(t, i);
      var wdd = (new Date(naiveMs(day)).getUTCDay() + 6) % 7;
      if (wdd === 4) db.availability.push({ staff_id: 1, date: day, value: 'yes' });
      if (wdd === 5) db.availability.push({ staff_id: 1, date: day, value: 'maybe' });
      if (wdd === 2) db.availability.push({ staff_id: 2, date: day, value: 'no' });
      if (wdd === 5 || wdd === 4) db.availability.push({ staff_id: 4, date: day, value: 'yes' });
      if (wdd === 1) db.availability.push({ staff_id: 5, date: day, value: 'no' });
    }

    // Tausch: Mehmet bietet eine Schicht nächste Woche allen an
    var meh = db.shifts.filter(function (s) { return s.staff_id === 2 && s.date >= w1 && s.label === 'Theke' && s.response !== 'no'; })[0];
    if (meh) db.swaps.push({ id: ++db.seq.swaps, shift_id: meh.id, from_staff: 2, to_staff: null, taker_id: null, status: 'offered', note: 'Hab Familienfeier – wer kann?', created: addDays(t, -1) + ' 13:00:00', updated: addDays(t, -1) + ' 13:00:00' });

    // Nachrichten
    function msg(staff, chef, body, when, read) { db.messages.push({ id: ++db.seq.messages, staff_id: staff, from_chef: chef ? 1 : 0, body: body, created: when, read_at: read ? when : null }); }
    msg(1, true, 'Hallo Anja, kannst du nächste Woche am Freitag die Spätschicht übernehmen?', addDays(t, -2) + ' 10:12:00', true);
    msg(1, false, 'Ja, mach ich gern!', addDays(t, -2) + ' 11:40:00', true);
    msg(1, true, 'Super, danke dir! Denk heute bitte an die neue Kasse.', addDays(t, 0) + ' 09:05:00', false);
    msg(2, false, 'Ich komme am Freitag ca. 15 Minuten später, Bus fährt nicht.', addDays(t, 0) + ' 08:20:00', false);
    msg(5, true, 'Gute Besserung, Gerda!', addDays(t, -5) + ' 12:00:00', true);

    // Schwarzes Brett
    db.board.push({ id: 1, title: 'Neue Kasse', body: 'Ab Montag haben wir die neue Kasse. Kurze Einweisung am Montag um 16 Uhr – bitte kommt alle kurz vorbei.', created: addDays(t, -3) + ' 15:00:00' });
    db.board.push({ id: 2, title: 'Weihnachtsfeier', body: 'Unsere Team-Weihnachtsfeier ist am Sonntag, 20.12., ab 18 Uhr im Stüble. Partner sind herzlich willkommen!', created: addDays(t, -1) + ' 19:00:00' });
    db.seq.board = 2;
    [2, 3, 5].forEach(function (s) { db.board_reads.push({ post_id: 1, staff_id: s, read_at: addDays(t, -2) + ' 18:00:00' }); });
    db.board_reads.push({ post_id: 2, staff_id: 4, read_at: addDays(t, 0) + ' 07:30:00' });

    // Checklisten
    db.checklists.push({ id: 1, name: 'Schichtende Theke', label: 'Theke', items: [
      { id: 'kasse01', text: 'Kasse zählen und Zettel ausfüllen' }, { id: 'fass002', text: 'Fass prüfen, ggf. wechseln' },
      { id: 'wc00003', text: 'Toiletten kontrollieren' }, { id: 'asche04', text: 'Aschenbecher leeren' }, { id: 'licht05', text: 'Licht, Heizung und Musik aus' }],
      created: created });
    db.checklists.push({ id: 2, name: 'Putzen', label: 'Putzen', items: [
      { id: 'boden01', text: 'Boden wischen' }, { id: 'theke02', text: 'Theke und Tische abwischen' }, { id: 'glas003', text: 'Gläser spülen' }], created: created });
    db.seq.checklists = 2;
    db.checks.push({ shift_id: todayShift.id, checklist_id: 1, item_id: 'asche04', staff_id: 1, done_at: now });

    // Bestellliste
    var cat = [['Hofbräu Export', 'getraenke', '2 Kisten'], ['Hofbräu Original (Fass 30 l)', 'getraenke', '1 Fass'], ['Cola', 'getraenke', '1 Kiste'],
      ['Apfelschorle', 'getraenke', '1 Kiste'], ['Brezeln', 'kueche', '20 Stück'], ['Erdnüsse', 'kueche', '1 Karton'],
      ['Spülmittel Gläser', 'putzmittel', '1 Kanister'], ['Toilettenpapier', 'putzmittel', '1 Paket'], ['Bierdeckel', 'sonstiges', '1 Karton'], ['Feuerzeuge', 'sonstiges', '1 Box']];
    cat.forEach(function (c, i) { db.catalog.push({ id: i + 1, name: c[0], category: c[1], qty: c[2] }); });
    db.seq.catalog = cat.length;
    db.orders.push({ id: 1, name: 'Hofbräu Export', qty: '2 Kisten', note: '', category: 'getraenke', catalog_id: 1, status: 'low', created_by: 2, by_chef: 0, created: addDays(t, -1) + ' 23:10:00', updated: addDays(t, -1) + ' 23:10:00' });
    db.orders.push({ id: 2, name: 'Toilettenpapier', qty: '1 Paket', note: '', category: 'putzmittel', catalog_id: 8, status: 'ordered', created_by: 5, by_chef: 0, created: addDays(t, -3) + ' 12:00:00', updated: addDays(t, -2) + ' 09:00:00' });
    db.orders.push({ id: 3, name: 'Erdnüsse', qty: '1 Karton', note: '', category: 'kueche', catalog_id: 6, status: 'delivered', created_by: 1, by_chef: 0, created: addDays(t, -6) + ' 12:00:00', updated: addDays(t, -4) + ' 09:00:00' });
    db.orders.push({ id: 4, name: 'Dartpfeile Ersatzspitzen', qty: '', note: 'die weichen', category: 'sonstiges', catalog_id: null, status: 'low', created_by: 4, by_chef: 0, created: addDays(t, 0) + ' 01:15:00', updated: addDays(t, 0) + ' 01:15:00' });
    db.seq.orders = 4;
    return db;
  }

  function demoLoad() {
    var raw = storageGet(), parsed = null;
    if (raw) { try { parsed = JSON.parse(raw); } catch (e) { parsed = null; } }
    if (!parsed) parsed = demoDb || memoryStore;
    if (!parsed || parsed.v !== DEMO_VERSION || !(Date.now() - (parsed.seededAt || 0) < DEMO_MAX_AGE_MS)) {
      demoDb = seedDb();
      demoSave();
      return demoDb;
    }
    demoDb = parsed;
    return demoDb;
  }
  function demoSave() {
    var str = JSON.stringify(demoDb);
    if (!storageSet(str)) memoryStore = JSON.parse(str);
  }
  function demoReset() {
    demoDb = seedDb();
    demoSave();
    if (state.mode === 'demo') { state.me = null; state.csrf = null; }
    return true;
  }

  /* --------------------------------------------------- Demo: gemeinsame Logik */

  function publicSettings(s) {
    return { modules: clone(s.modules), swap_needs_chef: !!s.swap_needs_chef, take_needs_ok: !!s.take_needs_ok, labels: clone(s.labels), minijob_limit: cents(s.minijob_limit_cents) };
  }

  function makeDemo(db) {
    var S = db.settings;
    var nowFull = berlinNow();
    var T = nowFull.slice(0, 10);
    function modOn(m) { return !!S.modules[m]; }
    function reqMod(m) { if (!modOn(m)) fail('Diese Funktion ist zurzeit ausgeschaltet.', 403, { module: m }); }
    function names() { var o = {}; db.staff.forEach(function (s) { o[s.id] = s.name; }); return o; }
    function staffById(id) { for (var i = 0; i < db.staff.length; i++) if (db.staff[i].id === id) return db.staff[i]; return null; }
    function staffOr404(id) { var s = staffById(id); if (!s) fail('Mitarbeiter nicht gefunden.', 404); return s; }
    function shiftById(id) { for (var i = 0; i < db.shifts.length; i++) if (db.shifts[i].id === id) return db.shifts[i]; return null; }
    function shiftOr404(id) { var s = shiftById(id); if (!s) fail('Schicht nicht gefunden.', 404); return s; }
    function limitOf(st) { return st.limit_cents !== null && st.limit_cents !== undefined ? st.limit_cents : S.minijob_limit_cents; }
    function absText(t) { return { urlaub: 'Urlaub', krank: 'krank', sonstiges: 'abwesend' }[t] || 'abwesend'; }
    function sortShifts(a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : a.start < b.start ? -1 : a.start > b.start ? 1 : a.id - b.id; }
    function inRange(from, to) { return db.shifts.filter(function (s) { return s.date >= from && s.date <= to; }).sort(sortShifts); }
    function inviteValid(i) { return !i.revoked && !i.used_at && (!i.expires || T <= i.expires); }
    function inviteOut(i) { return { code: i.code, note: i.note, expires: i.expires, used: !!i.used_at, used_at: i.used_at, used_by: i.used_by, revoked: !!i.revoked, created: i.created, valid: inviteValid(i) }; }

    function listsFor(sh) { return db.checklists.filter(function (c) { return c.label === '' || lower(c.label) === lower(sh.label); }); }
    function tasksOf(sh, nm) {
      var out = [], done = 0, total = 0;
      listsFor(sh).forEach(function (c) {
        var items = c.items.map(function (it) {
          var ck = db.checks.filter(function (x) { return x.shift_id === sh.id && x.checklist_id === c.id && x.item_id === it.id; })[0];
          total++; if (ck) done++;
          return { id: it.id, text: it.text, done: !!ck, by: ck && ck.staff_id ? (nm[ck.staff_id] || null) : null, at: ck ? ck.done_at : null };
        });
        out.push({ id: c.id, name: c.name, items: items });
      });
      return { lists: out, done: done, total: total };
    }
    function conflicts(sh, withAvail) {
      var out = [];
      if (!sh.staff_id || sh.response === 'no') return out;
      var b1 = shiftBounds(sh.date, sh.start, sh.end);
      db.shifts.forEach(function (o) {
        if (o.id === sh.id || o.staff_id !== sh.staff_id || o.response === 'no') return;
        if (Math.abs(daysBetween(o.date, sh.date)) > 1) return;
        var b2 = shiftBounds(o.date, o.start, o.end);
        if (b1[0] < b2[1] && b2[0] < b1[1]) out.push({ type: 'overlap', text: 'Überschneidet sich mit einer anderen Schicht (' + o.start + '–' + o.end + ')', shift_id: o.id });
      });
      db.absences.forEach(function (a) {
        if (a.staff_id !== sh.staff_id || a.date_from > sh.date || a.date_to < sh.date) return;
        if (a.status === 'approved') out.push({ type: 'absence', text: 'Ist an dem Tag ' + absText(a.type) + ' (genehmigt)' });
        else if (a.status === 'pending') out.push({ type: 'absence_pending', text: 'Hat für den Tag ' + (a.type === 'urlaub' ? 'Urlaub' : 'frei') + ' beantragt' });
      });
      if (withAvail) {
        var av = db.availability.filter(function (x) { return x.staff_id === sh.staff_id && x.date === sh.date; })[0];
        if (av && av.value === 'no') out.push({ type: 'unavailable', text: 'Hat „kann nicht“ eingetragen' });
        else if (av && av.value === 'maybe') out.push({ type: 'maybe', text: 'Hat „vielleicht“ eingetragen' });
        var st = staffById(sh.staff_id);
        if (st && !st.active) out.push({ type: 'inactive', text: 'Konto ist deaktiviert' });
      }
      return out;
    }
    function activeSwap(shiftId) { return db.swaps.filter(function (w) { return w.shift_id === shiftId && (w.status === 'offered' || w.status === 'accepted'); })[0] || null; }
    function swapOut(w, nm, viewer) {
      return { id: w.id, shift_id: w.shift_id, from_staff: w.from_staff, from_name: nm[w.from_staff] || '?', to_staff: w.to_staff, to_name: w.to_staff ? (nm[w.to_staff] || '?') : null,
        taker_id: w.taker_id, taker_name: w.taker_id ? (nm[w.taker_id] || '?') : null, status: w.status, note: w.note, created: w.created, updated: w.updated,
        mine: viewer !== null && w.from_staff === viewer, for_me: viewer !== null && w.from_staff !== viewer && (w.to_staff === null || w.to_staff === viewer) };
    }
    function shiftLite(s) { return s ? { id: s.id, date: s.date, start: s.start, end: s.end, label: s.label } : null; }
    function shiftOut(sh, viewer, nm) {
      var reqs = db.takes.filter(function (x) { return x.shift_id === sh.id; }).sort(function (a, b) { return a.created < b.created ? -1 : 1; });
      var mine = viewer !== null && sh.staff_id === viewer;
      var o = { id: sh.id, date: sh.date, start: sh.start, end: sh.end, overnight: sh.end <= sh.start, minutes: shiftMinutes(sh), label: sh.label, note: sh.note,
        staff_id: sh.staff_id, staff_name: sh.staff_id ? (nm[sh.staff_id] || '?') : (sh.former ? 'ehem. Mitarbeiter' : null), former: !!sh.former,
        status: sh.staff_id ? sh.response : (reqs.length ? 'requested' : 'open'), needs_ok: !!sh.needs_ok, past: isPast(sh), mine: mine };
      var w = activeSwap(sh.id);
      if (viewer === null) {
        o.reason = sh.reason; o.responded_at = sh.responded_at; o.series_id = sh.series_id;
        o.requests = reqs.map(function (r) { return { staff_id: r.staff_id, name: nm[r.staff_id] || '?', created: r.created }; });
        o.conflicts = conflicts(sh, true);
        if (w) o.swap = swapOut(w, nm, null);
        if (modOn('tasks')) o.tasks = tasksOf(sh, nm);
      } else {
        o.requested_by_me = reqs.some(function (r) { return r.staff_id === viewer; });
        if (mine) {
          o.reason = sh.reason;
          o.conflicts = conflicts(sh, false).filter(function (c) { return c.type === 'absence' || c.type === 'overlap'; });
          if (modOn('tasks')) o.tasks = tasksOf(sh, nm);
        }
        if (w && modOn('swap') && (w.from_staff === viewer || w.to_staff === null || w.to_staff === viewer || w.taker_id === viewer)) o.swap = swapOut(w, nm, viewer);
      }
      return o;
    }
    function hoursFor(month, staffId) {
      var from = month + '-01', to = monthEnd(month), acc = {};
      db.shifts.forEach(function (s) {
        if (s.date < from || s.date > to || !s.staff_id || (staffId && s.staff_id !== staffId)) return;
        var a = acc[s.staff_id] || (acc[s.staff_id] = { minutes: 0, minutes_unanswered: 0, shifts: 0 });
        if (s.response === 'yes') { a.minutes += shiftMinutes(s); a.shifts++; } else if (s.response === 'none') a.minutes_unanswered += shiftMinutes(s);
      });
      var rows = staffId ? [staffOr404(staffId)] : db.staff.slice().sort(function (a, b) { return lower(a.name) < lower(b.name) ? -1 : 1; });
      return rows.map(function (st) {
        var a = acc[st.id] || { minutes: 0, minutes_unanswered: 0, shifts: 0 };
        var wage = st.wage_cents, lim = limitOf(st);
        var earn = wage !== null && wage !== undefined ? Math.round(a.minutes * wage / 60) : null;
        var earnAll = wage !== null && wage !== undefined ? Math.round((a.minutes + a.minutes_unanswered) * wage / 60) : null;
        return { staff_id: st.id, name: st.name, month: month, minutes: a.minutes, minutes_unanswered: a.minutes_unanswered, shifts: a.shifts,
          wage: cents(wage), earnings: cents(earn), earnings_with_unanswered: cents(earnAll), limit: cents(lim), limit_custom: st.limit_cents !== null && st.limit_cents !== undefined,
          over: earn !== null && earn > lim, over_with_unanswered: earnAll !== null && earnAll > lim };
      });
    }
    function meOut(st) {
      var o = { id: st.id, name: st.name, phone: st.phone, phone_visible: !!st.phone_visible, created: st.created };
      if (modOn('hours')) { o.wage = cents(st.wage_cents); o.limit = cents(limitOf(st)); }
      if (modOn('ical')) o.ical_url = null; // Demo: kein echter Kalender-Link
      return o;
    }
    function absenceOut(a, nm, full) {
      var o = { id: a.id, staff_id: a.staff_id, name: nm[a.staff_id] || '?', from: a.date_from, to: a.date_to, status: a.status };
      if (full !== false) { o.type = a.type; o.note = a.note; o.chef_comment = a.chef_comment; o.created = a.created; o.decided_at = a.decided_at; }
      return o;
    }
    function ordersOut(viewer) {
      var nm = names(), week = fmtFull(nowMs() - 7 * 86400000), rank = { low: 0, ordered: 1, delivered: 2 };
      var items = db.orders.filter(function (o) { return o.status !== 'delivered' || o.updated >= week; }).sort(function (a, b) {
        return rank[a.status] - rank[b.status] || (a.category < b.category ? -1 : a.category > b.category ? 1 : 0) || (lower(a.name) < lower(b.name) ? -1 : 1);
      }).map(function (o) {
        return { id: o.id, name: o.name, qty: o.qty, note: o.note, category: o.category, catalog_id: o.catalog_id, status: o.status,
          by: o.by_chef ? 'Chef' : (o.created_by ? (nm[o.created_by] || '?') : 'ehem. Mitarbeiter'), mine: viewer !== null && o.created_by === viewer, created: o.created, updated: o.updated };
      });
      var catalog = db.catalog.slice().sort(function (a, b) { return (a.category < b.category ? -1 : a.category > b.category ? 1 : 0) || (lower(a.name) < lower(b.name) ? -1 : 1); }).map(clone);
      return { items: items, catalog: catalog };
    }
    function takeBlockers(sh, staffId) {
      var b1 = shiftBounds(sh.date, sh.start, sh.end);
      for (var i = 0; i < db.shifts.length; i++) {
        var o = db.shifts[i];
        if (o.id === sh.id || o.staff_id !== staffId || o.response === 'no' || Math.abs(daysBetween(o.date, sh.date)) > 1) continue;
        var b2 = shiftBounds(o.date, o.start, o.end);
        if (b1[0] < b2[1] && b2[0] < b1[1]) return 'Du hast zu der Zeit schon eine Schicht (' + o.start + '–' + o.end + ' Uhr).';
      }
      if (db.absences.some(function (a) { return a.staff_id === staffId && a.status === 'approved' && a.date_from <= sh.date && a.date_to >= sh.date; })) return 'Du bist an dem Tag als abwesend eingetragen.';
      return null;
    }
    function executeSwap(w) {
      var sh = shiftById(w.shift_id);
      if (!sh || sh.staff_id !== w.from_staff) fail('Die Schicht gehört inzwischen nicht mehr der Person, die sie angeboten hat.', 409);
      sh.staff_id = w.taker_id; sh.response = 'yes'; sh.reason = ''; sh.responded_at = nowFull; sh.updated = nowFull;
      w.status = 'done'; w.updated = nowFull;
      db.checks = db.checks.filter(function (c) { return c.shift_id !== sh.id; });
    }
    function deleteStaff(id) {
      db.shifts.forEach(function (s) {
        if (s.staff_id !== id) return;
        if (s.date < T) { s.staff_id = null; s.former = 1; s.reason = ''; s.responded_at = null; }
        else { s.staff_id = null; s.response = 'none'; s.reason = ''; s.responded_at = null; s.updated = nowFull; }
      });
      db.invites.forEach(function (i) { if (i.used_by === id) i.used_by = null; });
      db.checks.forEach(function (c) { if (c.staff_id === id) c.staff_id = null; });
      db.orders.forEach(function (o) { if (o.created_by === id) o.created_by = null; });
      db.messages = db.messages.filter(function (m) { return m.staff_id !== id; });
      db.absences = db.absences.filter(function (a) { return a.staff_id !== id; });
      db.availability = db.availability.filter(function (a) { return a.staff_id !== id; });
      db.swaps = db.swaps.filter(function (w) { return w.from_staff !== id && w.to_staff !== id && w.taker_id !== id; });
      db.takes = db.takes.filter(function (x) { return x.staff_id !== id; });
      db.board_reads = db.board_reads.filter(function (r) { return r.staff_id !== id; });
      db.staff = db.staff.filter(function (s) { return s.id !== id; });
      if (db.session === id) db.session = null;
    }
    function rangeParams(d) {
      var from = present(d, 'from') ? vDate(d.from, 'Von') : mondayOf(T);
      var to = present(d, 'to') ? vDate(d.to, 'Bis') : addDays(from, 6);
      if (to < from) { var x = from; from = to; to = x; }
      if (daysBetween(from, to) > 62) to = addDays(from, 62);
      return [from, to];
    }
    function orderAdd(d, staffId) {
      var catId = present(d, 'catalog_id') ? vId(d.catalog_id, 'Artikel') : null;
      var qty = vStr(d.qty, 0, 40, 'Menge'), note = vStr(d.note, 0, 200, 'Notiz'), name, cat;
      if (catId) {
        var c = db.catalog.filter(function (x) { return x.id === catId; })[0];
        if (!c) fail('Artikel nicht gefunden.', 404);
        name = c.name; cat = c.category; if (qty === '') qty = c.qty;
      } else {
        name = vStr(d.name, 1, 80, 'was fehlt');
        if (ORDER_CATS.indexOf(d.category) < 0) fail('Bitte eine Art auswählen (Getränke, Küche, Putzmittel, Sonstiges).');
        cat = d.category;
      }
      var ex = db.orders.filter(function (o) { return (o.status === 'low' || o.status === 'ordered') && ((catId && o.catalog_id === catId) || lower(o.name) === lower(name)); })[0];
      if (ex) return { id: ex.id, existing: true };
      var o = { id: ++db.seq.orders, name: name, qty: qty, note: note, category: cat, catalog_id: catId, status: 'low', created_by: staffId, by_chef: staffId ? 0 : 1, created: nowFull, updated: nowFull };
      db.orders.push(o);
      return { id: o.id, existing: false };
    }

    function currentStaff() {
      var st = db.session ? staffById(db.session) : null;
      if (st && !st.active) { db.session = null; st = null; }
      return st;
    }
    function statusPayload() {
      var me = currentStaff(), chef = demoChef();
      return { me: me ? meOut(me) : null, csrf: me ? 'demo-staff' : null, chef: chef, chefCsrf: chef ? 'demo-chef' : null,
        settings: publicSettings(S), enabled: demoTeamEnabled(), serverTime: nowFull };
    }
    function requireStaff() { var me = currentStaff(); if (!me) fail('Bitte melde dich an.', 401, { loggedIn: false }); return me; }
    function requireChef() { if (!demoChef()) fail('Die Chef-Ansicht braucht eine Anmeldung in der Verwaltung.', 401, { loggedIn: false, chef: true }); }

    var A = {};

    A.status = function () { return statusPayload(); };
    A.invite_check = function (d) {
      var c = normCode(d.code), i = db.invites.filter(function (x) { return x.code === c; })[0];
      return { valid: !!(i && inviteValid(i)), note: i && inviteValid(i) ? i.note : null };
    };
    A.register = function (d) {
      var code = normCode(d.code), name = vName(d.name), pw = vNewPassword(d.password), phone = vPhone(d.phone);
      var vis = present(d, 'phone_visible') ? vBool(d.phone_visible, 'Telefon sichtbar') : false;
      var inv = db.invites.filter(function (x) { return x.code === code; })[0];
      if (!inv || !inviteValid(inv)) fail('Die Einladung ist ungültig, abgelaufen oder wurde schon benutzt. Bitte frag den Chef nach einer neuen.');
      if (db.staff.some(function (s) { return lower(s.name) === lower(name); })) fail('Diesen Namen gibt es schon im Team. Nimm z. B. noch den ersten Buchstaben vom Nachnamen dazu („Anja K.“).', 409);
      var st = { id: ++db.seq.staff, name: name, password_hash: demoHash(pw), phone: phone, phone_visible: phone && vis ? 1 : 0, active: 1, wage_cents: null, limit_cents: null,
        ical_token: hex(64), created: nowFull, last_login: nowFull };
      db.staff.push(st);
      inv.used_by = st.id; inv.used_at = nowFull;
      db.session = st.id;
      return statusPayload();
    };
    A.login = function (d) {
      var name = typeof d.name === 'string' ? d.name.replace(/\s+/g, ' ').trim() : '';
      if (!name || typeof d.password !== 'string' || !d.password) fail('Bitte Name und Passwort eingeben.');
      var st = db.staff.filter(function (s) { return lower(s.name) === lower(name); })[0];
      if (!st || st.password_hash !== demoHash(d.password)) fail('Name oder Passwort stimmt nicht.', 401);
      if (!st.active) fail('Dein Zugang ist gerade gesperrt. Bitte sprich mit dem Chef.', 403);
      st.last_login = nowFull; db.session = st.id;
      return statusPayload();
    };
    A.logout = function () { db.session = null; return {}; };

    A.staff_data = function (d) {
      var me = requireStaff(), id = me.id, nm = names(), r = rangeParams(d), from = r[0], to = r[1];
      var horizon = addDays(T, 56), yest = addDays(T, -1);
      var week = inRange(from, to).map(function (s) { return shiftOut(s, id, nm); });
      var ahead = db.shifts.filter(function (s) { return s.date >= yest && s.date <= horizon && (s.staff_id === id || !s.staff_id); }).sort(sortShifts).map(function (s) { return shiftOut(s, id, nm); });
      var mine = ahead.filter(function (s) { return !s.past && s.mine; });
      var open = ahead.filter(function (s) { return !s.past && !s.staff_id; });
      var colleagues = db.staff.filter(function (s) { return s.active; }).sort(function (a, b) { return lower(a.name) < lower(b.name) ? -1 : 1; })
        .map(function (c) { return { id: c.id, name: c.name, phone: c.phone_visible && c.phone ? c.phone : null, me: c.id === id }; });
      var cutoff = addDays(T, -90);
      var myAbs = db.absences.filter(function (a) { return a.staff_id === id && a.date_to >= cutoff; }).sort(function (a, b) { return a.date_from < b.date_from ? 1 : -1; }).map(function (a) { return absenceOut(a, nm); });
      var teamAbs = db.absences.filter(function (a) { return a.status === 'approved' && a.staff_id !== id && a.date_to >= from && a.date_from <= to; }).map(function (a) { return absenceOut(a, nm, false); });
      var avail = {};
      if (modOn('availability')) db.availability.forEach(function (a) { if (a.staff_id === id && a.date >= addDays(T, -7)) avail[a.date] = a.value; });
      var swaps = [];
      if (modOn('swap')) {
        var since = fmtFull(nowMs() - 14 * 86400000);
        db.swaps.slice().sort(function (a, b) { return a.created < b.created ? 1 : -1; }).forEach(function (w) {
          var sh = shiftById(w.shift_id);
          if (!sh || sh.date < yest) return;
          var act = (w.status === 'offered' || w.status === 'accepted') && (w.from_staff === id || w.to_staff === id || w.to_staff === null || w.taker_id === id);
          var hist = (w.status === 'done' || w.status === 'declined' || w.status === 'rejected') && (w.from_staff === id || w.taker_id === id) && w.updated >= since;
          if (!act && !hist) return;
          var o = swapOut(w, nm, id); o.shift = shiftLite(sh); swaps.push(o);
        });
      }
      var messages = db.messages.filter(function (m) { return m.staff_id === id; }).slice(-200).map(function (m) { return { id: m.id, from_chef: !!m.from_chef, body: m.body, created: m.created, read: !!m.read_at }; });
      var unreadMsg = db.messages.filter(function (m) { return m.staff_id === id && m.from_chef && !m.read_at; }).length;
      var board = [], unreadBoard = 0;
      if (modOn('board')) db.board.slice().sort(function (a, b) { return b.id - a.id; }).slice(0, 30).forEach(function (b) {
        var read = db.board_reads.some(function (r) { return r.post_id === b.id && r.staff_id === id; });
        if (!read) unreadBoard++;
        board.push({ id: b.id, title: b.title, body: b.body, created: b.created, read: read });
      });
      var m1 = T.slice(0, 7);
      return { me: meOut(me), settings: publicSettings(S), orders: modOn('orders') ? ordersOut(id) : null, today: T, serverTime: nowFull, from: from, to: to,
        colleagues: colleagues, week: week, my_shifts: mine, open_shifts: open, absences: myAbs, team_absences: teamAbs, availability: avail, swaps: swaps,
        messages: messages, board: board, hours: modOn('hours') ? [hoursFor(m1, id)[0], hoursFor(nextMonth(m1), id)[0]] : null,
        unread: { messages: unreadMsg, board: unreadBoard } };
    };
    A.profile_save = function (d) {
      var me = requireStaff(), phone = vPhone(d.phone), vis = present(d, 'phone_visible') ? vBool(d.phone_visible, 'Telefon sichtbar') : false;
      me.phone = phone; me.phone_visible = phone && vis ? 1 : 0;
      return { me: meOut(me) };
    };
    A.change_password = function (d) {
      var me = requireStaff();
      if (typeof d.old !== 'string' || demoHash(d.old) !== me.password_hash) fail('Das bisherige Passwort stimmt nicht.');
      var n = vNewPassword(d['new'], 'Das neue Passwort');
      if (n === d.old) fail('Das neue Passwort muss anders sein als das bisherige.');
      me.password_hash = demoHash(n);
      return {};
    };
    A.delete_account = function (d) {
      var me = requireStaff();
      if (typeof d.password !== 'string' || demoHash(d.password) !== me.password_hash) fail('Das Passwort stimmt nicht.');
      deleteStaff(me.id);
      return {};
    };
    A.ical_reset = function () { var me = requireStaff(); reqMod('ical'); me.ical_token = hex(64); return { me: meOut(me) }; };
    A.shift_respond = function (d) {
      var me = requireStaff(), sh = shiftOr404(vId(d.id, 'Schicht'));
      if (sh.staff_id !== me.id) fail('Das ist nicht deine Schicht.', 403);
      if (isPast(sh)) fail('Diese Schicht ist schon vorbei.');
      if (d.answer !== 'yes' && d.answer !== 'no') fail('Bitte „Zusagen“ oder „Absagen“ wählen.');
      sh.response = d.answer; sh.reason = d.answer === 'no' ? vStr(d.reason, 0, 200, 'Grund') : ''; sh.responded_at = nowFull; sh.updated = nowFull;
      if (d.answer === 'no') db.swaps.forEach(function (w) { if (w.shift_id === sh.id && (w.status === 'offered' || w.status === 'accepted')) { w.status = 'cancelled'; w.updated = nowFull; } });
      return { answer: d.answer };
    };
    A.shift_take = function (d) {
      var me = requireStaff(), sh = shiftOr404(vId(d.id, 'Schicht'));
      if (sh.staff_id) fail('Zu spät – diese Schicht hat schon jemand übernommen.', 409);
      if (isPast(sh)) fail('Diese Schicht ist schon vorbei.');
      var block = takeBlockers(sh, me.id);
      if (block) fail(block, 409);
      if (sh.needs_ok) {
        if (!db.takes.some(function (x) { return x.shift_id === sh.id && x.staff_id === me.id; })) db.takes.push({ shift_id: sh.id, staff_id: me.id, created: nowFull });
        return { result: 'requested' };
      }
      sh.staff_id = me.id; sh.response = 'yes'; sh.reason = ''; sh.responded_at = nowFull; sh.updated = nowFull;
      db.takes = db.takes.filter(function (x) { return x.shift_id !== sh.id; });
      return { result: 'taken' };
    };
    A.take_cancel = function (d) {
      var me = requireStaff(), id = vId(d.id, 'Schicht');
      db.takes = db.takes.filter(function (x) { return !(x.shift_id === id && x.staff_id === me.id); });
      return {};
    };
    A.absence_request = function (d) {
      var me = requireStaff(), from = vDate(d.from, 'Von'), to = present(d, 'to') ? vDate(d.to, 'Bis') : from;
      if (to < from) fail('„Bis“ darf nicht vor „Von“ liegen.');
      if (from < addDays(T, -30)) fail('Das Datum liegt zu weit zurück.');
      if (daysBetween(from, to) > 92) fail('Bitte höchstens 3 Monate auf einmal eintragen.');
      if (ABSENCE_TYPES.indexOf(d.type) < 0) fail('Bitte die Art auswählen (Urlaub, krank, sonstiges).');
      var a = { id: ++db.seq.absences, staff_id: me.id, date_from: from, date_to: to, type: d.type, note: vStr(d.note, 0, 300, 'Notiz', true), status: 'pending', chef_comment: '', created: nowFull, decided_at: null };
      db.absences.push(a);
      return { id: a.id };
    };
    A.absence_cancel = function (d) {
      var me = requireStaff(), id = vId(d.id);
      var a = db.absences.filter(function (x) { return x.id === id && x.staff_id === me.id; })[0];
      if (!a) fail('Eintrag nicht gefunden.', 404);
      if (a.status === 'approved' && a.date_from <= T) fail('Eine laufende oder vergangene genehmigte Abwesenheit kann nur der Chef ändern.');
      db.absences = db.absences.filter(function (x) { return x.id !== id; });
      return {};
    };
    A.availability_set = function (d) {
      var me = requireStaff(); reqMod('availability');
      var days = d.days;
      if (!days || typeof days !== 'object' || Array.isArray(days)) fail('Ungültige Angabe.');
      var keys = Object.keys(days);
      if (keys.length > 80) fail('Zu viele Tage auf einmal.');
      var min = addDays(T, -1), max = addDays(T, 70);
      keys.forEach(function (k) {
        var dt = vDate(k), v = days[k];
        if (dt < min || dt > max) fail('Verfügbarkeit geht nur für die nächsten 8 Wochen.');
        if (['yes', 'no', 'maybe', '', null].indexOf(v) < 0) fail('Ungültiger Wert.');
      });
      keys.forEach(function (k) {
        db.availability = db.availability.filter(function (a) { return !(a.staff_id === me.id && a.date === k); });
        if (days[k]) db.availability.push({ staff_id: me.id, date: k, value: days[k] });
      });
      return { saved: keys.length };
    };
    A.swap_offer = function (d) {
      var me = requireStaff(); reqMod('swap');
      var sh = shiftOr404(vId(d.shift_id, 'Schicht'));
      if (sh.staff_id !== me.id) fail('Das ist nicht deine Schicht.', 403);
      if (isPast(sh)) fail('Diese Schicht ist schon vorbei.');
      if (sh.response === 'no') fail('Du hast diese Schicht schon abgesagt – der Chef kümmert sich.');
      var to = present(d, 'to_staff') ? vInt(d.to_staff, 0, 2147483647, 'Kollege') : 0;
      if (to) { var t = staffOr404(to); if (to === me.id || !t.active) fail('Diese Person kann die Schicht nicht übernehmen.'); }
      var note = vStr(d.note, 0, 200, 'Notiz');
      if (activeSwap(sh.id)) fail('Für diese Schicht läuft schon ein Tausch-Angebot.', 409);
      var w = { id: ++db.seq.swaps, shift_id: sh.id, from_staff: me.id, to_staff: to || null, taker_id: null, status: 'offered', note: note, created: nowFull, updated: nowFull };
      db.swaps.push(w);
      return { id: w.id };
    };
    A.swap_cancel = function (d) {
      var me = requireStaff(); reqMod('swap');
      var id = vId(d.id), w = db.swaps.filter(function (x) { return x.id === id && x.from_staff === me.id && (x.status === 'offered' || x.status === 'accepted'); })[0];
      if (!w) fail('Tausch-Angebot nicht gefunden.', 404);
      w.status = 'cancelled'; w.updated = nowFull;
      return {};
    };
    function swapAnswer(d, reject) {
      var me = requireStaff(); reqMod('swap');
      var id = vId(d.id), w = db.swaps.filter(function (x) { return x.id === id && x.status === 'offered'; })[0];
      if (!w || w.from_staff === me.id || (w.to_staff !== null && w.to_staff !== me.id)) fail('Dieses Angebot gibt es nicht mehr.', 404);
      if (reject) {
        if (w.to_staff === null) fail('Ein Angebot an alle musst du nicht ablehnen – lass es einfach liegen.');
        w.status = 'rejected'; w.updated = nowFull;
        return { result: 'rejected' };
      }
      var sh = shiftById(w.shift_id);
      if (!sh || isPast(sh)) fail('Diese Schicht ist schon vorbei.');
      var block = takeBlockers(sh, me.id);
      if (block) fail(block, 409);
      w.taker_id = me.id; w.status = 'accepted'; w.updated = nowFull;
      if (!S.swap_needs_chef) { executeSwap(w); return { result: 'done' }; }
      return { result: 'waiting' };
    }
    A.swap_accept = function (d) { return swapAnswer(d, false); };
    A.swap_reject = function (d) { return swapAnswer(d, true); };
    A.message_send = function (d) {
      var me = requireStaff(), body = vStr(d.body, 1, MSG_MAX, 'die Nachricht', true);
      db.messages.push({ id: ++db.seq.messages, staff_id: me.id, from_chef: 0, body: body, created: nowFull, read_at: null });
      return { id: db.seq.messages };
    };
    A.message_read = function () {
      var me = requireStaff();
      db.messages.forEach(function (m) { if (m.staff_id === me.id && m.from_chef && !m.read_at) m.read_at = nowFull; });
      return {};
    };
    A.board_read = function (d) {
      var me = requireStaff(); reqMod('board');
      var id = vId(d.id);
      if (!db.board.some(function (b) { return b.id === id; })) fail('Aushang nicht gefunden.', 404);
      if (!db.board_reads.some(function (r) { return r.post_id === id && r.staff_id === me.id; })) db.board_reads.push({ post_id: id, staff_id: me.id, read_at: nowFull });
      return {};
    };
    A.check_tick = function (d) {
      var me = requireStaff(); reqMod('tasks');
      var sh = shiftOr404(vId(d.shift_id, 'Schicht'));
      if (sh.staff_id !== me.id) fail('Das ist nicht deine Schicht.', 403);
      var b = shiftBounds(sh.date, sh.start, sh.end), n = nowMs();
      if (n < b[0] - 120 * 60000 || n > b[1] + 720 * 60000) fail('Abhaken geht nur während deiner Schicht (ab 2 Stunden vorher).');
      var cid = vId(d.checklist_id, 'Liste'), list = listsFor(sh).filter(function (c) { return c.id === cid; })[0];
      if (!list || !list.items.some(function (it) { return it.id === d.item_id; })) fail('Aufgabe nicht gefunden.', 404);
      var done = vBool(d.done, 'Erledigt');
      db.checks = db.checks.filter(function (c) { return !(c.shift_id === sh.id && c.checklist_id === cid && c.item_id === d.item_id); });
      if (done) db.checks.push({ shift_id: sh.id, checklist_id: cid, item_id: d.item_id, staff_id: me.id, done_at: nowFull });
      return { done: done };
    };
    A.order_add = function (d) { var me = requireStaff(); reqMod('orders'); return orderAdd(d, me.id); };
    A.order_remove = function (d) {
      var me = requireStaff(); reqMod('orders');
      var id = vId(d.id), o = db.orders.filter(function (x) { return x.id === id && x.created_by === me.id && x.status === 'low'; })[0];
      if (!o) fail('Nur eigene Einträge, die noch nicht bestellt sind, kannst du entfernen.', 403);
      db.orders = db.orders.filter(function (x) { return x.id !== id; });
      return {};
    };

    /* -------- Chef */
    A.chef_data = function (d) {
      requireChef();
      var nm = names(), r = rangeParams(d), from = r[0], to = r[1];
      var shifts = inRange(from, to).map(function (s) { return shiftOut(s, null, nm); });
      var hrs = {}; hoursFor(T.slice(0, 7)).forEach(function (h) { hrs[h.staff_id] = h; });
      var unread = {}; db.messages.forEach(function (m) { if (!m.from_chef && !m.read_at) unread[m.staff_id] = (unread[m.staff_id] || 0) + 1; });
      var staff = db.staff.slice().sort(function (a, b) { return lower(a.name) < lower(b.name) ? -1 : 1; }).map(function (s) {
        return { id: s.id, name: s.name, phone: s.phone, phone_visible: !!s.phone_visible, active: !!s.active, wage: cents(s.wage_cents), limit: cents(limitOf(s)),
          limit_custom: s.limit_cents !== null && s.limit_cents !== undefined, created: s.created, last_login: s.last_login, hours: hrs[s.id] || null, unread: unread[s.id] || 0 };
      });
      var invites = db.invites.slice().sort(function (a, b) { return a.created < b.created ? 1 : -1; }).map(inviteOut);
      var abs = db.absences.filter(function (a) { return a.status === 'pending' || (a.date_to >= from && a.date_from <= to) || a.date_to >= T; })
        .sort(function (a, b) { return (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1) || (a.date_from < b.date_from ? -1 : 1); }).map(function (a) { return absenceOut(a, nm); });
      var since = fmtFull(nowMs() - 14 * 86400000), srank = { accepted: 0, offered: 1 };
      var swaps = db.swaps.filter(function (w) { return w.status === 'offered' || w.status === 'accepted' || w.updated >= since; })
        .sort(function (a, b) { return ((srank[a.status] !== undefined ? srank[a.status] : 2) - (srank[b.status] !== undefined ? srank[b.status] : 2)) || (a.created < b.created ? 1 : -1); })
        .map(function (w) { var o = swapOut(w, nm, null); o.shift = shiftLite(shiftById(w.shift_id)); return o; });
      var takes = db.takes.filter(function (x) { var s = shiftById(x.shift_id); return s && !s.staff_id; }).map(function (x) {
        var s = shiftById(x.shift_id); return { shift_id: x.shift_id, staff_id: x.staff_id, name: nm[x.staff_id] || '?', created: x.created, shift: shiftLite(s) };
      });
      var declined = db.shifts.filter(function (s) { return s.staff_id && s.response === 'no' && s.date >= T; }).sort(sortShifts).map(function (s) {
        return { id: s.id, date: s.date, start: s.start, end: s.end, label: s.label, staff_id: s.staff_id, name: nm[s.staff_id] || '?', reason: s.reason };
      });
      var threads = {};
      db.messages.forEach(function (m) { threads[m.staff_id] = m; });
      var thr = Object.keys(threads).map(function (k) { var m = threads[k]; return { staff_id: m.staff_id, name: nm[m.staff_id] || '?', last: m.body.slice(0, 120), last_from_chef: !!m.from_chef, last_at: m.created, unread: unread[m.staff_id] || 0 }; })
        .sort(function (a, b) { return a.last_at < b.last_at ? 1 : -1; });
      var active = db.staff.filter(function (s) { return s.active; });
      var board = db.board.slice().sort(function (a, b) { return b.id - a.id; }).slice(0, 30).map(function (b) {
        var reads = db.board_reads.filter(function (r) { return r.post_id === b.id; }).map(function (r) { return { staff_id: r.staff_id, name: nm[r.staff_id] || '?', read_at: r.read_at }; });
        var ids = reads.map(function (r) { return r.staff_id; });
        return { id: b.id, title: b.title, body: b.body, created: b.created, reads: reads, not_read: active.filter(function (s) { return ids.indexOf(s.id) < 0; }).map(function (s) { return s.name; }) };
      });
      var avail = {};
      db.availability.forEach(function (a) { if (a.date >= from && a.date <= to) { (avail[a.staff_id] = avail[a.staff_id] || {})[a.date] = a.value; } });
      var pendingAbs = abs.filter(function (a) { return a.status === 'pending'; }).length;
      var pendingSwaps = swaps.filter(function (w) { return w.status === 'accepted'; }).length;
      var ps = publicSettings(S); ps.minijob_limit_cents = S.minijob_limit_cents;
      return { settings: ps, today: T, serverTime: nowFull, from: from, to: to, staff: staff, invites: invites, shifts: shifts, absences: abs, availability: avail,
        swaps: swaps, takes: takes, declined: declined, threads: thr, board: board, checklists: clone(db.checklists).map(function (c) { delete c.created; return c; }),
        orders: ordersOut(null), enabled: demoTeamEnabled(),
        counts: { requests: pendingAbs + pendingSwaps + takes.length + declined.length, absences: pendingAbs, swaps: pendingSwaps, takes: takes.length, declined: declined.length,
          unread: Object.keys(unread).reduce(function (s, k) { return s + unread[k]; }, 0), orders: db.orders.filter(function (o) { return o.status === 'low'; }).length } };
    };
    A.chef_hours = function (d) {
      requireChef();
      var m = typeof d.month === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(d.month) ? d.month : T.slice(0, 7);
      return { month: m, rows: hoursFor(m) };
    };
    A.chef_thread = function (d) {
      requireChef();
      var sid = vId(d.staff_id, 'Mitarbeiter'), st = staffOr404(sid);
      return { staff_id: sid, name: st.name, messages: db.messages.filter(function (m) { return m.staff_id === sid; }).slice(-200).map(function (m) { return { id: m.id, from_chef: !!m.from_chef, body: m.body, created: m.created, read: !!m.read_at }; }) };
    };
    A.chef_message_send = function (d) {
      requireChef();
      var sid = vId(d.staff_id, 'Mitarbeiter'); staffOr404(sid);
      db.messages.push({ id: ++db.seq.messages, staff_id: sid, from_chef: 1, body: vStr(d.body, 1, MSG_MAX, 'die Nachricht', true), created: nowFull, read_at: null });
      return { id: db.seq.messages };
    };
    A.chef_message_read = function (d) {
      requireChef();
      var sid = vId(d.staff_id, 'Mitarbeiter');
      db.messages.forEach(function (m) { if (m.staff_id === sid && !m.from_chef && !m.read_at) m.read_at = nowFull; });
      return {};
    };
    A.chef_invite_create = function (d) {
      requireChef();
      var note = vStr(d.note, 0, 60, 'Notiz'), exp = present(d, 'expires') ? vDate(d.expires, 'Gültig bis') : null;
      if (exp && exp < T) fail('„Gültig bis“ liegt in der Vergangenheit.');
      var i = { code: randomString(INVITE_ALPHABET, 8), note: note, expires: exp, used_by: null, used_at: null, revoked: 0, created: nowFull };
      db.invites.push(i);
      return { invite: inviteOut(i) };
    };
    A.chef_invite_revoke = function (d) {
      requireChef();
      var c = normCode(d.code), i = db.invites.filter(function (x) { return x.code === c; })[0];
      if (!i) fail('Einladung nicht gefunden.', 404);
      i.revoked = 1;
      return {};
    };
    A.chef_staff_update = function (d) {
      requireChef();
      var st = staffOr404(vId(d.id, 'Mitarbeiter'));
      if (present(d, 'active')) st.active = vBool(d.active, 'Aktiv') ? 1 : 0;
      if ('wage' in d) st.wage_cents = vMoney(d.wage, 'Stundenlohn', 20000);
      if ('limit' in d) st.limit_cents = vMoney(d.limit, 'Monatsgrenze', 1000000);
      return {};
    };
    A.chef_staff_reset = function (d) {
      requireChef();
      var st = staffOr404(vId(d.id, 'Mitarbeiter')), temp = randomString(PW_ALPHABET, 10);
      st.password_hash = demoHash(temp);
      if (db.session === st.id) db.session = null;
      return { temp_password: temp };
    };
    A.chef_staff_delete = function (d) { requireChef(); var id = vId(d.id, 'Mitarbeiter'); staffOr404(id); deleteStaff(id); return {}; };
    A.chef_shift_save = function (d) {
      requireChef();
      var old = present(d, 'id') ? shiftOr404(vId(d.id, 'Schicht')) : null;
      var date = vDate(d.date), start = vTime(d.start, 'Beginn'), end = vTime(d.end, 'Ende');
      if (start === end) fail('Beginn und Ende dürfen nicht gleich sein.');
      var label = vStr(d.label, 0, 40, 'Bezeichnung'), note = vStr(d.note, 0, 300, 'Notiz', true);
      var staffId = present(d, 'staff_id') ? vInt(d.staff_id, 0, 2147483647, 'Mitarbeiter') : 0;
      if (staffId) staffOr404(staffId);
      var needsOk = present(d, 'needs_ok') ? vBool(d.needs_ok, 'Nur nach Bestätigung') : S.take_needs_ok;
      var confirmed = present(d, 'confirmed') ? vBool(d.confirmed, 'Zugesagt') : false;
      var dates = [date];
      if (!old && present(d, 'repeat_until')) {
        var until = vDate(d.repeat_until, 'Wiederholen bis');
        if (until <= date) fail('„Wiederholen bis“ muss nach dem ersten Datum liegen.');
        for (var x = addDays(date, 7); x <= until; x = addDays(x, 7)) { dates.push(x); if (dates.length > 53) fail('Höchstens 53 Wiederholungen (ca. 1 Jahr) auf einmal.'); }
      }
      var ids = [], sid = staffId || null;
      if (old) {
        var sameStaff = (old.staff_id || 0) === staffId, sameTime = old.date === date && old.start === start && old.end === end;
        if (!sameStaff || !sameTime || !sid) { old.response = 'none'; old.reason = ''; old.responded_at = null; }
        if (confirmed && sid) { old.response = 'yes'; old.reason = ''; old.responded_at = old.responded_at || nowFull; }
        old.date = date; old.start = start; old.end = end; old.label = label; old.note = note; old.staff_id = sid; old.needs_ok = needsOk ? 1 : 0; if (sid) old.former = 0; old.updated = nowFull;
        if (!sameStaff || sid) db.takes = db.takes.filter(function (t) { return t.shift_id !== old.id; });
        if (!sameStaff || !sameTime) db.swaps.forEach(function (w) { if (w.shift_id === old.id && (w.status === 'offered' || w.status === 'accepted')) { w.status = 'cancelled'; w.updated = nowFull; } });
        ids.push(old.id);
      } else {
        var series = dates.length > 1 ? hex(12) : null;
        dates.forEach(function (dt) {
          var s = { id: ++db.seq.shifts, date: dt, start: start, end: end, label: label, note: note, staff_id: sid, response: confirmed && sid ? 'yes' : 'none', reason: '',
            responded_at: confirmed && sid ? nowFull : null, needs_ok: needsOk ? 1 : 0, former: 0, series_id: series, created: nowFull, updated: nowFull };
          db.shifts.push(s); ids.push(s.id);
        });
      }
      var nm = names(), out = ids.map(function (i) { return shiftOut(shiftById(i), null, nm); }), warnings = [];
      out.forEach(function (s) { (s.conflicts || []).forEach(function (c) { warnings.push({ date: s.date, type: c.type, text: c.text }); }); });
      return { ids: ids, shifts: out, warnings: warnings };
    };
    A.chef_shift_delete = function (d) {
      requireChef();
      var sh = shiftOr404(vId(d.id, 'Schicht')), before = db.shifts.length;
      var following = d.scope === 'following' && sh.series_id;
      var gone = db.shifts.filter(function (s) { return following ? (s.series_id === sh.series_id && s.date >= sh.date) : s.id === sh.id; }).map(function (s) { return s.id; });
      db.shifts = db.shifts.filter(function (s) { return gone.indexOf(s.id) < 0; });
      db.takes = db.takes.filter(function (t) { return gone.indexOf(t.shift_id) < 0; });
      db.swaps = db.swaps.filter(function (w) { return gone.indexOf(w.shift_id) < 0; });
      db.checks = db.checks.filter(function (c) { return gone.indexOf(c.shift_id) < 0; });
      return { deleted: before - db.shifts.length };
    };
    A.chef_take_decide = function (d) {
      requireChef();
      var id = vId(d.shift_id, 'Schicht'), sid = vId(d.staff_id, 'Mitarbeiter'), ok = vBool(d.approve, 'Entscheidung');
      if (!db.takes.some(function (t) { return t.shift_id === id && t.staff_id === sid; })) fail('Anfrage nicht gefunden.', 404);
      if (!ok) { db.takes = db.takes.filter(function (t) { return !(t.shift_id === id && t.staff_id === sid); }); return { result: 'declined' }; }
      var sh = shiftById(id);
      if (!sh || sh.staff_id) fail('Die Schicht ist schon vergeben.', 409);
      sh.staff_id = sid; sh.response = 'yes'; sh.reason = ''; sh.responded_at = nowFull; sh.updated = nowFull;
      db.takes = db.takes.filter(function (t) { return t.shift_id !== id; });
      return { result: 'approved' };
    };
    A.chef_absence_decide = function (d) {
      requireChef();
      var id = vId(d.id), a = db.absences.filter(function (x) { return x.id === id; })[0];
      if (!a) fail('Antrag nicht gefunden.', 404);
      var ok = vBool(d.approve, 'Entscheidung');
      a.status = ok ? 'approved' : 'declined'; a.chef_comment = vStr(d.comment, 0, 300, 'Kommentar', true); a.decided_at = nowFull;
      var affected = ok ? db.shifts.filter(function (s) { return s.staff_id === a.staff_id && s.response !== 'no' && s.date >= a.date_from && s.date <= a.date_to; }).sort(sortShifts).map(shiftLite) : [];
      return { affected_shifts: affected };
    };
    A.chef_absence_delete = function (d) { requireChef(); var id = vId(d.id); db.absences = db.absences.filter(function (a) { return a.id !== id; }); return {}; };
    A.chef_swap_decide = function (d) {
      requireChef();
      var id = vId(d.id), ok = vBool(d.approve, 'Entscheidung');
      var w = db.swaps.filter(function (x) { return x.id === id && (x.status === 'accepted' || x.status === 'offered'); })[0];
      if (!w) fail('Tausch nicht gefunden.', 404);
      if (!ok) { w.status = 'declined'; w.updated = nowFull; return { result: 'declined' }; }
      if (w.status !== 'accepted' || !w.taker_id) fail('Es hat noch niemand den Tausch angenommen.');
      executeSwap(w);
      return { result: 'done' };
    };
    A.chef_board_post = function (d) {
      requireChef();
      var b = { id: ++db.seq.board, title: vStr(d.title, 0, 80, 'Überschrift'), body: vStr(d.body, 1, 2000, 'den Text', true), created: nowFull };
      db.board.push(b);
      return { id: b.id };
    };
    A.chef_board_delete = function (d) { requireChef(); var id = vId(d.id); db.board = db.board.filter(function (b) { return b.id !== id; }); db.board_reads = db.board_reads.filter(function (r) { return r.post_id !== id; }); return {}; };
    A.chef_checklist_save = function (d) {
      requireChef();
      var id = present(d, 'id') ? vId(d.id) : null, name = vStr(d.name, 1, 60, 'einen Namen für die Liste'), label = vStr(d.label, 0, 40, 'Bezeichnung');
      if (!Array.isArray(d.items)) fail('Aufgaben: bitte eine Liste angeben.');
      if (d.items.length > 30) fail('Höchstens 30 Aufgaben je Liste.');
      var seen = {}, items = [];
      d.items.forEach(function (it, i) {
        var text = it && typeof it === 'object' ? it.text : it, iid = it && typeof it === 'object' && typeof it.id === 'string' && /^[a-z0-9]{4,16}$/.test(it.id) ? it.id : '';
        var t = vStr(text, 0, 120, 'Aufgabe ' + (i + 1));
        if (!t) return;
        if (!iid || seen[iid]) iid = hex(8);
        seen[iid] = 1; items.push({ id: iid, text: t });
      });
      if (!items.length) fail('Bitte mindestens eine Aufgabe eintragen.');
      if (id) {
        var c = db.checklists.filter(function (x) { return x.id === id; })[0];
        if (!c) fail('Liste nicht gefunden.', 404);
        c.name = name; c.label = label; c.items = items;
      } else {
        if (db.checklists.length >= 30) fail('Höchstens 30 Listen.');
        id = ++db.seq.checklists;
        db.checklists.push({ id: id, name: name, label: label, items: items, created: nowFull });
      }
      return { id: id, checklists: clone(db.checklists) };
    };
    A.chef_checklist_delete = function (d) {
      requireChef(); var id = vId(d.id);
      db.checklists = db.checklists.filter(function (c) { return c.id !== id; });
      db.checks = db.checks.filter(function (c) { return c.checklist_id !== id; });
      return { checklists: clone(db.checklists) };
    };
    A.chef_settings_save = function (d) {
      requireChef();
      if (d.modules && typeof d.modules === 'object') MODULES.forEach(function (m) { if (m in d.modules) S.modules[m] = vBool(d.modules[m], 'Funktion'); });
      ['swap_needs_chef', 'take_needs_ok'].forEach(function (k) { if (present(d, k)) S[k] = vBool(d[k], 'Einstellung'); });
      if (present(d, 'minijob_limit')) { var c = vMoney(d.minijob_limit, 'Minijob-Grenze', 1000000); S.minijob_limit_cents = c === null ? 60300 : c; }
      if (Array.isArray(d.labels)) {
        if (d.labels.length > 20) fail('Bezeichnungen: höchstens 20.');
        var clean = [];
        d.labels.forEach(function (l) { l = vStr(l, 0, 40, 'Bezeichnung'); if (l && clean.map(lower).indexOf(lower(l)) < 0) clean.push(l); });
        S.labels = clean;
      }
      return { settings: clone(S) };
    };
    A.chef_order_add = function (d) { requireChef(); return orderAdd(d, null); };
    A.chef_order_status = function (d) {
      requireChef();
      var id = vId(d.id), o = db.orders.filter(function (x) { return x.id === id; })[0];
      if (['low', 'ordered', 'delivered'].indexOf(d.status) < 0) fail('Ungültiger Status.');
      if (!o) fail('Eintrag nicht gefunden.', 404);
      o.status = d.status; o.updated = nowFull;
      return {};
    };
    A.chef_order_delete = function (d) { requireChef(); var id = vId(d.id); db.orders = db.orders.filter(function (o) { return o.id !== id; }); return {}; };
    A.chef_catalog_save = function (d) {
      requireChef();
      var id = present(d, 'id') ? vId(d.id) : null, name = vStr(d.name, 1, 80, 'den Artikel'), qty = vStr(d.qty, 0, 40, 'Menge');
      if (ORDER_CATS.indexOf(d.category) < 0) fail('Bitte eine Art auswählen (Getränke, Küche, Putzmittel, Sonstiges).');
      if (id) {
        var c = db.catalog.filter(function (x) { return x.id === id; })[0];
        if (!c) fail('Artikel nicht gefunden.', 404);
        c.name = name; c.category = d.category; c.qty = qty;
      } else {
        id = ++db.seq.catalog;
        db.catalog.push({ id: id, name: name, category: d.category, qty: qty });
      }
      return { id: id };
    };
    A.chef_catalog_delete = function (d) {
      requireChef(); var id = vId(d.id);
      db.catalog = db.catalog.filter(function (c) { return c.id !== id; });
      db.orders.forEach(function (o) { if (o.catalog_id === id) o.catalog_id = null; });
      return {};
    };

    return { A: A };
  }

  var STAFF_OPEN = { status: 1, logout: 1 };

  async function demoCall(action, data) {
    var db = clone(demoLoad());
    var demo = makeDemo(db);
    var fn = demo.A[action];
    if (!fn) fail('Unbekannte Aktion.', 400);
    if (action === 'ical') fail('Im Demo-Modus gibt es keinen Kalender-Link.', 404);
    if (action.indexOf('chef_') !== 0 && !STAFF_OPEN[action] && !demoTeamEnabled()) fail('Der Team-Bereich ist im Moment ausgeschaltet.', 403, { teamDisabled: true });
    var res;
    try {
      res = fn(data || {});
    } catch (e) {
      if (e && e.data && e.data.ok === false) {
        if (e.status === 401 && e.data.chef) { state.chef = false; state.chefCsrf = null; }
        else if (e.status === 401 && action.indexOf('chef_') !== 0) { state.me = null; state.csrf = null; }
      }
      throw e;
    }
    res = Object.assign({ ok: true, api: 'hbs-team' }, res);
    demoDb = db;
    demoSave();
    if (action === 'status' || action === 'login' || action === 'register') rememberStatus(res);
    if (action === 'logout' || action === 'delete_account') { state.me = null; state.csrf = null; }
    if ((action === 'profile_save' || action === 'ical_reset') && res.me) state.me = res.me;
    if (action === 'chef_settings_save' && res.settings) state.settings = publicSettings(res.settings);
    await new Promise(function (r) { setTimeout(r, 0); });
    return clone(res);
  }

  function demoLoginAs(id) {
    var db = demoLoad();
    if (!db.staff.some(function (s) { return s.id === id && s.active; })) return false;
    db.session = id;
    demoDb = db;
    demoSave();
    return true;
  }

  /* ================================================================ Öffentlich */

  var initPromise = null;

  async function init(options) {
    options = options || {};
    if (options.base) state.base = options.base;
    var forced = options.mode || null;
    if (forced === 'demo') { state.mode = 'demo'; demoChef(); state.chef = demoChef(); return demoCall('status', {}); }
    var r = null;
    try { r = await liveFetch('status', {}, options.timeout || 8000); } catch (e) { r = null; }
    var j = r && r.json;
    if (j && typeof j === 'object' && j.api === 'hbs-team') {
      state.mode = 'live';
      if (!j.ok) { TeamAPI.error = j.error || 'Der Dienstplan ist gerade nicht erreichbar.'; throw ApiError(TeamAPI.error, r.http || 500, j); }
      TeamAPI.error = null;
      rememberStatus(j);
      return j;
    }
    if (forced === 'live') {
      state.mode = 'live';
      TeamAPI.error = 'Der Dienstplan ist gerade nicht erreichbar.';
      throw ApiError(TeamAPI.error, (r && r.http) || 0);
    }
    state.mode = 'demo';
    TeamAPI.error = null;
    return demoCall('status', {});
  }

  async function call(action, data) {
    if (typeof action !== 'string' || !/^[a-z_]{1,40}$/.test(action)) throw ApiError('Unbekannte Aktion.', 400);
    if (!state.mode) {
      if (!initPromise) initPromise = init({});
      try { await initPromise; } catch (e) { /* wird beim Aufruf erneut gemeldet */ }
    }
    return state.mode === 'demo' ? demoCall(action, data || {}) : liveCall(action, data || {});
  }

  var TeamAPI = {
    version: '1.0',
    init: function (options) { initPromise = init(options); return initPromise; },
    call: call,
    demoReset: demoReset,
    demoSetChef: demoSetChef,
    demoLoginAs: demoLoginAs,
    demoPassword: DEMO_PASSWORD,
    error: null,
    util: { berlinNow: berlinNow, today: today, addDays: addDays, daysBetween: daysBetween, mondayOf: mondayOf, shiftBounds: shiftBounds, shiftMinutes: shiftMinutes, naiveMs: naiveMs, nextMonth: nextMonth }
  };
  Object.defineProperty(TeamAPI, 'mode', { enumerable: true, get: function () { return state.mode; } });
  Object.defineProperty(TeamAPI, 'me', { enumerable: true, get: function () { return state.me ? clone(state.me) : null; } });
  Object.defineProperty(TeamAPI, 'csrf', { enumerable: true, get: function () { return state.csrf; } });
  Object.defineProperty(TeamAPI, 'chef', { enumerable: true, get: function () { return !!state.chef; } });
  Object.defineProperty(TeamAPI, 'enabled', { enumerable: true, get: function () { return state.enabled !== false; } });
  Object.defineProperty(TeamAPI, 'settings', { enumerable: true, get: function () { return clone(state.settings); } });
  Object.defineProperty(TeamAPI, 'base', { enumerable: true, get: function () { return state.base; } });

  global.TeamAPI = TeamAPI;
})(typeof window !== 'undefined' ? window : this);
