import { Avatar } from "./Avatar";

/**
 * Avatar-Stapel (Signatur „Menschen zuerst“): überlappende Personen-Avatare
 * mit Surface-Ring, Überlauf als „+N“-Blase. Rein visuell — die Information
 * trägt der Klartext daneben (z. B. „9 Zusagen · 1 Absage · 4 offen“).
 */

export type AvatarStackPerson = {
  personId: string;
  firstName: string;
  lastName: string;
};

const MORE_SIZE_CLASS = {
  s: "h-7 w-7 text-[10.5px]",
  m: "h-9 w-9 text-[12px]",
} as const;

export function AvatarStack({
  people,
  max = 5,
  size = "s",
  label,
  className = "",
}: {
  people: AvatarStackPerson[];
  /** Max. sichtbare Avatare, Rest wird „+N“ */
  max?: number;
  size?: keyof typeof MORE_SIZE_CLASS;
  /** Optionale Bildbeschreibung; ohne Label ist der Stapel dekorativ (aria-hidden) */
  label?: string;
  className?: string;
}) {
  const visible = people.slice(0, max);
  const overflow = people.length - visible.length;

  return (
    <div
      className={`flex items-center ${className}`.trim()}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {visible.map((person) => (
        <span
          key={person.personId}
          className="-ml-2 inline-grid rounded-full ring-2 ring-surface first:ml-0"
        >
          <Avatar
            personId={person.personId}
            firstName={person.firstName}
            lastName={person.lastName}
            size={size}
          />
        </span>
      ))}
      {overflow > 0 && (
        <span
          className={`-ml-2 grid place-items-center rounded-full bg-sunken font-extrabold text-ink-soft ring-2 ring-surface ${MORE_SIZE_CLASS[size]}`}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
