/**
 * Winziger, BEWUSST eingeschränkter Markdown-Renderer für Rechtstexte.
 *
 * ### WARUM NICHT „echtes" Markdown mit HTML ###
 * Der Text kommt aus zwei Quellen: dem eingebauten Standard (DEFAULT_LEGAL) und
 * dem, was der Betreiber im Editor eingibt. Letzteres ist vom Server nur
 * is_platform_admin-geschützt, wird aber auf einer ÖFFENTLICHEN Seite gezeigt.
 * Würde man den Text als HTML rendern (dangerouslySetInnerHTML, eine
 * Markdown→HTML-Bibliothek), wäre jedes `<script>` oder `<img onerror=…>` im
 * Betreiber-Text ein gespeicherter XSS auf der öffentlichen Domain.
 *
 * Deshalb erzeugt dieser Renderer AUSSCHLIESSLICH React-Elemente aus dem Text —
 * niemals HTML aus einem String. Jeder Buchstabe landet als React-Textknoten,
 * den React von sich aus escaped. Es gibt hier kein dangerouslySetInnerHTML,
 * und es darf auch keins dazukommen.
 *
 * ### Was verstanden wird ###
 *   ## Überschrift        → <h2>
 *   ### Unterüberschrift  → <h3>
 *   - Listenpunkt         → <li> (aufeinanderfolgende werden zu einer <ul>)
 *   • Listenpunkt         → dito (die v1-Texte nutzen den Aufzählungspunkt)
 *   Leerzeile             → Absatztrennung
 *   alles andere          → <p> (Zeilenumbrüche innerhalb bleiben erhalten)
 * URLs werden als Text gezeigt, NICHT verlinkt — ein Link wäre wieder eine
 * (kleinere) Angriffsfläche und ist für ein Impressum nicht nötig.
 */
import { Fragment, type ReactNode } from "react";

type Block =
  | { kind: "h2" | "h3" | "p"; text: string }
  | { kind: "ul"; items: string[] };

function parse(md: string): Block[] {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: string[] = [];

  const flushPara = () => {
    if (para.length) {
      blocks.push({ kind: "p", text: para.join("\n").trim() });
      para = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      blocks.push({ kind: "ul", items: list });
      list = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = /^\s*[-•]\s+(.*)$/.exec(line);
    if (bullet) {
      flushPara();
      list.push(bullet[1].trim());
      continue;
    }
    flushList();
    if (/^\s*###\s+/.test(line)) {
      flushPara();
      blocks.push({ kind: "h3", text: line.replace(/^\s*###\s+/, "").trim() });
    } else if (/^\s*##\s+/.test(line)) {
      flushPara();
      blocks.push({ kind: "h2", text: line.replace(/^\s*##\s+/, "").trim() });
    } else if (line.trim() === "") {
      flushPara();
    } else {
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return blocks;
}

/** Rendert einen Rechtstext (Markdown-Teilmenge) als sichere React-Elemente. */
export function LegalMarkdown({ text }: { text: string }): ReactNode {
  const blocks = parse(text);
  return (
    <>
      {blocks.map((block, i) => {
        if (block.kind === "h2") {
          return (
            <h2
              key={i}
              className="mt-8 font-display text-h3 tracking-[-0.01em] text-ink"
            >
              {block.text}
            </h2>
          );
        }
        if (block.kind === "h3") {
          return (
            <h3 key={i} className="mt-5 font-semibold text-ink">
              {block.text}
            </h3>
          );
        }
        if (block.kind === "ul") {
          return (
            <ul
              key={i}
              className="mt-2 grid gap-1.5 pl-5 text-body leading-[24px] text-ink-soft"
            >
              {block.items.map((item, j) => (
                <li key={j} className="list-disc">
                  {item}
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p
            key={i}
            className="mt-2 whitespace-pre-line text-body leading-[24px] text-ink-soft"
          >
            {block.text}
          </p>
        );
      })}
    </>
  );
}

export { parse as parseLegalMarkdown };
export type { Block as LegalBlock };
