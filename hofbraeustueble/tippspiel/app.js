/*
 * Hofbräustüble – Stüble-Tippspiel: Spieler-App
 * Daten ausschließlich über window.TippAPI (js/tipp-client.js), Vertrag: SPEC.md
 * Keine Abhängigkeiten, keine externen Requests.
 */
(function () {
  'use strict';

  var API = window.TippAPI;
  var BASE = '../cms/tipp-api.php';
  var PRIVACY_URL = '../variante-1/index.html#datenschutz';
  var ADMIN_URL = '../admin/#tippspiel';
  var ROUTES = ['tippen', 'rangliste', 'statistik', 'profil'];
  var OWNER_ROUTES = ['spiele', 'rangliste', 'statistik']; // Wirt-Ansicht: nur ansehen
  var TITLES = { tippen: 'Tippen', rangliste: 'Rangliste', statistik: 'Statistik', profil: 'Profil', spiele: 'Spiele' };
  var NAV = {
    player: [['tippen', 'ball', 'Tippen'], ['rangliste', 'table', 'Rangliste'], ['statistik', 'chart', 'Statistik'], ['profil', 'user', 'Profil']],
    owner: [['spiele', 'ball', 'Spiele'], ['rangliste', 'table', 'Rangliste'], ['statistik', 'chart', 'Statistik']]
  };
  var VIEW_PREF = 'hbs_tipp_view'; // sessionStorage: „owner“ = Wirt-Ansicht bevorzugt (wenn beide Anmeldungen bestehen)
  var LIVE_WINDOW_MIN = 150;
  var SAVE_DELAY = 650;
  var REFRESH_MS = 60000;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ================================================================ Zustand */

  var S = {
    player: null, mode: null, settings: { points_exact: 4, points_diff: 3, points_tendency: 2 },
    admin: false, owner: false, navKey: null,
    route: null, authTab: null, inviteCode: '', inviteState: null, inviteTimer: null, inviteSeq: 0,
    comps: [], matches: [], loadedAt: 0, loading: null, skew: 0,
    filter: 'offen', compFilter: 'all',
    lbComp: null, statComp: null, lb: {}, lbAll: null,
    drafts: {}, bonusDraft: {}, firstRender: true, deleteStep: false
  };

  /* ================================================================ Hilfen */

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function icon(id, cls) { return '<svg class="ico' + (cls ? ' ' + cls : '') + '" aria-hidden="true" focusable="false"><use href="#i-' + id + '"/></svg>'; }
  function hasRes(m) { return m.home_goals !== null && m.home_goals !== undefined && m.away_goals !== null && m.away_goals !== undefined; }
  function dec(n, d) { return Number(n || 0).toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function plural(n, one, many) { return n === 1 ? one : many; }
  function initials(name) {
    var w = String(name).replace(/[^A-Za-z0-9ÄÖÜäöüß ]/g, ' ').trim().split(/\s+/);
    var second = w.length > 1 && /[A-Za-zÄÖÜäöüß]/.test(w[1].charAt(0)) ? w[1].charAt(0) : (w[0] || '').charAt(1);
    var s = (w[0] || '?').charAt(0) + (second || '');
    return s.toUpperCase();
  }
  function hue(name) {
    var h = 0, s = String(name);
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h % 360;
  }
  var PREFIX = /^(1\.|fc|sc|sv|vfb|vfl|tsg|rb|fsv|sg|bv|tsv|ac|as|ss|cf|ssc|afc|sk|fk|bsc|1)$/i;
  function teamAbbr(name) {
    var words = String(name).split(/\s+/).filter(function (w) { return w && !PREFIX.test(w); });
    var w = (words[0] || String(name)).replace(/[^A-Za-zÄÖÜäöüß0-9]/g, '');
    return (w.slice(0, 3) || '?').toUpperCase();
  }
  function crest(name) { return '<span class="crest" style="--h:' + hue(name) + '" aria-hidden="true">' + esc(teamAbbr(name)) + '</span>'; }
  function avatar(name, cls, extraStyle) {
    return '<span class="' + cls + '" style="background:hsl(' + hue(name) + ' 30% 30%)' + (extraStyle || '') + '" aria-hidden="true">' + esc(initials(name)) + '</span>';
  }

  /* --- Zeit (Wanduhr Europe/Berlin, „naiv“ als UTC gerechnet) --- */
  function naiveMs(str) {
    var m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(str || '');
    if (!m) return NaN;
    return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
  }
  function clientBerlinMs() { return naiveMs(API.util.berlinNow()); }
  function nowMs() { return clientBerlinMs() + S.skew; }
  function syncClock(serverTime) {
    var s = naiveMs(serverTime);
    if (isFinite(s)) S.skew = s - clientBerlinMs();
  }
  var DAY = 86400000;
  var WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  var WD_LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  var MON = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  function kParts(k) {
    var ms = naiveMs(k), d = new Date(ms);
    return { ms: ms, day: Math.floor(ms / DAY), wd: d.getUTCDay(), d: d.getUTCDate(), mo: d.getUTCMonth() + 1, y: d.getUTCFullYear(), time: k.slice(11, 16) };
  }
  function dayWord(k) {
    var p = kParts(k), diff = p.day - Math.floor(nowMs() / DAY);
    if (diff === 0) return 'Heute';
    if (diff === 1) return 'Morgen';
    if (diff === -1) return 'Gestern';
    return WD[p.wd] + ', ' + p.d + '.' + p.mo + '.';
  }
  function kickShort(k) { return dayWord(k) + ' · ' + kParts(k).time; }
  function kickLong(k) { var p = kParts(k); return WD_LONG[p.wd] + ', ' + p.d + '. ' + MON[p.mo - 1] + ' ' + p.y + ', ' + p.time + ' Uhr'; }
  function untilText(k) {
    var ms = naiveMs(k) - nowMs();
    if (!(ms > 0)) return null;
    var min = Math.floor(ms / 60000);
    if (min < 60) return Math.max(1, min) + ' Min.';
    var h = Math.floor(min / 60);
    if (h < 3) return h + ' Std. ' + (min % 60) + ' Min.';
    if (h < 24) return h + ' Std.';
    var d = Math.floor(h / 24);
    return d + ' ' + plural(d, 'Tag', 'Tagen');
  }
  function deadlineBadge(k) {
    var ms = naiveMs(k) - nowMs();
    if (!(ms > 0) || ms > DAY) return '';
    var cls = ms < 3 * 3600000 ? 'badge--urgent' : 'badge--soon';
    return '<span class="badge ' + cls + '">' + icon('clock') + 'Tippschluss in ' + untilText(k) + '</span>';
  }
  function phase(m) {
    if (!m.locked) return 'open';
    if (hasRes(m)) return 'done';
    return (nowMs() - naiveMs(m.kickoff)) < LIVE_WINDOW_MIN * 60000 ? 'live' : 'pending';
  }

  /* --- Fehler --- */
  function errText(e) {
    if (!e) return 'Unbekannter Fehler.';
    if (e.status === 0) return 'Keine Verbindung – bitte prüf dein Netz und versuch es nochmal.';
    return e.message || 'Da ist etwas schiefgelaufen.';
  }
  function isAuthError(e) { return e && e.status === 401; }

  /* ================================================================ Toasts */

  function toast(msg, type) {
    var box = $('#toasts');
    var el = document.createElement('div');
    el.className = 'toast' + (type ? ' toast--' + type : '');
    el.innerHTML = (type === 'error' ? icon('x') : icon('check')) + '<span>' + esc(msg) + '</span>';
    box.appendChild(el);
    setTimeout(function () {
      el.classList.add('is-out');
      setTimeout(function () { el.remove(); }, 300);
    }, type === 'error' ? 5200 : 3200);
  }

  /* ================================================================ Chrome / Navigation */

  function navHtml(tab) {
    return NAV[S.owner ? 'owner' : 'player'].map(function (n) {
      return '<a href="#/' + n[0] + '" data-route="' + n[0] + '">' + icon(n[1]) + (tab ? '<span>' + n[2] + '</span>' : n[2]) + '</a>';
    }).join('');
  }
  function updateChrome() {
    var logged = !!S.player || S.owner;
    document.body.classList.toggle('logged-out', !logged);
    document.body.classList.toggle('is-owner', S.owner);
    var navKey = S.owner ? 'owner' : 'player';
    if (S.navKey !== navKey) {
      S.navKey = navKey;
      $('#tabbar').innerHTML = navHtml(true);
      $('#topnav').innerHTML = navHtml(false);
      $('#tabbar').classList.toggle('tabbar--3', S.owner);
      $('#brand-link').setAttribute('href', S.owner ? '#/spiele' : '#/tippen');
    }
    $('#tabbar').hidden = !logged;
    $('#topnav').hidden = !logged;
    $('#owner-bar').hidden = !S.owner;
    var tg = $('#view-toggle');
    tg.hidden = !(S.player && S.admin);
    tg.innerHTML = icon(S.owner ? 'user' : 'eye') + '<span>' + (S.owner ? 'Als Spieler' : 'Als Wirt ansehen') + '</span>';
    tg.setAttribute('aria-label', S.owner ? 'Zurück zur Spieler-Ansicht' : 'Tippspiel als Wirt ansehen (nur lesen)');
    document.body.classList.toggle('has-toggle', !tg.hidden);
    var demo = S.mode === 'demo';
    $('#demo-ribbon').hidden = !demo;
    document.body.classList.toggle('has-ribbon', demo);
    $('#demo-guest').hidden = !demo || !!S.player;
    $$('#tabbar a, #topnav a').forEach(function (a) {
      if (logged && a.getAttribute('data-route') === S.route) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    document.title = (logged && S.route ? TITLES[S.route] + ' · ' : '') + (S.owner ? 'Wirt-Ansicht · ' : '') + 'Stüble-Tippspiel · Hofbräustüble';
  }

  function parseHash() { return location.hash.replace(/^#\/?/, '').split(/[?/]/)[0].toLowerCase(); }

  function onRoute() {
    closeSheet(true);
    flushDrafts();
    var r = parseHash();
    if (S.owner) {
      var oroute = OWNER_ROUTES.indexOf(r) >= 0 ? r : 'spiele';
      if (oroute !== r) history.replaceState(null, '', '#/' + oroute);
      S.route = oroute;
      updateChrome();
      VIEWS[oroute]();
      afterNav();
      return;
    }
    if (!S.player) {
      S.route = null;
      if (r === 'registrieren') S.authTab = 'register';
      else if (r === 'anmelden') S.authTab = 'login';
      if (!S.authTab) S.authTab = S.inviteCode ? 'register' : 'login';
      updateChrome();
      renderStart();
      afterNav();
      return;
    }
    var route = ROUTES.indexOf(r) >= 0 ? r : 'tippen';
    if (route !== r) history.replaceState(null, '', '#/' + route);
    S.route = route;
    updateChrome();
    VIEWS[route]();
    afterNav();
  }
  function afterNav() {
    if (S.firstRender) { S.firstRender = false; return; }
    window.scrollTo(0, 0);
    var h = $('#view h1');
    if (h) h.focus({ preventScroll: true });
  }
  function go(route) {
    if (parseHash() === route) onRoute();
    else location.hash = '#/' + route;
  }

  function mount(html) {
    var v = $('#view');
    v.innerHTML = html;
    return v;
  }
  function skeleton(n) {
    var s = '<div class="skeleton" aria-hidden="true"><div class="sk sk--short"></div>';
    for (var i = 0; i < (n || 3); i++) s += '<div class="sk"></div>';
    return s + '</div><p class="sr-only" role="status">Wird geladen …</p>';
  }
  function loadError(e, retryId) {
    return '<div class="card empty" role="alert">' + emptyArt('glass') +
      '<h2>' + (e && e.status === 0 ? 'Keine Verbindung' : 'Das hat nicht geklappt') + '</h2><p>' + esc(errText(e)) + '</p>' +
      '<button type="button" class="btn btn--secondary" id="' + retryId + '">' + icon('retry') + 'Nochmal versuchen</button></div>';
  }

  function sessionExpired() {
    resetData();
    if (S.owner) {
      // Wirt-Ansicht: die Verwaltung ist abgemeldet (Sitzung abgelaufen) → zurück zur normalen App
      S.owner = false; S.admin = false;
      setViewPref(false);
      toast('Die Verwaltung ist abgemeldet – Wirt-Ansicht beendet.', 'error');
      location.hash = S.player ? '#/tippen' : '#/anmelden';
      onRoute();
      return;
    }
    S.player = null;
    toast('Bitte melde dich (wieder) an.', 'error');
    if (S.admin) { S.owner = true; location.hash = '#/spiele'; onRoute(); return; }
    S.authTab = 'login';
    location.hash = '#/anmelden';
    onRoute();
  }
  /** Lese-Anfragen: in der Wirt-Ansicht ausdrücklich als Wirt (auch wenn zusätzlich ein Spieler angemeldet ist) */
  function rq(data) {
    var d = data || {};
    if (S.owner) d.view = 'owner';
    return d;
  }
  function setViewPref(owner) {
    try { if (owner) sessionStorage.setItem(VIEW_PREF, 'owner'); else sessionStorage.removeItem(VIEW_PREF); } catch (e) { /* egal */ }
  }
  function getViewPref() {
    try { return sessionStorage.getItem(VIEW_PREF) === 'owner'; } catch (e) { return false; }
  }
  /** Umschalten zwischen Spieler-App und Wirt-Ansicht (nur wenn beide Anmeldungen bestehen) */
  function setOwner(on) {
    flushDrafts();
    closeSheet(true);
    S.owner = !!on && S.admin;
    setViewPref(S.owner);
    resetData();
    S.firstRender = false;
    var target = S.owner ? 'spiele' : 'tippen';
    if (parseHash() === target) onRoute(); else location.hash = '#/' + target;
  }
  function resetData() {
    S.comps = []; S.matches = []; S.loadedAt = 0; S.lb = {}; S.lbAll = null; S.drafts = {}; S.bonusDraft = {};
    S.lbComp = null; S.statComp = null; S.filter = 'offen'; S.compFilter = 'all'; S.deleteStep = false;
  }

  /* ================================================================ Daten */

  function loadMatches(force) {
    if (!force && S.loadedAt && Date.now() - S.loadedAt < REFRESH_MS) return Promise.resolve();
    if (S.loading) return S.loading;
    var asOwner = S.owner;
    S.loading = API.call('matches', rq()).then(function (r) {
      if (r.serverTime) syncClock(r.serverTime);
      if (asOwner !== S.owner) return; // inzwischen umgeschaltet
      S.comps = r.competitions || [];
      S.matches = r.matches || [];
      S.loadedAt = Date.now();
      // fertige Entwürfe verwerfen, offene behalten
      Object.keys(S.drafts).forEach(function (id) {
        var d = S.drafts[id];
        if (!d.inflight && d.state !== 'dirty' && d.state !== 'error') delete S.drafts[id];
      });
    }).finally(function () { S.loading = null; });
    return S.loading;
  }
  function loadLeaderboard(key, force) {
    if (!force && S.lb[key] && Date.now() - S.lb[key].at < REFRESH_MS) return Promise.resolve(S.lb[key].data);
    var asOwner = S.owner;
    return API.call('leaderboard', rq(key === 'all' ? {} : { competition_id: key })).then(function (r) {
      if (asOwner === S.owner) S.lb[key] = { at: Date.now(), data: r };
      return r;
    });
  }
  function findMatch(id) { id = +id; for (var i = 0; i < S.matches.length; i++) if (S.matches[i].id === id) return S.matches[i]; return null; }
  function findComp(id) { id = +id; for (var i = 0; i < S.comps.length; i++) if (S.comps[i].id === id) return S.comps[i]; return null; }
  function myRow(lb) { var r = null; (lb && lb.rows || []).forEach(function (x) { if (x.is_me) r = x; }); return r; }

  /* ================================================================ Illustrationen */

  function emptyArt(kind) {
    if (kind === 'chart') {
      return '<svg class="empty__art" viewBox="0 0 120 96" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
        '<rect x="10" y="8" width="100" height="72" rx="6" stroke-opacity=".5"/><path d="M22 66l20-18 16 10 24-26 16 10" stroke-dasharray="4 6"/>' +
        '<circle cx="42" cy="48" r="3"/><circle cx="58" cy="58" r="3"/><circle cx="82" cy="32" r="3"/><path d="M40 88h40" stroke-opacity=".5"/></svg>';
    }
    if (kind === 'whistle') {
      return '<svg class="empty__art" viewBox="0 0 120 96" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<circle cx="60" cy="50" r="28" stroke-opacity=".55"/><path d="M60 34l13 9.5-5 15.5H52l-5-15.5z"/><path d="M60 22v12M73 43.5l13-4.5M68 59l8 11M52 59l-8 11M47 43.5l-13-4.5"/></svg>';
    }
    return '<svg class="empty__art" viewBox="0 0 120 96" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M40 22h36l-4 64H44z" stroke-opacity=".8"/><path d="M76 34h8a6 6 0 0 1 6 6v18a6 6 0 0 1-6 6h-9"/>' +
      '<path d="M38 22c-3-8 6-13 12-9 3-6 14-6 16 0 6-3 14 2 10 9" stroke-opacity=".6"/><path d="M50 70h16" stroke-opacity=".4"/></svg>';
  }

  function pint(done, total) {
    var p = total > 0 ? done / total : 0;
    var top = 10, bottom = 80, h = (bottom - top) * p;
    var y = bottom - h;
    var foam = '';
    if (p > 0) {
      foam = '<g fill="#f7efdc">';
      for (var i = 0; i < 6; i++) foam += '<circle cx="' + (8 + i * 8.6) + '" cy="' + (y - 1 + (i % 2 ? 1.5 : -0.5)) + '" r="' + (i % 2 ? 5 : 6) + '"/>';
      foam += '<rect x="4" y="' + (y - 2) + '" width="52" height="5"/></g>';
    }
    return '<div class="pint" role="img" aria-label="' + done + ' von ' + total + ' offenen Spielen getippt">' +
      '<svg viewBox="0 0 64 86" aria-hidden="true">' +
      '<defs><clipPath id="pintClip"><path d="M8 4h44l-5.2 74.5a4 4 0 0 1-4 3.5H17.2a4 4 0 0 1-4-3.5z"/></clipPath>' +
      '<linearGradient id="beerGrad" x1="0" x2="1"><stop offset="0" stop-color="#c9781f"/><stop offset=".45" stop-color="#f2b54c"/><stop offset="1" stop-color="#c47320"/></linearGradient></defs>' +
      '<g clip-path="url(#pintClip)"><rect x="0" y="0" width="64" height="86" fill="rgba(255,255,255,.03)"/>' +
      (p > 0 ? '<g class="pint__beer' + (reduceMotion ? '' : ' grow-y') + '"><rect x="0" y="' + y + '" width="64" height="' + (86 - y) + '" fill="url(#beerGrad)"/>' +
        '<circle cx="24" cy="' + Math.min(76, y + 18) + '" r="1.4" fill="#fff6" /><circle cx="36" cy="' + Math.min(72, y + 30) + '" r="1" fill="#fff6"/><circle cx="30" cy="' + Math.min(78, y + 40) + '" r="1.2" fill="#fff5"/>' + foam + '</g>' : '') +
      '</g><path d="M8 4h44l-5.2 74.5a4 4 0 0 1-4 3.5H17.2a4 4 0 0 1-4-3.5z" fill="none" stroke="rgba(243,238,229,.75)" stroke-width="2.2"/>' +
      '<path d="M14 12l3 62" stroke="rgba(255,255,255,.22)" stroke-width="2.5" stroke-linecap="round"/></svg>' +
      '<span class="pint__label' + (p < 0.3 ? ' is-empty' : '') + '" aria-hidden="true">' + done + '/' + total + '</span></div>';
  }

  function saveGlass() {
    return '<svg class="save__glass" viewBox="0 0 16 21" aria-hidden="true">' +
      '<defs><clipPath id="sg"><path d="M2.5 4h11l-1.2 14.6a1.5 1.5 0 0 1-1.5 1.4H5.2a1.5 1.5 0 0 1-1.5-1.4z"/></clipPath></defs>' +
      '<g clip-path="url(#sg)"><rect class="beer" x="0" y="6" width="16" height="15" fill="#e9a23b" style="transform-box:fill-box;transform-origin:50% 100%"/></g>' +
      '<g class="foam" fill="#f7efdc" style="transform-box:fill-box"><circle cx="4.5" cy="5" r="2.6"/><circle cx="8" cy="4.2" r="3"/><circle cx="11.5" cy="5" r="2.6"/></g>' +
      '<path d="M2.5 4h11l-1.2 14.6a1.5 1.5 0 0 1-1.5 1.4H5.2a1.5 1.5 0 0 1-1.5-1.4z" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
  }

  function rulesCard() {
    var s = S.settings;
    return '<section class="chalk" aria-labelledby="rules-title">' +
      '<h2 class="chalk__title" id="rules-title">So gibt’s Punkte</h2>' +
      '<div class="chalk__rows">' +
      '<div class="chalk__row"><div class="chalk__pts chalk__pts--exact">' + s.points_exact + '<small>Pkt.</small></div><p><b>Volltreffer</b> – genau das Ergebnis<br><span>Tipp 2:1, Ergebnis 2:1</span></p></div>' +
      '<div class="chalk__row"><div class="chalk__pts">' + s.points_diff + '<small>Pkt.</small></div><p><b>Tordifferenz</b> – Sieger und Abstand stimmen<br><span>Tipp 3:2, Ergebnis 2:1</span></p></div>' +
      '<div class="chalk__row"><div class="chalk__pts">' + s.points_tendency + '<small>Pkt.</small></div><p><b>Tendenz</b> – richtiger Sieger oder Remis<br><span>Tipp 1:0, Ergebnis 3:1 · Tipp 1:1, Ergebnis 2:2</span></p></div>' +
      '</div><p class="chalk__note">Tippschluss ist der Anstoß. Bis dahin kannst du deinen Tipp so oft ändern, wie du willst. Die Tipps der anderen siehst du erst danach.</p>' +
      '<span class="chalk__sponge" aria-hidden="true"></span></section>';
  }

  /* ================================================================ Start / Anmeldung */

  function renderStart() {
    var reg = S.authTab === 'register';
    var demo = S.mode === 'demo';
    var html = '<div class="view start">' +
      '<section class="hero" aria-labelledby="start-title">' +
      '<p class="eyebrow hero__kicker">Hofbräustüble · Amorbach</p>' +
      '<h1 class="hero__title" id="start-title" tabindex="-1"><em>Das Stüble-</em>Tippspiel</h1>' +
      '<p class="hero__text">Tipp die Spiele, die bei uns auf Sky laufen – Bundesliga, Champions League, EM &amp; WM. Sammel Punkte und kletter in der Stammtisch-Tabelle nach oben. Ruhm und Ehre gibt’s an der Theke.</p>' +
      '<div class="pills"><span class="pill pill--free">' + icon('check') + 'Kostenlos, kein Geldeinsatz</span>' +
      '<span class="pill">' + icon('key') + 'Nur mit Einladung</span><span class="pill">' + icon('beer') + 'Für Stammgäste ab 18</span></div>' +
      '<ol class="steps" aria-label="So funktioniert’s">' +
      '<li class="step-item"><span class="step-item__num" aria-hidden="true">1</span><div><h3>Einladungscode holen</h3><p>Gibt’s an der Theke oder per Link vom Wirt. Damit meldest du dich einmal an – fertig.</p></div></li>' +
      '<li class="step-item"><span class="step-item__num" aria-hidden="true">2</span><div><h3>Ergebnisse tippen</h3><p>Mit + und − deinen Tipp einstellen, er wird sofort gespeichert. Ändern geht bis zum Anstoß.</p></div></li>' +
      '<li class="step-item"><span class="step-item__num" aria-hidden="true">3</span><div><h3>Punkte sammeln</h3><p>' + S.settings.points_exact + ' Punkte fürs exakte Ergebnis, ' + S.settings.points_diff + ' für die Tordifferenz, ' + S.settings.points_tendency + ' für die richtige Tendenz.</p></div></li>' +
      '</ol></section>' +
      '<section class="card auth" aria-label="Anmelden oder registrieren">' +
      '<div class="auth__tabs segmented" role="tablist" aria-label="Anmelden oder registrieren">' +
      '<button type="button" role="tab" id="tab-login" aria-controls="auth-panel" aria-selected="' + (!reg) + '" data-auth="login" tabindex="' + (reg ? -1 : 0) + '">Anmelden</button>' +
      '<button type="button" role="tab" id="tab-register" aria-controls="auth-panel" aria-selected="' + reg + '" data-auth="register" tabindex="' + (reg ? 0 : -1) + '">Neu dabei</button>' +
      '</div><div class="auth__panel" id="auth-panel" role="tabpanel" aria-labelledby="' + (reg ? 'tab-register' : 'tab-login') + '">' +
      (reg ? registerForm() : loginForm()) + '</div></section></div>';
    mount(html);
    bindStart();
  }

  function pwField(id, label, autocomplete, hint) {
    return '<div class="field"><label class="field__label" for="' + id + '">' + label + '</label><div class="field__control">' +
      '<input class="input has-toggle" id="' + id + '" name="' + id + '" type="password" autocomplete="' + autocomplete + '" required' + (hint ? ' aria-describedby="' + id + '-hint"' : '') + ' minlength="' + (autocomplete === 'new-password' ? 8 : 1) + '">' +
      '<button type="button" class="field__toggle" data-toggle-pw="' + id + '" aria-pressed="false" aria-label="Passwort anzeigen">' + icon('eye') + '</button></div>' +
      (hint ? '<p class="field__hint" id="' + id + '-hint">' + hint + '</p>' : '') + '</div>';
  }

  function loginForm() {
    var demo = S.mode === 'demo';
    return '<form id="login-form" novalidate>' +
      '<h2 class="auth__title">Servus, schön dass du da bist</h2><p class="auth__lead">Melde dich mit deinem Nickname an.</p>' +
      '<div class="field"><label class="field__label" for="login-nick">Nickname</label>' +
      '<input class="input" id="login-nick" name="nickname" autocomplete="username" autocapitalize="none" spellcheck="false" required maxlength="40"></div>' +
      pwField('login-pw', 'Passwort', 'current-password') +
      '<div id="login-error" role="alert"></div>' +
      '<button class="btn btn--primary btn--block" type="submit" style="margin-top:18px">Anmelden</button>' +
      '<p class="auth__foot">Passwort vergessen? Sag an der Theke Bescheid – der Wirt setzt es dir zurück.</p>' +
      '<p class="auth__owner"><a href="' + ADMIN_URL + '">' + icon('eye') + 'Als Wirt ansehen</a></p>' +
      (demo ? '<div class="demo-box"><p>Nur mal schauen? Im Demo-Modus kannst du dich als <b>Gast</b> mit Passwort <code>demo1234</code> anmelden.</p>' +
        '<button type="button" class="btn btn--secondary btn--block" data-demo-login>' + icon('beer') + 'Als Gast einloggen</button></div>' : '') +
      '</form>';
  }

  function registerForm() {
    var code = S.inviteCode || '';
    return '<form id="register-form" novalidate>' +
      '<h2 class="auth__title">Mitmachen</h2><p class="auth__lead">Einmal registrieren, dann kannst du loslegen. Dauert keine Minute.</p>' +
      '<div class="field"><label class="field__label" for="reg-code">Einladungscode</label><div class="field__control">' +
      '<input class="input input--code" id="reg-code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" required maxlength="20" value="' + esc(code) + '" aria-describedby="reg-code-hint" placeholder="XXXXXXXX">' +
      '<span class="field__state" id="reg-code-state" aria-hidden="true"></span></div>' +
      '<p class="field__hint" id="reg-code-hint" aria-live="polite">Steht auf deiner Einladung oder kommt per Link.</p></div>' +
      '<div class="field"><label class="field__label" for="reg-nick">Nickname <small>2–24 Zeichen</small></label>' +
      '<input class="input" id="reg-nick" name="nickname" autocomplete="username" autocapitalize="none" spellcheck="false" required maxlength="24" aria-describedby="reg-nick-hint">' +
      '<p class="field__hint" id="reg-nick-hint">So stehst du in der Rangliste – z.&nbsp;B. „Theken-Toni“. Buchstaben, Ziffern, Leerzeichen und _ - . sind erlaubt.</p></div>' +
      pwField('reg-pw', 'Passwort', 'new-password', 'Mindestens 8 Zeichen.') +
      '<div class="field"><label class="field__label" for="reg-mail">E-Mail <small>freiwillig</small></label>' +
      '<input class="input" id="reg-mail" name="email" type="email" autocomplete="email" inputmode="email" maxlength="150" aria-describedby="reg-mail-hint">' +
      '<p class="field__hint" id="reg-mail-hint">Nur damit wir dich bei Fragen zum Tippspiel erreichen können. Kein Newsletter, keine Weitergabe – du kannst das Feld auch leer lassen.</p></div>' +
      '<div id="register-error" role="alert"></div>' +
      '<button class="btn btn--primary btn--block" type="submit" style="margin-top:18px">Konto anlegen &amp; lostippen</button>' +
      '<p class="legal-note">' + icon('shield') + '<span>Reines Spaß-Spiel unter Stammgästen: keine Einsätze, kein Geld, keine Gewinne – nur Punkte und Ehre. In der Rangliste steht nur dein Nickname. <a href="' + PRIVACY_URL + '">Datenschutz</a></span></p>' +
      '</form>';
  }

  function bindStart() {
    var v = $('#view');
    $$('[data-auth]', v).forEach(function (b) {
      b.addEventListener('click', function () { switchAuth(b.getAttribute('data-auth'), true); });
      b.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); switchAuth(S.authTab === 'login' ? 'register' : 'login', true, true); }
      });
    });
    bindPwToggles(v);
    var lf = $('#login-form');
    if (lf) lf.addEventListener('submit', onLogin);
    var dl = $('[data-demo-login]', v);
    if (dl) dl.addEventListener('click', demoGuestLogin);
    var rf = $('#register-form');
    if (rf) {
      rf.addEventListener('submit', onRegister);
      var code = $('#reg-code');
      code.addEventListener('input', function () { S.inviteCode = code.value; scheduleInviteCheck(); });
      if (code.value.trim()) checkInvite();
    }
  }
  function switchAuth(tab, focusTab, viaKey) {
    if (S.authTab === tab) return;
    S.authTab = tab;
    var hash = tab === 'register' ? '#/registrieren' : '#/anmelden';
    history.replaceState(null, '', location.pathname + location.search + hash);
    renderStart();
    if (focusTab) { var t = $('#tab-' + tab); if (t) t.focus(); }
  }
  function bindPwToggles(root) {
    $$('[data-toggle-pw]', root).forEach(function (b) {
      b.addEventListener('click', function () {
        var inp = document.getElementById(b.getAttribute('data-toggle-pw'));
        var show = inp.type === 'password';
        inp.type = show ? 'text' : 'password';
        b.setAttribute('aria-pressed', String(show));
        b.setAttribute('aria-label', show ? 'Passwort verbergen' : 'Passwort anzeigen');
        b.innerHTML = icon(show ? 'eye-off' : 'eye');
      });
    });
  }
  function formError(id, msg) {
    var el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = msg ? '<div class="form-error">' + icon('info') + '<span>' + esc(msg) + '</span></div>' : '';
  }
  function busy(btn, on) {
    if (!btn) return;
    btn.disabled = !!on;
    btn.classList.toggle('is-busy', !!on);
    btn.setAttribute('aria-busy', on ? 'true' : 'false');
  }

  function scheduleInviteCheck() {
    clearTimeout(S.inviteTimer);
    setInviteState('', '');
    S.inviteTimer = setTimeout(checkInvite, 450);
  }
  function setInviteState(state, msg) {
    var st = $('#reg-code-state'), hint = $('#reg-code-hint'), inp = $('#reg-code');
    if (!st) return;
    st.className = 'field__state' + (state ? ' is-' + state : '');
    st.innerHTML = state === 'ok' ? icon('check') : state === 'bad' ? icon('x') : '';
    hint.className = 'field__hint' + (state === 'ok' ? ' is-ok' : state === 'bad' ? ' is-bad' : '');
    hint.textContent = msg || 'Steht auf deiner Einladung oder kommt per Link.';
    inp.setAttribute('aria-invalid', state === 'bad' ? 'true' : 'false');
  }
  function checkInvite() {
    var inp = $('#reg-code');
    if (!inp) return;
    var code = inp.value.replace(/[\s-]+/g, '').toUpperCase();
    if (code.length < 4) { S.inviteState = null; setInviteState('', ''); return; }
    var seq = ++S.inviteSeq;
    setInviteState('wait', 'Code wird geprüft …');
    API.call('invite_check', { code: code }).then(function (r) {
      if (seq !== S.inviteSeq) return;
      S.inviteState = r.valid ? 'ok' : 'bad';
      setInviteState(S.inviteState, r.valid ? 'Passt! Der Code ist gültig.' : 'Diesen Code kennen wir nicht – oder er ist abgelaufen bzw. schon aufgebraucht.');
    }).catch(function (e) {
      if (seq !== S.inviteSeq) return;
      S.inviteState = null;
      setInviteState(e.status === 429 ? 'bad' : '', e.status === 429 ? errText(e) : 'Code konnte gerade nicht geprüft werden.');
    });
  }

  function onLogin(e) {
    e.preventDefault();
    var f = e.target, btn = $('button[type=submit]', f);
    var nick = $('#login-nick').value.trim(), pw = $('#login-pw').value;
    if (!nick || !pw) { formError('login-error', 'Bitte Nickname und Passwort eingeben.'); (nick ? $('#login-pw') : $('#login-nick')).focus(); return; }
    formError('login-error', '');
    busy(btn, true);
    API.call('login', { nickname: nick, password: pw }).then(function (st) {
      loggedIn(st, 'Servus ' + st.player.nickname + ', schön dass du da bist!');
    }).catch(function (err) {
      busy(btn, false);
      formError('login-error', errText(err));
    });
  }
  function onRegister(e) {
    e.preventDefault();
    var f = e.target, btn = $('button[type=submit]', f);
    var code = $('#reg-code').value.trim(), nick = $('#reg-nick').value.trim(), pw = $('#reg-pw').value, mail = $('#reg-mail').value.trim();
    var msg = null, focus = null;
    if (!code) { msg = 'Bitte gib deinen Einladungscode ein.'; focus = '#reg-code'; }
    else if (S.inviteState === 'bad') { msg = 'Der Einladungscode ist ungültig, abgelaufen oder schon aufgebraucht.'; focus = '#reg-code'; }
    else if (Array.from(nick).length < 2 || Array.from(nick).length > 24) { msg = 'Der Nickname muss 2 bis 24 Zeichen lang sein.'; focus = '#reg-nick'; }
    else if (Array.from(pw).length < 8) { msg = 'Das Passwort muss mindestens 8 Zeichen lang sein.'; focus = '#reg-pw'; }
    else if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) { msg = 'Die E-Mail-Adresse sieht nicht richtig aus – oder lass das Feld einfach leer.'; focus = '#reg-mail'; }
    if (msg) { formError('register-error', msg); $(focus).focus(); return; }
    formError('register-error', '');
    busy(btn, true);
    var data = { code: code, nickname: nick, password: pw };
    if (mail) data.email = mail;
    API.call('register', data).then(function (st) {
      loggedIn(st, 'Willkommen am Stammtisch, ' + st.player.nickname + '!');
    }).catch(function (err) {
      busy(btn, false);
      formError('register-error', errText(err));
    });
  }
  function demoGuestLogin() {
    API.call('login', { nickname: 'Gast', password: 'demo1234' }).then(function (st) {
      loggedIn(st, 'Eingeloggt als Gast – viel Spaß beim Ausprobieren!');
    }).catch(function (e) { toast(errText(e), 'error'); });
  }
  function loggedIn(st, msg) {
    S.player = st.player;
    S.owner = false;
    setViewPref(false);
    if ('admin' in st) S.admin = !!st.admin;
    if (st.settings) S.settings = st.settings;
    if (st.serverTime) syncClock(st.serverTime);
    resetData();
    S.authTab = null;
    toast(msg, 'ok');
    var r = parseHash();
    history.replaceState(null, '', location.pathname + '#/' + (ROUTES.indexOf(r) >= 0 ? r : 'tippen'));
    onRoute();
  }

  /* ================================================================ Tippen */

  function viewTippen() {
    mount('<div class="view tippen">' +
      '<div class="tippen__summary" id="t-summary"></div>' +
      '<div class="tippen__main">' +
      '<div class="view-head"><h1 class="view-title" tabindex="-1">Tippen</h1></div>' +
      '<div class="toolbar" id="t-toolbar"></div><div id="t-list">' + skeleton(3) + '</div></div>' +
      '<div class="tippen__rules">' + rulesCard() + '</div></div>');
    bindTippen();
    loadMatches().then(function () {
      if (S.route !== 'tippen') return;
      renderTippen();
      loadLeaderboard('all').then(function (lb) { S.lbAll = lb; if (S.route === 'tippen') renderSummary(); }).catch(function () { /* optional */ });
    }).catch(function (e) {
      if (isAuthError(e)) return sessionExpired();
      $('#t-list').innerHTML = loadError(e, 't-retry');
      $('#t-retry').addEventListener('click', viewTippen);
    });
  }

  function renderTippen() {
    renderSummary();
    renderToolbar();
    renderList();
  }

  function compMatches() {
    return S.matches.filter(function (m) { return S.compFilter === 'all' || m.competition_id === S.compFilter; });
  }

  function renderSummary() {
    var box = $('#t-summary');
    if (!box) return;
    var open = S.matches.filter(function (m) { return !m.locked; });
    var tipped = open.filter(function (m) { return !!m.my_tip; });
    var missing = open.filter(function (m) { return !m.my_tip; });
    var next = missing[0];
    var line;
    if (!S.matches.length) line = 'Sobald der Wirt Spiele einträgt, kannst du hier tippen.';
    else if (!open.length) line = 'Gerade ist nichts offen – schau dir die Ergebnisse an.';
    else if (!missing.length) line = 'Glas voll! Alle ' + open.length + ' offenen Spiele sind getippt.';
    else line = tipped.length + ' von ' + open.length + ' offenen Spielen getippt – ' + missing.length + ' ' + plural(missing.length, 'fehlt', 'fehlen') + ' noch.';
    var me = myRow(S.lbAll);
    var hour = new Date().getHours();
    var greet = hour < 11 ? 'Guten Morgen' : hour >= 18 ? 'Guten Abend' : 'Servus';
    box.innerHTML = '<section class="card hello" aria-label="Dein Überblick">' +
      '<div><p class="hello__greet">' + greet + ', ' + esc(S.player.nickname) + '!</p>' +
      '<p class="hello__line">' + esc(line) + '</p>' +
      (next ? '<p class="hello__next">Als Nächstes: <b>' + esc(next.home) + ' – ' + esc(next.away) + '</b>, ' + esc(kickShort(next.kickoff)) + '</p>' : '') +
      '</div>' + pint(tipped.length, open.length) +
      '<div class="hello__stats">' +
      '<a class="mini-stat" href="#/rangliste"><div class="mini-stat__v">' + (me ? me.rank + '<small>.</small>' : '–') + '</div><div class="mini-stat__l">Platz</div></a>' +
      '<a class="mini-stat" href="#/statistik"><div class="mini-stat__v">' + (me ? me.points : '–') + '</div><div class="mini-stat__l">Punkte</div></a>' +
      '<div class="mini-stat"><div class="mini-stat__v">' + missing.length + '</div><div class="mini-stat__l">' + plural(missing.length, 'Tipp fehlt', 'Tipps fehlen') + '</div></div>' +
      '</div></section>';
  }

  function renderToolbar() {
    var bar = $('#t-toolbar');
    if (!bar) return;
    var ms = compMatches();
    var nOpen = ms.filter(function (m) { return !m.locked; }).length;
    var nLive = ms.filter(function (m) { return phase(m) === 'live'; }).length;
    var nRes = ms.filter(function (m) { return m.locked && phase(m) !== 'live'; }).length;
    var html = '';
    if (S.comps.length > 1) {
      html += '<div class="tabs" role="group" aria-label="Wettbewerb">' +
        '<button type="button" class="tab" data-comp="all" aria-selected="' + (S.compFilter === 'all') + '">Alle</button>' +
        S.comps.map(function (c) { return '<button type="button" class="tab" data-comp="' + c.id + '" aria-selected="' + (S.compFilter === c.id) + '" title="' + esc(c.name) + '">' + esc(tabLabel(c.name)) + '</button>'; }).join('') + '</div>';
    }
    html += '<div class="segmented" role="group" aria-label="Spiele filtern">' +
      fbtn('offen', 'Offen', nOpen + nLive) + fbtn('alle', 'Alle', null) + fbtn('ergebnisse', 'Ergebnisse', nRes) + '</div>';
    bar.innerHTML = html;
    function fbtn(key, label, n) {
      return '<button type="button" data-filter="' + key + '" aria-pressed="' + (S.filter === key) + '">' + label +
        (n ? ' <span class="count" aria-label="(' + n + ')">' + n + '</span>' : '') + '</button>';
    }
  }

  function groupBy(list, newestFirst) {
    var map = {}, out = [];
    list.forEach(function (m) {
      var key = m.competition_id + '|' + (m.round || '');
      if (!map[key]) { map[key] = { key: key, comp: findComp(m.competition_id), round: m.round || '', items: [] }; out.push(map[key]); }
      map[key].items.push(m);
    });
    return out;
  }

  function renderList() {
    if (S.owner) { renderOwnerList(); return; }
    var box = $('#t-list');
    if (!box) return;
    var ms = compMatches();
    var live = ms.filter(function (m) { return phase(m) === 'live'; });
    var open = ms.filter(function (m) { return !m.locked; });
    var past = ms.filter(function (m) { return m.locked && phase(m) !== 'live'; }).slice().reverse();
    var multi = S.comps.length > 1 && S.compFilter === 'all';
    var html = '';
    var comps = S.compFilter === 'all' ? S.comps : S.comps.filter(function (c) { return c.id === S.compFilter; });

    // Bonusfragen
    comps.forEach(function (c) {
      if (!c.bonus_question) return;
      var show = S.filter === 'alle' || (S.filter === 'offen' ? !c.bonus_locked : c.bonus_locked);
      if (show) html += bonusCard(c, multi);
    });

    if (live.length && S.filter !== 'ergebnisse') {
      html += section('<span class="live-dot" aria-hidden="true"></span>Läuft gerade', null, live.length + ' ' + plural(live.length, 'Spiel', 'Spiele'), live);
    }
    if (S.filter !== 'ergebnisse') {
      groupBy(open).forEach(function (g) { html += groupHtml(g, multi); });
    }
    if (S.filter !== 'offen') {
      if (S.filter === 'alle' && past.length) html += '<h2 class="eyebrow" style="margin:26px 2px 0">Gespielt</h2>';
      groupBy(past).forEach(function (g) { html += groupHtml(g, multi); });
    }

    var count = (S.filter !== 'ergebnisse' ? live.length + open.length : 0) + (S.filter !== 'offen' ? past.length : 0);
    if (!count) {
      if (!S.matches.length) {
        html += '<div class="card empty">' + emptyArt('whistle') + '<h2>Noch keine Spiele</h2><p>Der Wirt trägt die nächsten Partien bald ein. Schau später wieder rein – oder frag an der Theke nach.</p></div>';
      } else if (S.filter === 'offen') {
        html += '<div class="card empty">' + emptyArt('glass') + '<h2>Alles getippt, nix mehr offen</h2><p>Gerade gibt es keine Spiele zum Tippen. Wie lief’s bisher?</p>' +
          '<button type="button" class="btn btn--secondary" data-filter="ergebnisse">Zu den Ergebnissen</button></div>';
      } else {
        html += '<div class="card empty">' + emptyArt('whistle') + '<h2>Noch keine Ergebnisse</h2><p>Sobald die ersten Spiele angepfiffen sind, findest du hier Ergebnisse, deine Punkte und die Stammtisch-Quote.</p></div>';
      }
    }
    // Quellenangabe, wenn Spielplan/Ergebnisse automatisch von OpenLigaDB kommen
    if (S.comps.some(function (c) { return c.source; })) {
      html += '<p class="foot-note">Spielplan &amp; Ergebnisse: <a href="https://www.openligadb.de/" target="_blank" rel="noopener">OpenLigaDB</a></p>';
    }
    box.innerHTML = html;
  }

  function section(titleHtml, eyebrow, meta, items) {
    return '<section class="group" aria-label="Läuft gerade"><div class="group__head"><h2 class="group__title">' + titleHtml + '</h2>' +
      (meta ? '<span class="group__meta">' + esc(meta) + '</span>' : '') + '</div><div class="group__list">' + items.map(matchCard).join('') + '</div></section>';
  }
  function groupHtml(g, multi) {
    var tippedN = g.items.filter(function (m) { return m.my_tip; }).length;
    var anyOpen = g.items.some(function (m) { return !m.locked; });
    var title = g.round || 'Spiele';
    var meta = g.items.length + ' ' + plural(g.items.length, 'Spiel', 'Spiele') + (anyOpen ? ' · ' + tippedN + ' getippt' : '');
    return '<section class="group" aria-label="' + esc(title) + '"><div class="group__head"><h2 class="group__title"><span>' +
      (multi && g.comp ? '<span class="eyebrow">' + esc(g.comp.name) + '</span>' : '') + esc(title) + '</span></h2>' +
      '<span class="group__meta"' + (anyOpen ? ' data-open-meta="' + g.items.length + '"' : '') + '>' + esc(meta) + '</span></div><div class="group__list">' + g.items.map(matchCard).join('') + '</div></section>';
  }

  function draftVal(m, side) {
    var d = S.drafts[m.id];
    if (d) return d[side];
    return m.my_tip ? m.my_tip[side] : '';
  }

  function matchCard(m) {
    var ph = phase(m);
    return ph === 'open' ? openCard(m) : lockedCard(m, ph);
  }

  var MINUS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12"/></svg>';
  var PLUS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v12M6 12h12"/></svg>';

  function openCard(m) {
    var tipped = !!m.my_tip;
    var d = S.drafts[m.id];
    return '<article class="card match match--open' + (tipped ? ' is-tipped' : '') + (d && d.state === 'error' ? ' has-error' : '') + '" data-mid="' + m.id + '" aria-label="' + esc(m.home + ' gegen ' + m.away + ', ' + kickLong(m.kickoff)) + '">' +
      '<div class="match__meta"><span class="match__when">' + icon('clock', 'ico--sm') + esc(dayWord(m.kickoff)) + ' <b>' + esc(kParts(m.kickoff).time) + '</b></span>' +
      '<span data-countdown="' + esc(m.kickoff) + '">' + deadlineBadge(m.kickoff) + '</span></div>' +
      teamRowOpen(m, 'home') + teamRowOpen(m, 'away') +
      '<div class="match__foot"><span class="match__count" data-count>' + countText(m) + '</span>' + saveHtml(m) + '</div></article>';
  }
  function countText(m) {
    var n = m.tip_count || 0;
    return icon('user', 'ico--sm') + (n ? n + ' ' + plural(n, 'Tipp', 'Tipps') + ' abgegeben' : 'Noch keine Tipps');
  }
  function teamRowOpen(m, side) {
    var name = side === 'home' ? m.home : m.away;
    var v = draftVal(m, side);
    return '<div class="team-row">' + crest(name) + '<span class="team-name">' + esc(name) + '</span>' +
      '<div class="stepper">' +
      '<button type="button" class="step step--minus" data-step="-1" data-side="' + side + '" aria-label="Ein Tor weniger für ' + esc(name) + '"' + (v === 0 ? ' disabled' : '') + '>' + MINUS + '</button>' +
      '<input class="goal" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" autocomplete="off" enterkeyhint="done" data-side="' + side + '" value="' + (v === '' ? '' : v) + '" placeholder="–" aria-label="Tore ' + esc(name) + '">' +
      '<button type="button" class="step step--plus" data-step="1" data-side="' + side + '" aria-label="Ein Tor mehr für ' + esc(name) + '"' + (v === 20 ? ' disabled' : '') + '>' + PLUS + '</button>' +
      '</div></div>';
  }

  var SAVE_TEXT = {
    none: 'Noch kein Tipp', tipped: '✓ Getippt', dirty: 'Wird gleich gespeichert …', saving: 'Speichert …', saved: '✓ Gespeichert'
  };
  function saveHtml(m) {
    var d = S.drafts[m.id];
    var st = d ? d.state : (m.my_tip ? 'tipped' : 'none');
    var txt = st === 'error' ? d.error : SAVE_TEXT[st];
    return '<p class="save" data-state="' + st + '" role="status" aria-live="polite">' + saveGlass() + '<span class="save__text">' + esc(txt) + '</span></p>' +
      (st === 'error' && d.retry ? '<button type="button" class="save__retry" data-retry>' + icon('retry') + 'Nochmal versuchen</button>' : '');
  }

  function kindChip(kind, points) {
    var L = { exact: 'Volltreffer', diff: 'Tordifferenz', tendency: 'Tendenz', miss: 'Daneben' };
    return '<span class="chip chip--' + kind + '"><span class="chip__pts" aria-hidden="true">' + points + '</span><span><span class="sr-only">' + points + ' ' + plural(points, 'Punkt', 'Punkte') + ' – </span>' + L[kind] + '</span></span>';
  }

  function lockedCard(m, ph) {
    var res = hasRes(m);
    var hw = res && m.home_goals > m.away_goals, aw = res && m.away_goals > m.home_goals;
    var badge = ph === 'live' ? '<span class="badge badge--live">Läuft</span>' :
      ph === 'pending' ? '<span class="badge">' + icon('clock') + 'Ergebnis folgt</span>' :
      m.my_kind === 'exact' ? '<span class="stamp' + stampNew(m.id) + '" aria-hidden="true">Volltreffer!</span><span class="sr-only">Endstand</span>' : '<span class="badge badge--final">Endstand</span>';
    var label = m.home + ' gegen ' + m.away + (res ? ', Endstand ' + m.home_goals + ':' + m.away_goals : ph === 'live' ? ', läuft gerade' : ', Ergebnis folgt');
    var html = '<article class="card match match--' + ph + '" data-mid="' + m.id + '" aria-label="' + esc(label) + '">' +
      '<div class="match__meta"><span class="match__when">' + (ph === 'live' ? 'Anstoß ' : '') + esc(dayWord(m.kickoff)) + ' <b>' + esc(kParts(m.kickoff).time) + '</b></span>' + badge + '</div>';
    html += teamRowLocked(m.home, res ? m.home_goals : null, res ? (hw ? 'is-winner' : aw ? 'is-loser' : '') : '');
    html += teamRowLocked(m.away, res ? m.away_goals : null, res ? (aw ? 'is-winner' : hw ? 'is-loser' : '') : '');
    html += '<div class="tipline"><span class="tipline__label">Dein Tipp</span>';
    if (m.my_tip) {
      html += '<span class="tipline__tip">' + m.my_tip.home + ':' + m.my_tip.away + '</span>';
      if (res && m.my_kind) html += kindChip(m.my_kind, m.my_points);
      else html += '<span class="chip chip--open">Punkte nach Abpfiff</span>';
    } else {
      html += '<span class="tipline__none">kein Tipp abgegeben</span>';
    }
    html += '</div>' + quoteHtml(m) + '</article>';
    return html;
  }
  var stamped = {};
  function stampNew(id) { if (stamped[id]) return ''; stamped[id] = 1; return ' is-new'; }
  function teamRowLocked(name, goals, cls) {
    return '<div class="team-row">' + crest(name) + '<span class="team-name ' + cls + '">' + esc(name) + '</span>' +
      '<span class="score' + (goals === null ? ' score--pending' : '') + '">' + (goals === null ? '–' : goals) + '</span></div>';
  }
  function quoteHtml(m) {
    var t = m.tendency;
    if (!t) {
      return '<div class="quote"><div class="quote__head"><span class="quote__title">Stammtisch-Quote</span><span class="quote__meta">Keine Tipps abgegeben</span></div></div>';
    }
    var outcome = hasRes(m) ? (m.home_goals > m.away_goals ? 'home' : m.home_goals < m.away_goals ? 'away' : 'draw') : null;
    function leg(key, label, color) {
      return '<span' + (outcome === key ? ' class="quote__hit" title="So ist es ausgegangen"' : '') + '><i style="background:var(--q-' + key + ')"></i>' + label + ' <b>' + t[key] + '&nbsp;%</b></span>';
    }
    return '<div class="quote"><div class="quote__head"><span class="quote__title">Stammtisch-Quote</span>' +
      '<span class="quote__meta">Häufigster Tipp <b>' + esc(t.top) + '</b> · <b>' + m.tip_count + '</b> ' + plural(m.tip_count, 'Tipp', 'Tipps') + '</span></div>' +
      '<div class="quote__bar" role="img" aria-label="Heimsieg ' + t.home + ' Prozent, Remis ' + t.draw + ' Prozent, Auswärtssieg ' + t.away + ' Prozent">' +
      '<span class="q-home" style="flex-grow:' + t.home + '"></span><span class="q-draw" style="flex-grow:' + t.draw + '"></span><span class="q-away" style="flex-grow:' + t.away + '"></span></div>' +
      '<div class="quote__legend" aria-hidden="true">' + leg('home', 'Heimsieg') + leg('draw', 'Remis') + leg('away', 'Auswärts') + '</div></div>';
  }

  /* --- Bonusfrage --- */
  function compTeams(cid) {
    var set = {};
    S.matches.forEach(function (m) { if (m.competition_id === cid) { set[m.home] = 1; set[m.away] = 1; } });
    return Object.keys(set).sort(function (a, b) { return a.localeCompare(b, 'de'); });
  }
  function firstKick(cid) {
    var k = null;
    S.matches.forEach(function (m) { if (m.competition_id === cid && (!k || m.kickoff < k)) k = m.kickoff; });
    return k;
  }
  function bonusCard(c, multi) {
    var fk = firstKick(c.id);
    var head = '<div class="bonus__top"><span class="bonus__icon" aria-hidden="true">' + icon('star') + '</span><div>' +
      '<p class="eyebrow">Bonusfrage' + (multi ? ' · ' + esc(c.name) : '') + ' · ' + c.bonus_points + ' Punkte</p>' +
      '<h2 class="bonus__q" id="bq-' + c.id + '">' + esc(c.bonus_question) + '</h2>';
    if (!c.bonus_locked) {
      var val = S.bonusDraft[c.id] != null ? S.bonusDraft[c.id] : (c.my_bonus || '');
      head += '<p class="bonus__sub">' + (fk ? 'Tippbar bis zum ersten Anstoß: ' + esc(kickShort(fk)) + ' Uhr' + (deadlineBadge(fk) ? '' : '') : 'Tippbar bis zum ersten Anstoß.') + '</p></div></div>';
      return '<section class="card bonus" data-bonus="' + c.id + '" aria-labelledby="bq-' + c.id + '">' + head +
        '<form class="bonus__form" data-bonus-form="' + c.id + '" novalidate><label class="sr-only" for="bi-' + c.id + '">Deine Antwort</label>' +
        '<input class="input" id="bi-' + c.id + '" maxlength="80" autocomplete="off" placeholder="Deine Antwort, z. B. eine Mannschaft" value="' + esc(val) + '" data-bonus-input="' + c.id + '">' +
        '<button type="submit" class="btn btn--primary">Speichern</button></form>' +
        '<div class="bonus__sugs" data-sugs="' + c.id + '" role="group" aria-label="Vorschläge">' + sugsHtml(c.id, val) + '</div>' +
        '<p class="bonus__status' + (c.my_bonus ? ' is-ok' : '') + '" data-bonus-status="' + c.id + '" role="status" aria-live="polite">' +
        (c.my_bonus ? '✓ Gespeichert: ' + esc(c.my_bonus) : '') + '</p></section>';
    }
    head += '<p class="bonus__sub">' + icon('lock', 'ico--sm" style="display:inline;vertical-align:-3px') + ' Tippschluss war beim ersten Anstoß.</p></div></div>';
    var ans = c.bonus_answer, my = c.my_bonus;
    var body = '<div class="bonus__answer"><span class="tipline__label">Deine Antwort</span>' + (my ? '<strong>' + esc(my) + '</strong>' : '<span class="tipline__none">keine Antwort abgegeben</span>');
    if (ans) {
      var right = my && API.util.bonusNorm(my) === API.util.bonusNorm(ans);
      body += right ? kindChip('exact', c.bonus_points).replace('Volltreffer', 'Richtig!') : (my ? kindChip('miss', 0) : '');
      body += '</div><p class="bonus__sub" style="margin-top:8px">Auflösung: <b style="color:var(--text)">' + esc(ans) + '</b></p>';
    } else {
      body += '<span class="chip chip--open">Auflösung nach Turnierende</span></div>';
    }
    return '<section class="card bonus" aria-labelledby="bq-' + c.id + '">' + head + body + '</section>';
  }
  function sugsHtml(cid, val) {
    var q = String(val || '').trim().toLowerCase();
    var teams = compTeams(cid);
    var list = q ? teams.filter(function (t) { return t.toLowerCase().indexOf(q) >= 0; }) : teams;
    var exact = teams.some(function (t) { return t.toLowerCase() === q; });
    if (exact) list = teams.filter(function (t) { return t.toLowerCase() === q; }).concat(list.filter(function (t) { return t.toLowerCase() !== q; }));
    return list.slice(0, 8).map(function (t) {
      return '<button type="button" class="sug" data-sug="' + esc(t) + '" aria-pressed="' + (t.toLowerCase() === q) + '">' + esc(t) + '</button>';
    }).join('');
  }
  function saveBonus(cid) {
    var inp = $('[data-bonus-input="' + cid + '"]');
    var st = $('[data-bonus-status="' + cid + '"]');
    var btn = $('[data-bonus-form="' + cid + '"] button[type=submit]');
    var val = inp.value.trim();
    if (!val) { st.className = 'bonus__status is-bad'; st.textContent = 'Bitte gib eine Antwort ein.'; inp.focus(); return; }
    busy(btn, true);
    API.call('bonus_tip', { competition_id: cid, answer: val }).then(function (r) {
      busy(btn, false);
      var c = findComp(cid);
      if (c) c.my_bonus = r.answer;
      delete S.bonusDraft[cid];
      inp.value = r.answer;
      st.className = 'bonus__status is-ok';
      st.textContent = '✓ Gespeichert: ' + r.answer;
    }).catch(function (e) {
      busy(btn, false);
      if (isAuthError(e)) return sessionExpired();
      st.className = 'bonus__status is-bad';
      st.textContent = e.status === 0 ? 'Keine Verbindung – Antwort nicht gespeichert, bitte nochmal versuchen.' : errText(e);
      if (e.data && e.data.locked) setTimeout(function () { refreshTippen(true); }, 1800);
    });
  }

  /* --- Ereignisse auf der Tipp-Seite (Delegation) --- */
  var tippenBound = false;
  function bindTippen() {
    if (tippenBound) return; // #view bleibt bestehen – Delegation nur einmal anhängen
    tippenBound = true;
    var v = $('#view');
    v.addEventListener('click', function (e) {
      var t = e.target.closest('button');
      if (!t) {
        // Wirt-Ansicht: Tipp auf die Spielkarte öffnet alle Tipps zu diesem Spiel
        var oc = S.owner && !e.target.closest('a') && e.target.closest('[data-tips-mid]');
        if (oc) openMatchTips(+oc.getAttribute('data-tips-mid'), $('[data-tips]', oc));
        return;
      }
      if (t.hasAttribute('data-tips')) { openMatchTips(+t.getAttribute('data-tips'), t); return; }
      if (t.hasAttribute('data-filter')) { S.filter = t.getAttribute('data-filter'); flushDrafts(); renderToolbar(); renderList(); var f = $('[data-filter="' + S.filter + '"]', $('#t-toolbar')); if (f && t.closest('#t-toolbar')) f.focus(); return; }
      if (t.hasAttribute('data-comp')) { var c = t.getAttribute('data-comp'); S.compFilter = c === 'all' ? 'all' : +c; flushDrafts(); renderToolbar(); renderList(); var cb = $('[data-comp="' + c + '"]'); if (cb) cb.focus(); return; }
      if (t.hasAttribute('data-step')) {
        var card = t.closest('[data-mid]');
        stepGoal(+card.getAttribute('data-mid'), t.getAttribute('data-side'), +t.getAttribute('data-step'));
        return;
      }
      if (t.hasAttribute('data-retry')) { var c2 = t.closest('[data-mid]'); saveTip(+c2.getAttribute('data-mid'), true); return; }
      if (t.hasAttribute('data-sug')) {
        var cid = +t.closest('[data-sugs]').getAttribute('data-sugs');
        var inp = $('[data-bonus-input="' + cid + '"]');
        inp.value = t.getAttribute('data-sug');
        S.bonusDraft[cid] = inp.value;
        $('[data-sugs="' + cid + '"]').innerHTML = sugsHtml(cid, inp.value);
        saveBonus(cid);
      }
    });
    v.addEventListener('submit', function (e) {
      var f = e.target.closest('[data-bonus-form]');
      if (!f) return;
      e.preventDefault();
      saveBonus(+f.getAttribute('data-bonus-form'));
    });
    v.addEventListener('input', function (e) {
      var t = e.target;
      if (t.classList.contains('goal')) {
        var clean = t.value.replace(/\D/g, '').slice(0, 2);
        if (clean !== t.value) t.value = clean;
        var mid = +t.closest('[data-mid]').getAttribute('data-mid');
        var n = clean === '' ? '' : Math.min(20, parseInt(clean, 10));
        if (n !== '' && String(n) !== clean) t.value = String(n);
        setGoal(mid, t.getAttribute('data-side'), n, false);
      } else if (t.hasAttribute('data-bonus-input')) {
        var cid = +t.getAttribute('data-bonus-input');
        S.bonusDraft[cid] = t.value;
        $('[data-sugs="' + cid + '"]').innerHTML = sugsHtml(cid, t.value);
      }
    });
    v.addEventListener('change', function (e) {
      var t = e.target;
      if (!t.classList.contains('goal')) return;
      var mid = +t.closest('[data-mid]').getAttribute('data-mid');
      var d = S.drafts[mid];
      if (d && (d.home === '') !== (d.away === '')) {
        // eine Seite leer → 0 annehmen
        if (d.home === '') d.home = 0; else d.away = 0;
        syncCard(mid);
        scheduleSave(mid);
      }
    });
    v.addEventListener('focusin', function (e) {
      if (e.target.classList && e.target.classList.contains('goal')) { var t = e.target; setTimeout(function () { try { t.select(); } catch (x) { /* */ } }, 0); }
    });
    v.addEventListener('keydown', function (e) {
      var t = e.target;
      if (!t.classList || !t.classList.contains('goal')) return;
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        stepGoal(+t.closest('[data-mid]').getAttribute('data-mid'), t.getAttribute('data-side'), e.key === 'ArrowUp' ? 1 : -1);
      } else if (e.key === 'Enter') {
        t.blur();
      }
    });
  }

  function ensureDraft(m) {
    if (!S.drafts[m.id]) {
      S.drafts[m.id] = { home: m.my_tip ? m.my_tip.home : '', away: m.my_tip ? m.my_tip.away : '', state: m.my_tip ? 'tipped' : 'none', timer: null, inflight: false };
    }
    return S.drafts[m.id];
  }
  function stepGoal(mid, side, delta) {
    var m = findMatch(mid);
    if (!m || m.locked) return;
    var d = ensureDraft(m);
    var other = side === 'home' ? 'away' : 'home';
    var cur = d[side];
    var next = cur === '' ? (delta > 0 ? 1 : 0) : Math.max(0, Math.min(20, cur + delta));
    d[side] = next;
    if (d[other] === '') d[other] = 0;
    syncCard(mid, side);
    scheduleSave(mid);
  }
  function setGoal(mid, side, n, fillOther) {
    var m = findMatch(mid);
    if (!m || m.locked) return;
    var d = ensureDraft(m);
    d[side] = n;
    syncCard(mid);
    if (d.home !== '' && d.away !== '') scheduleSave(mid);
    else { d.state = 'none'; clearTimeout(d.timer); syncSave(mid); }
  }
  function syncCard(mid, bumpSide) {
    var card = $('[data-mid="' + mid + '"]');
    var d = S.drafts[mid];
    if (!card || !d) return;
    ['home', 'away'].forEach(function (side) {
      var inp = $('.goal[data-side="' + side + '"]', card);
      var v = d[side];
      if (inp && document.activeElement !== inp) inp.value = v === '' ? '' : v;
      else if (inp && inp.value !== String(v) && v !== '') inp.value = v;
      var minus = $('.step--minus[data-side="' + side + '"]', card), plus = $('.step--plus[data-side="' + side + '"]', card);
      if (minus) minus.disabled = v === 0;
      if (plus) plus.disabled = v === 20;
      if (bumpSide === side && inp && !reduceMotion) { inp.classList.remove('bump'); void inp.offsetWidth; inp.classList.add('bump'); }
    });
  }
  function syncSave(mid, pour) {
    var card = $('[data-mid="' + mid + '"]');
    var m = findMatch(mid);
    if (!card || !m) return;
    var foot = $('.match__foot', card);
    var old = $('.save', foot), oldRetry = $('[data-retry]', foot);
    var d = S.drafts[mid];
    var st = d ? d.state : (m.my_tip ? 'tipped' : 'none');
    // Text im bestehenden Live-Element ändern (damit Screenreader es ansagen)
    old.setAttribute('data-state', st);
    $('.save__text', old).textContent = st === 'error' ? d.error : SAVE_TEXT[st];
    old.classList.remove('pour');
    if (pour && !reduceMotion) { void old.offsetWidth; old.classList.add('pour'); }
    if (oldRetry) oldRetry.remove();
    if (st === 'error' && d.retry) foot.insertAdjacentHTML('beforeend', '<button type="button" class="save__retry" data-retry>' + icon('retry') + 'Nochmal versuchen</button>');
    card.classList.toggle('has-error', st === 'error');
    card.classList.toggle('is-tipped', !!m.my_tip);
    $('[data-count]', card).innerHTML = countText(m);
    var grp = card.closest('.group'), gm = grp && $('[data-open-meta]', grp);
    if (gm) {
      var total = +gm.getAttribute('data-open-meta');
      gm.textContent = total + ' ' + plural(total, 'Spiel', 'Spiele') + ' · ' + $$('.match.is-tipped', grp).length + ' getippt';
    }
  }
  function scheduleSave(mid) {
    var d = S.drafts[mid];
    d.state = 'dirty';
    syncSave(mid);
    clearTimeout(d.timer);
    d.timer = setTimeout(function () { saveTip(mid); }, SAVE_DELAY);
  }
  function flushDrafts() {
    Object.keys(S.drafts).forEach(function (id) {
      var d = S.drafts[id];
      if (d.state === 'dirty') { clearTimeout(d.timer); saveTip(+id); }
    });
  }
  function saveTip(mid, force) {
    var m = findMatch(mid), d = S.drafts[mid];
    if (!m || !d) return;
    clearTimeout(d.timer);
    if (d.home === '' || d.away === '') return;
    if (d.inflight) { d.again = true; return; }
    if (!force && m.my_tip && m.my_tip.home === d.home && m.my_tip.away === d.away) {
      d.state = d.everSaved ? 'saved' : 'tipped';
      syncSave(mid);
      return;
    }
    d.inflight = true; d.again = false; d.state = 'saving';
    syncSave(mid);
    var sent = { home: d.home, away: d.away };
    API.call('tip', { match_id: mid, home: sent.home, away: sent.away }).then(function (r) {
      d.inflight = false;
      var first = !m.my_tip;
      m.my_tip = r.tip;
      if (first) m.tip_count = (m.tip_count || 0) + 1;
      d.everSaved = true;
      if (d.again || d.home !== r.tip.home || d.away !== r.tip.away) { saveTip(mid); return; }
      d.state = 'saved';
      syncSave(mid, true);
      renderSummary();
      if (S.lb) S.lb = {};
    }).catch(function (e) {
      d.inflight = false;
      if (isAuthError(e)) return sessionExpired();
      d.state = 'error';
      if (e.data && e.data.locked) {
        d.retry = false;
        d.error = 'Tippschluss – das Spiel hat schon begonnen.';
        syncSave(mid);
        setTimeout(function () { delete S.drafts[mid]; refreshTippen(true); }, 2200);
        return;
      }
      d.retry = true;
      d.error = e.status === 0 ? 'Keine Verbindung – Tipp nicht gespeichert' : errText(e);
      syncSave(mid);
    });
  }

  function refreshTippen(force) {
    return loadMatches(force).then(function () {
      if (S.owner) { if (S.route === 'spiele') { renderOwnerSummary(); renderToolbar(); renderList(); } return; }
      if (S.route !== 'tippen') return;
      renderSummary(); renderToolbar(); renderList();
    }).catch(function (e) { if (isAuthError(e)) sessionExpired(); });
  }
  function editingNow() {
    var a = document.activeElement;
    if (a && (a.classList.contains('goal') || a.hasAttribute('data-bonus-input'))) return true;
    return Object.keys(S.drafts).some(function (id) { var d = S.drafts[id]; return d.inflight || d.state === 'dirty' || d.state === 'saving'; });
  }

  /* ================================================================ Wirt-Ansicht (nur lesen) */
  /*
   * Für den Wirt ohne Spielerkonto: Grundlage ist die Anmeldung in der Verwaltung (CMS-Session).
   * Zeigt alle Spiele mit Stammtisch-Quote (auch vor dem Anstoß), alle Tipps je Spiel/Spieler und die
   * Stammtisch-Statistik. Hier wird nichts gespeichert – die API lässt in diesem Modus keine Tipps zu.
   */

  function viewSpiele() {
    mount('<div class="view tippen owner-view">' +
      '<div class="tippen__summary" id="o-summary"></div>' +
      '<div class="tippen__main">' +
      '<div class="view-head"><h1 class="view-title" tabindex="-1">Spiele</h1></div>' +
      '<div class="toolbar" id="t-toolbar"></div><div id="t-list">' + skeleton(3) + '</div></div>' +
      '<div class="tippen__rules">' + ownerHint() + '</div></div>');
    bindTippen();
    loadMatches().then(function () {
      if (S.route !== 'spiele' || !S.owner) return;
      renderOwnerSummary(); renderToolbar(); renderList();
    }).catch(function (e) {
      if (isAuthError(e)) return sessionExpired();
      $('#t-list').innerHTML = loadError(e, 't-retry');
      $('#t-retry').addEventListener('click', viewSpiele);
    });
  }

  function ownerHint() {
    var s = S.settings;
    return '<section class="card section-card owner-hint" aria-labelledby="oh-title"><div class="section-card__head">' + icon('info') +
      '<h2 class="card-title" id="oh-title">So liest du die Wirt-Ansicht</h2></div>' +
      '<ul class="owner-hint__list"><li>Die <b>Stammtisch-Quote</b> siehst nur du schon vor dem Anstoß – die Gäste erst danach.</li>' +
      '<li>Tipp auf ein Spiel, um zu sehen, <b>wer was getippt hat</b> und wer noch fehlt.</li>' +
      '<li>Punkte: ' + s.points_exact + ' exakt · ' + s.points_diff + ' Tordifferenz · ' + s.points_tendency + ' Tendenz.</li>' +
      '<li>Ergebnisse, Spiele und Einladungen pflegst du in der <a href="' + ADMIN_URL + '">Verwaltung</a>.</li></ul></section>';
  }

  function renderOwnerSummary() {
    var box = $('#o-summary');
    if (!box) return;
    var open = S.matches.filter(function (m) { return !m.locked; });
    var pending = S.matches.filter(function (m) { return phase(m) === 'pending'; });
    var openTips = open.reduce(function (n, m) { return n + (m.tip_count || 0); }, 0);
    var lb = S.lbAll, players = lb ? (lb.rows || []).length : null;
    var next = open[0];
    box.innerHTML = '<section class="card hello hello--owner" aria-label="Überblick für den Wirt">' +
      '<div><p class="hello__greet">Servus, Wirt!</p>' +
      '<p class="hello__line">' + (S.matches.length ? 'Hier siehst du alles, was am Stammtisch getippt wird – auch vor dem Anstoß.' : 'Noch keine Spiele eingetragen – das geht in der Verwaltung.') + '</p>' +
      (next ? '<p class="hello__next">Als Nächstes: <b>' + esc(next.home) + ' – ' + esc(next.away) + '</b>, ' + esc(kickShort(next.kickoff)) + ' · ' + (next.tip_count || 0) + ' ' + plural(next.tip_count || 0, 'Tipp', 'Tipps') + '</p>' : '') +
      '</div><div class="hello__stats">' +
      '<a class="mini-stat" href="#/rangliste"><div class="mini-stat__v">' + (players === null ? '–' : players) + '</div><div class="mini-stat__l">Spieler</div></a>' +
      '<div class="mini-stat"><div class="mini-stat__v">' + openTips + '</div><div class="mini-stat__l">' + plural(openTips, 'Tipp offen', 'Tipps offen') + '</div></div>' +
      '<div class="mini-stat' + (pending.length ? ' mini-stat--warn' : '') + '"><div class="mini-stat__v">' + pending.length + '</div><div class="mini-stat__l">Ergebnis fehlt</div></div>' +
      '</div></section>';
    if (!S.lbAll) loadLeaderboard('all').then(function (r) { S.lbAll = r; if (S.route === 'spiele' && S.owner) renderOwnerSummary(); }).catch(function () { /* optional */ });
  }

  function renderOwnerList() {
    var box = $('#t-list');
    if (!box) return;
    var ms = compMatches();
    var live = ms.filter(function (m) { return phase(m) === 'live'; });
    var open = ms.filter(function (m) { return !m.locked; });
    var past = ms.filter(function (m) { return m.locked && phase(m) !== 'live'; }).slice().reverse();
    var multi = S.comps.length > 1 && S.compFilter === 'all';
    var comps = S.compFilter === 'all' ? S.comps : S.comps.filter(function (c) { return c.id === S.compFilter; });
    var html = '';
    comps.forEach(function (c) {
      if (!c.bonus_question) return;
      var show = S.filter === 'alle' || (S.filter === 'offen' ? !c.bonus_locked : c.bonus_locked);
      if (show) html += ownerBonusCard(c, multi);
    });
    if (live.length && S.filter !== 'ergebnisse') {
      html += '<section class="group" aria-label="Läuft gerade"><div class="group__head"><h2 class="group__title"><span class="live-dot" aria-hidden="true"></span>Läuft gerade</h2>' +
        '<span class="group__meta">' + live.length + ' ' + plural(live.length, 'Spiel', 'Spiele') + '</span></div><div class="group__list">' + live.map(ownerCard).join('') + '</div></section>';
    }
    if (S.filter !== 'ergebnisse') groupBy(open).forEach(function (g) { html += ownerGroup(g, multi); });
    if (S.filter !== 'offen') {
      if (S.filter === 'alle' && past.length) html += '<h2 class="eyebrow" style="margin:26px 2px 0">Gespielt</h2>';
      groupBy(past).forEach(function (g) { html += ownerGroup(g, multi); });
    }
    var count = (S.filter !== 'ergebnisse' ? live.length + open.length : 0) + (S.filter !== 'offen' ? past.length : 0);
    if (!count) {
      html += !S.matches.length
        ? '<div class="card empty">' + emptyArt('whistle') + '<h2>Noch keine Spiele</h2><p>Spiele trägst du in der Verwaltung ein – oder lässt sie automatisch abrufen.</p><a class="btn btn--secondary" href="' + ADMIN_URL + '">Zur Verwaltung</a></div>'
        : S.filter === 'offen'
          ? '<div class="card empty">' + emptyArt('glass') + '<h2>Gerade nichts offen</h2><p>Es gibt keine Spiele, auf die noch getippt werden kann.</p><button type="button" class="btn btn--secondary" data-filter="ergebnisse">Zu den Ergebnissen</button></div>'
          : '<div class="card empty">' + emptyArt('whistle') + '<h2>Noch keine Ergebnisse</h2><p>Sobald die ersten Spiele angepfiffen sind, stehen sie hier.</p></div>';
    }
    if (S.comps.some(function (c) { return c.source; })) {
      html += '<p class="foot-note">Spielplan &amp; Ergebnisse: <a href="https://www.openligadb.de/" target="_blank" rel="noopener">OpenLigaDB</a></p>';
    }
    box.innerHTML = html;
  }

  function ownerGroup(g, multi) {
    var tips = g.items.reduce(function (n, m) { return n + (m.tip_count || 0); }, 0);
    var title = g.round || 'Spiele';
    return '<section class="group" aria-label="' + esc(title) + '"><div class="group__head"><h2 class="group__title"><span>' +
      (multi && g.comp ? '<span class="eyebrow">' + esc(g.comp.name) + '</span>' : '') + esc(title) + '</span></h2>' +
      '<span class="group__meta">' + g.items.length + ' ' + plural(g.items.length, 'Spiel', 'Spiele') + ' · ' + tips + ' ' + plural(tips, 'Tipp', 'Tipps') + '</span></div>' +
      '<div class="group__list">' + g.items.map(ownerCard).join('') + '</div></section>';
  }

  function ownerCard(m) {
    var ph = phase(m);
    var res = hasRes(m);
    var hw = res && m.home_goals > m.away_goals, aw = res && m.away_goals > m.home_goals;
    var badge = ph === 'open' ? '<span data-countdown="' + esc(m.kickoff) + '">' + (deadlineBadge(m.kickoff) || '<span class="badge">' + icon('clock') + 'offen</span>') + '</span>' :
      ph === 'live' ? '<span class="badge badge--live">Läuft</span>' :
      ph === 'pending' ? '<span class="badge badge--soon">' + icon('clock') + 'Ergebnis fehlt</span>' : '<span class="badge badge--final">Endstand</span>';
    var label = m.home + ' gegen ' + m.away + ', ' + kickLong(m.kickoff) + (res ? ', Endstand ' + m.home_goals + ':' + m.away_goals : '');
    var n = m.tip_count || 0;
    return '<article class="card match match--owner match--' + ph + '" data-tips-mid="' + m.id + '" aria-label="' + esc(label) + '">' +
      '<div class="match__meta"><span class="match__when">' + (ph === 'open' ? icon('clock', 'ico--sm') : ph === 'live' ? 'Anstoß ' : '') + esc(dayWord(m.kickoff)) + ' <b>' + esc(kParts(m.kickoff).time) + '</b></span>' + badge + '</div>' +
      teamRowLocked(m.home, res ? m.home_goals : null, res ? (hw ? 'is-winner' : aw ? 'is-loser' : '') : '') +
      teamRowLocked(m.away, res ? m.away_goals : null, res ? (aw ? 'is-winner' : hw ? 'is-loser' : '') : '') +
      quoteHtml(m) +
      '<div class="match__foot match__foot--owner"><button type="button" class="btn btn--small btn--ghost btn--block" data-tips="' + m.id + '">' + icon('user') +
      (n ? 'Alle ' + n + ' ' + plural(n, 'Tipp', 'Tipps') + ' ansehen' : 'Wer hat getippt?') + '</button></div></article>';
  }

  function ownerBonusCard(c, multi) {
    var fk = firstKick(c.id);
    var n = c.bonus_count || 0;
    return '<section class="card bonus" aria-labelledby="bq-' + c.id + '"><div class="bonus__top"><span class="bonus__icon" aria-hidden="true">' + icon('star') + '</span><div>' +
      '<p class="eyebrow">Bonusfrage' + (multi ? ' · ' + esc(c.name) : '') + ' · ' + c.bonus_points + ' Punkte</p>' +
      '<h2 class="bonus__q" id="bq-' + c.id + '">' + esc(c.bonus_question) + '</h2>' +
      '<p class="bonus__sub">' + (c.bonus_locked ? 'Tippschluss war beim ersten Anstoß.' : fk ? 'Tippbar bis ' + esc(kickShort(fk)) + ' Uhr.' : 'Tippbar bis zum ersten Anstoß.') + '</p></div></div>' +
      '<div class="bonus__answer"><span class="tipline__label">Antworten</span><strong>' + n + '</strong>' +
      (c.bonus_answer ? '<span class="bonus__sub" style="margin:0">Auflösung: <b style="color:var(--text)">' + esc(c.bonus_answer) + '</b></span>' : '<span class="chip chip--open">Auflösung nach Turnierende</span>') +
      '</div><p class="bonus__sub" style="margin-top:8px">Wer was geantwortet hat, siehst du in der Rangliste beim jeweiligen Spieler.</p></section>';
  }

  function openMatchTips(mid, opener) {
    var m = findMatch(mid);
    if (!m) return;
    var head = '<div class="sheet__grip" aria-hidden="true"></div><div class="sheet__head"><span class="sheet__avatar sheet__avatar--ball" aria-hidden="true">' + icon('ball') + '</span>' +
      '<div><h2 class="sheet__title" id="sheet-title">' + esc(m.home) + ' – ' + esc(m.away) + '</h2><p class="sheet__sub">' + esc(kickLong(m.kickoff)) + (m.round ? ' · ' + esc(m.round) : '') + '</p></div>' +
      '<button type="button" class="sheet__close" data-close aria-label="Schließen">' + icon('x') + '</button></div>';
    var sheet = openSheet(head + '<div class="sheet__body" id="sheet-body">' + skeleton(1) + '</div>', opener);
    API.call('admin_match_tips', { match_id: mid }).then(function (r) {
      var body = $('#sheet-body', sheet);
      if (!body) return;
      var x = r.match, res = hasRes(x);
      var html = '<div class="mt-result"><span class="mt-result__label">' + (res ? 'Endstand' : x.locked ? 'Ergebnis folgt' : 'Noch nicht angepfiffen') + '</span>' +
        '<span class="ptip__res mt-result__score">' + (res ? x.home_goals + ':' + x.away_goals : '–:–') + '</span>' +
        (x.competition ? '<span class="mt-result__comp">' + esc(x.competition) + '</span>' : '') + '</div>';
      html += quoteHtml(x);
      var tips = r.tips || [];
      if (!tips.length) {
        html += '<div class="empty" style="padding:20px 8px">' + emptyArt('glass') + '<h3>Noch keine Tipps</h3><p>Auf dieses Spiel hat noch niemand getippt.</p></div>';
      } else {
        html += '<p class="sheet-section-title">' + tips.length + ' ' + plural(tips.length, 'Tipp', 'Tipps') + (res ? ' · nach Punkten' : '') + '</p>' +
          '<ul class="mtips">' + tips.map(function (t) {
            return '<li class="mtip">' + avatar(t.nickname, 'av') + '<span class="mtip__name">' + esc(t.nickname) + '</span>' +
              '<span class="mtip__tip">' + t.tip.home + ':' + t.tip.away + '</span>' +
              (res && t.kind ? kindChip(t.kind, t.points) : '<span class="chip chip--open">' + (x.locked ? 'läuft' : 'noch änderbar') + '</span>') + '</li>';
          }).join('') + '</ul>';
      }
      var miss = r.missing || [];
      if (miss.length) {
        html += '<p class="sheet-section-title">' + (x.locked ? 'Nicht getippt' : 'Fehlen noch') + ' (' + miss.length + ')</p><p class="mtips__missing">' + miss.map(esc).join(', ') + '</p>';
      }
      body.innerHTML = html;
    }).catch(function (e) {
      if (isAuthError(e)) { closeSheet(true); return sessionExpired(); }
      var body = $('#sheet-body', sheet);
      if (body) body.innerHTML = '<div class="form-error">' + icon('info') + '<span>' + esc(errText(e)) + '</span></div>';
    });
  }

  /* --- Wirt-Ansicht: Stammtisch-Statistik --- */

  function viewOwnerStats() {
    mount('<div class="view"><div class="view-head"><h1 class="view-title" tabindex="-1">Statistik</h1></div>' +
      '<p class="lead" style="margin:-6px 0 12px">Der ganze Stammtisch zusammen – alle aktiven Spieler.</p>' +
      '<div id="st-tabs"></div><div id="st-panel" role="tabpanel">' + skeleton(3) + '</div></div>');
    loadMatches().then(function () {
      if (S.route !== 'statistik' || !S.owner) return;
      S.statComp = defaultComp(S.statComp);
      $('#st-tabs').innerHTML = compTabs(S.statComp, 'st');
      bindTabs($('#st-tabs'), function (key) {
        S.statComp = key === 'all' ? 'all' : +key;
        selectTab($('#st-tabs'), key);
        showOwnerStats();
      });
      showOwnerStats();
    }).catch(function (e) {
      if (isAuthError(e)) return sessionExpired();
      $('#st-panel').innerHTML = loadError(e, 'st-retry');
      $('#st-retry').addEventListener('click', viewOwnerStats);
    });
  }

  function showOwnerStats() {
    var key = S.statComp, panel = $('#st-panel');
    panel.innerHTML = skeleton(3);
    API.call('admin_stats', key === 'all' ? {} : { competition_id: key }).then(function (s) {
      if (S.route !== 'statistik' || S.statComp !== key || !S.owner) return;
      renderOwnerStats(s);
    }).catch(function (e) {
      if (isAuthError(e)) return sessionExpired();
      panel.innerHTML = loadError(e, 'st-retry');
      $('#st-retry').addEventListener('click', showOwnerStats);
    });
  }

  function renderOwnerStats(s) {
    var panel = $('#st-panel');
    var scored = s.scored_tips || 0;
    var html = '<div class="stats">';
    html += '<section class="card stat-hero span-2" aria-label="Stammtisch gesamt"><div><p class="eyebrow">' + (S.statComp === 'all' ? 'Alle Wettbewerbe' : esc((findComp(S.statComp) || {}).name || '')) + '</p>' +
      '<p class="stat-hero__pts">' + s.tips + '<small>' + plural(s.tips, 'Tipp', 'Tipps') + '</small></p>' +
      '<p class="stat-hero__sub">' + s.tippers + ' von ' + s.players + ' ' + plural(s.players, 'Spieler hat', 'Spielern haben') + ' getippt · ' +
      s.matches + ' ' + plural(s.matches, 'Spiel', 'Spiele') + ', ' + s.scored_matches + ' mit Ergebnis · ' + scored + ' Tipps gewertet</p></div>' +
      '<div class="stat-hero__rank"><b>' + s.players + '</b><span>' + plural(s.players, 'Spieler', 'Spieler') + '</span></div></section>';
    if (!scored) {
      html += '<section class="card empty span-2">' + emptyArt('chart') + '<h2>Noch nichts gewertet</h2><p>Sobald die ersten Ergebnisse eingetragen sind, stehen hier Trefferquote, Punkte-Schnitt und die Besten jeder Runde.</p></section>';
      if (s.favorite_tip) html += '<div class="tiles span-2">' + tile('Häufigster Tipp', esc(s.favorite_tip.tip), s.favorite_tip.count + '× getippt') + '</div>';
      panel.innerHTML = html + '</div>';
      return;
    }
    var hits = s.exact + s.diff + s.tendency;
    html += '<div class="tiles span-2">' +
      tile('Trefferquote', dec(s.hit_rate, 0) + '<small>&nbsp;%</small>', '<b>' + hits + '</b> von ' + scored + ' Tipps mit Punkten') +
      tile('Ø Punkte pro Tipp', dec(s.avg_points_tip, 2), 'über alle gewerteten Tipps') +
      tile('Ø Punkte pro Spieler', dec(s.avg_points_player, 1), s.points + ' Punkte insgesamt' + (s.bonus ? ' · inkl. ' + s.bonus + ' Bonus' : '')) +
      tile('Häufigster Tipp', s.favorite_tip ? esc(s.favorite_tip.tip) : '–', s.favorite_tip ? s.favorite_tip.count + '× getippt' : '') +
      '</div>';
    var parts = [['exact', 'Volltreffer', s.exact], ['diff', 'Tordifferenz', s.diff], ['tendency', 'Tendenz', s.tendency], ['miss', 'Daneben', s.miss]];
    html += '<section class="card chart-card"><div class="chart-card__head"><h2 class="card-title">Treffer am Stammtisch</h2><span class="card-sub">' + scored + ' gewertete Tipps</span></div>' +
      '<div class="donut-wrap"><div class="donut-center">' + donut(parts, scored).replace('Aufteilung deiner Tipps', 'Aufteilung aller Tipps') +
      '<div class="donut-center__txt" aria-hidden="true"><b>' + dec(s.hit_rate, 0) + '%</b><span>Treffer</span></div></div>' +
      '<ul class="breakdown">' + parts.map(function (p) {
        return '<li><i style="background:' + KCOL[p[0]] + '"></i><span>' + p[1] + '</span><span><b>' + p[2] + '</b><small>' + Math.round(p[2] / scored * 100) + '%</small></span></li>';
      }).join('') + '</ul></div></section>';
    var rounds = (s.by_round || []).slice().reverse();
    html += '<section class="card chart-card"><div class="chart-card__head"><h2 class="card-title">Runden</h2><span class="card-sub">Ø Punkte je Spieler · Rundensieger</span></div>' +
      '<ol class="rounds">' + rounds.map(function (r) {
        return '<li class="rounds__row"><div class="rounds__main"><span class="rounds__name">' + esc(r.round) + '</span>' +
          '<span class="rounds__meta">' + r.matches + ' ' + plural(r.matches, 'Spiel', 'Spiele') + ' · ' + r.tips + ' ' + plural(r.tips, 'Tipp', 'Tipps') + '</span></div>' +
          '<span class="rounds__avg"><b>' + dec(r.avg_points, 1) + '</b><small>Ø Pkt.</small></span>' +
          '<span class="rounds__best">' + (r.best ? icon('star') + '<span><b>' + esc(r.best.nicknames.join(', ')) + '</b> · ' + r.best.points + ' Pkt.</span>' : '<span class="rounds__none">keine Punkte</span>') + '</span></li>';
      }).join('') + '</ol></section>';
    panel.innerHTML = html + '</div>';
  }

  /* ================================================================ Wettbewerbs-Reiter (Rangliste/Statistik) */

  function compTabs(current, name) {
    var tabs = S.comps.map(function (c) { return { id: c.id, name: c.name }; });
    tabs.push({ id: 'all', name: 'Gesamt' });
    return '<div class="tabs" role="tablist" aria-label="Wettbewerb wählen" data-tabs="' + name + '">' + tabs.map(function (t) {
      var sel = String(t.id) === String(current);
      return '<button type="button" class="tab" role="tab" aria-selected="' + sel + '" tabindex="' + (sel ? 0 : -1) + '" aria-controls="' + name + '-panel" data-tab="' + t.id + '" title="' + esc(t.name) + '">' + esc(tabLabel(t.name)) + '</button>';
    }).join('') + '</div>';
  }
  /** Kurzer Reitername: „Bundesliga 2026/27“ → „Bundesliga“ (Saison steht im Titel/Tooltip) */
  function tabLabel(name) { return String(name || '').replace(/\s+\d{4}\s*\/\s*\d{2,4}$/, '') || String(name || ''); }
  function bindTabs(root, onPick) {
    var list = $('[role=tablist]', root);
    if (!list) return;
    list.addEventListener('click', function (e) {
      var b = e.target.closest('[data-tab]');
      if (b) onPick(b.getAttribute('data-tab'));
    });
    list.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var tabs = $$('[data-tab]', list);
      var i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      e.preventDefault();
      var n = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
      n.focus();
      onPick(n.getAttribute('data-tab'));
    });
  }
  function selectTab(root, key) {
    $$('[data-tab]', root).forEach(function (b) {
      var sel = b.getAttribute('data-tab') === String(key);
      b.setAttribute('aria-selected', String(sel));
      b.tabIndex = sel ? 0 : -1;
      if (sel && b.scrollIntoView) b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
  }
  function defaultComp(cur) {
    if (cur !== null && cur !== undefined && (cur === 'all' || findComp(cur))) return cur;
    return S.comps.length ? S.comps[0].id : 'all';
  }

  /* ================================================================ Rangliste */

  function viewRangliste() {
    mount('<div class="view narrow"><div class="view-head"><h1 class="view-title" tabindex="-1">Rangliste</h1></div>' +
      '<div id="lb-tabs"></div><div id="lb-panel" role="tabpanel" aria-labelledby="lb-tabs">' + skeleton(2) + '</div></div>');
    loadMatches().then(function () {
      if (S.route !== 'rangliste') return;
      S.lbComp = defaultComp(S.lbComp);
      $('#lb-tabs').innerHTML = compTabs(S.lbComp, 'lb');
      $('#lb-panel').id = 'lb-panel';
      bindTabs($('#lb-tabs'), function (key) {
        S.lbComp = key === 'all' ? 'all' : +key;
        selectTab($('#lb-tabs'), key);
        showLeaderboard();
      });
      showLeaderboard();
    }).catch(function (e) {
      if (isAuthError(e)) return sessionExpired();
      $('#lb-panel').innerHTML = loadError(e, 'lb-retry');
      $('#lb-retry').addEventListener('click', viewRangliste);
    });
  }

  function showLeaderboard() {
    var key = S.lbComp, panel = $('#lb-panel');
    if (!panel) return;
    if (!S.lb[key]) panel.innerHTML = skeleton(2);
    loadLeaderboard(key).then(function (lb) {
      if (S.route !== 'rangliste' || S.lbComp !== key) return;
      if (key === 'all') S.lbAll = lb;
      renderLeaderboard(lb, key);
    }).catch(function (e) {
      if (isAuthError(e)) return sessionExpired();
      panel.innerHTML = loadError(e, 'lb-retry');
      $('#lb-retry').addEventListener('click', function () { showLeaderboard(); });
    });
  }

  function renderLeaderboard(lb, key) {
    var panel = $('#lb-panel');
    var rows = lb.rows || [];
    var me = myRow(lb);
    var comp = key === 'all' ? null : findComp(key);
    var anyPoints = rows.some(function (r) { return r.points > 0; });
    var html = '<div class="lb-tools"><p class="lb-me">' + (me ? 'Du bist auf <b>Platz ' + me.rank + '</b> von ' + rows.length + ' · <b>' + me.points + '</b> ' + plural(me.points, 'Punkt', 'Punkte') : esc(rows.length + ' Mitspieler')) + '</p>' +
      (me && rows.length > 5 ? '<button type="button" class="btn btn--small btn--secondary" data-jump>' + icon('down') + 'Spring zu mir</button>' : '') + '</div>';
    if (key === 'all') html += '<p class="lead" style="margin:-6px 0 12px">Die ewige Tabelle – alle Wettbewerbe zusammen.</p>';
    if (anyPoints && rows.length >= 2) {
      var top = rows.slice(0, 3);
      var order = [top[1], top[0], top[2]];
      html += '<div class="card podium" aria-label="Die ersten drei">' + order.map(function (r, i) {
        if (!r) return '<div></div>';
        var place = i === 1 ? 1 : i === 0 ? 2 : 3;
        return '<button type="button" class="podium__place podium__place--' + place + (r.is_me ? ' is-me' : '') + '" data-player="' + esc(r.nickname) + '" aria-label="Platz ' + r.rank + ': ' + esc(r.nickname) + ', ' + r.points + ' Punkte – Tipps ansehen">' +
          '<span class="podium__avatar" style="background:hsl(' + hue(r.nickname) + ' 30% 30%)">' + (place === 1 ? '<svg class="podium__crown" viewBox="0 0 24 16" aria-hidden="true"><path d="M2 14L4 3l5 5 3-7 3 7 5-5 2 11z" fill="currentColor"/></svg>' : '') + esc(initials(r.nickname)) + '</span>' +
          '<span class="podium__name">' + esc(r.nickname) + '</span><span class="podium__pts"><b>' + r.points + '</b> Pkt.</span>' +
          '<span class="podium__block" aria-hidden="true">' + r.rank + '</span></button>';
      }).join('') + '</div>';
    } else if (rows.length) {
      html += '<div class="card notice" style="margin-bottom:14px">' + icon('info') + '<p>Die Tafel ist noch sauber: Sobald die ersten Ergebnisse eingetragen sind, gibt’s hier Punkte und ein Treppchen.</p></div>';
    }
    if (!rows.length) {
      html += '<div class="card empty">' + emptyArt('glass') + '<h2>Noch niemand dabei</h2><p>Sobald sich Stammgäste angemeldet haben, steht hier die Tabelle.</p></div>';
      panel.innerHTML = html;
      return;
    }
    html += '<div class="card lb-card"><table class="lb"><caption class="sr-only">Rangliste ' + esc(comp ? comp.name : 'gesamt') + '</caption><thead><tr>' +
      '<th class="l" scope="col"><span class="sr-only">Platz</span>#</th><th class="l" scope="col">Spieler</th>' +
      '<th scope="col"><abbr title="Punkte" style="text-decoration:none">Pkt</abbr></th>' +
      '<th scope="col" class="sm">exakt</th><th scope="col" class="sm">Diff</th><th scope="col" class="sm hide-xs"><abbr title="Tendenz" style="text-decoration:none">Tend.</abbr></th><th scope="col" class="sm">Tipps</th>' +
      '</tr></thead><tbody>' + rows.map(function (r) {
        return '<tr class="' + (r.is_me ? 'is-me' : '') + '" data-row="' + esc(r.nickname) + '"' + (r.is_me ? ' id="lb-me"' : '') + '>' +
          '<td class="rk">' + r.rank + '</td>' +
          '<td class="nm l"><button type="button" data-player="' + esc(r.nickname) + '" aria-label="' + esc(r.nickname) + ' – Tipps ansehen">' + avatar(r.nickname, 'av') + '<span>' + esc(r.nickname) + '</span>' + (r.is_me ? '<span class="me-tag">Du</span>' : '') + '</button></td>' +
          '<td class="pt">' + r.points + '</td><td class="sm">' + r.exact + '</td><td class="sm">' + r.diff + '</td><td class="sm hide-xs">' + r.tendency + '</td><td class="sm">' + r.tips + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<p class="lb-legend">Bei Punktgleichheit zählen erst die exakten Treffer, dann die Tordifferenz.' + (rows.some(function (r) { return r.bonus; }) ? ' Punkte inkl. Bonusfrage.' : '') + (S.owner ? ' Tipp auf einen Namen, um alle seine Tipps zu sehen – auch die noch offenen.' : ' Tipp auf einen Namen, um seine Tipps zu sehen.') + '</p>';
    panel.innerHTML = html;
    panel.onclick = function (e) {
      var j = e.target.closest('[data-jump]');
      if (j) { jumpToMe(); return; }
      var p = e.target.closest('[data-player]');
      if (p) { openPlayer(p.getAttribute('data-player'), rowsBy(rows, p.getAttribute('data-player')), p); return; }
      var tr = e.target.closest('tr[data-row]');
      if (tr) { var b = $('button', tr); openPlayer(tr.getAttribute('data-row'), rowsBy(rows, tr.getAttribute('data-row')), b); }
    };
  }
  function rowsBy(rows, nick) { for (var i = 0; i < rows.length; i++) if (rows[i].nickname === nick) return rows[i]; return null; }
  function jumpToMe() {
    var tr = $('#lb-me');
    if (!tr) return;
    tr.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    tr.classList.remove('flash'); void tr.offsetWidth; tr.classList.add('flash');
    var b = $('button', tr);
    if (b) b.focus({ preventScroll: true });
  }

  /* ================================================================ Bottom-Sheet */

  var sheetState = null;
  function openSheet(html, opener) {
    closeSheet(true);
    var root = $('#sheet-root');
    root.innerHTML = '<div class="sheet-backdrop" data-close></div><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">' + html + '</div>';
    document.body.classList.add('no-scroll');
    var sheet = $('.sheet', root);
    sheetState = { opener: opener || document.activeElement };
    $('#main').setAttribute('aria-hidden', 'true');
    $('#main').inert = true;
    root.onclick = function (e) { if (e.target.closest('[data-close]')) closeSheet(); };
    sheet.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); closeSheet(); return; }
      if (e.key !== 'Tab') return;
      var f = $$('button, a[href], input, [tabindex]:not([tabindex="-1"])', sheet).filter(function (x) { return !x.disabled && x.offsetParent !== null; });
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    });
    var c = $('.sheet__close', sheet);
    if (c) c.focus();
    return sheet;
  }
  function closeSheet(instant) {
    if (!sheetState) return;
    var root = $('#sheet-root');
    var st = sheetState;
    sheetState = null;
    document.body.classList.remove('no-scroll');
    $('#main').removeAttribute('aria-hidden');
    $('#main').inert = false;
    var done = function () { root.innerHTML = ''; if (!instant && st.opener && document.contains(st.opener)) st.opener.focus({ preventScroll: true }); };
    if (instant || reduceMotion) { done(); return; }
    $$('.sheet, .sheet-backdrop', root).forEach(function (x) { x.classList.add('is-closing'); });
    setTimeout(done, 220);
  }

  function openPlayer(nick, row, opener) {
    var head = '<div class="sheet__grip" aria-hidden="true"></div><div class="sheet__head">' + avatar(nick, 'sheet__avatar') +
      '<div><h2 class="sheet__title" id="sheet-title">' + esc(nick) + '</h2><p class="sheet__sub">' +
      (row ? 'Platz ' + row.rank + ' · ' + row.points + ' ' + plural(row.points, 'Punkt', 'Punkte') + ' · ' + row.exact + '× exakt' : '') + '</p></div>' +
      '<button type="button" class="sheet__close" data-close aria-label="Schließen">' + icon('x') + '</button></div>';
    var sheet = openSheet(head + '<div class="sheet__body" id="sheet-body">' + skeleton(1) + '</div>', opener);
    API.call('player_tips', rq({ nickname: nick })).then(function (r) {
      var body = $('#sheet-body', sheet);
      if (!body) return;
      var html = '';
      var owner = !!r.owner;
      (r.bonus || []).forEach(function (b) {
        html += '<div class="sheet-bonus"><p class="eyebrow">Bonusfrage · ' + esc(b.competition) + '</p><p style="margin:4px 0 6px">' + esc(b.question) + '</p>' +
          '<p><b>' + esc(b.answer) + '</b> ' + (b.correct === true ? '<span class="chip chip--exact" style="margin-left:6px">Richtig</span>' : b.correct === false ? '<span class="chip chip--miss" style="margin-left:6px">Leider nicht</span>' :
            '<span class="chip chip--open" style="margin-left:6px">' + (owner && b.locked === false ? 'noch änderbar' : 'offen') + '</span>') + '</p></div>';
      });
      var tips = r.tips || [];
      if (!tips.length) {
        html += '<div class="empty" style="padding:20px 8px">' + emptyArt('glass') + '<h3>Noch nichts zu sehen</h3><p>' +
          (owner ? 'Hat bisher noch nichts getippt.' : r.player && r.player.is_me ? 'Deine Tipps erscheinen hier, sobald die Spiele angepfiffen sind.' : 'Tipps der anderen siehst du erst nach dem Anstoß – und bisher gibt es keine.') + '</p></div>';
      } else {
        html += '<p class="sheet-section-title">' + (owner ? 'Alle Tipps – auch vor dem Anstoß' : 'Tipps auf angepfiffene Spiele') + '</p>' + tips.map(function (t) {
          var res = hasRes(t);
          return '<div class="ptip"><span class="ptip__when">' + esc(kickShort(t.kickoff)) + (t.round ? ' · ' + esc(t.round) : '') + '</span>' +
            '<span class="ptip__teams">' + esc(t.home) + ' <span class="ptip__res">' + (res ? t.home_goals + ':' + t.away_goals : '–:–') + '</span> ' + esc(t.away) + '</span>' +
            '<span class="ptip__right"><span class="ptip__tip">Tipp <b>' + t.tip.home + ':' + t.tip.away + '</b></span>' +
            (res && t.kind ? kindChip(t.kind, t.points) : '<span class="chip chip--open">' + (t.locked === false ? 'noch offen' : 'läuft') + '</span>') + '</span></div>';
        }).join('');
      }
      body.innerHTML = html;
    }).catch(function (e) {
      if (isAuthError(e)) { closeSheet(true); return sessionExpired(); }
      var body = $('#sheet-body', sheet);
      if (body) body.innerHTML = '<div class="form-error">' + icon('info') + '<span>' + esc(errText(e)) + '</span></div>';
    });
  }

  /* ================================================================ Statistik */

  function viewStatistik() {
    if (S.owner) { viewOwnerStats(); return; }
    mount('<div class="view"><div class="view-head"><h1 class="view-title" tabindex="-1">Statistik</h1></div>' +
      '<div id="st-tabs"></div><div id="st-panel" role="tabpanel">' + skeleton(3) + '</div></div>');
    loadMatches().then(function () {
      if (S.route !== 'statistik') return;
      S.statComp = defaultComp(S.statComp);
      $('#st-tabs').innerHTML = compTabs(S.statComp, 'st');
      bindTabs($('#st-tabs'), function (key) {
        S.statComp = key === 'all' ? 'all' : +key;
        selectTab($('#st-tabs'), key);
        showStats();
      });
      showStats();
    }).catch(function (e) {
      if (isAuthError(e)) return sessionExpired();
      $('#st-panel').innerHTML = loadError(e, 'st-retry');
      $('#st-retry').addEventListener('click', viewStatistik);
    });
  }

  function showStats() {
    var key = S.statComp, panel = $('#st-panel');
    panel.innerHTML = skeleton(3);
    var q = key === 'all' ? {} : { competition_id: key };
    Promise.all([API.call('stats', q), loadLeaderboard(key)]).then(function (res) {
      if (S.route !== 'statistik' || S.statComp !== key) return;
      renderStats(res[0], res[1]);
    }).catch(function (e) {
      if (isAuthError(e)) return sessionExpired();
      panel.innerHTML = loadError(e, 'st-retry');
      $('#st-retry').addEventListener('click', showStats);
    });
  }

  var KCOL = { exact: 'var(--amber)', diff: 'var(--green)', tendency: 'var(--teal)', miss: '#4a4c52' };

  function renderStats(s, lb) {
    var panel = $('#st-panel');
    var me = myRow(lb);
    var players = (lb.rows || []).length;
    var scored = s.scored_tips || 0;
    var html = '<div class="stats">';
    html += '<section class="card stat-hero span-2" aria-label="Deine Punkte"><div><p class="eyebrow">' + (S.statComp === 'all' ? 'Alle Wettbewerbe' : esc((findComp(S.statComp) || {}).name || '')) + '</p>' +
      '<p class="stat-hero__pts">' + s.points + '<small>' + plural(s.points, 'Punkt', 'Punkte') + '</small></p>' +
      '<p class="stat-hero__sub">' + s.tips + ' ' + plural(s.tips, 'Tipp', 'Tipps') + ' abgegeben, ' + scored + ' davon gewertet' + (s.bonus ? ' · inkl. ' + s.bonus + ' Bonuspunkte' : '') + '</p></div>' +
      '<div class="stat-hero__rank"><b>' + (me ? me.rank + '.' : '–') + '</b><span>von ' + players + '</span></div></section>';

    if (!scored) {
      html += '<section class="card empty span-2">' + emptyArt('chart') + '<h2>Noch nichts gewertet</h2><p>' +
        (s.tips ? 'Deine ' + s.tips + ' ' + plural(s.tips, 'Tipp ist', 'Tipps sind') + ' abgegeben – sobald die ersten Ergebnisse eingetragen sind, siehst du hier Trefferquote, Kurven und deine beste Runde.' :
          'Gib deine ersten Tipps ab. Sobald Ergebnisse da sind, wächst hier deine Statistik.') + '</p>' +
        '<a class="btn btn--primary" href="#/tippen">' + icon('ball') + 'Zum Tippen</a></section>';
      if (s.favorite_tip) html += tile('Lieblingstipp', esc(s.favorite_tip), 'dein häufigstes Ergebnis');
      html += '</div>';
      panel.innerHTML = html;
      return;
    }

    var better = s.avg_points >= s.avg_points_all;
    var maxAvg = Math.max(s.avg_points, s.avg_points_all, 0.01);
    var hits = s.exact + s.diff + s.tendency;
    html += '<div class="tiles span-2">' +
      tile('Trefferquote', dec(s.hit_rate, 0) + '<small>&nbsp;%</small>', '<b>' + hits + '</b> von ' + scored + ' Tipps mit Punkten') +
      '<div class="card tile"><p class="tile__l">Ø Punkte pro Tipp</p><p class="tile__v ' + (better ? 'up' : 'down') + '">' + dec(s.avg_points, 2) + '</p>' +
      '<div class="compare" aria-label="Du ' + dec(s.avg_points, 2) + ', Stammtisch ' + dec(s.avg_points_all, 2) + '">' +
      '<div class="compare__row"><span>Du</span><span class="compare__track"><span class="compare__fill" style="display:block;width:' + Math.round(s.avg_points / maxAvg * 100) + '%"></span></span><b>' + dec(s.avg_points, 2) + '</b></div>' +
      '<div class="compare__row"><span>Stammtisch</span><span class="compare__track"><span class="compare__fill compare__fill--all" style="display:block;width:' + Math.round(s.avg_points_all / maxAvg * 100) + '%"></span></span><b>' + dec(s.avg_points_all, 2) + '</b></div></div></div>' +
      tile('Lieblingstipp', esc(s.favorite_tip || '–'), 'dein häufigstes Ergebnis') +
      tile('Beste Runde', s.best_round ? s.best_round.points + '<small>&nbsp;Pkt.</small>' : '–', s.best_round ? esc(s.best_round.round) : '') +
      '</div>';

    // Donut
    var parts = [['exact', 'Volltreffer', s.exact], ['diff', 'Tordifferenz', s.diff], ['tendency', 'Tendenz', s.tendency], ['miss', 'Daneben', s.miss]];
    html += '<section class="card chart-card"><div class="chart-card__head"><h2 class="card-title">Deine Treffer</h2><span class="card-sub">' + scored + ' gewertete Tipps</span></div>' +
      '<div class="donut-wrap"><div class="donut-center">' + donut(parts, scored) + '<div class="donut-center__txt" aria-hidden="true"><b>' + dec(s.hit_rate, 0) + '%</b><span>Treffer</span></div></div>' +
      '<ul class="breakdown">' + parts.map(function (p) {
        return '<li><i style="background:' + KCOL[p[0]] + '"></i><span>' + p[1] + '</span><span><b>' + p[2] + '</b><small>' + (scored ? Math.round(p[2] / scored * 100) : 0) + '%</small></span></li>';
      }).join('') + '</ul></div></section>';

    // Rangverlauf
    html += '<section class="card chart-card"><div class="chart-card__head"><h2 class="card-title">Dein Platz im Verlauf</h2><span class="card-sub">nach jeder Runde, ohne Bonus</span></div>' +
      '<div class="chart-host" id="rank-host"></div></section>';
    // Punkte je Runde
    html += '<section class="card chart-card span-2"><div class="chart-card__head"><h2 class="card-title">Punkte pro Runde</h2>' +
      '<div class="legend"><span><i style="background:var(--amber)"></i>Du</span><span><i class="line" style="background:var(--text-2)"></i>Stammtisch-Ø</span></div></div>' +
      '<div class="chart-scroll"><div class="chart-host" id="round-host"></div></div><p class="chart-caption" id="round-caption" aria-live="polite"></p></section>';
    html += '</div>';
    panel.innerHTML = html;
    S.statData = { s: s, players: players };
    drawStatCharts();
  }
  function tile(label, value, sub) {
    return '<div class="card tile"><p class="tile__l">' + label + '</p><p class="tile__v">' + value + '</p>' + (sub ? '<p class="tile__s">' + sub + '</p>' : '') + '</div>';
  }
  function donut(parts, total) {
    var r = 52, C = 2 * Math.PI * r, off = 0, segs = '';
    parts.forEach(function (p) {
      if (!p[2]) return;
      var len = p[2] / total * C;
      var gap = len > 4 ? 2 : 0;
      segs += '<circle class="seg" cx="68" cy="68" r="' + r + '" stroke="' + KCOL[p[0]] + '" stroke-dasharray="' + Math.max(0, len - gap).toFixed(2) + ' ' + (C - len + gap).toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '"/>';
      off += len;
    });
    var label = parts.map(function (p) { return p[1] + ' ' + p[2]; }).join(', ');
    return '<svg class="donut" viewBox="0 0 136 136" role="img" aria-label="Aufteilung deiner Tipps: ' + label + '"><circle cx="68" cy="68" r="' + r + '" stroke="var(--surface-3)"/>' + segs + '</svg>';
  }

  function roundAbbr(label) {
    var g = /Gruppe\s+([A-Z])\b/i.exec(label), n = /(\d+)\.\s*Spieltag/i.exec(label);
    if (g && n) return g[1].toUpperCase() + n[1];
    if (n) return n[1] + '.';
    var known = [[/sechzehntel/i, '1/16'], [/achtel/i, 'AF'], [/viertel/i, 'VF'], [/halb/i, 'HF'], [/platz\s*3/i, 'P3'], [/finale/i, 'F'], [/ohne runde/i, '–']];
    var last = label.split(' · ').pop();
    for (var i = 0; i < known.length; i++) if (known[i][0].test(last)) return known[i][1];
    var m = /(\d+)/.exec(last);
    return m ? m[1] : last.slice(0, 3);
  }

  function drawStatCharts() {
    if (!S.statData) return;
    var s = S.statData.s;
    var rh = $('#rank-host'), ro = $('#round-host');
    if (rh) rh.innerHTML = rankChart(s.rank_history || [], Math.max(S.statData.players, 1), rh.clientWidth || 320);
    if (ro) {
      var host = ro.parentNode;
      ro.innerHTML = roundChart(s.by_round || [], host.clientWidth || 320);
      bindRoundChart(s.by_round || []);
    }
  }

  function niceMax(v) {
    if (v <= 4) return 4;
    if (v <= 6) return 6;
    if (v <= 8) return 8;
    if (v <= 10) return 10;
    var step = v <= 30 ? 5 : 10;
    return Math.ceil(v / step) * step;
  }

  function roundChart(rows, width) {
    var n = rows.length;
    if (!n) return '';
    var padL = 26, padR = 8, padT = 22, padB = 26, H = 200;
    var minCol = 40;
    var W = Math.max(width, padL + padR + n * minCol);
    var colW = (W - padL - padR) / n;
    var max = niceMax(Math.max.apply(null, rows.map(function (r) { return Math.max(r.points, r.avg_all); })));
    var y = function (v) { return padT + (H - padT - padB) * (1 - v / max); };
    var out = '<svg class="chart" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="group" aria-label="Punkte pro Runde, du im Vergleich zum Stammtisch-Durchschnitt">';
    [0, max / 2, max].forEach(function (t) {
      out += '<line class="grid" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y(t) + '" y2="' + y(t) + '"/><text x="' + (padL - 6) + '" y="' + (y(t) + 4) + '" text-anchor="end">' + dec(t, t % 1 ? 1 : 0) + '</text>';
    });
    var bw = Math.min(28, colW * 0.56), hitW = Math.min(colW - 2, 72);
    var pts = [];
    rows.forEach(function (r, i) {
      var cx = padL + colW * (i + 0.5);
      var top = y(r.points);
      pts.push([cx, y(r.avg_all)]);
      out += '<g class="col" tabindex="0" data-i="' + i + '" role="img" aria-label="' + esc(r.round) + ': du ' + r.points + ' Punkte, Stammtisch-Schnitt ' + dec(r.avg_all, 1) + '">' +
        '<rect class="bar-hit" x="' + (cx - hitW / 2) + '" y="' + padT + '" width="' + hitW + '" height="' + (H - padT - padB + 22) + '" rx="6"/>' +
        (r.points > 0 ? '<rect class="bar' + (reduceMotion ? '' : ' grow-y') + '" style="animation-delay:' + (i * 40) + 'ms" x="' + (cx - bw / 2) + '" y="' + top + '" width="' + bw + '" height="' + (y(0) - top) + '" rx="4"/>' : '<rect class="bar" x="' + (cx - bw / 2) + '" y="' + (y(0) - 2) + '" width="' + bw + '" height="2" rx="1" opacity=".5"/>') +
        '<text class="val" x="' + cx + '" y="' + (top - 6) + '" text-anchor="middle">' + r.points + '</text>' +
        '<text x="' + cx + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(roundAbbr(r.round)) + '</text></g>';
    });
    out += '<polyline class="avg" points="' + pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') + '"/>';
    pts.forEach(function (p) { out += '<circle class="avg-dot" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3.5"/>'; });
    return out + '</svg>';
  }
  function bindRoundChart(rows) {
    var host = $('#round-host'), cap = $('#round-caption');
    if (!host || !cap) return;
    var best = -1, bi = 0;
    rows.forEach(function (r, i) { if (r.points > best) { best = r.points; bi = i; } });
    function show(i) {
      var r = rows[i];
      if (!r) return;
      $$('.col', host).forEach(function (g) { g.classList.toggle('is-active', +g.getAttribute('data-i') === i); });
      var diff = r.points - r.avg_all;
      cap.innerHTML = '<b>' + esc(r.round) + '</b>: du ' + r.points + ' ' + plural(r.points, 'Punkt', 'Punkte') + ', Stammtisch-Ø ' + dec(r.avg_all, 1) +
        (diff > 0.05 ? ' – <span class="up">' + dec(diff, 1) + ' drüber</span>' : diff < -0.05 ? ' – <span class="down">' + dec(-diff, 1) + ' drunter</span>' : '');
    }
    host.onclick = function (e) { var g = e.target.closest('.col'); if (g) show(+g.getAttribute('data-i')); };
    host.onfocusin = function (e) { var g = e.target.closest('.col'); if (g) show(+g.getAttribute('data-i')); };
    host.onmouseover = function (e) { var g = e.target.closest('.col'); if (g) show(+g.getAttribute('data-i')); };
    show(bi);
  }

  function rankChart(hist, players, width) {
    var n = hist.length;
    if (!n) return '';
    var W = Math.max(width, 240), H = 190, padL = 34, padR = 10, padT = 26, padB = 26, inset = 16;
    var maxRank = Math.max(players, Math.max.apply(null, hist.map(function (h) { return h.rank || 1; })), 2);
    var x = function (i) { return n === 1 ? (padL + W - padR) / 2 : padL + inset + (W - padL - padR - 2 * inset) * i / (n - 1); };
    var y = function (r) { return padT + (H - padT - padB) * (r - 1) / (maxRank - 1); };
    var out = '<svg class="chart" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Dein Platz nach jeder Runde: ' +
      esc(hist.map(function (h) { return h.label + ' Platz ' + h.rank; }).join(', ')) + '">' +
      '<defs><linearGradient id="rankGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff6b74" stop-opacity=".28"/><stop offset="1" stop-color="#ff6b74" stop-opacity="0"/></linearGradient></defs>';
    var ticks = maxRank <= 4 ? range(1, maxRank) : [1, Math.round((1 + maxRank) / 2), maxRank];
    ticks.forEach(function (t) {
      out += '<line class="grid" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y(t) + '" y2="' + y(t) + '"/><text x="' + (padL - 8) + '" y="' + (y(t) + 4) + '" text-anchor="end">' + t + '.</text>';
    });
    var pts = hist.map(function (h, i) { return [x(i), y(h.rank || maxRank)]; });
    var line = pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ');
    if (n > 1) {
      out += '<polygon class="rarea" points="' + pts[0][0].toFixed(1) + ',' + (H - padB) + ' ' + line + ' ' + pts[n - 1][0].toFixed(1) + ',' + (H - padB) + '"/>';
      out += '<polyline class="rline' + (reduceMotion ? '' : ' draw') + '" points="' + line + '"/>';
    }
    var step = Math.ceil(n / Math.max(1, Math.floor((W - padL - padR) / 38)));
    pts.forEach(function (p, i) {
      out += '<circle class="rdot" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="4.5"/>';
      if (i === n - 1 || n <= 8 || i % step === 0) out += '<text class="val" x="' + p[0].toFixed(1) + '" y="' + (p[1] - 10).toFixed(1) + '" text-anchor="middle">' + hist[i].rank + '.</text>';
      if (i % step === 0 || i === n - 1) out += '<text x="' + p[0].toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(roundAbbr(hist[i].label)) + '</text>';
    });
    return out + '</svg>';
  }
  function range(a, b) { var r = []; for (var i = a; i <= b; i++) r.push(i); return r; }

  /* ================================================================ Profil */

  function viewProfil() {
    var p = S.player;
    var html = '<div class="view"><div class="view-head"><h1 class="view-title" tabindex="-1">Profil</h1></div><div class="profile">' +
      '<div class="profile__col">' +
      '<section class="card me-card" aria-label="Dein Konto"><span class="me-card__av" aria-hidden="true">' + esc(initials(p.nickname)) + '</span>' +
      '<div><p class="me-card__name">' + esc(p.nickname) + '</p><p class="me-card__mail">' + (p.email ? esc(p.email) : 'Keine E-Mail hinterlegt') + '</p></div>' +
      '<p class="me-card__note">Dein Nickname ist in der Rangliste sichtbar. Ändern kann ihn der Wirt – einfach an der Theke fragen.</p></section>' +
      rulesCard() +
      '<section class="card section-card" aria-labelledby="pr-privacy"><div class="section-card__head">' + icon('shield') + '<h2 class="card-title" id="pr-privacy">Datenschutz</h2></div>' +
      '<div class="privacy"><p>Wir speichern nur, was das Spiel braucht: deinen Nickname, dein Passwort (verschlüsselt), deine Tipps und – falls angegeben – deine E-Mail. Andere sehen nur deinen Nickname, deine Punkte und deine Tipps nach dem Anstoß.</p>' +
      '<p>Kein Geld, keine Einsätze, keine Werbung. Du kannst dein Konto jederzeit selbst löschen. Mehr dazu in der <a href="' + PRIVACY_URL + '">Datenschutzerklärung</a>.</p></div></section>' +
      '</div><div class="profile__col">' +
      '<section class="card section-card" aria-labelledby="pr-pw"><div class="section-card__head">' + icon('key') + '<h2 class="card-title" id="pr-pw">Passwort ändern</h2></div>' +
      '<form id="pw-form" novalidate>' + pwField('pw-old', 'Aktuelles Passwort', 'current-password') + pwField('pw-new', 'Neues Passwort', 'new-password', 'Mindestens 8 Zeichen. Andere Geräte werden danach abgemeldet.') +
      '<div id="pw-msg" role="status" aria-live="polite"></div>' +
      '<button type="submit" class="btn btn--secondary btn--block" style="margin-top:16px">Passwort speichern</button></form></section>' +
      '<section class="card section-card" aria-labelledby="pr-out"><div class="section-card__head">' + icon('out') + '<h2 class="card-title" id="pr-out">Abmelden</h2></div>' +
      '<p class="lead" style="margin-bottom:14px">Auf diesem Gerät abmelden. Deine Tipps bleiben natürlich gespeichert.</p>' +
      '<button type="button" class="btn btn--ghost btn--block" id="logout-btn">' + icon('out') + 'Abmelden</button>' +
      (S.mode === 'demo' ? '<button type="button" class="btn btn--ghost btn--block" id="demo-reset-2" style="margin-top:10px">' + icon('retry') + 'Demo zurücksetzen</button>' : '') + '</section>' +
      '<section class="card section-card danger-zone" aria-labelledby="pr-del"><div class="section-card__head">' + icon('trash') + '<h2 class="card-title" id="pr-del">Konto löschen</h2></div>' +
      '<p class="lead">Löscht dein Konto und alle deine Tipps endgültig. Das lässt sich nicht rückgängig machen.</p>' +
      '<div id="del-area"></div></section>' +
      '</div></div><p class="foot-note">Stüble-Tippspiel · Hofbräustüble Neckarsulm-Amorbach · <a href="../">Zur Website</a>' + (S.mode === 'demo' ? ' · Demo-Modus' : '') + '</p></div>';
    mount(html);
    var v = $('#view');
    bindPwToggles(v);
    renderDelete();
    $('#pw-form').addEventListener('submit', onChangePw);
    $('#logout-btn').addEventListener('click', onLogout);
    var dr = $('#demo-reset-2');
    if (dr) dr.addEventListener('click', onDemoReset);
  }

  function renderDelete(focusSel) {
    var area = $('#del-area');
    if (!area) return;
    if (!S.deleteStep) {
      area.innerHTML = '<button type="button" class="btn btn--danger btn--block" id="del-start" style="margin-top:14px" aria-expanded="false" aria-controls="del-area">' + icon('trash') + 'Konto löschen …</button>';
      $('#del-start').addEventListener('click', function () { S.deleteStep = true; renderDelete('#del-pw'); });
    } else {
      area.innerHTML = '<form class="confirm-box" id="del-form" novalidate><p><b>Wirklich löschen?</b> Deine Punkte verschwinden aus der Rangliste und alle Tipps sind weg. Zur Sicherheit bitte dein Passwort eingeben.</p>' +
        pwField('del-pw', 'Passwort', 'current-password') + '<div id="del-msg" role="alert"></div>' +
        '<div class="btn-row"><button type="button" class="btn btn--ghost" id="del-cancel">Abbrechen</button>' +
        '<button type="submit" class="btn btn--danger-solid">Ja, endgültig löschen</button></div></form>';
      bindPwToggles(area);
      $('#del-cancel').addEventListener('click', function () { S.deleteStep = false; renderDelete('#del-start'); });
      $('#del-form').addEventListener('submit', onDelete);
    }
    if (focusSel) { var f = $(focusSel); if (f) f.focus(); }
  }

  function onChangePw(e) {
    e.preventDefault();
    var btn = $('button[type=submit]', e.target), msg = $('#pw-msg');
    var oldPw = $('#pw-old').value, nw = $('#pw-new').value;
    var show = function (t, ok) { msg.innerHTML = '<div class="' + (ok ? 'form-ok' : 'form-error') + '">' + icon(ok ? 'check' : 'info') + '<span>' + esc(t) + '</span></div>'; };
    if (!oldPw) { show('Bitte gib dein aktuelles Passwort ein.'); $('#pw-old').focus(); return; }
    if (Array.from(nw).length < 8) { show('Das neue Passwort muss mindestens 8 Zeichen lang sein.'); $('#pw-new').focus(); return; }
    busy(btn, true);
    API.call('change_password', { old: oldPw, 'new': nw }).then(function () {
      return API.call('status').catch(function () { return null; });
    }).then(function () {
      busy(btn, false);
      $('#pw-old').value = ''; $('#pw-new').value = '';
      show('Passwort geändert. Andere Geräte sind jetzt abgemeldet.', true);
    }).catch(function (err) {
      busy(btn, false);
      if (isAuthError(err)) return sessionExpired();
      show(errText(err));
    });
  }
  function onLogout() {
    var btn = $('#logout-btn');
    busy(btn, true);
    flushDrafts();
    API.call('logout').catch(function () { return null; }).then(function () {
      S.player = null; resetData();
      toast('Du bist abgemeldet. Bis zum nächsten Spiel!', 'ok');
      if (S.admin) { S.owner = true; location.hash = '#/spiele'; if (parseHash() === 'spiele') onRoute(); return; }
      S.authTab = 'login';
      location.hash = '#/anmelden';
      if (parseHash() === 'anmelden') onRoute();
    });
  }
  function onDelete(e) {
    e.preventDefault();
    var btn = $('button[type=submit]', e.target), pw = $('#del-pw').value;
    if (!pw) { $('#del-msg').innerHTML = '<div class="form-error">' + icon('info') + '<span>Bitte gib dein Passwort ein.</span></div>'; $('#del-pw').focus(); return; }
    busy(btn, true);
    API.call('delete_account', { password: pw }).then(function () {
      S.player = null; resetData();
      toast('Dein Konto wurde gelöscht. Schön, dass du dabei warst!', 'ok');
      S.authTab = 'login';
      location.hash = '#/anmelden';
      if (parseHash() === 'anmelden') onRoute();
    }).catch(function (err) {
      busy(btn, false);
      if (isAuthError(err)) return sessionExpired();
      $('#del-msg').innerHTML = '<div class="form-error">' + icon('info') + '<span>' + esc(errText(err)) + '</span></div>';
    });
  }
  function onDemoReset() {
    API.demoReset();
    S.player = null; resetData();
    toast('Demo zurückgesetzt – frische Daten sind gezapft.', 'ok');
    if (S.admin) { S.owner = true; if (parseHash() === 'spiele') onRoute(); else location.hash = '#/spiele'; return; }
    S.authTab = 'login';
    if (parseHash() === 'anmelden') onRoute(); else location.hash = '#/anmelden';
  }

  var VIEWS = { tippen: viewTippen, rangliste: viewRangliste, statistik: viewStatistik, profil: viewProfil, spiele: viewSpiele };

  /* ================================================================ Takt: Countdown & Aktualisierung */

  function tick() {
    if ((!S.player && !S.owner) || document.hidden) return;
    if (S.owner) {
      if (S.route !== 'spiele') return;
      var due = false;
      $$('[data-countdown]').forEach(function (el) {
        var k = el.getAttribute('data-countdown');
        if (naiveMs(k) <= nowMs()) due = true;
        else el.innerHTML = deadlineBadge(k);
      });
      if (due || Date.now() - S.loadedAt > REFRESH_MS) refreshTippen(true);
      return;
    }
    if (S.route === 'tippen') {
      var needReload = false;
      $$('[data-countdown]').forEach(function (el) {
        var k = el.getAttribute('data-countdown');
        if (naiveMs(k) <= nowMs()) needReload = true;
        else el.innerHTML = deadlineBadge(k);
      });
      if ((needReload || Date.now() - S.loadedAt > REFRESH_MS) && !editingNow()) refreshTippen(true);
    }
  }

  /* ================================================================ Start */

  function renderFatal(e) {
    updateChrome();
    var setup = e && e.data && e.data.setup;
    mount('<div class="card fatal empty" role="alert">' + emptyArt('glass') + '<h1 class="view-title" style="font-size:24px;margin-bottom:8px">Das Tippspiel macht gerade Pause</h1>' +
      '<p>' + esc(errText(e)) + '</p>' + (setup ? '<p style="margin-top:8px">Der Server ist noch nicht fertig eingerichtet – bitte sag dem Wirt Bescheid.</p>' : '') +
      '<button type="button" class="btn btn--primary" id="fatal-retry">' + icon('retry') + 'Nochmal versuchen</button>' +
      '<p style="margin-top:14px"><a href="../" style="color:var(--brass-hi)">Zur Website vom Hofbräustüble</a></p></div>');
    $('#fatal-retry').addEventListener('click', function () { location.reload(); });
  }

  function boot() {
    var params = new URLSearchParams(location.search);
    S.inviteCode = (params.get('code') || '').trim().slice(0, 20);
    $('#demo-guest').addEventListener('click', demoGuestLogin);
    $('#demo-reset').addEventListener('click', onDemoReset);
    API.init({ base: BASE }).then(function (st) {
      S.mode = API.mode;
      S.player = st.player || null;
      S.admin = !!st.admin;
      // Nur die Verwaltung angemeldet → Wirt-Ansicht; beide → Spieler-App (Umschalter im Kopf), außer zuletzt als Wirt angesehen
      S.owner = S.admin && (!S.player || getViewPref());
      $('#view-toggle').addEventListener('click', function () { setOwner(!S.owner); });
      if (st.settings) S.settings = st.settings;
      if (st.serverTime) syncClock(st.serverTime);
      updateChrome();
      window.addEventListener('hashchange', onRoute);
      onRoute();
      setInterval(tick, 30000);
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) flushDrafts();
        else tick();
      });
      window.addEventListener('pagehide', flushDrafts);
      var rt = null;
      window.addEventListener('resize', function () {
        clearTimeout(rt);
        rt = setTimeout(function () { if (S.route === 'statistik') drawStatCharts(); }, 200);
      });
    }).catch(function (e) {
      S.mode = API.mode;
      renderFatal(e);
    });
  }

  if (!API) {
    document.getElementById('view').innerHTML = '<div class="card notice">Das Tippspiel konnte nicht geladen werden. Bitte lade die Seite neu.</div>';
    return;
  }
  boot();
})();
