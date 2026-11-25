/*!
 * Hofbräustüble – Verwaltung (Admin-Panel)
 *
 * Arbeitet mit ../cms/api.php (PHP). Ist die API nicht erreichbar oder läuft
 * kein PHP (z. B. statischer Server), startet automatisch der Demo-Modus:
 * Inhalte werden dann nur im Browser gespeichert (localStorage
 * "hbs_demo_content" + "hbs_demo_mode" = "1"), die Design-Varianten lesen sie
 * über assets/js/cms-loader.js.
 *
 * Keine externen Anfragen, keine Abhängigkeiten.
 */
(function () {
  'use strict';

  /* ================================================================ Konstanten */

  var API = '../cms/api.php';
  var LS_MODE = 'hbs_demo_mode';
  var LS_CONTENT = 'hbs_demo_content';
  var DEMO_IMAGES = ['assets/img/theke.jpg', 'assets/img/nische.jpg', 'assets/img/aussen.jpg'];
  var DEFAULT_CATEGORIES = ['Sport', 'Stammtisch', 'Feier', 'Musik', 'Sommer', 'Sonstiges'];
  var DAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
  var HL_ICONS = [['beer', 'Bierglas'], ['tv', 'Fernseher / Sport'], ['smoke', 'Rauchen'], ['sun', 'Sonne / Außenbereich']];
  var PREVIEWS = [['../variante-1/', 'Variante 1'], ['../variante-2/', 'Variante 2'], ['../variante-3/', 'Variante 3']];
  var MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  var MONTHS_LONG = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  var WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  var WD_LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

  var SKELETON = {
    meta: { siteName: '', tagline: '', seoDescription: '', lastUpdated: '' },
    banner: { enabled: false, text: '' },
    hero: { title: '', subtitle: '', image: '', ctaText: '' },
    about: { title: '', text: '', highlights: [] },
    openingHours: [],
    hoursNote: '',
    summer: { enabled: false, title: '', text: '', image: '', season: '' },
    events: [],
    tippspiel: { enabled: false, title: '', text: '', buttonText: '', note: '' },
    gallery: [],
    contact: { street: '', zip: '', city: '', district: '', phone: '', email: '', mapsUrl: '', note: '' },
    social: { facebook: '', instagram: '' },
    impressum: { owner: '', businessName: '', street: '', zipCity: '', phone: '', email: '', vatId: '', responsible: '', extraText: '' },
    datenschutz: { text: '' }
  };

  var ICONS = {
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
    home: '<path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    file: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/>',
    settings: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeoff: '<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    save: '<path d="M5 3h11l5 5v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M7 3v5h8V3M7 21v-7h10v7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-14M10 11v6M14 11v6"/>',
    up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    down: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
    logout: '<path d="M9 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4M16 17l5-5-5-5M21 12H9"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
    download: '<path d="M12 4v12M7 11l5 5 5-5M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
    check: '<path d="M5 12l5 5L20 7"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v4M12 17.5v.5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
    chevron: '<path d="M9 6l6 6-6 6"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    beer: '<path d="M5 8h10v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/><path d="M15 10h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2M5 8a3 3 0 0 1 3-4 3 3 0 0 1 5 0 2.5 2.5 0 0 1 2 4"/>',
    tv: '<rect x="2" y="7" width="20" height="13" rx="2"/><path d="M8 3l4 4 4-4"/>',
    smoke: '<rect x="2" y="14" width="16" height="4" rx="1"/><path d="M14 14v4M21 14v4M18 10c0-2 3-2 3-4M14 10c0-2 3-2 3-4"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    wand: '<path d="M15 4V2M15 10V8M11 6h2M17 6h2M4 20L14 10"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
    trophy: '<path d="M8 21h8M12 16v5M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
    ball: '<circle cx="12" cy="12" r="9"/><path d="M12 8l3.8 2.8-1.5 4.4H9.7l-1.5-4.4z"/><path d="M12 3v5M20.6 9.3l-4.8 1.5M17.3 19.3l-3-4.1M6.7 19.3l3-4.1M3.4 9.3l4.8 1.5"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
    ticket: '<path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z"/><path d="M14 7v2M14 11v2M14 15v2"/>',
    star: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z"/>',
    qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM21 14v.01M14 21h.01M17 21h4v-4"/>',
    chat: '<path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z"/>',
    printer: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.5-4.5L3 9"/><path d="M3 4v5h5M4 13a8 8 0 0 0 14.5 4.5L21 15"/><path d="M21 20v-5h-5"/>',
    minus: '<path d="M5 12h14"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/>',
    ban: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>'
  };

  var SECTIONS = [
    { id: 'termine', label: 'Termine', icon: 'calendar', render: renderEvents },
    { id: 'tippspiel', label: 'Tippspiel', icon: 'trophy', render: renderTipp },
    { id: 'galerie', label: 'Bilder', icon: 'image', render: renderGallery },
    { id: 'startseite', label: 'Startseite', icon: 'home', render: renderHome },
    { id: 'zeiten', label: 'Öffnungszeiten', icon: 'clock', render: renderHours },
    { id: 'sommer', label: 'Sommer', icon: 'sun', render: renderSummer },
    { id: 'kontakt', label: 'Kontakt & Adresse', icon: 'pin', render: renderContact },
    { id: 'impressum', label: 'Impressum', icon: 'file', render: renderImpressum },
    { id: 'datenschutz', label: 'Datenschutz', icon: 'shield', render: renderPrivacy },
    { id: 'einstellungen', label: 'Einstellungen', icon: 'settings', render: renderSettings }
  ];

  /* ================================================================ Zustand */

  var S = {
    mode: null,          // 'api' | 'demo'
    content: null,       // bearbeiteter Inhalt
    saved: '',           // JSON des zuletzt gespeicherten Stands
    dirty: false,
    csrf: null,
    mustChange: false,
    saving: false,
    section: 'termine',
    images: null,        // Cache Bildliste (API)
    maxUpload: 10 * 1024 * 1024
  };
  var app = document.getElementById('app');
  var mainEl = null;
  var uid = 0;

  /* ================================================================ Hilfen */

  function h(tag, props) {
    var el = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        var v = props[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'value') el.value = v;
        else if (k === 'checked') el.checked = !!v;
        else if (k === 'disabled') el.disabled = !!v;
        else if (k === 'hidden') el.hidden = !!v;
        else el.setAttribute(k, v === true ? '' : v);
      });
    }
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { add(el, x); }); return; }
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  function icon(name) {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('class', 'i');
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('focusable', 'false');
    s.innerHTML = ICONS[name] || '';
    return s;
  }
  function nid() { uid += 1; return 'f' + uid; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function isObj(o) { return !!o && typeof o === 'object' && !Array.isArray(o); }
  function str(v) { return v === null || v === undefined ? '' : String(v); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function todayISO() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function addDays(iso, n) {
    var p = String(iso || '').split('-');
    var d = p.length === 3 ? new Date(+p[0], +p[1] - 1, +p[2]) : new Date();
    d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function validDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) return false;
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    return d.getFullYear() === +m[1] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[3];
  }
  function fmtDate(iso) {
    if (!validDate(iso)) return { day: '?', mon: '', wd: '', long: 'Kein gültiges Datum' };
    var p = iso.split('-');
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return { day: String(+p[2]), mon: MONTHS[+p[1] - 1], wd: WD[d.getDay()], long: WD_LONG[d.getDay()] + ', ' + (+p[2]) + '. ' + MONTHS_LONG[+p[1] - 1] + ' ' + p[0] };
  }
  function imgUrl(p) {
    if (!p) return '';
    if (/^(data:|blob:|https?:)/.test(p)) return p;
    return '../' + String(p).replace(/^\.?\//, '');
  }
  function slug(s) {
    return String(s || '').toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'termin';
  }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { localStorage.setItem(k, v); } // Fehler (Quota) bewusst weiterreichen
  function lsRemove(k) { try { localStorage.removeItem(k); } catch (e) { /* ignorieren */ } }
  function fmtBytes(b) { return b > 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; }

  /* ================================================================ Inhalt normalisieren */

  function normalize(c) {
    c = isObj(c) ? c : {};
    var out = {};
    Object.keys(SKELETON).forEach(function (k) {
      var sk = SKELETON[k];
      if (Array.isArray(sk)) out[k] = Array.isArray(c[k]) ? c[k] : [];
      else if (isObj(sk)) out[k] = Object.assign({}, sk, isObj(c[k]) ? c[k] : {});
      else out[k] = typeof c[k] === 'string' ? c[k] : '';
    });
    out.about.highlights = (Array.isArray(out.about.highlights) ? out.about.highlights : []).filter(isObj)
      .map(function (x) { return Object.assign({ icon: 'beer', title: '', text: '' }, x); });
    while (out.about.highlights.length < 4) out.about.highlights.push({ icon: HL_ICONS[out.about.highlights.length][0], title: '', text: '' });
    if (!out.openingHours.length) out.openingHours = DAYS.map(function (d) { return { day: d, hours: '' }; });
    out.openingHours = out.openingHours.filter(isObj).map(function (x) { return Object.assign({ day: '', hours: '' }, x); });
    out.events = out.events.filter(isObj).map(function (e) {
      return Object.assign({ id: '', date: '', time: '', title: '', description: '', category: '', image: '' }, e);
    });
    out.gallery = out.gallery.filter(isObj).map(function (g) { return Object.assign({ src: '', caption: '' }, g); });
    out.banner.enabled = !!out.banner.enabled;
    out.summer.enabled = !!out.summer.enabled;
    out.tippspiel.enabled = !!out.tippspiel.enabled;
    return out;
  }

  function setContent(c, asSaved) {
    S.content = normalize(c);
    if (asSaved) markSaved(); else updateDirty();
  }

  /* ================================================================ API */

  function ApiError(message, status, data) {
    this.message = message; this.status = status || 0; this.data = data || null;
  }
  ApiError.prototype = Object.create(Error.prototype);

  function api(action, opts) {
    opts = opts || {};
    var method = opts.method || 'GET';
    var init = { method: method, credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } };
    if (method !== 'GET' && S.csrf) init.headers['X-CSRF-Token'] = S.csrf;
    if (opts.json !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(opts.json); }
    var url = API + '?action=' + encodeURIComponent(action) + (opts.query || '');
    return fetch(url, init).then(function (res) {
      return res.text().then(function (txt) {
        var data = null;
        try { data = JSON.parse(txt); } catch (e) { /* kein JSON */ }
        if (!data || typeof data !== 'object') throw new ApiError('Unerwartete Antwort vom Server (HTTP ' + res.status + ').', res.status);
        if (!res.ok || data.ok === false) throw new ApiError(data.error || ('Fehler (HTTP ' + res.status + ')'), res.status, data);
        return data;
      });
    }, function () {
      throw new ApiError('Keine Verbindung zum Server. Bitte Internetverbindung prüfen.', 0);
    });
  }

  /** Geschützte Aktion: bei abgelaufener Sitzung erneut anmelden und wiederholen. */
  function withAuth(fn) {
    return fn().catch(function (err) {
      if (err && (err.status === 401 || (err.status === 403 && err.data && err.data.csrfInvalid))) {
        return relogin().then(function (ok) {
          if (ok) return fn();
          throw new ApiError('Nicht angemeldet – die Aktion wurde abgebrochen.', 401);
        });
      }
      throw err;
    });
  }

  function xhrUpload(blob, filename, onProgress) {
    return new Promise(function (resolve, reject) {
      var fd = new FormData();
      fd.append('file', blob, filename);
      var x = new XMLHttpRequest();
      x.open('POST', API + '?action=upload');
      x.setRequestHeader('Accept', 'application/json');
      x.setRequestHeader('X-CSRF-Token', S.csrf || '');
      if (x.upload && onProgress) x.upload.onprogress = function (e) { if (e.lengthComputable) onProgress(e.loaded / e.total); };
      x.onload = function () {
        var d = null;
        try { d = JSON.parse(x.responseText); } catch (e) { /* */ }
        if (x.status >= 200 && x.status < 300 && d && d.ok) resolve(d);
        else reject(new ApiError((d && d.error) || ('Hochladen fehlgeschlagen (HTTP ' + x.status + ').'), x.status, d));
      };
      x.onerror = function () { reject(new ApiError('Keine Verbindung zum Server.', 0)); };
      x.send(fd);
    });
  }

  /* ================================================================ Bilder vorbereiten */

  function decodeImage(file) {
    if (window.createImageBitmap) {
      return createImageBitmap(file, { imageOrientation: 'from-image' })
        .catch(function () { return createImageBitmap(file); })
        .catch(function () { return decodeViaImg(file); });
    }
    return decodeViaImg(file);
  }
  function decodeViaImg(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { resolve(img); setTimeout(function () { URL.revokeObjectURL(url); }, 1000); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('decode')); };
      img.src = url;
    });
  }
  function drawScaled(src, maxDim, opaque) {
    var w = src.naturalWidth || src.width, hgt = src.naturalHeight || src.height;
    var scale = Math.min(1, maxDim / Math.max(w, hgt));
    var cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(hgt * scale));
    var cv = document.createElement('canvas');
    cv.width = cw; cv.height = ch;
    var ctx = cv.getContext('2d');
    if (opaque) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cw, ch); }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, cw, ch);
    return cv;
  }
  function canvasBlob(cv, type, q) {
    return new Promise(function (resolve, reject) {
      cv.toBlob(function (b) { if (b) resolve(b); else reject(new Error('encode')); }, type, q);
    });
  }

  /** Datei → Pfad (API) bzw. data:-URL (Demo). */
  function uploadImage(file, onProgress) {
    if (!file || !/^image\//.test(file.type || '') && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name || '')) {
      return Promise.reject(new Error('Bitte ein Foto auswählen (JPG, PNG oder WebP).'));
    }
    var okType = /^image\/(jpeg|png|webp)$/.test(file.type);
    var limit = Math.min(S.maxUpload || 10485760, 10485760);

    return decodeImage(file).then(function (img) {
      var w = img.naturalWidth || img.width, hgt = img.naturalHeight || img.height;
      if (S.mode === 'demo') {
        // Demo: kleines JPEG als data:-URL (localStorage ist auf ~5 MB begrenzt)
        return drawScaled(img, 1100, true).toDataURL('image/jpeg', 0.72);
      }
      if (okType && file.size <= Math.min(limit, 1.5 * 1048576) && Math.max(w, hgt) <= 2400) {
        return sendUpload(file, file.name, onProgress);
      }
      var keepPng = file.type === 'image/png' && file.size <= limit;
      return canvasBlob(drawScaled(img, 1920, !keepPng), keepPng ? 'image/png' : 'image/jpeg', 0.88)
        .then(function (b) { return b.size <= limit ? b : canvasBlob(drawScaled(img, 1600, true), 'image/jpeg', 0.8); })
        .then(function (b) {
          if (b.size > limit) throw new Error('Das Bild ist zu groß für den Server (max. ' + fmtBytes(limit) + ').');
          return sendUpload(b, slug(file.name.replace(/\.[^.]+$/, '')) + (b.type === 'image/png' ? '.png' : '.jpg'), onProgress);
        });
    }, function () {
      if (S.mode !== 'demo' && okType && file.size <= limit) return sendUpload(file, file.name, onProgress);
      throw new Error('Dieses Bild kann nicht gelesen werden. Bitte JPG, PNG oder WebP verwenden.');
    });
  }
  function sendUpload(blob, name, onProgress) {
    return withAuth(function () { return xhrUpload(blob, name, onProgress); }).then(function (r) {
      if (S.images) S.images.unshift({ path: r.path, source: 'uploads' });
      return r.path;
    });
  }
  function dataUrlToBlob(u) {
    var m = /^data:([^;,]+)(;base64)?,(.*)$/.exec(u);
    if (!m) return null;
    var bin = m[2] ? atob(m[3]) : decodeURIComponent(m[3]);
    var arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: m[1] });
  }
  /** Eingebettete Demo-Bilder (data:-URLs, z. B. aus importierter Demo-Datei) vor dem Speichern hochladen. */
  function uploadEmbeddedImages() {
    var c = S.content, refs = [];
    function ref(o, k) { if (o && typeof o[k] === 'string' && o[k].indexOf('data:') === 0) refs.push([o, k]); }
    ref(c.hero, 'image'); ref(c.summer, 'image');
    c.events.forEach(function (e) { ref(e, 'image'); });
    c.gallery.forEach(function (g) { ref(g, 'src'); });
    if (!refs.length) return Promise.resolve();
    toast(refs.length + ' eingebettete(s) Bild(er) werden hochgeladen …', 'info');
    return refs.reduce(function (p, r) {
      return p.then(function () {
        var b = dataUrlToBlob(r[0][r[1]]);
        if (!b) { r[0][r[1]] = ''; return; }
        return sendUpload(b, 'import.' + (b.type === 'image/png' ? 'png' : 'jpg')).then(function (path) { r[0][r[1]] = path; });
      });
    }, Promise.resolve());
  }

  /* ================================================================ Toasts & Dialoge */

  function toast(msg, type, ms) {
    type = type || 'info';
    var box = document.getElementById('toasts');
    var t = h('div', { class: 'toast ' + type, role: type === 'error' ? 'alert' : 'status' },
      icon(type === 'success' ? 'check' : type === 'error' ? 'alert' : 'info'),
      h('div', { class: 'msg' }, msg),
      h('button', { type: 'button', 'aria-label': 'Meldung schließen', onclick: function () { close(); } }, '×'));
    function close() { t.classList.add('leaving'); setTimeout(function () { t.remove(); }, 220); }
    box.appendChild(t);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(close, ms || (type === 'error' ? 8000 : 4200));
  }

  var modalDepth = 0;
  function openModal(o) {
    var titleId = nid();
    var prevFocus = document.activeElement;
    var closed = false;
    var ctl = {};
    var closeBtn = h('button', { type: 'button', class: 'btn btn-ghost btn-icon', 'aria-label': 'Schließen', onclick: function () { ctl.requestClose(); } }, icon('x'));
    var body = h('div', { class: 'modal-body' }, o.body);
    var dlg = h('div', { class: 'modal' + (o.size ? ' modal-' + o.size : '') + (o.full ? ' modal-full' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
      h('div', { class: 'modal-head' }, h('h3', { id: titleId }, o.title), closeBtn),
      body,
      o.foot ? h('div', { class: 'modal-foot' }, o.foot) : null);
    var bd = h('div', { class: 'modal-backdrop' }, dlg);
    bd.addEventListener('mousedown', function (e) { if (e.target === bd && o.backdropClose !== false) ctl.requestClose(); });
    bd.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.stopPropagation(); ctl.requestClose(); }
      if (e.key === 'Tab') { // Fokus im Dialog halten
        var f = dlg.querySelectorAll('button:not([disabled]), [href], input:not([type="hidden"]):not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    ctl.el = dlg;
    ctl.body = body;
    ctl.close = function (result) {
      if (closed) return;
      closed = true;
      bd.remove();
      modalDepth -= 1;
      if (modalDepth <= 0) { modalDepth = 0; document.body.classList.remove('modal-open'); }
      if (prevFocus && prevFocus.focus && document.contains(prevFocus)) prevFocus.focus();
      if (o.onClose) o.onClose(result);
    };
    ctl.requestClose = function () {
      if (o.beforeClose) Promise.resolve(o.beforeClose()).then(function (ok) { if (ok !== false) ctl.close(); });
      else ctl.close();
    };
    document.body.appendChild(bd);
    modalDepth += 1;
    document.body.classList.add('modal-open');
    setTimeout(function () {
      var first = o.focus || dlg.querySelector('.modal-body input:not([type="checkbox"]):not([type="file"]), .modal-body textarea, .modal-body select');
      (first || closeBtn).focus({ preventScroll: true });
    }, 30);
    return ctl;
  }

  function confirmDialog(message, o) {
    o = o || {};
    return new Promise(function (resolve) {
      var result = false;
      var ok = h('button', { type: 'button', class: 'btn ' + (o.danger ? 'btn-danger-solid' : 'btn-primary'), onclick: function () { result = true; m.close(); } }, o.ok || 'OK');
      var m = openModal({
        title: o.title || 'Bitte bestätigen',
        size: 'sm',
        body: h('p', { class: 'm0' }, message),
        foot: [h('button', { type: 'button', class: 'btn', onclick: function () { m.close(); } }, o.cancel || 'Abbrechen'), ok],
        focus: ok,
        onClose: function () { resolve(result); }
      });
    });
  }

  function pwInput(o) {
    var inp = h('input', { type: 'password', id: o.id || nid(), autocomplete: o.autocomplete || 'current-password', autocapitalize: 'off', spellcheck: 'false', required: o.required ? true : null });
    var btn = h('button', { type: 'button', class: 'btn btn-ghost btn-icon', 'aria-label': 'Passwort anzeigen', title: 'Passwort anzeigen' }, icon('eye'));
    btn.addEventListener('click', function () {
      var show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      btn.replaceChildren(icon(show ? 'eyeoff' : 'eye'));
      btn.setAttribute('aria-label', show ? 'Passwort verbergen' : 'Passwort anzeigen');
    });
    return { input: inp, el: h('div', { class: 'pw-wrap' }, inp, btn) };
  }

  /** Sitzung abgelaufen → erneut anmelden, ohne Änderungen zu verlieren. */
  function relogin() {
    return new Promise(function (resolve) {
      var ok = false;
      var pw = pwInput({});
      var err = h('div', { class: 'notice notice-danger', role: 'alert', hidden: true });
      var submit = h('button', { type: 'submit', class: 'btn btn-primary', form: 'relogin-form' }, 'Anmelden');
      var form = h('form', { id: 'relogin-form', class: 'fields' },
        h('div', { class: 'notice notice-info' }, icon('lock'), h('div', null, 'Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an – Ihre Änderungen bleiben erhalten.')),
        err, field('Passwort', pw.el, { forId: pw.input.id }));
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        submit.disabled = true;
        doLogin(pw.input.value).then(function () { ok = true; m.close(); }, function (ex) {
          err.hidden = false; err.textContent = ex.message; submit.disabled = false; pw.input.select();
        });
      });
      var m = openModal({
        title: 'Erneut anmelden', size: 'sm', body: form, backdropClose: false,
        foot: [h('button', { type: 'button', class: 'btn', onclick: function () { m.close(); } }, 'Abbrechen'), submit],
        focus: pw.input,
        onClose: function () { resolve(ok); }
      });
    });
  }

  /* ================================================================ Formular-Bausteine */

  function field(label, control, o) {
    o = o || {};
    var id = o.forId || (control.matches && control.matches('input, select, textarea') ? (control.id || (control.id = nid())) : null);
    var head = h(id ? 'label' : 'span', { class: 'label', for: id },
      h('span', null, label, o.optional ? h('span', { class: 'opt' }, ' (optional)') : null), o.counter || null);
    var help = o.help ? h('span', { class: 'help', id: id ? id + '-help' : null }, o.help) : null;
    if (help && id && control.setAttribute) control.setAttribute('aria-describedby', id + '-help');
    return h('div', { class: 'field' + (o.cls ? ' ' + o.cls : '') }, head, control, help);
  }

  /** Gebundenes Text-/Textfeld. o: type, max, placeholder, multiline, rows, cls, onInput, list, inputmode, autocomplete */
  function input(obj, key, o) {
    o = o || {};
    var el = o.multiline
      ? h('textarea', { rows: o.rows || 4, class: o.cls || null, placeholder: o.placeholder || null })
      : h('input', { type: o.type || 'text', class: o.cls || null, placeholder: o.placeholder || null, maxlength: o.max || null, list: o.list || null, inputmode: o.inputmode || null, autocomplete: o.autocomplete || 'off' });
    el.value = str(obj[key]);
    var counter = null;
    if (o.multiline && o.max) {
      counter = h('span', { class: 'counter', 'aria-live': 'off' });
      var upd = function () {
        var n = el.value.length;
        counter.textContent = n.toLocaleString('de-DE') + ' / ' + o.max.toLocaleString('de-DE');
        counter.classList.toggle('over', n > o.max);
      };
      upd();
      el.addEventListener('input', upd);
    }
    el.addEventListener('input', function () {
      obj[key] = el.value;
      if (o.onInput) o.onInput(el.value); else changed();
    });
    el._counter = counter;
    return el;
  }
  /** Feld + gebundenes Eingabeelement in einem Schritt */
  function tf(label, obj, key, o) {
    o = o || {};
    var el = input(obj, key, o);
    return field(label, el, { help: o.help, optional: o.optional, counter: el._counter, cls: o.fieldCls });
  }

  function toggle(obj, key, label, onText, offText, onChange) {
    var inp = h('input', { type: 'checkbox', role: 'switch' });
    inp.checked = !!obj[key];
    var st = h('span', { class: 'switch-state' });
    function upd() { st.textContent = inp.checked ? onText : offText; }
    inp.addEventListener('change', function () { obj[key] = inp.checked; upd(); changed(); if (onChange) onChange(inp.checked); });
    upd();
    return h('label', { class: 'switch' }, inp, h('span', { class: 'track' }), h('span', null, h('span', { class: 'switch-label' }, label), st));
  }

  function imageField(obj, key, o) {
    o = o || {};
    var wrap = h('div', { class: 'image-field' });
    function render() {
      var p = obj[key];
      wrap.replaceChildren(
        h('div', { class: 'thumb' }, p ? h('img', { src: imgUrl(p), alt: o.alt || 'Ausgewähltes Bild', loading: 'lazy' }) : 'Kein Bild'),
        h('div', { class: 'btns' },
          h('button', {
            type: 'button', class: 'btn btn-sm', onclick: function () {
              pickImage({ current: p }).then(function (r) {
                if (r) { obj[key] = r; (o.onChange || changed)(); render(); }
              });
            }
          }, icon('image'), p ? 'Bild ändern' : 'Bild wählen'),
          p && o.removable ? h('button', { type: 'button', class: 'btn btn-sm btn-danger', onclick: function () { obj[key] = ''; (o.onChange || changed)(); render(); } }, icon('x'), 'Entfernen') : null));
    }
    render();
    return wrap;
  }

  function sectionHead(title, desc, actions) {
    return h('div', { class: 'section-head' },
      h('div', null, h('h2', null, title), desc ? h('p', null, desc) : null),
      actions && actions.length ? h('div', { class: 'actions' }, actions) : null);
  }
  function card(title, sub) {
    var c = h('section', { class: 'card' }, title ? h('h3', null, title) : null, sub ? h('p', { class: 'card-sub' }, sub) : null);
    for (var i = 2; i < arguments.length; i++) add(c, arguments[i]);
    return c;
  }
  function notice(type, iconName, content) {
    return h('div', { class: 'notice notice-' + type }, icon(iconName), h('div', null, content));
  }
  function btn(label, iconName, onclick, cls, extra) {
    return h('button', Object.assign({ type: 'button', class: 'btn ' + (cls || ''), onclick: onclick }, extra || {}), iconName ? icon(iconName) : null, label ? h('span', { class: 'lbl' }, label) : null);
  }

  /* ================================================================ Bildauswahl */

  function collectReferencedImages() {
    var c = S.content, list = [];
    [c.hero.image, c.summer.image].forEach(function (p) { if (p) list.push(p); });
    c.events.forEach(function (e) { if (e.image) list.push(e.image); });
    c.gallery.forEach(function (g) { if (g.src) list.push(g.src); });
    return list;
  }
  function loadImageList() {
    var refs = collectReferencedImages();
    var p;
    if (S.mode === 'api') {
      p = S.images ? Promise.resolve(S.images) : withAuth(function () { return api('images'); }).then(function (r) { S.images = r.images || []; return S.images; }, function () { return []; });
    } else {
      p = Promise.resolve(DEMO_IMAGES.map(function (x) { return { path: x, source: 'assets' }; }));
    }
    return p.then(function (server) {
      var seen = {}, out = [];
      function push(path, source) { if (path && !seen[path]) { seen[path] = 1; out.push({ path: path, source: source }); } }
      server.forEach(function (i) { push(i.path, i.source); });
      refs.forEach(function (r) { push(r, r.indexOf('data:') === 0 ? 'demo' : r.indexOf('cms/uploads/') === 0 ? 'uploads' : 'assets'); });
      // Hochgeladene zuerst, dann Standardbilder
      return out.filter(function (i) { return i.source !== 'assets'; }).concat(out.filter(function (i) { return i.source === 'assets'; }));
    });
  }

  function pickImage(o) {
    o = o || {};
    return new Promise(function (resolve) {
      var result = null;
      var fileIn = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/*', class: 'sr-only', tabindex: '-1' });
      var zoneText = h('strong', null, 'Neues Foto hochladen');
      var prog = h('div', { class: 'progress', hidden: true }, h('span'));
      var zone = h('button', { type: 'button', class: 'dropzone', onclick: function () { fileIn.click(); } },
        icon('upload'), zoneText, h('small', null, 'Vom Handy oder Computer · JPG, PNG oder WebP · max. 10 MB'), prog);
      var grid = h('div', { class: 'pick-grid' }, h('p', { class: 'help' }, 'Bilder werden geladen …'));
      function handle(file) {
        if (!file) return;
        zone.disabled = true;
        zoneText.textContent = 'Wird hochgeladen …';
        prog.hidden = false;
        uploadImage(file, function (f) { prog.firstChild.style.width = Math.round(f * 100) + '%'; }).then(function (path) {
          result = path;
          toast('Bild hochgeladen.', 'success');
          m.close();
        }, function (err) {
          zone.disabled = false;
          zoneText.textContent = 'Neues Foto hochladen';
          prog.hidden = true;
          toast(err.message || 'Hochladen fehlgeschlagen.', 'error');
        });
      }
      fileIn.addEventListener('change', function () { handle(fileIn.files[0]); fileIn.value = ''; });
      ['dragover', 'dragenter'].forEach(function (ev) { zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.add('drag'); }); });
      ['dragleave', 'drop'].forEach(function (ev) { zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.remove('drag'); }); });
      zone.addEventListener('drop', function (e) { if (e.dataTransfer && e.dataTransfer.files[0]) handle(e.dataTransfer.files[0]); });

      var m = openModal({
        title: o.title || 'Bild auswählen', size: 'lg',
        body: [zone, fileIn, h('div', { class: 'pick-title' }, 'Oder vorhandenes Bild wählen'), grid],
        foot: [h('button', { type: 'button', class: 'btn', onclick: function () { m.close(); } }, 'Abbrechen')],
        focus: zone,
        onClose: function () { resolve(result); }
      });

      loadImageList().then(function (list) {
        grid.replaceChildren();
        if (!list.length) grid.appendChild(h('p', { class: 'help' }, 'Noch keine Bilder vorhanden.'));
        list.forEach(function (it) {
          var sel = it.path === o.current;
          var tag = { uploads: 'Hochgeladen', assets: 'Standard', demo: 'Demo' }[it.source] || '';
          grid.appendChild(h('button', {
            type: 'button', class: 'pick-tile' + (sel ? ' selected' : ''), title: it.path.indexOf('data:') === 0 ? 'Demo-Bild' : it.path,
            'aria-label': (sel ? 'Aktuelles Bild: ' : 'Bild wählen: ') + (it.path.indexOf('data:') === 0 ? 'Demo-Bild' : it.path.split('/').pop()),
            onclick: function () { result = it.path; m.close(); }
          }, h('img', { src: imgUrl(it.path), alt: '', loading: 'lazy', onerror: function (e) { e.target.closest('.pick-tile').remove(); } }),
          tag ? h('span', { class: 'tag' }, tag) : null,
          sel ? h('span', { class: 'check' }, icon('check')) : null));
        });
      });
    });
  }

  /* ================================================================ Änderungen & Speichern */

  var dirtyTimer = null;
  function changed() { clearTimeout(dirtyTimer); dirtyTimer = setTimeout(updateDirty, 120); }
  function updateDirty() {
    if (!S.content) return;
    var d = JSON.stringify(S.content) !== S.saved;
    if (d !== S.dirty) { S.dirty = d; renderDirty(); }
  }
  function markSaved() { S.saved = JSON.stringify(S.content); S.dirty = false; renderDirty(); }
  function renderDirty() {
    var pill = document.getElementById('dirty-pill');
    var dot = document.getElementById('save-dot');
    if (pill) pill.hidden = !S.dirty;
    if (dot) dot.hidden = !S.dirty;
    document.title = (S.dirty ? '● ' : '') + 'Verwaltung · Hofbräustüble';
  }

  function validateClient(c) {
    var errs = [];
    var mailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    var urlRe = /^https?:\/\/\S+$/i;
    c.events.forEach(function (e) {
      var name = e.title ? '„' + e.title + '“' : 'ohne Titel';
      if (!str(e.title).trim()) errs.push(['termine', 'Ein Termin (' + (e.date || 'ohne Datum') + ') hat keinen Titel.']);
      if (!validDate(e.date)) errs.push(['termine', 'Termin ' + name + ' hat kein gültiges Datum.']);
      if (e.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(e.time)) errs.push(['termine', 'Termin ' + name + ' hat eine ungültige Uhrzeit.']);
    });
    c.gallery.forEach(function (g, i) { if (!g.src) errs.push(['galerie', 'Galerie-Bild ' + (i + 1) + ' hat keine Bilddatei.']); });
    if (c.contact.email && !mailRe.test(c.contact.email.trim())) errs.push(['kontakt', 'Die E-Mail-Adresse unter „Kontakt“ ist ungültig.']);
    if (c.impressum.email && !mailRe.test(c.impressum.email.trim())) errs.push(['impressum', 'Die E-Mail-Adresse im Impressum ist ungültig.']);
    [['Google-Maps-Link', c.contact.mapsUrl], ['Facebook-Link', c.social.facebook], ['Instagram-Link', c.social.instagram]].forEach(function (u) {
      if (u[1] && !urlRe.test(u[1].trim())) errs.push(['kontakt', 'Der ' + u[0] + ' muss mit https:// beginnen.']);
    });
    return errs;
  }

  function save() {
    if (S.saving || !S.content) return Promise.resolve();
    clearTimeout(dirtyTimer);
    updateDirty();
    if (!S.dirty) { toast('Keine Änderungen zum Speichern.', 'info', 2500); return Promise.resolve(); }
    var errs = validateClient(S.content);
    if (errs.length) {
      toast(errs[0][1] + (errs.length > 1 ? ' (+' + (errs.length - 1) + ' weitere)' : ''), 'error');
      if (S.section !== errs[0][0]) go(errs[0][0]);
      return Promise.resolve();
    }
    setSaving(true);
    var p;
    if (S.mode === 'demo') {
      p = new Promise(function (resolve) {
        var prev = S.content.meta.lastUpdated;
        S.content.meta.lastUpdated = todayISO();
        try {
          lsSet(LS_CONTENT, JSON.stringify(S.content));
          lsSet(LS_MODE, '1');
        } catch (e) {
          S.content.meta.lastUpdated = prev;
          throw new Error('Der Speicher dieses Browsers ist voll. Bitte weniger oder kleinere Bilder verwenden.');
        }
        markSaved();
        toast('Gespeichert – im Demo-Modus nur in diesem Browser sichtbar.', 'success');
        resolve();
      });
    } else {
      p = uploadEmbeddedImages().then(function () {
        return withAuth(function () { return api('save', { method: 'POST', json: { content: S.content } }); });
      }).then(function (r) {
        S.content.meta.lastUpdated = r.lastUpdated;
        if (r.content && JSON.stringify(normalize(r.content)) !== JSON.stringify(S.content)) {
          setContent(r.content, true);
          showSection(S.section, true);
        }
        markSaved();
        toast('Gespeichert! Die Website ist jetzt aktuell.', 'success');
      });
    }
    return p.catch(function (err) {
      var msg = err.message || 'Speichern fehlgeschlagen.';
      if (err.data && err.data.errors && err.data.errors.length > 1) msg += ' (insgesamt ' + err.data.errors.length + ' Fehler)';
      toast(msg, 'error', 10000);
      if (err.data && err.data.errors && window.console) console.warn('Validierungsfehler:', err.data.errors);
    }).then(function () { setSaving(false); });
  }
  function setSaving(on) {
    S.saving = on;
    var b = document.getElementById('save-btn');
    if (!b) return;
    b.disabled = on;
    b.querySelector('.lbl').textContent = on ? 'Speichert …' : 'Speichern';
    var ic = b.querySelector('svg, .spinner');
    if (ic) ic.replaceWith(on ? h('span', { class: 'spinner', 'aria-hidden': 'true' }) : icon('save'));
  }

  /* ================================================================ Start */

  function boot() {
    fetch(API + '?action=status', { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } })
      .then(function (res) {
        return res.text().then(function (txt) {
          var st = null;
          try { st = JSON.parse(txt); } catch (e) { /* kein JSON → kein PHP */ }
          if (st && st.api === 'hbs-cms') return startApi(st);
          if (res.status >= 500) return renderProblem('server');
          return startDemo();
        });
      }, function () {
        if (navigator.onLine === false) return renderProblem('offline');
        return startDemo();
      });
  }

  function startApi(st) {
    S.mode = 'api';
    lsRemove(LS_MODE); // echte API: Varianten sollen wieder content.json lesen
    if (st.maxUploadBytes) S.maxUpload = st.maxUploadBytes;
    if (st.loggedIn) {
      S.csrf = st.csrf;
      S.mustChange = !!st.mustChangePassword;
      return loadApiContent().then(renderApp, function (e) { renderProblem('load', e.message); });
    }
    renderLogin();
  }

  function loadApiContent() {
    return api('get').then(function (c) { setContent(c, true); });
  }

  function startDemo() {
    S.mode = 'demo';
    var stored = lsGet(LS_CONTENT);
    if (stored && lsGet(LS_MODE) === '1') {
      try { setContent(JSON.parse(stored), true); renderApp(); return; } catch (e) { /* defekt → neu laden */ }
    }
    return loadDemoOriginal().then(renderApp, function () { renderProblem('file'); });
  }
  function loadDemoOriginal() {
    return fetch('../cms/content.json?v=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (c) { setContent(c, true); });
  }

  function renderProblem(kind, detail) {
    var texts = {
      server: ['Server-Fehler', 'Die Verwaltung ist gerade nicht erreichbar (Fehler im PHP-Skript). Bitte später erneut versuchen oder den Hosting-Support kontaktieren.'],
      offline: ['Keine Internetverbindung', 'Bitte Verbindung prüfen und erneut versuchen.'],
      load: ['Inhalte konnten nicht geladen werden', detail || ''],
      file: ['Inhalte nicht gefunden', 'Die Datei cms/content.json konnte nicht geladen werden. Bitte die Verwaltung über einen Webserver öffnen (nicht direkt als Datei).']
    }[kind];
    app.replaceChildren(h('div', { class: 'login-wrap' }, h('div', { class: 'login-card' },
      h('div', { class: 'login-brand' }, h('div', { class: 'brand-mark' }, 'H'), h('h1', null, texts[0])),
      notice(kind === 'offline' ? 'info' : 'danger', 'alert', texts[1]),
      h('div', { class: 'fields' },
        h('button', { type: 'button', class: 'btn btn-primary btn-block', onclick: function () { location.reload(); } }, 'Erneut versuchen'),
        kind === 'server' ? h('button', { type: 'button', class: 'btn btn-block', onclick: function () { startDemo(); } }, 'Trotzdem im Demo-Modus öffnen') : null))));
  }

  /* ================================================================ Login */

  function doLogin(password) {
    return api('login', { method: 'POST', json: { password: password } }).then(function (r) {
      S.csrf = r.csrf;
      S.mustChange = !!r.mustChangePassword;
      return r;
    }, function (err) {
      if (err.status === 401 && err.data && typeof err.data.attemptsLeft === 'number') {
        err.message = 'Falsches Passwort.' + (err.data.attemptsLeft > 0 ? ' Noch ' + err.data.attemptsLeft + (err.data.attemptsLeft === 1 ? ' Versuch' : ' Versuche') + ', dann wird der Login für 15 Minuten gesperrt.' : '');
      }
      throw err;
    });
  }

  function renderLogin(message) {
    document.title = 'Anmelden · Hofbräustüble';
    var pw = pwInput({ id: 'login-pw', required: true });
    var err = h('div', { class: 'notice notice-danger', role: 'alert', hidden: true });
    var info = message ? notice('success', 'check', message) : null;
    var submit = h('button', { type: 'submit', class: 'btn btn-primary btn-block' }, 'Anmelden');
    var form = h('form', { novalidate: true },
      info, err,
      field('Passwort', pw.el, { forId: pw.input.id }),
      submit);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!pw.input.value) { err.hidden = false; err.textContent = 'Bitte das Passwort eingeben.'; pw.input.focus(); return; }
      submit.disabled = true;
      submit.textContent = 'Anmelden …';
      err.hidden = true;
      doLogin(pw.input.value).then(function () {
        return loadApiContent().then(function () {
          renderApp();
          toast('Willkommen zurück!', 'success', 2500);
        });
      }).catch(function (ex) {
        err.hidden = false;
        err.textContent = ex.message;
        submit.disabled = false;
        submit.textContent = 'Anmelden';
        pw.input.select();
      });
    });
    app.replaceChildren(h('div', { class: 'login-wrap' }, h('main', { class: 'login-card' },
      h('div', { class: 'login-brand' }, h('div', { class: 'brand-mark', 'aria-hidden': 'true' }, 'H'),
        h('h1', null, 'Hofbräustüble'), h('p', null, 'Verwaltung der Website')),
      form,
      h('p', { class: 'login-foot' }, h('a', { href: '../' }, '← Zur Website')))));
    setTimeout(function () { pw.input.focus(); }, 50);
  }

  function logout() {
    var go2 = S.dirty ? confirmDialog('Es gibt ungespeicherte Änderungen. Trotzdem abmelden? Die Änderungen gehen verloren.', { ok: 'Abmelden', danger: true }) : Promise.resolve(true);
    go2.then(function (ok) {
      if (!ok) return;
      api('logout', { method: 'POST' }).catch(function () { /* egal */ }).then(function () {
        S.csrf = null; S.content = null; S.saved = ''; S.dirty = false; S.images = null;
        T.data = null; T.loadedAt = 0;
        renderLogin('Sie wurden abgemeldet.');
      });
    });
  }

  /* ================================================================ Hauptansicht */

  function renderApp() {
    var hash = location.hash.replace('#', '').split('/');
    if (SECTIONS.some(function (s) { return s.id === hash[0]; })) S.section = hash[0];
    if (hash[0] === 'tippspiel') setTippSub(hash[1]);

    var preview = h('details', { class: 'dropdown' },
      h('summary', { class: 'btn btn-preview', 'aria-label': 'Vorschau öffnen' }, icon('eye'), h('span', { class: 'lbl' }, 'Vorschau')),
      h('div', { class: 'dropdown-menu' },
        PREVIEWS.map(function (p) { return h('a', { href: p[0], target: '_blank', rel: 'noopener' }, icon('external'), p[1]); }),
        h('div', { class: 'hint' }, 'Die Vorschau zeigt den zuletzt gespeicherten Stand.')));

    var saveBtn = h('button', { type: 'button', id: 'save-btn', class: 'btn btn-primary save-btn', onclick: save },
      icon('save'), h('span', { class: 'lbl' }, 'Speichern'), h('span', { class: 'dot', id: 'save-dot', hidden: true, 'aria-hidden': 'true' }));

    var top = h('div', { class: 'topwrap' }, h('header', { class: 'topbar' },
      h('a', { class: 'brand', href: '#termine', 'aria-label': 'Hofbräustüble Verwaltung' }, h('span', { class: 'brand-mark', 'aria-hidden': 'true' }, 'H'),
        h('span', { class: 'brand-text' }, h('strong', null, 'Hofbräustüble'), h('small', null, S.mode === 'demo' ? 'Verwaltung · Demo' : 'Verwaltung'))),
      h('div', { class: 'top-actions' },
        h('span', { class: 'dirty-pill', id: 'dirty-pill', hidden: true }, 'Nicht gespeichert'),
        preview, saveBtn)));

    var nav = h('nav', { class: 'nav', 'aria-label': 'Bereiche' },
      SECTIONS.map(function (s) {
        return h('a', { class: 'nav-item', href: '#' + s.id, 'data-id': s.id, onclick: function (e) { e.preventDefault(); go(s.id); } }, icon(s.icon), s.label);
      }),
      S.mode === 'api' ? [h('div', { class: 'nav-sep' }), h('button', { type: 'button', class: 'nav-item nav-desktop-only', onclick: logout }, icon('logout'), 'Abmelden')] : null);

    mainEl = h('main', { class: 'main', id: 'main', tabindex: '-1' });
    var banner = S.mode === 'demo' ? h('div', { class: 'demo-banner', role: 'status' }, icon('info'),
      h('span', null, 'Demo-Modus – Änderungen werden nur in diesem Browser gespeichert')) : null;

    app.replaceChildren(banner || '', top, h('div', { class: 'layout' }, nav, mainEl));
    showSection(S.section, true);
    renderDirty();
  }

  function go(id) {
    var hash = id === 'tippspiel' ? 'tippspiel/' + T.sub : id;
    if (location.hash !== '#' + hash) history.replaceState(null, '', '#' + hash);
    showSection(id);
  }

  function showSection(id, keepScroll) {
    var sec = SECTIONS.filter(function (s) { return s.id === id; })[0] || SECTIONS[0];
    S.section = sec.id;
    if (!mainEl) return;
    var y = window.scrollY;
    mainEl.replaceChildren();
    if (S.mode === 'api' && S.mustChange) {
      mainEl.appendChild(h('div', { class: 'notice notice-warn notice-strong', role: 'alert' }, icon('lock'), h('div', null,
        h('strong', null, 'Bitte ändern Sie jetzt das Start-Passwort!'),
        h('p', null, 'Sie verwenden noch das Passwort aus der Anleitung. Solange es nicht geändert ist, könnte jeder, der die Anleitung kennt, Ihre Website bearbeiten.'),
        sec.id !== 'einstellungen' ? h('button', { type: 'button', class: 'btn btn-primary btn-sm', onclick: function () { go('einstellungen'); setTimeout(function () { var f = document.getElementById('pw-current'); if (f) f.focus(); }, 50); } }, 'Passwort jetzt ändern') : null)));
    }
    mainEl.appendChild(sec.render());
    document.querySelectorAll('.nav-item[data-id]').forEach(function (a) {
      if (a.getAttribute('data-id') === sec.id) {
        a.setAttribute('aria-current', 'page');
        if (a.scrollIntoView && window.innerWidth <= 960) a.scrollIntoView({ block: 'nearest', inline: 'center' });
      } else a.removeAttribute('aria-current');
    });
    if (keepScroll) window.scrollTo(0, y); else window.scrollTo(0, 0);
  }

  /* ================================================================ Bereich: Termine */

  function sortedEvents() {
    return S.content.events.slice().sort(function (a, b) { return (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')); });
  }
  function knownCategories() {
    var set = {};
    DEFAULT_CATEGORIES.concat(S.content.events.map(function (e) { return e.category; })).forEach(function (c) { if (c) set[c] = 1; });
    return Object.keys(set);
  }

  function renderEvents() {
    var today = todayISO();
    var all = sortedEvents();
    var upcoming = all.filter(function (e) { return e.date >= today; });
    var past = all.filter(function (e) { return !(e.date >= today); }).reverse();
    var wrap = h('div', null, sectionHead('Termine', 'Veranstaltungen erscheinen automatisch auf der Website – sortiert nach Datum. Vergangene Termine werden dort ausgeblendet.',
      [btn('Neuer Termin', 'plus', function () { openEventEditor(null); }, 'btn-primary')]));

    if (!upcoming.length) {
      wrap.appendChild(h('div', { class: 'empty' }, icon('calendar'), h('p', null, 'Keine kommenden Termine.'),
        btn('Ersten Termin anlegen', 'plus', function () { openEventEditor(null); }, 'btn-primary')));
    } else {
      wrap.appendChild(h('div', { class: 'ev-list' }, upcoming.map(function (e) { return eventCard(e, false, today); })));
    }
    if (past.length) {
      wrap.appendChild(h('details', { class: 'past-box' },
        h('summary', null, h('span', { class: 'chev' }, icon('chevron')), 'Vergangene Termine', h('span', { class: 'badge badge-muted' }, String(past.length))),
        h('div', { class: 'past-inner' },
          past.map(function (e) { return eventCard(e, true, today); }),
          h('div', null, btn('Alle vergangenen Termine löschen', 'trash', function () {
            confirmDialog(past.length + ' vergangene Termine endgültig löschen?', { ok: 'Löschen', danger: true }).then(function (ok) {
              if (!ok) return;
              S.content.events = S.content.events.filter(function (e) { return past.indexOf(e) < 0; });
              changed(); showSection('termine', true);
              toast('Vergangene Termine entfernt. Zum Übernehmen „Speichern“ klicken.', 'info');
            });
          }, 'btn-danger btn-sm')))));
    }
    return wrap;
  }

  function eventCard(e, isPast, today) {
    var f = fmtDate(e.date);
    return h('article', { class: 'ev' + (isPast ? ' is-past' : '') + (e.date === today ? ' is-today' : '') },
      h('div', { class: 'ev-date', 'aria-hidden': 'true' }, h('span', { class: 'd' }, f.day), h('span', { class: 'm' }, f.mon), h('span', { class: 'w' }, f.wd)),
      h('button', { type: 'button', class: 'ev-main', onclick: function () { openEventEditor(e); } },
        h('div', { class: 'txt' },
          h('div', { class: 'ev-title' }, e.title || '(ohne Titel)'),
          h('div', { class: 'ev-meta' }, h('span', null, f.long + (e.time ? ' · ' + e.time + ' Uhr' : '')), e.category ? h('span', { class: 'badge' }, e.category) : null),
          e.description ? h('div', { class: 'ev-desc' }, e.description) : null),
        e.image ? h('img', { class: 'ev-thumb', src: imgUrl(e.image), alt: '', loading: 'lazy' }) : null),
      h('div', { class: 'ev-actions' },
        btn('Bearbeiten', 'edit', function () { openEventEditor(e); }, 'btn-sm', { 'aria-label': 'Bearbeiten: ' + e.title }),
        btn('Duplizieren', 'copy', function () { openEventEditor(e, true); }, 'btn-sm', { 'aria-label': 'Duplizieren: ' + e.title }),
        btn('Löschen', 'trash', function () { deleteEvent(e); }, 'btn-sm btn-danger', { 'aria-label': 'Löschen: ' + e.title })));
  }

  function deleteEvent(e) {
    return confirmDialog('Termin „' + (e.title || 'ohne Titel') + '“ am ' + fmtDate(e.date).long + ' wirklich löschen?', { title: 'Termin löschen', ok: 'Löschen', danger: true }).then(function (ok) {
      if (!ok) return false;
      S.content.events = S.content.events.filter(function (x) { return x !== e; });
      changed(); showSection('termine', true);
      toast('Termin gelöscht. Zum Übernehmen „Speichern“ klicken.', 'info');
      return true;
    });
  }

  function makeEventId(ev) {
    var base = 'ev-' + ev.date + '-' + slug(ev.title);
    var id = base, n = 2;
    var ids = S.content.events.map(function (e) { return e.id; });
    while (ids.indexOf(id) >= 0) { id = base + '-' + n; n += 1; }
    return id;
  }

  function openEventEditor(ev, isCopy) {
    var isNew = !ev || !!isCopy;
    var draft = ev ? clone(ev) : { id: '', date: addDays(todayISO(), 1), time: '19:00', title: '', description: '', category: '', image: '' };
    if (isCopy) { draft.id = ''; draft.date = addDays(ev.date, 7); }
    var start = JSON.stringify(draft);
    var listId = nid();
    var dl = h('datalist', { id: listId }, knownCategories().map(function (c) { return h('option', { value: c }); }));
    var noop = function () {};
    var titleIn = input(draft, 'title', { max: 150, placeholder: 'z. B. Skat-Abend', onInput: noop });
    var dateIn = input(draft, 'date', { type: 'date', onInput: noop });
    var timeIn = input(draft, 'time', { type: 'time', onInput: noop });
    var errBox = h('div', { class: 'notice notice-danger', role: 'alert', hidden: true });

    var body = h('div', { class: 'fields' },
      isCopy ? notice('info', 'copy', 'Kopie von „' + ev.title + '“ – das Datum wurde um eine Woche verschoben. Bitte prüfen.') : null,
      errBox,
      field('Titel', titleIn),
      h('div', { class: 'grid-2' },
        field('Datum', dateIn),
        field('Uhrzeit', timeIn, { optional: true, help: 'Leer lassen, wenn es keine feste Uhrzeit gibt.' })),
      field('Kategorie', input(draft, 'category', { max: 60, list: listId, placeholder: 'z. B. Sport, Feier, Stammtisch', onInput: noop }), { optional: true, help: 'Vorschläge erscheinen beim Tippen – oder eigene Kategorie eingeben.' }),
      dl,
      tf('Beschreibung', draft, 'description', { multiline: true, rows: 4, max: 5000, optional: true, onInput: noop, placeholder: 'Was erwartet die Gäste?' }),
      field('Bild', imageField(draft, 'image', { removable: true, onChange: noop }), { optional: true, help: 'Wird bei diesem Termin auf der Website angezeigt.' }));

    function apply() {
      draft.title = draft.title.trim();
      var errs = [];
      [titleIn, dateIn, timeIn].forEach(function (el) { el.classList.remove('invalid'); });
      if (!draft.title) { errs.push('Bitte einen Titel eingeben.'); titleIn.classList.add('invalid'); }
      if (!validDate(draft.date)) { errs.push('Bitte ein gültiges Datum wählen.'); dateIn.classList.add('invalid'); }
      if (draft.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time)) { errs.push('Bitte eine gültige Uhrzeit (HH:MM) eingeben oder leer lassen.'); timeIn.classList.add('invalid'); }
      if (errs.length) { errBox.hidden = false; errBox.textContent = errs.join(' '); m.body.scrollTop = 0; return; }
      if (isNew) {
        draft.id = makeEventId(draft);
        S.content.events.push(draft);
      } else {
        var i = S.content.events.indexOf(ev);
        if (i >= 0) S.content.events[i] = draft; else S.content.events.push(draft);
      }
      start = JSON.stringify(draft);
      changed();
      m.close();
      showSection('termine', true);
      toast(isNew ? 'Termin hinzugefügt. Zum Veröffentlichen oben „Speichern“ klicken.' : 'Termin geändert. Zum Veröffentlichen oben „Speichern“ klicken.', 'info');
    }

    var m = openModal({
      title: isCopy ? 'Termin duplizieren' : isNew ? 'Neuer Termin' : 'Termin bearbeiten',
      body: body, full: true, backdropClose: false,
      focus: titleIn,
      beforeClose: function () {
        if (JSON.stringify(draft) === start) return true;
        return confirmDialog('Ihre Eingaben in diesem Termin verwerfen?', { ok: 'Verwerfen', danger: true });
      },
      foot: [
        !isNew ? h('button', { type: 'button', class: 'btn btn-danger', onclick: function () { deleteEvent(ev).then(function (ok) { if (ok) { start = JSON.stringify(draft); m.close(); } }); } }, icon('trash'), h('span', { class: 'lbl' }, 'Löschen')) : null,
        h('span', { class: 'spacer' }),
        h('button', { type: 'button', class: 'btn', onclick: function () { m.requestClose(); } }, 'Abbrechen'),
        h('button', { type: 'button', class: 'btn btn-primary', onclick: apply }, icon('check'), isNew ? 'Hinzufügen' : 'Übernehmen')
      ]
    });
  }

  /* ================================================================ Bereich: Galerie */

  function renderGallery() {
    var fileIn = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/*', multiple: true, class: 'sr-only', tabindex: '-1' });
    var uploads = h('div', { class: 'gal-list mb' });
    var list = h('div', { class: 'gal-list' });

    function renderList(focusSel) {
      var g = S.content.gallery;
      list.replaceChildren();
      if (!g.length) {
        list.appendChild(h('div', { class: 'empty' }, icon('image'), h('p', null, 'Noch keine Bilder in der Galerie.')));
        return;
      }
      g.forEach(function (item, i) {
        var capId = nid();
        list.appendChild(h('div', { class: 'gal' },
          h('div', { class: 'thumb' }, h('img', { src: imgUrl(item.src), alt: item.caption || 'Galerie-Bild ' + (i + 1), loading: 'lazy' }), h('span', { class: 'pos' }, String(i + 1))),
          h('div', { class: 'gal-body' },
            h('label', { class: 'label', for: capId }, 'Bildunterschrift'),
            (function () { var el = input(item, 'caption', { max: 250, placeholder: 'z. B. Unsere Theke' }); el.id = capId; return el; })()),
          h('div', { class: 'gal-ctrl' },
            btn('', 'up', function () { move(i, -1); }, 'btn-sm btn-icon', { disabled: i === 0, 'aria-label': 'Bild ' + (i + 1) + ' nach oben', title: 'Nach oben', 'data-k': 'up' + i }),
            btn('', 'down', function () { move(i, 1); }, 'btn-sm btn-icon', { disabled: i === g.length - 1, 'aria-label': 'Bild ' + (i + 1) + ' nach unten', title: 'Nach unten', 'data-k': 'down' + i }),
            btn('Löschen', 'trash', function () { remove(i); }, 'btn-sm btn-danger', { 'aria-label': 'Bild ' + (i + 1) + ' aus der Galerie entfernen' }))));
      });
      if (focusSel) {
        var f = list.querySelector(focusSel);
        if (f && !f.disabled) f.focus(); else if (f) { var alt = list.querySelector('[data-k^="' + (focusSel.indexOf('up') >= 0 ? 'down' : 'up') + '"]:not([disabled])'); if (alt) alt.focus(); }
      }
    }
    function move(i, d) {
      var g = S.content.gallery, j = i + d;
      if (j < 0 || j >= g.length) return;
      var t = g[i]; g[i] = g[j]; g[j] = t;
      changed();
      renderList('[data-k="' + (d < 0 ? 'up' : 'down') + j + '"]');
    }
    function remove(i) {
      confirmDialog('Dieses Bild aus der Galerie entfernen?', { ok: 'Entfernen', danger: true }).then(function (ok) {
        if (!ok) return;
        S.content.gallery.splice(i, 1);
        changed(); renderList();
      });
    }
    function uploadFiles(files) {
      files = Array.prototype.slice.call(files || []);
      if (!files.length) return;
      files.reduce(function (p, file) {
        return p.then(function () {
          var bar = h('span');
          var row = h('div', { class: 'uploading' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }),
            h('span', null, file.name), h('div', { class: 'progress' }, bar));
          uploads.appendChild(row);
          return uploadImage(file, function (f) { bar.style.width = Math.round(f * 100) + '%'; }).then(function (path) {
            S.content.gallery.push({ src: path, caption: '' });
            changed(); renderList();
            row.remove();
          }, function (err) {
            row.remove();
            toast(file.name + ': ' + (err.message || 'Hochladen fehlgeschlagen.'), 'error');
          });
        });
      }, Promise.resolve()).then(function () {
        toast('Hochladen abgeschlossen. Bildunterschriften ergänzen und „Speichern“ klicken.', 'success');
      });
    }
    fileIn.addEventListener('change', function () { uploadFiles(fileIn.files); fileIn.value = ''; });
    renderList();
    return h('div', null,
      sectionHead('Bilder & Galerie', 'Fotos für die Galerie der Website. Reihenfolge mit den Pfeilen ändern. Große Handyfotos werden automatisch verkleinert.', [
        btn('Fotos hochladen', 'upload', function () { fileIn.click(); }, 'btn-primary'),
        btn('Vorhandenes Bild', 'image', function () {
          pickImage({ title: 'Bild zur Galerie hinzufügen' }).then(function (p) { if (p) { S.content.gallery.push({ src: p, caption: '' }); changed(); renderList(); } });
        })
      ]), fileIn, uploads, list);
  }

  /* ================================================================ Bereich: Startseite */

  function renderHome() {
    var c = S.content;
    var bannerText = tf('Text des Hinweis-Banners', c.banner, 'text', { multiline: true, rows: 2, max: 400, placeholder: 'z. B. Heute geschlossene Gesellschaft ab 20 Uhr' });
    var hl = h('div', { class: 'hl-grid' }, c.about.highlights.slice(0, 4).map(function (x, i) {
      var opts = HL_ICONS.slice();
      if (x.icon && !HL_ICONS.some(function (o) { return o[0] === x.icon; })) opts.push([x.icon, x.icon]);
      var sel = h('select', null, opts.map(function (o) { return h('option', { value: o[0] }, o[1]); }));
      sel.value = x.icon;
      var ic = h('span', { class: 'hl-icon' }, icon(x.icon));
      sel.addEventListener('change', function () { x.icon = sel.value; ic.replaceChildren(icon(x.icon)); changed(); });
      return h('div', { class: 'hl' },
        h('div', { class: 'hl-head' }, ic, 'Highlight ' + (i + 1)),
        field('Symbol', sel),
        tf('Überschrift', x, 'title', { max: 100 }),
        tf('Kurztext', x, 'text', { max: 300 }));
    }));
    return h('div', null,
      sectionHead('Startseite', 'Die wichtigsten Inhalte ganz oben auf der Website.'),
      card('Hinweis-Banner', 'Ein schmaler Streifen ganz oben – ideal für kurzfristige Infos.',
        h('div', { class: 'fields' }, toggle(c.banner, 'enabled', 'Banner anzeigen', 'Wird auf der Website angezeigt', 'Ausgeblendet'), bannerText)),
      card('Titelbereich', 'Großes Bild mit Überschrift am Seitenanfang.',
        h('div', { class: 'fields' },
          tf('Überschrift', c.hero, 'title', { max: 120 }),
          tf('Untertitel', c.hero, 'subtitle', { multiline: true, rows: 2, max: 400 }),
          tf('Text auf dem Button', c.hero, 'ctaText', { max: 60, help: 'Der Button führt zu den Terminen, z. B. „Nächste Termine“.' }),
          field('Titelbild', imageField(c.hero, 'image', { alt: 'Titelbild' }), { help: 'Am besten ein Querformat-Foto.' }))),
      card('Über uns', 'Kurze Vorstellung der Bar und vier Highlights.',
        h('div', { class: 'fields' },
          tf('Überschrift', c.about, 'title', { max: 150 }),
          tf('Text', c.about, 'text', { multiline: true, rows: 6, max: 5000, help: 'Eine Leerzeile beginnt einen neuen Absatz.' }),
          hl)),
      card('Allgemeine Angaben', 'Name und Beschreibung der Website – z. B. für Google und den Browser-Tab.',
        h('div', { class: 'fields' },
          tf('Name der Bar', c.meta, 'siteName', { max: 120 }),
          tf('Slogan', c.meta, 'tagline', { max: 200 }),
          tf('Beschreibung für Suchmaschinen', c.meta, 'seoDescription', { multiline: true, rows: 3, max: 400, help: 'Wird z. B. bei Google unter dem Link angezeigt. Ideal: 120–160 Zeichen.' }))));
  }

  /* ================================================================ Bereich: Öffnungszeiten */

  function parseHours(s) {
    var t = str(s).trim();
    if (/^(ruhetag|geschlossen)$/i.test(t)) return { mode: 'closed' };
    var m = /^(\d{1,2}):(\d{2})\s*(?:–|—|-|bis)\s*(\d{1,2}):(\d{2})(?:\s*Uhr)?$/i.exec(t);
    if (m) {
      var to = pad(+m[3] === 24 ? 0 : +m[3]) + ':' + m[4];
      return { mode: 'open', from: pad(+m[1]) + ':' + m[2], to: to };
    }
    return { mode: t ? 'text' : 'open', text: t, from: '', to: '' };
  }
  function composeHours(from, to) {
    if (!from && !to) return '';
    return (from || '?') + ' – ' + (to === '00:00' ? '24:00' : (to || '?'));
  }

  function renderHours() {
    var c = S.content;
    var todayIdx = (new Date().getDay() + 6) % 7;
    var rows = c.openingHours.map(function (row, i) {
      var st = parseHours(row.hours);
      var mode = h('select', { 'aria-label': row.day + ': Art' },
        h('option', { value: 'open' }, 'Geöffnet'), h('option', { value: 'closed' }, 'Ruhetag'), h('option', { value: 'text' }, 'Eigener Text'));
      mode.value = st.mode;
      var val = h('div', { class: 'val' });
      var preview = h('div', { class: 'preview-line' });
      function setHours(v) { row.hours = v; preview.textContent = 'Auf der Website: ' + (v || '–'); changed(); }
      function draw() {
        val.replaceChildren();
        if (mode.value === 'closed') {
          val.appendChild(h('span', { class: 'closed' }, 'Geschlossen'));
        } else if (mode.value === 'open') {
          var p = parseHours(row.hours);
          var from = h('input', { type: 'time', value: p.from || '', 'aria-label': row.day + ' von' });
          var to = h('input', { type: 'time', value: p.to || '', 'aria-label': row.day + ' bis' });
          var upd = function () { setHours(composeHours(from.value, to.value)); };
          from.addEventListener('input', upd); to.addEventListener('input', upd);
          val.appendChild(h('div', { class: 'times' }, from, h('span', { class: 'sep' }, 'bis'), to));
        } else {
          var t = h('input', { type: 'text', value: row.hours, maxlength: 80, placeholder: 'z. B. ab 17:00 oder nach Vereinbarung', 'aria-label': row.day + ': Text' });
          t.addEventListener('input', function () { setHours(t.value); });
          val.appendChild(t);
        }
        val.appendChild(preview);
        preview.textContent = 'Auf der Website: ' + (row.hours || '–');
      }
      mode.addEventListener('change', function () {
        if (mode.value === 'closed') setHours('Ruhetag');
        else if (mode.value === 'open') { var p = parseHours(row.hours); setHours(p.mode === 'open' ? row.hours : '16:00 – 24:00'); }
        draw();
      });
      draw();
      return h('div', { class: 'hours-row' + (i === todayIdx ? ' is-today' : '') }, h('div', { class: 'day' }, row.day), h('div', { class: 'mode' }, mode), val);
    });
    return h('div', null,
      sectionHead('Öffnungszeiten', 'Für jeden Tag: geöffnet (von – bis), Ruhetag oder ein eigener Text. „24:00“ bedeutet bis Mitternacht.'),
      card(null, null, h('div', { class: 'hours' }, rows)),
      card('Hinweis zu den Öffnungszeiten', null, tf('Hinweis', c, 'hoursNote', { multiline: true, rows: 2, max: 500, optional: true, placeholder: 'z. B. Bei Live-Übertragungen auch länger geöffnet.' })));
  }

  /* ================================================================ Bereich: Sommer */

  function renderSummer() {
    var c = S.content.summer;
    return h('div', null,
      sectionHead('Sommer & Außenbereich', 'Der Bereich zum Draußensitzen – im Winter einfach ausblenden.'),
      card(null, null, h('div', { class: 'fields' },
        toggle(c, 'enabled', 'Außenbereich auf der Website zeigen', 'Wird angezeigt', 'Ausgeblendet (z. B. im Winter)'),
        tf('Überschrift', c, 'title', { max: 150 }),
        tf('Saison', c, 'season', { max: 200, placeholder: 'z. B. Mai bis September, bei schönem Wetter' }),
        tf('Text', c, 'text', { multiline: true, rows: 5, max: 5000 }),
        field('Bild', imageField(c, 'image', { alt: 'Bild Außenbereich' })))));
  }

  /* ================================================================ Bereich: Kontakt */

  function renderContact() {
    var c = S.content.contact, so = S.content.social;
    var mapsIn = input(c, 'mapsUrl', { type: 'url', max: 1000, placeholder: 'https://www.google.com/maps/…', inputmode: 'url' });
    var test = h('a', { class: 'btn', target: '_blank', rel: 'noopener', href: c.mapsUrl || '#' }, icon('external'), h('span', { class: 'lbl' }, 'Testen'));
    mapsIn.addEventListener('input', function () { test.href = mapsIn.value || '#'; });
    function genMaps() {
      var q = [S.content.meta.siteName, c.street, c.zip, c.city].filter(Boolean).join(' ');
      c.mapsUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q).replace(/%20/g, '+');
      mapsIn.value = c.mapsUrl; test.href = c.mapsUrl; changed();
      toast('Karten-Link aus der Adresse erzeugt.', 'success', 2500);
    }
    return h('div', null,
      sectionHead('Kontakt & Adresse', 'Diese Angaben erscheinen im Kontaktbereich und in der Fußzeile der Website.'),
      card('Adresse', null, h('div', { class: 'fields' },
        tf('Straße & Hausnummer', c, 'street', { max: 150, autocomplete: 'street-address' }),
        h('div', { class: 'grid-3' },
          tf('PLZ', c, 'zip', { max: 10, inputmode: 'numeric' }),
          tf('Ort', c, 'city', { max: 100 }),
          tf('Ortsteil', c, 'district', { max: 100, optional: true })))),
      card('Erreichbarkeit', null, h('div', { class: 'grid-2' },
        tf('Telefon', c, 'phone', { type: 'tel', max: 60, inputmode: 'tel' }),
        tf('E-Mail', c, 'email', { type: 'email', max: 150, inputmode: 'email' }))),
      card('Anfahrt', null, h('div', { class: 'fields' },
        tf('Hinweis zur Anfahrt', c, 'note', { multiline: true, rows: 2, max: 1000, optional: true, placeholder: 'z. B. Parkplätze in den umliegenden Straßen.' }),
        field('Link zu Google Maps', h('div', { class: 'input-row' }, mapsIn, test), { forId: mapsIn.id || (mapsIn.id = nid()), help: 'Wird als Link „Route planen“ angezeigt (keine eingebettete Karte – datenschutzfreundlich).' }),
        h('div', null, btn('Link aus Adresse erzeugen', 'wand', genMaps, 'btn-sm')))),
      card('Social Media', 'Leer lassen, wenn nicht vorhanden.', h('div', { class: 'grid-2' },
        tf('Facebook-Seite', so, 'facebook', { type: 'url', max: 500, placeholder: 'https://www.facebook.com/…', inputmode: 'url', optional: true }),
        tf('Instagram-Profil', so, 'instagram', { type: 'url', max: 500, placeholder: 'https://www.instagram.com/…', inputmode: 'url', optional: true }))));
  }

  /* ================================================================ Bereich: Impressum */

  function placeholderCheck(box, getTexts) {
    function upd() {
      var hits = getTexts().filter(function (t) { return /\[[^\]]*\]/.test(t[1]); }).map(function (t) { return t[0]; });
      box.hidden = !hits.length;
      if (hits.length) box.lastChild.textContent = 'Noch Platzhalter in eckigen Klammern [ … ] vorhanden: ' + hits.join(', ') + '. Bitte durch echte Angaben ersetzen.';
    }
    upd();
    return upd;
  }

  function renderImpressum() {
    var im = S.content.impressum, c = S.content.contact;
    var warn = h('div', { class: 'notice notice-danger', role: 'status' }, icon('alert'), h('div'));
    var labels = { owner: 'Inhaber/in', businessName: 'Name des Betriebs', street: 'Straße', zipCity: 'PLZ & Ort', phone: 'Telefon', email: 'E-Mail', vatId: 'USt-IdNr.', responsible: 'Verantwortlich', extraText: 'Weitere Angaben' };
    var check = placeholderCheck(warn, function () { return Object.keys(labels).map(function (k) { return [labels[k], str(im[k])]; }); });
    var onIn = function () { changed(); check(); };
    var o = function (x) { return Object.assign({ onInput: onIn }, x); };
    var fields = h('div', { class: 'fields' });
    function draw() {
      fields.replaceChildren(
        h('div', { class: 'grid-2' },
          tf('Inhaber/in (vollständiger Name)', im, 'owner', o({ max: 200 })),
          tf('Name des Betriebs', im, 'businessName', o({ max: 200 }))),
        h('div', { class: 'grid-2' },
          tf('Straße & Hausnummer', im, 'street', o({ max: 200 })),
          tf('PLZ & Ort', im, 'zipCity', o({ max: 200 }))),
        h('div', { class: 'grid-2' },
          tf('Telefon', im, 'phone', o({ type: 'tel', max: 60 })),
          tf('E-Mail', im, 'email', o({ type: 'email', max: 150 }))),
        tf('Umsatzsteuer-ID', im, 'vatId', o({ max: 40, optional: true, help: 'Nur angeben, falls vorhanden (nach § 27a UStG).' })),
        tf('Verantwortlich für den Inhalt', im, 'responsible', o({ multiline: true, rows: 2, max: 500, help: 'Name und Anschrift der verantwortlichen Person.' })),
        tf('Weitere Angaben', im, 'extraText', o({ multiline: true, rows: 5, max: 10000, optional: true, help: 'z. B. Hinweis zur Verbraucherstreitbeilegung. Eine Leerzeile beginnt einen neuen Absatz.' })));
    }
    draw();
    return h('div', null,
      sectionHead('Impressum', 'Gesetzlich vorgeschriebene Anbieterkennzeichnung (§ 5 DDG).', [
        btn('Adresse aus „Kontakt“ übernehmen', 'copy', function () {
          im.street = c.street; im.zipCity = [c.zip, c.city].filter(Boolean).join(' '); im.phone = c.phone; im.email = c.email;
          changed(); draw(); check();
          toast('Adresse, Telefon und E-Mail übernommen.', 'success', 2500);
        }, 'btn-sm')
      ]),
      notice('warn', 'alert', 'Bitte alle Angaben vollständig und korrekt ausfüllen und vor der Veröffentlichung rechtlich prüfen lassen (z. B. durch IHK, DEHOGA oder einen Anwalt).'),
      warn,
      card(null, null, fields));
  }

  /* ================================================================ Bereich: Datenschutz */

  function renderPrivacy() {
    var d = S.content.datenschutz;
    var warn = h('div', { class: 'notice notice-danger', role: 'status' }, icon('alert'), h('div'));
    var check = placeholderCheck(warn, function () { return [['Datenschutzerklärung', str(d.text)]]; });
    return h('div', null,
      sectionHead('Datenschutz', 'Die Datenschutzerklärung der Website.'),
      notice('warn', 'alert', 'Die Datenschutzerklärung muss zu Ihrer Website und Ihrem Hosting-Anbieter passen. Bitte vor Veröffentlichung ergänzen und rechtlich prüfen lassen.'),
      warn,
      card(null, null, tf('Text der Datenschutzerklärung', d, 'text', {
        multiline: true, cls: 'tall', max: 50000,
        help: 'Eine Leerzeile beginnt einen neuen Absatz.',
        onInput: function () { changed(); check(); }
      })));
  }

  /* ================================================================ Bereich: Einstellungen */

  function downloadJson(data, name) {
    var blob = new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json' });
    var a = h('a', { href: URL.createObjectURL(blob), download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  function looksLikeContent(d) {
    return isObj(d) && isObj(d.meta) && Array.isArray(d.events) && (isObj(d.contact) || isObj(d.hero));
  }

  function importContent(data, sourceLabel) {
    var before = JSON.stringify(S.content);
    setContent(data, false);
    S.content.meta.lastUpdated = JSON.parse(before).meta.lastUpdated;
    updateDirty();
    showSection(S.section, true);
    toast(sourceLabel + ' geladen. Bitte prüfen und dann „Speichern“ klicken, um sie zu übernehmen.', 'success', 7000);
  }

  function renderSettings() {
    var wrap = h('div', null, sectionHead('Einstellungen', S.mode === 'demo' ? 'Datensicherung und Demo-Modus.' : 'Passwort, Datensicherung und frühere Versionen.'));

    if (S.mode === 'api') {
      var cur = pwInput({ id: 'pw-current', autocomplete: 'current-password' });
      var nw = pwInput({ autocomplete: 'new-password' });
      var rep = pwInput({ autocomplete: 'new-password' });
      var pwErr = h('div', { class: 'notice notice-danger', role: 'alert', hidden: true });
      var pwBtn = h('button', { type: 'submit', class: 'btn btn-primary' }, icon('lock'), 'Passwort ändern');
      var form = h('form', { class: 'fields', novalidate: true },
        pwErr,
        field('Aktuelles Passwort', cur.el, { forId: cur.input.id }),
        h('div', { class: 'grid-2' },
          field('Neues Passwort', nw.el, { forId: nw.input.id, help: 'Mindestens 10 Zeichen. Tipp: ein kurzer Satz, z. B. „Bier-um-Acht-am-Freitag“.' }),
          field('Neues Passwort wiederholen', rep.el, { forId: rep.input.id })),
        h('div', null, pwBtn));
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        pwErr.hidden = true;
        var msg = !cur.input.value ? 'Bitte das aktuelle Passwort eingeben.'
          : nw.input.value.length < 10 ? 'Das neue Passwort muss mindestens 10 Zeichen lang sein.'
            : nw.input.value !== rep.input.value ? 'Die beiden neuen Passwörter stimmen nicht überein.' : '';
        if (msg) { pwErr.hidden = false; pwErr.textContent = msg; return; }
        pwBtn.disabled = true;
        withAuth(function () { return api('password', { method: 'POST', json: { current: cur.input.value, new: nw.input.value } }); }).then(function () {
          S.mustChange = false;
          toast('Passwort geändert. Bitte gut merken!', 'success', 6000);
          showSection('einstellungen');
        }, function (err) {
          pwErr.hidden = false; pwErr.textContent = err.message; pwBtn.disabled = false;
        });
      });
      wrap.appendChild(card('Passwort ändern', S.mustChange ? 'Bitte jetzt ein eigenes Passwort festlegen.' : 'Für den Zugang zu dieser Verwaltung.', form));
    }

    // Datensicherung
    var importIn = h('input', { type: 'file', accept: 'application/json,.json', class: 'sr-only', tabindex: '-1' });
    importIn.addEventListener('change', function () {
      var f = importIn.files[0];
      importIn.value = '';
      if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        var data = null;
        try { data = JSON.parse(rd.result); } catch (e) { /* */ }
        if (isObj(data) && isObj(data.content) && looksLikeContent(data.content)) data = data.content;
        if (!looksLikeContent(data)) { toast('Diese Datei enthält keine gültigen Website-Inhalte.', 'error'); return; }
        confirmDialog('Alle Inhalte in der Verwaltung durch den Inhalt der Datei „' + f.name + '“ ersetzen? Erst mit „Speichern“ wird die Website geändert.', { ok: 'Importieren' })
          .then(function (ok) { if (ok) importContent(data, 'Datei'); });
      };
      rd.readAsText(f);
    });
    wrap.appendChild(card('Datensicherung', 'Alle Inhalte als Datei auf dem Computer oder Handy sichern – oder eine Sicherung wieder einspielen. Bilder sind darin nur verlinkt, nicht enthalten.',
      h('div', { class: 'btn-row' },
        btn('JSON exportieren', 'download', function () {
          downloadJson(S.content, 'hofbraeustueble-inhalte-' + todayISO() + '.json');
        }),
        btn('JSON importieren', 'upload', function () { importIn.click(); }),
        importIn),
      S.dirty ? h('p', { class: 'help mt' }, 'Hinweis: Der Export enthält auch Ihre noch nicht gespeicherten Änderungen.') : null));

    if (S.mode === 'api') {
      var list = h('div', { class: 'backup-list' }, h('p', { class: 'help' }, 'Wird geladen …'));
      withAuth(function () { return api('backups'); }).then(function (r) {
        list.replaceChildren();
        if (!r.backups.length) { list.appendChild(h('p', { class: 'help' }, 'Noch keine Sicherungen vorhanden – beim ersten Speichern wird automatisch eine angelegt.')); return; }
        r.backups.forEach(function (b) {
          var p = b.date.split(' ')[0].split('-');
          var label = p[2] + '.' + p[1] + '.' + p[0] + ', ' + b.date.split(' ')[1] + ' Uhr';
          list.appendChild(h('div', { class: 'backup-row' },
            h('div', { class: 'meta' }, label, h('small', null, 'Stand vor dem Speichern · ' + fmtBytes(b.size))),
            h('div', { class: 'btn-row' },
              btn('Herunterladen', 'download', function () {
                withAuth(function () { return api('backup', { query: '&name=' + encodeURIComponent(b.name) }); }).then(function (r2) { downloadJson(r2.content, 'hofbraeustueble-sicherung-' + b.name.slice(8, 23) + '.json'); }, function (e) { toast(e.message, 'error'); });
              }, 'btn-sm'),
              btn('Laden', 'history', function () {
                confirmDialog('Die Version vom ' + label + ' in die Verwaltung laden? Ihre aktuellen Inhalte werden ersetzt – erst mit „Speichern“ wird die Website geändert.', { ok: 'Version laden' }).then(function (ok) {
                  if (!ok) return;
                  withAuth(function () { return api('backup', { query: '&name=' + encodeURIComponent(b.name) }); }).then(function (r2) { importContent(r2.content, 'Version vom ' + label); }, function (e) { toast(e.message, 'error'); });
                });
              }, 'btn-sm'))));
        });
      }, function (e) { list.replaceChildren(h('p', { class: 'help' }, 'Sicherungen konnten nicht geladen werden: ' + e.message)); });
      wrap.appendChild(card('Frühere Versionen', 'Bei jedem Speichern wird automatisch der vorherige Stand gesichert (die letzten 20).', list));
    } else {
      wrap.appendChild(card('Demo-Modus', null,
        notice('info', 'info', 'Diese Verwaltung läuft ohne PHP-Server. Gespeicherte Änderungen landen nur im Speicher dieses Browsers und sind in den Design-Vorschauen nur hier sichtbar. Hochgeladene Bilder werden verkleinert direkt eingebettet.'),
        h('div', { class: 'btn-row' }, btn('Demo zurücksetzen', 'history', function () {
          confirmDialog('Alle im Browser gespeicherten Demo-Änderungen löschen und die Original-Inhalte laden?', { ok: 'Zurücksetzen', danger: true }).then(function (ok) {
            if (!ok) return;
            lsRemove(LS_CONTENT); lsRemove(LS_MODE);
            loadDemoOriginal().then(function () { showSection(S.section); toast('Demo zurückgesetzt.', 'success'); }, function () { toast('Original-Inhalte konnten nicht geladen werden.', 'error'); });
          });
        }, 'btn-danger'))));
    }

    wrap.appendChild(card('Info', null, h('dl', { class: 'kv' },
      h('dt', null, 'Modus'), h('dd', null, S.mode === 'demo' ? 'Demo (nur dieser Browser)' : 'Online (Server)'),
      h('dt', null, 'Zuletzt gespeichert'), h('dd', null, S.content.meta.lastUpdated ? fmtDate(S.content.meta.lastUpdated).long : '–'),
      h('dt', null, 'Termine'), h('dd', null, S.content.events.length + ' (davon ' + S.content.events.filter(function (e) { return e.date >= todayISO(); }).length + ' kommende)'),
      h('dt', null, 'Galerie-Bilder'), h('dd', null, String(S.content.gallery.length)))));

    if (S.mode === 'api') wrap.appendChild(h('div', { class: 'btn-row' }, btn('Abmelden', 'logout', logout)));
    return wrap;
  }

  /* ================================================================ Bereich: Tippspiel */
  /*
   * Arbeitet mit window.TippAPI (../tippspiel/js/tipp-client.js). Alle Tippspiel-Daten werden pro Aktion
   * SOFORT über cms/tipp-api.php gespeichert (bzw. im Demo-Modus im Browser) – nicht über „Speichern“.
   * Einzige Ausnahme: der Unterbereich „Website-Teaser“ bearbeitet content.json (S.content.tippspiel)
   * und läuft wie alle anderen Inhalte über den normalen „Speichern“-Knopf.
   */

  var TIPP_SUBS = [
    { id: 'uebersicht', label: 'Übersicht', icon: 'trophy' },
    { id: 'ergebnisse', label: 'Ergebnisse eintragen', icon: 'ball' },
    { id: 'spiele', label: 'Spiele & Wettbewerbe', icon: 'calendar' },
    { id: 'einladungen', label: 'Einladungen', icon: 'ticket' },
    { id: 'spieler', label: 'Spieler', icon: 'users' },
    { id: 'punkte', label: 'Punkte-Regeln', icon: 'star' },
    { id: 'teaser', label: 'Website-Teaser', icon: 'home', content: true }
  ];
  var IMPORT_EXAMPLE = '# Beispiel – Datum Uhrzeit; Heim; Gast; Runde (optional)\n' +
    '2027-01-15 20:30; VfB Stuttgart; Eintracht Frankfurt; 17. Spieltag\n' +
    '2027-01-16 15:30; TSG Hoffenheim; Borussia Dortmund; 17. Spieltag\n' +
    '2027-01-16 18:30; Bayern München; Bayer Leverkusen; 17. Spieltag\n' +
    '2027-01-17 17:30; SC Freiburg; RB Leipzig; 17. Spieltag';
  var T = {
    sub: 'uebersicht', data: null, loadedAt: 0, loading: null, error: null, ready: false,
    root: null, nav: null, mode: null, body: null, compId: null, qrLoad: null, newInvite: null,
    imp: {}, playerQuery: '', showAllDone: false,
    cron: null, cronLoading: false, cronError: null, syncing: {},
    lb: null, lbLoading: false, lbError: null, lbAll: false
  };

  function setTippSub(id) { if (TIPP_SUBS.some(function (x) { return x.id === id; })) T.sub = id; }
  function goTipp(id) {
    setTippSub(id);
    if (S.section !== 'tippspiel') { go('tippspiel'); return; }
    history.replaceState(null, '', '#tippspiel/' + T.sub);
    drawTippNav(); drawTippBody();
    window.scrollTo(0, 0);
  }
  function tippVisible() { return S.section === 'tippspiel' && T.root && document.contains(T.root); }

  /* ---------- API */

  function tippInit() {
    if (T.ready) return Promise.resolve();
    if (!window.TippAPI) return Promise.reject(new Error('Das Tippspiel-Modul (tippspiel/js/tipp-client.js) wurde nicht gefunden.'));
    return Promise.resolve(TippAPI.init({ base: '../cms/tipp-api.php', adminCsrf: S.csrf || '', mode: S.mode === 'demo' ? 'demo' : 'live' }))
      .then(function () { T.ready = true; });
  }
  /** Admin-Aktion ausführen; bei abgelaufener Verwaltungs-Sitzung erneut anmelden und wiederholen. */
  function tcall(action, data) {
    return tippInit().then(function () {
      if (TippAPI.mode === 'demo') return TippAPI.call(action, data);
      return withAuth(function () { TippAPI.setAdminCsrf(S.csrf); return TippAPI.call(action, data); });
    });
  }
  function tippLoad() {
    if (T.loading) return T.loading;
    T.loading = tcall('admin_overview').then(function (d) {
      T.data = d; T.loadedAt = Date.now(); T.error = null; T.loading = null;
      T.lb = null; T.lbError = null; // Rangliste beim nächsten Zeichnen neu holen
      return d;
    }, function (e) {
      T.error = (e && e.message) || 'Das Tippspiel konnte nicht geladen werden.'; T.loading = null;
      throw e;
    });
    return T.loading;
  }
  /** Nach einer Änderung: Daten neu laden und aktuellen Unterbereich neu zeichnen (Scrollposition bleibt). */
  function tippRefresh() {
    return tippLoad().then(function () { if (tippVisible()) { drawTippNav(); drawTippBody(true); } }, function (e) {
      if (T.data) toast(e.message || 'Neu laden fehlgeschlagen.', 'error');
      else if (tippVisible()) drawTippBody(true);
    });
  }
  /** Aktion mit Button-Sperre, Erfolgsmeldung und Neuladen */
  function tippAct(button, action, data, okMsg) {
    if (button) button.disabled = true;
    return tcall(action, data).then(function (r) {
      if (okMsg) toast(typeof okMsg === 'function' ? okMsg(r) : okMsg, 'success');
      return tippRefresh().then(function () { return r; });
    }, function (e) {
      if (button) button.disabled = false;
      toast(e.message || 'Aktion fehlgeschlagen.', 'error');
      throw e;
    });
  }

  /* ---------- Formatierung */

  function kParts(k) {
    var m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(k || '');
    return m ? { date: m[1] + '-' + m[2] + '-' + m[3], time: m[4] + ':' + m[5], y: +m[1], mo: +m[2], d: +m[3] } : null;
  }
  function tNow() {
    try { return TippAPI.util.berlinNow().slice(0, 16); } catch (e) {
      var d = new Date(); return todayISO() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    }
  }
  function dayLabel(dateIso, withYear) {
    var p = dateIso.split('-');
    var today = tNow().slice(0, 10);
    if (dateIso === today) return 'Heute';
    if (dateIso === addDays(today, -1)) return 'Gestern';
    if (dateIso === addDays(today, 1)) return 'Morgen';
    return WD[new Date(+p[0], +p[1] - 1, +p[2]).getDay()] + ' ' + p[2] + '.' + p[1] + '.' + (withYear || p[0] !== today.slice(0, 4) ? p[0] : '');
  }
  function fmtKick(k) { var p = kParts(k); return p ? dayLabel(p.date) + ' · ' + p.time + ' Uhr' : (k || ''); }
  function fmtDT(s) {
    if (!s) return '–';
    var p = kParts(s);
    if (p) return pad(p.d) + '.' + pad(p.mo) + '.' + p.y + ', ' + p.time + ' Uhr';
    return fmtD(s);
  }
  function fmtD(s) { if (!s) return '–'; var q = String(s).slice(0, 10).split('-'); return q.length === 3 ? q[2] + '.' + q[1] + '.' + q[0] : String(s); }
  function hasRes(m) { return m.home_goals !== null && m.home_goals !== undefined; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function compById(id) { return (T.data ? T.data.competitions : []).filter(function (c) { return c.id === id; })[0] || null; }
  function pendingMatches(d) {
    return d.matches.filter(function (m) { return m.locked && !hasRes(m); })
      .sort(function (a, b) { return a.kickoff.localeCompare(b.kickoff) || a.id - b.id; });
  }
  function fmtCode(c) { return String(c || '').replace(/^(.{4})(.+)$/, '$1 $2'); }
  function inviteUrl(code) { return new URL('../tippspiel/?code=' + encodeURIComponent(code), location.href).href; }
  function inviteState(i) {
    if (i.revoked) return ['Zurückgezogen', 'badge-muted'];
    if (i.uses >= i.max_uses) return ['Aufgebraucht', 'badge-muted'];
    if (!i.valid) return ['Abgelaufen', 'badge-muted'];
    return ['Gültig', 'badge-ok'];
  }

  /* ---------- Automatischer Abruf (OpenLigaDB) */

  var OLDB_PRESETS = [
    { id: 'bl1', label: '1. Bundesliga', name: 'Bundesliga' },
    { id: 'bl2', label: '2. Bundesliga', name: '2. Bundesliga' },
    { id: 'dfb', label: 'DFB-Pokal', name: 'DFB-Pokal' },
    { id: 'ucl', label: 'Champions League', name: 'Champions League' }
  ];
  /** Laufende Saison: ab Juli die neue (2026/27 = 2026) */
  function currentSeason() { var n = tNow(); return +n.slice(5, 7) >= 7 ? +n.slice(0, 4) : +n.slice(0, 4) - 1; }
  function seasonLabel(y) { y = +y; return y + '/' + pad((y + 1) % 100); }
  function presetOf(league) { var l = String(league || '').toLowerCase(); return OLDB_PRESETS.filter(function (p) { return p.id === l; })[0] || null; }
  function sourceLabel(c) { var p = presetOf(c.source_league); return (p ? p.label : 'Kürzel „' + c.source_league + '“') + ' ' + seasonLabel(c.source_season); }
  function syncFailed(c) { return !!c.last_sync_status && !/^OK/.test(c.last_sync_status); }
  function syncText(c) {
    if (!c.last_sync) return 'Noch nicht abgerufen';
    var st = String(c.last_sync_status || '').replace(/^OK( \(Ergebnisse\))? – /, '');
    return 'Zuletzt abgerufen: ' + fmtKick(c.last_sync) + (st ? ' – ' + st : '');
  }
  function syncSummary(r) {
    var parts = [];
    if (r.inserted) parts.push(plural(r.inserted, 'neues Spiel', 'neue Spiele'));
    if (r.updated) parts.push(plural(r.updated, 'Spiel geändert', 'Spiele geändert'));
    if (r.results) parts.push(plural(r.results, 'Ergebnis', 'Ergebnisse') + ' eingetragen');
    if (r.skipped_manual) parts.push(plural(r.skipped_manual, 'Ergebnis', 'Ergebnisse') + ' von Hand behalten');
    return parts.length ? parts.join(', ') + '.' : 'Alles aktuell – keine Änderungen.';
  }
  /** Badge zur Herkunft eines Ergebnisses (nur bei Wettbewerben mit Abruf bzw. automatischen Ergebnissen) */
  function resBadge(m) {
    if (!hasRes(m)) return null;
    var c = compById(m.competition_id);
    if (m.result_source === 'auto') return h('span', { class: 'badge badge-auto', title: 'Von OpenLigaDB übernommen' }, 'automatisch');
    if (c && c.source) return h('span', { class: 'badge badge-muted', title: 'Von Hand eingetragen – wird vom Abruf nicht überschrieben' }, 'von Hand');
    return null;
  }
  /** Abruf für einen Wettbewerb starten (Knopf wird gesperrt), Ergebnis als Meldung */
  function runSync(c, scope, button) {
    if (T.syncing[c.id]) return Promise.resolve(null);
    T.syncing[c.id] = true;
    if (button) { button.disabled = true; button.classList.add('is-busy'); }
    return tcall('admin_sync', { competition_id: c.id, scope: scope || 'window' }).then(function (r) {
      toast(c.name + ': ' + syncSummary(r) + (r.message ? ' (' + r.message + ')' : ''), 'success', 5000);
      return r;
    }, function (e) {
      toast(c.name + ': ' + (e.message || 'Abruf fehlgeschlagen.'), 'error');
      return null;
    }).then(function (r) {
      delete T.syncing[c.id];
      if (button) { button.disabled = false; button.classList.remove('is-busy'); }
      return tippRefresh().then(function () { return r; });
    });
  }
  function loadCron(force) {
    if (T.cronLoading || (T.cron && !force)) return;
    T.cronLoading = true;
    tcall('admin_cron_info').then(function (r) { T.cron = r; T.cronError = null; }, function (e) { T.cronError = e.message || 'Fehler'; })
      .then(function () { T.cronLoading = false; if (tippVisible() && T.sub === 'uebersicht') drawTippBody(true); });
  }

  /** Wirt-Ansicht des Tippspiels (nur ansehen) – im Demo-Modus mit ?wirt=1, damit die Demo-App den Wirt erkennt */
  function ownerViewUrl() { return S.mode === 'demo' ? '../tippspiel/?wirt=1' : '../tippspiel/'; }
  function ownerViewLink(cls, label) {
    return h('a', { class: 'btn ' + (cls || ''), href: ownerViewUrl(), target: '_blank', rel: 'noopener', title: 'Öffnet das Tippspiel in einem neuen Tab – alle Spiele, Tipps und Statistiken, ohne selbst mitzuspielen' },
      icon('eye'), h('span', { class: 'lbl' }, label || 'Tippspiel ansehen (Wirt-Ansicht)'));
  }
  /** Vollständige Rangliste (gesamt) für die Übersicht – dieselbe Berechnung wie in der App (Wirt-Ansicht der API) */
  function loadLb() {
    if (T.lbLoading || T.lb) return;
    T.lbLoading = true;
    tippInit().then(function () {
      if (TippAPI.mode === 'demo' && TippAPI.demoSetOwner) TippAPI.demoSetOwner(true); // Demo: die Verwaltung ist der Wirt
      return tcall('leaderboard', { view: 'owner' });
    }).then(function (r) { T.lb = r; T.lbError = null; }, function (e) { T.lbError = (e && e.message) || 'Fehler'; })
      .then(function () { T.lbLoading = false; if (tippVisible() && T.sub === 'uebersicht') drawTippBody(true); });
  }

  /* ---------- Hilfen: Kopieren, Herunterladen, Drucken, QR */

  function copyText(text, what) {
    function fallback() {
      var ta = h('textarea', { class: 'sr-only', readonly: true, 'aria-hidden': 'true' });
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { ta.setSelectionRange(0, text.length); } catch (e) { /* */ }
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
      return ok;
    }
    var p = navigator.clipboard && window.isSecureContext
      ? navigator.clipboard.writeText(text).then(function () { return true; }, function () { return fallback(); })
      : Promise.resolve(fallback());
    return p.then(function (ok) {
      toast(ok ? (what || 'Text') + ' kopiert.' : 'Kopieren hat nicht geklappt – bitte den Text gedrückt halten und manuell kopieren.', ok ? 'success' : 'error', 3500);
      return ok;
    });
  }
  function downloadBlob(blob, name) {
    var a = h('a', { href: URL.createObjectURL(blob), download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }
  function loadQr() {
    if (window.qrcode) return Promise.resolve(window.qrcode);
    if (!T.qrLoad) {
      T.qrLoad = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = '../assets/vendor/qrcode-generator.js';
        s.onload = function () { if (window.qrcode) resolve(window.qrcode); else { T.qrLoad = null; reject(new Error('QR-Code-Modul fehlerhaft.')); } };
        s.onerror = function () { T.qrLoad = null; s.remove(); reject(new Error('Das QR-Code-Modul konnte nicht geladen werden.')); };
        document.head.appendChild(s);
      });
    }
    return T.qrLoad;
  }
  function makeQr(text) { var q = window.qrcode(0, 'M'); q.addData(text); q.make(); return q; }
  function qrSvg(q) { return q.createSvgTag({ cellSize: 8, margin: 32, scalable: true }); }
  function qrPng(q, code) {
    var cell = 16, n = q.getModuleCount(), margin = cell * 4, size = n * cell + margin * 2, extra = 96;
    var cv = document.createElement('canvas');
    cv.width = size; cv.height = size + extra;
    var ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = '#000';
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (q.isDark(r, c)) ctx.fillRect(margin + c * cell, margin + r * cell, cell, cell);
    ctx.textAlign = 'center';
    ctx.font = '700 44px Inter, Arial, sans-serif';
    ctx.fillText('Code: ' + fmtCode(code), size / 2, size + 30);
    ctx.font = '400 26px Inter, Arial, sans-serif';
    ctx.fillText('Stüble-Tippspiel – scannen & mitmachen', size / 2, size + 76);
    return canvasBlob(cv, 'image/png');
  }
  function printNode(node) {
    var area = h('div', { class: 'print-area' }, node.cloneNode(true));
    document.body.appendChild(area);
    document.body.classList.add('printing');
    var done = false;
    function cleanup() {
      if (done) return; done = true;
      area.remove(); document.body.classList.remove('printing');
      window.removeEventListener('afterprint', cleanup);
    }
    window.addEventListener('afterprint', cleanup);
    setTimeout(function () { window.print(); setTimeout(cleanup, 1000); }, 50);
  }

  /* ---------- Bausteine */

  /** Zahlenfeld mit großen −/+ Knöpfen. o: label, value, min, max, onChange, onEnter, cls */
  function stepper(o) {
    var id = nid();
    var min = o.min || 0, max = o.max === undefined ? 20 : o.max;
    var inp = h('input', { type: 'text', id: id, class: 'step-in', inputmode: 'numeric', pattern: '[0-9]*', maxlength: String(max).length, autocomplete: 'off', 'aria-label': o.aria || o.label });
    inp.value = o.value === null || o.value === undefined ? '' : String(o.value);
    function get() { var v = inp.value.trim(); return /^\d{1,3}$/.test(v) ? parseInt(v, 10) : null; }
    function valid() { var v = get(); return v !== null && v >= min && v <= max; }
    function fire() { inp.classList.toggle('invalid', inp.value.trim() !== '' && !valid()); if (o.onChange) o.onChange(); }
    function step(d) {
      var v = get();
      v = v === null ? (d > 0 ? min + 1 : min) : Math.min(max, Math.max(min, v + d));
      inp.value = String(v);
      fire();
    }
    inp.addEventListener('input', function () { inp.value = inp.value.replace(/\D/g, ''); fire(); });
    inp.addEventListener('focus', function () { setTimeout(function () { try { inp.select(); } catch (e) { /* */ } }, 0); });
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && o.onEnter) { e.preventDefault(); o.onEnter(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); step(1); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); step(-1); }
    });
    var minus = h('button', { type: 'button', class: 'step-btn', 'aria-label': (o.aria || o.label) + ': eins weniger', onclick: function () { step(-1); } }, icon('minus'));
    var plus = h('button', { type: 'button', class: 'step-btn', 'aria-label': (o.aria || o.label) + ': eins mehr', onclick: function () { step(1); } }, icon('plus'));
    var el = h('div', { class: 'step-row' + (o.cls ? ' ' + o.cls : '') },
      h('label', { class: 'step-label', for: id }, o.label),
      h('div', { class: 'stepper' }, minus, inp, plus));
    return { el: el, input: inp, get: get, valid: valid, set: function (v) { inp.value = v === null ? '' : String(v); fire(); } };
  }

  function switchEl(checked, label, onText, offText) {
    var inp = h('input', { type: 'checkbox', role: 'switch' });
    inp.checked = !!checked;
    var st = h('span', { class: 'switch-state' });
    function upd() { st.textContent = inp.checked ? onText : offText; }
    inp.addEventListener('change', upd);
    upd();
    return { input: inp, el: h('label', { class: 'switch' }, inp, h('span', { class: 'track' }), h('span', null, h('span', { class: 'switch-label' }, label), st)) };
  }

  function cardHead(title, sub, actions) {
    return h('div', { class: 'card-head' }, h('div', null, h('h3', null, title), sub ? h('p', { class: 'card-sub m0' }, sub) : null),
      actions && actions.length ? h('div', { class: 'btn-row' }, actions) : null);
  }

  /* ---------- Gerüst */

  function renderTipp() {
    T.nav = h('nav', { class: 'subnav', 'aria-label': 'Tippspiel-Bereiche' });
    T.mode = h('div', { class: 'save-mode', role: 'note' });
    T.body = h('div', { class: 'tipp-body' });
    T.root = h('div', { class: 'tipp' },
      sectionHead('Tippspiel', 'Kostenloses Tippspiel für Stammgäste – nur Punkte und Rangliste, kein Geld.', [
        ownerViewLink('btn-sm btn-primary'),
        btn('Aktualisieren', 'refresh', function (e) {
          var b = e.currentTarget; b.disabled = true;
          tippRefresh().then(function () { b.disabled = false; if (!T.error) toast('Tippspiel-Daten aktualisiert.', 'success', 2000); });
        }, 'btn-sm')
      ]),
      T.nav, T.mode, T.body);
    drawTippNav();
    drawTippBody();
    if (!T.data || Date.now() - T.loadedAt > 15000) {
      var before = T.data ? JSON.stringify(T.data) : '';
      tippLoad().then(function (d) {
        if (!tippVisible()) return;
        drawTippNav();
        var after = JSON.parse(JSON.stringify(d)); delete after.serverTime;
        var prev = before ? JSON.parse(before) : null; if (prev) delete prev.serverTime;
        if (!prev || JSON.stringify(prev) !== JSON.stringify(after)) drawTippBody(true);
      }, function () { if (tippVisible()) drawTippBody(true); });
    }
    return T.root;
  }

  function drawTippNav() {
    if (!T.nav) return;
    var pending = T.data ? pendingMatches(T.data).length : 0;
    T.nav.replaceChildren.apply(T.nav, TIPP_SUBS.map(function (x) {
      return h('a', {
        class: 'subnav-item', href: '#tippspiel/' + x.id, 'aria-current': x.id === T.sub ? 'page' : null,
        onclick: function (e) { e.preventDefault(); goTipp(x.id); }
      }, icon(x.icon), x.label,
      x.id === 'ergebnisse' && pending ? h('span', { class: 'badge badge-warn', 'aria-label': pending + ' offen' }, String(pending)) : null,
      x.content ? h('span', { class: 'badge badge-muted' }, 'Speichern') : null);
    }));
    var cur = T.nav.querySelector('[aria-current="page"]');
    if (cur && cur.scrollIntoView && window.innerWidth <= 960) setTimeout(function () { cur.scrollIntoView({ block: 'nearest', inline: 'center' }); }, 0);
    // Zähler auch im Hauptmenü
    var navItem = document.querySelector('.nav-item[data-id="tippspiel"]');
    if (navItem) {
      var b = navItem.querySelector('.badge');
      if (pending && !b) navItem.appendChild(b = h('span', { class: 'badge badge-warn' }));
      if (b) { if (pending) { b.textContent = String(pending); b.title = plural(pending, 'Ergebnis fehlt', 'Ergebnisse fehlen'); } else b.remove(); }
    }
    // Hinweis: sofort gespeichert vs. über „Speichern“
    var content = TIPP_SUBS.filter(function (x) { return x.id === T.sub; })[0].content;
    T.mode.className = 'save-mode ' + (content ? 'is-content' : 'is-live');
    T.mode.replaceChildren(icon(content ? 'save' : 'check'), content
      ? h('div', null, h('strong', null, 'Website-Texte: '), 'Diese Felder gehören zur Website und werden erst mit „Speichern“ oben rechts veröffentlicht.')
      : h('div', null, h('strong', null, 'Wird sofort gespeichert: '), 'Jede Aktion im Tippspiel ist direkt ' + (S.mode === 'demo' ? 'gespeichert (Demo: nur in diesem Browser)' : 'online') + ' – der Knopf „Speichern“ oben ist dafür nicht nötig.'));
  }

  function drawTippBody(keepScroll) {
    if (!T.body) return;
    var y = window.scrollY;
    var el;
    if (T.sub === 'teaser') el = tippTeaser();
    else if (!T.data) {
      el = T.error
        ? h('div', null, notice('danger', 'alert', h('div', null, h('strong', null, 'Das Tippspiel konnte nicht geladen werden. '), T.error)),
          btn('Erneut versuchen', 'refresh', function () { T.error = null; T.ready = false; drawTippBody(); tippRefresh(); }, 'btn-primary'))
        : h('div', { class: 'tipp-loading', role: 'status' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), 'Tippspiel wird geladen …');
    } else {
      el = ({ uebersicht: tippOverview, ergebnisse: tippResults, spiele: tippMatches, einladungen: tippInvites, spieler: tippPlayers, punkte: tippPoints })[T.sub](T.data);
    }
    T.body.replaceChildren(el);
    if (keepScroll) window.scrollTo(0, y);
  }

  /* ---------- Übersicht */

  function tippOverview(d) {
    var active = d.players.filter(function (p) { return p.active; });
    var pending = pendingMatches(d);
    var upcoming = d.matches.filter(function (m) { return !m.locked; });
    var tips = d.players.reduce(function (s, p) { return s + (p.tips || 0); }, 0);
    var validInv = d.invites.filter(function (i) { return i.valid; });
    var wrap = h('div');

    wrap.appendChild(h('section', { class: 'card owner-card' },
      h('div', { class: 'owner-card-txt' }, h('h3', null, icon('eye'), 'Tippspiel als Wirt ansehen'),
        h('p', { class: 'help m0' }, 'Ohne eigenes Spielerkonto: alle Spiele mit Stammtisch-Quote (auch vor dem Anstoß), wer was getippt hat, Rangliste und Statistik – nur ansehen, getippt wird dort nicht.')),
      ownerViewLink('btn-primary')));

    if (!d.competitions.length) {
      wrap.appendChild(h('section', { class: 'card start-card' }, h('h3', null, icon('wand'), 'So geht’s los'),
        h('ol', { class: 'steps' },
          h('li', null, h('strong', null, 'Wettbewerb anlegen'), ' – z. B. „EM 2028“ mit Bonusfrage „Wer wird Europameister?“'),
          h('li', null, h('strong', null, 'Spiele eintragen'), ' – einzeln oder als Liste einfügen'),
          h('li', null, h('strong', null, 'Einladungen verteilen'), ' – per WhatsApp oder als QR-Code an der Theke'),
          h('li', null, h('strong', null, 'Nach dem Abpfiff'), ' – Ergebnisse eintragen, die Punkte rechnet das Tippspiel selbst')),
        btn('Ersten Wettbewerb anlegen', 'plus', function () { goTipp('spiele'); openCompEditor(null); }, 'btn-primary')));
    }

    // Offene Ergebnisse
    if (pending.length) {
      wrap.appendChild(h('section', { class: 'card pending-card' },
        h('h3', null, icon('ball'), plural(pending.length, 'Spiel wartet', 'Spiele warten') + ' auf ein Ergebnis'),
        h('ul', { class: 'pending-list' }, pending.slice(0, 4).map(function (m) {
          return h('li', null, h('a', { href: '#tippspiel/ergebnisse', onclick: function (e) { e.preventDefault(); goTipp('ergebnisse'); } },
            h('span', { class: 'pl-teams' }, m.home + ' – ' + m.away), h('small', null, fmtKick(m.kickoff))));
        }), pending.length > 4 ? h('li', { class: 'more' }, '… und ' + (pending.length - 4) + ' weitere') : null),
        btn('Ergebnisse jetzt eintragen', 'chevron', function () { goTipp('ergebnisse'); }, 'btn-primary btn-block')));
    } else if (d.matches.length) {
      wrap.appendChild(notice('success', 'check', 'Alle angepfiffenen Spiele haben ein Ergebnis – nichts zu tun.'));
    }

    if (d.competitions.length) wrap.appendChild(autoCard(d));

    // Kennzahlen
    function tile(n, label, sub, target) {
      return h('button', { type: 'button', class: 'stat', onclick: function () { goTipp(target); } },
        h('span', { class: 'stat-n' }, String(n)), h('span', { class: 'stat-l' }, label), sub ? h('span', { class: 'stat-s' }, sub) : null);
    }
    var inactive = d.players.length - active.length;
    wrap.appendChild(h('div', { class: 'stat-grid' },
      tile(active.length, active.length === 1 ? 'Spieler' : 'Spieler', inactive ? inactive + ' deaktiviert' : 'aktiv', 'spieler'),
      tile(tips, 'Tipps', 'insgesamt abgegeben', 'spieler'),
      tile(upcoming.length, 'kommende Spiele', d.competitions.length ? plural(d.competitions.length, 'Wettbewerb', 'Wettbewerbe') : 'noch kein Wettbewerb', 'spiele'),
      tile(validInv.length, 'gültige Einladungen', d.invites.length ? d.invites.length + ' insgesamt' : 'noch keine', 'einladungen')));

    // Rangliste (gesamt): erst die Top 5, „Alle anzeigen“ klappt die ganze Tabelle auf
    var rows;
    if (T.lb) {
      rows = T.lb.rows.map(function (r) { return { rank: r.rank, nickname: r.nickname, points: r.points, exact: r.exact, tips: r.tips }; });
    } else {
      if (!T.lbError) loadLb();
      // bis die Rangliste da ist (oder falls sie nicht geladen werden kann): nach Punkten aus der Übersicht
      var ranked = active.slice().sort(function (a, b) { return b.points - a.points || a.nickname.localeCompare(b.nickname, 'de'); });
      rows = [];
      ranked.forEach(function (p, i) {
        rows.push({ rank: i > 0 && ranked[i - 1].points === p.points ? rows[i - 1].rank : i + 1, nickname: p.nickname, points: p.points });
      });
    }
    var shown = T.lbAll ? rows : rows.slice(0, 5);
    var lb = h('ol', { class: 'lb' + (T.lbAll ? ' lb-full' : '') }, shown.map(function (r) {
      return h('li', { 'data-rank': String(r.rank), class: r.rank === 1 ? 'is-top' : null },
        h('span', { class: 'lb-rank' }, r.rank + '.'), h('span', { class: 'lb-name' }, r.nickname),
        h('span', { class: 'lb-pts' }, plural(r.points, 'Punkt', 'Punkte'),
          r.exact !== undefined ? h('small', { class: 'lb-sub' }, r.exact + '× exakt · ' + plural(r.tips, 'Tipp', 'Tipps')) : null));
    }));
    var lbMore = rows.length > 5 ? btn(T.lbAll ? 'Weniger anzeigen' : 'Alle ' + rows.length + ' anzeigen', T.lbAll ? 'chevron' : 'list', function () {
      T.lbAll = !T.lbAll; drawTippBody(true);
    }, 'btn-sm mt' + (T.lbAll ? ' lb-less' : ''), { 'aria-expanded': T.lbAll ? 'true' : 'false' }) : null;
    var next = upcoming.slice(0, 3);
    wrap.appendChild(h('div', { class: 'grid-2 tipp-cols' },
      card('Rangliste', 'Gesamtwertung aller Wettbewerbe inkl. Bonuspunkte. Bei Punktgleichheit zählen exakte Treffer, dann die Tordifferenz.',
        rows.length ? lb : h('p', { class: 'help m0' }, 'Noch keine Spieler. Verteile zuerst Einladungen.'), lbMore,
        T.lbError ? h('p', { class: 'help m0 mt' }, 'Hinweis: Die genaue Rangliste konnte nicht geladen werden (' + T.lbError + ') – sortiert nach Punkten.') : null),
      card('Nächste Spiele', null,
        next.length ? h('ul', { class: 'next-list' }, next.map(function (m) {
          return h('li', null, h('strong', null, m.home + ' – ' + m.away), h('small', null, fmtKick(m.kickoff) + ' · ' + plural(m.tip_count || 0, 'Tipp', 'Tipps')));
        })) : h('p', { class: 'help m0' }, 'Keine kommenden Spiele eingetragen.'),
        btn('Spiele verwalten', 'calendar', function () { goTipp('spiele'); }, 'btn-sm mt'))));

    // Schnellzugriff
    wrap.appendChild(card('Schnellzugriff', null, h('div', { class: 'quick' },
      TIPP_SUBS.filter(function (x) { return x.id !== 'uebersicht'; }).map(function (x) {
        return h('button', { type: 'button', class: 'quick-btn', onclick: function () { goTipp(x.id); } }, icon(x.icon), h('span', null, x.label));
      }))));

    if (S.mode === 'demo') {
      wrap.appendChild(card('Demo-Daten', null,
        h('p', { class: 'help' }, 'Im Demo-Modus ist das Tippspiel mit erfundenen Stammgästen gefüllt – alles bleibt nur in diesem Browser.'),
        btn('Demo-Tippspiel zurücksetzen', 'history', function () {
          confirmDialog('Alle Demo-Daten des Tippspiels (Spiele, Spieler, Einladungen) durch frische Beispieldaten ersetzen?', { title: 'Demo zurücksetzen', ok: 'Zurücksetzen', danger: true }).then(function (ok) {
            if (!ok) return;
            TippAPI.demoReset();
            tippRefresh().then(function () { toast('Demo-Tippspiel zurückgesetzt.', 'success'); });
          });
        }, 'btn-danger btn-sm')));
    }
    return wrap;
  }

  /** Übersicht: automatischer Abruf je Wettbewerb + Cronjob-Adresse */
  function autoCard(d) {
    var src = d.competitions.filter(function (c) { return c.source; });
    if (!src.length) {
      var first = d.competitions.filter(function (c) { return c.active; })[0] || d.competitions[0];
      return h('section', { class: 'card auto-card' },
        cardHead('Spielplan & Ergebnisse automatisch', null, null),
        h('p', { class: 'help' }, 'Für Bundesliga, 2. Bundesliga, DFB-Pokal und Champions League kann das Tippspiel Spiele und Ergebnisse selbst von OpenLigaDB holen – dann musst du nichts mehr eintippen.'),
        btn('Einrichten', 'wand', function () { goTipp('spiele'); openCompEditor(first); }, 'btn-sm'));
    }
    var list = h('ul', { class: 'sync-list' }, src.map(function (c) {
      var b = btn('Jetzt abrufen', 'refresh', function () { runSync(c, 'window', b); }, 'btn-sm', { 'aria-label': 'Jetzt abrufen: ' + c.name });
      if (T.syncing[c.id]) b.disabled = true;
      return h('li', { class: 'sync-item' + (syncFailed(c) ? ' is-err' : '') },
        h('div', null, h('strong', null, c.name), h('small', null, 'OpenLigaDB · ' + sourceLabel(c) + (c.active ? '' : ' · Archiv')),
          h('small', { class: 'sync-st' }, syncFailed(c) ? icon('alert') : icon('check'), syncText(c))),
        b);
    }));
    if (!T.cron && !T.cronError) loadCron();
    var cronBody;
    if (T.cron) {
      var urlIn = h('input', { type: 'text', readonly: true, value: T.cron.url_with_token, class: 'mono', 'aria-label': 'Cronjob-Adresse', spellcheck: 'false' });
      urlIn.addEventListener('focus', function () { urlIn.select(); });
      var lc = T.cron.last_cron;
      cronBody = h('div', { class: 'fields' },
        field('Adresse für den Cronjob', h('div', { class: 'input-row' }, urlIn,
          btn('Kopieren', 'copy', function () { copyText(T.cron.url_with_token, 'Cronjob-Adresse'); }, 'btn-sm', { 'aria-label': 'Cronjob-Adresse kopieren' })),
          { forId: urlIn.id || (urlIn.id = nid()), help: 'Geheim halten – wer die Adresse kennt, kann nur einen Abruf auslösen, sonst nichts.' }),
        h('p', { class: 'help m0' }, lc ? (lc.ok ? 'Letzter Cronjob-Aufruf: ' : 'Letzter Cronjob-Aufruf (mit Fehler): ') + fmtKick(lc.time) : 'Der Cronjob hat sich noch nicht gemeldet.'),
        T.cron.demo ? h('p', { class: 'help m0' }, 'Demo: Im echten Betrieb steht hier die Adresse deiner Website.') : null,
        h('details', { class: 'past-box cron-how' },
          h('summary', null, h('span', { class: 'chev' }, icon('chevron')), 'So richtest du den Cronjob beim Hoster ein'),
          h('div', { class: 'past-inner' },
            h('p', { class: 'm0' }, 'Im Kundenmenü deines Webhosters einen „Cronjob“ anlegen, der die Adresse oben ', h('strong', null, 'alle 15 Minuten'), ' aufruft. Die Menüs heißen je nach Tarif etwas anders:'),
            h('ul', null,
              h('li', null, h('strong', null, 'IONOS: '), 'Hosting → Cronjobs → „Cronjob anlegen“ → Adresse (URL) aufrufen, alle 15 Minuten.'),
              h('li', null, h('strong', null, 'Strato: '), 'Hosting → Einstellungen → Cronjob-Verwaltung → neuer Cronjob, Adresse eintragen, alle 15 Minuten.'),
              h('li', null, h('strong', null, 'all-inkl: '), 'KAS → Tools → Cronjobs → „Cronjob hinzufügen“, Protokoll https, Adresse einfügen, Zeitplan alle 15 Minuten.'),
              h('li', null, 'Kann man dort nur einen Befehl eintragen: ', h('code', null, 'curl -s "ADRESSE" > /dev/null')),
              h('li', null, 'Kein Cronjob im Tarif? Ein kostenloser Dienst wie cron-job.org kann die Adresse ebenfalls aufrufen.')),
            h('p', { class: 'help m0' }, 'Ohne Cronjob klappt es auch: Dann holt das Tippspiel fehlende Ergebnisse, sobald jemand reinschaut (frühestens knapp 2 Stunden nach Anpfiff).'))),
        h('div', { class: 'btn-row' }, btn('Token neu erzeugen', 'key', function (e) {
          var b = e.currentTarget;
          confirmDialog('Eine neue geheime Adresse erzeugen? Die alte funktioniert danach nicht mehr – trag die neue dann im Cronjob beim Hoster ein.', { title: 'Token neu erzeugen', ok: 'Neu erzeugen', danger: true }).then(function (ok) {
            if (!ok) return;
            b.disabled = true;
            tcall('admin_cron_token_reset').then(function (r) { T.cron = r; toast('Neue Cronjob-Adresse erzeugt – bitte beim Hoster eintragen.', 'success'); drawTippBody(true); },
              function (er) { b.disabled = false; toast(er.message, 'error'); });
          });
        }, 'btn-sm btn-danger')));
    } else {
      cronBody = T.cronError
        ? h('div', null, notice('danger', 'alert', 'Cronjob-Adresse konnte nicht geladen werden: ' + T.cronError), btn('Erneut versuchen', 'refresh', function () { T.cronError = null; loadCron(true); drawTippBody(true); }, 'btn-sm'))
        : h('div', { class: 'tipp-loading', role: 'status' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), 'Cronjob-Adresse wird geladen …');
    }
    return h('section', { class: 'card auto-card' },
      cardHead('Automatischer Abruf', 'Spielplan & Ergebnisse von OpenLigaDB. Ein von Hand eingetragenes Ergebnis hat immer Vorrang.', null),
      list,
      h('h4', { class: 'cron-h' }, icon('clock'), 'Regelmäßig abrufen (Cronjob)'),
      cronBody,
      h('p', { class: 'src-credit' }, 'Daten: OpenLigaDB (openligadb.de), Community-gepflegt – ohne Gewähr. Gewertet wird das Ergebnis nach 90 Minuten.'));
  }

  /* ---------- Ergebnisse eintragen */

  function tippResults(d) {
    var multi = d.competitions.length > 1;
    var pending = pendingMatches(d);
    var done = d.matches.filter(function (m) { return hasRes(m); }).sort(function (a, b) { return b.kickoff.localeCompare(a.kickoff) || b.id - a.id; });
    var upcoming = d.matches.filter(function (m) { return !m.locked; }).slice(0, 5);
    var wrap = h('div');

    wrap.appendChild(h('h3', { class: 'res-h' }, 'Warten auf ein Ergebnis', h('span', { class: 'badge ' + (pending.length ? 'badge-warn' : 'badge-ok') }, String(pending.length))));
    var autoPend = pending.filter(function (m) { var c = compById(m.competition_id); return c && c.source; });
    if (autoPend.length) {
      var autoComps = d.competitions.filter(function (c) { return c.source && autoPend.some(function (m) { return m.competition_id === c.id; }); });
      var syncAll = btn('Jetzt abrufen', 'refresh', function () {
        syncAll.disabled = true;
        autoComps.reduce(function (p, c) { return p.then(function () { return runSync(c, 'window'); }); }, Promise.resolve()).then(function () { syncAll.disabled = false; });
      }, 'btn-sm');
      wrap.appendChild(h('div', { class: 'notice notice-info' }, icon('refresh'), h('div', null,
        h('p', null, (autoPend.length === pending.length ? (pending.length === 1 ? 'Dieses Ergebnis kommt' : 'Diese Ergebnisse kommen') : plural(autoPend.length, 'Ergebnis kommt', 'Ergebnisse kommen')) +
          ' automatisch von OpenLigaDB – meist etwa 2 Stunden nach Anpfiff. Du kannst trotzdem selbst eintragen; dein Ergebnis hat dann Vorrang.'),
        syncAll)));
    }
    if (pending.length) {
      wrap.appendChild(h('div', { class: 'res-list' }, pending.map(function (m) { return resultRow(m, multi); })));
    } else {
      wrap.appendChild(notice('success', 'check', d.matches.length ? 'Alles erledigt – kein angepfiffenes Spiel wartet auf ein Ergebnis.' : 'Noch keine Spiele angelegt. Unter „Spiele & Wettbewerbe“ geht’s los.'));
    }

    if (done.length) {
      var limit = T.showAllDone ? done.length : 6;
      wrap.appendChild(h('h3', { class: 'res-h' }, 'Bereits eingetragen', h('span', { class: 'badge badge-muted' }, String(done.length))));
      wrap.appendChild(h('div', { class: 'res-list' }, done.slice(0, limit).map(function (m) { return resultRow(m, multi); })));
      if (done.length > limit) {
        wrap.appendChild(h('div', { class: 'mt' }, btn('Alle ' + done.length + ' Ergebnisse anzeigen', 'list', function () { T.showAllDone = true; drawTippBody(true); }, 'btn-sm')));
      }
    }

    if (upcoming.length) {
      wrap.appendChild(h('h3', { class: 'res-h' }, 'Als Nächstes'));
      wrap.appendChild(h('p', { class: 'help' }, 'Ergebnisse können erst ab Anstoß eingetragen werden.'));
      wrap.appendChild(h('ul', { class: 'next-list card' }, upcoming.map(function (m) {
        return h('li', null, h('strong', null, m.home + ' – ' + m.away), h('small', null, fmtKick(m.kickoff) + (m.round ? ' · ' + m.round : '') + ' · ' + plural(m.tip_count || 0, 'Tipp', 'Tipps')));
      })));
    }
    return wrap;
  }

  function resultRow(m, multi) {
    var row = h('article', { class: 'res' });
    var srcComp = compById(m.competition_id);
    srcComp = srcComp && srcComp.source ? srcComp : null;
    var editing = !hasRes(m);
    function draw(flash) {
      row.className = 'res' + (hasRes(m) ? ' is-done' : ' is-open') + (flash ? ' flash' : '');
      var comp = multi ? compById(m.competition_id) : null;
      var running = !hasRes(m) && kParts(m.kickoff) && tNow() < addMinutes(m.kickoff, 115);
      var meta = h('div', { class: 'res-meta' },
        h('span', null, fmtKick(m.kickoff)),
        m.round ? h('span', null, m.round) : null,
        comp ? h('span', null, comp.name) : null,
        running ? h('span', { class: 'badge badge-live' }, 'läuft evtl. noch') : null,
        !hasRes(m) && srcComp ? h('span', { class: 'badge badge-auto', title: 'Wird von OpenLigaDB abgerufen' }, 'kommt automatisch') : resBadge(m),
        h('span', { class: 'res-tips' }, plural(m.tip_count || 0, 'Tipp', 'Tipps')));
      if (!editing) {
        row.replaceChildren(meta,
          h('div', { class: 'res-final' },
            h('span', { class: 't t-home' }, m.home), h('strong', { class: 'sc' }, m.home_goals + ' : ' + m.away_goals), h('span', { class: 't t-away' }, m.away)),
          h('div', { class: 'res-actions' },
            flash ? h('span', { class: 'saved-tag' }, icon('check'), 'Gespeichert') : null,
            btn('Ändern', 'edit', function () { editing = true; draw(); row.querySelector('.step-in').focus(); }, 'btn-sm', { 'aria-label': 'Ergebnis ändern: ' + m.home + ' – ' + m.away }),
            btn('Löschen', 'trash', clear, 'btn-sm btn-danger', { 'aria-label': 'Ergebnis löschen: ' + m.home + ' – ' + m.away })));
        return;
      }
      var saveB = btn(hasRes(m) ? 'Änderung speichern' : 'Ergebnis speichern', 'check', doSave, 'btn-primary res-save');
      var hs = stepper({ label: m.home, aria: 'Tore ' + m.home, value: hasRes(m) ? m.home_goals : null, onChange: upd, onEnter: function () { as.input.focus(); } });
      var as = stepper({ label: m.away, aria: 'Tore ' + m.away, value: hasRes(m) ? m.away_goals : null, onChange: upd, onEnter: doSave });
      function upd() { saveB.disabled = !(hs.valid() && as.valid()); }
      upd();
      function doSave() {
        if (!(hs.valid() && as.valid())) { toast('Bitte für beide Mannschaften die Tore eingeben (0–20).', 'error'); return; }
        saveB.disabled = true;
        tcall('admin_result', { match_id: m.id, home_goals: hs.get(), away_goals: as.get() }).then(function (r) {
          Object.assign(m, r.match);
          editing = false;
          draw(true);
          drawTippNav();
          toast('Ergebnis gespeichert: ' + m.home + ' ' + m.home_goals + ':' + m.away_goals + ' ' + m.away + (srcComp ? ' (von Hand – der automatische Abruf ändert es nicht mehr)' : ''), 'success', srcComp ? 4500 : 2500);
        }, function (e) { upd(); toast(e.message || 'Speichern fehlgeschlagen.', 'error'); });
      }
      row.replaceChildren(meta, h('div', { class: 'res-steps' }, hs.el, as.el),
        h('div', { class: 'res-actions' },
          hasRes(m) ? btn('Abbrechen', null, function () { editing = false; draw(); }, 'btn-sm') : null,
          saveB));
    }
    function clear() {
      confirmDialog('Ergebnis von „' + m.home + ' – ' + m.away + '“ (' + m.home_goals + ':' + m.away_goals + ') löschen? Die Punkte für dieses Spiel werden dann wieder abgezogen, bis ein neues Ergebnis eingetragen ist.' + (srcComp ? ' Beim nächsten automatischen Abruf wird das Ergebnis von OpenLigaDB übernommen.' : ''), { title: 'Ergebnis löschen', ok: 'Ergebnis löschen', danger: true }).then(function (ok) {
        if (!ok) return;
        tcall('admin_result', { match_id: m.id, home_goals: null, away_goals: null }).then(function (r) {
          Object.assign(m, r.match);
          editing = true; draw(); drawTippNav();
          toast('Ergebnis gelöscht.', 'success', 2500);
        }, function (e) { toast(e.message, 'error'); });
      });
    }
    draw();
    return row;
  }
  function addMinutes(k, n) {
    var p = kParts(k);
    var dt = new Date(Date.UTC(p.y, p.mo - 1, p.d, +p.time.slice(0, 2), +p.time.slice(3) + n));
    return dt.getUTCFullYear() + '-' + pad(dt.getUTCMonth() + 1) + '-' + pad(dt.getUTCDate()) + ' ' + pad(dt.getUTCHours()) + ':' + pad(dt.getUTCMinutes());
  }

  /* ---------- Spiele & Wettbewerbe */

  function tippMatches(d) {
    var comps = d.competitions;
    if (!comps.some(function (c) { return c.id === T.compId; })) {
      T.compId = comps.length ? (comps.filter(function (c) { return c.active; })[0] || comps[0]).id : null;
    }
    var wrap = h('div');

    // Wettbewerbe
    var list = comps.length ? h('div', { class: 'comp-list' }, comps.map(function (c) {
      var sel = c.id === T.compId;
      return h('div', { class: 'comp' + (sel ? ' is-sel' : '') },
        h('button', { type: 'button', class: 'comp-main', 'aria-pressed': sel ? 'true' : 'false', onclick: function () { T.compId = c.id; drawTippBody(true); } },
          h('strong', null, c.name),
          h('span', { class: 'comp-meta' },
            h('span', { class: 'badge ' + (c.active ? 'badge-ok' : 'badge-muted') }, c.active ? 'Aktiv' : 'Archiv'),
            h('span', null, plural(c.match_count || 0, 'Spiel', 'Spiele')),
            c.source ? h('span', { class: 'badge badge-auto' }, 'Automatisch') : null,
            c.source ? h('span', null, 'OpenLigaDB · ' + sourceLabel(c)) : null,
            c.bonus_question ? h('span', null, 'Bonus: ' + c.bonus_question + (c.bonus_answer ? ' → ' + c.bonus_answer : ' (Antwort offen)')) : null),
          c.source ? h('span', { class: 'comp-sync' + (syncFailed(c) ? ' is-err' : '') }, syncFailed(c) ? icon('alert') : null, syncText(c)) : null),
        h('div', { class: 'comp-actions' },
          c.source ? (function () { var b = btn('Abrufen', 'refresh', function () { runSync(c, 'window', b); }, 'btn-sm', { 'aria-label': 'Jetzt abrufen: ' + c.name, title: 'Spiele und Ergebnisse jetzt von OpenLigaDB holen' }); b.disabled = !!T.syncing[c.id]; return b; })() : null,
          btn('Bearbeiten', 'edit', function () { openCompEditor(c); }, 'btn-sm', { 'aria-label': 'Wettbewerb bearbeiten: ' + c.name }),
          btn('Löschen', 'trash', function () { deleteComp(c); }, 'btn-sm btn-danger', { 'aria-label': 'Wettbewerb löschen: ' + c.name })));
    })) : h('div', { class: 'empty' }, icon('trophy'), h('p', null, 'Noch kein Wettbewerb angelegt.'));
    wrap.appendChild(h('section', { class: 'card' },
      cardHead('Wettbewerbe', 'z. B. „EM 2028“ oder „Bundesliga 28/29“. Inaktive Wettbewerbe sind für Spieler nur noch im Archiv sichtbar.',
        [btn('Neuer Wettbewerb', 'plus', function () { openCompEditor(null); }, 'btn-primary btn-sm')]),
      list));

    var c = compById(T.compId);
    if (!c) return wrap;
    var ms = d.matches.filter(function (m) { return m.competition_id === c.id; });
    var now = tNow();
    var future = ms.filter(function (m) { return !m.locked; });
    var past = ms.filter(function (m) { return m.locked; }).reverse();

    function groups(arr) {
      var out = [], last = null;
      arr.forEach(function (m) {
        var day = m.kickoff.slice(0, 10);
        if (day !== last) { out.push(h('div', { class: 'm-day' }, dayLabel(day, true))); last = day; }
        out.push(matchRow(m, now));
      });
      return out;
    }
    var matchesCard = h('section', { class: 'card' },
      cardHead('Spiele: ' + c.name, plural(ms.length, 'Spiel', 'Spiele') + ' · ' + future.length + ' kommend',
        [btn('Spiel hinzufügen', 'plus', function () { openMatchEditor(null, c.id); }, 'btn-primary btn-sm')]),
      c.source ? notice('info', 'refresh', h('span', null, 'Die Spiele kommen automatisch von OpenLigaDB (' + sourceLabel(c) + '): neue Spiele der nächsten ' + plural(c.sync_window_days || 14, 'Tag', 'Tage') +
        ', geänderte Anstoßzeiten und Ergebnisse. Ein von Hand eingetragenes Ergebnis hat immer Vorrang.')) : null,
      ms.length ? null : h('p', { class: 'help' }, c.source ? 'Noch keine Spiele – oben bei „Abrufen“ holen oder im Wettbewerb „Ganze Saison importieren“.' : 'Noch keine Spiele. Einzeln hinzufügen oder unten als Liste einfügen.'),
      future.length ? h('div', { class: 'm-list' }, groups(future)) : (ms.length ? h('p', { class: 'help' }, 'Keine kommenden Spiele.') : null),
      past.length ? h('details', { class: 'past-box' },
        h('summary', null, h('span', { class: 'chev' }, icon('chevron')), 'Angepfiffene & beendete Spiele', h('span', { class: 'badge badge-muted' }, String(past.length))),
        h('div', { class: 'past-inner m-list' }, groups(past))) : null);
    wrap.appendChild(matchesCard);
    wrap.appendChild(importCard(c));
    return wrap;
  }

  function matchRow(m) {
    return h('div', { class: 'm-row' + (m.locked ? ' is-locked' : '') },
      h('div', { class: 'm-time' }, kParts(m.kickoff) ? kParts(m.kickoff).time : m.kickoff),
      h('div', { class: 'm-main' },
        h('div', { class: 'm-teams' }, m.home, h('span', { class: 'm-vs' }, hasRes(m) ? ' ' + m.home_goals + ':' + m.away_goals + ' ' : ' – '), m.away),
        h('div', { class: 'm-sub' }, [m.round || null, plural(m.tip_count || 0, 'Tipp', 'Tipps'), m.locked && !hasRes(m) ? 'Ergebnis fehlt' : null].filter(Boolean).join(' · '), resBadge(m))),
      h('div', { class: 'm-actions' },
        btn('', 'edit', function () { openMatchEditor(m, m.competition_id); }, 'btn-sm btn-icon', { 'aria-label': 'Spiel bearbeiten: ' + m.home + ' – ' + m.away, title: 'Bearbeiten' }),
        btn('', 'trash', function () { deleteMatch(m); }, 'btn-sm btn-icon btn-danger', { 'aria-label': 'Spiel löschen: ' + m.home + ' – ' + m.away, title: 'Löschen' })));
  }

  function importCard(c) {
    var st = T.imp[c.id] || (T.imp[c.id] = { text: '', result: null });
    var ta = h('textarea', { rows: 6, class: 'mono', spellcheck: 'false', autocapitalize: 'off', placeholder: '2027-01-16 15:30; TSG Hoffenheim; Borussia Dortmund; 17. Spieltag' });
    ta.value = st.text;
    ta.addEventListener('input', function () { st.text = ta.value; });
    var out = h('div', { class: 'imp-out', 'aria-live': 'polite' });
    function showResult() {
      out.replaceChildren();
      var r = st.result;
      if (!r) return;
      if (r.imported) out.appendChild(notice('success', 'check', plural(r.imported, 'Spiel', 'Spiele') + ' importiert.'));
      if (r.errors.length) {
        out.appendChild(h('div', { class: 'notice notice-danger' }, icon('alert'), h('div', null,
          h('strong', null, plural(r.errors.length, 'Zeile wurde', 'Zeilen wurden') + ' nicht importiert'),
          h('p', { class: 'm0' }, 'Sie stehen noch im Textfeld – korrigieren und erneut importieren.'),
          h('ul', { class: 'imp-errors' }, r.errors.map(function (e) {
            return h('li', null, h('strong', null, 'Zeile ' + e.line + ': '), e.message, e.text ? h('code', null, e.text) : null);
          })))));
      }
      if (!r.imported && !r.errors.length) out.appendChild(notice('info', 'info', 'Keine Spiele gefunden – leere Zeilen und Zeilen mit # werden übersprungen.'));
    }
    showResult();
    var go2 = btn('Spiele importieren', 'upload', function () {
      if (!ta.value.trim()) { toast('Bitte zuerst Spiele ins Textfeld einfügen.', 'error'); ta.focus(); return; }
      go2.disabled = true;
      var lines = ta.value.split(/\r\n|\r|\n/);
      tcall('admin_match_import', { competition_id: c.id, text: ta.value }).then(function (r) {
        var errs = (r.errors || []).map(function (e) { return { line: e.line, message: e.message, text: (lines[e.line - 1] || '').trim() }; });
        st.result = { imported: r.imported, errors: errs };
        st.text = errs.map(function (e) { return e.text; }).join('\n');
        if (r.imported) toast(plural(r.imported, 'Spiel', 'Spiele') + ' importiert.', 'success');
        return tippRefresh();
      }, function (e) { toast(e.message, 'error'); }).then(function () { go2.disabled = false; });
    }, 'btn-primary');
    return h('details', { class: 'card imp-card', open: st.text || st.result ? true : null },
      h('summary', null, icon('list'), h('span', null, h('strong', null, 'Viele Spiele auf einmal einfügen'), h('small', null, 'Import in „' + c.name + '“ – z. B. den ganzen Spielplan'))),
      h('div', { class: 'fields mt' },
        h('div', { class: 'imp-help' },
          h('p', { class: 'm0' }, h('strong', null, 'Eine Zeile pro Spiel:'), ' ', h('code', null, 'Datum Uhrzeit; Heim; Gast; Runde')),
          h('ul', null,
            h('li', null, 'Datum als ', h('code', null, '2028-06-14 21:00'), ' oder ', h('code', null, '14.06.2028 21:00'), ' (deutsche Zeit)'),
            h('li', null, 'Getrennt durch Semikolon ', h('code', null, ';'), ' – oder Tabulator, z. B. direkt aus Excel kopiert'),
            h('li', null, 'Runde ist optional (z. B. „Achtelfinale“ oder „12. Spieltag“)'),
            h('li', null, 'Leere Zeilen und Zeilen mit # werden übersprungen, doppelte Spiele erkannt'))),
        field('Spiele', ta),
        h('div', { class: 'btn-row' }, go2,
          btn('Beispiel einfügen', 'wand', function () { ta.value = IMPORT_EXAMPLE; st.text = ta.value; ta.focus(); }, 'btn-sm')),
        out));
  }

  function openCompEditor(c) {
    var isNew = !c;
    var cur = c; // gespeicherter Stand (wird nach „Anlegen“ im offenen Dialog gesetzt)
    var draft = c ? { name: c.name, sort: String(c.sort), bonus_question: c.bonus_question || '', bonus_answer: c.bonus_answer || '', bonus_points: String(c.bonus_points) }
      : { name: '', sort: '0', bonus_question: '', bonus_answer: '', bonus_points: '10' };
    var savedLeague = c && c.source_league ? c.source_league : '';
    draft.custom = savedLeague && !presetOf(savedLeague) ? savedLeague : '';
    draft.window = String(c && c.sync_window_days ? c.sync_window_days : 14);
    var noop = function () {};
    var nameIn = input(draft, 'name', { max: 80, placeholder: 'z. B. EM 2028', onInput: noop });
    var act = switchEl(c ? c.active : true, 'Aktiv', 'Spieler sehen und tippen diesen Wettbewerb', 'Archiv – nur noch zum Nachschauen');
    var sortIn = input(draft, 'sort', { type: 'number', inputmode: 'numeric', onInput: noop });
    var bpIn = input(draft, 'bonus_points', { type: 'number', inputmode: 'numeric', onInput: noop });
    var err = h('div', { class: 'notice notice-danger', role: 'alert', hidden: true });

    /* --- Automatischer Abruf */
    var srcSw = switchEl(!!(c && c.source), 'Spielplan automatisch abrufen', 'An – Spiele und Ergebnisse kommen von OpenLigaDB', 'Aus – Spiele und Ergebnisse trägst du selbst ein');
    var presetSel = h('select', null, OLDB_PRESETS.map(function (p) { return h('option', { value: p.id }, p.label); }), h('option', { value: 'custom' }, 'Eigenes Kürzel …'));
    presetSel.value = savedLeague ? (presetOf(savedLeague) ? savedLeague.toLowerCase() : 'custom') : 'bl1';
    var customIn = input(draft, 'custom', { max: 40, placeholder: 'z. B. bl3', onInput: function () { resetPreview(); autoName(); } });
    customIn.setAttribute('autocapitalize', 'off'); customIn.setAttribute('spellcheck', 'false');
    var customField = field('Eigenes Liga-Kürzel', customIn, { help: 'Das Kürzel aus der Adresse bei openligadb.de (z. B. „bl3“ für die 3. Liga). Andere Ligen pflegen Freiwillige – bitte mit „Vorschau“ prüfen.' });
    var cs = currentSeason();
    var seasons = [cs - 1, cs, cs + 1];
    if (c && c.source_season && seasons.indexOf(c.source_season) < 0) seasons.push(c.source_season);
    seasons.sort();
    var seasonSel = h('select', null, seasons.map(function (y) { return h('option', { value: String(y) }, seasonLabel(y) + (y === cs ? ' (aktuell)' : '')); }));
    seasonSel.value = String(c && c.source_season ? c.source_season : cs);
    var winIn = input(draft, 'window', { type: 'number', inputmode: 'numeric', onInput: noop });
    winIn.min = '1'; winIn.max = '90';
    var pvOut = h('div', { class: 'src-out', 'aria-live': 'polite' });
    var syncOut = h('div', { class: 'src-out', 'aria-live': 'polite' });
    var statusLine = h('p', { class: 'help m0 src-status' });
    var lastPreview = null;
    var lastAuto = null; // zuletzt vorgeschlagener Name
    function league() { return presetSel.value === 'custom' ? draft.custom.trim() : presetSel.value; }
    function autoNameText() {
      var p = presetOf(league());
      return (p ? p.name : (league() || 'Liga')) + ' ' + seasonLabel(seasonSel.value);
    }
    function autoName() { // Name vorschlagen, solange er leer ist oder noch der letzte Vorschlag
      if (!srcSw.input.checked) return;
      if (draft.name.trim() === '' || draft.name === lastAuto) { draft.name = nameIn.value = lastAuto = autoNameText(); }
    }
    function resetPreview() { lastPreview = null; pvOut.replaceChildren(); }
    function drawStatus() {
      statusLine.replaceChildren();
      if (cur && cur.source && cur.last_sync) statusLine.append(syncFailed(cur) ? icon('alert') : icon('check'), syncText(cur));
      statusLine.classList.toggle('is-err', !!(cur && syncFailed(cur)));
      statusLine.hidden = !(cur && cur.source && cur.last_sync);
    }
    var pvBtn = btn('Vorschau', 'eye', doPreview, 'btn-sm');
    var syncBtn = btn('Jetzt abrufen', 'refresh', function () { doSync('window'); }, 'btn-primary btn-sm');
    var seasonBtn = btn('Ganze Saison importieren', 'download', function () { doSync('season'); }, 'btn-sm');
    var srcFields = h('div', { class: 'src-fields' },
      h('div', { class: 'grid-2' }, field('Wettbewerb', presetSel), field('Saison', seasonSel)),
      customField,
      field('Neue Spiele anlegen für die nächsten … Tage', winIn, { help: 'Standard 14. „Jetzt abrufen“ und der automatische Abruf legen Spiele an, sobald sie in diesem Zeitraum liegen.' }),
      h('div', { class: 'btn-row' }, pvBtn), pvOut,
      h('div', { class: 'src-sync' },
        h('p', { class: 'help m0' }, '„Jetzt abrufen“ holt die Spiele der nächsten Tage und fehlende Ergebnisse. „Ganze Saison importieren“ legt alle Spiele der Saison auf einmal an (bereits gespielte mit Ergebnis).'),
        h('div', { class: 'btn-row' }, syncBtn, seasonBtn), statusLine, syncOut),
      h('p', { class: 'src-credit m0' }, 'Daten: OpenLigaDB (openligadb.de), Community-gepflegt. Gewertet wird das Ergebnis nach 90 Minuten (ohne Verlängerung/Elfmeterschießen). Ein von Hand eingetragenes Ergebnis wird nie überschrieben.'));
    function showSrc() {
      srcFields.hidden = !srcSw.input.checked;
      customField.hidden = presetSel.value !== 'custom';
    }
    srcSw.input.addEventListener('change', function () { showSrc(); autoName(); });
    presetSel.addEventListener('change', function () { showSrc(); resetPreview(); autoName(); if (presetSel.value === 'custom') customIn.focus(); });
    seasonSel.addEventListener('change', function () { resetPreview(); autoName(); });
    showSrc(); drawStatus();

    function busy(el, text) { el.replaceChildren(h('div', { class: 'tipp-loading src-busy', role: 'status' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), text)); }
    function doPreview() {
      if (!league()) { toast('Bitte ein Liga-Kürzel eingeben.', 'error'); customIn.focus(); return; }
      pvBtn.disabled = true;
      busy(pvOut, 'Frage OpenLigaDB …');
      var lg = league(), se = seasonSel.value;
      tcall('admin_source_preview', { league: lg, season: se }).then(function (p) {
        lastPreview = p;
        pvOut.replaceChildren(h('div', { class: 'notice notice-success' }, icon('check'), h('div', null,
          h('strong', null, p.league_name || (lg + ' ' + seasonLabel(se))),
          h('p', { class: 'm0' }, plural(p.match_count, 'Spiel', 'Spiele') + ' · ' + plural(p.round_count, 'Runde', 'Runden') + ' · ' + plural(p.team_count, 'Mannschaft', 'Mannschaften') +
            (p.current_group && p.current_group.name ? ' · aktuell: ' + p.current_group.name : '')),
          p.matches && p.matches.length ? h('ul', { class: 'src-pv-list' }, p.matches.map(function (x) {
            return h('li', null, h('span', { class: 'src-pv-k' }, fmtKick(x.kickoff)), h('span', null, x.home + ' – ' + x.away));
          })) : null,
          p.demo ? h('p', { class: 'help m0' }, 'Demo: Beispieldaten – im echten Betrieb kommen sie direkt von OpenLigaDB.') : null)));
      }, function (e) {
        pvOut.replaceChildren(notice('danger', 'alert', e.message || 'Vorschau fehlgeschlagen.'));
      }).then(function () { pvBtn.disabled = false; });
    }
    function doSync(scope) {
      if (!league()) { toast('Bitte ein Liga-Kürzel eingeben.', 'error'); customIn.focus(); return; }
      var ask = scope === 'season'
        ? confirmDialog('Alle ' + (lastPreview && lastPreview.league === league() && String(lastPreview.season) === seasonSel.value ? lastPreview.match_count + ' ' : '') +
          'Spiele der Saison ' + seasonLabel(seasonSel.value) + ' anlegen? Bereits gespielte Spiele kommen mit Ergebnis dazu, vorhandene werden nicht doppelt angelegt.', { title: 'Ganze Saison importieren', ok: 'Importieren' })
        : Promise.resolve(true);
      ask.then(function (ok) {
        if (!ok) return;
        syncBtn.disabled = seasonBtn.disabled = true;
        busy(syncOut, (snapshot() !== start || !cur ? 'Speichere und rufe' : 'Rufe') + ' OpenLigaDB ab …');
        var saved = snapshot() !== start || !cur || !cur.source ? save(true) : Promise.resolve(cur);
        saved.then(function (sc) {
          if (!sc) { syncOut.replaceChildren(); return; }
          return tcall('admin_sync', { competition_id: sc.id, scope: scope }).then(function (r) {
            cur.last_sync = r.last_sync; cur.last_sync_status = r.last_sync_status; drawStatus();
            syncOut.replaceChildren(h('div', { class: 'notice notice-success' }, icon('check'), h('div', null,
              h('strong', null, syncSummary(r)),
              r.message ? h('p', { class: 'm0' }, r.message) : null,
              r.errors && r.errors.length ? h('ul', { class: 'imp-errors' }, r.errors.slice(0, 8).map(function (x) { return h('li', null, x.message); })) : null)));
            toast(cur.name + ': ' + syncSummary(r), 'success');
          }, function (e) {
            if (e.data && e.data.last_sync) { cur.last_sync = e.data.last_sync; cur.last_sync_status = e.data.last_sync_status; drawStatus(); }
            syncOut.replaceChildren(notice('danger', 'alert', e.message || 'Abruf fehlgeschlagen.'));
          }).then(function () { tippRefresh(); });
        }).then(function () { syncBtn.disabled = seasonBtn.disabled = false; });
      });
    }

    var body = h('div', { class: 'fields' }, err,
      field('Name', nameIn),
      act.el,
      field('Reihenfolge', sortIn, { help: 'Kleinere Zahl = weiter oben. Meist einfach 0 lassen.' }),
      h('div', { class: 'sub-box src-box' },
        h('h4', null, icon('refresh'), 'Spielplan automatisch abrufen (OpenLigaDB)', h('span', { class: 'opt' }, ' (optional)')),
        srcSw.el, srcFields),
      h('div', { class: 'sub-box' },
        h('h4', null, icon('star'), 'Bonusfrage', h('span', { class: 'opt' }, ' (optional)')),
        tf('Frage', draft, 'bonus_question', { max: 150, placeholder: 'z. B. Wer wird Europameister?', onInput: noop, optional: true, help: 'Tippbar bis zum Anstoß des ersten Spiels.' }),
        tf('Richtige Antwort', draft, 'bonus_answer', { max: 80, placeholder: 'erst nach Turnierende eintragen', onInput: noop, optional: true, help: 'Erst eintragen, wenn sie feststeht – dann bekommt jeder mit der gleichen Antwort die Bonuspunkte (Groß-/Kleinschreibung egal).' }),
        field('Bonuspunkte', bpIn, { help: '0 bis 100, üblich sind 10.' })));
    function snapshot() { return JSON.stringify(draft) + act.input.checked + srcSw.input.checked + presetSel.value + seasonSel.value; }
    /** Speichern; keepOpen = Dialog bleibt offen (für den Abruf). Liefert den gespeicherten Wettbewerb oder null. */
    function save(keepOpen) {
      err.hidden = true;
      if (srcSw.input.checked && !league()) { err.hidden = false; err.textContent = 'Bitte ein Liga-Kürzel für den automatischen Abruf eingeben.'; m.body.scrollTop = 0; return Promise.resolve(null); }
      var data = {
        name: draft.name, active: act.input.checked, sort: draft.sort === '' ? 0 : draft.sort,
        bonus_question: draft.bonus_question, bonus_answer: draft.bonus_answer, bonus_points: draft.bonus_points === '' ? 10 : draft.bonus_points,
        source: srcSw.input.checked ? 'openligadb' : '', source_league: league(), source_season: seasonSel.value,
        sync_window_days: draft.window === '' ? 14 : draft.window
      };
      if (cur) data.id = cur.id;
      saveB.disabled = true;
      return tcall('admin_competition_save', data).then(function (r) {
        var wasNew = !cur;
        cur = r.competition;
        T.compId = cur.id;
        start = snapshot();
        saveB.disabled = false;
        if (keepOpen) {
          if (wasNew) { saveB.replaceChildren(icon('check'), 'Speichern'); m.el.querySelector('.modal-head h3').textContent = 'Wettbewerb bearbeiten'; }
          tippRefresh();
        } else {
          m.close();
          toast(isNew && wasNew ? 'Wettbewerb „' + cur.name + '“ angelegt – ' + (cur.source ? 'jetzt „Abrufen“ drücken.' : 'jetzt Spiele hinzufügen.') : 'Wettbewerb gespeichert.', 'success');
          tippRefresh();
        }
        return cur;
      }, function (e) { err.hidden = false; err.textContent = e.message; saveB.disabled = false; m.body.scrollTop = 0; return null; });
    }
    var start = snapshot();
    var saveB = h('button', { type: 'button', class: 'btn btn-primary', onclick: function () { save(false); } }, icon('check'), isNew ? 'Anlegen' : 'Speichern');
    var m = openModal({
      title: isNew ? 'Neuer Wettbewerb' : 'Wettbewerb bearbeiten', body: body, full: true, backdropClose: false, focus: nameIn,
      beforeClose: function () { return snapshot() === start ? true : confirmDialog('Eingaben verwerfen?', { ok: 'Verwerfen', danger: true }); },
      foot: [h('button', { type: 'button', class: 'btn', onclick: function () { m.requestClose(); } }, 'Abbrechen'), saveB]
    });
  }

  function deleteComp(c) {
    var tips = T.data.matches.filter(function (x) { return x.competition_id === c.id; }).reduce(function (s, x) { return s + (x.tip_count || 0); }, 0);
    confirmDialog('Wettbewerb „' + c.name + '“ mit ' + plural(c.match_count || 0, 'Spiel', 'Spielen') + ' und ' + plural(tips, 'Tipp', 'Tipps') + ' endgültig löschen? Das kann nicht rückgängig gemacht werden.',
      { title: 'Wettbewerb löschen', ok: 'Endgültig löschen', danger: true }).then(function (ok) {
      if (!ok) return;
      tippAct(null, 'admin_competition_delete', { id: c.id }, 'Wettbewerb „' + c.name + '“ gelöscht.').catch(function () { /* gemeldet */ });
    });
  }

  function openMatchEditor(mt, compId) {
    var isNew = !mt;
    var d = T.data;
    var kp = mt ? kParts(mt.kickoff) : null;
    var lastOfComp = d.matches.filter(function (x) { return x.competition_id === compId; }).slice(-1)[0];
    var draft = {
      competition_id: String(compId),
      date: kp ? kp.date : (lastOfComp && !lastOfComp.locked ? lastOfComp.kickoff.slice(0, 10) : addDays(tNow().slice(0, 10), 1)),
      time: kp ? kp.time : '21:00',
      round: mt ? mt.round : (lastOfComp ? lastOfComp.round : ''),
      home: mt ? mt.home : '', away: mt ? mt.away : ''
    };
    var noop = function () {};
    var compSel = h('select', null, d.competitions.map(function (c) { return h('option', { value: String(c.id) }, c.name + (c.active ? '' : ' (Archiv)')); }));
    compSel.value = draft.competition_id;
    compSel.addEventListener('change', function () { draft.competition_id = compSel.value; });
    var teams = {}, rounds = {};
    d.matches.forEach(function (x) { teams[x.home] = 1; teams[x.away] = 1; if (x.round && x.competition_id === compId) rounds[x.round] = 1; });
    var tl = nid(), rl = nid();
    var homeIn = input(draft, 'home', { max: 40, list: tl, placeholder: 'z. B. Deutschland', onInput: noop });
    var err = h('div', { class: 'notice notice-danger', role: 'alert', hidden: true });
    var body = h('div', { class: 'fields' }, err,
      mt && hasRes(mt) ? notice('info', 'info', 'Dieses Spiel hat schon ein Ergebnis (' + mt.home_goals + ':' + mt.away_goals + '). Der Anstoß kann nicht in die Zukunft verlegt werden.') : null,
      field('Wettbewerb', compSel),
      h('div', { class: 'grid-2' },
        field('Datum', input(draft, 'date', { type: 'date', onInput: noop })),
        field('Anstoß (deutsche Zeit)', input(draft, 'time', { type: 'time', onInput: noop }))),
      tf('Runde', draft, 'round', { max: 60, list: rl, placeholder: 'z. B. Gruppe A · 1. Spieltag', onInput: noop, optional: true }),
      h('div', { class: 'grid-2' },
        field('Heim', homeIn),
        tf('Gast', draft, 'away', { max: 40, list: tl, placeholder: 'z. B. Borussia Dortmund', onInput: noop })),
      h('datalist', { id: tl }, Object.keys(teams).sort().map(function (t) { return h('option', { value: t }); })),
      h('datalist', { id: rl }, Object.keys(rounds).map(function (t) { return h('option', { value: t }); })));
    var start = JSON.stringify(draft);
    function submit() {
      err.hidden = true;
      if (!validDate(draft.date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time)) { err.hidden = false; err.textContent = 'Bitte Datum und Uhrzeit des Anstoßes angeben.'; return; }
      var data = { competition_id: +draft.competition_id, round: draft.round, kickoff: draft.date + ' ' + draft.time, home: draft.home, away: draft.away };
      if (mt) data.id = mt.id;
      saveB.disabled = true;
      tcall('admin_match_save', data).then(function (r) {
        start = JSON.stringify(draft);
        T.compId = r.match.competition_id;
        m.close();
        toast(isNew ? 'Spiel ' + r.match.home + ' – ' + r.match.away + ' hinzugefügt.' : 'Spiel gespeichert.', 'success');
        tippRefresh();
      }, function (e) { err.hidden = false; err.textContent = e.message; saveB.disabled = false; m.body.scrollTop = 0; });
    }
    var saveB = h('button', { type: 'button', class: 'btn btn-primary', onclick: submit }, icon('check'), isNew ? 'Hinzufügen' : 'Speichern');
    var m = openModal({
      title: isNew ? 'Spiel hinzufügen' : 'Spiel bearbeiten', body: body, full: true, backdropClose: false, focus: homeIn,
      beforeClose: function () { return JSON.stringify(draft) === start ? true : confirmDialog('Eingaben verwerfen?', { ok: 'Verwerfen', danger: true }); },
      foot: [
        mt ? h('button', { type: 'button', class: 'btn btn-danger', onclick: function () { deleteMatch(mt).then(function (ok) { if (ok) { start = JSON.stringify(draft); m.close(); } }); } }, icon('trash'), h('span', { class: 'lbl' }, 'Löschen')) : null,
        h('span', { class: 'spacer' }),
        h('button', { type: 'button', class: 'btn', onclick: function () { m.requestClose(); } }, 'Abbrechen'), saveB]
    });
  }

  function deleteMatch(mt) {
    return confirmDialog('Spiel „' + mt.home + ' – ' + mt.away + '“ (' + fmtKick(mt.kickoff) + ')' + (mt.tip_count ? ' mit ' + plural(mt.tip_count, 'Tipp', 'Tipps') : '') + ' endgültig löschen?',
      { title: 'Spiel löschen', ok: 'Löschen', danger: true }).then(function (ok) {
      if (!ok) return false;
      return tippAct(null, 'admin_match_delete', { id: mt.id }, 'Spiel gelöscht.').then(function () { return true; }, function () { return false; });
    });
  }

  /* ---------- Einladungen */

  function tippInvites(d) {
    var wrap = h('div');
    var draft = { note: '', max: '1', expires: '' };
    var noteIn = input(draft, 'note', { max: 100, placeholder: 'z. B. Kalle oder „Aushang Theke“', onInput: function () {} });
    var maxIn = input(draft, 'max', { type: 'number', inputmode: 'numeric', onInput: function () { syncChips(); } });
    maxIn.min = '1'; maxIn.max = '1000';
    var expIn = input(draft, 'expires', { type: 'date', onInput: function () {} });
    var presets = [['1', '1 Person'], ['50', 'Thekenaushang 50']];
    var chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Vorlagen' }, presets.map(function (p) {
      return h('button', { type: 'button', class: 'chip', 'data-v': p[0], onclick: function () { draft.max = p[0]; maxIn.value = p[0]; syncChips(); } }, p[1]);
    }));
    function syncChips() { chips.querySelectorAll('.chip').forEach(function (c) { c.setAttribute('aria-pressed', c.getAttribute('data-v') === String(maxIn.value).trim() ? 'true' : 'false'); }); }
    syncChips();
    var createB = btn('Einladung erstellen', 'plus', function () {
      var n = parseInt(maxIn.value, 10);
      if (!(n >= 1 && n <= 1000)) { toast('Max. Nutzungen: bitte eine Zahl von 1 bis 1000.', 'error'); maxIn.focus(); return; }
      tippAct(createB, 'admin_invite_create', { note: draft.note, max_uses: n, expires: draft.expires || null }, function (r) {
        T.newInvite = r.invite.code;
        return 'Einladung ' + fmtCode(r.invite.code) + ' erstellt – jetzt teilen oder ausdrucken.';
      }).then(function () {
        var el = document.querySelector('.inv.is-new');
        if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, function () { /* gemeldet */ });
    }, 'btn-primary');
    wrap.appendChild(h('section', { class: 'card' },
      cardHead('Neue Einladung', 'Mitspielen kann nur, wer einen Einladungscode hat.'),
      h('div', { class: 'fields' },
        field('Notiz', noteIn, { optional: true, help: 'Nur für dich sichtbar – z. B. für wen die Einladung ist.' }),
        h('div', { class: 'field' }, h('span', { class: 'label' }, 'Wie viele Personen dürfen den Code benutzen?'), chips,
          h('div', { class: 'inline-num' }, maxIn, h('span', { class: 'help' }, 'Personen (1–1000)'))),
        field('Gültig bis', expIn, { optional: true, help: 'Leer lassen = unbegrenzt gültig. Sonst gilt der Code bis zum Ende dieses Tages.' }),
        h('div', null, createB))));

    var good = d.invites.filter(function (i) { return i.valid; });
    var bad = d.invites.filter(function (i) { return !i.valid; });
    wrap.appendChild(h('h3', { class: 'res-h' }, 'Gültige Einladungen', h('span', { class: 'badge badge-ok' }, String(good.length))));
    wrap.appendChild(good.length ? h('div', { class: 'inv-list' }, good.map(inviteCard))
      : h('div', { class: 'empty' }, icon('ticket'), h('p', null, 'Keine gültige Einladung. Oben eine neue erstellen.')));
    if (bad.length) {
      wrap.appendChild(h('details', { class: 'past-box' },
        h('summary', null, h('span', { class: 'chev' }, icon('chevron')), 'Abgelaufene, aufgebrauchte & zurückgezogene', h('span', { class: 'badge badge-muted' }, String(bad.length))),
        h('div', { class: 'past-inner inv-list' }, bad.map(inviteCard))));
    }
    return wrap;
  }

  function inviteCard(i) {
    var st = inviteState(i);
    var url = inviteUrl(i.code);
    var waText = 'Servus! Du bist zum Stüble-Tippspiel vom Hofbräustüble eingeladen – kostenlos, nur Punkte und Ruhm. ' +
      'Hier anmelden: ' + url + ' (Einladungscode: ' + i.code + ')';
    var left = Math.max(0, i.max_uses - i.uses);
    var isNew = T.newInvite === i.code && i.valid;
    return h('article', { class: 'inv' + (i.valid ? '' : ' is-off') + (isNew ? ' is-new' : '') },
      h('div', { class: 'inv-top' },
        h('div', { class: 'inv-code', 'aria-label': 'Code ' + i.code.split('').join(' ') }, fmtCode(i.code)),
        h('span', { class: 'badge ' + st[1] }, st[0]),
        isNew ? h('span', { class: 'badge badge-warn' }, 'Neu') : null),
      i.note ? h('div', { class: 'inv-note' }, i.note) : null,
      h('div', { class: 'inv-meta' },
        h('span', null, i.uses + ' von ' + i.max_uses + ' genutzt' + (i.valid ? ' · noch ' + left + ' frei' : '')),
        h('span', null, i.expires ? 'gültig bis ' + fmtDT(i.expires) : 'ohne Ablaufdatum'),
        h('span', null, 'erstellt ' + fmtD(i.created))),
      i.valid ? h('div', { class: 'inv-actions' },
        btn('Link kopieren', 'copy', function () { copyText(url, 'Einladungslink'); }, 'btn-sm'),
        h('a', { class: 'btn btn-sm btn-wa', href: 'https://wa.me/?text=' + encodeURIComponent(waText), target: '_blank', rel: 'noopener noreferrer' }, icon('chat'), h('span', { class: 'lbl' }, 'Per WhatsApp teilen')),
        btn('QR-Code', 'qr', function () { openQr(i); }, 'btn-sm'),
        btn('Zurückziehen', 'ban', function (e) { revokeInvite(i, e.currentTarget); }, 'btn-sm btn-danger')) : null);
  }

  function revokeInvite(i, b) {
    confirmDialog('Einladung ' + fmtCode(i.code) + (i.note ? ' („' + i.note + '“)' : '') + ' zurückziehen? Danach kann sich niemand mehr damit anmelden. Bereits angemeldete Spieler bleiben dabei.',
      { title: 'Einladung zurückziehen', ok: 'Zurückziehen', danger: true }).then(function (ok) {
      if (ok) tippAct(b, 'admin_invite_revoke', { code: i.code }, 'Einladung zurückgezogen.').catch(function () { /* gemeldet */ });
    });
  }

  function openQr(i) {
    var url = inviteUrl(i.code);
    var box = h('div', { class: 'qr-box', role: 'img', 'aria-label': 'QR-Code für den Einladungslink' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }));
    var sheet = h('div', { class: 'qr-sheet' },
      h('div', { class: 'qr-title' }, 'Stüble-Tippspiel – scannen & mitmachen'),
      box,
      h('div', { class: 'qr-code' }, 'Code: ', h('strong', null, fmtCode(i.code))),
      h('div', { class: 'qr-url' }, url),
      h('div', { class: 'qr-small' }, 'Kostenlos für unsere Stammgäste · nur Punkte & Ruhm · kein Geldeinsatz'));
    var linkIn = h('input', { type: 'text', readonly: true, value: url, 'aria-label': 'Einladungslink' });
    linkIn.addEventListener('focus', function () { linkIn.select(); });
    var q = null;
    var pngB = btn('QR-Code als Bild speichern', 'download', function () {
      if (!q) return;
      qrPng(q, i.code).then(function (b) { downloadBlob(b, 'tippspiel-einladung-' + i.code + '.png'); });
    }, 'btn-primary', { disabled: true });
    var svgB = btn('SVG', 'download', function () {
      if (!q) return;
      downloadBlob(new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n' + qrSvg(q)], { type: 'image/svg+xml' }), 'tippspiel-einladung-' + i.code + '.svg');
    }, '', { disabled: true, 'aria-label': 'QR-Code als SVG-Datei speichern', title: 'Als SVG speichern (beliebig groß druckbar)' });
    var printB = btn('Drucken', 'printer', function () { printNode(sheet); }, '', { disabled: true });
    openModal({
      title: 'QR-Code für die Theke', size: 'sm',
      body: [sheet, field('Einladungslink', h('div', { class: 'input-row' }, linkIn, btn('', 'copy', function () { copyText(url, 'Einladungslink'); }, 'btn-icon', { 'aria-label': 'Link kopieren', title: 'Link kopieren' })), { forId: linkIn.id || (linkIn.id = nid()), cls: 'mt' })],
      foot: [h('div', { class: 'qr-foot' }, pngB, svgB, printB)]
    });
    loadQr().then(function () {
      q = makeQr(url);
      box.innerHTML = qrSvg(q);
      [pngB, svgB, printB].forEach(function (b) { b.disabled = false; });
    }, function (e) { box.replaceChildren(h('p', { class: 'help' }, e.message)); });
  }

  /* ---------- Spieler */

  function tippPlayers(d) {
    var wrap = h('div');
    var list = h('div', { class: 'pl-list' });
    var search = h('input', { type: 'search', placeholder: 'Spieler suchen …', 'aria-label': 'Spieler suchen', autocomplete: 'off' });
    search.value = T.playerQuery;
    function drawList() {
      var q = T.playerQuery.trim().toLowerCase();
      var arr = d.players.filter(function (p) { return !q || p.nickname.toLowerCase().indexOf(q) >= 0 || String(p.email || '').toLowerCase().indexOf(q) >= 0; });
      list.replaceChildren();
      if (!arr.length) list.appendChild(h('div', { class: 'empty' }, icon('users'), h('p', null, d.players.length ? 'Kein Spieler gefunden.' : 'Noch keine Spieler. Sobald jemand eine Einladung nutzt, erscheint er hier.')));
      arr.forEach(function (p) { list.appendChild(playerCard(p)); });
    }
    search.addEventListener('input', function () { T.playerQuery = search.value; drawList(); });
    drawList();
    var active = d.players.filter(function (p) { return p.active; }).length;
    wrap.appendChild(h('div', { class: 'pl-head' },
      h('p', { class: 'help m0' }, plural(d.players.length, 'Spieler', 'Spieler') + ', davon ' + active + ' aktiv. Deaktivierte Spieler können sich nicht anmelden und erscheinen nicht in der Rangliste.'),
      d.players.length > 5 ? search : null));
    wrap.appendChild(list);
    return wrap;
  }

  function playerCard(p) {
    var toggleB = btn(p.active ? 'Deaktivieren' : 'Aktivieren', p.active ? 'ban' : 'check', function () {
      tippAct(toggleB, 'admin_player_update', { id: p.id, active: !p.active }, p.nickname + (p.active ? ' deaktiviert.' : ' wieder aktiviert.')).catch(function () { /* gemeldet */ });
    }, 'btn-sm');
    var resetB = btn('Neues Passwort', 'key', function () {
      confirmDialog('Für „' + p.nickname + '“ ein neues, vorläufiges Passwort erzeugen? Das alte Passwort gilt dann nicht mehr und ' + p.nickname + ' wird auf allen Geräten abgemeldet.', { title: 'Passwort zurücksetzen', ok: 'Neues Passwort erzeugen' }).then(function (ok) {
        if (!ok) return;
        resetB.disabled = true;
        tcall('admin_player_reset', { id: p.id }).then(function (r) { resetB.disabled = false; showTempPw(p, r.temp_password); }, function (e) { resetB.disabled = false; toast(e.message, 'error'); });
      });
    }, 'btn-sm', { 'aria-label': 'Passwort zurücksetzen: ' + p.nickname });
    var delB = btn('Löschen', 'trash', function () {
      confirmDialog('Spieler „' + p.nickname + '“ mit ' + plural(p.tips || 0, 'Tipp', 'Tipps') + ' endgültig löschen? Er verschwindet aus der Rangliste. Das kann nicht rückgängig gemacht werden.', { title: 'Spieler löschen', ok: 'Endgültig löschen', danger: true }).then(function (ok) {
        if (ok) tippAct(delB, 'admin_player_delete', { id: p.id }, 'Spieler „' + p.nickname + '“ gelöscht.').catch(function () { /* gemeldet */ });
      });
    }, 'btn-sm btn-danger', { 'aria-label': 'Spieler löschen: ' + p.nickname });
    toggleB.setAttribute('aria-label', (p.active ? 'Deaktivieren: ' : 'Aktivieren: ') + p.nickname);
    return h('article', { class: 'pl' + (p.active ? '' : ' is-off') },
      h('div', { class: 'pl-top' },
        h('strong', { class: 'pl-name' }, p.nickname),
        h('span', { class: 'badge ' + (p.active ? 'badge-ok' : 'badge-muted') }, p.active ? 'Aktiv' : 'Deaktiviert'),
        h('span', { class: 'pl-pts' }, plural(p.points || 0, 'Punkt', 'Punkte'))),
      p.email ? h('div', { class: 'pl-mail' }, h('a', { href: 'mailto:' + p.email }, p.email)) : null,
      h('dl', { class: 'pl-kv' },
        h('div', null, h('dt', null, 'Registriert'), h('dd', null, fmtD(p.created))),
        h('div', null, h('dt', null, 'Letzter Login'), h('dd', null, p.last_login ? fmtDT(p.last_login) : 'noch nie')),
        h('div', null, h('dt', null, 'Tipps'), h('dd', null, String(p.tips || 0))),
        h('div', null, h('dt', null, 'Einladung'), h('dd', null, p.invite_code ? fmtCode(p.invite_code) : '–'))),
      h('div', { class: 'pl-actions' }, toggleB, resetB, delB));
  }

  function showTempPw(p, pw) {
    var m = openModal({
      title: 'Vorläufiges Passwort', size: 'sm', backdropClose: false,
      body: [
        h('p', null, 'Neues Passwort für ', h('strong', null, p.nickname), ':'),
        h('div', { class: 'temp-pw', 'aria-label': 'Passwort ' + pw.split('').join(' ') }, pw),
        notice('warn', 'lock', 'Wird nur jetzt angezeigt! Bitte notieren oder kopieren und dem Gast persönlich geben. Er kann es danach in der Tippspiel-App unter „Profil“ ändern.')
      ],
      foot: [btn('Kopieren', 'copy', function () { copyText(pw, 'Passwort'); }), h('button', { type: 'button', class: 'btn btn-primary', onclick: function () { m.close(); } }, 'Fertig')]
    });
  }

  /* ---------- Punkte-Regeln */

  function tippPoints(d) {
    var s = d.settings;
    var ex = document.createElement('div');
    var err = h('div', { class: 'notice notice-danger', role: 'alert', hidden: true });
    var saveB = btn('Punkte-Regeln speichern', 'check', save2, 'btn-primary');
    var st = {
      exact: stepper({ label: 'Exaktes Ergebnis', value: s.points_exact, max: 50, onChange: upd, onEnter: save2, cls: 'pts' }),
      diff: stepper({ label: 'Richtige Tordifferenz', value: s.points_diff, max: 50, onChange: upd, onEnter: save2, cls: 'pts' }),
      tend: stepper({ label: ['Richtige Tendenz', h('small', null, 'Sieg / Remis / Niederlage')], aria: 'Richtige Tendenz', value: s.points_tendency, max: 50, onChange: upd, onEnter: save2, cls: 'pts' })
    };
    function vals() { return { points_exact: st.exact.get(), points_diff: st.diff.get(), points_tendency: st.tend.get() }; }
    function check() {
      var v = vals();
      if (!st.exact.valid() || !st.diff.valid() || !st.tend.valid()) return 'Bitte überall eine Zahl von 0 bis 50 eingeben.';
      if (!(v.points_exact >= v.points_diff && v.points_diff >= v.points_tendency)) return 'Bitte so wählen: exaktes Ergebnis ≥ Tordifferenz ≥ Tendenz.';
      return '';
    }
    function upd() {
      var msg = check(), v = vals();
      var same = v.points_exact === s.points_exact && v.points_diff === s.points_diff && v.points_tendency === s.points_tendency;
      err.hidden = !msg; err.textContent = msg;
      saveB.disabled = !!msg || same;
      ex.replaceChildren(example(msg ? s : v));
    }
    function save2() {
      if (check()) return;
      tippAct(saveB, 'admin_settings_save', vals(), 'Punkte-Regeln gespeichert – die Rangliste ist neu berechnet.').catch(function () { /* gemeldet */ });
    }
    function example(v) {
      var rows = [['2:1', ['2:1', '3:2', '1:0', '3:0', '1:1', '0:2']], ['1:1', ['1:1', '0:0', '2:1']]];
      var kinds = { exact: 'exakt', diff: 'Tordifferenz', tendency: 'Tendenz', miss: 'daneben' };
      return h('div', { class: 'pts-ex' }, rows.map(function (r) {
        var res = r[0].split(':');
        return h('div', { class: 'pts-ex-block' },
          h('div', { class: 'pts-ex-h' }, 'Ergebnis ', h('strong', null, r[0])),
          h('ul', null, r[1].map(function (tp) {
            var t = tp.split(':');
            var sc = TippAPI.scoreTip({ home: +t[0], away: +t[1] }, { home_goals: +res[0], away_goals: +res[1] }, v);
            return h('li', { class: 'k-' + sc.kind }, h('span', null, 'Tipp ' + tp), h('span', { class: 'k' }, kinds[sc.kind]), h('strong', null, plural(sc.points, 'Punkt', 'Punkte')));
          })));
      }));
    }
    upd();
    return h('div', null,
      h('section', { class: 'card' },
        cardHead('Punkte pro Spiel', 'Gilt für alle Spiele – auch rückwirkend: Nach dem Speichern wird die Rangliste neu berechnet.'),
        h('div', { class: 'fields' }, err, st.exact.el, st.diff.el, st.tend.el,
          h('p', { class: 'help m0' }, 'Ein Unentschieden, das nicht exakt stimmt (z. B. 0:0 bei 1:1), zählt als Tendenz. Bonusfragen haben eigene Punkte je Wettbewerb.'),
          h('div', { class: 'btn-row' }, saveB,
            btn('Standard 4 / 3 / 2', 'history', function () { st.exact.set(4); st.diff.set(3); st.tend.set(2); }, 'btn-sm')))),
      card('Beispiel', 'So viele Punkte gäbe es mit den eingestellten Werten:', ex));
  }

  /* ---------- Website-Teaser (läuft über den normalen Speichern-Knopf) */

  function tippTeaser() {
    var c = S.content.tippspiel;
    return h('div', null,
      card('Tippspiel-Abschnitt auf der Website', 'Kurzer Werbe-Abschnitt auf der Startseite mit Knopf zum Tippspiel.',
        h('div', { class: 'fields' },
          toggle(c, 'enabled', 'Abschnitt anzeigen', 'Wird auf der Website angezeigt', 'Ausgeblendet'),
          tf('Überschrift', c, 'title', { max: 150, placeholder: 'z. B. Das Stüble-Tippspiel' }),
          tf('Text', c, 'text', { multiline: true, rows: 5, max: 2000 }),
          tf('Text auf dem Knopf', c, 'buttonText', { max: 60, placeholder: 'z. B. Zum Tippspiel' }),
          tf('Kleiner Hinweis', c, 'note', { multiline: true, rows: 2, max: 500, optional: true, help: 'Wichtig: keine Einsätze oder Geldpreise versprechen – Sportwetten mit Einsatz sind ohne Lizenz verboten.' }))),
      h('div', { class: 'btn-row' },
        btn('Jetzt speichern', 'save', save, 'btn-primary'),
        h('a', { class: 'btn', href: PREVIEWS[0][0] + '#tippspiel', target: '_blank', rel: 'noopener' }, icon('external'), h('span', { class: 'lbl' }, 'Vorschau (zuletzt gespeichert)'))));
  }

  /* ================================================================ Globale Ereignisse */

  window.addEventListener('beforeunload', function (e) {
    if (S.dirty) { e.preventDefault(); e.returnValue = ''; return ''; }
  });
  window.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S') && S.content) { e.preventDefault(); save(); }
  });
  document.addEventListener('click', function (e) {
    document.querySelectorAll('details.dropdown[open]').forEach(function (d) { if (!d.contains(e.target)) d.open = false; });
  });
  window.addEventListener('hashchange', function () {
    var parts = location.hash.replace('#', '').split('/');
    var id = parts[0];
    if (!S.content || !mainEl || !SECTIONS.some(function (s) { return s.id === id; })) return;
    if (id === 'tippspiel' && parts[1] && parts[1] !== T.sub) {
      setTippSub(parts[1]);
      if (S.section === 'tippspiel') { drawTippNav(); drawTippBody(); return; }
    }
    if (id !== S.section) showSection(id);
  });

  boot();
})();
