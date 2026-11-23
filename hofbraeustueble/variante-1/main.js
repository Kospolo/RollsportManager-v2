/*!
 * Hofbräustüble – Variante 1 „Bernstein & Messing"
 * Rendert alle Inhalte aus cms/content.json (via window.HBS) und steuert die Interaktionen.
 */
const HBS = window.HBS;
const doc = document;
const $ = (sel, root = doc) => root.querySelector(sel);
const $$ = (sel, root = doc) => Array.from(root.querySelectorAll(sel));
const esc = (s) => HBS.escapeHtml(s);
const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
const mqFine = window.matchMedia('(hover: hover) and (pointer: fine)');
const reduceMotion = () => mqReduce.matches;

/* ---------------------------------------------------------------- Icons */
const ICONS = {
  beer: '<path d="M5 8h10v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/><path d="M15 10.5h2.3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H15"/><path d="M4.6 8.4c0-2.2 1.7-3.6 3.6-3.2.9-1.8 3.6-2.2 5-.8 1.8-.3 3.2 1 3.2 2.8v1.2"/><path d="M8.5 12v5.5M11.5 12v5.5"/>',
  tv: '<rect x="2.5" y="6" width="19" height="12.5" rx="1.5"/><path d="M8 21.5h8M9 2.5 12 6l3-3.5"/>',
  smoke: '<path d="M2.5 15.5h14v3.5h-14z"/><path d="M19 15.5V19M21.5 15.5V19"/><path d="M18.6 12.5c0-1.9-1.9-2.4-1.9-4.3s1.5-2.4 1.5-4"/><path d="M21.6 12.5c0-1.9-1.9-2.4-1.9-4.3s1.5-2.4 1.5-4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  ball: '<circle cx="12" cy="12" r="9"/><path d="m12 7.2 4 2.9-1.5 4.6h-5L8 10.1z"/><path d="M12 7.2V3.1M16 10.1l3.9-1.3M14.5 14.7l2.4 3.4M9.5 14.7l-2.4 3.4M8 10.1 4.1 8.8"/>',
  darts: '<circle cx="11" cy="13" r="8.5"/><circle cx="11" cy="13" r="4.5"/><circle cx="11" cy="13" r="1"/><path d="M11 13 20.5 3.5M17.5 3.5h3v3"/>',
  cards: '<rect x="3" y="5" width="10.5" height="15" rx="1.5" transform="rotate(-9 8.25 12.5)"/><rect x="10.5" y="4" width="10.5" height="15" rx="1.5" transform="rotate(9 15.75 11.5)"/><path d="M15.4 9.6l1.2 2.2-1.9 1.6"/>',
  toast: '<path d="M4 3h6l-.5 6a2.5 2.5 0 0 1-5 0z"/><path d="M7 11.5V19M4.5 20.5h5"/><path d="M14 3h6l-.5 6a2.5 2.5 0 0 1-5 0z"/><path d="M17 11.5V19M14.5 20.5h5"/><path d="M4.3 6h5.4M14.3 6h5.4"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="1.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  calendarPlus: '<rect x="3" y="4.5" width="18" height="16.5" rx="1.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4M12 12.5v5M9.5 15h5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="m3.5 6 8.5 7 8.5-7"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  car: '<path d="M5 16.5h14M5 16.5V12l2-5h10l2 5v4.5M5 16.5v2.5M19 16.5v2.5M3.5 11h17"/><circle cx="8" cy="14" r=".6"/><circle cx="16" cy="14" r=".6"/>',
  arrow: '<path d="M7 17 17 7M9 7h8v8"/>',
  shield: '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6z"/><path d="m8.8 12.2 2.3 2.3 4.2-4.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  facebook: '<path d="M14 8h3V4.5h-3a4 4 0 0 0-4 4V11H7v3.5h3V21h3.5v-6.5h3L17 11h-3.5V8.5A.5.5 0 0 1 14 8z"/>',
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r=".8"/>'
};
const icon = (name, cls = '') => `<svg viewBox="0 0 24 24" aria-hidden="true"${cls ? ` class="${cls}"` : ''}>${ICONS[name] || ICONS.star}</svg>`;

function eventIcon(ev) {
  const s = `${ev.category || ''} ${ev.title || ''}`.toLowerCase();
  if (/dart/.test(s)) return 'darts';
  if (/sport|fußball|fussball|bundesliga|champions|länderspiel|em\b|wm\b|kick/.test(s)) return 'ball';
  if (/skat|karten|stammtisch|spiel|quiz/.test(s)) return 'cards';
  if (/feier|party|silvester|weihnacht|fest|geburtstag|fasching|jubil/.test(s)) return 'toast';
  if (/sommer|garten|außen|draußen/.test(s)) return 'sun';
  return 'beer';
}

/* Letztes Wort einer CMS-Überschrift kursiv in Bernstein hervorheben */
function accentTitle(text) {
  const t = String(text || '').trim();
  const i = t.lastIndexOf(' ');
  if (i < 1) return `<em>${esc(t)}</em>`;
  return `${esc(t.slice(0, i))} <em>${esc(t.slice(i + 1))}</em>`;
}

/* ------------------------------------------------- Öffnungszeiten-Logik */
const WD_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MON_FIRST = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

/** "16:00 – 01:00" → [[960, 1500]]; "Ruhetag" → []; unbekannt → null */
function parseRanges(str) {
  const s = String(str || '').trim();
  if (!s) return null;
  const re = /(\d{1,2})(?:[:.](\d{2}))?\s*(?:uhr)?\s*(?:–|—|-|bis)\s*(\d{1,2})(?:[:.](\d{2}))?/gi;
  const out = [];
  let m;
  while ((m = re.exec(s))) {
    const o = +m[1] * 60 + (+m[2] || 0);
    let c = +m[3] * 60 + (+m[4] || 0);
    if (o > 1440 || c > 1440) continue;
    if (c <= o) c += 1440; // über Mitternacht
    out.push([o, c]);
  }
  if (out.length) return out;
  if (/ruhetag|geschlossen|zu\b|closed/i.test(s)) return [];
  return null;
}
const hhmm = (min) => {
  const m = ((min % 1440) + 1440) % 1440;
  if (min === 1440) return '24:00';
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
};

/** Status relativ zu jetzt; null wenn die Zeiten nicht auswertbar sind */
function openStatus(hours, now = new Date()) {
  if (!Array.isArray(hours) || hours.length !== 7) return null;
  const parsed = hours.map((h) => parseRanges(h && h.hours));
  if (parsed.every((p) => p === null)) return null;
  const today = (now.getDay() + 6) % 7; // 0 = Montag
  const mins = now.getHours() * 60 + now.getMinutes();
  const yest = (today + 6) % 7;
  for (const [, c] of parsed[yest] || []) {
    if (c > 1440 && mins < c - 1440) return { open: true, until: c - 1440, left: c - 1440 - mins };
  }
  for (const [o, c] of parsed[today] || []) {
    if (mins >= o && mins < c) return { open: true, until: c, left: c - mins };
  }
  for (let d = 0; d < 8; d++) {
    const idx = (today + d) % 7;
    const ranges = (parsed[idx] || []).slice().sort((a, b) => a[0] - b[0]);
    for (const [o] of ranges) {
      if (d === 0 && o <= mins) continue;
      return { open: false, inDays: d, dayIdx: idx, at: o };
    }
  }
  return { open: false };
}

function statusText(st, hours) {
  if (!st) return null;
  if (st.open) {
    const soon = st.left <= 60;
    return { cls: soon ? 'is-soon' : 'is-open', html: `<strong>${soon ? 'Schließt bald' : 'Jetzt geöffnet'}</strong> · bis ${hhmm(st.until)} Uhr` };
  }
  if (st.inDays == null) return { cls: 'is-closed', html: '<strong>Gerade geschlossen</strong>' };
  const dayName = (hours[st.dayIdx] && hours[st.dayIdx].day) || MON_FIRST[st.dayIdx];
  const when = st.inDays === 0 ? 'heute' : st.inDays === 1 ? 'morgen' : esc(dayName);
  return { cls: 'is-closed', html: `<strong>Gerade geschlossen</strong> · öffnet ${when} um ${hhmm(st.at)} Uhr` };
}

/* ------------------------------------------------------------ Rendering */
let C = null; // geladener Content

function setMeta(c) {
  const m = c.meta || {};
  const name = m.siteName || (c.hero && c.hero.title) || '';
  const title = [name, m.tagline].filter(Boolean).join(' – ');
  if (title) doc.title = title;
  const setAttr = (sel, val) => { const el = $(sel); if (el && val) el.setAttribute('content', val); };
  setAttr('meta[name="description"]', m.seoDescription);
  setAttr('meta[property="og:title"]', title);
  setAttr('meta[property="og:description"]', m.seoDescription);
  setAttr('meta[property="og:site_name"]', name);
  const ogImg = (c.hero && c.hero.image) || (c.gallery && c.gallery[0] && c.gallery[0].src);
  if (ogImg) setAttr('meta[property="og:image"]', new URL(HBS.asset(ogImg), location.href).href);

  // JSON-LD (BarOrPub)
  const ct = c.contact || {};
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const spec = [];
  (c.openingHours || []).forEach((h, i) => {
    (parseRanges(h.hours) || []).forEach(([o, cl]) => {
      spec.push({ '@type': 'OpeningHoursSpecification', dayOfWeek: 'https://schema.org/' + days[i], opens: hhmm(o), closes: cl >= 1440 ? (cl === 1440 ? '23:59' : hhmm(cl)) : hhmm(cl) });
    });
  });
  const abs = (p) => new URL(HBS.asset(p), location.href).href;
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'BarOrPub',
    name,
    description: m.seoDescription || undefined,
    url: location.href.split('#')[0],
    image: [c.hero && c.hero.image, ...(c.gallery || []).map((g) => g.src)].filter(Boolean).map(abs),
    telephone: ct.phone || undefined,
    email: ct.email || undefined,
    address: {
      '@type': 'PostalAddress',
      streetAddress: ct.street || undefined,
      postalCode: ct.zip || undefined,
      addressLocality: [ct.city, ct.district].filter(Boolean).join('-') || undefined,
      addressCountry: 'DE'
    },
    hasMap: ct.mapsUrl || undefined,
    smokingAllowed: true,
    openingHoursSpecification: spec.length ? spec : undefined,
    sameAs: [c.social && c.social.facebook, c.social && c.social.instagram].filter(Boolean),
    event: HBS.upcomingEvents(c, 10).map((e) => ({
      '@type': 'Event',
      name: e.title,
      description: e.description || undefined,
      startDate: e.date + (e.time ? 'T' + e.time : ''),
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      image: e.image ? abs(e.image) : undefined,
      location: { '@type': 'Place', name, address: HBS.fullAddress(ct) }
    }))
  };
  if (!ld.sameAs.length) delete ld.sameAs;
  if (!ld.event.length) delete ld.event;
  const s = doc.createElement('script');
  s.type = 'application/ld+json';
  s.textContent = JSON.stringify(ld);
  doc.head.appendChild(s);
}

function renderBanner(c) {
  const b = c.banner || {};
  const el = $('#banner');
  if (!b.enabled || !b.text) return;
  const key = 'hbs_v1_banner_closed';
  try { if (sessionStorage.getItem(key) === b.text) return; } catch (e) { /* ignorieren */ }
  $('#banner-text').textContent = b.text;
  el.hidden = false;
  $('#banner-close').addEventListener('click', () => {
    el.hidden = true;
    try { sessionStorage.setItem(key, b.text); } catch (e) { /* ignorieren */ }
  });
}

function renderHero(c) {
  const h = c.hero || {};
  const m = c.meta || {};
  const name = m.siteName || h.title || '';
  $('#brand-name').textContent = name;
  $('#hero-eyebrow').textContent = m.tagline || '';
  const title = $('#hero-title');
  const t = h.title || name;
  title.setAttribute('aria-label', t);
  title.innerHTML = Array.from(t).map((ch, i) =>
    ch === ' ' ? ' ' : `<span class="char" aria-hidden="true" style="--i:${i}">${esc(ch)}</span>`).join('') +
    '<span class="hero__title-rule" aria-hidden="true"></span>';
  $('#hero-subtitle').textContent = h.subtitle || '';
  const cta = $('#hero-cta');
  $('span', cta).textContent = h.ctaText || 'Termine';
  if (h.image) {
    const img = $('#hero-fallback-img');
    img.src = HBS.asset(h.image);
  }
}

function renderAbout(c) {
  const a = c.about || {};
  $('#about-title').innerHTML = accentTitle(a.title);
  $('#about-text').innerHTML = HBS.paragraphs(a.text);
  const sig = $('#about-signature');
  const name = (c.meta && c.meta.siteName) || '';
  if (name) sig.textContent = 'Euer ' + name; else sig.remove();

  // Bildcollage: erstes Galeriebild + Hero-Bild (beides aus dem CMS)
  const g = (c.gallery || []).filter((x) => x && x.src);
  const first = g[0] || (c.hero && c.hero.image ? { src: c.hero.image, caption: '' } : null);
  let second = c.hero && c.hero.image && (!first || c.hero.image !== first.src) ? { src: c.hero.image, caption: '' } : g[1];
  if (second && first && second.src === first.src) second = g[1] || null;
  const img1 = $('#about-img-1'), img2 = $('#about-img-2');
  if (first) { img1.src = HBS.asset(first.src); img1.alt = first.caption || name; } else img1.closest('figure').remove();
  if (second) { img2.src = HBS.asset(second.src); img2.alt = second.caption || name; } else img2.closest('figure').remove();

  const seal = [name, c.contact && c.contact.district, 'Zutritt ab 18'].filter(Boolean).map((s) => s.toUpperCase());
  $('#seal-text').textContent = (seal.join(' · ') + ' · ');

  const hl = (a.highlights || []).filter((x) => x && (x.title || x.text));
  $('#highlights').innerHTML = hl.map((x, i) => `
    <li data-reveal style="--d:${i * 0.08}s">
      <article class="hl" data-tilt>
        <span class="hl__num" aria-hidden="true">0${i + 1}</span>
        <div class="hl__icon">${icon(ICONS[x.icon] ? x.icon : 'star')}</div>
        <h3 class="hl__title">${esc(x.title)}</h3>
        <p class="hl__text">${esc(x.text)}</p>
      </article>
    </li>`).join('');
  if (!hl.length) $('#highlights').remove();
}

/* --- Termine --- */
function icsFor(ev, c) {
  const pad = (n) => String(n).padStart(2, '0');
  const [y, mo, d] = ev.date.split('-').map(Number);
  const [hh, mm] = (ev.time || '19:00').split(':').map(Number);
  const start = new Date(y, mo - 1, d, hh || 0, mm || 0);
  const end = new Date(start.getTime() + 3 * 3600e3);
  const f = (dt) => `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}00`;
  const t = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  const name = (c.meta && c.meta.siteName) || '';
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Hofbraeustueble//Website//DE', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:${t(ev.id || ev.date + ev.title)}@hofbraeustueble`,
    `DTSTAMP:${f(new Date())}`,
    ev.time ? `DTSTART:${f(start)}` : `DTSTART;VALUE=DATE:${ev.date.replace(/-/g, '')}`,
    ev.time ? `DTEND:${f(end)}` : null,
    `SUMMARY:${t(ev.title + (name ? ' – ' + name : ''))}`,
    ev.description ? `DESCRIPTION:${t(ev.description)}` : null,
    `LOCATION:${t([name, HBS.fullAddress(c.contact)].filter(Boolean).join(', '))}`,
    'END:VEVENT', 'END:VCALENDAR'
  ].filter(Boolean).join('\r\n');
}

function renderEvents(c) {
  const list = HBS.upcomingEvents(c);
  const wrap = $('#events-list');
  if (!list.length) {
    wrap.innerHTML = `
      <div class="events__empty" data-reveal>
        ${icon('calendar')}
        <h3>Gerade keine Termine geplant</h3>
        <p>Die nächsten Spiele, Stammtische und Feste stehen bald hier. Bis dahin gilt: Das Bier ist kalt und die Stube offen.</p>
      </div>`;
    return;
  }
  const todayIso = new Date();
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const tIso = iso(todayIso);
  const tomorrow = iso(new Date(todayIso.getFullYear(), todayIso.getMonth(), todayIso.getDate() + 1));
  const LIMIT = 6;

  wrap.innerHTML = list.map((ev, i) => {
    const f = HBS.formatDate(ev.date);
    const wd = WD_SHORT[(['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']).indexOf(f.weekday)] || '';
    const rel = ev.date === tIso ? 'Heute' : ev.date === tomorrow ? 'Morgen' : '';
    const media = ev.image
      ? `<div class="ev__media"><img src="${esc(HBS.asset(ev.image))}" alt="" loading="lazy" decoding="async"></div>`
      : `<div class="ev__media ev__media--art" aria-hidden="true">${icon(eventIcon(ev))}</div>`;
    return `
      <article class="ev${i >= LIMIT ? ' is-extra' : ''}" data-tilt data-reveal style="--d:${(i % 3) * 0.08}s"${i >= LIMIT ? ' hidden' : ''}>
        <div style="position:relative">
          ${media}
          ${rel ? `<span class="ev__badge">${rel}</span>` : ''}
          <p class="ev__date" aria-hidden="true"><span class="ev__day">${esc(f.day)}</span><span class="ev__month">${esc(f.month)}</span><span class="ev__wd">${esc(wd)}</span></p>
        </div>
        <div class="ev__body">
          <p class="ev__meta">
            ${ev.category ? `<span class="ev__cat">${esc(ev.category)}</span>` : ''}
            ${ev.time ? `<span class="ev__time">${icon('clock')}${esc(ev.time)} Uhr</span>` : ''}
          </p>
          <h3 class="ev__title">${esc(ev.title)}</h3>
          ${ev.description ? `<p class="ev__desc">${esc(ev.description)}</p>` : ''}
          <div class="ev__foot">
            <span class="ev__long"><span class="sr-only">Datum: </span>${esc(f.long)}</span>
            <button class="ev__ics" type="button" data-ics="${i}" aria-label="${esc(ev.title)} zum Kalender hinzufügen">${icon('calendarPlus')}Kalender</button>
          </div>
        </div>
      </article>`;
  }).join('');

  wrap.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-ics]');
    if (!btn) return;
    const ev = list[+btn.dataset.ics];
    const blob = new Blob([icsFor(ev, c)], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = doc.createElement('a');
    a.href = url;
    a.download = `${(ev.id || 'termin').replace(/[^\w-]+/g, '-')}.ics`;
    doc.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  });

  if (list.length > LIMIT) {
    const more = $('#events-more');
    more.hidden = false;
    $('#events-more-btn').addEventListener('click', () => {
      $$('.ev.is-extra', wrap).forEach((el) => { el.hidden = false; el.classList.add('is-in'); });
      more.hidden = true;
      initTilt(wrap);
    }, { once: true });
  }
}

/* --- Tippspiel-Teaser --- */
function renderTippspiel(c) {
  const t = c.tippspiel || {};
  const sec = $('#tippspiel');
  if (!t.enabled) {
    sec.remove();
    $$('[data-requires="tippspiel"]').forEach((el) => el.remove());
    return;
  }
  sec.hidden = false;
  $('#tipp-title').innerHTML = accentTitle(t.title || 'Tippspiel');
  const text = $('#tipp-text');
  if (t.text) text.innerHTML = HBS.paragraphs(t.text); else text.remove();
  $('span', $('#tipp-btn')).textContent = t.buttonText || 'Zum Tippspiel';
  const note = $('#tipp-note');
  if (t.note) note.innerHTML = `${icon('shield')}<span>${esc(t.note)}</span>`; else note.remove();
}

/* Abschnittsnummern fortlaufend setzen (Sommer, Tippspiel und Galerie sind optional) */
function renumberSections() {
  $$('#main .eyebrow__num').forEach((el, i) => { el.textContent = String(i + 1).padStart(2, '0'); });
  $$('#nav-list a').forEach((a, i) => a.setAttribute('data-idx', String(i + 1).padStart(2, '0')));
}

/* --- Öffnungszeiten --- */
function renderHours(c) {
  const hours = Array.isArray(c.openingHours) ? c.openingHours : [];
  const idx = HBS.todayHoursIndex();
  $('#hours-list').innerHTML = hours.map((h, i) => {
    const ranges = parseRanges(h.hours);
    const closed = Array.isArray(ranges) && ranges.length === 0;
    const today = i === idx;
    return `
      <li class="hours__row${today ? ' is-today' : ''}${closed ? ' is-closed' : ''}"${today ? ' aria-current="date"' : ''}>
        <span class="hours__day">${esc(h.day)}</span>
        ${today ? '<span class="hours__today-tag">Heute</span>' : ''}
        <span class="hours__dots" aria-hidden="true"></span>
        <span class="hours__time">${esc(h.hours)}</span>
      </li>`;
  }).join('');
  const note = $('#hours-note');
  if (c.hoursNote) note.textContent = c.hoursNote; else note.remove();

  // „Heute" in der Kontaktkarte
  const th = hours[idx];
  $('#contact-today').innerHTML = th ? `${esc(th.hours)}<small>${esc(th.day)}</small>` : '';
  updateStatus();
  setInterval(updateStatus, 60 * 1000);
}

function updateStatus() {
  if (!C) return;
  const hours = C.openingHours || [];
  const st = statusText(openStatus(hours), hours);
  ['#hero-status', '#hours-status', '#nav-status'].forEach((sel) => {
    const el = $(sel);
    if (!el) return;
    if (!st) { el.hidden = true; return; }
    el.hidden = false;
    el.className = el.className.replace(/\bis-(open|soon|closed)\b/g, '').trim() + ' ' + st.cls;
    el.innerHTML = `<span>${st.html}</span>`;
  });
}

/* --- Sommer --- */
function renderSummer(c) {
  const s = c.summer || {};
  const sec = $('#sommer');
  const navItem = $('[data-requires="summer"]');
  if (!s.enabled) {
    sec.remove();
    if (navItem) navItem.remove();
    return;
  }
  sec.hidden = false;
  $('#summer-title').innerHTML = accentTitle(s.title);
  $('#summer-text').innerHTML = HBS.paragraphs(s.text);
  const img = $('#summer-img');
  if (s.image) img.src = HBS.asset(s.image); else $('.summer__media', sec).remove();
  if (s.season) {
    const p = $('#summer-season');
    $('span', p).textContent = s.season;
    p.hidden = false;
  }
}

/* --- Galerie --- */
let GALLERY = [];
function renderGallery(c) {
  GALLERY = (c.gallery || []).filter((g) => g && g.src);
  const ul = $('#gallery-list');
  if (!GALLERY.length) {
    $('#galerie').remove();
    const nav = $('a[href="#galerie"]');
    if (nav) nav.parentElement.remove();
    return;
  }
  ul.innerHTML = GALLERY.map((g, i) => `
    <li data-reveal style="--d:${(i % 3) * 0.1}s">
      <button class="gi" type="button" data-tilt data-index="${i}" aria-label="Bild vergrößern: ${esc(g.caption || 'Bild ' + (i + 1))}">
        <img src="${esc(HBS.asset(g.src))}" alt="${esc(g.caption || '')}" loading="lazy" decoding="async">
        <span class="gi__cap"><span>${esc(g.caption || '')}</span><span class="gi__zoom" aria-hidden="true">${icon('plus')}</span></span>
      </button>
    </li>`).join('');
  ul.addEventListener('click', (e) => {
    const b = e.target.closest('.gi');
    if (b) openLightbox(+b.dataset.index, b);
  });
}

/* --- Kontakt --- */
function renderContact(c) {
  const ct = c.contact || {};
  const name = (c.meta && c.meta.siteName) || '';
  $('#contact-address').innerHTML = `
    ${name ? `<span class="sr-only">${esc(name)}, </span>` : ''}
    ${ct.street ? `<span>${esc(ct.street)}</span>` : ''}
    <span>${esc([ct.zip, ct.city].filter(Boolean).join(' '))}${ct.district ? `<span class="contact__district" style="display:inline">-${esc(ct.district)}</span>` : ''}</span>`;
  const actions = [];
  if (ct.phone) actions.push(`<li><a href="${esc(HBS.telHref(ct.phone))}"><span class="contact__ico">${icon('phone')}</span><span><span class="contact__label">Anrufen</span><span class="contact__value">${esc(ct.phone)}</span></span>${icon('arrow', 'contact__arrow')}</a></li>`);
  if (ct.email) actions.push(`<li><a href="mailto:${esc(ct.email)}"><span class="contact__ico">${icon('mail')}</span><span><span class="contact__label">E-Mail</span><span class="contact__value">${esc(ct.email)}</span></span>${icon('arrow', 'contact__arrow')}</a></li>`);
  if (ct.mapsUrl) actions.push(`<li><a href="${esc(ct.mapsUrl)}" target="_blank" rel="noopener noreferrer"><span class="contact__ico">${icon('pin')}</span><span><span class="contact__label">Karte</span><span class="contact__value">In Karten-App öffnen<span class="sr-only"> (neuer Tab)</span></span></span>${icon('arrow', 'contact__arrow')}</a></li>`);
  $('#contact-actions').innerHTML = actions.join('');
  const note = $('#contact-note');
  if (ct.note) note.innerHTML = `${icon('car')}<span>${esc(ct.note)}</span>`; else note.remove();
  const maps = $('#contact-maps');
  if (ct.mapsUrl) maps.href = ct.mapsUrl; else maps.remove();

  const call = $('#nav-call');
  if (ct.phone) { call.href = HBS.telHref(ct.phone); call.setAttribute('aria-label', 'Anrufen: ' + ct.phone); }

  const soc = c.social || {};
  const socials = [['facebook', 'Facebook'], ['instagram', 'Instagram']].filter(([k]) => soc[k] && /^https?:\/\//i.test(soc[k]));
  if (socials.length) {
    const ul = $('#social-list');
    ul.innerHTML = socials.map(([k, label]) => `<li><a href="${esc(soc[k])}" target="_blank" rel="noopener noreferrer">${icon(k)}${label}<span class="sr-only"> (neuer Tab)</span></a></li>`).join('');
    ul.hidden = false;
  }
}

/* --- Footer & Rechtliches --- */
function renderFooter(c) {
  const m = c.meta || {};
  const ct = c.contact || {};
  const name = m.siteName || '';
  $('#footer-name').textContent = name;
  $('#footer-tagline').textContent = m.tagline || '';
  $('#footer-address').innerHTML = [esc(ct.street), esc([ct.zip, ct.city].filter(Boolean).join(' ') + (ct.district ? '-' + ct.district : ''))].filter(Boolean).join('<br>');
  $('#footer-contact').innerHTML = [
    ct.phone ? `<a href="${esc(HBS.telHref(ct.phone))}">${esc(ct.phone)}</a>` : '',
    ct.email ? `<a href="mailto:${esc(ct.email)}">${esc(ct.email)}</a>` : ''
  ].filter(Boolean).join('<br>');
  let stand = '';
  if (m.lastUpdated) { const f = HBS.formatDate(m.lastUpdated); if (f.day) stand = ` · Stand: ${f.day}. ${f.monthLong} ${f.year}`; }
  $('#footer-copy').textContent = `© ${new Date().getFullYear()} ${name}${stand}`;

  const im = c.impressum || {};
  const line = (v) => (v ? esc(v) : '');
  const block = (label, html) => (html ? `<h3>${label}</h3><p>${html}</p>` : '');
  $('#impressum-body').innerHTML =
    block('Angaben gemäß § 5 DDG', [line(im.businessName), line(im.owner), line(im.street), line(im.zipCity)].filter(Boolean).join('<br>')) +
    block('Kontakt', [im.phone ? `Telefon: <a href="${esc(HBS.telHref(im.phone))}">${esc(im.phone)}</a>` : '', im.email ? `E-Mail: <a href="mailto:${esc(im.email)}">${esc(im.email)}</a>` : ''].filter(Boolean).join('<br>')) +
    block('Umsatzsteuer-ID', line(im.vatId)) +
    block('Verantwortlich für den Inhalt', line(im.responsible)) +
    (im.extraText ? `<h3>Hinweise</h3>${HBS.paragraphs(im.extraText)}` : '');
  $('#datenschutz-body').innerHTML = HBS.paragraphs((c.datenschutz && c.datenschutz.text) || '');
}

/* ----------------------------------------------------------- Navigation */
function initNav() {
  const header = $('#site-header');
  const toggle = $('#nav-toggle');
  const menu = $('#nav-menu');
  const label = $('#nav-toggle-label');
  $$('#nav-list a').forEach((a, i) => a.setAttribute('data-idx', String(i + 1).padStart(2, '0')));

  const setOpen = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    label.textContent = open ? 'Menü schließen' : 'Menü öffnen';
    menu.classList.toggle('is-open', open);
    doc.body.classList.toggle('is-locked', open);
    header.classList.toggle('is-menu-open', open);
    if (open) { const first = $('a', menu); if (first) setTimeout(() => first.focus({ preventScroll: true }), 50); }
  };
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
  doc.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.classList.contains('is-open')) { setOpen(false); toggle.focus(); }
  });
  // Fokus im offenen Mobilmenü halten
  menu.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' || !menu.classList.contains('is-open')) return;
    const f = [...$$('a, button', menu), toggle].filter((x) => x.offsetParent !== null);
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  window.matchMedia('(min-width: 1021px)').addEventListener('change', (e) => { if (e.matches) setOpen(false); });

  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 24);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // Aktiven Abschnitt markieren
  const links = $$('#nav-list a[href^="#"]');
  const map =new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      links.forEach((l) => l.removeAttribute('aria-current'));
      const a = map.get(en.target.id);
      if (a) a.setAttribute('aria-current', 'true');
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  map.forEach((_, id) => { const s = doc.getElementById(id); if (s) io.observe(s); });
}

/* ------------------------------------------------------------- Dialoge */
let lastOpener = null;
function openDialog(dlg, opener) {
  if (!dlg || dlg.open) return;
  lastOpener = opener || doc.activeElement;
  if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  doc.body.classList.add('is-locked');
}
function initDialogs() {
  $$('dialog').forEach((dlg) => {
    dlg.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) { dlg.close(); return; }
      // Klick auf den Hintergrund schließt (nicht bei Lightbox-Inhalt)
      if (e.target === dlg) dlg.close();
    });
    dlg.addEventListener('close', () => {
      doc.body.classList.remove('is-locked');
      if (dlg.id !== 'lightbox' && /^#(impressum|datenschutz)$/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
      if (lastOpener && typeof lastOpener.focus === 'function') lastOpener.focus({ preventScroll: true });
      lastOpener = null;
    });
  });
  $$('[data-dialog]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    openDialog(doc.getElementById(a.dataset.dialog), a);
    history.replaceState(null, '', a.getAttribute('href'));
  }));
  const fromHash = { '#impressum': 'dlg-impressum', '#datenschutz': 'dlg-datenschutz' }[location.hash];
  if (fromHash) openDialog(doc.getElementById(fromHash));
}

/* ------------------------------------------------------------ Lightbox */
let lbIndex = 0;
function showLightboxImage(i, animate = true) {
  if (!GALLERY.length) return;
  lbIndex = (i + GALLERY.length) % GALLERY.length;
  const g = GALLERY[lbIndex];
  const img = $('#lightbox-img');
  const apply = () => {
    img.src = HBS.asset(g.src);
    img.alt = g.caption || '';
    $('#lightbox-caption').textContent = g.caption || '';
    $('#lightbox-count').textContent = `${String(lbIndex + 1).padStart(2, '0')} / ${String(GALLERY.length).padStart(2, '0')}`;
    img.classList.remove('is-swapping');
  };
  if (animate && !reduceMotion()) { img.classList.add('is-swapping'); setTimeout(apply, 180); } else apply();
  const multi = GALLERY.length > 1;
  $('#lightbox-prev').hidden = !multi;
  $('#lightbox-next').hidden = !multi;
}
function openLightbox(i, opener) {
  showLightboxImage(i, false);
  openDialog($('#lightbox'), opener);
}
function initLightbox() {
  const lb = $('#lightbox');
  $('#lightbox-prev').addEventListener('click', () => showLightboxImage(lbIndex - 1));
  $('#lightbox-next').addEventListener('click', () => showLightboxImage(lbIndex + 1));
  lb.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); showLightboxImage(lbIndex - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); showLightboxImage(lbIndex + 1); }
  });
  lb.addEventListener('click', (e) => { if (e.target.classList.contains('lightbox__figure') || e.target.classList.contains('lightbox__stage')) lb.close(); });
  let sx = 0, sy = 0;
  lb.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  lb.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.2) showLightboxImage(lbIndex + (dx < 0 ? 1 : -1));
  }, { passive: true });
}

/* -------------------------------------------- Reveal / Tilt / Parallax */
function initReveal() {
  const els = $$('[data-reveal]:not(.is-in)');
  if (reduceMotion() || !('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('is-in')); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  els.forEach((el) => io.observe(el));
}

function initTilt(root = doc) {
  if (reduceMotion() || !mqFine.matches) return;
  $$('[data-tilt]', root).forEach((el) => {
    if (el.dataset.tiltReady) return;
    el.dataset.tiltReady = '1';
    const max = el.classList.contains('contact__card') ? 4 : 7;
    let raf = 0;
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.classList.add('is-tilting');
        el.style.setProperty('--ry', ((x - 0.5) * 2 * max).toFixed(2) + 'deg');
        el.style.setProperty('--rx', ((0.5 - y) * 2 * max).toFixed(2) + 'deg');
        el.style.setProperty('--gx', (x * 100).toFixed(1) + '%');
        el.style.setProperty('--gy', (y * 100).toFixed(1) + '%');
      });
    });
    el.addEventListener('pointerleave', () => {
      cancelAnimationFrame(raf);
      el.classList.remove('is-tilting');
      el.style.setProperty('--rx', '0deg');
      el.style.setProperty('--ry', '0deg');
    });
  });
}

function initParallax() {
  const hero = $('#top');
  const items = $$('[data-parallax]');
  let ticking = false;
  const update = () => {
    ticking = false;
    const vh = window.innerHeight;
    const hp = Math.min(1, Math.max(0, window.scrollY / (hero.offsetHeight || vh)));
    hero.style.setProperty('--hero-p', hp.toFixed(4));
    if (reduceMotion()) return;
    items.forEach((el) => {
      const r = el.parentElement.getBoundingClientRect();
      if (r.bottom < -100 || r.top > vh + 100) return;
      const speed = parseFloat(el.dataset.parallax) || 0;
      const center = r.top + r.height / 2 - vh / 2;
      el.style.transform = `translate3d(0, ${(center * -speed).toFixed(1)}px, 0)`;
    });
  };
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();
}

/* ------------------------------------------------------------ Hero 3D */
function webglAvailable() {
  try {
    const cv = doc.createElement('canvas');
    return !!(window.WebGLRenderingContext && (cv.getContext('webgl2') || cv.getContext('webgl')));
  } catch (e) { return false; }
}
async function initHero3D(c) {
  const hero = $('#top');
  const canvas = $('#hero-canvas');
  const params = new URLSearchParams(location.search);
  if (params.has('no3d') || !webglAvailable()) { hero.classList.add('no-3d'); return; }
  try {
    const mod = await import('./hero3d.js');
    const ct = c.contact || {};
    await mod.createHero(canvas, {
      reducedMotion: reduceMotion(),
      siteName: (c.meta && c.meta.siteName) || (c.hero && c.hero.title) || '',
      district: ct.district || ct.city || '',
      backdropImage: c.hero && c.hero.image ? HBS.asset(c.hero.image) : null,
      getScroll: () => Math.min(1, Math.max(0, window.scrollY / (hero.offsetHeight || window.innerHeight))),
      onFirstFrame: () => hero.classList.add('is-3d'),
      onFail: () => { hero.classList.remove('is-3d'); hero.classList.add('no-3d'); }
    });
  } catch (err) {
    console.warn('[Hero 3D] Fallback aktiv:', err && err.message);
    hero.classList.remove('is-3d');
    hero.classList.add('no-3d');
  }
}

/* -------------------------------------------------------------- Start */
function showError() {
  const main = $('#main');
  const div = doc.createElement('div');
  div.className = 'load-error';
  div.setAttribute('role', 'alert');
  div.textContent = 'Die Inhalte konnten gerade nicht geladen werden. Bitte die Seite neu laden.';
  main.insertBefore(div, main.children[1] || null);
  $('#top').classList.add('is-in');
  $$('[data-reveal]').forEach((el) => el.classList.add('is-in'));
}

function start() {
  initNav();
  initDialogs();
  initLightbox();
  HBS.load().then((content) => {
    C = content || {};
    const steps = [setMeta, renderBanner, renderHero, renderAbout, renderEvents, renderTippspiel, renderHours, renderSummer, renderGallery, renderContact, renderFooter, renumberSections];
    steps.forEach((fn) => { try { fn(C); } catch (e) { console.error('[Render]', fn.name, e); } });
    requestAnimationFrame(() => $('#top').classList.add('is-in'));
    initReveal();
    initTilt();
    initParallax();
    initHero3D(C);
  }).catch((err) => {
    console.error('[CMS] Laden fehlgeschlagen', err);
    showError();
  });
}

if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
