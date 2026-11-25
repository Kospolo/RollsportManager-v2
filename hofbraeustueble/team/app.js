/*
 * Hofbräustüble – Team & Dienstplan (App)
 * Eine Seite für Mitarbeiter (du-Ansprache) und Chef (CMS-Anmeldung).
 * Daten über window.TeamAPI (team/js/team-client.js) – live oder Demo.
 * Keine window.alert/confirm/prompt: alle Rückfragen als Dialog auf der Seite.
 */
(function () {
  'use strict';

  var API = window.TeamAPI;
  var U = API.util;
  var $view = document.getElementById('view');
  var $tabbar = document.getElementById('tabbar');
  var $topnav = document.getElementById('topnav');
  var $toggle = document.getElementById('view-toggle');
  var $chefBar = document.getElementById('chef-bar');
  var $live = document.getElementById('live');

  var app = {
    data: null,          // staff_data
    chef: null,          // chef_data
    weekStart: null,     // Team-Woche (Mitarbeiter)
    chefWeek: null,      // Wochenplan (Chef)
    chefMode: 'week',    // week | month
    chefMonth: null,     // YYYY-MM
    hoursMonth: null,    // Chef: Stunden-Übersicht
    hours: null,
    thread: null,        // Chef: geöffneter Verlauf
    availTool: 'yes',
    lastRoute: '',
    loading: false,
    booted: false
  };

  /* ============================================================ Hilfen */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function ico(id, cls) { return '<svg class="ico' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#i-' + id + '"/></svg>'; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  var DOW = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  var DOW_S = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  var MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  var CATS = { getraenke: 'Getränke', kueche: 'Küche', putzmittel: 'Putzmittel', sonstiges: 'Sonstiges' };
  var ABS = { urlaub: 'Urlaub', krank: 'krank', sonstiges: 'Sonstiges' };

  function dow(date) { return new Date(U.naiveMs(date)).getUTCDay(); }
  function dayLong(date) { var d = new Date(U.naiveMs(date)); return DOW[d.getUTCDay()] + ', ' + d.getUTCDate() + '. ' + MONTHS[d.getUTCMonth()]; }
  function dayShort(date) { var d = new Date(U.naiveMs(date)); return DOW_S[d.getUTCDay()] + ' ' + d.getUTCDate() + '.' + (d.getUTCMonth() + 1) + '.'; }
  function dateDE(date) { return date ? date.slice(8, 10) + '.' + date.slice(5, 7) + '.' + date.slice(0, 4) : ''; }
  function today() { return (app.data && app.data.today) || (app.chef && app.chef.today) || U.today(); }
  function relDay(date) {
    var t = today();
    if (date === t) return 'Heute';
    if (date === U.addDays(t, 1)) return 'Morgen';
    return dayLong(date);
  }
  function timeRange(s) {
    return s.start + ' – ' + s.end + ' Uhr' + (s.end <= s.start ? ' (bis ' + DOW[dow(U.addDays(s.date, 1))] + ')' : '');
  }
  function stamp(full) { if (!full) return ''; return full.slice(8, 10) + '.' + full.slice(5, 7) + '. ' + full.slice(11, 16) + ' Uhr'; }
  function fmtHours(min) {
    var h = Math.floor(min / 60), m = min % 60;
    return (h ? h + ' Std.' : '') + (m ? (h ? ' ' : '') + m + ' Min.' : (h ? '' : '0 Std.'));
  }
  function money(v) {
    if (v === null || v === undefined) return '–';
    try { return Number(v).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }); } catch (e) { return Number(v).toFixed(2).replace('.', ',') + ' €'; }
  }
  function moneyInput(v) { return v === null || v === undefined ? '' : Number(v).toFixed(2).replace('.', ','); }
  function monthName(m) { return MONTHS[+m.slice(5, 7) - 1] + ' ' + m.slice(0, 4); }
  function weekNo(date) {
    var d = new Date(U.naiveMs(date));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    var y = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d - y) / 86400000 + 1) / 7);
  }
  function nowNaive() { return U.naiveMs(U.berlinNow()); }
  function isRunning(s) { var b = U.shiftBounds(s.date, s.start, s.end), n = nowNaive(); return n >= b[0] && n <= b[1]; }
  function initial(n) { return esc(String(n || '?').charAt(0).toUpperCase()); }
  function mods() { var s = (app.data && app.data.settings) || (app.chef && app.chef.settings) || API.settings || {}; return s.modules || {}; }
  function chefMods() { return (app.chef && app.chef.settings && app.chef.settings.modules) || mods(); }

  var ST_TEXT = { yes: 'Zugesagt', no: 'Abgesagt', none: 'Noch keine Antwort', open: 'Offen – wer kann?', requested: 'Angefragt' };
  var ST_ICON = { yes: 'check', no: 'x', none: 'clock', open: 'hand', requested: 'clock' };
  function pill(status, text) {
    return '<span class="st st--' + esc(status) + '">' + ico(ST_ICON[status] || 'info') + esc(text || ST_TEXT[status] || status) + '</span>';
  }
  function absPill(a) {
    var t = { pending: 'Wartet auf den Chef', approved: 'Genehmigt', declined: 'Abgelehnt' }[a.status] || a.status;
    var i = { pending: 'clock', approved: 'check', declined: 'x' }[a.status] || 'info';
    return '<span class="st st--' + esc(a.status) + '">' + ico(i) + esc(t) + '</span>';
  }
  function announce(msg) { $live.textContent = ''; setTimeout(function () { $live.textContent = msg; }, 30); }

  /* ------------------------------------------------------------- Toasts */
  var $toasts = document.getElementById('toasts');
  function toast(msg, type) {
    var el = document.createElement('div');
    el.className = 'toast' + (type === 'err' ? ' toast--err' : '');
    el.innerHTML = ico(type === 'err' ? 'warn' : 'check') + '<span>' + esc(msg) + '</span>';
    $toasts.appendChild(el);
    setTimeout(function () { el.remove(); }, type === 'err' ? 7000 : 4000);
  }
  function errMsg(e) { return (e && e.message) || 'Das hat leider nicht geklappt.'; }

  /* ------------------------------------------------------------- Dialoge */
  var sheet = null;
  function openSheet(title, body, opts) {
    closeSheet(true);
    opts = opts || {};
    var opener = document.activeElement;
    var root = document.getElementById('sheet-root');
    var wrap = document.createElement('div');
    wrap.className = 'sheet-backdrop';
    wrap.innerHTML = '<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">' +
      '<div class="sheet__head"><h2 class="sheet__title" id="sheet-title">' + esc(title) + '</h2>' +
      '<button type="button" class="sheet__close" data-close aria-label="Schließen">' + ico('x') + '</button></div>' +
      '<div class="sheet__body">' + body + '</div></div>';
    root.appendChild(wrap);
    document.body.classList.add('no-scroll');
    sheet = { el: wrap, opener: opener, onClose: opts.onClose || null };
    wrap.addEventListener('click', function (e) { if (e.target === wrap) closeSheet(); });
    wrap.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); closeSheet(); return; }
      if (e.key !== 'Tab') return;
      var f = wrap.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])');
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    var focusEl = wrap.querySelector('[autofocus]') || wrap.querySelector('.sheet__body input, .sheet__body select, .sheet__body textarea, .sheet__body button') || wrap.querySelector('.sheet__close');
    setTimeout(function () { if (focusEl) focusEl.focus(); }, 30);
    return wrap.querySelector('.sheet');
  }
  function closeSheet(instant) {
    if (!sheet) return;
    var s = sheet;
    sheet = null;
    s.el.remove();
    document.body.classList.remove('no-scroll');
    if (s.onClose) s.onClose();
    if (!instant && s.opener && document.body.contains(s.opener)) s.opener.focus();
  }
  /** Rückfrage → Promise<boolean> */
  function ask(title, text, okText, danger) {
    return new Promise(function (resolve) {
      var done = false;
      var el = openSheet(title, '<p>' + text + '</p><div class="sheet__foot btn-row">' +
        '<button type="button" class="btn ' + (danger ? 'btn--danger-solid' : 'btn--primary') + '" data-ok autofocus>' + esc(okText || 'Ja') + '</button>' +
        '<button type="button" class="btn btn--ghost" data-cancel>Abbrechen</button></div>', { onClose: function () { if (!done) resolve(false); } });
      el.querySelector('[data-ok]').addEventListener('click', function () { done = true; closeSheet(); resolve(true); });
      el.querySelector('[data-cancel]').addEventListener('click', function () { closeSheet(); });
    });
  }

  function setBusy(btn, on) {
    if (!btn) return;
    btn.disabled = !!on;
    btn.classList.toggle('is-busy', !!on);
    btn.setAttribute('aria-busy', on ? 'true' : 'false');
  }
  /** API-Aufruf mit Knopf-Sperre, Fehler-Toast; gibt Ergebnis oder null zurück */
  async function run(btn, action, data, okMsg) {
    setBusy(btn, true);
    try {
      var r = await API.call(action, data || {});
      if (okMsg) { toast(okMsg); announce(okMsg); }
      return r;
    } catch (e) {
      if (e.data && e.data.teamDisabled) { render(); }
      toast(errMsg(e), 'err');
      announce(errMsg(e));
      return null;
    } finally {
      if (btn && document.body.contains(btn)) setBusy(btn, false);
    }
  }
  function formData(form) {
    var o = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.disabled) return;
      if (el.type === 'checkbox') o[el.name] = el.checked;
      else if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; }
      else o[el.name] = el.value;
    });
    return o;
  }
  function showFormError(form, msg) {
    var box = form.querySelector('.form-error');
    if (!box) { box = document.createElement('div'); box.className = 'form-error'; form.appendChild(box); }
    box.innerHTML = msg ? '<div class="notice notice--err" role="alert">' + ico('warn') + '<span>' + esc(msg) + '</span></div>' : '';
  }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* Fallback */ }
    var ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.className = 'sr-only';
    document.body.appendChild(ta); ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  }
  function pwField(name, label, auto, hint) {
    var id = 'f-' + name + '-' + Math.random().toString(36).slice(2, 7);
    return '<label class="field" for="' + id + '"><span class="field__label">' + esc(label) + '</span><span class="pw-wrap">' +
      '<input class="input" type="password" id="' + id + '" name="' + name + '" autocomplete="' + auto + '" required maxlength="200">' +
      '<button type="button" class="pw-toggle" data-act="pw-toggle" aria-label="Passwort anzeigen" aria-pressed="false">' + ico('eye') + '</button></span>' +
      (hint ? '<span class="field__hint">' + esc(hint) + '</span>' : '') + '</label>';
  }
  function field(label, input, hint) {
    return '<label class="field"><span class="field__label">' + label + '</span>' + input + (hint ? '<span class="field__hint">' + hint + '</span>' : '') + '</label>';
  }

  /* ============================================================ Navigation */

  function routeParts() { return location.hash.replace(/^#\/?/, '').split('/').filter(Boolean); }
  function isChefRoute() { return routeParts()[0] === 'chef'; }
  function go(hash) { if (location.hash === hash) render(true); else location.hash = hash; }

  var STAFF_TABS = [
    { r: 'start', label: 'Start', icon: 'home' },
    { r: 'plan', label: 'Plan', icon: 'cal' },
    { r: 'frei', label: 'Frei', icon: 'sun' },
    { r: 'nachrichten', label: 'Nachrichten', short: 'Chat', icon: 'chat' },
    { r: 'ich', label: 'Ich', icon: 'user' }
  ];
  var CHEF_TABS = [
    { r: 'chef/plan', label: 'Plan', icon: 'cal' },
    { r: 'chef/team', label: 'Team', icon: 'team' },
    { r: 'chef/anfragen', label: 'Anfragen', icon: 'inbox' },
    { r: 'chef/nachrichten', label: 'Nachrichten', short: 'Chat', icon: 'chat' },
    { r: 'chef/einstellungen', label: 'Einstellungen', short: 'Optionen', icon: 'gear' }
  ];

  function renderNav(mode) {
    if (mode === 'none') { $tabbar.hidden = true; $topnav.hidden = true; return; }
    var tabs = mode === 'chef' ? CHEF_TABS : STAFF_TABS;
    var p = routeParts();
    var cur = mode === 'chef' ? 'chef/' + (p[1] || 'plan') : (p[0] || 'start');
    if (mode !== 'chef' && cur === 'bestellen') cur = 'start';
    var badges = {};
    if (mode === 'chef' && app.chef) {
      badges['chef/anfragen'] = app.chef.counts.requests + (chefMods().orders ? app.chef.counts.orders : 0);
      badges['chef/nachrichten'] = app.chef.counts.unread;
    } else if (app.data) {
      badges.nachrichten = app.data.unread.messages + app.data.unread.board;
      badges.plan = app.data.my_shifts.filter(function (s) { return s.status === 'none'; }).length;
    }
    function link(t, small) {
      var n = badges[t.r] || 0;
      var lbl = small && t.short && window.innerWidth < 520 ? t.short : t.label;
      return '<a href="#/' + t.r + '"' + (cur === t.r ? ' aria-current="page"' : '') + '>' + ico(t.icon) + '<span class="lbl">' + esc(lbl) + '</span>' +
        (n ? '<span class="dot" aria-label="' + n + ' neu">' + n + '</span>' : '') + '</a>';
    }
    $tabbar.innerHTML = tabs.map(function (t) { return link(t, true); }).join('');
    $topnav.innerHTML = tabs.map(function (t) { return link(t, false); }).join('');
    $tabbar.hidden = false; $topnav.hidden = false;
  }

  function renderChrome(mode) {
    var both = !!(API.me && API.chef);
    $toggle.hidden = !both;
    document.body.classList.toggle('has-toggle', both);
    if (both) $toggle.innerHTML = mode === 'chef' ? ico('user') + '<span>Mitarbeiter-Ansicht</span>' : ico('key') + '<span>Chef-Ansicht</span>';
    $chefBar.hidden = mode !== 'chef';
    var extra = document.getElementById('chef-bar-extra');
    extra.textContent = API.enabled ? '' : '– Team-Bereich ist für Mitarbeiter ausgeschaltet – einschalten im CMS unter Funktionen';
    var rib = document.getElementById('demo-ribbon');
    rib.hidden = API.mode !== 'demo';
    document.body.classList.toggle('has-ribbon', API.mode === 'demo');
    document.getElementById('brand-link').setAttribute('href', mode === 'chef' ? '#/chef/plan' : '#/start');
  }

  /* ============================================================ Laden */

  async function loadStaff() {
    if (!app.weekStart) app.weekStart = U.mondayOf(U.today());
    app.data = await API.call('staff_data', { from: app.weekStart, to: U.addDays(app.weekStart, 6) });
    return app.data;
  }
  function chefRange() {
    if (app.chefMode === 'month') {
      var m = app.chefMonth || U.today().slice(0, 7);
      var first = m + '-01', from = U.mondayOf(first);
      return [from, U.addDays(from, 41)];
    }
    if (!app.chefWeek) app.chefWeek = U.mondayOf(U.today());
    return [app.chefWeek, U.addDays(app.chefWeek, 6)];
  }
  async function loadChef() {
    var r = chefRange();
    app.chef = await API.call('chef_data', { from: r[0], to: r[1] });
    return app.chef;
  }

  /* ============================================================ Render */

  var renderSeq = 0;
  async function render(fresh) {
    var seq = ++renderSeq;
    var p = routeParts();
    var routeKey = p.join('/');
    var routeChanged = routeKey !== app.lastRoute;
    app.lastRoute = routeKey;
    var mode;

    // Wer ist da?
    if (p[0] === 'chef') {
      if (!API.chef) { go(API.me ? '#/start' : '#/'); return; }
      mode = 'chef';
    } else if (API.me) {
      mode = 'staff';
    } else if (API.chef && !hasCode()) {
      go('#/chef/plan'); return;
    } else {
      mode = 'none';
    }
    renderChrome(mode);

    if (mode === 'none') {
      renderNav('none');
      $view.innerHTML = API.enabled ? (hasCode() ? viewRegister() : viewLogin()) : viewDisabled();
      afterRender(routeChanged);
      if (hasCode() && API.enabled) checkInvite();
      return;
    }
    if (mode === 'staff' && !API.enabled) {
      renderNav('none');
      $view.innerHTML = viewDisabled();
      afterRender(routeChanged);
      return;
    }

    var need = mode === 'chef' ? !app.chef : !app.data;
    if (need) $view.innerHTML = '<div class="boot" role="status"><span class="spinner" aria-hidden="true"></span><span>Wird geladen …</span></div>';
    else { paint(mode, p); if (routeChanged) afterRender(true); }
    if (need || fresh || routeChanged) {
      try {
        if (mode === 'chef') {
          await loadChef();
          if (p[1] === 'nachrichten' && p[2] && /^\d+$/.test(p[2])) await loadThread(+p[2]);
          if (p[1] === 'team') await loadHours();
        } else {
          await loadStaff();
        }
      } catch (e) {
        if (seq !== renderSeq) return;
        if (e.status === 401) { app.data = null; app.chef = null; render(); return; }
        if (e.data && e.data.teamDisabled) { render(); return; }
        $view.innerHTML = '<div class="card notice notice--err" role="alert">' + ico('warn') + '<div><p>' + esc(errMsg(e)) + '</p>' +
          '<div class="gap"></div><button type="button" class="btn btn--secondary" data-act="reload">' + ico('retry') + 'Noch mal versuchen</button></div></div>';
        return;
      }
      if (seq !== renderSeq) return;
      paint(mode, p);
      afterRender(need && routeChanged);
      if (mode === 'staff') sideEffectsStaff(p);
    }
  }

  function paint(mode, p) {
    renderNav(mode);
    var html;
    if (mode === 'chef') {
      var sec = p[1] || 'plan';
      html = sec === 'team' ? viewChefTeam() : sec === 'anfragen' ? viewChefRequests(p[2]) : sec === 'nachrichten' ? viewChefMessages(p[2])
        : sec === 'einstellungen' ? viewChefSettings() : viewChefPlan();
    } else {
      var r = p[0] || 'start';
      html = r === 'plan' ? viewPlan(p[1]) : r === 'frei' ? viewFrei(p[1]) : r === 'nachrichten' ? viewMessages(p[1]) : r === 'ich' ? viewMe()
        : r === 'bestellen' ? viewOrders(false) : viewStart();
    }
    var y = window.scrollY;
    $view.innerHTML = html;
    window.scrollTo(0, y);
    applyWidths();
  }
  function afterRender(focusTitle) {
    if (!focusTitle) return;
    window.scrollTo(0, 0);
    var h = $view.querySelector('h1');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }
  function applyWidths() {
    Array.prototype.forEach.call($view.querySelectorAll('[data-w]'), function (el) { el.style.width = Math.max(0, Math.min(100, +el.getAttribute('data-w'))) + '%'; });
  }
  function sideEffectsStaff(p) {
    // Nachrichten vom Chef als gelesen markieren, sobald der Verlauf offen ist
    if (p[0] === 'nachrichten' && p[1] !== 'brett' && app.data && app.data.unread.messages > 0) {
      API.call('message_read', {}).then(function () { app.data.unread.messages = 0; renderNav('staff'); }).catch(function () { /* egal */ });
    }
    var th = $view.querySelector('.thread');
    if (th && th.lastElementChild) th.lastElementChild.scrollIntoView({ block: 'nearest' });
  }

  function hasCode() { return /[?&]code=[A-Za-z0-9\- ]{4,20}/.test(location.search); }
  function codeFromUrl() { var m = /[?&]code=([A-Za-z0-9\- ]{4,20})/.exec(location.search); return m ? decodeURIComponent(m[1]).toUpperCase() : ''; }

  /* ============================================================ Anmelden */

  function viewDisabled() {
    return '<div class="disabled-screen card">' + ico('info') +
      '<h1 class="page-title">Der Team-Bereich ist gerade ausgeschaltet</h1>' +
      '<p class="page-sub">Der Chef hat den Dienstplan im Moment abgeschaltet. Bei Fragen zu deinen Schichten melde dich bitte direkt im Stüble.</p>' +
      '<div class="gap"></div>' + (API.me ? '<div class="sheet__foot"><button type="button" class="btn btn--ghost" data-act="logout">' + ico('out') + 'Abmelden</button></div>' : '') +
      '<p class="sheet__foot"><a href="../">Zur Website vom Hofbräustüble</a></p></div>';
  }

  function viewLogin() {
    var demo = API.mode === 'demo';
    return '<div class="auth"><h1 class="auth__title">Anmelden</h1>' +
      '<p class="auth__lead">Hier siehst du deine Schichten, sagst zu oder ab und trägst Urlaub ein.</p>' +
      (demo ? '<div class="notice notice--warn">' + ico('info') + '<span>Demo: Name <strong>Anja</strong>, Passwort <strong>' + esc(API.demoPassword) + '</strong> – oder oben „Als Anja“ / „Als Chef“ tippen.</span></div><div class="gap"></div>' : '') +
      '<form class="card" data-form="login" novalidate>' +
      field('Dein Name', '<input class="input" name="name" autocomplete="username" required maxlength="30" autocapitalize="words">') +
      pwField('password', 'Passwort', 'current-password') +
      '<div class="sheet__foot"><button class="btn btn--primary btn--block btn--big" type="submit">Anmelden</button></div></form>' +
      '<div class="section card card--plain"><p><strong>Noch kein Zugang?</strong> Frag den Chef nach einer Einladung – du bekommst dann einen Link oder einen QR-Code.</p>' +
      '<p class="small muted">Passwort vergessen? Der Chef kann dir ein neues geben.</p></div>' +
      '<div class="section"><p class="small muted">Chef? Erst in der <a href="../admin/">Verwaltung</a> anmelden, dann diese Seite neu laden.</p></div></div>';
  }

  function privacyNote() {
    return '<details class="help"><summary>' + ico('shield') + '&nbsp;Datenschutz – was wird gespeichert?</summary><div class="small">' +
      '<p>Gespeichert werden nur: dein Name, dein Passwort (verschlüsselt), freiwillig deine Telefonnummer, deine Schichten, Antworten, Abwesenheiten, Verfügbarkeit und Nachrichten – nur für die Dienstplanung im Hofbräustüble.</p>' +
      '<p>Kollegen sehen nur deinen Namen und deine Schichten (deine Nummer nur, wenn du das erlaubst). Bei Abwesenheiten sehen sie nur „nicht da“ – nie den Grund. Lohn und Stunden sehen nur du und der Chef.</p>' +
      '<p>Du kannst dein Konto jederzeit unter „Ich“ löschen. Dann werden deine Daten gelöscht; vergangene Schichten bleiben ohne Namen als „ehem. Mitarbeiter“ im Plan.</p>' +
      '<p>Keine Werbung, keine Weitergabe, keine fremden Dienste. Mehr in der <a href="../#datenschutz">Datenschutzerklärung</a>.</p></div></details>';
  }

  function viewRegister() {
    var code = codeFromUrl();
    return '<div class="auth"><h1 class="auth__title">Willkommen im Team!</h1>' +
      '<p class="auth__lead">Du wurdest eingeladen. Leg dir hier in einer Minute deinen Zugang an.</p>' +
      '<div id="invite-state" role="status"></div>' +
      '<form class="card" data-form="register" novalidate>' +
      field('Einladungscode', '<input class="input input--code" name="code" value="' + esc(code) + '" required maxlength="20" autocomplete="off" autocapitalize="characters">') +
      field('Dein Vorname', '<input class="input" name="name" autocomplete="given-name" required maxlength="30" autocapitalize="words">', 'So sehen dich die Kollegen im Plan. Gibt es den Namen schon, häng den ersten Buchstaben vom Nachnamen an.') +
      pwField('password', 'Passwort ausdenken', 'new-password', 'Mindestens 8 Zeichen. Am besten etwas, das du dir gut merken kannst.') +
      field('Handynummer <span class="muted">(freiwillig)</span>', '<input class="input" name="phone" type="tel" autocomplete="tel" maxlength="30" inputmode="tel">', 'Nur für den Chef – und für Kollegen nur, wenn du unten den Haken setzt.') +
      '<label class="check"><input type="checkbox" name="phone_visible"><span>Kollegen dürfen meine Nummer sehen (z. B. zum Schicht-Tauschen)</span></label>' +
      privacyNote() +
      '<div class="sheet__foot"><button class="btn btn--primary btn--block btn--big" type="submit">Zugang anlegen</button></div></form>' +
      '<p class="section small muted">Schon einen Zugang? <a href="./">Hier anmelden</a></p></div>';
  }
  async function checkInvite() {
    var box = document.getElementById('invite-state');
    if (!box) return;
    try {
      var r = await API.call('invite_check', { code: codeFromUrl() });
      box.innerHTML = r.valid ? '' : '<div class="notice notice--err">' + ico('warn') + '<span>Diese Einladung ist ungültig, abgelaufen oder wurde schon benutzt. Bitte frag den Chef nach einer neuen.</span></div><div class="gap"></div>';
    } catch (e) { box.innerHTML = '<div class="notice notice--err">' + ico('warn') + '<span>' + esc(errMsg(e)) + '</span></div>'; }
  }

  /* ============================================================ Mitarbeiter: Schicht-Karte */

  function shiftCard(s, opts) {
    opts = opts || {};
    var st = s.status;
    var cls = 'shift shift--' + st + (s.mine ? ' shift--mine' : '');
    var who = s.staff_id ? (s.mine ? 'Du' : esc(s.staff_name)) : (s.former ? 'ehem. Mitarbeiter' : 'Noch niemand');
    var h = '<article class="' + cls + '"><div class="shift__top"><div><div class="shift__when">' + (opts.noDate ? '' : esc(relDay(s.date)) + ' · ') +
      '<span class="shift__time">' + esc(timeRange(s)) + '</span></div>' +
      '<div class="shift__meta">' + (s.label ? '<strong>' + esc(s.label) + '</strong>' : 'Schicht') + (opts.showWho ? ' · <span class="shift__who">' + who + '</span>' : '') + '</div></div>' +
      (s.mine ? pill(st, st === 'none' ? 'Bitte antworten' : null) : !s.staff_id ? (s.requested_by_me ? pill('requested', 'Angefragt – wartet auf den Chef') : pill('open', s.needs_ok ? 'Offen – Chef entscheidet' : null)) : pill(st)) + '</div>';
    if (s.note) h += '<p class="shift__note">' + esc(s.note) + '</p>';
    if (s.mine && s.status === 'no' && s.reason) h += '<p class="shift__note">Dein Grund: ' + esc(s.reason) + '</p>';
    (s.conflicts || []).forEach(function (c) {
      h += '<p class="shift__warn">' + ico('warn') + '<span>' + esc(c.type === 'absence' ? 'Du bist an dem Tag als abwesend eingetragen – bitte mit dem Chef klären.' : c.text) + '</span></p>';
    });
    if (s.swap) h += swapLine(s.swap);
    if (opts.actions !== false && !s.past) h += shiftActions(s);
    if (opts.tasks && s.tasks && s.tasks.total) h += tasksBlock(s);
    return h + '</article>';
  }
  function swapLine(w) {
    var t;
    if (w.mine) {
      t = w.status === 'accepted' ? esc(w.taker_name) + ' übernimmt – wartet auf den Chef.' : 'Du bietest die Schicht ' + (w.to_staff ? esc(w.to_name) : 'allen') + ' zum Tausch an.';
    } else {
      t = w.status === 'accepted' ? (w.taker_id && app.data && w.taker_id === app.data.me.id ? 'Du übernimmst – wartet auf den Chef.' : esc(w.taker_name) + ' übernimmt.') : esc(w.from_name) + ' sucht jemanden für diese Schicht.';
    }
    return '<p class="shift__warn">' + ico('swap') + '<span>' + t + (w.note ? ' „' + esc(w.note) + '“' : '') + '</span></p>';
  }
  function shiftActions(s) {
    var b = [];
    var m = mods();
    if (s.mine) {
      if (s.status === 'none') {
        b.push('<button type="button" class="btn btn--yes" data-act="respond" data-id="' + s.id + '" data-answer="yes">' + ico('check') + 'Zusagen</button>');
        b.push('<button type="button" class="btn btn--no" data-act="respond" data-id="' + s.id + '" data-answer="no">' + ico('x') + 'Absagen</button>');
      } else if (s.status === 'yes') {
        if (m.swap && !s.swap) b.push('<button type="button" class="btn btn--secondary btn--small" data-act="swap-offer" data-id="' + s.id + '">' + ico('swap') + 'Tauschen</button>');
        b.push('<button type="button" class="btn btn--ghost btn--small" data-act="respond" data-id="' + s.id + '" data-answer="no">Doch absagen</button>');
      } else if (s.status === 'no') {
        b.push('<button type="button" class="btn btn--ghost btn--small" data-act="respond" data-id="' + s.id + '" data-answer="yes">Doch zusagen</button>');
      }
      if (s.swap && s.swap.mine) b.push('<button type="button" class="btn btn--ghost btn--small" data-act="swap-cancel" data-id="' + s.swap.id + '">Tausch zurückziehen</button>');
    } else if (!s.staff_id) {
      if (s.requested_by_me) b.push('<button type="button" class="btn btn--ghost btn--small" data-act="take-cancel" data-id="' + s.id + '">Anfrage zurückziehen</button>');
      else b.push('<button type="button" class="btn btn--primary" data-act="take" data-id="' + s.id + '">' + ico('hand') + (s.needs_ok ? 'Ich kann – anfragen' : 'Übernehmen') + '</button>');
    } else if (s.swap && s.swap.for_me && s.swap.status === 'offered') {
      b.push('<button type="button" class="btn btn--primary" data-act="swap-accept" data-id="' + s.swap.id + '">' + ico('hand') + 'Ich übernehme</button>');
    }
    return b.length ? '<div class="shift__actions btn-row">' + b.join('') + '</div>' : '';
  }
  function tasksBlock(s) {
    var running = isRunning(s) || (U.shiftBounds(s.date, s.start, s.end)[0] - nowNaive() < 2 * 3600000 && U.shiftBounds(s.date, s.start, s.end)[1] + 12 * 3600000 > nowNaive());
    var h = '<div class="tasks"><p><strong>Aufgaben</strong> <span class="muted">' + s.tasks.done + ' von ' + s.tasks.total + ' erledigt</span></p>' +
      '<div class="progress" aria-hidden="true"><div class="progress__bar" data-w="' + Math.round(100 * s.tasks.done / s.tasks.total) + '"></div></div>';
    s.tasks.lists.forEach(function (l) {
      h += '<p class="muted small">' + esc(l.name) + '</p><div role="group" aria-label="' + esc(l.name) + '">';
      l.items.forEach(function (it) {
        h += '<button type="button" class="task' + (it.done ? ' task--done' : '') + '" role="checkbox" aria-checked="' + (it.done ? 'true' : 'false') + '"' +
          (running ? '' : ' disabled') + ' data-act="tick" data-shift="' + s.id + '" data-list="' + l.id + '" data-item="' + esc(it.id) + '" data-done="' + (it.done ? '0' : '1') + '">' +
          '<span class="task__box">' + (it.done ? ico('check') : '') + '</span><span><span class="task__text">' + esc(it.text) + '</span>' +
          (it.done && it.by ? '<span class="task__by">erledigt von ' + esc(it.by) + ', ' + esc(stamp(it.at)) + '</span>' : '') + '</span></button>';
      });
      h += '</div>';
    });
    if (!running) h += '<p class="field__hint">Abhaken geht ab 2 Stunden vor Schichtbeginn.</p>';
    return h + '</div>';
  }

  /* ============================================================ Mitarbeiter: Start */

  function viewStart() {
    var d = app.data, m = mods(), me = d.me;
    var mine = d.my_shifts;
    var next = mine.filter(function (s) { return s.status !== 'no'; })[0];
    var h = '<div class="page-head"><h1 class="page-title">Hallo ' + esc(me.name) + '!</h1><p class="page-sub">' + esc(dayLong(d.today)) + '</p></div>';
    h += '<div class="cols cols--2"><div class="stack">';
    if (next) {
      var running = isRunning(next);
      h += '<section class="card card--hero next" aria-labelledby="next-h"><p class="next__label" id="next-h">' + (running ? 'Deine Schicht läuft gerade' : 'Deine nächste Schicht') + '</p>' +
        '<p class="next__day">' + esc(relDay(next.date)) + '</p><p class="next__time">' + esc(next.start + ' – ' + next.end) + ' Uhr</p>' +
        (next.end <= next.start ? '<p class="muted">geht bis ' + esc(DOW[dow(U.addDays(next.date, 1))]) + ' früh</p>' : '') +
        '<div class="next__meta">' + (next.label ? '<span class="badge">' + esc(next.label) + '</span>' : '') + pill(next.status, next.status === 'none' ? 'Bitte antworten' : null) + '</div>' +
        (next.note ? '<p class="shift__note">' + esc(next.note) + '</p>' : '') +
        (next.conflicts || []).map(function (c) { return '<p class="shift__warn">' + ico('warn') + '<span>' + esc(c.text) + '</span></p>'; }).join('') +
        (next.swap ? swapLine(next.swap) : '') + shiftActions(next) +
        (m.tasks && next.tasks && next.tasks.total ? tasksBlock(next) : '') + '</section>';
    } else {
      h += '<section class="card"><p class="card-title">Gerade keine Schicht geplant</p><p class="card-sub">Sobald der Chef dich einteilt, siehst du es hier.</p></section>';
    }
    var pending = mine.filter(function (s) { return s.status === 'none' && s !== next; });
    if (pending.length) {
      h += '<section class="section"><h2 class="section-title">Bitte antworten <span class="count">' + pending.length + '</span></h2><div class="stack">' +
        pending.map(function (s) { return shiftCard(s); }).join('') + '</div></section>';
    }
    var offers = (d.swaps || []).filter(function (w) { return w.for_me && w.status === 'offered'; });
    if (m.swap && offers.length) {
      h += '<section class="section"><h2 class="section-title">' + ico('swap') + 'Kann jemand übernehmen?</h2><div class="stack">' + offers.map(swapOfferCard).join('') + '</div></section>';
    }
    h += '</div><div class="stack">';
    if (d.unread.messages) {
      h += '<a class="listbtn" href="#/nachrichten">' + ico('chat') + '<span class="listbtn__main"><strong>Neue Nachricht vom Chef</strong><span>Zum Lesen tippen</span></span><span class="badge badge--red">' + d.unread.messages + '</span></a>';
    }
    if (m.board) {
      var unreadPosts = d.board.filter(function (b) { return !b.read; });
      unreadPosts.slice(0, 2).forEach(function (b) { h += boardPost(b); });
    }
    if (d.open_shifts.length) {
      h += '<section><h2 class="section-title">' + ico('hand') + 'Offene Schichten – wer kann?</h2><div class="stack">' +
        d.open_shifts.slice(0, 3).map(function (s) { return shiftCard(s); }).join('') +
        (d.open_shifts.length > 3 ? '<a class="btn btn--ghost btn--block" href="#/plan/offen">Alle ' + d.open_shifts.length + ' offenen Schichten</a>' : '') + '</div></section>';
    }
    if (m.orders && d.orders) {
      var low = d.orders.items.filter(function (o) { return o.status === 'low'; }).length;
      h += '<a class="listbtn" href="#/bestellen">' + ico('cart') + '<span class="listbtn__main"><strong>Bestellliste</strong><span>Etwas ist fast leer? Hier melden.</span></span>' +
        (low ? '<span class="badge">' + low + ' fast leer</span>' : '') + ico('right') + '</a>';
    }
    h += '</div></div>';
    return h;
  }
  function swapOfferCard(w) {
    var s = w.shift || {};
    return '<article class="card"><p><strong>' + esc(w.from_name) + '</strong> sucht jemanden' + (w.to_staff ? ' – und fragt dich' : '') + ':</p>' +
      '<p class="shift__when">' + esc(relDay(s.date)) + ' · ' + esc(timeRange(s)) + '</p>' + (s.label ? '<p class="muted">' + esc(s.label) + '</p>' : '') +
      (w.note ? '<p class="shift__note">„' + esc(w.note) + '“</p>' : '') +
      '<div class="shift__actions btn-row"><button type="button" class="btn btn--primary" data-act="swap-accept" data-id="' + w.id + '">' + ico('hand') + 'Ich übernehme</button>' +
      (w.to_staff ? '<button type="button" class="btn btn--ghost" data-act="swap-reject" data-id="' + w.id + '">Nein, leider nicht</button>' : '') + '</div></article>';
  }
  function boardPost(b, chef) {
    return '<article class="card"><p class="post__date">' + ico('pin', 'ico--sm') + ' Schwarzes Brett · ' + esc(stamp(b.created)) + '</p>' +
      (b.title ? '<h3 class="post__title">' + esc(b.title) + '</h3>' : '') + '<p class="post">' + esc(b.body) + '</p>' +
      (chef ? '' : '<div class="shift__actions">' + (b.read ? '<span class="st st--yes">' + ico('check') + 'Gelesen</span>'
        : '<button type="button" class="btn btn--secondary" data-act="board-read" data-id="' + b.id + '">' + ico('check') + 'Gelesen</button>') + '</div>') + '</article>';
  }

  /* ============================================================ Mitarbeiter: Plan */

  function viewPlan(sub) {
    var d = app.data;
    sub = sub || 'meine';
    var nOpen = d.open_shifts.length;
    var h = '<div class="page-head"><h1 class="page-title">Plan</h1></div>' +
      '<nav class="seg" aria-label="Ansicht wählen"><a href="#/plan"' + (sub === 'meine' ? ' aria-current="page"' : '') + '>Meine Schichten</a>' +
      '<a href="#/plan/team"' + (sub === 'team' ? ' aria-current="page"' : '') + '>Team-Woche</a>' +
      '<a href="#/plan/offen"' + (sub === 'offen' ? ' aria-current="page"' : '') + '>Offen' + (nOpen ? ' (' + nOpen + ')' : '') + '</a></nav>';
    if (sub === 'team') return h + teamWeek();
    if (sub === 'offen') {
      return h + '<p class="muted">Wer zuerst „Übernehmen“ tippt, bekommt die Schicht. Bei manchen entscheidet der Chef.</p><div class="gap"></div>' +
        (nOpen ? '<div class="stack">' + d.open_shifts.map(function (s) { return shiftCard(s); }).join('') + '</div>' : '<p class="empty">Gerade sind keine Schichten offen.</p>');
    }
    var mine = d.my_shifts;
    var offers = (d.swaps || []).filter(function (w) { return w.for_me && w.status === 'offered'; });
    h += (mods().swap && offers.length ? '<section><h2 class="section-title">' + ico('swap') + 'Tausch-Angebote</h2><div class="stack">' + offers.map(swapOfferCard).join('') + '</div></section><div class="section"></div>' : '');
    h += mine.length ? '<div class="stack">' + mine.map(function (s) { return shiftCard(s, { tasks: isRunning(s) }); }).join('') + '</div>'
      : '<p class="empty">In den nächsten 8 Wochen hast du keine Schichten.</p>';
    var hist = (d.swaps || []).filter(function (w) { return ['done', 'declined', 'rejected'].indexOf(w.status) >= 0; });
    if (hist.length) {
      h += '<section class="section"><h2 class="section-title">Letzte Tausche</h2><ul class="stack">' + hist.map(function (w) {
        var s = w.shift || {};
        var t = w.status === 'done' ? (w.mine ? esc(w.taker_name) + ' hat deine Schicht übernommen.' : 'Du hast die Schicht von ' + esc(w.from_name) + ' übernommen.')
          : w.status === 'declined' ? 'Der Chef hat den Tausch abgelehnt.' : esc(w.to_name) + ' kann leider nicht.';
        return '<li class="card small">' + esc(dayShort(s.date || '')) + ' ' + esc(s.start || '') + '–' + esc(s.end || '') + ': ' + t + '</li>';
      }).join('') + '</ul></section>';
    }
    return h;
  }

  function weekNav(start, prefix) {
    var end = U.addDays(start, 6);
    return '<div class="weeknav"><button type="button" class="iconbtn" data-act="' + prefix + 'week-prev" aria-label="Woche davor">' + ico('left') + '</button>' +
      '<p class="weeknav__title" aria-live="polite">KW ' + weekNo(start) + ' · ' + esc(dayShort(start)) + ' – ' + esc(dayShort(end)) + '</p>' +
      '<button type="button" class="iconbtn" data-act="' + prefix + 'week-next" aria-label="Woche danach">' + ico('right') + '</button>' +
      (start !== U.mondayOf(today()) ? '<button type="button" class="btn btn--ghost btn--small" data-act="' + prefix + 'week-today">Diese Woche</button>' : '') + '</div>';
  }

  function teamWeek() {
    var d = app.data, start = d.from, h = weekNav(start, '');
    h += '<div class="days">';
    for (var i = 0; i < 7; i++) {
      var day = U.addDays(start, i);
      var list = d.week.filter(function (s) { return s.date === day; });
      var away = d.team_absences.filter(function (a) { return a.from <= day && a.to >= day; }).map(function (a) { return a.name; });
      h += '<section class="day' + (day === d.today ? ' day--today' : '') + '" aria-label="' + esc(dayLong(day)) + '"><div class="day__head"><p class="day__name">' + esc(DOW[dow(day)]) +
        '<small>' + esc(dateDE(day).slice(0, 6)) + (day === d.today ? ' · heute' : '') + '</small></p></div>' +
        (away.length ? '<p class="day__abs">Nicht da: ' + esc(away.join(', ')) + '</p>' : '') +
        '<div class="day__list">' + (list.length ? list.map(function (s) { return shiftCard(s, { noDate: true, showWho: true, actions: !s.staff_id || (s.swap && s.swap.for_me) }); }).join('')
          : '<p class="day__empty">Keine Schichten</p>') + '</div></section>';
    }
    return h + '</div>';
  }

  /* ============================================================ Mitarbeiter: Frei */

  function viewFrei(sub) {
    var m = mods();
    sub = m.availability && sub === 'verfuegbar' ? 'verfuegbar' : 'abwesend';
    var h = '<div class="page-head"><h1 class="page-title">Frei &amp; Verfügbarkeit</h1></div>';
    if (m.availability) {
      h += '<nav class="seg" aria-label="Bereich wählen"><a href="#/frei"' + (sub === 'abwesend' ? ' aria-current="page"' : '') + '>Urlaub &amp; Abwesenheit</a>' +
        '<a href="#/frei/verfuegbar"' + (sub === 'verfuegbar' ? ' aria-current="page"' : '') + '>Wann kann ich?</a></nav>';
    }
    return h + (sub === 'verfuegbar' ? availView() : absenceView());
  }

  function absenceView() {
    var d = app.data, t = d.today;
    var h = '<div class="cols cols--2"><form class="card" data-form="absence" novalidate><h2 class="section-title">Frei beantragen</h2>' +
      '<fieldset class="field"><legend class="field__label">Was ist es?</legend><div class="choices">' +
      ['urlaub', 'krank', 'sonstiges'].map(function (k, i) {
        return '<label class="choice"><input type="radio" name="type" value="' + k + '"' + (i === 0 ? ' checked' : '') + '><span>' + esc(ABS[k].charAt(0).toUpperCase() + ABS[k].slice(1)) + '</span></label>';
      }).join('') + '</div></fieldset>' +
      '<div class="row2 row2--date">' + field('Von', '<input class="input" type="date" name="from" required min="' + U.addDays(t, -30) + '" value="' + t + '">') +
      field('Bis', '<input class="input" type="date" name="to" required min="' + U.addDays(t, -30) + '" value="' + t + '">') + '</div>' +
      field('Notiz <span class="muted">(freiwillig)</span>', '<textarea class="input" name="note" maxlength="300" placeholder="z. B. Familienfeier"></textarea>', 'Bei „krank“ bitte keine Krankheit eintragen – und trotzdem kurz im Stüble anrufen.') +
      '<div class="sheet__foot"><button type="submit" class="btn btn--primary btn--block">' + ico('send') + 'An den Chef schicken</button></div></form>';
    h += '<section><h2 class="section-title">Deine Anträge</h2>' + (d.absences.length ? '<div class="stack">' + d.absences.map(function (a) {
      var canCancel = a.status === 'pending' || (a.status === 'approved' && a.from > t) || a.status === 'declined';
      return '<article class="card"><div class="shift__top"><p class="shift__when">' + esc(ABS[a.type] ? ABS[a.type].charAt(0).toUpperCase() + ABS[a.type].slice(1) : a.type) + '</p>' + absPill(a) + '</div>' +
        '<p>' + esc(a.from === a.to ? dayLong(a.from) : dayShort(a.from) + ' bis ' + dayShort(a.to)) + '</p>' +
        (a.note ? '<p class="shift__note">' + esc(a.note) + '</p>' : '') + (a.chef_comment ? '<p class="shift__note"><strong>Chef:</strong> ' + esc(a.chef_comment) + '</p>' : '') +
        (canCancel ? '<div class="shift__actions"><button type="button" class="btn btn--ghost btn--small" data-act="abs-cancel" data-id="' + a.id + '">' + (a.status === 'pending' ? 'Antrag zurückziehen' : 'Eintrag entfernen') + '</button></div>' : '') + '</article>';
    }).join('') + '</div>' : '<p class="empty">Noch keine Anträge.</p>') + '</section></div>';
    return h;
  }

  var AV = { yes: ['kann', '✓'], maybe: ['vielleicht', '?'], no: ['kann nicht', '✗'], '': ['leer', '–'] };
  function availView() {
    var d = app.data, t = d.today, start = U.mondayOf(t);
    var h = '<p>Tippe erst oben, was du eintragen willst – dann auf die Tage. Das wird sofort gespeichert. Der Chef sieht das beim Einteilen.</p><div class="gap"></div>' +
      '<div class="avail-tools" role="group" aria-label="Was eintragen?">' + ['yes', 'maybe', 'no', ''].map(function (k) {
        return '<button type="button" data-act="avail-tool" data-v="' + k + '" aria-pressed="' + (app.availTool === k ? 'true' : 'false') + '"><span aria-hidden="true">' + AV[k][1] + '</span>' + AV[k][0] + '</button>';
      }).join('') + '</div><div class="agrid" role="grid" aria-label="Die nächsten 8 Wochen">' +
      ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(function (x) { return '<div class="agrid__dow" aria-hidden="true">' + x + '</div>'; }).join('');
    for (var i = 0; i < 56; i++) {
      var day = U.addDays(start, i), v = d.availability[day] || '';
      var past = day < t;
      h += '<button type="button" class="acell' + (v ? ' acell--' + v : '') + (day === t ? ' acell--today' : '') + '" data-act="avail-day" data-date="' + day + '"' + (past ? ' disabled' : '') +
        ' aria-label="' + esc(dayLong(day)) + ': ' + esc(AV[v][0]) + '"><span class="acell__d">' + (+day.slice(8)) + (day.slice(8) === '01' || i === 0 ? '.' + (+day.slice(5, 7)) + '.' : '') + '</span>' +
        '<span class="acell__v">' + (v ? AV[v][1] : '') + '</span></button>';
    }
    return h + '</div><p class="field__hint">✓ kann · ? vielleicht · ✗ kann nicht. Leere Tage heißen: nichts eingetragen.</p>';
  }

  /* ============================================================ Mitarbeiter: Nachrichten */

  function viewMessages(sub) {
    var d = app.data, m = mods();
    sub = m.board && sub === 'brett' ? 'brett' : 'chef';
    var unreadB = d.unread.board;
    var h = '<div class="page-head"><h1 class="page-title">Nachrichten</h1></div>';
    if (m.board) {
      h += '<nav class="seg" aria-label="Bereich wählen"><a href="#/nachrichten"' + (sub === 'chef' ? ' aria-current="page"' : '') + '>Mit dem Chef</a>' +
        '<a href="#/nachrichten/brett"' + (sub === 'brett' ? ' aria-current="page"' : '') + '>Schwarzes Brett' + (unreadB ? ' (' + unreadB + ' neu)' : '') + '</a></nav>';
    }
    if (sub === 'brett') {
      return h + (d.board.length ? '<div class="stack">' + d.board.map(function (b) { return boardPost(b); }).join('') + '</div>' : '<p class="empty">Noch nichts am Schwarzen Brett.</p>');
    }
    return h + threadHtml(d.messages, false) + composer('msg', 'Nachricht an den Chef');
  }
  function threadHtml(msgs, chef) {
    if (!msgs.length) return '<p class="empty">Noch keine Nachrichten. Schreib einfach unten los.</p>';
    return '<div class="thread" aria-label="Nachrichtenverlauf">' + msgs.map(function (m) {
      var mineMsg = chef ? m.from_chef : !m.from_chef;
      return '<div class="bubble ' + (mineMsg ? 'bubble--me' : 'bubble--other') + '"><span class="sr-only">' + (mineMsg ? 'Du' : (chef ? 'Mitarbeiter' : 'Chef')) + ': </span>' + esc(m.body) +
        '<span class="bubble__meta">' + esc(stamp(m.created)) + (mineMsg && m.read ? ' · gelesen' : '') + '</span></div>';
    }).join('') + '</div>';
  }
  function composer(form, label, extra) {
    return '<form class="composer" data-form="' + form + '"' + (extra || '') + ' novalidate><label class="field"><span class="field__label">' + esc(label) + '</span>' +
      '<textarea class="input" name="body" maxlength="1000" required placeholder="Text eingeben …"></textarea></label>' +
      '<div class="sheet__foot"><button type="submit" class="btn btn--primary btn--block">' + ico('send') + 'Senden</button></div></form>';
  }

  /* ============================================================ Mitarbeiter: Ich */

  function viewMe() {
    var d = app.data, me = d.me, m = mods();
    var h = '<div class="page-head"><h1 class="page-title">' + esc(me.name) + '</h1><p class="page-sub">Dein Profil und deine Einstellungen</p></div><div class="cols cols--2"><div class="stack">';
    if (m.hours && d.hours) {
      h += '<section class="card"><h2 class="section-title">' + ico('clock') + 'Meine Stunden</h2><p class="notice small">' + ico('info') + '<span>Geplant aus deinen zugesagten Schichten – <strong>keine Lohnabrechnung</strong>.</span></p>' +
        d.hours.map(function (x) { return hoursBlock(x); }).join('') + '</section>';
    }
    if (m.ical) h += icalCard(me);
    h += '<form class="card" data-form="profile" novalidate><h2 class="section-title">' + ico('phone') + 'Telefonnummer</h2>' +
      field('Handynummer <span class="muted">(freiwillig)</span>', '<input class="input" name="phone" type="tel" autocomplete="tel" maxlength="30" value="' + esc(me.phone || '') + '">') +
      '<label class="check"><input type="checkbox" name="phone_visible"' + (me.phone_visible ? ' checked' : '') + '><span>Kollegen dürfen meine Nummer sehen</span></label>' +
      '<button type="submit" class="btn btn--secondary btn--block">Speichern</button></form>';
    h += '</div><div class="stack">';
    var col = d.colleagues.filter(function (c) { return !c.me; });
    h += '<section class="card"><h2 class="section-title">' + ico('team') + 'Das Team</h2><ul class="stack">' + col.map(function (c) {
      return '<li class="person"><span class="avatar" aria-hidden="true">' + initial(c.name) + '</span><span class="person__main"><span class="person__name">' + esc(c.name) + '</span>' +
        (c.phone ? '<br><a href="tel:' + esc(c.phone.replace(/[^0-9+]/g, '')) + '">' + esc(c.phone) + '</a>' : '') + '</span></li>';
    }).join('') + '</ul></section>';
    h += '<form class="card" data-form="password" novalidate><h2 class="section-title">' + ico('key') + 'Passwort ändern</h2>' +
      pwField('old', 'Bisheriges Passwort', 'current-password') + pwField('new', 'Neues Passwort', 'new-password', 'Mindestens 8 Zeichen.') +
      '<div class="sheet__foot"><button type="submit" class="btn btn--secondary btn--block">Passwort ändern</button></div></form>';
    h += '<section class="card">' + privacyNote() + '<div class="sheet__foot btn-row"><button type="button" class="btn btn--ghost" data-act="logout">' + ico('out') + 'Abmelden</button>' +
      '<button type="button" class="btn btn--danger" data-act="delete-account">' + ico('trash') + 'Konto löschen</button></div></section>';
    return h + '</div></div>';
  }
  function hoursBlock(x) {
    var pct = x.earnings !== null && x.limit ? Math.round(100 * x.earnings / x.limit) : 0;
    return '<div class="section"><p><strong>' + esc(monthName(x.month)) + '</strong></p><p class="hours-big">' + esc(fmtHours(x.minutes)) + '</p>' +
      '<p class="muted">' + x.shifts + ' zugesagte Schicht' + (x.shifts === 1 ? '' : 'en') + (x.minutes_unanswered ? ' · noch offen: ' + esc(fmtHours(x.minutes_unanswered)) : '') + '</p>' +
      (x.wage !== null ? '<p>ca. <strong>' + esc(money(x.earnings)) + '</strong> bei ' + esc(money(x.wage)) + ' pro Stunde</p>' +
        '<div class="progress" aria-hidden="true"><div class="progress__bar' + (x.over ? ' progress__bar--over' : '') + '" data-w="' + pct + '"></div></div>' +
        '<p class="small muted">Monatsgrenze: ' + esc(money(x.limit)) + '</p>' +
        (x.over ? '<p class="notice notice--warn">' + ico('warn') + '<span>Über deiner Monatsgrenze – sprich bitte mit dem Chef.</span></p>' : '') : '<p class="small muted">Stundenlohn ist nicht hinterlegt.</p>') + '</div>';
  }
  function icalCard(me) {
    var url = me.ical_url;
    var h = '<section class="card"><h2 class="section-title">' + ico('cal') + 'Schichten im Handy-Kalender</h2>';
    if (!url) {
      return h + '<p class="muted">Im Demo-Modus gibt es keinen echten Kalender-Link. Im echten Betrieb steht hier dein persönlicher Link.</p></section>';
    }
    var webcal = url.replace(/^https?:/, 'webcal:');
    return h + '<p>Deine Schichten erscheinen automatisch in deinem Kalender – mit Erinnerung 2 Stunden vorher.</p><div class="gap"></div>' +
      '<a class="btn btn--primary btn--block btn--big" href="' + esc(webcal) + '">' + ico('cal') + 'In meinen Handy-Kalender übernehmen</a>' +
      '<div class="sheet__foot"><button type="button" class="btn btn--secondary btn--block" data-act="ical-copy">' + ico('copy') + 'Link kopieren</button></div>' +
      '<div class="sheet__foot"><details class="help"><summary>So geht’s am iPhone</summary><ol><li>Oben auf „In meinen Handy-Kalender übernehmen“ tippen.</li><li>„Abonnieren“ tippen.</li><li>„Hinzufügen“ bzw. „Fertig“ tippen – fertig.</li></ol></details>' +
      '<details class="help"><summary>So geht’s mit Android / Google</summary><ol><li>„Link kopieren“ tippen.</li><li>Am Computer oder im Handy-Browser calendar.google.com öffnen.</li><li>Links bei „Weitere Kalender“ auf „+“ → „Per URL“.</li><li>Link einfügen → „Kalender hinzufügen“. Nach ein paar Minuten erscheint er in der Kalender-App.</li></ol></details></div>' +
      '<p class="field__hint">Der Link ist geheim wie ein Schlüssel – nicht weitergeben. Falls doch: </p>' +
      '<button type="button" class="linkbtn" data-act="ical-reset">Neuen Link erzeugen (alter geht dann nicht mehr)</button></section>';
  }

  /* ============================================================ Bestellliste (beide) */

  function viewOrders(chef) {
    var o = chef ? app.chef.orders : app.data.orders;
    if (!o) return '<p class="empty">Die Bestellliste ist ausgeschaltet.</p>';
    var openIds = {};
    o.items.forEach(function (i) { if (i.catalog_id && i.status !== 'delivered') openIds[i.catalog_id] = i.status; });
    var h = chef ? '' : '<div class="page-head"><h1 class="page-title">Bestellliste</h1><p class="page-sub">Was geht zur Neige? Ein Tipp genügt.</p></div>';
    h += '<div class="cols cols--2"><div class="stack"><section class="card"><h2 class="section-title">Schnell melden: fast leer</h2>';
    if (o.catalog.length) {
      var byCat = {};
      o.catalog.forEach(function (c) { (byCat[c.category] = byCat[c.category] || []).push(c); });
      Object.keys(CATS).forEach(function (k) {
        if (!byCat[k]) return;
        h += '<div class="catgroup"><p class="catgroup__title">' + esc(CATS[k]) + '</p><div class="quick">' + byCat[k].map(function (c) {
          var st = openIds[c.id];
          return '<button type="button" data-act="order-quick" data-cat="' + c.id + '"' + (st ? ' class="is-on" aria-describedby="q-on-' + c.id + '"' : '') + '>' + esc(c.name) +
            '<small' + (st ? ' id="q-on-' + c.id + '"' : '') + '>' + (st ? (st === 'ordered' ? 'schon bestellt' : 'steht schon drauf') : esc(c.qty || 'antippen')) + '</small></button>';
        }).join('') + '</div></div>';
      });
    } else {
      h += '<p class="muted">Der Chef hat noch keine Artikel zum Antippen angelegt.</p>';
    }
    h += '</section><form class="card" data-form="order-add" novalidate><h2 class="section-title">Etwas anderes</h2>' +
      field('Was fehlt?', '<input class="input" name="name" required maxlength="80" placeholder="z. B. Strohhalme">') +
      '<div class="row2">' + field('Menge <span class="muted">(freiwillig)</span>', '<input class="input" name="qty" maxlength="40" placeholder="z. B. 2 Kisten">') +
      field('Art', '<select class="input" name="category">' + Object.keys(CATS).map(function (k) { return '<option value="' + k + '">' + esc(CATS[k]) + '</option>'; }).join('') + '</select>') + '</div>' +
      field('Notiz <span class="muted">(freiwillig)</span>', '<input class="input" name="note" maxlength="200">') +
      '<div class="sheet__foot"><button type="submit" class="btn btn--primary btn--block">' + ico('plus') + 'Auf die Liste</button></div></form></div><div class="stack">';
    var groups = [['low', 'Fast leer'], ['ordered', 'Bestellt'], ['delivered', 'Geliefert (letzte 7 Tage)']];
    groups.forEach(function (g) {
      var list = o.items.filter(function (i) { return i.status === g[0]; });
      h += '<section><h2 class="section-title">' + esc(g[1]) + (list.length ? ' <span class="count">' + list.length + '</span>' : '') + '</h2>' +
        (list.length ? '<ul class="stack">' + list.map(function (i) { return orderRow(i, chef); }).join('') + '</ul>' : '<p class="empty">Nichts.</p>') + '</section>';
    });
    return h + '</div></div>';
  }
  function orderRow(i, chef) {
    var b = '';
    if (chef) {
      if (i.status === 'low') b += '<button type="button" class="btn btn--secondary btn--small" data-act="c-order-status" data-id="' + i.id + '" data-s="ordered">Bestellt</button>';
      if (i.status !== 'delivered') b += '<button type="button" class="btn btn--yes btn--small" data-act="c-order-status" data-id="' + i.id + '" data-s="delivered">' + ico('check') + 'Geliefert</button>';
      if (i.status === 'delivered') b += '<button type="button" class="btn btn--ghost btn--small" data-act="c-order-status" data-id="' + i.id + '" data-s="low">Wieder fast leer</button>';
      b += '<button type="button" class="btn btn--ghost btn--small" data-act="c-order-delete" data-id="' + i.id + '" aria-label="' + esc(i.name) + ' löschen">' + ico('trash') + '</button>';
    } else if (i.mine && i.status === 'low') {
      b += '<button type="button" class="btn btn--ghost btn--small" data-act="order-remove" data-id="' + i.id + '">Entfernen</button>';
    }
    return '<li class="card order"><div class="order__main"><p class="order__name">' + esc(i.name) + (i.qty ? ' – ' + esc(i.qty) : '') + '</p>' +
      '<p class="order__meta">' + esc(CATS[i.category] || '') + ' · von ' + esc(i.by) + ' · ' + esc(stamp(i.updated)) + '</p>' + (i.note ? '<p class="shift__note">' + esc(i.note) + '</p>' : '') + '</div>' +
      (b ? '<div class="btn-row btn-row--tight">' + b + '</div>' : '') + '</li>';
  }

  /* ============================================================ Chef: Plan */

  function chefShiftCard(s) {
    var who = s.staff_id ? esc(s.staff_name) : (s.former ? 'ehem. Mitarbeiter' : '<strong>OFFEN</strong>');
    var warn = (s.conflicts || []).filter(function (c) { return c.type !== 'maybe'; });
    var extra = '';
    if (s.status === 'no' && s.reason) extra += '<p class="shift__note">Grund: ' + esc(s.reason) + '</p>';
    if (s.requests && s.requests.length) extra += '<p class="shift__note">Anfrage: ' + esc(s.requests.map(function (r) { return r.name; }).join(', ')) + '</p>';
    if (s.swap) extra += '<p class="shift__note">' + ico('swap', 'ico--sm') + ' Tausch: ' + (s.swap.status === 'accepted' ? esc(s.swap.taker_name) + ' will übernehmen' : 'angeboten') + '</p>';
    if (s.tasks && s.tasks.total && (s.past || isRunning(s))) extra += '<p class="shift__note">Aufgaben: ' + s.tasks.done + '/' + s.tasks.total + '</p>';
    return '<button type="button" class="shift shift--' + s.status + '" data-act="c-shift-edit" data-id="' + s.id + '" aria-label="Schicht ' + esc(dayShort(s.date) + ' ' + s.start + ' bis ' + s.end + ', ' + (s.label || '') + ', ' + (s.staff_name || 'offen') + ', ' + (ST_TEXT[s.status] || '')) + ' – bearbeiten">' +
      '<span class="shift__when"><span class="shift__time">' + esc(s.start + '–' + s.end) + '</span></span>' +
      '<span class="shift__meta">' + (s.label ? esc(s.label) + ' · ' : '') + '<span class="shift__who">' + who + '</span></span>' +
      '<span class="shift__meta">' + pill(s.status, s.status === 'none' ? 'unbeantwortet' : null) + '</span>' + extra +
      (warn.length ? '<span class="shift__warn">' + ico('warn') + '<span>' + esc(warn.map(function (c) { return c.text; }).join(' · ')) + '</span></span>' : '') + '</button>';
  }

  function viewChefPlan() {
    var c = app.chef;
    var h = '<div class="page-head"><h1 class="page-title">Dienstplan</h1><p class="page-sub">Tippe auf eine Schicht zum Bearbeiten.</p></div>' +
      '<div class="btn-row"><button type="button" class="btn btn--primary" data-act="c-shift-new">' + ico('plus') + 'Schicht anlegen</button>' +
      '<div class="seg" role="group" aria-label="Ansicht"><button type="button" data-act="c-mode" data-m="week" aria-pressed="' + (app.chefMode === 'week') + '">Woche</button>' +
      '<button type="button" data-act="c-mode" data-m="month" aria-pressed="' + (app.chefMode === 'month') + '">Monat</button></div></div>' +
      '<div class="legend" aria-label="Farben">' + pill('yes') + pill('none', 'unbeantwortet') + pill('no') + pill('open', 'Offen') + pill('requested') + '</div>';
    if (app.chefMode === 'month') return h + chefMonth();
    h += weekNav(c.from, 'c-') + '<div class="days days--grid">';
    for (var i = 0; i < 7; i++) {
      var day = U.addDays(c.from, i);
      var list = c.shifts.filter(function (s) { return s.date === day; });
      var abs = c.absences.filter(function (a) { return a.from <= day && a.to >= day && (a.status === 'approved' || a.status === 'pending'); });
      h += '<section class="day' + (day === c.today ? ' day--today' : '') + '" aria-label="' + esc(dayLong(day)) + '"><div class="day__head"><p class="day__name">' + esc(DOW_S[dow(day)]) + ' ' + esc(dateDE(day).slice(0, 6)) +
        (day === c.today ? '<small>heute</small>' : '') + '</p><button type="button" class="btn btn--ghost btn--tiny" data-act="c-shift-new" data-date="' + day + '" aria-label="Schicht am ' + esc(dayLong(day)) + ' anlegen">' + ico('plus') + '</button></div>' +
        abs.map(function (a) { return '<p class="day__abs">' + esc(a.name) + ': ' + esc(ABS[a.type] || 'frei') + (a.status === 'pending' ? ' (beantragt)' : '') + '</p>'; }).join('') +
        '<div class="day__list">' + (list.length ? list.map(chefShiftCard).join('') : '<p class="day__empty">Keine Schicht</p>') + '</div></section>';
    }
    return h + '</div>';
  }

  function chefMonth() {
    var c = app.chef, m = app.chefMonth || c.today.slice(0, 7);
    var h = '<div class="weeknav"><button type="button" class="iconbtn" data-act="c-month-prev" aria-label="Monat davor">' + ico('left') + '</button>' +
      '<p class="weeknav__title" aria-live="polite">' + esc(monthName(m)) + '</p><button type="button" class="iconbtn" data-act="c-month-next" aria-label="Monat danach">' + ico('right') + '</button></div>' +
      '<div class="month">' + ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(function (x) { return '<div class="month__dow" aria-hidden="true">' + x + '</div>'; }).join('');
    for (var i = 0; i < 42; i++) {
      var day = U.addDays(c.from, i);
      if (i >= 35 && day.slice(0, 7) !== m) break;
      var list = c.shifts.filter(function (s) { return s.date === day; });
      var open = list.filter(function (s) { return s.status === 'open' || s.status === 'requested'; }).length;
      var no = list.filter(function (s) { return s.status === 'no'; }).length;
      var unans = list.filter(function (s) { return s.status === 'none'; }).length;
      var conf = list.filter(function (s) { return (s.conflicts || []).some(function (x) { return x.type !== 'maybe'; }); }).length;
      var parts = [];
      if (list.length) parts.push(list.length + '<span class="lng"> Schicht' + (list.length === 1 ? '' : 'en') + '</span>');
      var info = (list.length ? list.length + ' Schichten' : 'keine Schichten') + (open ? ', ' + open + ' offen' : '') + (no ? ', ' + no + ' abgesagt' : '') + (unans ? ', ' + unans + ' unbeantwortet' : '') + (conf ? ', ' + conf + ' mit Konflikt' : '');
      h += '<button type="button" class="mday' + (day.slice(0, 7) !== m ? ' mday--out' : '') + (day === c.today ? ' mday--today' : '') + '" data-act="c-mday" data-date="' + day + '" aria-label="' + esc(dayLong(day)) + ': ' + esc(info) + '">' +
        '<span class="mday__n">' + (+day.slice(8)) + '</span><span class="mday__info" aria-hidden="true">' + parts.join('') +
        (open ? '<br><b>' + open + ' offen</b>' : '') + (no ? '<br><i>' + no + ' abgesagt</i>' : '') + (conf ? '<br>⚠ ' + conf : '') + '</span></button>';
    }
    return h + '</div><p class="field__hint">Tippe auf einen Tag, um die Woche zu öffnen.</p>';
  }

  /* --------------------------------------------- Schicht-Editor (Chef) */

  var editorCtx = null;
  function shiftEditor(s, date) {
    var c = app.chef, isNew = !s;
    s = s || { date: date || c.today, start: '17:00', end: '22:00', label: (c.settings.labels[0] || ''), note: '', staff_id: null, needs_ok: c.settings.take_needs_ok, status: 'open' };
    var labels = c.settings.labels.slice();
    if (s.label && labels.indexOf(s.label) < 0) labels.push(s.label);
    var body = '<form data-form="c-shift" novalidate>' + (isNew ? '' : '<input type="hidden" name="id" value="' + s.id + '">');
    if (!isNew) {
      body += '<div class="notice">' + ico('info') + '<div>' + pill(s.status, s.status === 'none' ? 'unbeantwortet' : null) +
        (s.status === 'no' && s.reason ? '<p>Grund: ' + esc(s.reason) + '</p>' : '') + (s.responded_at ? '<p class="small muted">Antwort: ' + esc(stamp(s.responded_at)) + '</p>' : '') + '</div></div>';
      (s.requests || []).forEach(function (r) {
        body += '<div class="notice notice--warn">' + ico('hand') + '<div><p><strong>' + esc(r.name) + '</strong> möchte die Schicht übernehmen.</p><div class="btn-row sheet__foot">' +
          '<button type="button" class="btn btn--yes btn--small" data-act="c-take" data-shift="' + s.id + '" data-staff="' + r.staff_id + '" data-ok="1">Ja, ' + esc(r.name) + ' bekommt sie</button>' +
          '<button type="button" class="btn btn--ghost btn--small" data-act="c-take" data-shift="' + s.id + '" data-staff="' + r.staff_id + '" data-ok="0">Nein</button></div></div></div>';
      });
      if (s.swap && s.swap.status === 'accepted') {
        body += '<div class="notice notice--warn">' + ico('swap') + '<div><p>' + esc(s.swap.from_name) + ' → ' + esc(s.swap.taker_name) + ': Tausch wartet auf dich.</p><div class="btn-row sheet__foot">' +
          '<button type="button" class="btn btn--yes btn--small" data-act="c-swap" data-id="' + s.swap.id + '" data-ok="1">Tausch bestätigen</button>' +
          '<button type="button" class="btn btn--ghost btn--small" data-act="c-swap" data-id="' + s.swap.id + '" data-ok="0">Ablehnen</button></div></div></div>';
      }
      if (s.tasks && s.tasks.total) {
        body += '<details class="help"><summary>Aufgaben: ' + s.tasks.done + ' von ' + s.tasks.total + ' erledigt</summary><ul class="small">' +
          s.tasks.lists.map(function (l) { return l.items.map(function (it) { return '<li>' + (it.done ? '✓ ' : '○ ') + esc(it.text) + (it.done ? ' <span class="muted">(' + esc(it.by || '') + ', ' + esc(stamp(it.at)) + ')</span>' : '') + '</li>'; }).join(''); }).join('') + '</ul></details>';
      }
    }
    body += '<div class="row2 row2--date">' + field('Datum', '<input class="input" type="date" name="date" required value="' + esc(s.date) + '">') +
      field('Bezeichnung', '<select class="input" name="label">' + labels.map(function (l) { return '<option' + (l === s.label ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join('') +
        '<option value=""' + (s.label === '' ? ' selected' : '') + '>(ohne)</option></select>') + '</div>' +
      '<div class="row2">' + field('Beginn', '<input class="input" type="time" name="start" required value="' + esc(s.start) + '" step="300">') +
      field('Ende', '<input class="input" type="time" name="end" required value="' + esc(s.end) + '" step="300">') + '</div>' +
      '<p class="field__hint" id="overnight-hint" aria-live="polite"></p>' +
      field('Wer?', '<select class="input" name="staff_id" id="staff-select"><option value="0">Offen lassen – wer kann, übernimmt</option></select>', 'Hinter dem Namen steht, ob die Person kann.') +
      '<div id="shift-warn" aria-live="polite"></div>' +
      '<label class="check"><input type="checkbox" name="confirmed"' + (s.status === 'yes' ? ' checked' : '') + '><span>Ist schon abgesprochen (gilt als zugesagt)</span></label>' +
      '<label class="check"><input type="checkbox" name="needs_ok"' + (s.needs_ok ? ' checked' : '') + '><span>Wenn offen: nur nach meiner Bestätigung vergeben</span></label>' +
      field('Notiz <span class="muted">(freiwillig)</span>', '<textarea class="input" name="note" maxlength="300">' + esc(s.note) + '</textarea>') +
      (isNew ? '<details class="help"><summary>Wiederholen (z. B. jeden Freitag)</summary>' + field('Jede Woche am gleichen Tag bis', '<input class="input" type="date" name="repeat_until">', 'Leer lassen = nur einmal.') + '<div class="gap"></div></details>' : '') +
      '<div class="sheet__foot btn-row"><button type="submit" class="btn btn--primary">' + ico('check') + 'Speichern</button>' +
      (isNew ? '' : '<button type="button" class="btn btn--danger" data-act="c-shift-delete" data-id="' + s.id + '" data-series="' + (s.series_id ? '1' : '') + '">' + ico('trash') + 'Löschen</button>') + '</div></form>';
    var el = openSheet(isNew ? 'Neue Schicht' : 'Schicht bearbeiten', body);
    editorCtx = { el: el, shift: isNew ? null : s, staffId: s.staff_id || 0, day: null };
    var form = el.querySelector('form');
    form.addEventListener('input', function (e) { if (e.target.name === 'date') loadEditorDay(); else updateEditor(); });
    form.addEventListener('change', function (e) { if (e.target.name === 'date') loadEditorDay(); else updateEditor(); });
    loadEditorDay();
  }
  var editorTimer = null;
  function loadEditorDay() {
    clearTimeout(editorTimer);
    editorTimer = setTimeout(async function () {
      if (!editorCtx) return;
      var date = editorCtx.el.querySelector('[name=date]').value;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
      try {
        editorCtx.day = await API.call('chef_data', { from: U.addDays(date, -1), to: U.addDays(date, 1) });
      } catch (e) { editorCtx.day = null; }
      fillStaffSelect();
      updateEditor();
    }, 200);
  }
  function staffInfo(st, date, start, end, exceptId) {
    var d = editorCtx.day, notes = [], bad = false;
    if (!d) return { text: '', bad: false, warn: [] };
    var warn = [];
    d.absences.forEach(function (a) {
      if (a.staff_id !== st.id || a.from > date || a.to < date) return;
      if (a.status === 'approved') { notes.push((ABS[a.type] || 'frei') + '!'); warn.push(st.name + ' ist an dem Tag ' + (ABS[a.type] || 'abwesend') + ' (genehmigt).'); bad = true; }
      else if (a.status === 'pending') { notes.push('hat frei beantragt'); warn.push(st.name + ' hat für den Tag frei beantragt.'); }
    });
    var av = d.availability && d.availability[st.id] && d.availability[st.id][date];
    if (av === 'yes') notes.push('kann');
    else if (av === 'maybe') { notes.push('vielleicht'); }
    else if (av === 'no') { notes.push('kann nicht'); warn.push(st.name + ' hat „kann nicht“ eingetragen.'); bad = true; }
    if (start && end && start !== end) {
      var b1 = U.shiftBounds(date, start, end);
      d.shifts.forEach(function (o) {
        if (o.staff_id !== st.id || o.id === exceptId || o.status === 'no') return;
        var b2 = U.shiftBounds(o.date, o.start, o.end);
        if (b1[0] < b2[1] && b2[0] < b1[1]) { notes.push('hat schon ' + o.start + '–' + o.end); warn.push('Überschneidung: ' + st.name + ' arbeitet schon ' + dayShort(o.date) + ' ' + o.start + '–' + o.end + '.'); bad = true; }
        else if (o.date === date) notes.push('hat auch ' + o.start + '–' + o.end);
      });
    }
    if (!st.active) { notes.push('deaktiviert'); bad = true; }
    return { text: notes.join(', '), bad: bad, warn: warn };
  }
  function fillStaffSelect() {
    if (!editorCtx) return;
    var sel = editorCtx.el.querySelector('#staff-select');
    var cur = +sel.value || editorCtx.staffId || 0;
    var f = editorCtx.el.querySelector('form');
    var date = f.date.value, start = f.start.value, end = f.end.value;
    var exceptId = editorCtx.shift ? editorCtx.shift.id : 0;
    var opts = '<option value="0">Offen lassen – wer kann, übernimmt</option>';
    app.chef.staff.forEach(function (st) {
      if (!st.active && st.id !== cur) return;
      var info = staffInfo(st, date, start, end, exceptId);
      opts += '<option value="' + st.id + '"' + (st.id === cur ? ' selected' : '') + '>' + esc(st.name + (info.text ? ' – ' + info.text : '')) + '</option>';
    });
    sel.innerHTML = opts;
  }
  function updateEditor() {
    if (!editorCtx) return;
    var f = editorCtx.el.querySelector('form');
    var start = f.start.value, end = f.end.value;
    editorCtx.staffId = +f.staff_id.value || 0;
    document.getElementById('overnight-hint').textContent = start && end && end <= start && start !== end ? 'Endet am nächsten Tag (' + DOW[dow(U.addDays(f.date.value || today(), 1))] + ') um ' + end + ' Uhr.' : '';
    fillStaffSelect();
    var box = document.getElementById('shift-warn');
    var st = app.chef.staff.filter(function (x) { return x.id === editorCtx.staffId; })[0];
    var w = st ? staffInfo(st, f.date.value, start, end, editorCtx.shift ? editorCtx.shift.id : 0).warn : [];
    box.innerHTML = w.length ? '<div class="notice notice--warn">' + ico('warn') + '<div><strong>Achtung:</strong><ul>' + w.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul><p class="small">Du kannst trotzdem speichern.</p></div></div>' : '';
  }

  /* ============================================================ Chef: Team */

  function inviteLink(code) { return new URL('./', location.href).href.split('#')[0].replace(/\?.*$/, '') + '?code=' + encodeURIComponent(code); }

  function viewChefTeam() {
    var c = app.chef, m = chefMods();
    var h = '<div class="page-head"><h1 class="page-title">Team</h1><p class="page-sub">' + c.staff.length + ' Personen im Team</p></div><div class="cols cols--2"><div class="stack">';
    h += '<section><h2 class="section-title">Mitarbeiter</h2>' + (c.staff.length ? '<ul class="stack">' + c.staff.map(function (s) {
      var hr = s.hours;
      return '<li class="card"><div class="person"><span class="avatar" aria-hidden="true">' + initial(s.name) + '</span><div class="person__main"><p class="person__name">' + esc(s.name) +
        (s.active ? '' : ' <span class="badge">deaktiviert</span>') + (hr && hr.over ? ' <span class="badge badge--warn">' + ico('warn', 'ico--sm') + 'über Minijob-Grenze</span>' : '') + '</p>' +
        (s.phone ? '<p><a href="tel:' + esc(s.phone.replace(/[^0-9+]/g, '')) + '">' + esc(s.phone) + '</a>' + (s.phone_visible ? '' : ' <span class="muted small">(nur für dich)</span>') + '</p>' : '') +
        (m.hours ? '<p class="muted small">Diesen Monat: ' + esc(fmtHours(hr ? hr.minutes : 0)) + (s.wage !== null ? ' · ca. ' + esc(money(hr ? hr.earnings : 0)) + ' · ' + esc(money(s.wage)) + '/Std.' : ' · kein Stundenlohn') + '</p>' : '') +
        '<p class="muted small">Zuletzt angemeldet: ' + esc(s.last_login ? stamp(s.last_login) : 'noch nie') + '</p></div></div>' +
        '<div class="btn-row shift__actions"><button type="button" class="btn btn--secondary btn--small" data-act="c-staff-edit" data-id="' + s.id + '">Bearbeiten</button>' +
        '<a class="btn btn--ghost btn--small" href="#/chef/nachrichten/' + s.id + '">' + ico('chat') + 'Nachricht</a>' +
        '<button type="button" class="btn btn--ghost btn--small" data-act="c-staff-reset" data-id="' + s.id + '">' + ico('key') + 'Neues Passwort</button>' +
        '<button type="button" class="btn btn--danger btn--small" data-act="c-staff-delete" data-id="' + s.id + '">' + ico('trash') + 'Löschen</button></div></li>';
    }).join('') + '</ul>' : '<p class="empty">Noch niemand im Team. Lade jemanden ein!</p>') + '</section>';
    if (m.hours) h += hoursTable();
    h += '</div><div class="stack">';
    h += '<form class="card" data-form="c-invite" novalidate><h2 class="section-title">' + ico('plus') + 'Jemanden einladen</h2>' +
      '<p class="muted">Jede Einladung gilt für genau eine Person.</p>' +
      field('Für wen? <span class="muted">(Notiz, freiwillig)</span>', '<input class="input" name="note" maxlength="60" placeholder="z. B. Gerda">') +
      field('Gültig bis <span class="muted">(freiwillig)</span>', '<input class="input" type="date" name="expires" min="' + c.today + '">') +
      '<div class="sheet__foot"><button type="submit" class="btn btn--primary btn--block">Einladung erstellen</button></div></form>';
    var inv = c.invites.filter(function (i) { return i.valid; });
    var old = c.invites.filter(function (i) { return !i.valid; }).slice(0, 8);
    h += '<section><h2 class="section-title">Offene Einladungen</h2>' + (inv.length ? '<ul class="stack">' + inv.map(function (i) {
      return '<li class="card"><p class="invite-code">' + esc(i.code) + '</p><p class="muted">' + esc(i.note || 'ohne Notiz') + (i.expires ? ' · gültig bis ' + esc(dateDE(i.expires)) : '') + '</p>' +
        '<p class="linkbox">' + esc(inviteLink(i.code)) + '</p><div class="btn-row shift__actions">' +
        '<button type="button" class="btn btn--secondary btn--small" data-act="c-invite-copy" data-code="' + esc(i.code) + '">' + ico('copy') + 'Link kopieren</button>' +
        '<button type="button" class="btn btn--secondary btn--small" data-act="c-invite-qr" data-code="' + esc(i.code) + '">' + ico('qr') + 'QR-Code</button>' +
        '<button type="button" class="btn btn--ghost btn--small" data-act="c-invite-revoke" data-code="' + esc(i.code) + '">Zurückziehen</button></div></li>';
    }).join('') + '</ul>' : '<p class="empty">Keine offenen Einladungen.</p>') +
      (old.length ? '<details class="help section"><summary>Benutzte / abgelaufene Einladungen</summary><ul class="small">' + old.map(function (i) {
        return '<li>' + esc(i.code) + ' – ' + esc(i.note || 'ohne Notiz') + ': ' + (i.used ? 'benutzt am ' + esc(stamp(i.used_at)) : i.revoked ? 'zurückgezogen' : 'abgelaufen') + '</li>';
      }).join('') + '</ul></details>' : '') + '</section>';
    return h + '</div></div>';
  }
  async function loadHours() {
    if (!app.hoursMonth) app.hoursMonth = U.today().slice(0, 7);
    try { app.hours = await API.call('chef_hours', { month: app.hoursMonth }); } catch (e) { app.hours = null; }
  }
  function hoursTable() {
    var hr = app.hours, c = app.chef;
    var h = '<section class="card"><h2 class="section-title">' + ico('euro') + 'Stunden &amp; Minijob</h2>' +
      '<p class="notice small">' + ico('info') + '<span><strong>Geplant, keine Lohnabrechnung.</strong> Gezählt werden zugesagte Schichten. Minijob-Grenze: ' + esc(money(c.settings.minijob_limit)) + ' – Stand bitte selbst prüfen.</span></p>' +
      '<div class="weeknav"><button type="button" class="iconbtn" data-act="c-hours" data-d="-1" aria-label="Monat davor">' + ico('left') + '</button>' +
      '<p class="weeknav__title">' + esc(monthName(app.hoursMonth || c.today.slice(0, 7))) + '</p><button type="button" class="iconbtn" data-act="c-hours" data-d="1" aria-label="Monat danach">' + ico('right') + '</button></div>';
    if (!hr) return h + '<p class="empty">Konnte nicht geladen werden.</p></section>';
    return h + '<div class="table-wrap"><table class="tbl"><caption class="sr-only">Geplante Stunden ' + esc(monthName(hr.month)) + '</caption><thead><tr><th>Name</th><th class="r">Zugesagt</th><th class="r">Unbeantw.</th><th class="r">Lohn/Std.</th><th class="r">ca. Verdienst</th><th>Grenze</th></tr></thead><tbody>' +
      hr.rows.map(function (r) {
        return '<tr><td>' + esc(r.name) + '</td><td class="r">' + esc(fmtHours(r.minutes)) + '</td><td class="r">' + esc(r.minutes_unanswered ? fmtHours(r.minutes_unanswered) : '–') + '</td>' +
          '<td class="r">' + esc(money(r.wage)) + '</td><td class="r">' + esc(money(r.earnings)) + '</td><td>' + esc(money(r.limit)) + (r.limit_custom ? ' (eigene)' : '') +
          (r.over ? '<br><span class="badge badge--warn">' + ico('warn', 'ico--sm') + 'über Grenze</span>' : r.over_with_unanswered ? '<br><span class="small muted">mit Unbeantworteten drüber</span>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div></section>';
  }

  /* ============================================================ Chef: Anfragen */

  function viewChefRequests(sub) {
    var c = app.chef, m = chefMods();
    sub = m.orders && sub === 'bestellen' ? 'bestellen' : 'anfragen';
    var h = '<div class="page-head"><h1 class="page-title">' + (sub === 'bestellen' ? 'Bestellliste' : 'Anfragen') + '</h1></div>';
    if (m.orders) {
      h += '<nav class="seg" aria-label="Bereich wählen"><a href="#/chef/anfragen"' + (sub === 'anfragen' ? ' aria-current="page"' : '') + '>Anfragen' + (c.counts.requests ? ' (' + c.counts.requests + ')' : '') + '</a>' +
        '<a href="#/chef/anfragen/bestellen"' + (sub === 'bestellen' ? ' aria-current="page"' : '') + '>Bestellliste' + (c.counts.orders ? ' (' + c.counts.orders + ')' : '') + '</a></nav>';
    }
    if (sub === 'bestellen') return h + viewOrders(true);
    var pend = c.absences.filter(function (a) { return a.status === 'pending'; });
    var swapsWait = c.swaps.filter(function (w) { return w.status === 'accepted'; });
    var swapsOpen = c.swaps.filter(function (w) { return w.status === 'offered'; });
    h += '<div class="cols cols--2"><div class="stack">';
    h += '<section><h2 class="section-title">Urlaub &amp; Abwesenheit' + (pend.length ? ' <span class="count">' + pend.length + '</span>' : '') + '</h2>' +
      (pend.length ? '<ul class="stack">' + pend.map(absenceReq).join('') + '</ul>' : '<p class="empty">Keine offenen Anträge.</p>') + '</section>';
    h += '<section><h2 class="section-title">Abgesagte Schichten' + (c.declined.length ? ' <span class="count">' + c.declined.length + '</span>' : '') + '</h2>' +
      (c.declined.length ? '<ul class="stack">' + c.declined.map(function (s) {
        return '<li class="card"><div class="shift__top"><p class="shift__when">' + esc(dayShort(s.date)) + ' · ' + esc(s.start + '–' + s.end) + '</p>' + pill('no') + '</div>' +
          '<p>' + esc(s.name) + (s.label ? ' · ' + esc(s.label) : '') + '</p>' + (s.reason ? '<p class="shift__note">Grund: ' + esc(s.reason) + '</p>' : '') +
          '<div class="shift__actions"><button type="button" class="btn btn--primary btn--small" data-act="c-shift-edit" data-id="' + s.id + '" data-date="' + s.date + '">Neu besetzen</button></div></li>';
      }).join('') + '</ul>' : '<p class="empty">Keine.</p>') + '</section>';
    h += '</div><div class="stack">';
    h += '<section><h2 class="section-title">Offene Schicht übernehmen' + (c.takes.length ? ' <span class="count">' + c.takes.length + '</span>' : '') + '</h2>' +
      (c.takes.length ? '<ul class="stack">' + c.takes.map(function (t) {
        return '<li class="card"><p><strong>' + esc(t.name) + '</strong> möchte übernehmen:</p><p class="shift__when">' + esc(dayShort(t.shift.date)) + ' · ' + esc(t.shift.start + '–' + t.shift.end) + (t.shift.label ? ' · ' + esc(t.shift.label) : '') + '</p>' +
          '<div class="btn-row shift__actions"><button type="button" class="btn btn--yes" data-act="c-take" data-shift="' + t.shift_id + '" data-staff="' + t.staff_id + '" data-ok="1">' + ico('check') + 'Ja</button>' +
          '<button type="button" class="btn btn--no" data-act="c-take" data-shift="' + t.shift_id + '" data-staff="' + t.staff_id + '" data-ok="0">' + ico('x') + 'Nein</button></div></li>';
      }).join('') + '</ul>' : '<p class="empty">Keine.</p>') + '</section>';
    if (m.swap) {
      h += '<section><h2 class="section-title">Schicht-Tausch' + (swapsWait.length ? ' <span class="count">' + swapsWait.length + '</span>' : '') + '</h2>' +
        (swapsWait.length || swapsOpen.length ? '<ul class="stack">' + swapsWait.concat(swapsOpen).map(function (w) {
          var s = w.shift || {};
          return '<li class="card"><p class="shift__when">' + esc(dayShort(s.date || '')) + ' · ' + esc((s.start || '') + '–' + (s.end || '')) + '</p>' +
            '<p>' + esc(w.from_name) + ' → ' + (w.status === 'accepted' ? '<strong>' + esc(w.taker_name) + '</strong>' : (w.to_staff ? esc(w.to_name) + ' (gefragt)' : 'an alle angeboten')) + '</p>' +
            (w.note ? '<p class="shift__note">„' + esc(w.note) + '“</p>' : '') +
            (w.status === 'accepted' ? '<div class="btn-row shift__actions"><button type="button" class="btn btn--yes" data-act="c-swap" data-id="' + w.id + '" data-ok="1">' + ico('check') + 'Tausch bestätigen</button>' +
              '<button type="button" class="btn btn--no" data-act="c-swap" data-id="' + w.id + '" data-ok="0">' + ico('x') + 'Ablehnen</button></div>' : '<p class="small muted">Noch hat niemand angenommen.</p>') + '</li>';
        }).join('') + '</ul>' : '<p class="empty">Keine Tausch-Angebote.</p>') + '</section>';
    }
    var upcoming = c.absences.filter(function (a) { return a.status === 'approved' && a.to >= c.today; });
    if (upcoming.length) {
      h += '<section><h2 class="section-title">Genehmigt (kommend)</h2><ul class="stack">' + upcoming.map(function (a) {
        return '<li class="card"><p><strong>' + esc(a.name) + '</strong>: ' + esc(ABS[a.type] || a.type) + ', ' + esc(a.from === a.to ? dayShort(a.from) : dayShort(a.from) + ' – ' + dayShort(a.to)) + '</p>' +
          '<div class="shift__actions btn-row btn-row--tight"><button type="button" class="btn btn--ghost btn--small" data-act="c-abs-open" data-id="' + a.id + '">Ändern</button>' +
          '<button type="button" class="btn btn--ghost btn--small" data-act="c-abs-delete" data-id="' + a.id + '">' + ico('trash') + 'Löschen</button></div></li>';
      }).join('') + '</ul></section>';
    }
    return h + '</div></div>';
  }
  function absenceReq(a) {
    var c = app.chef;
    var hits = c.shifts.filter(function (s) { return s.staff_id === a.staff_id && s.date >= a.from && s.date <= a.to && s.status !== 'no'; });
    return '<li class="card"><div class="shift__top"><p class="shift__when">' + esc(a.name) + ': ' + esc(ABS[a.type] || a.type) + '</p>' + absPill(a) + '</div>' +
      '<p>' + esc(a.from === a.to ? dayLong(a.from) : dayShort(a.from) + ' bis ' + dayShort(a.to)) + '</p>' + (a.note ? '<p class="shift__note">„' + esc(a.note) + '“</p>' : '') +
      (hits.length ? '<p class="shift__warn">' + ico('warn') + '<span>Hat in der Zeit ' + hits.length + ' Schicht' + (hits.length === 1 ? '' : 'en') + ' (in der angezeigten Woche).</span></p>' : '') +
      '<div class="btn-row shift__actions"><button type="button" class="btn btn--primary" data-act="c-abs-open" data-id="' + a.id + '">Entscheiden</button></div></li>';
  }

  /* ============================================================ Chef: Nachrichten */

  async function loadThread(id) {
    app.thread = await API.call('chef_thread', { staff_id: id });
    if (app.thread.messages.some(function (m) { return !m.from_chef && !m.read; })) {
      try {
        await API.call('chef_message_read', { staff_id: id });
        app.chef.threads.forEach(function (t) { if (t.staff_id === id) { app.chef.counts.unread -= t.unread; t.unread = 0; } });
      } catch (e) { /* egal */ }
    }
  }
  function viewChefMessages(sub) {
    var c = app.chef, m = chefMods();
    if (sub && /^\d+$/.test(sub) && app.thread && app.thread.staff_id === +sub) {
      var t = app.thread;
      setTimeout(function () { var th = $view.querySelector('.thread'); if (th && th.lastElementChild) th.lastElementChild.scrollIntoView({ block: 'nearest' }); }, 0);
      return '<div class="page-head"><a class="btn btn--ghost btn--small" href="#/chef/nachrichten">' + ico('left') + 'Alle Nachrichten</a><h1 class="page-title">' + esc(t.name) + '</h1></div>' +
        threadHtml(t.messages, true) + composer('c-msg', 'Nachricht an ' + t.name, ' data-staff="' + t.staff_id + '"');
    }
    sub = m.board && sub === 'brett' ? 'brett' : 'liste';
    var h = '<div class="page-head"><h1 class="page-title">Nachrichten</h1></div>';
    if (m.board) {
      h += '<nav class="seg" aria-label="Bereich wählen"><a href="#/chef/nachrichten"' + (sub === 'liste' ? ' aria-current="page"' : '') + '>Einzeln' + (c.counts.unread ? ' (' + c.counts.unread + ' neu)' : '') + '</a>' +
        '<a href="#/chef/nachrichten/brett"' + (sub === 'brett' ? ' aria-current="page"' : '') + '>Schwarzes Brett</a></nav>';
    }
    if (sub === 'brett') {
      h += '<div class="cols cols--2"><form class="card" data-form="c-board" novalidate><h2 class="section-title">' + ico('pin') + 'Neuer Aushang für alle</h2>' +
        field('Überschrift <span class="muted">(freiwillig)</span>', '<input class="input" name="title" maxlength="80">') +
        field('Text', '<textarea class="input" name="body" maxlength="2000" required></textarea>') +
        '<div class="sheet__foot"><button type="submit" class="btn btn--primary btn--block">Aushängen</button></div></form><div class="stack">' +
        (c.board.length ? c.board.map(function (b) {
          return boardPost(b, true).replace(/<\/article>$/, '') + '<p class="small"><strong>Gelesen von ' + b.reads.length + ':</strong> ' + esc(b.reads.map(function (r) { return r.name; }).join(', ') || 'noch niemand') + '</p>' +
            (b.not_read.length ? '<p class="small muted">Noch nicht gelesen: ' + esc(b.not_read.join(', ')) + '</p>' : '<p class="small">' + pill('yes', 'Alle haben es gelesen') + '</p>') +
            '<div class="shift__actions"><button type="button" class="btn btn--ghost btn--small" data-act="c-board-delete" data-id="' + b.id + '">' + ico('trash') + 'Abhängen</button></div></article>';
        }).join('') : '<p class="empty">Noch keine Aushänge.</p>') + '</div></div>';
      return h;
    }
    var byId = {};
    c.threads.forEach(function (t) { byId[t.staff_id] = t; });
    var list = c.threads.slice();
    c.staff.forEach(function (s) { if (!byId[s.id] && s.active) list.push({ staff_id: s.id, name: s.name, last: '', unread: 0 }); });
    return h + (list.length ? list.map(function (t) {
      return '<a class="listbtn" href="#/chef/nachrichten/' + t.staff_id + '"><span class="avatar" aria-hidden="true">' + initial(t.name) + '</span><span class="listbtn__main"><strong>' + esc(t.name) + '</strong>' +
        '<span>' + (t.last ? (t.last_from_chef ? 'Du: ' : '') + esc(t.last) : 'Noch keine Nachrichten') + '</span></span>' + (t.unread ? '<span class="badge badge--red">' + t.unread + ' neu</span>' : '') + ico('right') + '</a>';
    }).join('') : '<p class="empty">Noch niemand im Team.</p>');
  }

  /* ============================================================ Chef: Einstellungen */

  var MOD_TEXT = {
    availability: ['Verfügbarkeit', 'Mitarbeiter tragen ein, an welchen Tagen sie können.'],
    swap: ['Schicht tauschen', 'Mitarbeiter bieten Schichten Kollegen an.'],
    tasks: ['Aufgaben / Checklisten', 'Zum Abhaken während der Schicht.'],
    hours: ['Stunden & Minijob', 'Geplante Stunden und geschätzter Verdienst.'],
    board: ['Schwarzes Brett', 'Aushänge an alle mit „gelesen“.'],
    ical: ['Kalender-Abo', 'Schichten im Handy-Kalender.'],
    orders: ['Bestellliste', '„Fast leer“ melden, bestellt/geliefert abhaken.']
  };
  function viewChefSettings() {
    var c = app.chef, s = c.settings, m = s.modules;
    var h = '<div class="page-head"><h1 class="page-title">Einstellungen</h1><p class="page-sub">Änderungen gelten sofort.</p></div>';
    if (!c.enabled) h += '<div class="notice notice--warn">' + ico('warn') + '<span>Der Team-Bereich ist für Mitarbeiter ausgeschaltet – einschalten im CMS unter „Funktionen“.</span></div><div class="gap"></div>';
    h += '<div class="cols cols--2"><div class="stack"><section class="card"><h2 class="section-title">Funktionen</h2><p class="muted small">Ausgeschaltete Funktionen verschwinden für die Mitarbeiter.</p>' +
      Object.keys(MOD_TEXT).map(function (k) {
        return '<label class="switch"><span class="switch__text"><strong>' + esc(MOD_TEXT[k][0]) + '</strong><small>' + esc(MOD_TEXT[k][1]) + '</small></span>' +
          '<span class="state" aria-hidden="true">' + (m[k] ? 'an' : 'aus') + '</span><input type="checkbox" role="switch" data-act-change="c-module" data-m="' + k + '"' + (m[k] ? ' checked' : '') + ' aria-label="' + esc(MOD_TEXT[k][0]) + '"></label>';
      }).join('') + '</section>' +
      '<section class="card"><h2 class="section-title">Abläufe</h2>' +
      '<label class="switch"><span class="switch__text"><strong>Tausch braucht meine Bestätigung</strong><small>Sonst gilt ein Tausch sofort, wenn ein Kollege annimmt.</small></span><span class="state" aria-hidden="true">' + (s.swap_needs_chef ? 'an' : 'aus') + '</span><input type="checkbox" role="switch" data-act-change="c-setting" data-k="swap_needs_chef"' + (s.swap_needs_chef ? ' checked' : '') + ' aria-label="Tausch braucht meine Bestätigung"></label>' +
      '<label class="switch"><span class="switch__text"><strong>Offene Schichten nur nach Bestätigung</strong><small>Vorgabe für neue Schichten. Sonst gilt: wer zuerst kommt.</small></span><span class="state" aria-hidden="true">' + (s.take_needs_ok ? 'an' : 'aus') + '</span><input type="checkbox" role="switch" data-act-change="c-setting" data-k="take_needs_ok"' + (s.take_needs_ok ? ' checked' : '') + ' aria-label="Offene Schichten nur nach Bestätigung"></label></section>' +
      '<form class="card" data-form="c-minijob" novalidate><h2 class="section-title">' + ico('euro') + 'Minijob-Grenze</h2>' +
      field('Monatsgrenze in Euro', '<input class="input" name="minijob_limit" inputmode="decimal" value="' + esc(moneyInput(s.minijob_limit)) + '" maxlength="10">', 'Minijob-Grenze – Stand bitte selbst prüfen (2026: 603 €). Gilt für alle ohne eigene Grenze.') +
      '<div class="sheet__foot"><button type="submit" class="btn btn--secondary btn--block">Speichern</button></div></form>' +
      '<form class="card" data-form="c-labels" novalidate><h2 class="section-title">Schicht-Bezeichnungen</h2>' +
      field('Eine pro Zeile', '<textarea class="input" name="labels" rows="5">' + esc(s.labels.join('\n')) + '</textarea>', 'z. B. Theke, Aufbau, Putzen, Veranstaltung') +
      '<div class="sheet__foot"><button type="submit" class="btn btn--secondary btn--block">Speichern</button></div></form></div><div class="stack">';
    h += '<section class="card"><h2 class="section-title">' + ico('list') + 'Checklisten</h2><p class="muted small">Erscheinen bei Schichten mit der passenden Bezeichnung zum Abhaken.</p>' +
      (c.checklists.length ? '<ul class="stack">' + c.checklists.map(function (l) {
        return '<li class="listbtn"><span class="listbtn__main"><strong>' + esc(l.name) + '</strong><span>' + esc(l.label ? 'bei „' + l.label + '“' : 'bei allen Schichten') + ' · ' + l.items.length + ' Punkte</span></span>' +
          '<button type="button" class="btn btn--secondary btn--small" data-act="c-cl-edit" data-id="' + l.id + '">Bearbeiten</button></li>';
      }).join('') + '</ul>' : '<p class="empty">Noch keine Checklisten.</p>') +
      '<div class="sheet__foot"><button type="button" class="btn btn--primary btn--block" data-act="c-cl-edit">' + ico('plus') + 'Neue Checkliste</button></div></section>';
    if (m.orders) {
      h += '<section class="card"><h2 class="section-title">' + ico('cart') + 'Bestell-Artikel zum Antippen</h2><p class="muted small">Häufige Artikel – die Mitarbeiter melden sie mit einem Tipp als „fast leer“.</p>' +
        (c.orders.catalog.length ? '<ul>' + c.orders.catalog.map(function (a) {
          return '<li class="listbtn"><span class="listbtn__main"><strong>' + esc(a.name) + '</strong><span>' + esc(CATS[a.category] || '') + (a.qty ? ' · ' + esc(a.qty) : '') + '</span></span>' +
            '<button type="button" class="btn btn--secondary btn--small" data-act="c-cat-edit" data-id="' + a.id + '">Bearbeiten</button></li>';
        }).join('') + '</ul>' : '<p class="empty">Noch keine Artikel.</p>') +
        '<div class="sheet__foot"><button type="button" class="btn btn--primary btn--block" data-act="c-cat-edit">' + ico('plus') + 'Neuer Artikel</button></div></section>';
    }
    return h + '</div></div>';
  }

  /* ============================================================ QR-Code */

  function qrSvg(text) {
    var q = window.qrcode(0, 'M');
    q.addData(text); q.make();
    var n = q.getModuleCount(), m = 4, d = '';
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (q.isDark(r, c)) d += 'M' + (c + m) + ' ' + (r + m) + 'h1v1h-1z';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + (n + 2 * m) + ' ' + (n + 2 * m) + '" role="img" aria-label="QR-Code für die Einladung" shape-rendering="crispEdges">' +
      '<rect width="100%" height="100%" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
  }

  /* ============================================================ Aktionen */

  async function reload() {
    if (isChefRoute()) { await loadChef(); var p = routeParts(); if (p[1] === 'nachrichten' && p[2] && /^\d+$/.test(p[2])) await loadThread(+p[2]); if (p[1] === 'team') await loadHours(); }
    else if (API.me) await loadStaff();
    paint(isChefRoute() ? 'chef' : 'staff', routeParts());
  }
  async function act(btn, action, data, okMsg) {
    var r = await run(btn, action, data, okMsg);
    if (r) { try { await reload(); } catch (e) { render(true); } }
    return r;
  }
  function findShift(id) {
    var lists = app.data ? [app.data.my_shifts, app.data.open_shifts, app.data.week] : [];
    if (app.chef) lists.push(app.chef.shifts);
    for (var i = 0; i < lists.length; i++) for (var j = 0; j < lists[i].length; j++) if (lists[i][j].id === id) return lists[i][j];
    return null;
  }

  var ACTIONS = {
    reload: function () { render(true); },
    'pw-toggle': function (b) {
      var inp = b.parentNode.querySelector('input');
      var show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      b.setAttribute('aria-pressed', show ? 'true' : 'false');
      b.setAttribute('aria-label', show ? 'Passwort verbergen' : 'Passwort anzeigen');
    },
    respond: async function (b) {
      var id = +b.dataset.id, s = findShift(id);
      if (b.dataset.answer === 'yes') { await act(b, 'shift_respond', { id: id, answer: 'yes' }, 'Zugesagt – danke!'); return; }
      var el = openSheet('Schicht absagen', '<p><strong>' + esc(s ? relDay(s.date) + ', ' + timeRange(s) : '') + '</strong></p><form data-form="decline" novalidate><input type="hidden" name="id" value="' + id + '">' +
        field('Grund <span class="muted">(freiwillig)</span>', '<textarea class="input" name="reason" maxlength="200" placeholder="z. B. Arzttermin"></textarea>', 'Der Chef sieht den Grund. Bitte keine Krankheitsdetails.') +
        '<div class="sheet__foot btn-row"><button type="submit" class="btn btn--danger-solid">' + ico('x') + 'Ja, absagen</button><button type="button" class="btn btn--ghost" data-close>Doch nicht</button></div></form>');
      void el;
    },
    take: async function (b) {
      var s = findShift(+b.dataset.id);
      var ok = await ask(s && s.needs_ok ? 'Schicht anfragen?' : 'Schicht übernehmen?', '<strong>' + esc(s ? relDay(s.date) + ', ' + timeRange(s) : '') + '</strong>' + (s && s.label ? ' · ' + esc(s.label) : '') +
        (s && s.needs_ok ? '<br>Der Chef entscheidet und du bekommst Bescheid.' : '<br>Die Schicht gehört dann dir.'), s && s.needs_ok ? 'Ja, anfragen' : 'Ja, übernehmen');
      if (!ok) return;
      var r = await run(null, 'shift_take', { id: +b.dataset.id });
      if (r) { var msg = r.result === 'taken' ? 'Die Schicht gehört jetzt dir – danke!' : 'Angefragt. Der Chef meldet sich.'; toast(msg); announce(msg); await reload(); }
    },
    'take-cancel': function (b) { return act(b, 'take_cancel', { id: +b.dataset.id }, 'Anfrage zurückgezogen.'); },
    'swap-offer': function (b) {
      var s = findShift(+b.dataset.id);
      var col = app.data.colleagues.filter(function (c) { return !c.me; });
      openSheet('Schicht zum Tausch anbieten', '<p><strong>' + esc(s ? relDay(s.date) + ', ' + timeRange(s) : '') + '</strong></p><form data-form="swap" novalidate><input type="hidden" name="shift_id" value="' + b.dataset.id + '">' +
        field('An wen?', '<select class="input" name="to_staff"><option value="0">An alle im Team</option>' + col.map(function (c) { return '<option value="' + c.id + '">' + esc(c.name) + '</option>'; }).join('') + '</select>') +
        field('Notiz <span class="muted">(freiwillig)</span>', '<input class="input" name="note" maxlength="200" placeholder="z. B. Familienfeier">') +
        '<p class="field__hint">' + (app.data.settings.swap_needs_chef ? 'Wenn jemand annimmt, bestätigt der Chef den Tausch. Bis dahin bleibt es deine Schicht.' : 'Sobald jemand annimmt, gehört die Schicht der anderen Person.') + '</p>' +
        '<div class="sheet__foot btn-row"><button type="submit" class="btn btn--primary">' + ico('swap') + 'Anbieten</button><button type="button" class="btn btn--ghost" data-close>Abbrechen</button></div></form>');
    },
    'swap-cancel': async function (b) { if (await ask('Tausch zurückziehen?', 'Die Schicht bleibt dann deine.', 'Ja, zurückziehen')) await act(null, 'swap_cancel', { id: +b.dataset.id }, 'Tausch-Angebot zurückgezogen.'); },
    'swap-accept': async function (b) {
      if (!await ask('Schicht übernehmen?', 'Du übernimmst die Schicht von deinem Kollegen.', 'Ja, übernehmen')) return;
      var r = await run(null, 'swap_accept', { id: +b.dataset.id });
      if (r) { var msg = r.result === 'done' ? 'Erledigt – die Schicht gehört jetzt dir.' : 'Angenommen. Der Chef muss noch bestätigen.'; toast(msg); announce(msg); await reload(); }
    },
    'swap-reject': function (b) { return act(b, 'swap_reject', { id: +b.dataset.id }, 'Okay, abgelehnt.'); },
    tick: async function (b) {
      var done = b.dataset.done === '1';
      await act(b, 'check_tick', { shift_id: +b.dataset.shift, checklist_id: +b.dataset.list, item_id: b.dataset.item, done: done }, done ? 'Abgehakt.' : 'Haken entfernt.');
      var again = $view.querySelector('[data-act="tick"][data-item="' + b.dataset.item + '"][data-list="' + b.dataset.list + '"]');
      if (again) again.focus();
    },
    'board-read': function (b) { return act(b, 'board_read', { id: +b.dataset.id }, 'Als gelesen markiert.'); },
    'abs-cancel': async function (b) { if (await ask('Eintrag entfernen?', 'Der Antrag wird gelöscht.', 'Ja, entfernen', true)) await act(null, 'absence_cancel', { id: +b.dataset.id }, 'Entfernt.'); },
    'avail-tool': function (b) {
      app.availTool = b.dataset.v;
      Array.prototype.forEach.call($view.querySelectorAll('[data-act="avail-tool"]'), function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      announce('Ausgewählt: ' + AV[app.availTool][0] + '. Jetzt auf die Tage tippen.');
    },
    'avail-day': async function (b) {
      var date = b.dataset.date, v = app.availTool, days = {};
      days[date] = v;
      var prev = app.data.availability[date] || '';
      // sofort anzeigen, dann speichern
      app.data.availability[date] = v;
      if (!v) delete app.data.availability[date];
      b.className = 'acell' + (v ? ' acell--' + v : '') + (date === app.data.today ? ' acell--today' : '');
      b.querySelector('.acell__v').textContent = v ? AV[v][1] : '';
      b.setAttribute('aria-label', dayLong(date) + ': ' + AV[v][0]);
      try {
        await API.call('availability_set', { days: days });
        announce('Gespeichert: ' + dayLong(date) + ' – ' + AV[v][0]);
      } catch (e) {
        if (prev) app.data.availability[date] = prev; else delete app.data.availability[date];
        toast(errMsg(e), 'err');
        paint('staff', routeParts());
      }
    },
    'order-quick': async function (b) {
      var chef = isChefRoute();
      var r = await run(b, chef ? 'chef_order_add' : 'order_add', { catalog_id: +b.dataset.cat });
      if (r) { var msg = r.existing ? 'Steht schon auf der Liste – danke!' : 'Auf die Liste gesetzt – danke!'; toast(msg); announce(msg); await reload(); }
    },
    'order-remove': function (b) { return act(b, 'order_remove', { id: +b.dataset.id }, 'Entfernt.'); },
    'week-prev': function () { app.weekStart = U.addDays(app.data.from, -7); render(true); },
    'week-next': function () { app.weekStart = U.addDays(app.data.from, 7); render(true); },
    'week-today': function () { app.weekStart = U.mondayOf(today()); render(true); },
    'ical-copy': async function () { var ok = await copyText(app.data.me.ical_url); toast(ok ? 'Link kopiert.' : 'Kopieren ging nicht – bitte lange auf den Knopf drücken.', ok ? '' : 'err'); },
    'ical-reset': async function () {
      if (!await ask('Neuen Kalender-Link erzeugen?', 'Der alte Link funktioniert dann nicht mehr. Du musst den Kalender danach neu abonnieren.', 'Ja, neuer Link')) return;
      await act(null, 'ical_reset', {}, 'Neuer Link erzeugt. Bitte den Kalender neu abonnieren.');
    },
    logout: async function (b) {
      var r = await run(b, 'logout', {});
      if (r) { app.data = null; toast('Du bist abgemeldet. Bis bald!'); go('#/'); render(); }
    },
    'delete-account': function () {
      openSheet('Konto löschen', '<p>Dein Zugang und deine Daten (Telefon, Nachrichten, Anträge, Verfügbarkeit) werden gelöscht. Deine kommenden Schichten werden wieder <strong>offen</strong>. Vergangene Schichten bleiben ohne deinen Namen im Plan.</p>' +
        '<form data-form="delete-account" novalidate>' + pwField('password', 'Zur Sicherheit: dein Passwort', 'current-password') +
        '<div class="sheet__foot btn-row"><button type="submit" class="btn btn--danger-solid">' + ico('trash') + 'Endgültig löschen</button><button type="button" class="btn btn--ghost" data-close>Abbrechen</button></div></form>');
    },

    /* ---- Chef */
    'c-week-prev': function () { app.chefWeek = U.addDays(app.chef.from, -7); render(true); },
    'c-week-next': function () { app.chefWeek = U.addDays(app.chef.from, 7); render(true); },
    'c-week-today': function () { app.chefWeek = U.mondayOf(today()); render(true); },
    'c-mode': function (b) {
      app.chefMode = b.dataset.m;
      if (app.chefMode === 'month') app.chefMonth = (app.chefWeek ? U.addDays(app.chefWeek, 3) : today()).slice(0, 7);
      render(true);
    },
    'c-month-prev': function () { var m = app.chefMonth || today().slice(0, 7), y = +m.slice(0, 4), mo = +m.slice(5, 7) - 1; if (mo < 1) { mo = 12; y--; } app.chefMonth = y + '-' + pad(mo); render(true); },
    'c-month-next': function () { app.chefMonth = U.nextMonth(app.chefMonth || today().slice(0, 7)); render(true); },
    'c-mday': function (b) { app.chefMode = 'week'; app.chefWeek = U.mondayOf(b.dataset.date); render(true); },
    'c-shift-new': function (b) { shiftEditor(null, b.dataset.date); },
    'c-shift-edit': async function (b) {
      var id = +b.dataset.id, s = app.chef.shifts.filter(function (x) { return x.id === id; })[0];
      if (!s && b.dataset.date) {
        try { var d = await API.call('chef_data', { from: b.dataset.date, to: b.dataset.date }); s = d.shifts.filter(function (x) { return x.id === id; })[0]; } catch (e) { s = null; }
      }
      if (s) shiftEditor(s); else toast('Schicht nicht gefunden.', 'err');
    },
    'c-shift-delete': async function (b) {
      var series = b.dataset.series === '1';
      closeSheet(true);
      var body = '<p>Die Schicht wird gelöscht. Wer eingeteilt war, sieht sie dann nicht mehr.</p><div class="sheet__foot btn-row">' +
        '<button type="button" class="btn btn--danger-solid" data-scope="one">' + ico('trash') + 'Nur diese löschen</button>' +
        (series ? '<button type="button" class="btn btn--danger" data-scope="following">Diese und alle folgenden der Wiederholung</button>' : '') +
        '<button type="button" class="btn btn--ghost" data-close>Abbrechen</button></div>';
      var el = openSheet('Schicht löschen?', body);
      Array.prototype.forEach.call(el.querySelectorAll('[data-scope]'), function (x) {
        x.addEventListener('click', async function () {
          var r = await run(x, 'chef_shift_delete', { id: +b.dataset.id, scope: x.dataset.scope });
          if (r) { closeSheet(true); var msg = r.deleted === 1 ? 'Schicht gelöscht.' : r.deleted + ' Schichten gelöscht.'; toast(msg); announce(msg); await reload(); }
        });
      });
    },
    'c-take': async function (b) {
      var ok = b.dataset.ok === '1';
      var r = await run(b, 'chef_take_decide', { shift_id: +b.dataset.shift, staff_id: +b.dataset.staff, approve: ok }, ok ? 'Schicht vergeben.' : 'Anfrage abgelehnt.');
      if (r) { closeSheet(true); await reload(); }
    },
    'c-swap': async function (b) {
      var ok = b.dataset.ok === '1';
      var r = await run(b, 'chef_swap_decide', { id: +b.dataset.id, approve: ok }, ok ? 'Tausch bestätigt.' : 'Tausch abgelehnt.');
      if (r) { closeSheet(true); await reload(); }
    },
    'c-abs-open': function (b) {
      var a = app.chef.absences.filter(function (x) { return x.id === +b.dataset.id; })[0];
      if (!a) return;
      var el = openSheet('Antrag von ' + a.name, '<p><strong>' + esc(ABS[a.type] || a.type) + '</strong>: ' + esc(a.from === a.to ? dayLong(a.from) : dayLong(a.from) + ' bis ' + dayLong(a.to)) + '</p>' +
        (a.note ? '<p class="shift__note">„' + esc(a.note) + '“</p>' : '') + '<form novalidate data-form="c-abs" data-id="' + a.id + '">' +
        field('Kommentar <span class="muted">(freiwillig)</span>', '<textarea class="input" name="comment" maxlength="300">' + esc(a.chef_comment || '') + '</textarea>') +
        '<div class="sheet__foot btn-row"><button type="submit" class="btn btn--yes" value="1">' + ico('check') + 'Genehmigen</button><button type="submit" class="btn btn--no" value="0">' + ico('x') + 'Ablehnen</button></div></form>');
      void el;
    },
    'c-abs-delete': async function (b) { if (await ask('Abwesenheit löschen?', 'Der Eintrag wird entfernt.', 'Ja, löschen', true)) await act(null, 'chef_absence_delete', { id: +b.dataset.id }, 'Gelöscht.'); },
    'c-invite-copy': async function (b) { var ok = await copyText(inviteLink(b.dataset.code)); toast(ok ? 'Einladungslink kopiert.' : 'Kopieren ging nicht.', ok ? '' : 'err'); },
    'c-invite-qr': function (b) {
      var link = inviteLink(b.dataset.code);
      openSheet('QR-Code zum Einladen', '<p class="center">Mit der Handy-Kamera scannen – dann öffnet sich die Anmeldung.</p><div class="gap"></div><div class="qr-box">' + qrSvg(link) + '</div>' +
        '<p class="center invite-code">' + esc(b.dataset.code) + '</p><p class="linkbox">' + esc(link) + '</p>' +
        '<div class="sheet__foot btn-row no-print"><button type="button" class="btn btn--secondary" data-act="print">Drucken</button><button type="button" class="btn btn--ghost" data-close>Schließen</button></div>');
    },
    print: function () { window.print(); },
    'c-invite-revoke': async function (b) { if (await ask('Einladung zurückziehen?', 'Der Link funktioniert dann nicht mehr.', 'Ja, zurückziehen', true)) await act(null, 'chef_invite_revoke', { code: b.dataset.code }, 'Einladung zurückgezogen.'); },
    'c-staff-edit': function (b) {
      var s = app.chef.staff.filter(function (x) { return x.id === +b.dataset.id; })[0];
      openSheet(s.name + ' bearbeiten', '<form data-form="c-staff" data-id="' + s.id + '" novalidate>' +
        (chefMods().hours ? field('Stundenlohn in Euro <span class="muted">(freiwillig)</span>', '<input class="input" name="wage" inputmode="decimal" maxlength="10" value="' + esc(moneyInput(s.wage)) + '" placeholder="z. B. 13,90">', 'Sieht nur du und ' + esc(s.name) + '.') +
          field('Eigene Monatsgrenze <span class="muted">(leer = Standard ' + esc(money(app.chef.settings.minijob_limit)) + ')</span>', '<input class="input" name="limit" inputmode="decimal" maxlength="10" value="' + esc(s.limit_custom ? moneyInput(s.limit) : '') + '">') : '') +
        '<label class="check"><input type="checkbox" name="active"' + (s.active ? ' checked' : '') + '><span>Zugang aktiv (aus = kann sich nicht mehr anmelden)</span></label>' +
        '<div class="sheet__foot btn-row"><button type="submit" class="btn btn--primary">Speichern</button><button type="button" class="btn btn--ghost" data-close>Abbrechen</button></div></form>');
    },
    'c-staff-reset': async function (b) {
      var s = app.chef.staff.filter(function (x) { return x.id === +b.dataset.id; })[0];
      if (!await ask('Neues Passwort für ' + s.name + '?', 'Das alte Passwort gilt dann nicht mehr. Du bekommst ein vorläufiges Passwort zum Weitergeben.', 'Ja, neues Passwort')) return;
      var r = await run(null, 'chef_staff_reset', { id: s.id });
      if (r) openSheet('Vorläufiges Passwort', '<p>Gib ' + esc(s.name) + ' dieses Passwort persönlich. Es wird nur jetzt angezeigt.</p><p class="invite-code center">' + esc(r.temp_password) + '</p>' +
        '<p class="small muted">' + esc(s.name) + ' kann es danach unter „Ich“ ändern.</p><div class="sheet__foot"><button type="button" class="btn btn--primary btn--block" data-close>Erledigt</button></div>');
    },
    'c-staff-delete': async function (b) {
      var s = app.chef.staff.filter(function (x) { return x.id === +b.dataset.id; })[0];
      if (!await ask(s.name + ' löschen?', 'Zugang und persönliche Daten (Telefon, Nachrichten, Anträge, Verfügbarkeit, Lohn) werden gelöscht. Kommende Schichten werden <strong>offen</strong>, vergangene bleiben als „ehem. Mitarbeiter“.', 'Ja, endgültig löschen', true)) return;
      await act(null, 'chef_staff_delete', { id: s.id }, s.name + ' wurde gelöscht.');
    },
    'c-hours': async function (b) {
      var m = app.hoursMonth || today().slice(0, 7), y = +m.slice(0, 4), mo = +m.slice(5, 7) + (+b.dataset.d);
      if (mo < 1) { mo = 12; y--; } if (mo > 12) { mo = 1; y++; }
      app.hoursMonth = y + '-' + pad(mo);
      await loadHours();
      paint('chef', routeParts());
    },
    'c-board-delete': async function (b) { if (await ask('Aushang abhängen?', 'Er verschwindet für alle.', 'Ja, abhängen', true)) await act(null, 'chef_board_delete', { id: +b.dataset.id }, 'Aushang entfernt.'); },
    'c-order-status': function (b) { return act(b, 'chef_order_status', { id: +b.dataset.id, status: b.dataset.s }, { ordered: 'Als bestellt markiert.', delivered: 'Als geliefert markiert.', low: 'Wieder auf „fast leer“.' }[b.dataset.s]); },
    'c-order-delete': async function (b) { if (await ask('Eintrag löschen?', 'Er verschwindet von der Bestellliste.', 'Ja, löschen', true)) await act(null, 'chef_order_delete', { id: +b.dataset.id }, 'Gelöscht.'); },
    'c-cl-edit': function (b) {
      var l = b.dataset.id ? app.chef.checklists.filter(function (x) { return x.id === +b.dataset.id; })[0] : null;
      var labels = app.chef.settings.labels;
      openSheet(l ? 'Checkliste bearbeiten' : 'Neue Checkliste', '<form data-form="c-cl"' + (l ? ' data-id="' + l.id + '"' : '') + ' novalidate>' +
        field('Name', '<input class="input" name="name" required maxlength="60" value="' + esc(l ? l.name : '') + '" placeholder="z. B. Schichtende">') +
        field('Bei welchen Schichten?', '<select class="input" name="label"><option value="">bei allen Schichten</option>' + labels.map(function (x) { return '<option' + (l && l.label === x ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') +
          (l && l.label && labels.indexOf(l.label) < 0 ? '<option selected>' + esc(l.label) + '</option>' : '') + '</select>') +
        field('Aufgaben – eine pro Zeile', '<textarea class="input" name="items" rows="7" required>' + esc(l ? l.items.map(function (i) { return i.text; }).join('\n') : '') + '</textarea>', 'z. B. Kasse zählen · Fass prüfen · Toiletten kontrollieren') +
        '<div class="sheet__foot btn-row"><button type="submit" class="btn btn--primary">Speichern</button>' +
        (l ? '<button type="button" class="btn btn--danger" data-act="c-cl-delete" data-id="' + l.id + '">' + ico('trash') + 'Löschen</button>' : '') + '</div></form>');
    },
    'c-cl-delete': async function (b) {
      closeSheet(true);
      if (await ask('Checkliste löschen?', 'Auch die Haken in vergangenen Schichten verschwinden.', 'Ja, löschen', true)) await act(null, 'chef_checklist_delete', { id: +b.dataset.id }, 'Checkliste gelöscht.');
    },
    'c-cat-edit': function (b) {
      var a = b.dataset.id ? app.chef.orders.catalog.filter(function (x) { return x.id === +b.dataset.id; })[0] : null;
      openSheet(a ? 'Artikel bearbeiten' : 'Neuer Artikel', '<form data-form="c-cat"' + (a ? ' data-id="' + a.id + '"' : '') + ' novalidate>' +
        field('Artikel', '<input class="input" name="name" required maxlength="80" value="' + esc(a ? a.name : '') + '" placeholder="z. B. Hofbräu Export">') +
        '<div class="row2">' + field('Übliche Menge', '<input class="input" name="qty" maxlength="40" value="' + esc(a ? a.qty : '') + '" placeholder="z. B. 2 Kisten">') +
        field('Art', '<select class="input" name="category">' + Object.keys(CATS).map(function (k) { return '<option value="' + k + '"' + (a && a.category === k ? ' selected' : '') + '>' + esc(CATS[k]) + '</option>'; }).join('') + '</select>') + '</div>' +
        '<div class="sheet__foot btn-row"><button type="submit" class="btn btn--primary">Speichern</button>' +
        (a ? '<button type="button" class="btn btn--danger" data-act="c-cat-delete" data-id="' + a.id + '">' + ico('trash') + 'Löschen</button>' : '') + '</div></form>');
    },
    'c-cat-delete': async function (b) { closeSheet(true); await act(null, 'chef_catalog_delete', { id: +b.dataset.id }, 'Artikel gelöscht.'); }
  };

  var FORMS = {
    login: async function (f, d, btn) {
      var r = await run(btn, 'login', { name: d.name, password: d.password });
      if (r) { toast('Hallo ' + r.me.name + '!'); app.data = null; go('#/start'); }
      else showFormError(f, 'Anmeldung hat nicht geklappt. Bitte Name und Passwort prüfen.');
    },
    register: async function (f, d, btn) {
      var r = await run(btn, 'register', { code: d.code, name: d.name, password: d.password, phone: d.phone, phone_visible: d.phone_visible });
      if (r) {
        try { history.replaceState(null, '', location.pathname + '#/start'); } catch (e) { /* egal */ }
        toast('Willkommen im Team, ' + r.me.name + '!');
        app.data = null; render(true);
      }
    },
    decline: async function (f, d, btn) {
      var r = await run(btn, 'shift_respond', { id: +d.id, answer: 'no', reason: d.reason }, 'Abgesagt. Der Chef sieht es.');
      if (r) { closeSheet(true); await reload(); }
    },
    swap: async function (f, d, btn) {
      var r = await run(btn, 'swap_offer', { shift_id: +d.shift_id, to_staff: +d.to_staff, note: d.note }, 'Angeboten. Du bekommst Bescheid, wenn jemand annimmt.');
      if (r) { closeSheet(true); await reload(); }
    },
    absence: async function (f, d, btn) {
      var r = await run(btn, 'absence_request', { type: d.type, from: d.from, to: d.to, note: d.note }, 'Antrag ist beim Chef.');
      if (r) await reload();
    },
    msg: async function (f, d, btn) {
      if (!d.body.trim()) { showFormError(f, 'Bitte erst etwas schreiben.'); return; }
      var r = await run(btn, 'message_send', { body: d.body }, 'Nachricht gesendet.');
      if (r) { await reload(); sideEffectsStaff(routeParts()); var t = $view.querySelector('textarea[name=body]'); if (t) t.focus(); }
    },
    profile: function (f, d, btn) { return act(btn, 'profile_save', { phone: d.phone, phone_visible: d.phone_visible }, 'Gespeichert.'); },
    password: async function (f, d, btn) {
      var r = await run(btn, 'change_password', { old: d.old, 'new': d['new'] }, 'Passwort geändert. Andere Geräte sind jetzt abgemeldet.');
      if (r) f.reset();
    },
    'delete-account': async function (f, d, btn) {
      var r = await run(btn, 'delete_account', { password: d.password });
      if (r) { closeSheet(true); app.data = null; toast('Dein Konto ist gelöscht. Danke für alles!'); go('#/'); render(); }
    },
    'order-add': async function (f, d, btn) {
      var chef = isChefRoute();
      var r = await run(btn, chef ? 'chef_order_add' : 'order_add', { name: d.name, qty: d.qty, category: d.category, note: d.note });
      if (r) { var msg = r.existing ? 'Steht schon auf der Liste.' : 'Auf die Liste gesetzt – danke!'; toast(msg); announce(msg); await reload(); }
    },
    'c-shift': async function (f, d, btn) {
      var data = { date: d.date, start: d.start, end: d.end, label: d.label, note: d.note, staff_id: +d.staff_id || 0, confirmed: !!d.confirmed, needs_ok: !!d.needs_ok };
      if (d.id) data.id = +d.id;
      if (d.repeat_until) data.repeat_until = d.repeat_until;
      var r = await run(btn, 'chef_shift_save', data);
      if (!r) return;
      closeSheet(true);
      var msg = (r.ids.length > 1 ? r.ids.length + ' Schichten angelegt.' : 'Schicht gespeichert.') + (r.warnings.length ? ' Achtung: ' + r.warnings[0].text + '.' : '');
      toast(msg, r.warnings.length ? 'err' : ''); announce(msg);
      app.chefWeek = U.mondayOf(d.date);
      if (app.chefMode === 'week') await reload(); else render(true);
    },
    'c-abs': async function (f, d, btn) {
      var approve = btn && btn.value === '1';
      var r = await run(btn, 'chef_absence_decide', { id: +f.dataset.id, approve: approve, comment: d.comment }, approve ? 'Genehmigt.' : 'Abgelehnt.');
      if (!r) return;
      closeSheet(true);
      if (approve && r.affected_shifts.length) {
        openSheet('Achtung: Schichten in der Zeit', '<p>Die Person ist in der Zeit noch eingeteilt:</p><ul class="stack">' + r.affected_shifts.map(function (s) {
          return '<li><button type="button" class="btn btn--secondary btn--block" data-act="c-shift-edit" data-id="' + s.id + '" data-date="' + s.date + '">' + esc(dayShort(s.date) + ' ' + s.start + '–' + s.end + (s.label ? ' · ' + s.label : '')) + ' – neu besetzen</button></li>';
        }).join('') + '</ul><div class="sheet__foot"><button type="button" class="btn btn--ghost btn--block" data-close>Später</button></div>');
      }
      await reload();
    },
    'c-invite': async function (f, d, btn) {
      var r = await run(btn, 'chef_invite_create', { note: d.note, expires: d.expires || null }, 'Einladung erstellt.');
      if (r) { await reload(); ACTIONS['c-invite-qr']({ dataset: { code: r.invite.code } }); }
    },
    'c-staff': async function (f, d, btn) {
      var data = { id: +f.dataset.id, active: !!d.active };
      if ('wage' in d) data.wage = d.wage.trim();
      if ('limit' in d) data.limit = d.limit.trim();
      var r = await run(btn, 'chef_staff_update', data, 'Gespeichert.');
      if (r) { closeSheet(true); await reload(); }
    },
    'c-msg': async function (f, d, btn) {
      if (!d.body.trim()) { showFormError(f, 'Bitte erst etwas schreiben.'); return; }
      var r = await run(btn, 'chef_message_send', { staff_id: +f.dataset.staff, body: d.body }, 'Nachricht gesendet.');
      if (r) { await reload(); var t = $view.querySelector('textarea[name=body]'); if (t) t.focus(); }
    },
    'c-board': function (f, d, btn) { return act(btn, 'chef_board_post', { title: d.title, body: d.body }, 'Aushang ist für alle sichtbar.'); },
    'c-minijob': function (f, d, btn) { return act(btn, 'chef_settings_save', { minijob_limit: d.minijob_limit.trim() }, 'Minijob-Grenze gespeichert.'); },
    'c-labels': function (f, d, btn) {
      return act(btn, 'chef_settings_save', { labels: d.labels.split(/\n/).map(function (x) { return x.trim(); }).filter(Boolean) }, 'Bezeichnungen gespeichert.');
    },
    'c-cl': async function (f, d, btn) {
      var id = f.dataset.id ? +f.dataset.id : null;
      var old = id ? app.chef.checklists.filter(function (x) { return x.id === id; })[0] : null;
      var lines = d.items.split(/\n/).map(function (x) { return x.trim(); }).filter(Boolean);
      var used = {};
      var items = lines.map(function (t) {
        var hit = old && old.items.filter(function (i) { return i.text === t && !used[i.id]; })[0];
        if (hit) { used[hit.id] = 1; return { id: hit.id, text: t }; }
        return { text: t };
      });
      var data = { name: d.name, label: d.label, items: items };
      if (id) data.id = id;
      var r = await run(btn, 'chef_checklist_save', data, 'Checkliste gespeichert.');
      if (r) { closeSheet(true); await reload(); }
    },
    'c-cat': async function (f, d, btn) {
      var data = { name: d.name, qty: d.qty, category: d.category };
      if (f.dataset.id) data.id = +f.dataset.id;
      var r = await run(btn, 'chef_catalog_save', data, 'Artikel gespeichert.');
      if (r) { closeSheet(true); await reload(); }
    }
  };

  var CHANGES = {
    'c-module': async function (el) {
      var mods2 = {}; mods2[el.dataset.m] = el.checked;
      var name = MOD_TEXT[el.dataset.m][0];
      var r = await run(null, 'chef_settings_save', { modules: mods2 }, name + (el.checked ? ' ist jetzt an.' : ' ist jetzt aus.'));
      if (r) await reload(); else el.checked = !el.checked;
    },
    'c-setting': async function (el) {
      var data = {}; data[el.dataset.k] = el.checked;
      var r = await run(null, 'chef_settings_save', data, 'Gespeichert.');
      if (r) await reload(); else el.checked = !el.checked;
    }
  };

  document.addEventListener('click', function (e) {
    var closer = e.target.closest('[data-close]');
    if (closer) { e.preventDefault(); closeSheet(); return; }
    var b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    var fn = ACTIONS[b.dataset.act];
    if (fn) { e.preventDefault(); fn(b, e); }
  });
  document.addEventListener('change', function (e) {
    var el = e.target.closest('[data-act-change]');
    if (el && CHANGES[el.dataset.actChange]) CHANGES[el.dataset.actChange](el);
  });
  document.addEventListener('submit', function (e) {
    var f = e.target.closest('form[data-form]');
    if (!f) return;
    e.preventDefault();
    var fn = FORMS[f.dataset.form];
    if (!fn) return;
    var btn = e.submitter || f.querySelector('[type=submit]');
    showFormError(f, '');
    fn(f, formData(f), btn);
  });

  /* ============================================================ Start */

  $toggle.addEventListener('click', function () { go(isChefRoute() ? '#/start' : '#/chef/plan'); });
  document.getElementById('demo-staff').addEventListener('click', function () {
    API.demoLoginAs(1); API.call('status').then(function () { app.data = null; go('#/start'); });
  });
  document.getElementById('demo-chef').addEventListener('click', function () {
    API.demoSetChef(true); API.call('status').then(function () { app.chef = null; go('#/chef/plan'); });
  });
  document.getElementById('demo-reset').addEventListener('click', async function () {
    if (!await ask('Demo zurücksetzen?', 'Alle Änderungen in der Demo gehen verloren.', 'Ja, zurücksetzen', true)) return;
    API.demoReset(); API.demoSetChef(false); await API.call('status');
    app.data = null; app.chef = null; toast('Demo zurückgesetzt.'); go('#/');
  });

  window.addEventListener('hashchange', function () { closeSheet(true); render(); });
  var lastW = window.innerWidth;
  window.addEventListener('resize', function () { if (Math.abs(window.innerWidth - lastW) > 40) { lastW = window.innerWidth; renderNav(isChefRoute() ? 'chef' : (API.me ? 'staff' : 'none')); } });

  // Hintergrund-Aktualisierung (neue Nachrichten, Antworten) – nicht während Eingaben
  setInterval(function () {
    if (document.hidden || sheet || app.loading) return;
    var a = document.activeElement;
    if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
    if ((isChefRoute() && app.chef) || (!isChefRoute() && app.data && API.me)) reload().catch(function () { /* still */ });
  }, 90000);

  API.init({ base: '../cms/team-api.php' }).then(function () {
    app.booted = true;
    render(true);
  }).catch(function (e) {
    $view.innerHTML = '<div class="card notice notice--err" role="alert">' + ico('warn') + '<div><p>' + esc(errMsg(e)) + '</p><button type="button" class="btn btn--secondary" data-act="reload-page">Neu laden</button></div></div>';
  });
  ACTIONS['reload-page'] = function () { location.reload(); };
})();
