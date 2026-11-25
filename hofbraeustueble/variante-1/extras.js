/*!
 * Hofbräustüble – Zusatzfunktionen der Website (identische Kopie in variante-1/ und variante-2/):
 *  - „Diese Woche live bei uns“ (Fußball-Programm aus dem Tippspiel, cms/programm-api.php)
 *  - Getränke- & Speisekarte
 *  - Tisch-Anfrage (keine feste Buchung – der Wirt ruft zurück; cms/gast-api.php)
 *  - Anmeldung zu Veranstaltungen (Platzhalter [data-signup="<id>"] in den Termin-Karten)
 * Jede Funktion lässt sich in der Verwaltung unter „Funktionen“ abschalten (content.features).
 * Das Aussehen steckt in extras.css der jeweiligen Variante. Alle Texte werden mit HBS.escapeHtml ausgegeben.
 *
 * Aufruf aus main.js:  HBSExtras.render(content, { privacyDialog: 'id', title: fn(el, text), onChange: fn })
 */
(function () {
  'use strict';

  var H = window.HBS;
  var esc = H.escapeHtml;
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  var ICONS = {
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
    calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="1.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
    alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v4M12 17.5v.5"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    ball: '<circle cx="12" cy="12" r="9"/><path d="m12 7.2 4 2.9-1.5 4.6h-5L8 10.1z"/><path d="M12 7.2V3.1M16 10.1l3.9-1.3M14.5 14.7l2.4 3.4M9.5 14.7l-2.4 3.4M8 10.1 4.1 8.8"/>',
    minus: '<path d="M5 12h14"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    send: '<path d="M4 12l16-8-6 16-3-7z"/>',
    tv: '<rect x="2.5" y="6" width="19" height="12.5" rx="1.5"/><path d="M8 21.5h8M9 2.5 12 6l3-3.5"/>'
  };
  function icon(n) { return '<svg class="x-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (ICONS[n] || '') + '</svg>'; }

  var C = {}, F = {}, OPTS = {}, uid = 0;
  var PROGRAMM = null;        // geladene Spiele (für das Anlass-Feld der Tisch-Anfrage)
  var SIGNUP = null;          // freie Plätze je Termin (null = unbekannt/Vorschau)
  var PREVIEW = false;        // keine PHP-Schnittstelle erreichbar

  function nid(p) { uid += 1; return (p || 'x') + '-' + uid; }
  function changed() { if (typeof OPTS.onChange === 'function') { try { OPTS.onChange(); } catch (e) { /* egal */ } } }
  function setTitle(el, text) {
    if (!el) return;
    if (typeof OPTS.title === 'function') OPTS.title(el, text); else el.textContent = text;
  }
  function removeSection(id) {
    var sec = document.getElementById(id);
    if (sec) sec.remove();
    $$('a[href="#' + id + '"]').forEach(function (a) { var li = a.closest('li'); (li || a).remove(); });
  }
  function phoneLink(cls) {
    var p = (C.contact || {}).phone;
    return p ? '<a class="' + (cls || 'x-tel') + '" href="' + esc(H.telHref(p)) + '">' + icon('phone') + '<span>' + esc(p) + '</span></a>' : '';
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  /* ================================================================ Programm */

  function renderProgramm() {
    var sec = document.getElementById('live');
    if (!sec) return;
    if (!F.programm) { removeSection('live'); return; }
    var p = C.programm || {};
    setTitle($('#live-title'), p.title || 'Diese Woche live bei uns');
    var txt = $('#live-text');
    if (txt) { if (p.text) txt.textContent = p.text; else txt.remove(); }
    H.programm().then(function (data) {
      if (!data || data.enabled === false || !data.available) { removeSection('live'); changed(); return; }
      PROGRAMM = data.matches || [];
      fillAnlass();
      var list = $('#live-list');
      sec.hidden = false;
      if (!PROGRAMM.length) {
        list.innerHTML = '<p class="x-empty">' + icon('tv') + '<span>In den nächsten Tagen stehen keine Spiele im Kalender. Fragen Sie gern an der Theke nach, was läuft.</span></p>';
        return;
      }
      var now = Date.now();
      var days = [];
      PROGRAMM.forEach(function (m, i) {
        var k = H.formatKickoff(m.kickoff);
        if (!k.iso) return;
        var d = days[days.length - 1];
        if (!d || d.iso !== k.iso) { d = { iso: k.iso, label: k.dayLabel, items: [] }; days.push(d); }
        d.items.push({ m: m, k: k, i: i });
      });
      list.innerHTML = days.map(function (d) {
        return '<div class="x-live-day"><h3 class="x-live-date">' + esc(d.label) + '</h3><ul class="x-live-list">' + d.items.map(function (it) {
          var m = it.m;
          var p2 = it.k.iso.split('-'), t = it.k.time.split(':');
          var start = new Date(+p2[0], +p2[1] - 1, +p2[2], +t[0], +t[1]).getTime();
          var live = start <= now;
          return '<li class="x-live-match' + (live ? ' is-live' : '') + '">' +
            '<span class="x-live-time">' + (live ? '<span class="x-live-badge">Läuft</span>' : '') + esc(it.k.time) + '<small>Uhr</small></span>' +
            '<span class="x-live-teams">' + team(m.home, m.home_logo) + '<span class="x-live-vs" aria-label="gegen">–</span>' + team(m.away, m.away_logo) + '</span>' +
            '<span class="x-live-comp">' + esc(m.competition) + '</span>' +
            (F.reservierung && !live && document.getElementById('reservieren') ? '<button type="button" class="x-btn x-btn--ghost x-live-ask" data-match="' + it.i + '">Tisch anfragen</button>' : '') +
            '</li>';
        }).join('') + '</ul></div>';
      }).join('') + (data.demo ? '<p class="x-note">Beispieldaten der Vorschau</p>' : '');
      list.addEventListener('click', function (e) {
        var b = e.target.closest('[data-match]');
        if (b) askForMatch(PROGRAMM[+b.getAttribute('data-match')]);
      });
    });
  }
  function team(name, logo) {
    var initials = String(name || '').split(/[\s-]+/).filter(Boolean).map(function (w) { return w[0]; }).join('').slice(0, 3).toUpperCase();
    var img = logo && /^cms\/uploads\/logos\/[a-f0-9]{40}\.(png|jpe?g|gif|webp)$/.test(logo)
      ? '<img class="x-logo" src="' + esc(H.asset(logo)) + '" alt="" loading="lazy" decoding="async" width="32" height="32">'
      : '<span class="x-logo x-logo--txt" aria-hidden="true">' + esc(initials) + '</span>';
    return '<span class="x-live-team">' + img + '<span>' + esc(name) + '</span></span>';
  }

  /* ================================================================ Speisekarte */

  function renderMenu() {
    var sec = document.getElementById('karte');
    if (!sec) return;
    var cats = H.menuCategories(C);
    if (!F.speisekarte || !cats.length) { removeSection('karte'); return; }
    var m = C.speisekarte || {};
    sec.hidden = false;
    setTitle($('#menu-title'), m.title || 'Getränke & Speisen');
    var intro = $('#menu-intro');
    if (intro) { if (m.intro) intro.textContent = m.intro; else intro.remove(); }
    $('#menu-list').innerHTML = cats.map(function (cat) {
      return '<section class="x-menu-cat" aria-label="' + esc(cat.name) + '"><h3 class="x-menu-cat-title">' + esc(cat.name) + '</h3>' +
        (cat.note ? '<p class="x-menu-cat-note">' + esc(cat.note) + '</p>' : '') +
        '<ul class="x-menu-list">' + cat.rows.map(function (r) {
          return '<li class="x-menu-row"><div class="x-menu-name"><span class="x-menu-item">' + esc(r.name) + '</span>' +
            (r.badge ? ' <span class="x-badge">' + esc(r.badge) + '</span>' : '') +
            (r.note ? '<span class="x-menu-note">' + esc(r.note) + '</span>' : '') + '</div>' +
            '<span class="x-menu-dots" aria-hidden="true"></span>' +
            '<div class="x-menu-prices">' + r.variants.map(function (v) {
              return '<span class="x-menu-price">' + (v.size ? '<span class="x-menu-size">' + esc(v.size) + '</span>' : '') + '<b>' + esc(v.price) + '</b></span>';
            }).join('') + '</div></li>';
        }).join('') + '</ul></section>';
    }).join('');
    var note = $('#menu-note');
    if (note) { if (m.note) note.textContent = m.note; else note.remove(); }
  }

  /* ================================================================ Formular-Bausteine */

  function fieldHtml(id, label, control, o) {
    o = o || {};
    return '<div class="x-field' + (o.cls ? ' ' + o.cls : '') + '" data-field="' + (o.name || '') + '">' +
      '<label class="x-label" for="' + id + '">' + esc(label) + (o.optional ? ' <span class="x-opt">(freiwillig)</span>' : '') + '</label>' +
      control +
      (o.help ? '<p class="x-help" id="' + id + '-help">' + o.help + '</p>' : '') +
      '<p class="x-error" id="' + id + '-err" role="alert" hidden></p></div>';
  }
  function inputHtml(id, name, type, o) {
    o = o || {};
    return '<input class="x-input" id="' + id + '" name="' + name + '" type="' + type + '"' +
      (o.autocomplete ? ' autocomplete="' + o.autocomplete + '"' : '') + (o.inputmode ? ' inputmode="' + o.inputmode + '"' : '') +
      (o.max ? ' maxlength="' + o.max + '"' : '') + (o.required ? ' required aria-required="true"' : '') +
      (o.placeholder ? ' placeholder="' + esc(o.placeholder) + '"' : '') + (o.help ? ' aria-describedby="' + id + '-help"' : '') + '>';
  }
  function stepperHtml(id, max, value) {
    return '<div class="x-stepper">' +
      '<button type="button" class="x-step" data-step="-1" aria-label="Eine Person weniger" aria-controls="' + id + '">' + icon('minus') + '</button>' +
      '<input class="x-input x-step-input" id="' + id + '" name="persons" type="number" inputmode="numeric" min="1" max="' + max + '" value="' + value + '" required>' +
      '<button type="button" class="x-step" data-step="1" aria-label="Eine Person mehr" aria-controls="' + id + '">' + icon('plus') + '</button></div>';
  }
  function bindStepper(root) {
    root.addEventListener('click', function (e) {
      var b = e.target.closest('.x-step');
      if (!b) return;
      var inp = $('.x-step-input', b.parentNode);
      var max = +inp.max || 99;
      inp.value = String(Math.max(1, Math.min(max, (+inp.value || 1) + +b.getAttribute('data-step'))));
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }
  function honeypotHtml() {
    // Für Menschen unsichtbar, Roboter füllen es aus → wird verworfen
    return '<div class="x-hp" aria-hidden="true"><label>Homepage (bitte leer lassen)<input type="text" name="homepage" tabindex="-1" autocomplete="off" value=""></label></div>';
  }
  function privacyHtml(id, settings, extraSentence) {
    return '<div class="x-privacy">' +
      '<p class="x-privacy-text">' + icon('info') + '<span>' + esc(settings.privacyText || '') + (extraSentence ? ' ' + esc(extraSentence) : '') +
      ' <a href="#datenschutz" class="x-privacy-link">Datenschutzerklärung lesen</a></span></p>' +
      '<div class="x-field x-field--check" data-field="consent"><label class="x-check" for="' + id + '"><input type="checkbox" id="' + id + '" name="consent" required aria-required="true">' +
      '<span class="x-check-box" aria-hidden="true">' + icon('check') + '</span><span>' + esc(settings.consentText) + '</span></label>' +
      '<p class="x-error" id="' + id + '-err" role="alert" hidden></p></div></div>';
  }
  function bindPrivacyLinks(root) {
    root.addEventListener('click', function (e) {
      var a = e.target.closest('.x-privacy-link');
      if (!a) return;
      var dlg = OPTS.privacyDialog && document.getElementById(OPTS.privacyDialog);
      if (!dlg || typeof dlg.showModal !== 'function') return; // normaler Link (#datenschutz)
      e.preventDefault();
      dlg.showModal();
    });
  }

  function clearErrors(form) {
    $$('.x-error', form).forEach(function (p) { p.hidden = true; p.textContent = ''; });
    $$('[aria-invalid]', form).forEach(function (el) { el.removeAttribute('aria-invalid'); });
    var sum = $('.x-form-msg', form);
    if (sum) { sum.hidden = true; sum.className = 'x-form-msg'; sum.innerHTML = ''; }
  }
  function fieldError(form, name, msg) {
    var wrap = $('[data-field="' + name + '"]', form);
    if (!wrap) return false;
    var err = $('.x-error', wrap), inp = $('input, select, textarea', wrap);
    err.textContent = msg; err.hidden = false;
    if (inp) {
      inp.setAttribute('aria-invalid', 'true');
      var d = (inp.getAttribute('aria-describedby') || '').split(' ').filter(Boolean);
      if (d.indexOf(err.id) < 0) d.push(err.id);
      inp.setAttribute('aria-describedby', d.join(' '));
    }
    return true;
  }
  function formMessage(form, type, html) {
    var box = $('.x-form-msg', form);
    box.className = 'x-form-msg x-form-msg--' + type;
    box.innerHTML = icon(type === 'error' ? 'alert' : 'info') + '<div>' + html + '</div>';
    box.hidden = false;
    box.setAttribute('role', type === 'error' ? 'alert' : 'status');
    if (box.scrollIntoView) box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  function previewHtml() {
    return '<strong>Vorschau:</strong> In der Vorschau werden keine Anfragen verschickt. Auf der fertigen Website kommt Ihre Nachricht direkt bei uns an.';
  }
  function focusFirstInvalid(form) {
    var el = $('[aria-invalid="true"]', form);
    if (el) el.focus();
  }
  /** Gemeinsame Prüfung (gleiche Regeln wie der Server) */
  function checkPerson(form, data) {
    var ok = true;
    if (String(data.name || '').trim().length < 2) { fieldError(form, 'name', 'Bitte Ihren Namen eingeben.'); ok = false; }
    var digits = String(data.phone || '').replace(/\D/g, '').length;
    if (!data.phone) { fieldError(form, 'phone', 'Bitte Ihre Telefonnummer eingeben – wir rufen Sie zurück.'); ok = false; }
    else if (digits < 6 || !/^[0-9+()\/\-. ]+$/.test(data.phone)) { fieldError(form, 'phone', 'Bitte eine gültige Telefonnummer eingeben (nur Ziffern, Leerzeichen, + / -).'); ok = false; }
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) { fieldError(form, 'email', 'Die E-Mail-Adresse stimmt nicht. Sie können das Feld auch leer lassen.'); ok = false; }
    if (!data.persons || data.persons < 1) { fieldError(form, 'persons', 'Bitte die Anzahl der Personen angeben.'); ok = false; }
    if (!data.consent) { fieldError(form, 'consent', 'Bitte setzen Sie hier das Häkchen.'); ok = false; }
    return ok;
  }
  function setBusy(btn, busy, label) {
    btn.disabled = busy;
    btn.setAttribute('aria-busy', busy ? 'true' : 'false');
    $('.x-btn-label', btn).textContent = busy ? 'Wird gesendet …' : label;
  }
  /** Absenden inkl. Formular-Zeitstempel; bei abgelaufenem Stempel einmal neu holen. */
  function send(action, payload, state) {
    function go() {
      payload.token = state.token || '';
      return H.gast(action, payload);
    }
    return go().catch(function (err) {
      if (err && err.code === 'token') {
        return H.gastToken().then(function (t) { state.token = t; state.tokenAt = Date.now(); throw err; }, function () { throw err; });
      }
      throw err;
    });
  }
  function newState() {
    var st = { token: '', tokenAt: 0 };
    H.gastToken().then(function (t) { st.token = t; st.tokenAt = Date.now(); }, function (e) { if (e && e.preview) PREVIEW = true; });
    return st;
  }

  /* ================================================================ Tisch-Anfrage */

  var RES = null; // { form, state }

  function renderReservation() {
    var sec = document.getElementById('reservieren');
    if (!sec) return;
    if (!F.reservierung) { removeSection('reservieren'); return; }
    var s = H.reservationSettings(C);
    sec.hidden = false;
    setTitle($('#reserve-title'), s.title || 'Tisch anfragen');
    var text = $('#reserve-text');
    if (text) { if (s.text) text.innerHTML = H.paragraphs(s.text); else text.remove(); }
    var call = $('#reserve-call');
    if (call) { var pl = phoneLink('x-btn x-btn--ghost x-call'); if (pl) call.innerHTML = '<p class="x-call-label">Lieber gleich anrufen?</p>' + pl; else call.remove(); }
    buildReservationForm();
  }

  function buildReservationForm() {
    var card = $('#reserve-card');
    var s = H.reservationSettings(C);
    var days = H.reservationDays(C);
    if (!days.length) {
      card.innerHTML = '<div class="x-done"><p>' + icon('info') + 'Zurzeit sind keine Anfragen über die Website möglich.</p>' + phoneLink('x-btn x-btn--primary') + '</div>';
      return;
    }
    var ids = { day: nid('r-day'), time: nid('r-time'), persons: nid('r-pers'), name: nid('r-name'), phone: nid('r-phone'), email: nid('r-mail'), anlass: nid('r-anlass'), note: nid('r-note'), consent: nid('r-consent') };
    var max = Math.max(1, +s.maxPersons || 12);
    var tel = (C.contact || {}).phone;
    card.innerHTML = '<form class="x-form" novalidate>' +
      '<div class="x-form-msg" hidden></div>' +
      '<fieldset class="x-fs"><legend class="x-legend">' + icon('calendar') + 'Wann möchten Sie kommen?</legend><div class="x-row">' +
        fieldHtml(ids.day, 'Tag', '<select class="x-input" id="' + ids.day + '" name="date" required>' + days.map(function (d) { return '<option value="' + d.iso + '">' + esc(d.label) + '</option>'; }).join('') + '</select>', { name: 'date' }) +
        fieldHtml(ids.time, 'Uhrzeit', '<select class="x-input" id="' + ids.time + '" name="time" required></select>', { name: 'time' }) +
      '</div></fieldset>' +
      '<fieldset class="x-fs"><legend class="x-legend">' + icon('users') + 'Wie viele Personen?</legend>' +
        fieldHtml(ids.persons, 'Personen', stepperHtml(ids.persons, max, Math.min(2, max)), { name: 'persons', help: 'Mehr als ' + max + ' Personen? Bitte rufen Sie uns an' + (tel ? ': ' + esc(tel) : '') + '.' }) +
      '</fieldset>' +
      '<fieldset class="x-fs"><legend class="x-legend">' + icon('phone') + 'Wie erreichen wir Sie?</legend>' +
        fieldHtml(ids.name, 'Ihr Name', inputHtml(ids.name, 'name', 'text', { autocomplete: 'name', max: 80, required: true }), { name: 'name' }) +
        fieldHtml(ids.phone, 'Telefonnummer', inputHtml(ids.phone, 'phone', 'tel', { autocomplete: 'tel', inputmode: 'tel', max: 30, required: true, help: true }), { name: 'phone', help: 'Wir rufen Sie zurück, um den Tisch zu bestätigen.' }) +
        fieldHtml(ids.email, 'E-Mail', inputHtml(ids.email, 'email', 'email', { autocomplete: 'email', max: 150 }), { name: 'email', optional: true }) +
      '</fieldset>' +
      '<fieldset class="x-fs"><legend class="x-legend">' + icon('ball') + 'Noch etwas? <span class="x-opt">(freiwillig)</span></legend>' +
        fieldHtml(ids.anlass, 'Zum Fußballspiel', '<select class="x-input" id="' + ids.anlass + '" name="anlass"><option value="">– kein bestimmtes Spiel –</option></select>', { name: 'anlass', cls: 'x-anlass', optional: true }) +
        fieldHtml(ids.note, 'Nachricht', '<textarea class="x-input" id="' + ids.note + '" name="note" rows="3" maxlength="500" placeholder="z. B. Geburtstag, Stammtisch, Platz am Fernseher …"></textarea>', { name: 'note', optional: true }) +
      '</fieldset>' +
      honeypotHtml() +
      privacyHtml(ids.consent, s, 'Wir löschen die Anfrage automatisch ' + (+s.deleteAfterDays || 30) + ' Tage nach dem Termin.') +
      '<button type="submit" class="x-btn x-btn--primary x-submit">' + icon('send') + '<span class="x-btn-label">Anfrage senden</span></button>' +
      '<p class="x-small">Das ist noch keine feste Reservierung – wir melden uns telefonisch.</p>' +
      '</form>';
    var form = $('form', card);
    var state = newState();
    RES = { form: form, state: state, ids: ids };
    var daySel = $('#' + ids.day), timeSel = $('#' + ids.time);
    function fillTimes(prefer) {
      var d = days.filter(function (x) { return x.iso === daySel.value; })[0] || days[0];
      var keep = prefer || timeSel.value;
      timeSel.innerHTML = d.times.map(function (t) { return '<option value="' + t + '">' + t + ' Uhr</option>'; }).join('');
      if (keep && d.times.indexOf(keep) >= 0) timeSel.value = keep;
      else if (!prefer) { var def = d.times.indexOf('19:00') >= 0 ? '19:00' : d.times[Math.min(d.times.length - 1, 4)]; timeSel.value = def; }
      fillAnlass();
    }
    RES.fillTimes = fillTimes;
    RES.days = days;
    daySel.addEventListener('change', function () { fillTimes(); });
    fillTimes();
    bindStepper(form);
    bindPrivacyLinks(form);
    form.addEventListener('input', function (e) {
      var w = e.target.closest('[data-field]');
      if (w && e.target.getAttribute('aria-invalid')) { e.target.removeAttribute('aria-invalid'); var er = $('.x-error', w); if (er) er.hidden = true; }
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      submitReservation(form, state, s);
    });
  }

  /** Spiele des gewählten Tages als Auswahl „Zum Fußballspiel“ (nur wenn das Programm Spiele kennt) */
  function fillAnlass() {
    if (!RES) return;
    var sel = $('#' + RES.ids.anlass), wrap = sel && sel.closest('.x-field');
    if (!sel) return;
    var day = $('#' + RES.ids.day).value;
    var games = (PROGRAMM || []).filter(function (m) { return H.formatKickoff(m.kickoff).iso === day; });
    var keep = sel.value;
    sel.innerHTML = '<option value="">– kein bestimmtes Spiel –</option>' + games.map(function (m) {
      var v = H.formatKickoff(m.kickoff).time + ' Uhr: ' + m.home + ' – ' + m.away;
      return '<option value="' + esc(v) + '">' + esc(v) + '</option>';
    }).join('');
    if (keep) sel.value = keep;
    wrap.hidden = !games.length;
  }

  function askForMatch(m) {
    if (!RES || !m) return;
    var k = H.formatKickoff(m.kickoff);
    var day = RES.days.filter(function (d) { return d.iso === k.iso; })[0];
    var sec = document.getElementById('reservieren');
    if (day) {
      $('#' + RES.ids.day).value = day.iso;
      // Uhrzeit: 30 Minuten vor Anstoß (oder die letzte mögliche davor)
      var target = k.time.split(':'), tmin = +target[0] * 60 + +target[1] - 30;
      var best = day.times.filter(function (t) { var p = t.split(':'); return +p[0] * 60 + +p[1] <= tmin; }).pop() || day.times[0];
      RES.fillTimes(best);
      var v = k.time + ' Uhr: ' + m.home + ' – ' + m.away;
      var sel = $('#' + RES.ids.anlass);
      if (sel) sel.value = v;
    }
    if (sec && sec.scrollIntoView) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(function () { var n = $('#' + RES.ids.name); if (n) n.focus({ preventScroll: true }); }, 450);
  }

  function readForm(form) {
    var g = function (n) { var el = form.elements[n]; return el ? String(el.value || '').trim() : ''; };
    return {
      name: g('name'), phone: g('phone'), email: g('email'), date: g('date'), time: g('time'),
      persons: parseInt(g('persons'), 10) || 0, note: g('note'), anlass: g('anlass'),
      consent: !!(form.elements.consent && form.elements.consent.checked),
      homepage: form.elements.homepage ? form.elements.homepage.value : ''
    };
  }

  function submitReservation(form, state, s) {
    clearErrors(form);
    var data = readForm(form);
    var ok = checkPerson(form, data);
    if (!data.date) { fieldError(form, 'date', 'Bitte einen Tag wählen.'); ok = false; }
    if (!data.time) { fieldError(form, 'time', 'Bitte eine Uhrzeit wählen.'); ok = false; }
    var max = +s.maxPersons || 12;
    if (data.persons > max) { fieldError(form, 'persons', 'Für mehr als ' + max + ' Personen rufen Sie uns bitte an.'); ok = false; }
    if (!ok) { formMessage(form, 'error', 'Bitte prüfen Sie die rot markierten Felder.'); focusFirstInvalid(form); return; }
    var btn = $('.x-submit', form);
    if (PREVIEW) { formMessage(form, 'info', previewHtml()); return; }
    setBusy(btn, true, 'Anfrage senden');
    send('reservieren', data, state).then(function () {
      showReservationDone(data, s);
    }, function (err) {
      setBusy(btn, false, 'Anfrage senden');
      if (err && err.preview) { PREVIEW = true; formMessage(form, 'info', previewHtml()); return; }
      if (err && err.field && fieldError(form, err.field, err.message)) { formMessage(form, 'error', esc(err.message)); focusFirstInvalid(form); return; }
      formMessage(form, 'error', esc((err && err.message) || 'Das hat leider nicht geklappt.') + (err && err.code === 'token' ? '' : '<br>' + phoneLink()));
    });
  }

  function showReservationDone(data, s) {
    var card = $('#reserve-card');
    var f = H.formatDate(data.date);
    var tel = (C.contact || {}).phone;
    card.innerHTML = '<div class="x-done" tabindex="-1" role="status">' +
      '<span class="x-done-icon" aria-hidden="true">' + icon('check') + '</span>' +
      '<h3 class="x-done-title">Anfrage gesendet!</h3>' +
      '<p class="x-done-big">Wir melden uns telefonisch.</p>' +
      '<dl class="x-summary"><div><dt>Tag</dt><dd>' + esc(f.long) + '</dd></div><div><dt>Uhrzeit</dt><dd>' + esc(data.time) + ' Uhr</dd></div>' +
      '<div><dt>Personen</dt><dd>' + esc(String(data.persons)) + '</dd></div><div><dt>Rückruf an</dt><dd>' + esc(data.phone) + '</dd></div></dl>' +
      '<p>' + esc(s.successText || 'Vielen Dank! Wir rufen Sie zurück – erst dann ist der Tisch fest reserviert.') + '</p>' +
      (tel ? '<p class="x-small">Fragen? Rufen Sie uns an: <a href="' + esc(H.telHref(tel)) + '">' + esc(tel) + '</a></p>' : '') +
      '<button type="button" class="x-btn x-btn--ghost x-again">Weitere Anfrage stellen</button></div>';
    var done = $('.x-done', card);
    done.focus({ preventScroll: true });
    if (done.scrollIntoView) done.scrollIntoView({ block: 'center', behavior: 'smooth' });
    $('.x-again', card).addEventListener('click', function () { buildReservationForm(); var n = $('#reserve-card select'); if (n) n.focus(); });
  }

  /* ================================================================ Anmeldung zu Terminen */

  var DLG = null;

  function eventById(id) {
    return (C.events || []).filter(function (e) { return e && e.id === id; })[0] || null;
  }

  function initSignups() {
    var slots = $$('[data-signup]');
    if (!slots.length) return;
    if (!F.anmeldung) { slots.forEach(function (s) { s.remove(); }); return; }
    var any = false;
    slots.forEach(function (slot) {
      var ev = eventById(slot.getAttribute('data-signup'));
      if (!ev || !H.signupEnabled(C, ev)) { slot.remove(); return; }
      any = true;
      var card = slot.closest('[data-event-id]');
      if (card) card.classList.add('has-signup');
      renderSlot(slot, ev, undefined);
    });
    if (!any) return;
    H.signupStatus().then(function (st) {
      SIGNUP = st;
      $$('[data-signup]').forEach(function (slot) {
        var ev = eventById(slot.getAttribute('data-signup'));
        if (ev) renderSlot(slot, ev, st ? (st[ev.id] || null) : null);
      });
    });
  }

  /** st: undefined = lädt, null = unbekannt (Vorschau), sonst {max, taken, free, open, reason} */
  function renderSlot(slot, ev, st) {
    var html = '', canSign = true, cls = 'x-signup';
    var dl = ev.signupDeadline ? H.formatDate(ev.signupDeadline) : null;
    if (st && !st.open) {
      canSign = false;
      if (st.reason === 'ausgebucht') { cls += ' is-full'; html = '<p class="x-signup-state"><span class="x-pill x-pill--full">Ausgebucht</span></p>' + ((C.contact || {}).phone ? '<p class="x-signup-sub">Fragen Sie gern nach freien Restplätzen: ' + phoneLink('x-tel-inline') + '</p>' : ''); }
      else { cls += ' is-closed'; html = '<p class="x-signup-state"><span class="x-pill x-pill--closed">Anmeldung geschlossen</span></p><p class="x-signup-sub">' + esc(st.reason || '') + '</p>'; }
    } else {
      var line = 'Anmeldung möglich';
      if (st && st.max > 0 && typeof st.free === 'number') {
        line = st.free <= 5 ? 'Nur noch ' + plural(st.free, 'Platz', 'Plätze') + ' frei!' : 'Noch ' + plural(st.free, 'Platz', 'Plätze') + ' frei';
        if (st.free <= 5) cls += ' is-few';
      }
      html = '<p class="x-signup-state"><span class="x-pill x-pill--open">' + esc(line) + '</span>' + (dl ? '<span class="x-signup-sub">Anmeldung bis ' + esc(dl.day + '. ' + dl.monthLong) + '</span>' : '') + '</p>';
    }
    slot.className = cls;
    slot.innerHTML = html + (canSign ? '<button type="button" class="x-btn x-btn--primary x-signup-btn" aria-label="Anmelden: ' + esc(ev.title) + '">' + icon('users') + '<span>Anmelden</span></button>' : '');
    var b = $('.x-signup-btn', slot);
    if (b) b.addEventListener('click', function (e) { e.stopPropagation(); openSignup(ev, b); });
    slot.addEventListener('click', function (e) { e.stopPropagation(); }); // Flip-Karten nicht umdrehen
  }

  function ensureDialog() {
    if (DLG) return DLG;
    DLG = document.createElement('dialog');
    DLG.className = 'x-dialog';
    DLG.setAttribute('aria-labelledby', 'x-dlg-title');
    DLG.innerHTML = '<div class="x-dialog-inner"><div class="x-dialog-head"><h2 class="x-dialog-title" id="x-dlg-title">Anmelden</h2>' +
      '<button type="button" class="x-dialog-close" aria-label="Schließen">' + icon('close') + '</button></div><div class="x-dialog-body"></div></div>';
    document.body.appendChild(DLG);
    $('.x-dialog-close', DLG).addEventListener('click', function () { DLG.close(); });
    DLG.addEventListener('click', function (e) { if (e.target === DLG) DLG.close(); });
    DLG.addEventListener('close', function () {
      document.body.classList.remove('is-locked', 'x-locked');
      if (DLG._opener && document.contains(DLG._opener)) DLG._opener.focus({ preventScroll: true });
    });
    return DLG;
  }

  function openSignup(ev, opener) {
    var dlg = ensureDialog();
    dlg._opener = opener;
    var s = H.signupSettings(C);
    var st = SIGNUP && SIGNUP[ev.id];
    var max = Math.max(1, +s.maxPersons || 6);
    if (st && st.max > 0 && typeof st.free === 'number') max = Math.max(1, Math.min(max, st.free));
    var f = H.formatDate(ev.date);
    var ids = { persons: nid('a-pers'), name: nid('a-name'), phone: nid('a-phone'), consent: nid('a-consent') };
    $('.x-dialog-title', dlg).textContent = 'Anmelden';
    $('.x-dialog-body', dlg).innerHTML =
      '<div class="x-ev-info"><p class="x-ev-title">' + esc(ev.title) + '</p><p class="x-ev-when">' + icon('calendar') + esc(f.long) + (ev.time ? ', ' + esc(ev.time) + ' Uhr' : '') + '</p>' +
      (ev.signupNote ? '<p class="x-ev-note">' + esc(ev.signupNote) + '</p>' : '') +
      (st && st.max > 0 && typeof st.free === 'number' ? '<p class="x-ev-free">Noch ' + plural(st.free, 'Platz', 'Plätze') + ' frei</p>' : '') + '</div>' +
      '<form class="x-form" novalidate><div class="x-form-msg" hidden></div>' +
      fieldHtml(ids.name, 'Ihr Name', inputHtml(ids.name, 'name', 'text', { autocomplete: 'name', max: 80, required: true }), { name: 'name' }) +
      fieldHtml(ids.phone, 'Telefonnummer', inputHtml(ids.phone, 'phone', 'tel', { autocomplete: 'tel', inputmode: 'tel', max: 30, required: true, help: true }), { name: 'phone', help: 'Nur für Rückfragen, falls sich etwas ändert.' }) +
      fieldHtml(ids.persons, 'Wie viele Personen?', stepperHtml(ids.persons, max, 1), { name: 'persons', help: 'Höchstens ' + max + ' Person' + (max === 1 ? '' : 'en') + ' pro Anmeldung.' }) +
      honeypotHtml() +
      privacyHtml(ids.consent, s, 'Wir löschen die Anmeldung automatisch eine Woche nach der Veranstaltung.') +
      '<button type="submit" class="x-btn x-btn--primary x-submit">' + icon('check') + '<span class="x-btn-label">Verbindlich anmelden</span></button>' +
      '</form>';
    var form = $('form', dlg);
    var state = newState();
    bindStepper(form);
    bindPrivacyLinks(form);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearErrors(form);
      var data = readForm(form);
      data.event = ev.id;
      var ok = checkPerson(form, data);
      if (data.persons > max) { fieldError(form, 'persons', 'Höchstens ' + max + ' Person' + (max === 1 ? '' : 'en') + '.'); ok = false; }
      if (!ok) { formMessage(form, 'error', 'Bitte prüfen Sie die rot markierten Felder.'); focusFirstInvalid(form); return; }
      if (PREVIEW) { formMessage(form, 'info', previewHtml()); return; }
      var btn = $('.x-submit', form);
      setBusy(btn, true, 'Verbindlich anmelden');
      send('anmelden', { event: data.event, name: data.name, phone: data.phone, persons: data.persons, consent: data.consent, homepage: data.homepage }, state).then(function (r) {
        showSignupDone(ev, data, s);
        refreshSlot(ev);
      }, function (err) {
        setBusy(btn, false, 'Verbindlich anmelden');
        if (err && err.preview) { PREVIEW = true; formMessage(form, 'info', previewHtml()); return; }
        if (err && (err.code === 'full' || err.code === 'few' || err.code === 'closed')) refreshSlot(ev);
        if (err && err.field && fieldError(form, err.field, err.message)) { formMessage(form, 'error', esc(err.message)); focusFirstInvalid(form); return; }
        formMessage(form, 'error', esc((err && err.message) || 'Das hat leider nicht geklappt.'));
      });
    });
    document.body.classList.add('x-locked');
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    setTimeout(function () { var n = $('#' + ids.name); if (n) n.focus(); }, 60);
  }

  function showSignupDone(ev, data, s) {
    var f = H.formatDate(ev.date);
    $('.x-dialog-title', DLG).textContent = 'Angemeldet!';
    $('.x-dialog-body', DLG).innerHTML = '<div class="x-done" tabindex="-1" role="status">' +
      '<span class="x-done-icon" aria-hidden="true">' + icon('check') + '</span>' +
      '<h3 class="x-done-title">Sie sind angemeldet!</h3>' +
      '<dl class="x-summary"><div><dt>Veranstaltung</dt><dd>' + esc(ev.title) + '</dd></div><div><dt>Wann</dt><dd>' + esc(f.long) + (ev.time ? ', ' + esc(ev.time) + ' Uhr' : '') + '</dd></div>' +
      '<div><dt>Personen</dt><dd>' + esc(String(data.persons)) + '</dd></div><div><dt>Name</dt><dd>' + esc(data.name) + '</dd></div></dl>' +
      '<p>' + esc(s.successText || 'Danke, wir freuen uns auf Sie!') + '</p>' +
      '<button type="button" class="x-btn x-btn--primary x-close-done">Fertig</button></div>';
    var done = $('.x-done', DLG);
    done.focus();
    $('.x-close-done', DLG).addEventListener('click', function () { DLG.close(); });
  }

  function refreshSlot(ev) {
    H.signupStatus().then(function (st) {
      if (!st) return;
      SIGNUP = st;
      $$('[data-signup="' + ev.id + '"]').forEach(function (slot) { renderSlot(slot, ev, st[ev.id] || null); });
    });
  }

  /* ================================================================ Start */

  function render(content, opts) {
    C = content || {};
    OPTS = opts || {};
    F = H.applyFeatures(C);
    [renderMenu, renderReservation, renderProgramm, initSignups].forEach(function (fn) {
      try { fn(); } catch (e) { if (window.console) console.error('[Extras]', fn.name, e); }
    });
  }

  window.HBSExtras = { render: render };
})();
