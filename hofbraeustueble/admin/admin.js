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
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>'
  };

  var SECTIONS = [
    { id: 'termine', label: 'Termine', icon: 'calendar', render: renderEvents },
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
        renderLogin('Sie wurden abgemeldet.');
      });
    });
  }

  /* ================================================================ Hauptansicht */

  function renderApp() {
    var hash = location.hash.replace('#', '');
    if (SECTIONS.some(function (s) { return s.id === hash; })) S.section = hash;

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
    if (location.hash !== '#' + id) history.replaceState(null, '', '#' + id);
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
    var id = location.hash.replace('#', '');
    if (S.content && mainEl && id !== S.section && SECTIONS.some(function (s) { return s.id === id; })) showSection(id);
  });

  boot();
})();
