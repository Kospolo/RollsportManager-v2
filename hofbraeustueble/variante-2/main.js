/*!
 * Hofbräustüble – Variante 2 „Anpfiff"
 * Rendert alle Inhalte aus cms/content.json (via HBS-Loader) und steuert
 * die 3D-Effekte (Hero-Schriftzug, Prisma-Galerie, Flip-Karten, Scroll-Perspektive).
 */
(function () {
  'use strict';

  var H = window.HBS;
  var esc = H.escapeHtml;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var mqReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var reduced = mqReduced.matches;
  var mqFine = window.matchMedia('(hover: hover) and (pointer: fine)');
  var mqNarrow = window.matchMedia('(max-width: 640px)');
  var DAY_ABBR = { montag: 'Mo', dienstag: 'Di', mittwoch: 'Mi', donnerstag: 'Do', freitag: 'Fr', samstag: 'Sa', sonntag: 'So' };
  var DAY_SCHEMA = { montag: 'Monday', dienstag: 'Tuesday', mittwoch: 'Wednesday', donnerstag: 'Thursday', freitag: 'Friday', samstag: 'Saturday', sonntag: 'Sunday' };
  var C = null; // Content

  function onMQ(mq, fn) { if (mq.addEventListener) mq.addEventListener('change', fn); else if (mq.addListener) mq.addListener(fn); }
  onMQ(mqReduced, function (e) { reduced = e.matches; });

  function pad(n) { return String(n).padStart(2, '0'); }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function icon(id, cls) { return '<svg class="' + (cls || 'ico') + '" aria-hidden="true"><use href="#i-' + id + '"/></svg>'; }

  /* ------------------------------------------------------------------ */
  /* Laden                                                               */
  /* ------------------------------------------------------------------ */
  H.load().then(function (content) {
    C = content || {};
    render();
  }).catch(function (err) {
    document.body.classList.remove('is-loading');
    var main = $('#main');
    main.innerHTML = '<div class="load-error" role="alert"><strong>Kurze Spielunterbrechung</strong>Die Inhalte konnten gerade nicht geladen werden. Bitte lade die Seite in einem Moment neu.</div>';
    if (window.console) console.warn('Inhalte konnten nicht geladen werden:', err);
  });

  // Gemeinsamer Schalter „Bewegung anhalten“ (cms-loader.js); Fallback für ältere Loader
  var M = H.motion || { paused: function () { return false; }, still: function () { return reduced; }, set: function () {}, onChange: function () {} };
  function still() { return reduced || M.paused(); }

  function render() {
    var steps = [setMeta, renderBanner, renderHero, renderAbout, renderEvents, renderTippspiel, renderHours, renderSummer,
      renderGallery, renderContact, renderFooter, renderLegal, renderExtras, buildNav];
    steps.forEach(function (fn) {
      try { fn(); } catch (e) { if (window.console) console.warn('Render-Fehler in ' + fn.name, e); }
    });
    document.body.classList.remove('is-loading');
    initNav();
    initDialogs();
    initMotion();
    initTicker();
    initFixturesMore();
    initFlipCards();
    initTippBoard();
    initPrism();
    initTilts();
    initScroll3D();
    initHero3D();
    tick();
    setInterval(tick, 1000);
  }

  /* ------------------------------------------------------------------ */
  /* SEO / Meta                                                          */
  /* ------------------------------------------------------------------ */
  function setMetaTag(attr, key, val) {
    if (!val) return;
    var el = document.head.querySelector('meta[' + attr + '="' + key + '"]');
    if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
    el.setAttribute('content', val);
  }
  function absUrl(p) { try { return new URL(H.asset(p), location.href).href; } catch (e) { return p; } }

  function setMeta() {
    var m = C.meta || {};
    var name = m.siteName || (C.hero && C.hero.title) || '';
    var title = name + (m.tagline ? ' – ' + m.tagline : '');
    document.title = title;
    setMetaTag('name', 'description', m.seoDescription);
    setMetaTag('property', 'og:site_name', name);
    setMetaTag('property', 'og:title', title);
    setMetaTag('property', 'og:description', m.seoDescription);
    setMetaTag('property', 'og:url', location.href.split('#')[0]);
    var img = (C.hero && C.hero.image) || (C.gallery && C.gallery[0] && C.gallery[0].src);
    if (img) setMetaTag('property', 'og:image', absUrl(img));

    var c = C.contact || {};
    var ld = {
      '@context': 'https://schema.org',
      '@type': 'BarOrPub',
      name: name,
      description: m.seoDescription || undefined,
      url: location.href.split('#')[0],
      image: (C.gallery || []).map(function (g) { return absUrl(g.src); }).filter(Boolean),
      telephone: c.phone || undefined,
      email: c.email || undefined,
      smokingAllowed: true,
      address: {
        '@type': 'PostalAddress', streetAddress: c.street || undefined, postalCode: c.zip || undefined,
        addressLocality: [c.city, c.district].filter(Boolean).join('-') || undefined, addressCountry: 'DE'
      },
      hasMap: c.mapsUrl || undefined,
      openingHoursSpecification: (C.openingHours || []).map(function (d) {
        var r = parseRange(d.hours), day = DAY_SCHEMA[String(d.day || '').toLowerCase()];
        if (!r || !day) return null;
        return { '@type': 'OpeningHoursSpecification', dayOfWeek: 'https://schema.org/' + day, opens: r.openStr, closes: r.closeStr === '24:00' ? '23:59' : r.closeStr };
      }).filter(Boolean),
      sameAs: [C.social && C.social.facebook, C.social && C.social.instagram].filter(Boolean),
      event: H.upcomingEvents(C).map(function (e) {
        return {
          '@type': 'Event', name: e.title, description: e.description || undefined,
          startDate: e.date + (e.time ? 'T' + e.time : ''), eventStatus: 'https://schema.org/EventScheduled',
          eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
          location: { '@type': 'Place', name: name, address: H.fullAddress(c) },
          image: e.image ? absUrl(e.image) : undefined
        };
      })
    };
    var s = document.createElement('script');
    s.type = 'application/ld+json';
    s.textContent = JSON.stringify(ld).replace(/</g, '\\u003c');
    document.head.appendChild(s);
  }

  /* ------------------------------------------------------------------ */
  /* Öffnungszeiten-Logik                                               */
  /* ------------------------------------------------------------------ */
  // "16:00 – 01:00" -> { s: 960, e: 1500, openStr, closeStr } ; "Ruhetag" -> null
  function parseRange(str) {
    var m = String(str || '').match(/(\d{1,2})[:.](\d{2})\s*(?:-|–|—|bis)\s*(\d{1,2})[:.](\d{2})/i);
    if (!m) return null;
    var s = (+m[1]) * 60 + (+m[2]);
    var e = (+m[3]) * 60 + (+m[4]);
    if (e <= s) e += 1440; // über Mitternacht (z. B. 16:00 – 01:00 oder 18:00 – 00:00)
    return { s: s, e: e, openStr: pad(m[1]) + ':' + m[2], closeStr: pad(m[3]) + ':' + m[4] };
  }

  function hoursStatus(now) {
    var list = C.openingHours || [];
    if (!list.length) return null;
    now = now || new Date();
    var idx = (now.getDay() + 6) % 7;
    var mins = now.getHours() * 60 + now.getMinutes();
    var today = list[idx] ? parseRange(list[idx].hours) : null;
    var yIdx = (idx + 6) % 7;
    var yest = list[yIdx] ? parseRange(list[yIdx].hours) : null;

    if (today && mins >= today.s && mins < today.e) return { open: true, until: today.closeStr };
    if (yest && yest.e > 1440 && mins < yest.e - 1440) return { open: true, until: yest.closeStr };
    if (today && mins < today.s) return { open: false, nextLabel: 'heute', at: today.openStr };
    for (var k = 1; k <= 7; k++) {
      var j = (idx + k) % 7;
      var r = list[j] ? parseRange(list[j].hours) : null;
      if (r) return { open: false, nextLabel: k === 1 ? 'morgen' : (list[j].day || ''), at: r.openStr };
    }
    return { open: false };
  }

  /* ------------------------------------------------------------------ */
  /* Banner (Laufband)                                                   */
  /* ------------------------------------------------------------------ */
  function renderBanner() {
    var b = C.banner || {};
    var el = $('#ticker');
    if (!b.enabled || !b.text) { el.hidden = true; return; }
    el.hidden = false;
    $('#tickerSr').textContent = b.text;
    var item = '<span class="ticker-item">' + esc(b.text) + '</span>';
    var html = '';
    for (var i = 0; i < 8; i++) html += item;
    $('#tickerTrack').innerHTML = html;
  }

  /* „Bewegung anhalten“ (Knopf im Hero): hält Laufband, Flutlicht, Schriftzug-Schwenk und Prisma an */
  function initMotion() {
    var btn = $('#motionBtn');
    if (!btn) return;
    if (reduced || !H.motion) { btn.hidden = true; return; }
    function sync(p) {
      btn.setAttribute('data-paused', String(p));
      $('span', btn).textContent = p ? 'Bewegung fortsetzen' : 'Bewegung anhalten';
    }
    btn.hidden = false;
    sync(M.paused());
    btn.addEventListener('click', function () { M.set(!M.paused()); });
    M.onChange(sync);
  }

  /* Laufband: Pause-Knopf und Tippen aufs Band (WCAG 2.2.2) – nicht nur beim Darüberfahren mit der Maus */
  function initTicker() {
    var tk = $('#ticker'), btn = $('#tickerPause');
    if (!tk || tk.hidden || !btn) return;
    function set(p) {
      tk.classList.toggle('is-paused', p);
      $('#tickerPauseText').textContent = p ? 'Weiter' : 'Anhalten';
      btn.setAttribute('aria-label', p ? 'Laufband weiterlaufen lassen' : 'Laufband anhalten');
    }
    set(M.paused());
    tk.addEventListener('click', function () { if (!reduced) set(!tk.classList.contains('is-paused')); });
    M.onChange(function (p) { set(p); });
  }

  /* ------------------------------------------------------------------ */
  /* Hero                                                                */
  /* ------------------------------------------------------------------ */
  function splitTitle(t) {
    t = String(t || '').trim();
    if (/\s/.test(t)) {
      var words = t.split(/\s+/), best = 1, bestDiff = 1e9;
      for (var i = 1; i < words.length; i++) {
        var a = words.slice(0, i).join(' ').length, b = words.slice(i).join(' ').length;
        if (Math.abs(a - b) < bestDiff) { bestDiff = Math.abs(a - b); best = i; }
      }
      return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
    }
    if (t.length >= 10) {
      var m = t.match(/^(.{3,}?)(stüble|stübchen|stube|stüberl|kneipe|keller|treff|eck|bar)$/i);
      if (m) return [m[1], m[2]];
    }
    return [t];
  }

  var heroLines = null;
  function buildH3D() {
    var title = (C.hero && C.hero.title) || (C.meta && C.meta.siteName) || '';
    var parts = splitTitle(title);
    var lines = mqNarrow.matches && parts.length > 1 ? parts : [title];
    var key = lines.join('|');
    if (heroLines === key) return;
    heroLines = key;
    var depth = mqNarrow.matches ? 14 : 24;
    var inner = lines.map(function (l) { return '<span class="h3d-line">' + esc(l) + '</span>'; }).join('');
    var html = '<span class="h3d-l h3d-sizer">' + inner + '</span><span class="h3d-l h3d-shadow">' + inner + '</span>';
    html += '<span class="h3d-l h3d-ghost">' + inner + '</span>';
    for (var i = depth; i >= 1; i--) {
      var t = i / depth; // 1 = hinten
      var r = Math.round(226 - t * 120), g = Math.round(36 - t * 26), b = Math.round(46 - t * 30);
      html += '<span class="h3d-l h3d-depth" style="--c:rgb(' + r + ',' + g + ',' + b + ');transform:translateZ(' + (-i * (mqNarrow.matches ? 2.4 : 3.6)).toFixed(1) + 'px)">' + inner + '</span>';
    }
    html += '<span class="h3d-l h3d-face">' + inner + '</span>';
    html += '<span class="h3d-l h3d-sheen">' + inner + '</span>';
    var h = $('#h3d');
    h.innerHTML = html;
    // Die erste Ebene bestimmt die Größe (im Fluss), alle anderen liegen absolut darüber.
    fitH3D();
  }

  function fitH3D() {
    var h = $('#h3d');
    if (!h) return;
    var wrap = $('.hero-inner');
    var avail = wrap.clientWidth - parseFloat(getComputedStyle(wrap).paddingLeft) * 2;
    h.style.setProperty('--size', '100px');
    var lines = $$('.h3d-sizer .h3d-line', h);
    var w = 0;
    lines.forEach(function (l) { l.style.display = 'inline-block'; w = Math.max(w, l.getBoundingClientRect().width); l.style.display = ''; });
    if (!w) return;
    var maxSize = mqNarrow.matches ? 190 : 260;
    var size = clamp(avail * (mqNarrow.matches ? 0.9 : 0.84) / w * 100, 48, maxSize);
    // Höhe begrenzen, damit der Hero auf kurzen Bildschirmen nicht überläuft
    var maxByHeight = (window.innerHeight * (mqNarrow.matches ? 0.36 : 0.36)) / (lines.length * 0.86);
    size = Math.min(size, Math.max(56, maxByHeight));
    h.style.setProperty('--size', size.toFixed(1) + 'px');
  }

  function renderHero() {
    var hero = C.hero || {}, m = C.meta || {};
    var title = hero.title || m.siteName || '';
    $('#heroTitleText').textContent = title;
    $('#heroKicker').textContent = m.tagline || '';
    if (!m.tagline) $('.kicker').hidden = true;
    $('#heroSub').textContent = hero.subtitle || '';
    $('#heroCtaText').textContent = hero.ctaText || 'Termine';
    var img = $('#heroPhoto');
    if (hero.image) img.src = H.asset(hero.image); else img.remove();
    buildH3D();
    if (document.fonts && document.fonts.load) {
      document.fonts.load('400 100px "Bebas Neue"').then(fitH3D, function () {});
    }
    var rT;
    window.addEventListener('resize', function () {
      clearTimeout(rT);
      rT = setTimeout(function () { buildH3D(); fitH3D(); }, 120);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Über uns                                                            */
  /* ------------------------------------------------------------------ */
  var ICONS = { beer: 'beer', bier: 'beer', tv: 'tv', sport: 'tv', smoke: 'smoke', rauchen: 'smoke', sun: 'sun', sonne: 'sun', sommer: 'sun' };
  function renderAbout() {
    var a = C.about || {};
    $('#aboutTitle').textContent = a.title || '';
    $('#aboutText').innerHTML = H.paragraphs(a.text);
    var tag = (C.contact && C.contact.district) || '';
    $('#aboutTag').textContent = tag;
    var hl = a.highlights || [];
    $('#highlights').innerHTML = hl.map(function (h, i) {
      var ic = ICONS[String(h.icon || '').toLowerCase()] || 'star';
      return '<li class="hl tilt">' +
        '<span class="hl-no" aria-hidden="true">' + pad(i + 1) + '</span>' +
        '<span class="hl-icon">' + icon(ic, '') + '</span>' +
        '<h3>' + esc(h.title) + '</h3>' +
        (h.text ? '<p>' + esc(h.text) + '</p>' : '') +
        '</li>';
    }).join('');
    if (!hl.length) $('#highlights').hidden = true;
  }

  /* ------------------------------------------------------------------ */
  /* Termine                                                             */
  /* ------------------------------------------------------------------ */
  var events = [];
  function eventStart(e) {
    var p = String(e.date).split('-');
    var t = String(e.time || '').match(/(\d{1,2})[:.](\d{2})/);
    return new Date(+p[0], +p[1] - 1, +p[2], t ? +t[1] : 0, t ? +t[2] : 0);
  }

  function renderEvents() {
    events = H.upcomingEvents(C);
    var list = $('#fixtures');
    if (!events.length) {
      list.hidden = true;
      $('#eventsHint').hidden = true;
      var c = C.contact || {};
      var empty = $('#eventsEmpty');
      empty.hidden = false;
      empty.innerHTML = '<div class="ee-score" aria-hidden="true">0:0</div><div>' +
        '<p class="ee-title">Gerade kein Termin angesetzt</p>' +
        '<p class="ee-text">Die nächsten Spieltage und Abende sind in Planung – schau bald wieder rein. Die Bundesliga läuft bei uns trotzdem.</p>' +
        (c.phone ? '<a class="btn btn-ghost" href="' + esc(H.telHref(c.phone)) + '">' + icon('phone') + '<span>Nachfragen: ' + esc(c.phone) + '</span></a>' : '') +
        '</div>';
      return;
    }
    list.innerHTML = events.map(function (e, i) {
      var d = H.formatDate(e.date);
      var id = 'fx-' + i;
      var cat = String(e.category || '');
      var img = e.image ? '<div class="fx-bg" aria-hidden="true"><img src="' + esc(H.asset(e.image)) + '" alt="" loading="lazy" decoding="async"></div>' : '';
      return '<li class="fx" data-i="' + i + '" data-event-id="' + esc(e.id || '') + '">' +
        (i === 0 ? '<span class="fx-next">Nächster Termin</span>' : '') +
        '<div class="fx-card">' +
          '<div class="fx-face fx-front' + (e.image ? ' has-img' : '') + '">' + img +
            '<div class="fx-top"><span class="fx-no">Spieltag ' + pad(i + 1) + '</span>' +
              (cat ? '<span class="fx-cat" data-cat="' + esc(cat.toLowerCase()) + '">' + esc(cat) + '</span>' : '') + '</div>' +
            '<div class="fx-date"><span class="fx-day">' + esc(d.day) + '</span><span class="fx-dm"><span class="fx-wd">' + esc(d.weekday) + '</span><span class="fx-mon">' + esc(d.monthLong) + '</span><span class="fx-yr">' + esc(d.year) + '</span></span></div>' +
            '<h3 class="fx-title" id="' + id + '-t">' + esc(e.title) + '</h3>' +
            '<div class="fx-bottom"><span class="fx-time" data-live="' + i + '">' + (e.time ? '<small>Beginn</small>' + esc(e.time) + ' Uhr' : '<small>Ganztägig</small>') + '</span>' +
              '<button type="button" class="fx-btn fx-open" aria-expanded="false" aria-controls="' + id + '-b" aria-describedby="' + id + '-t">Details' + icon('flip') + '</button></div>' +
          '</div>' +
          '<div class="fx-face fx-back" id="' + id + '-b" inert>' +
            '<p class="fx-back-date">' + esc(d.long) + (e.time ? ' · ' + esc(e.time) + ' Uhr' : '') + '</p>' +
            '<p class="fx-back-title">' + esc(e.title) + '</p>' +
            '<div class="fx-desc">' + (e.description ? H.paragraphs(e.description) : '<p>Mehr Infos gibt’s an der Theke.</p>') + '</div>' +
            '<div class="fx-actions">' +
              '<button type="button" class="fx-btn fx-ics" data-i="' + i + '">' + icon('cal') + 'Kalender</button>' +
              '<button type="button" class="fx-btn fx-close">' + icon('flip') + 'Zurück</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        (H.signupEnabled(C, e) ? '<div class="x-signup" data-signup="' + esc(e.id) + '"></div>' : '') +
        '</li>';
    }).join('');
    renderCountdownShell();
    $('#eventsHint').textContent = 'Auf „Details“ tippen – die Karte dreht sich um';
  }

  /* Handy: Termine untereinander; ab dem 4. Termin erst nach „Alle Termine anzeigen“ (CSS blendet aus) */
  var FX_FIRST = 3;
  function initFixturesMore() {
    var list = $('#fixtures'), more = $('#fxMore'), btn = $('#fxMoreBtn');
    if (!list || !more || events.length <= FX_FIRST) return;
    $$('.fx', list).forEach(function (li, i) { if (i >= FX_FIRST) li.classList.add('is-extra'); });
    btn.textContent = 'Alle ' + events.length + ' Termine anzeigen';
    more.hidden = false;
    btn.addEventListener('click', function () {
      list.classList.add('is-all');
      more.hidden = true;
      var next = $$('.fx', list)[FX_FIRST];
      var b = next && $('.fx-open', next);
      if (b) b.focus();
    });
  }

  function nextCountdownEvent() {
    var now = Date.now();
    for (var i = 0; i < events.length; i++) {
      if (eventStart(events[i]).getTime() > now) return { ev: events[i], i: i };
    }
    return null;
  }
  function liveEvent() {
    // Termin von heute, der bereits begonnen hat (bis 4 h danach als "live" markiert)
    var now = Date.now();
    for (var i = 0; i < events.length; i++) {
      var st = eventStart(events[i]).getTime();
      if (events[i].time && st <= now && now - st < 4 * 3600e3) return { ev: events[i], i: i };
    }
    return null;
  }

  var cdTarget = null, cdPrev = '';
  function renderCountdownShell() {
    var box = $('#countdown');
    var live = liveEvent();
    var nx = nextCountdownEvent();
    var show = live || nx;
    if (!show) { box.hidden = true; return; }
    box.hidden = false;
    var e = show.ev, d = H.formatDate(e.date);
    var digits = '';
    if (live) {
      digits = '<p class="cd-live">Läuft gerade</p>';
      cdTarget = null;
    } else {
      cdTarget = eventStart(e).getTime();
      // Ohne Sekunden: nichts tickt im Sekundentakt (WCAG 2.2.2), die Anzeige ändert sich höchstens einmal pro Minute
      var units = [['d', 'Tage'], ['h', 'Stunden'], ['m', 'Minuten']];
      digits = '<div class="cd-digits" role="timer" aria-live="off" id="cdDigits">' + units.map(function (u, k) {
        return (k ? '<span class="cd-sep" aria-hidden="true">:</span>' : '') +
          '<div class="cd-unit"><div class="cd-num" data-u="' + u[0] + '" aria-hidden="true"><span class="cd-d"><span>0</span></span><span class="cd-d"><span>0</span></span></div><span class="cd-cap" aria-hidden="true">' + u[1] + '</span></div>';
      }).join('') + '<span class="sr-only" id="cdSr"></span></div>';
    }
    box.innerHTML = '<div><p class="cd-label">' + (live ? 'Jetzt live' : 'Countdown zum nächsten Anpfiff') + '</p>' +
      '<p class="cd-title">' + esc(e.title) + '</p>' +
      '<p class="cd-meta">' + esc(d.long) + (e.time ? ' · ' + esc(e.time) + ' Uhr' : '') + '</p></div>' + digits;
    cdPrev = '';
  }

  function updateCountdown() {
    if (!cdTarget) return;
    var diff = cdTarget - Date.now();
    if (diff <= 0) { renderCountdownShell(); return; }
    var mins = Math.ceil(diff / 60000);
    var vals = { d: Math.floor(mins / 1440), h: Math.floor((mins % 1440) / 60), m: mins % 60 };
    var str = '';
    $$('#cdDigits .cd-num').forEach(function (num) {
      var u = num.getAttribute('data-u');
      var v = String(Math.min(vals[u], 99)).padStart(2, '0');
      str += v;
      var ds = num.children;
      for (var k = 0; k < 2; k++) {
        var span = ds[k].firstChild;
        if (span.textContent !== v[k]) {
          span.textContent = v[k];
          if (!still() && cdPrev) { ds[k].classList.remove('tick'); void ds[k].offsetWidth; ds[k].classList.add('tick'); }
        }
      }
    });
    // Screenreader-Text nur minütlich ändern
    var sr = $('#cdSr');
    var srText = 'Noch ' + vals.d + ' Tage, ' + vals.h + ' Stunden und ' + vals.m + ' Minuten';
    if (sr && sr.textContent !== srText) sr.textContent = srText;
    cdPrev = str;
  }

  function downloadIcs(e) {
    var c = C.contact || {}, name = (C.meta && C.meta.siteName) || '';
    var st = eventStart(e);
    var en = new Date(st.getTime() + (e.time ? 3 * 3600e3 : 24 * 3600e3));
    var fmt = function (d) { return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + (e.time ? 'T' + pad(d.getHours()) + pad(d.getMinutes()) + '00' : ''); };
    var icsEsc = function (s) { return String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1'); };
    var now = new Date();
    var stamp = now.getUTCFullYear() + pad(now.getUTCMonth() + 1) + pad(now.getUTCDate()) + 'T' + pad(now.getUTCHours()) + pad(now.getUTCMinutes()) + '00Z';
    var lines = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//' + icsEsc(name) + '//Termine//DE', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
      'UID:' + icsEsc(e.id || (e.date + '-' + e.title)) + '@hofbraeustueble',
      'DTSTAMP:' + stamp,
      (e.time ? 'DTSTART:' : 'DTSTART;VALUE=DATE:') + fmt(st),
      (e.time ? 'DTEND:' : 'DTEND;VALUE=DATE:') + fmt(en),
      'SUMMARY:' + icsEsc(e.title + (name ? ' – ' + name : '')),
      'DESCRIPTION:' + icsEsc(e.description),
      'LOCATION:' + icsEsc([name, H.fullAddress(c)].filter(Boolean).join(', ')),
      'END:VEVENT', 'END:VCALENDAR'
    ];
    var blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = (e.id || 'termin') + '.ics';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  function initFlipCards() {
    $$('.fx').forEach(function (card) {
      var front = $('.fx-front', card), back = $('.fx-back', card);
      var openBtn = $('.fx-open', card), closeBtn = $('.fx-close', card);
      function set(flipped, focus) {
        card.classList.toggle('is-flipped', flipped);
        openBtn.setAttribute('aria-expanded', String(flipped));
        back.inert = !flipped; front.inert = flipped;
        if (!('inert' in HTMLElement.prototype)) { back.setAttribute('aria-hidden', String(!flipped)); front.setAttribute('aria-hidden', String(flipped)); }
        if (focus) (flipped ? closeBtn : openBtn).focus({ preventScroll: true });
      }
      card.addEventListener('click', function (ev) {
        if (ev.target.closest('.fx-ics')) {
          var e = events[+ev.target.closest('.fx-ics').getAttribute('data-i')];
          if (e) downloadIcs(e);
          return;
        }
        var viaButton = !!ev.target.closest('.fx-btn');
        set(!card.classList.contains('is-flipped'), viaButton && ev.detail === 0 ? true : viaButton);
      });
      card.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape' && card.classList.contains('is-flipped')) { set(false, true); }
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Tippspiel-Teaser (Tipp-Tabelle)                                    */
  /* ------------------------------------------------------------------ */
  function renderTippspiel() {
    var t = C.tippspiel || {};
    var sec = $('#tippspiel');
    if (!t.enabled || !H.features(C).tippspiel) { sec.remove(); return; }
    sec.hidden = false;
    $('#tippTitle').textContent = t.title || 'Tippspiel';
    if (t.text) $('#tippText').innerHTML = H.paragraphs(t.text); else $('#tippText').hidden = true;
    $('#tippBtn span').textContent = t.buttonText || 'Zum Tippspiel';
    var note = $('#tippNote');
    if (t.note) note.innerHTML = icon('shield') + '<span>' + esc(t.note) + '</span>'; else note.hidden = true;
  }

  /* Zusatzfunktionen (Speisekarte, Tisch-Anfrage, Anmeldung, Fußball diese Woche) – siehe extras.js */
  function renderExtras() {
    if (!window.HBSExtras) return;
    window.HBSExtras.render(C, {
      privacyDialog: 'dlgDatenschutz',
      onChange: function () { buildNav(); checkNavFit(); }
    });
  }

  // Punkte-Ziffern der Tipp-Tabelle klappen beim ersten Sichtkontakt um (Fallblatt)
  function initTippBoard() {
    var board = $('#tippBoard');
    if (!board || reduced || !('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (en) {
      if (!en[0].isIntersecting) return;
      board.classList.add('is-live');
      io.disconnect();
    }, { threshold: .35 });
    io.observe(board);
  }

  /* ------------------------------------------------------------------ */
  /* Öffnungszeiten-Anzeigetafel                                        */
  /* ------------------------------------------------------------------ */
  function renderHours() {
    var list = C.openingHours || [];
    var todayIdx = H.todayHoursIndex();
    $('#boardDays').innerHTML = list.map(function (d, i) {
      var key = String(d.day || '').toLowerCase();
      var abbr = DAY_ABBR[key] || String(d.day || '').slice(0, 2);
      var rest = !parseRange(d.hours);
      var isToday = i === todayIdx;
      return '<li class="bd' + (isToday ? ' is-today' : '') + (rest ? ' is-rest' : '') + '"' + (isToday ? ' aria-current="date"' : '') + '>' +
        '<span class="bd-abbr" aria-hidden="true">' + esc(abbr) + '</span>' +
        '<span class="bd-name">' + esc(d.day) + (isToday ? '<span class="sr-only"> (heute)</span>' : '') + '</span>' +
        '<span class="bd-hours">' + esc(d.hours || '–') + '</span></li>';
    }).join('');
    if (C.hoursNote) $('#hoursNote').textContent = C.hoursNote; else $('#hoursNote').hidden = true;
    if (!list.length) $('#board').hidden = true;
    updateStatus();
  }

  var lastStatusKey = '';
  function updateStatus() {
    var st = hoursStatus();
    if (!st) return;
    var key = JSON.stringify(st);
    if (key === lastStatusKey) return;
    lastStatusKey = key;
    var nextTxt = st.open ? 'Heute bis ' + st.until + ' Uhr' :
      (st.at ? 'Wir öffnen ' + (st.nextLabel === 'heute' || st.nextLabel === 'morgen' ? st.nextLabel : 'am ' + st.nextLabel) + ' um ' + st.at + ' Uhr' : '');

    var bs = $('#boardStatus');
    bs.className = 'board-status ' + (st.open ? 'is-open' : 'is-closed');
    bs.textContent = st.open ? 'Jetzt geöffnet' : 'Geschlossen';
    $('#boardSub').innerHTML = st.open ? 'Gezapft wird <b>bis ' + esc(st.until) + ' Uhr</b>' : (st.at ? esc(nextTxt.replace(/^Wir öffnen /, 'Anpfiff ')).replace(/um (.*)$/, 'um <b>$1</b>') : '');

    var ns = $('#navStatus');
    ns.hidden = false;
    ns.className = 'nav-status ' + (st.open ? 'is-open' : 'is-closed');
    ns.textContent = st.open ? 'Geöffnet' : 'Geschlossen';
    ns.setAttribute('aria-label', (st.open ? 'Jetzt geöffnet. ' : 'Jetzt geschlossen. ') + nextTxt + '. Zu den Öffnungszeiten');

    // Bauchbinde im Hero
    var l3 = $('#lowerThird');
    l3.hidden = false;
    $('#l3Tag').textContent = st.open ? 'Live' : 'Heute';
    var ls = $('#l3Status');
    ls.className = 'l3-status ' + (st.open ? 'is-open' : 'is-closed');
    ls.innerHTML = '<span class="led" aria-hidden="true"></span>' + (st.open ? 'Jetzt geöffnet' : 'Geschlossen') +
      (nextTxt ? ' <span class="t">' + esc(st.open ? 'bis ' + st.until + ' Uhr' : nextTxt.replace(/^Wir öffnen /, 'öffnet ')) + '</span>' : '');
    var nx = (H.upcomingEvents(C) || [])[0];
    if (nx) {
      var d = H.formatDate(nx.date);
      $('#l3Next').innerHTML = 'Nächster Termin: <b>' + esc(nx.title) + '</b> · ' + esc(d.weekday.slice(0, 2)) + ', ' + esc(d.day) + '. ' + esc(d.month) + (nx.time ? ' · ' + esc(nx.time) + ' Uhr' : '');
    } else {
      $('#l3Next').textContent = (C.meta && C.meta.tagline) || '';
    }
  }

  function updateClock() {
    var n = new Date();
    var el = $('#boardClock');
    if (el) el.innerHTML = pad(n.getHours()) + '<span class="colon">:</span>' + pad(n.getMinutes());
  }

  function tick() {
    updateCountdown();
    var n = new Date();
    if (n.getSeconds() === 0 || !lastStatusKey || !$('#boardClock').textContent.match(/\d/)) { updateStatus(); updateClock(); }
  }

  /* ------------------------------------------------------------------ */
  /* Sommer                                                              */
  /* ------------------------------------------------------------------ */
  function renderSummer() {
    var s = C.summer || {};
    var sec = $('#sommer');
    if (!s.enabled) { sec.remove(); return; }
    sec.hidden = false;
    $('#summerTitle').textContent = s.title || '';
    $('#summerText').innerHTML = H.paragraphs(s.text);
    if (s.season) $('#summerSeason span').textContent = s.season; else $('#summerSeason').hidden = true;
    var img = $('#summerImg');
    if (s.image) { img.src = H.asset(s.image); img.alt = s.title || ''; } else { $('#summerPhoto').remove(); $('.summer-grid').style.gridTemplateColumns = '1fr'; }
  }

  /* ------------------------------------------------------------------ */
  /* Galerie: 3D-Prisma + Lightbox                                      */
  /* ------------------------------------------------------------------ */
  var gallery = [];
  function renderGallery() {
    gallery = (C.gallery || []).filter(function (g) { return g && g.src; });
    var sec = $('#galerie');
    if (!gallery.length) { sec.remove(); return; }
    // Bei wenigen Bildern werden die Flächen wiederholt (mind. 6 Seiten), damit das Prisma
    // auch im Ruhezustand als 3D-Körper mit sichtbaren Seitenflächen lesbar ist.
    var n = gallery.length;
    var m = n === 1 ? 1 : (n < 6 ? n * Math.ceil(6 / n) : n);
    var html = '';
    for (var k = 0; k < m; k++) {
      var i = k % n, g = gallery[i];
      html += '<figure class="face" data-i="' + i + '" aria-hidden="' + (k ? 'true' : 'false') + '">' +
        '<img src="' + esc(H.asset(g.src)) + '" alt="' + esc(g.caption || ('Foto ' + (i + 1))) + '" loading="lazy" decoding="async" draggable="false">' +
        '<span class="face-no" aria-hidden="true">' + pad(i + 1) + '</span><span class="shade"></span></figure>';
    }
    $('#prism').innerHTML = html;
    $('#prismTotal').textContent = pad(gallery.length);
  }

  var lbIndex = 0;
  function openLightbox(i) {
    var dlg = $('#lightbox');
    lbIndex = (i + gallery.length) % gallery.length;
    showLb();
    if (!dlg.open) { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); }
  }
  function showLb() {
    var g = gallery[lbIndex];
    var img = $('#lbImg');
    img.src = H.asset(g.src);
    img.alt = g.caption || ('Foto ' + (lbIndex + 1));
    $('#lbCap').textContent = g.caption || '';
    $('#lbCount').textContent = pad(lbIndex + 1) + ' / ' + pad(gallery.length);
    if (!reduced) { img.style.animation = 'none'; void img.offsetWidth; img.style.animation = ''; }
    var multi = gallery.length > 1;
    $('#lbPrev').hidden = !multi; $('#lbNext').hidden = !multi;
  }

  function initPrism() {
    if (!gallery.length) return;
    var stage = $('#prismStage'), prism = $('#prism');
    var faces = $$('.face', prism);
    var n = gallery.length;      // echte Bilder
    var m = faces.length;        // Prisma-Flächen
    var step = 360 / Math.max(m, 1);
    var angle = 0, current = 0, radius = 0;
    // Auto-Drehung: nur einmal rundherum, solange niemand das Prisma bedient hat; danach nie wieder (WCAG 2.2.2)
    var autoTimer = null, autoDone = false, autoSteps = 0;
    var autoBox = $('#prismAuto'), autoBtn = $('#prismAutoBtn');

    function layout() {
      var w = stage.clientWidth;
      // Prisma-Radius: Abstand der Flächen zur Achse (Inkreisradius des n-Ecks) + kleiner Spalt
      radius = m < 3 ? 0 : (w / 2) / Math.tan(Math.PI / m) + 1;
      faces.forEach(function (f, i) {
        f.style.transform = 'rotateY(' + (i * step) + 'deg) translateZ(' + radius.toFixed(1) + 'px)';
      });
      apply(false);
    }
    function apply(snap) {
      prism.classList.toggle('is-snapping', !!snap && !reduced);
      prism.style.transform = 'translateZ(' + (-radius).toFixed(1) + 'px) rotateY(' + angle.toFixed(2) + 'deg)';
      shade();
    }
    function shade() {
      faces.forEach(function (f, i) {
        var a = ((i * step + angle) % 360 + 540) % 360 - 180; // -180..180, 0 = vorne
        f.querySelector('.shade').style.opacity = clamp(Math.abs(a) / 120, 0, .7).toFixed(2);
      });
    }
    function faceFromAngle() { return ((Math.round(-angle / step) % m) + m) % m; }
    function setCurrent() {
      var fi = faceFromAngle();
      current = fi % n;
      faces.forEach(function (f, i) { f.setAttribute('aria-hidden', String(i !== fi)); });
      $('#prismNo').textContent = pad(current + 1);
      var cap = gallery[current].caption || '';
      $('#prismCap').textContent = cap;
      $('#prismCap').setAttribute('aria-label', 'Bild ' + (current + 1) + ' von ' + n + (cap ? ': ' + cap : ''));
    }
    function go(delta) {
      angle = Math.round(angle / step) * step - delta * step;
      apply(true);
      setCurrent();
    }
    function snap() { angle = Math.round(angle / step) * step; apply(true); setCurrent(); }

    // Ziehen / Wischen
    var drag = null;
    stage.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, a: angle, moved: false, id: e.pointerId, lastX: e.clientX, lastT: performance.now(), v: 0 };
      prism.classList.remove('is-snapping');
      endAuto();
    });
    stage.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved) {
        if (Math.abs(dx) < 6) return;
        if (Math.abs(dy) > Math.abs(dx)) { drag = null; return; } // vertikales Scrollen
        drag.moved = true;
        try { stage.setPointerCapture(e.pointerId); } catch (err) {}
      }
      var now = performance.now();
      drag.v = (e.clientX - drag.lastX) / Math.max(1, now - drag.lastT);
      drag.lastX = e.clientX; drag.lastT = now;
      angle = drag.a + dx * (step / stage.clientWidth) * 1.1;
      apply(false);
    });
    function end(e) {
      if (!drag) return;
      var d = drag; drag = null;
      if (!d.moved) {
        if (e.type === 'pointerup') {
          // Klick: auf vordere Fläche -> Lightbox
          openLightbox(current);
        }
        return;
      }
      angle += clamp(d.v * 160, -step * 0.9, step * 0.9) * (step / 120);
      snap();
    }
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);
    stage.addEventListener('lostpointercapture', function (e) { if (drag && drag.moved) end(e); });

    stage.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1); endAuto(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); endAuto(); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); endAuto(); openLightbox(current); }
    });
    $('#prismPrev').addEventListener('click', function () { go(-1); endAuto(); });
    $('#prismNext').addEventListener('click', function () { go(1); endAuto(); });
    if (n < 2) { $('#prismPrev').hidden = true; $('#prismNext').hidden = true; $('#prismHelp').textContent = 'Bild antippen zum Vergrößern'; }

    function startAuto() {
      if (autoDone || autoTimer || still() || n < 2) return;
      autoBox.hidden = false;
      autoTimer = setInterval(function () {
        if (document.hidden) return;
        go(1);
        if (++autoSteps >= n) endAuto();
      }, 4800);
    }
    // Beendet die Auto-Drehung endgültig (erste Bedienung, Knopf, aus dem Bild gescrollt, „Bewegung anhalten“)
    function endAuto() {
      clearInterval(autoTimer); autoTimer = null; autoDone = true;
      if (autoBox) {
        if (autoBox.contains(document.activeElement)) $('#prismNext').focus({ preventScroll: true });
        autoBox.hidden = true;
      }
    }
    autoBtn.addEventListener('click', endAuto);
    stage.addEventListener('focusin', endAuto);
    M.onChange(function (p) { if (p) endAuto(); });
    if ('IntersectionObserver' in window && !still()) {
      var seen = false;
      var ioP = new IntersectionObserver(function (en) {
        if (en[0].isIntersecting) { seen = true; startAuto(); }
        else if (seen) { endAuto(); ioP.disconnect(); }
      }, { threshold: .4 });
      ioP.observe(stage);
    }

    // Lightbox
    $('#lbPrev').addEventListener('click', function () { lbIndex = (lbIndex - 1 + n) % n; showLb(); });
    $('#lbNext').addEventListener('click', function () { lbIndex = (lbIndex + 1) % n; showLb(); });
    var lb = $('#lightbox');
    lb.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { lbIndex = (lbIndex + 1) % n; showLb(); }
      if (e.key === 'ArrowLeft') { lbIndex = (lbIndex - 1 + n) % n; showLb(); }
    });
    lb.addEventListener('click', function (e) { if (e.target === lb || e.target.classList.contains('lb-figure')) lb.close(); });
    var sx = null;
    lb.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', function (e) {
      if (sx == null) return;
      var dx = e.changedTouches[0].clientX - sx; sx = null;
      if (Math.abs(dx) > 50) { lbIndex = (lbIndex + (dx < 0 ? 1 : -1) + n) % n; showLb(); }
    });
    lb.addEventListener('close', function () { stage.focus({ preventScroll: true }); });

    layout();
    setCurrent();
    var rT; window.addEventListener('resize', function () { clearTimeout(rT); rT = setTimeout(layout, 100); });
  }

  /* ------------------------------------------------------------------ */
  /* Kontakt                                                             */
  /* ------------------------------------------------------------------ */
  function renderContact() {
    var c = C.contact || {}, name = (C.meta && C.meta.siteName) || '';
    $('#address').innerHTML =
      (c.street ? '<span class="addr-street">' + esc(c.street) + '</span>' : '') +
      '<span class="addr-city">' + esc([c.zip, c.city].filter(Boolean).join(' ')) + (c.district ? ' – <b>' + esc(c.district) + '</b>' : '') + '</span>';
    var acts = '';
    if (c.phone) acts += '<a class="c-action" href="' + esc(H.telHref(c.phone)) + '"><span class="c-ico">' + icon('phone', '') + '</span><span><small>Anrufen</small><strong>' + esc(c.phone) + '</strong></span>' + icon('arrow', 'ico c-go') + '</a>';
    if (c.email) acts += '<a class="c-action" href="mailto:' + esc(c.email) + '"><span class="c-ico">' + icon('mail', '') + '</span><span><small>E-Mail schreiben</small><strong>' + esc(c.email) + '</strong></span>' + icon('arrow', 'ico c-go') + '</a>';
    $('#contactActions').innerHTML = acts;
    $('#contactNote').textContent = c.note || '';
    var mb = $('#mapsBtn');
    if (c.mapsUrl && /^https?:\/\//i.test(c.mapsUrl)) {
      mb.href = c.mapsUrl; mb.hidden = false;
      mb.setAttribute('aria-label', 'Route in Google Maps öffnen (neuer Tab)');
    }
    $('#tacticLabel').innerHTML = esc(name) + (c.district ? ' · <b>' + esc(c.district) + '</b>' : '');
    var s = C.social || {}, soc = '';
    if (s.facebook) soc += '<li><a href="' + esc(s.facebook) + '" target="_blank" rel="noopener noreferrer" aria-label="Facebook (neuer Tab)">' + icon('fb', '') + '</a></li>';
    if (s.instagram) soc += '<li><a href="' + esc(s.instagram) + '" target="_blank" rel="noopener noreferrer" aria-label="Instagram (neuer Tab)">' + icon('ig', '') + '</a></li>';
    if (soc) { $('#social').innerHTML = soc; $('#social').hidden = false; }
  }

  /* ------------------------------------------------------------------ */
  /* Footer & Rechtliches                                               */
  /* ------------------------------------------------------------------ */
  function renderFooter() {
    var m = C.meta || {}, name = m.siteName || '';
    var parts = splitTitle(name);
    $('#footerMega').innerHTML = parts.length > 1 ? esc(parts[0]) + '<span>' + esc(parts[1]) + '</span>' : esc(name);
    $('#footerName').textContent = name;
    $('#footerTagline').textContent = m.tagline || '';
    $('#brandName').textContent = name;
    $('.brand-mark span').textContent = name.charAt(0) || 'H';
    $('#footerCopy').textContent = '© ' + new Date().getFullYear() + ' ' + name + ' · ' + H.fullAddress(C.contact);
    if (m.lastUpdated) {
      var p = String(m.lastUpdated).split('-');
      $('#footerUpdated').textContent = p.length === 3 ? 'Stand: ' + (+p[2]) + '.' + (+p[1]) + '.' + p[0] : '';
    }
  }

  function renderLegal() {
    var i = C.impressum || {};
    var html = '<h3>Angaben gemäß § 5 DDG</h3><p>' +
      [i.businessName, i.owner, i.street, i.zipCity].filter(Boolean).map(esc).join('<br>') + '</p>';
    if (i.phone || i.email) {
      html += '<h3>Kontakt</h3><p>' +
        (i.phone ? 'Telefon: <a href="' + esc(H.telHref(i.phone)) + '">' + esc(i.phone) + '</a>' : '') +
        (i.phone && i.email ? '<br>' : '') +
        (i.email ? 'E-Mail: <a href="mailto:' + esc(i.email) + '">' + esc(i.email) + '</a>' : '') + '</p>';
    }
    if (i.vatId) html += '<h3>Umsatzsteuer-ID</h3><p>Umsatzsteuer-Identifikationsnummer gemäß § 27 a UStG: ' + esc(i.vatId) + '</p>';
    if (i.responsible) html += '<h3>Verantwortlich für den Inhalt</h3><p>' + esc(i.responsible) + '</p>';
    if (i.extraText) html += '<h3>Hinweise</h3>' + H.paragraphs(i.extraText);
    $('#impressumBody').innerHTML = html;
    var d = C.datenschutz || {};
    $('#datenschutzBody').innerHTML = H.paragraphs(d.text || '');
  }

  function initDialogs() {
    $$('[data-dialog]').forEach(function (b) {
      b.addEventListener('click', function () {
        var dlg = document.getElementById(b.getAttribute('data-dialog'));
        if (!dlg) return;
        dlg._opener = b;
        if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
      });
    });
    $$('dialog').forEach(function (dlg) {
      $$('[data-close]', dlg).forEach(function (b) { b.addEventListener('click', function () { dlg.close(); }); });
      dlg.addEventListener('click', function (e) { if (e.target === dlg && dlg.classList.contains('modal')) dlg.close(); });
      dlg.addEventListener('close', function () { if (dlg._opener) dlg._opener.focus(); });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Navigation                                                          */
  /* ------------------------------------------------------------------ */
  function buildNav() {
    // [Abschnitt, Beschriftung, externes Ziel?] – das Tippspiel verlinkt auf die eigene App
    var items = [['ueber-uns', 'Über uns'], ['termine', 'Termine'], ['tippspiel', 'Tippspiel', '../tippspiel/'], ['karte', 'Karte'], ['zeiten', 'Zeiten'], ['reservieren', 'Reservieren'], ['sommer', 'Sommer'], ['galerie', 'Galerie'], ['kontakt', 'Kontakt']]
      .filter(function (it) { return document.getElementById(it[0]); });
    var link = function (it) { return '<a href="' + (it[2] || '#' + it[0]) + '"' + (it[2] ? ' class="nav-app"' : '') + '>' + it[1] + '</a>'; };
    $('#navList').innerHTML = items.map(function (it) { return '<li>' + link(it) + '</li>'; }).join('');
    $('#mmenuList').innerHTML = items.map(function (it, i) { return '<li style="--i:' + i + '">' + link(it) + '</li>'; }).join('');
    // Abschnittsnummern fortlaufend setzen (Sommer ist optional)
    var no = 1;
    $$('main .sec .sec-no').forEach(function (el) { el.textContent = pad(no++); });
    var c = C.contact || {}, foot = '';
    if (c.phone) foot += '<a class="btn btn-red" href="' + esc(H.telHref(c.phone)) + '">' + icon('phone') + '<span>' + esc(c.phone) + '</span></a>';
    if (c.mapsUrl) foot += '<a class="btn btn-ghost" href="' + esc(c.mapsUrl) + '" target="_blank" rel="noopener noreferrer">' + icon('route') + '<span>Route planen</span></a>';
    $('#mmenuFoot').innerHTML = foot;
  }

  /* Passt die Menüleiste wegen größerer Systemschrift oder Zoom nicht in eine Zeile, gilt das Klappmenü (html.nav-compact) */
  var mqWideNav = window.matchMedia('(min-width: 961px)');
  function checkNavFit() {
    var root = document.documentElement, inner = $('.nav-inner');
    if (!inner) return;
    root.classList.remove('nav-compact');
    var tight = false;
    if (mqWideNav.matches) {
      var tops = {};
      $$('#navList a').forEach(function (a) { tops[Math.round(a.getBoundingClientRect().top)] = 1; });
      tight = inner.scrollWidth > inner.clientWidth + 1 || Object.keys(tops).length > 1;
    }
    root.classList.toggle('nav-compact', tight);
    if (!tight && mqWideNav.matches && !$('#mmenu').hidden) $('#burger').click();
  }

  function initNav() {
    var nav = $('#nav'), burger = $('#burger'), menu = $('#mmenu');
    checkNavFit();
    var fitT;
    window.addEventListener('resize', function () { clearTimeout(fitT); fitT = setTimeout(checkNavFit, 120); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(checkNavFit);
    function setOpen(open) {
      burger.setAttribute('aria-expanded', String(open));
      $('#burgerLabel').textContent = open ? 'Menü schließen' : 'Menü öffnen';
      menu.hidden = !open;
      document.documentElement.style.overflow = open ? 'hidden' : '';
      nav.classList.toggle('is-solid', open || window.scrollY > 40);
      $('#main').inert = open; $('#footer').inert = open;
      if (open) { var first = $('a', menu); if (first) first.focus(); }
    }
    burger.addEventListener('click', function () { setOpen(burger.getAttribute('aria-expanded') !== 'true'); });
    menu.addEventListener('click', function (e) { if (e.target.closest('a[href^="#"]')) setOpen(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !menu.hidden) { setOpen(false); burger.focus(); }
    });
    onMQ(mqWideNav, function (e) { if (e.matches && !menu.hidden && !document.documentElement.classList.contains('nav-compact')) setOpen(false); });

    var onScroll = function () { if (menu.hidden) nav.classList.toggle('is-solid', window.scrollY > 40); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // Aktiver Abschnitt
    if ('IntersectionObserver' in window) {
      var links = $$('#navList a');
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            links.forEach(function (a) { a.classList.toggle('is-active', a.getAttribute('href') === '#' + en.target.id); });
          }
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      $$('main section[id]').forEach(function (s) { io.observe(s); });
    }
  }

  /* ------------------------------------------------------------------ */
  /* 3D: Hero-Schriftzug (Maus / Gyroskop / Idle-Schwenk)               */
  /* ------------------------------------------------------------------ */
  function initHero3D() {
    var hero = $('.hero'), h = $('#h3d'), beams = $('#beams'), pitch = $('#pitch');
    var tx = 0, ty = 0, cx = 0, cy = 0, lastInput = 0, gyro = false, visible = true, running = false;

    function staticPose() { h.style.transform = 'rotateX(10deg) rotateY(-14deg)'; beams.style.transform = ''; pitch.style.transform = ''; }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (visible) start(); }, { threshold: 0 }).observe(hero);
    }
    window.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      tx = (e.clientX / window.innerWidth - .5) * 2;
      ty = (e.clientY / window.innerHeight - .5) * 2;
      lastInput = performance.now();
      start();
    }, { passive: true });

    function onOrient(e) {
      if (e.gamma == null || e.beta == null) return;
      gyro = true;
      tx = clamp(e.gamma / 28, -1, 1);
      ty = clamp((e.beta - 50) / 28, -1, 1);
      lastInput = performance.now();
      start();
    }
    // Gyroskop nur als stille Erweiterung auf Touch-Geräten, die keine Erlaubnis-Abfrage brauchen
    // (der frühere Knopf „3D-Neigung aktivieren“ für iPhones ist bewusst entfallen)
    if (!mqFine.matches && typeof window.DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission !== 'function') {
      window.addEventListener('deviceorientation', onOrient);
    }

    function start() { if (!running && visible && !still()) { running = true; requestAnimationFrame(frame); } }
    function frame(t) {
      if (!visible || still()) { running = false; if (still()) staticPose(); return; }
      var ix = tx, iy = ty;
      if (!gyro && t - lastInput > 2600) { // Idle: sanfter Kameraschwenk
        ix = Math.sin(t / 2600) * .8;
        iy = Math.cos(t / 3400) * .35 - .15;
      }
      cx += (ix - cx) * .05; cy += (iy - cy) * .05;
      var sp = clamp(window.scrollY / Math.max(1, hero.offsetHeight), 0, 1);
      var ry = cx * 26 + (cx >= 0 ? 6 : -6) * Math.min(1, Math.abs(cx) * 4); // nie ganz frontal -> Extrusion sichtbar
      h.style.transform = 'translateZ(' + (-sp * 260).toFixed(1) + 'px) rotateX(' + (-cy * 16 + 9 + sp * 28).toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg)';
      beams.style.transform = 'translate3d(' + (cx * -26).toFixed(1) + 'px,' + (cy * -12).toFixed(1) + 'px,0)';
      pitch.style.transform = 'rotateX(' + (68 + cy * 3).toFixed(2) + 'deg) rotateZ(' + (cx * -3).toFixed(2) + 'deg)';
      requestAnimationFrame(frame);
    }
    if (still()) staticPose(); else start();
    onMQ(mqReduced, function () { if (still()) staticPose(); else start(); });
    M.onChange(function () { if (still()) staticPose(); else start(); });
  }

  /* ------------------------------------------------------------------ */
  /* 3D: Karten-Tilt (Highlights)                                       */
  /* ------------------------------------------------------------------ */
  function initTilts() {
    if (!mqFine.matches) return;
    $$('.tilt').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        if (reduced) return;
        var r = el.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        el.style.setProperty('--ry', ((x - .5) * 16).toFixed(2) + 'deg');
        el.style.setProperty('--rx', ((.5 - y) * 12).toFixed(2) + 'deg');
        el.style.setProperty('--gx', (x * 100).toFixed(1) + '%');
        el.style.setProperty('--gy', (y * 100).toFixed(1) + '%');
      });
      el.addEventListener('pointerleave', function () { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
    });
  }

  /* ------------------------------------------------------------------ */
  /* 3D: Perspektivische Scroll-Übergänge zwischen Sektionen            */
  /* ------------------------------------------------------------------ */
  function initScroll3D() {
    var els = $$('.p3d');
    if (!els.length) return;
    document.documentElement.classList.add('js-p3d');
    var ticking = false;
    function update() {
      ticking = false;
      if (reduced) return;
      var vh = window.innerHeight;
      els.forEach(function (el) {
        if (el.classList.contains('p3d-done')) return;
        var top = el.getBoundingClientRect().top;
        var p = clamp((vh - top) / (vh * 0.7), 0, 1);
        if (p >= 1) { el.classList.add('p3d-done'); el.style.removeProperty('--p'); return; }
        el.style.setProperty('--p', p.toFixed(3));
      });
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    window.addEventListener('resize', update);
    // Sprung per Anker: Ziel sofort "fertig" zeigen
    window.addEventListener('hashchange', function () {
      var t = document.getElementById(location.hash.slice(1));
      var p = t && $('.p3d', t);
      if (p) p.classList.add('p3d-done');
    });
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href^="#"]');
      if (!a) return;
      var t = document.getElementById(a.getAttribute('href').slice(1));
      var p = t && $('.p3d', t);
      if (p) p.classList.add('p3d-done');
    });
    update();
  }
})();
