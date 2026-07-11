import { data } from "@/lib/data";

/**
 * Client-seitiger Suche-Aggregator der Topbar. KEIN eigener Endpoint — er
 * fächert über die BESTEHENDEN, bereits rollen-gescopten Facade-Reads
 * (getMembers/getEvents/getRoutines/listNews) und filtert im Browser. Die RLS
 * scoped die Treffermenge automatisch: ein einfaches Mitglied durchsucht nur,
 * was es ohnehin sehen darf.
 *
 * Umlaut-tolerant (ä≈ae≈a) und case-insensitiv, damit „Grunewald" auch
 * „Grünewald" findet. Beide Sprachen: die Labels stammen aus den Daten selbst.
 */

export type SearchResultKind = "member" | "event" | "routine" | "news";

export interface SearchResult {
  kind: SearchResultKind;
  id: string;
  /** Primäres Label (z. B. „Sandra Vogel"). */
  title: string;
  /** Sekundäre Zeile (Rolle, Ort, Kategorie …). */
  subtitle?: string;
  /** Zielroute für die Navigation beim Klick. */
  href: string;
}

export interface SearchResults {
  query: string;
  results: SearchResult[];
  byKind: Record<SearchResultKind, SearchResult[]>;
}

const EMPTY_BY_KIND = (): Record<SearchResultKind, SearchResult[]> => ({
  member: [],
  event: [],
  routine: [],
  news: [],
});

/** Diakritika falten + kleinschreiben, damit ä/ae/a gleich matchen. */
function fold(value: string): string {
  return value
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const matches = (needle: string, ...haystacks: (string | undefined)[]): boolean =>
  haystacks.some((h) => h && fold(h).includes(needle));

/**
 * Durchsucht Mitglieder, Termine, Küren und Neuigkeiten parallel.
 * @param query  freier Suchtext (≥ 2 sinnvolle Zeichen empfohlen)
 * @param opts.limitPerKind  Kappung je Kategorie (Default 5)
 */
export async function searchAll(
  query: string,
  opts?: { limitPerKind?: number },
): Promise<SearchResults> {
  const needle = fold(query.trim());
  const limit = opts?.limitPerKind ?? 5;
  if (needle.length === 0) {
    return { query, results: [], byKind: EMPTY_BY_KIND() };
  }

  const [members, events, routines, news] = await Promise.all([
    data.getMembers(),
    data.getEvents(),
    data.getRoutines(),
    data.listNews(),
  ]);

  const byKind = EMPTY_BY_KIND();

  for (const m of members) {
    const name = `${m.firstName} ${m.lastName}`;
    if (matches(needle, name, m.email)) {
      byKind.member.push({
        kind: "member",
        id: m.id,
        title: name,
        subtitle: m.email ?? m.role,
        href: `/mitglieder/${m.id}`,
      });
    }
  }
  for (const e of events) {
    if (matches(needle, e.title, e.location, e.note)) {
      byKind.event.push({
        kind: "event",
        id: e.id,
        title: e.title,
        subtitle: e.location || undefined,
        href: "/termine",
      });
    }
  }
  for (const r of routines) {
    if (matches(needle, r.title, r.category)) {
      byKind.routine.push({
        kind: "routine",
        id: r.id,
        title: r.title,
        subtitle: r.category || undefined,
        href: `/kueren/${r.id}`,
      });
    }
  }
  for (const n of news) {
    if (matches(needle, n.title, n.body)) {
      byKind.news.push({
        kind: "news",
        id: n.id,
        title: n.title,
        href: "/news",
      });
    }
  }

  for (const kind of Object.keys(byKind) as SearchResultKind[]) {
    byKind[kind] = byKind[kind].slice(0, limit);
  }
  const results = [...byKind.member, ...byKind.event, ...byKind.routine, ...byKind.news];
  return { query, results, byKind };
}
