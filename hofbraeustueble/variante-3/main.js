/*
 * Hofbräustüble – Variante 3 „Sommerabend“
 * Rendert alle Inhalte aus cms/content.json (über window.HBS) und steuert
 * Interaktionen: Tag/Nacht, Scroll-Übergang, Navigation, Parallax, Lightbox,
 * Modals, Öffnungsstatus, Kalender-Export, SEO-Metadaten.
 */
const H = window.HBS;
const esc = (s) => H.escapeHtml(s);
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const docEl = document.documentElement;
const mqReduced = matchMedia('(prefers-reduced-motion: reduce)');
const mqFine = matchMedia('(hover: hover) and (pointer: fine)');
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (e0, e1, x) => { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };

const state = {
  content: null,
  winter: false,
  mode: docEl.getAttribute('data-theme') === 'night' ? 'night' : 'day',
  reduced: mqReduced.matches,
  scene: null,
  scrolly: false,
  heroT: 0,
  heroTarget: 0,
  heroS: 0,
  toggling: false
};

/* ==========================================================================
   Icons
   ========================================================================== */
const svg = (inner, vb = '0 0 24 24') => `<svg viewBox="${vb}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const ICONS = {
  beer: svg('<path d="M5 8h10v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8Z"/><path d="M15 10h2.2A1.8 1.8 0 0 1 19 11.8v3.4a1.8 1.8 0 0 1-1.8 1.8H15"/><path d="M5 8a2.5 2.5 0 0 1 1.6-4.4A3 3 0 0 1 12 3a2.6 2.6 0 0 1 3 2.6A2 2 0 0 1 15 8"/><path d="M8.5 12v6M11.5 12v6"/>'),
  tv: svg('<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4"/><path d="m10 9 4 2-4 2V9Z" fill="currentColor"/>'),
  smoke: svg('<rect x="2.5" y="15" width="15" height="3.5" rx=".8"/><path d="M14 15v3.5"/><path d="M20.5 15v3.5M17.8 6.5c0 1.8 2.7 1.8 2.7 3.6 0 1.4-1.2 2-1.2 3M15.5 4c0 1.6 2.2 1.8 2.2 3.4"/>'),
  sun: svg('<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.5 1.5M17.2 17.2l1.5 1.5M5.3 18.7l1.5-1.5M17.2 6.8l1.5-1.5"/>'),
  music: svg('<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>'),
  darts: svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>'),
  cards: svg('<rect x="3" y="6" width="11" height="15" rx="1.5" transform="rotate(-8 8.5 13.5)"/><rect x="10" y="3.5" width="11" height="15" rx="1.5"/><path d="M15.5 8.5l1.6 2.2-1.6 2.2-1.6-2.2Z"/>'),
  heart: svg('<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z"/>'),
  star: svg('<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/>'),
  users: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14a6.5 6.5 0 0 1 3.5 6"/>'),
  phone: svg('<path d="M5 3.5h3.2l1.6 4.2-2.2 1.4a11.5 11.5 0 0 0 5.3 5.3l1.4-2.2 4.2 1.6V17a2 2 0 0 1-2 2A15.5 15.5 0 0 1 3 5.5a2 2 0 0 1 2-2Z"/>'),
  mail: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/>'),
  pin: svg('<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>'),
  route: svg('<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h7.5a3.5 3.5 0 0 0 0-7h-7a3.5 3.5 0 0 1 0-7H16"/>'),
  cal: svg('<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4M12 13.5v4M10 15.5h4"/>'),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>'),
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.1"/>'),
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  external: svg('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
  facebook: svg('<path d="M14 8.5V6.8c0-.8.5-1.3 1.3-1.3H17V2.5h-2.6C11.9 2.5 10.5 4 10.5 6.4v2.1H8v3h2.5v10H14v-10h2.6l.4-3Z"/>'),
  instagram: svg('<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".6" fill="currentColor"/>')
};
const ICON_ALIASES = { bier: 'beer', fass: 'beer', sky: 'tv', fernseher: 'tv', fussball: 'tv', football: 'tv', sport: 'tv', rauchen: 'smoke', smoking: 'smoke', sonne: 'sun', summer: 'sun', sommer: 'sun', musik: 'music', dart: 'darts', karten: 'cards', skat: 'cards', herz: 'heart', people: 'users', gaeste: 'users' };
const icon = (name) => ICONS[name] || ICONS[ICON_ALIASES[String(name || '').toLowerCase()]] || ICONS.star;

/* ==========================================================================
   Lichterkette (SVG)
   ========================================================================== */
let garlandId = 0;
function garlandSVG({ width = 1440, height = 150, spans = 4, y0 = 14, sag = 70, perSpan = 7, light = false, jitter = true } = {}) {
  const id = 'gh' + (++garlandId);
  let out = `<svg class="garland${light ? ' garland--light' : ''}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMin slice" focusable="false"><defs><radialGradient id="${id}"><stop offset="0" stop-color="#ffd896" stop-opacity=".95"/><stop offset=".35" stop-color="#ffb764" stop-opacity=".45"/><stop offset="1" stop-color="#ff9a4a" stop-opacity="0"/></radialGradient></defs>`;
  const sw = width / spans;
  for (let s = 0; s < spans; s++) {
    const x0 = s * sw - 6, x1 = (s + 1) * sw + 6;
    const ya = y0 + (jitter ? ((s * 37) % 11) : 0), yb = y0 + (jitter ? (((s + 1) * 37) % 11) : 0);
    const sg = sag * (jitter ? (.85 + ((s * 53) % 30) / 100) : 1);
    const cx = (x0 + x1) / 2, cy = Math.max(ya, yb) + sg * 2 - (ya + yb) / 2 + Math.min(ya, yb) * 0;
    out += `<g class="garland__g"><path class="garland__wire" d="M${x0.toFixed(1)} ${ya} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x1.toFixed(1)} ${yb}"/>`;
    for (let k = 1; k <= perSpan; k++) {
      const t = k / (perSpan + 1);
      const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1;
      const y = (1 - t) * (1 - t) * ya + 2 * (1 - t) * t * cy + t * t * yb;
      out += `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><circle class="garland__halo" r="26" cy="14" fill="url(#${id})"/><rect class="garland__socket" x="-3.2" y="0" width="6.4" height="7" rx="1.2"/><ellipse class="garland__bulb" cx="0" cy="14" rx="5.6" ry="7.4"/></g>`;
    }
    out += '</g>';
  }
  return out + '</svg>';
}

/* ==========================================================================
   Öffnungszeiten-Logik
   ========================================================================== */
function parseRange(str) {
  const m = String(str || '').match(/(\d{1,2})[:.](\d{2})\s*(?:–|—|-|bis)\s*(\d{1,2})[:.](\d{2})/i);
  if (!m) return null;
  const open = +m[1] * 60 + +m[2];
  let close = +m[3] * 60 + +m[4];
  if (close <= open) close += 1440; // über Mitternacht
  return { open, close };
}
const fmtMin = (min) => { if (min === 1440) return '24:00'; const m = ((min % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
const isRest = (str) => /ruhetag|geschlossen|zu\b/i.test(String(str || ''));

function hoursStatus(hours, now = new Date()) {
  const list = Array.isArray(hours) ? hours : [];
  const idx = H.todayHoursIndex();
  const mins = now.getHours() * 60 + now.getMinutes();
  const today = list[idx] || null;
  const r = today && parseRange(today.hours);
  const prev = list[(idx + 6) % 7];
  const rp = prev && parseRange(prev.hours);
  const res = { idx, today, open: false, unknown: false };
  if (!list.length) { res.unknown = true; return res; }
  if (rp && rp.close > 1440 && mins < rp.close - 1440) { res.open = true; res.until = fmtMin(rp.close); res.closesSoon = rp.close - 1440 - mins <= 60; return res; }
  if (r && mins >= r.open && mins < r.close) { res.open = true; res.until = fmtMin(r.close); res.closesSoon = r.close - mins <= 60; return res; }
  if (r && mins < r.open) { res.nextDay = 0; res.nextAt = fmtMin(r.open); return res; }
  res.restToday = !r && today && isRest(today.hours);
  if (!r && today && !isRest(today.hours)) res.unknown = true;
  for (let k = 1; k <= 7; k++) {
    const e = list[(idx + k) % 7];
    const rr = e && parseRange(e.hours);
    if (rr) { res.nextDay = k; res.nextName = e.day; res.nextAt = fmtMin(rr.open); break; }
  }
  return res;
}
function statusTexts(st) {
  if (st.unknown && !st.open) return { chip: st.today ? `Heute: ${st.today.hours}` : 'Öffnungszeiten ansehen', line: st.today ? esc(st.today.hours) : '', cls: '' };
  if (st.open) return { chip: `Jetzt geöffnet · bis ${st.until} Uhr`, line: `Geöffnet bis <em>${esc(st.until)}&nbsp;Uhr</em>`, cls: 'is-open', head: st.closesSoon ? 'Schließt bald' : 'Jetzt geöffnet' };
  if (st.nextDay === 0) return { chip: `Heute ab ${st.nextAt} Uhr geöffnet`, line: `Heute ab <em>${esc(st.nextAt)}&nbsp;Uhr</em>`, cls: 'is-closed', head: 'Gerade geschlossen' };
  const when = st.nextDay === 1 ? 'Morgen' : esc(st.nextName || '');
  if (st.restToday) return { chip: `Heute Ruhetag · ${when} ab ${st.nextAt} Uhr`, line: `Heute ist <em>Ruhetag</em>`, cls: 'is-closed', head: 'Heute Ruhetag', sub: `Wieder für euch da: ${when} ab ${esc(st.nextAt)} Uhr.` };
  if (st.nextAt) return { chip: `Geschlossen · ${when} ab ${st.nextAt} Uhr`, line: `${when} ab <em>${esc(st.nextAt)}&nbsp;Uhr</em>`, cls: 'is-closed', head: 'Gerade geschlossen' };
  return { chip: 'Öffnungszeiten ansehen', line: '', cls: '' };
}

/* ==========================================================================
   Rendering
   ========================================================================== */
function titleWithAccent(str) {
  // letztes Wort kursiv – funktioniert mit jedem CMS-Titel
  const words = String(str || '').trim().split(/\s+/);
  if (words.length < 2) return esc(str);
  const last = words.pop();
  return `${esc(words.join(' '))} <em>${esc(last)}</em>`;
}

function renderMeta(c) {
  const m = c.meta || {};
  const name = m.siteName || 'Hofbräustüble';
  document.title = m.tagline ? `${name} – ${m.tagline}` : name;
  const set = (sel, val) => { const el = $(sel); if (el) el.setAttribute('content', val || ''); };
  set('meta[name="description"]', m.seoDescription);
  set('meta[property="og:title"]', document.title);
  set('meta[property="og:description"]', m.seoDescription);
  set('meta[property="og:site_name"]', name);
  const ogImg = (c.summer && c.summer.enabled && c.summer.image) || (c.hero && c.hero.image) || (c.gallery && c.gallery[0] && c.gallery[0].src);
  if (ogImg) set('meta[property="og:image"]', new URL(H.asset(ogImg), location.href).href);
  let canon = $('link[rel="canonical"]');
  if (!canon) { canon = document.createElement('link'); canon.rel = 'canonical'; document.head.appendChild(canon); }
  canon.href = location.href.split('#')[0].split('?')[0];
  $$('[data-site-name]').forEach((el) => { el.textContent = name; });

  // JSON-LD BarOrPub
  const ct = c.contact || {};
  const dayMap = { montag: 'Monday', dienstag: 'Tuesday', mittwoch: 'Wednesday', donnerstag: 'Thursday', freitag: 'Friday', samstag: 'Saturday', sonntag: 'Sunday' };
  const order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const ohs = (c.openingHours || []).map((o, i) => {
    const r = parseRange(o.hours); if (!r) return null;
    const close = r.close === 1440 ? '23:59' : fmtMin(r.close);
    return { '@type': 'OpeningHoursSpecification', dayOfWeek: 'https://schema.org/' + (dayMap[String(o.day).toLowerCase()] || order[i]), opens: fmtMin(r.open), closes: close };
  }).filter(Boolean);
  const abs = (p) => new URL(H.asset(p), location.href).href;
  const images = [c.hero && c.hero.image, c.summer && c.summer.image].concat((c.gallery || []).map((g) => g.src)).filter(Boolean);
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'BarOrPub',
    name,
    description: m.seoDescription || m.tagline || '',
    url: canon.href,
    image: Array.from(new Set(images)).map(abs),
    telephone: ct.phone || undefined,
    email: ct.email || undefined,
    smokingAllowed: true,
    address: { '@type': 'PostalAddress', streetAddress: ct.street, postalCode: ct.zip, addressLocality: [ct.city, ct.district].filter(Boolean).join('-'), addressCountry: 'DE' },
    hasMap: ct.mapsUrl || undefined,
    openingHoursSpecification: ohs,
    sameAs: [c.social && c.social.facebook, c.social && c.social.instagram].filter(Boolean),
    event: H.upcomingEvents(c, 10).map((e) => ({
      '@type': 'Event', name: e.title, description: e.description || undefined,
      startDate: e.date + (e.time ? 'T' + e.time : ''),
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode', eventStatus: 'https://schema.org/EventScheduled',
      location: { '@type': 'Place', name, address: H.fullAddress(ct) },
      image: e.image ? [abs(e.image)] : undefined
    }))
  };
  const s = document.createElement('script');
  s.type = 'application/ld+json';
  s.textContent = JSON.stringify(ld).replace(/</g, '\\u003c');
  document.head.appendChild(s);
}

function renderBanner(c) {
  const b = c.banner || {};
  const el = $('#banner');
  let dismissed = false;
  try { dismissed = sessionStorage.getItem('hbs3_banner') === String(b.text); } catch (e) { /* ignore */ }
  if (b.enabled && b.text && !dismissed) {
    $('#banner-text').textContent = b.text;
    el.hidden = false;
    $('#banner-close').addEventListener('click', () => {
      el.hidden = true;
      try { sessionStorage.setItem('hbs3_banner', String(b.text)); } catch (e) { /* ignore */ }
      measureHeader();
    });
  }
}

function sectionsList(c) {
  const list = [['ueber-uns', 'Über uns']];
  if (c.summer && c.summer.enabled) list.push(['sommer', 'Sommer']);
  list.push(['termine', 'Termine'], ['oeffnungszeiten', 'Öffnungszeiten']);
  if ((c.gallery || []).length) list.push(['galerie', 'Galerie']);
  list.push(['kontakt', 'Kontakt']);
  return list;
}
function renderNav(c) {
  const list = sectionsList(c);
  $('#nav-links').innerHTML = list.map(([id, label]) => `<li><a href="#${id}">${label}</a></li>`).join('');
  $('#mobile-links').innerHTML = list.map(([id, label], i) => `<li><a href="#${id}"><small>0${i + 1}</small>${label}</a></li>`).join('');
  const ct = c.contact || {};
  $('#mobile-foot').innerHTML = `
    <a class="status-chip" href="#oeffnungszeiten" data-status></a>
    ${ct.phone ? `<a href="${esc(H.telHref(ct.phone))}">${esc(ct.phone)}</a>` : ''}
    <span>${esc(H.fullAddress(ct))}</span>`;
}

function renderHero(c) {
  const h = c.hero || {}, m = c.meta || {};
  $('#hero-eyebrow').textContent = m.tagline || '';
  const title = h.title || m.siteName || '';
  const t = $('#hero-title');
  t.setAttribute('aria-label', title);
  let ci = 0;
  t.innerHTML = `<span aria-hidden="true">${title.split(/\s+/).map((w) => `<span class="tword">${Array.from(w).map((ch) => `<span class="tw" style="--i:${ci++}">${esc(ch)}</span>`).join('')}</span>`).join(' ')}</span>`;
  $('#hero-subtitle').textContent = h.subtitle || '';
  const cta = $('#hero-cta');
  cta.innerHTML = `${esc(h.ctaText || 'Termine')} ${ICONS.arrow}`;
  $('#hero-night-eyebrow').textContent = state.winter ? 'Heute in der warmen Stube' : 'Heute Abend';
  $('#hero-cue-text').textContent = state.winter ? 'Scrollen – es wird gemütlich' : 'Scrollen – die Lichter gehen an';
  if (h.image) $('#hero-fallback-img').style.backgroundImage = `url("${encodeURI(H.asset(h.image))}")`;
  $('#hero-fallback-garland').innerHTML = garlandSVG({ spans: 4, perSpan: 7, sag: 46, height: 170 });
}

function renderStatus(c) {
  const st = hoursStatus(c.openingHours);
  const tx = statusTexts(st);
  $$('[data-status]').forEach((el) => {
    el.className = el.className.replace(/\bis-(open|closed)\b/g, '').trim() + (tx.cls ? ' ' + tx.cls : '');
    el.innerHTML = `<span class="status-dot" aria-hidden="true"></span><span>${esc(tx.chip)}</span>`;
  });
  // Nacht-Kapitel im Hero
  $('#hero-night-line').innerHTML = tx.line || esc(c.meta && c.meta.siteName);
  const todayH = st.today ? `Heute (${esc(st.today.day)}): ${esc(st.today.hours)}.` : '';
  $('#hero-night-sub').innerHTML = [tx.sub || todayH, esc(c.hoursNote || '')].filter(Boolean).join(' ');
  // Abschnitt Öffnungszeiten
  const box = $('#hours-status');
  if (box) {
    box.className = 'hours__status ' + (tx.cls || '');
    box.innerHTML = `<p class="hours__status-head"><span class="status-dot" aria-hidden="true"></span>${esc(tx.head || 'Öffnungszeiten')}</p><p class="hours__status-line">${tx.line || ''}</p>${tx.sub ? `<p>${tx.sub}</p>` : ''}`;
  }
  // Sticker
  const sticker = $('#about-sticker');
  if (sticker && st.today) {
    const r = parseRange(st.today.hours);
    sticker.innerHTML = r ? `Heute<strong>${esc(fmtMin(r.open).replace(':00', ''))}–${esc(fmtMin(r.close).replace(':00', ''))}</strong>Uhr` : `Heute<strong>${esc(st.today.hours)}</strong>`;
  }
  // Heute markieren
  $$('.hours__row').forEach((row, i) => {
    const today = i === st.idx;
    row.classList.toggle('hours__row--today', today);
    const tag = row.querySelector('.hours__today');
    if (today && !tag) row.querySelector('.hours__day').insertAdjacentHTML('beforeend', '<span class="hours__today">Heute</span>');
    if (!today && tag) tag.remove();
    if (today) row.setAttribute('aria-current', 'date'); else row.removeAttribute('aria-current');
  });
}

function polaroid({ src, alt, cap = '', cls = '', sizes = '', eager = false }) {
  return `<figure class="polaroid ${cls}" data-tilt><div class="polaroid__img"><img src="${esc(H.asset(src))}" alt="${esc(alt)}" loading="${eager ? 'eager' : 'lazy'}" decoding="async"${sizes ? ` sizes="${sizes}"` : ''} width="1050" height="1400"></div>${cap ? `<figcaption class="polaroid__cap">${esc(cap)}</figcaption>` : ''}</figure>`;
}

function renderAbout(c) {
  const a = c.about || {};
  $('#about-title').innerHTML = titleWithAccent(a.title);
  $('#about-text').innerHTML = H.paragraphs(a.text);
  if (state.winter) $('#ueber-uns .eyebrow').textContent = 'Die warme Stube';
  // Collage: Hero-Bild + ein weiteres Bild aus der Galerie
  const main = (c.hero && c.hero.image) || (c.gallery && c.gallery[0] && c.gallery[0].src);
  const g2 = (c.gallery || []).find((g) => g.src && g.src !== main);
  const capFor = (src) => { const g = (c.gallery || []).find((x) => x.src === src); return g ? g.caption : ''; };
  let html = '';
  if (main) html += polaroid({ src: main, alt: capFor(main) || (a.title || ''), cap: capFor(main), cls: 'polaroid--a polaroid--tape' });
  if (g2) html += polaroid({ src: g2.src, alt: g2.caption || '', cap: g2.caption, cls: 'polaroid--b polaroid--tape' });
  html += '<p class="about__sticker" id="about-sticker" aria-hidden="true"></p>';
  $('#about-collage').innerHTML = html;
  const hl = a.highlights || [];
  $('#highlights').innerHTML = hl.map((h, i) => `
    <li class="highlight" data-reveal style="--d:${(i * .08).toFixed(2)}s">
      <span class="highlight__icon">${icon(h.icon)}</span>
      <h3>${esc(h.title)}</h3>
      <p>${esc(h.text)}</p>
    </li>`).join('');
  if (!hl.length) $('#highlights').remove();
}

function renderSummer(c) {
  const s = c.summer || {};
  const sec = $('#sommer');
  if (!s.enabled) { sec.remove(); return; }
  sec.hidden = false;
  $('#summer-title').innerHTML = titleWithAccent(s.title);
  $('#summer-text').innerHTML = H.paragraphs(s.text);
  if (s.season) $('#summer-season').innerHTML = `<span class="season__sun" aria-hidden="true"></span>${esc(s.season)}`;
  else $('#summer-season').remove();
  $('#summer-tag').innerHTML = `<small>${esc((c.meta && c.meta.siteName) || '')}</small>${esc(s.title || '')}`;
  $('#summer-lights').innerHTML = garlandSVG({ width: 800, height: 260, spans: 2, perSpan: 8, sag: 60, y0: 10 });
  const photo = $('#summer-photo');
  if (s.image) {
    const src = H.asset(s.image);
    photo.innerHTML = `<img src="${esc(src)}" alt="${esc(s.title || '')}" loading="lazy" decoding="async" width="1050" height="1400">`;
    $('#summer-stage').dataset.cutout = '0';
    // Himmel freistellen, damit der Abendhimmel dahinter sichtbar wird (Tiefenebenen)
    const io = new IntersectionObserver((ents) => {
      if (ents.some((e) => e.isIntersecting)) { io.disconnect(); makeSkyCutout(src).then((cv) => { if (cv) { cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', s.title || ''); photo.replaceChildren(cv); $('#summer-stage').dataset.cutout = '1'; } }); }
    }, { rootMargin: '600px' });
    io.observe(sec);
  }
}

/** Freistellung des Himmels per Flood-Fill – CMS-tauglich (prüft Plausibilität). */
function makeSkyCutout(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      try {
        const W = img.naturalWidth, Hh = img.naturalHeight;
        const sc = Math.min(1, 520 / W);
        const w = Math.round(W * sc), h = Math.round(Hh * sc);
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        const g = cv.getContext('2d', { willReadFrequently: true });
        g.drawImage(img, 0, 0, w, h);
        const d = g.getImageData(0, 0, w, h).data;
        const N = w * h;
        const skyish = new Uint8Array(N);
        for (let i = 0; i < N; i++) {
          const r = d[i * 4], gg = d[i * 4 + 1], b = d[i * 4 + 2];
          skyish[i] = (b > 55 && b > r + 22 && b > gg + 8) ? 1 : 0;
        }
        const sky = new Uint8Array(N);
        const stack = [];
        const push = (i) => { if (!sky[i] && skyish[i]) { sky[i] = 1; stack.push(i); } };
        for (let x = 0; x < w; x++) push(x);
        for (let y = 0; y < h * .6; y++) { push(y * w); push(y * w + w - 1); }
        while (stack.length) {
          const i = stack.pop(), x = i % w, y = (i / w) | 0;
          if (x > 0) push(i - 1); if (x < w - 1) push(i + 1); if (y > 0) push(i - w); if (y < h - 1) push(i + w);
        }
        // alles, was nicht Himmel ist UND mit dem Boden verbunden ist, bleibt stehen (Wolken fallen weg)
        const keep = new Uint8Array(N);
        const st2 = [];
        const push2 = (i) => { if (!keep[i] && !sky[i]) { keep[i] = 1; st2.push(i); } };
        for (let x = 0; x < w; x++) push2((h - 1) * w + x);
        while (st2.length) {
          const i = st2.pop(), x = i % w, y = (i / w) | 0;
          if (x > 0) push2(i - 1); if (x < w - 1) push2(i + 1); if (y > 0) push2(i - w); if (y < h - 1) push2(i + w);
        }
        let removed = 0;
        for (let i = 0; i < N; i++) if (!keep[i]) removed++;
        const frac = removed / N;
        if (frac < .04 || frac > .7) { resolve(null); return; }
        const mask = document.createElement('canvas'); mask.width = w; mask.height = h;
        const mg = mask.getContext('2d');
        const md = mg.createImageData(w, h);
        for (let i = 0; i < N; i++) { md.data[i * 4 + 3] = keep[i] ? 255 : 0; }
        mg.putImageData(md, 0, 0);
        // Ausgabe in voller Auflösung (max. 1200 px breit)
        const os = Math.min(1, 1200 / W);
        const ow = Math.round(W * os), oh = Math.round(Hh * os);
        const out = document.createElement('canvas'); out.width = ow; out.height = oh;
        const og = out.getContext('2d');
        og.drawImage(img, 0, 0, ow, oh);
        // Golden-Hour-Grading
        og.globalCompositeOperation = 'soft-light';
        const grd = og.createLinearGradient(0, 0, ow * .4, oh);
        grd.addColorStop(0, 'rgba(255,150,70,.85)'); grd.addColorStop(.6, 'rgba(255,175,110,.55)'); grd.addColorStop(1, 'rgba(120,70,110,.5)');
        og.fillStyle = grd; og.fillRect(0, 0, ow, oh);
        og.globalCompositeOperation = 'multiply';
        og.fillStyle = 'rgba(255,214,170,.35)'; og.fillRect(0, 0, ow, oh);
        // Maske anwenden (weich skaliert)
        og.globalCompositeOperation = 'destination-in';
        og.imageSmoothingEnabled = true; og.imageSmoothingQuality = 'high';
        og.filter = 'blur(1.2px)';
        og.drawImage(mask, 0, 0, ow, oh);
        og.filter = 'none';
        og.globalCompositeOperation = 'source-over';
        resolve(out);
      } catch (e) { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

const CAT_COLORS = { sport: '#4f9fd6', fussball: '#4f9fd6', fußball: '#4f9fd6', feier: '#e76f51', party: '#e76f51', sommer: '#f4a261', stammtisch: '#c49458', musik: '#9b6fd0', live: '#9b6fd0', quiz: '#3cb39a' };
const catColor = (cat) => CAT_COLORS[String(cat || '').trim().toLowerCase()] || '#7d8bbd';

function relDays(iso) {
  const p = iso.split('-').map(Number);
  const d = new Date(p[0], p[1] - 1, p[2]);
  const now = new Date(); const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((d - t0) / 86400000);
  if (diff === 0) return 'Heute';
  if (diff === 1) return 'Morgen';
  if (diff < 14) return `in ${diff} Tagen`;
  return '';
}

function eventArt(e) {
  const f = H.formatDate(e.date);
  return `<svg class="event-feature__art" viewBox="0 0 640 440" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><linearGradient id="evsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d1530"/><stop offset=".55" stop-color="#25306a"/><stop offset="1" stop-color="#b8576a"/></linearGradient>
    <radialGradient id="evglow" cx=".75" cy="1" r=".7"><stop offset="0" stop-color="#ffb36b" stop-opacity=".7"/><stop offset="1" stop-color="#ffb36b" stop-opacity="0"/></radialGradient></defs>
    <rect width="640" height="440" fill="url(#evsky)"/><rect width="640" height="440" fill="url(#evglow)"/>
    <g fill="#fff" opacity=".7"><circle cx="60" cy="50" r="1.2"/><circle cx="180" cy="90" r="1"/><circle cx="300" cy="40" r="1.4"/><circle cx="420" cy="70" r="1"/><circle cx="560" cy="36" r="1.3"/><circle cx="510" cy="120" r="1"/></g>
    <text x="40" y="300" font-family="Cormorant Garamond, Georgia, serif" font-size="230" fill="none" stroke="rgba(255,226,180,.35)" stroke-width="1.5">${esc(f.day)}</text>
    <text x="330" y="300" font-family="Oswald, sans-serif" font-size="34" letter-spacing="10" fill="rgba(255,226,180,.55)">${esc(f.monthLong.toUpperCase())}</text>
  </svg>`;
}

function icsFor(e, c) {
  const pad = (n) => String(n).padStart(2, '0');
  const escI = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  const [Y, M, D] = e.date.split('-').map(Number);
  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}00Z`;
  let start, end;
  const tm = String(e.time || '').match(/^(\d{1,2}):(\d{2})/);
  if (tm) {
    const s = new Date(Y, M - 1, D, +tm[1], +tm[2]);
    const en = new Date(s.getTime() + 3 * 3600000);
    const f = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
    start = `DTSTART:${f(s)}`; end = `DTEND:${f(en)}`;
  } else {
    const n = new Date(Y, M - 1, D + 1);
    start = `DTSTART;VALUE=DATE:${Y}${pad(M)}${pad(D)}`; end = `DTEND;VALUE=DATE:${n.getFullYear()}${pad(n.getMonth() + 1)}${pad(n.getDate())}`;
  }
  const name = (c.meta && c.meta.siteName) || '';
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Hofbraeustueble//Website//DE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${escI(e.id || e.date + e.title)}@hofbraeustueble`, `DTSTAMP:${stamp}`, start, end,
    `SUMMARY:${escI(e.title)}${name ? ' – ' + escI(name) : ''}`, `DESCRIPTION:${escI(e.description)}`, `LOCATION:${escI([name, H.fullAddress(c.contact)].filter(Boolean).join(', '))}`,
    'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
}

function renderEvents(c) {
  const list = H.upcomingEvents(c);
  const root = $('#events-list');
  if (!list.length) {
    root.innerHTML = `<div class="empty-state" data-reveal>
      <svg class="empty-state__art" viewBox="0 0 132 132" aria-hidden="true"><circle cx="66" cy="66" r="62" fill="var(--surface-2)"/><path d="M14 30 Q66 70 118 30" fill="none" stroke="currentColor" stroke-width="1.4" opacity=".6"/>${[30, 48, 66, 84, 102].map((x, i) => { const y = 30 + 40 * (1 - Math.pow((x - 66) / 52, 2)) * .5 + 4; return `<circle cx="${x}" cy="${y.toFixed(1)}" r="10" fill="#ffc87a" opacity=".35"/><ellipse cx="${x}" cy="${y.toFixed(1)}" rx="4" ry="5.2" fill="#ffcf87"/>`; }).join('')}<path d="M48 76h28v30a5 5 0 0 1-5 5H53a5 5 0 0 1-5-5V76Z" fill="#f4a261" opacity=".9"/><path d="M76 82h6a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5h-6" fill="none" stroke="#f4a261" stroke-width="3.5"/><path d="M46 77c0-5 4-8 8-7 2-4 9-5 12-1 3-3 11-2 11 4 0 2-1 4-3 4H48c-1 0-2 0-2 0Z" fill="#fff6e6"/></svg>
      <h3>Gerade keine Termine geplant</h3>
      <p>Neue Abende, Spiele und Feste stehen bald an. Schaut einfach vorbei – das Bier ist auch ohne Anlass frisch gezapft.</p>
      <a class="btn btn--ghost" href="#oeffnungszeiten">Zu den Öffnungszeiten</a></div>`;
    return;
  }
  const [first, ...rest] = list;
  const ff = H.formatDate(first.date);
  const media = first.image
    ? `<img src="${esc(H.asset(first.image))}" alt="" loading="lazy" decoding="async">`
    : eventArt(first);
  let html = `<div class="events__layout"><article class="event-feature" data-reveal>
      <div class="event-feature__media">${media}</div>
      <div class="event-feature__body">
        <p class="event-feature__kicker">Als Nächstes${relDays(first.date) ? ' · ' + esc(relDays(first.date)) : ''}</p>
        <h3>${esc(first.title)}</h3>
        <p class="event-feature__when"><time datetime="${esc(first.date + (first.time ? 'T' + first.time : ''))}">${esc(ff.long)}${first.time ? ` · ${esc(first.time)} Uhr` : ''}</time></p>
        ${first.description ? `<p class="event-feature__desc">${esc(first.description)}</p>` : ''}
        ${first.category ? `<span class="chip" style="--cat:${catColor(first.category)}">${esc(first.category)}</span>` : ''}
        <button type="button" class="ics-btn" data-ics="0">${ICONS.cal} In den Kalender</button>
      </div></article>`;
  html += '<div class="timeline">';
  if (!rest.length) html += '';
  let month = '';
  rest.forEach((e, i) => {
    const f = H.formatDate(e.date);
    const mk = f.monthLong + ' ' + f.year;
    if (mk !== month) { month = mk; html += `<p class="timeline__month" data-reveal>${esc(mk)}</p>`; }
    const rel = relDays(e.date);
    html += `<article class="event" data-reveal style="--cat:${catColor(e.category)}">
      <div class="event__date" aria-hidden="true"><span class="event__day">${esc(f.day)}</span><span class="event__month">${esc(f.month)}</span></div>
      <div class="event__card">
        <div>
          <p class="event__meta">${e.category ? `<span class="chip">${esc(e.category)}</span>` : ''}<time datetime="${esc(e.date + (e.time ? 'T' + e.time : ''))}">${esc(f.weekday)}, ${esc(f.day)}. ${esc(f.monthLong)}${e.time ? ` · ${esc(e.time)} Uhr` : ''}</time>${rel ? `<span class="event__rel">${esc(rel)}</span>` : ''}</p>
          <h3>${esc(e.title)}</h3>
          ${e.description ? `<p class="event__desc">${esc(e.description)}</p>` : ''}
          <button type="button" class="ics-btn" data-ics="${i + 1}">${ICONS.cal} In den Kalender</button>
        </div>
        ${e.image ? `<figure class="polaroid event__thumb"><div class="polaroid__img"><img src="${esc(H.asset(e.image))}" alt="" loading="lazy" decoding="async"></div></figure>` : ''}
      </div></article>`;
  });
  html += '</div></div>';
  root.innerHTML = html;
  root.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-ics]'); if (!b) return;
    const e = list[+b.dataset.ics]; if (!e) return;
    const blob = new Blob([icsFor(e, c)], { type: 'text/calendar;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (e.id || ('termin-' + e.date)).replace(/[^\w-]+/g, '-') + '.ics';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  });
}

function renderHours(c) {
  const hours = c.openingHours || [];
  $('#hours-list').innerHTML = hours.map((o) => {
    const r = parseRange(o.hours);
    const rest = !r;
    const time = r ? esc(o.hours).replace(/\s*[–—-]\s*/, ' – ') + ' <span class="sr-only">Uhr</span>' : esc(o.hours);
    return `<li class="hours__row${rest ? ' hours__row--rest' : ''}"><span class="hours__day">${esc(o.day)}</span><span class="hours__time">${time}</span></li>`;
  }).join('');
  const note = $('#hours-note');
  if (c.hoursNote) note.innerHTML = `${ICONS.info}<span>${esc(c.hoursNote)}</span>`; else note.remove();
  $('#hours-garland').innerHTML = garlandSVG({ spans: 3, perSpan: 9, sag: 44, height: 150 });
}

function renderGallery(c) {
  const g = (c.gallery || []).filter((x) => x && x.src);
  if (!g.length) { $('#galerie').remove(); return; }
  const track = $('#gallery-track');
  track.innerHTML = g.map((it, i) => `<li class="gallery__item" data-reveal style="--d:${(i * .1).toFixed(2)}s">
    <span class="gallery__peg" aria-hidden="true"></span>
    <button type="button" class="gallery__btn" data-index="${i}" aria-label="Bild vergrößern: ${esc(it.caption || 'Bild ' + (i + 1))}">
      ${polaroid({ src: it.src, alt: it.caption || '', cap: it.caption })}
    </button></li>`).join('');
  track.insertAdjacentHTML('beforeend', '<li class="gallery__wire" aria-hidden="true" role="presentation"></li>');
  const drawWire = () => {
    const wire = $('.gallery__wire', track);
    const items = $$('.gallery__item', track);
    if (!items.length) return;
    const W = track.scrollWidth;
    track.classList.toggle('is-centered', W <= track.clientWidth + 2);
    const W2 = track.scrollWidth;
    const pts = items.map((it) => [it.offsetLeft + it.offsetWidth / 2, it.offsetTop - 2]);
    wire.style.width = W2 + 'px';
    const id = 'gw' + (++garlandId);
    let d = `M0 ${pts[0][1] - 30}`;
    let bulbs = '';
    const seg = (a, b) => {
      const cx = (a[0] + b[0]) / 2, cy = Math.max(a[1], b[1]) + 46;
      d += ` Q${cx.toFixed(1)} ${cy.toFixed(1)} ${b[0].toFixed(1)} ${b[1].toFixed(1)}`;
      for (let k = 1; k <= 3; k++) {
        const t = k / 4;
        const x = (1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * cx + t * t * b[0];
        const y = (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * cy + t * t * b[1];
        bulbs += `<g transform="translate(${x.toFixed(1)} ${(y - 6).toFixed(1)})"><circle r="22" cy="12" fill="url(#${id})" class="garland__halo"/><rect class="garland__socket" x="-3" y="0" width="6" height="6" rx="1"/><ellipse class="garland__bulb" cx="0" cy="12" rx="5" ry="6.6"/></g>`;
      }
    };
    seg([0, pts[0][1] - 40], pts[0]);
    for (let i = 1; i < pts.length; i++) seg(pts[i - 1], pts[i]);
    seg(pts[pts.length - 1], [W2, pts[pts.length - 1][1] - 40]);
    wire.innerHTML = `<svg class="garland" width="${W2}" height="140" viewBox="0 0 ${W2} 140" style="--glow:${state.mode === 'night' ? 1 : .55}"><defs><radialGradient id="${id}"><stop offset="0" stop-color="#ffd896" stop-opacity=".9"/><stop offset=".4" stop-color="#ffb764" stop-opacity=".35"/><stop offset="1" stop-color="#ff9a4a" stop-opacity="0"/></radialGradient></defs><path class="garland__wire" d="${d}"/>${bulbs}</svg>`;
    $('#gallery-hint').classList.toggle('is-visible', W2 > track.clientWidth + 2);
  };
  state.drawWire = drawWire;
  requestAnimationFrame(drawWire);
  new ResizeObserver(() => drawWire()).observe(track);
  setupLightbox(g);
}

function renderContact(c) {
  const ct = c.contact || {};
  const name = (c.meta && c.meta.siteName) || '';
  const cards = [];
  const addr = H.fullAddress(ct);
  if (addr) cards.push(`<div class="contact-card"><span class="contact-card__icon">${ICONS.pin}</span><span><span class="contact-card__label">Adresse</span><span class="contact-card__value">${esc(name)}<br>${esc(ct.street || '')}<br>${esc([ct.zip, ct.city].filter(Boolean).join(' '))}${ct.district ? '-' + esc(ct.district) : ''}</span>${ct.note ? `<span class="contact-card__note">${esc(ct.note)}</span>` : ''}</span></div>`);
  if (ct.phone) cards.push(`<a class="contact-card" href="${esc(H.telHref(ct.phone))}"><span class="contact-card__icon">${ICONS.phone}</span><span><span class="contact-card__label">Anrufen</span><span class="contact-card__value">${esc(ct.phone)}</span></span></a>`);
  if (ct.email) cards.push(`<a class="contact-card" href="mailto:${esc(ct.email)}"><span class="contact-card__icon">${ICONS.mail}</span><span><span class="contact-card__label">E-Mail schreiben</span><span class="contact-card__value">${esc(ct.email)}</span></span></a>`);
  let html = cards.join('');
  const soc = c.social || {};
  const socials = [['facebook', 'Facebook'], ['instagram', 'Instagram']].filter(([k]) => soc[k] && /^https?:\/\//.test(soc[k]));
  if (socials.length) html += `<div class="social">${socials.map(([k, l]) => `<a href="${esc(soc[k])}" target="_blank" rel="noopener noreferrer" aria-label="${l} (öffnet in neuem Tab)">${ICONS[k]}</a>`).join('')}</div>`;
  $('#contact-cards').innerHTML = html;

  const mapsOk = ct.mapsUrl && /^https?:\/\//.test(ct.mapsUrl);
  $('#contact-map').innerHTML = `<div class="map-card">
    <svg viewBox="0 0 500 525" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect class="map-block" x="0" y="0" width="500" height="525" opacity=".55"/>
      <g class="map-green"><circle cx="70" cy="90" r="38"/><circle cx="120" cy="60" r="26"/><circle cx="430" cy="440" r="46"/><circle cx="380" cy="480" r="30"/><circle cx="460" cy="90" r="22"/></g>
      <g class="map-block"><rect x="40" y="250" width="120" height="90" rx="8"/><rect x="40" y="370" width="120" height="120" rx="8"/><rect x="300" y="60" width="150" height="110" rx="8"/><rect x="200" y="20" width="70" height="80" rx="8"/><rect x="300" y="300" width="80" height="80" rx="8"/></g>
      <g class="map-road" fill="none" stroke-linecap="round"><path d="M-20 215 L520 215" stroke-width="30"/><path d="M245 -20 L245 545" stroke-width="30"/><path d="M-20 500 Q200 420 520 470" stroke-width="16"/><path d="M380 -20 L420 545" stroke-width="12"/><path d="M-20 140 L245 140" stroke-width="10"/></g>
      <g fill="none" stroke="#f4a261" stroke-width="3" stroke-dasharray="2 9" stroke-linecap="round"><path d="M245 520 L245 240 L250 230"/></g>
      <rect x="210" y="180" width="70" height="70" rx="10" fill="#f6ecd8" stroke="#d8bf98" stroke-width="2"/>
    </svg>
    <span class="map-card__pin" aria-hidden="true"></span>
    <p class="map-card__label"><strong>${esc(name)}</strong><span>${esc([ct.street, ct.district].filter(Boolean).join(' · '))}</span></p>
    ${mapsOk ? `<a class="btn btn--sun map-card__btn" href="${esc(ct.mapsUrl)}" target="_blank" rel="noopener noreferrer">${ICONS.route} Route in Google Maps<span class="sr-only"> (öffnet in neuem Tab)</span></a>` : ''}
  </div>`;
}

function renderFooter(c) {
  const m = c.meta || {}, ct = c.contact || {};
  $('#footer-tagline').textContent = m.tagline || '';
  $('#footer-contact').innerHTML = `<p>${esc(ct.street || '')}<br>${esc([ct.zip, ct.city].filter(Boolean).join(' '))}${ct.district ? '-' + esc(ct.district) : ''}</p>
    <p>${ct.phone ? `<a href="${esc(H.telHref(ct.phone))}">${esc(ct.phone)}</a><br>` : ''}${ct.email ? `<a href="mailto:${esc(ct.email)}">${esc(ct.email)}</a>` : ''}</p>`;
  $('#footer-copy').textContent = `© ${new Date().getFullYear()} ${m.siteName || ''}`;
  $('#footer-garland').innerHTML = garlandSVG({ spans: 3, perSpan: 8, sag: 40, height: 130 });
}

/* ==========================================================================
   Dialoge: Rechtliches & Lightbox
   ========================================================================== */
let lastFocus = null;
function openDialog(dlg) {
  lastFocus = document.activeElement;
  if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  document.body.classList.add('is-locked');
}
function closeDialog(dlg) {
  if (typeof dlg.close === 'function' && dlg.open) dlg.close(); else dlg.removeAttribute('open');
}
function wireDialog(dlg) {
  dlg.addEventListener('close', () => { document.body.classList.remove('is-locked'); if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true }); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) closeDialog(dlg); });
}

function setupLegal(c) {
  const dlg = $('#legal');
  wireDialog(dlg);
  $('#legal-close').addEventListener('click', () => closeDialog(dlg));
  const im = c.impressum || {}, ds = c.datenschutz || {};
  const content = {
    impressum: {
      title: 'Impressum',
      html: `<h3>Angaben gemäß § 5 DDG</h3><address><p>${esc(im.businessName || '')}<br>${esc(im.owner || '')}<br>${esc(im.street || '')}<br>${esc(im.zipCity || '')}</p></address>
        <h3>Kontakt</h3><p>${im.phone ? `Telefon: <a href="${esc(H.telHref(im.phone))}">${esc(im.phone)}</a><br>` : ''}${im.email ? `E-Mail: <a href="mailto:${esc(im.email)}">${esc(im.email)}</a>` : ''}</p>
        ${im.vatId ? `<h3>Umsatzsteuer-ID</h3><p>Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: ${esc(im.vatId)}</p>` : ''}
        ${im.responsible ? `<h3>Verantwortlich für den Inhalt gemäß § 18 Abs. 2 MStV</h3><p>${esc(im.responsible)}</p>` : ''}
        ${im.extraText ? `<h3>Hinweise</h3>${H.paragraphs(im.extraText)}` : ''}`
    },
    datenschutz: { title: 'Datenschutz', html: H.paragraphs(ds.text || '') }
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-legal]'); if (!b) return;
    const k = content[b.dataset.legal]; if (!k) return;
    $('#legal-title').textContent = k.title;
    $('#legal-body').innerHTML = k.html;
    openDialog(dlg);
    $('#legal-body').scrollTop = 0;
  });
}

function setupLightbox(items) {
  const dlg = $('#lightbox');
  wireDialog(dlg);
  const img = $('#lightbox-img'), cap = $('#lightbox-caption'), cnt = $('#lightbox-count');
  let idx = 0;
  const show = (i) => {
    idx = (i + items.length) % items.length;
    const it = items[idx];
    img.src = H.asset(it.src); img.alt = it.caption || '';
    cap.textContent = it.caption || '';
    cnt.textContent = items.length > 1 ? `${idx + 1} / ${items.length}` : '';
  };
  const multi = items.length > 1;
  $('#lightbox-prev').hidden = !multi; $('#lightbox-next').hidden = !multi;
  $('#lightbox-prev').addEventListener('click', () => show(idx - 1));
  $('#lightbox-next').addEventListener('click', () => show(idx + 1));
  $('#lightbox-close').addEventListener('click', () => closeDialog(dlg));
  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' && multi) { e.preventDefault(); show(idx - 1); }
    if (e.key === 'ArrowRight' && multi) { e.preventDefault(); show(idx + 1); }
  });
  let sx = null;
  img.addEventListener('pointerdown', (e) => { sx = e.clientX; });
  img.addEventListener('pointerup', (e) => { if (sx == null) return; const dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 45 && multi) show(idx + (dx < 0 ? 1 : -1)); });
  $('#gallery-track').addEventListener('click', (e) => {
    const b = e.target.closest('.gallery__btn'); if (!b) return;
    show(+b.dataset.index); openDialog(dlg);
    $('#lightbox-close').focus();
  });
}

/* ==========================================================================
   Interaktion: Header, Menü, Tag/Nacht, Scroll
   ========================================================================== */
function measureHeader() {
  const b = $('#banner');
  const bh = b && !b.hidden ? b.offsetHeight : 0;
  docEl.style.setProperty('--banner-h', bh + 'px');
}

function setupMenu() {
  const burger = $('#burger'), menu = $('#mobile-menu');
  const open = (v) => {
    burger.setAttribute('aria-expanded', String(v));
    burger.querySelector('.sr-only').textContent = v ? 'Menü schließen' : 'Menü öffnen';
    if (v) { menu.hidden = false; requestAnimationFrame(() => menu.classList.add('is-open')); document.body.classList.add('is-locked'); $('#site-header').classList.add('is-dark', 'menu-open'); }
    else { menu.classList.remove('is-open'); document.body.classList.remove('is-locked'); $('#site-header').classList.remove('menu-open'); setTimeout(() => { if (burger.getAttribute('aria-expanded') === 'false') menu.hidden = true; }, 450); update(); }
  };
  burger.addEventListener('click', () => open(burger.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) open(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && burger.getAttribute('aria-expanded') === 'true') { open(false); burger.focus(); }
    // Fokus im Menü halten
    if (e.key === 'Tab' && burger.getAttribute('aria-expanded') === 'true') {
      const f = [burger, $('#daynight'), ...$$('a', menu)];
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && (i <= 0)) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      else if (i === -1) { e.preventDefault(); f[0].focus(); }
    }
  });
  matchMedia('(min-width: 981px)').addEventListener('change', (e) => { if (e.matches) open(false); });
}

function setMode(mode, fromUser) {
  state.mode = mode;
  docEl.setAttribute('data-theme', mode);
  const btn = $('#daynight');
  btn.setAttribute('aria-pressed', String(mode === 'night'));
  $('#daynight-sr').textContent = mode === 'night' ? 'Tagmodus einschalten' : 'Nachtmodus einschalten';
  btn.setAttribute('aria-label', mode === 'night' ? 'Nachtmodus aktiv – zu Tag wechseln' : 'Tagmodus aktiv – zu Nacht wechseln');
  $('meta[name="theme-color"]').setAttribute('content', mode === 'night' ? '#0f1832' : '#fbf5ea');
  if (fromUser) { try { localStorage.setItem('hbs3_theme', mode); } catch (e) { /* ignore */ } state.toggling = true; }
  const gw = $('.gallery__wire svg'); if (gw) gw.style.setProperty('--glow', mode === 'night' ? 1 : .55);
  update();
}

let ticking = false;
function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; update(); }); } }

const hero = $('#top');
const header = $('#site-header');
function heroProgress() {
  if (!state.scrolly) return 0;
  const r = hero.getBoundingClientRect();
  const range = r.height - window.innerHeight;
  return range > 0 ? clamp01(-r.top / range) : 0;
}
function computeTarget(s) {
  if (state.mode === 'night') return 1;
  if (!state.scrolly) return state.reduced ? .34 : .12;
  return smooth(.04, .92, s);
}

function update() {
  const y = window.scrollY;
  header.classList.toggle('is-scrolled', y > 24);
  const s = heroProgress();
  state.heroS = s;
  state.heroTarget = computeTarget(s);
  animateHeroT();
  // Kapitel
  const day = $('#hero-day'), night = $('#hero-night');
  if (state.scrolly) {
    const o1 = 1 - smooth(.1, .34, s), o2 = smooth(.46, .66, s) * (1 - smooth(.96, 1.0, s) * 0);
    day.style.opacity = o1.toFixed(3);
    day.style.transform = `translate3d(0, ${(-s * 90).toFixed(1)}px, 0)`;
    day.style.visibility = o1 < .01 ? 'hidden' : 'visible';
    night.style.opacity = o2.toFixed(3);
    night.style.transform = `translate3d(0, ${((1 - o2) * 40).toFixed(1)}px, 0)`;
    night.style.visibility = o2 < .01 ? 'hidden' : 'visible';
  }
  hero.style.setProperty('--s', s.toFixed(4));
  if (state.scene) state.scene.setDolly(s);
  // Header-Farbe
  const hb = hero.getBoundingClientRect().bottom;
  const hh = header.offsetHeight;
  let dark;
  if (hb > hh) dark = state.heroT > .5;
  else {
    dark = state.mode === 'night';
    for (const el of $$('[data-dark]')) { const r = el.getBoundingClientRect(); if (r.top <= hh && r.bottom >= hh) { dark = true; break; } }
  }
  if (!header.classList.contains('menu-open')) header.classList.toggle('is-dark', dark);
  // Sommer-Bühne
  const stage = $('#summer-stage');
  if (stage) {
    const r = stage.getBoundingClientRect();
    const vh = window.innerHeight;
    const p = clamp01((vh - r.top) / (vh + r.height));
    stage.style.setProperty('--p', p.toFixed(3));
    stage.style.setProperty('--sunset', smooth(.3, .75, p).toFixed(3));
    const nightV = state.mode === 'night' ? 1 : (state.reduced ? .15 : smooth(.5, .78, p));
    stage.style.setProperty('--night', nightV.toFixed(3));
  }
}

let tRaf = 0, tLast = 0;
function animateHeroT() {
  if (tRaf) return;
  tLast = performance.now();
  const step = (now) => {
    const dt = Math.min((now - tLast) / 1000, .1); tLast = now;
    const rate = state.reduced ? 1000 : (state.toggling ? 2.2 : 14);
    const k = 1 - Math.exp(-rate * dt);
    state.heroT += (state.heroTarget - state.heroT) * k;
    const done = Math.abs(state.heroTarget - state.heroT) < .001;
    if (done) { state.heroT = state.heroTarget; state.toggling = false; }
    hero.style.setProperty('--t', state.heroT.toFixed(4));
    hero.classList.toggle('is-dark', state.heroT > .5);
    if (state.scene) state.scene.setTarget(state.heroT, true);
    const dot = $('#hero-dial-dot'); if (dot) dot.style.top = (state.heroT * 100).toFixed(1) + '%';
    const hb = hero.getBoundingClientRect().bottom;
    if (hb > header.offsetHeight && !header.classList.contains('menu-open')) header.classList.toggle('is-dark', state.heroT > .5);
    tRaf = done ? 0 : requestAnimationFrame(step);
  };
  tRaf = requestAnimationFrame(step);
}

function setupActiveNav() {
  const links = $$('#nav-links a');
  const map = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
  const io = new IntersectionObserver((ents) => {
    ents.forEach((e) => {
      const a = map.get(e.target.id); if (!a) return;
      if (e.isIntersecting) { links.forEach((l) => l.removeAttribute('aria-current')); a.setAttribute('aria-current', 'true'); }
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  map.forEach((_, id) => { const el = document.getElementById(id); if (el) io.observe(el); });
}

function setupReveal() {
  if (!('IntersectionObserver' in window) || state.reduced) return;
  docEl.classList.add('js-reveal');
  const io = new IntersectionObserver((ents) => {
    ents.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: .08 });
  $$('[data-reveal]').forEach((el) => io.observe(el));
}

function setupTilt() {
  if (state.reduced || !mqFine.matches) return;
  document.addEventListener('pointermove', (e) => {
    const el = e.target.closest && e.target.closest('[data-tilt]');
    $$('.polaroid.is-tilting').forEach((p) => { if (p !== el) { p.classList.remove('is-tilting'); p.style.removeProperty('--tx'); p.style.removeProperty('--ty'); } });
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
    el.classList.add('is-tilting');
    el.style.setProperty('--ty', (x * 18).toFixed(2) + 'deg');
    el.style.setProperty('--tx', (-y * 14).toFixed(2) + 'deg');
    el.style.setProperty('--gx', ((x + .5) * 100).toFixed(1) + '%');
    el.style.setProperty('--gy', ((y + .5) * 100).toFixed(1) + '%');
  }, { passive: true });

  const stage = $('#summer-stage');
  if (stage) {
    const wrap = stage.parentElement;
    wrap.addEventListener('pointermove', (e) => {
      const r = stage.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      stage.style.setProperty('--ry', (x * 8).toFixed(2) + 'deg');
      stage.style.setProperty('--rx', (-y * 6).toFixed(2) + 'deg');
      stage.style.setProperty('--mx', (x * 2).toFixed(3));
    });
    wrap.addEventListener('pointerleave', () => { stage.style.setProperty('--ry', '0deg'); stage.style.setProperty('--rx', '0deg'); stage.style.setProperty('--mx', '0'); });
  }
}

/* ==========================================================================
   3D-Hero
   ========================================================================== */
function hasWebGL2() {
  try { const c = document.createElement('canvas'); return !!(window.WebGL2RenderingContext && c.getContext('webgl2')); } catch (e) { return false; }
}
function useFallback() {
  hero.classList.add('is-fallback');
  const cv = $('#hero-canvas'); if (cv) cv.remove();
}
async function setupHero3D(c) {
  if (window.HBS_FORCE_NO_WEBGL || !hasWebGL2()) { useFallback(); return; }
  const canvas = $('#hero-canvas');
  try {
    const mod = await import('./hero3d.js');
    const scene = await mod.createHeroScene({ canvas, winter: state.winter, reducedMotion: state.reduced, signText: (c.meta && c.meta.siteName) || '' });
    state.scene = scene;
    window.__hero = scene;
    scene.setTarget(state.heroT, true);
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); scene.dispose(); state.scene = null; useFallback(); });
    requestAnimationFrame(() => canvas.classList.add('is-ready'));
    let heroVisible = true;
    new IntersectionObserver((ents) => { heroVisible = ents[0].isIntersecting; scene.setVisible(heroVisible && !document.hidden); }, { rootMargin: '80px' }).observe(hero);
    document.addEventListener('visibilitychange', () => scene.setVisible(heroVisible && !document.hidden));
    scene.setVisible(true);
    if (!state.reduced) {
      window.addEventListener('pointermove', (e) => {
        scene.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
      }, { passive: true });
    }
  } catch (err) {
    console.warn('3D-Szene nicht verfügbar, nutze Fallback.', err);
    useFallback();
  }
}

/* ==========================================================================
   Start
   ========================================================================== */
async function init() {
  let c;
  try { c = await H.load(); }
  catch (e) {
    $('#main').insertAdjacentHTML('afterbegin', '<p class="noscript" role="alert">Die Inhalte konnten gerade nicht geladen werden. Bitte versuche es später erneut.</p>');
    return;
  }
  state.content = c;
  state.winter = !(c.summer && c.summer.enabled);
  docEl.setAttribute('data-season', state.winter ? 'winter' : 'summer');
  state.scrolly = !state.reduced;
  hero.classList.toggle('is-scrolly', state.scrolly);
  $$('.hours, .site-footer').forEach((el) => el.setAttribute('data-dark', ''));

  renderMeta(c);
  renderBanner(c);
  renderNav(c);
  renderHero(c);
  renderAbout(c);
  renderSummer(c);
  renderEvents(c);
  renderHours(c);
  renderGallery(c);
  renderContact(c);
  renderFooter(c);
  renderStatus(c);
  setupLegal(c);
  setupMenu();
  measureHeader();
  setMode(state.mode, false);
  state.heroT = state.heroTarget; hero.style.setProperty('--t', state.heroT.toFixed(4));
  $('#daynight').addEventListener('click', () => setMode(state.mode === 'night' ? 'day' : 'night', true));
  setupActiveNav();
  setupReveal();
  setupTilt();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => { measureHeader(); onScroll(); });
  setInterval(() => renderStatus(c), 60000);
  update();
  setupHero3D(c);
  // Anker nach dem Rendern nachziehen (Inhalte kamen asynchron)
  if (location.hash && location.hash.length > 1) { const el = document.getElementById(decodeURIComponent(location.hash.slice(1))); if (el) setTimeout(() => el.scrollIntoView(), 50); }
}
init();
