import { AVATAR_BG_CLASS, avatarInkClass, avatarTone, initials } from "@/lib/avatar";

const SIZE_CLASS = {
  s: "h-7 w-7 text-[10.5px]",
  m: "h-9 w-9 text-[12.5px]",
  l: "h-12 w-12 text-[16px]",
} as const;

/**
 * Personen-Avatar (Signatur-Komponente): runder Kreis, einer von sechs
 * warmen Tönen — deterministisch per Hash aus der personId.
 * Auf honey/moss dunkle Initialen (Jury-Fix, AA-Kontrast).
 */
export function Avatar({
  personId,
  firstName,
  lastName,
  size = "m",
}: {
  personId: string;
  firstName: string;
  lastName: string;
  size?: keyof typeof SIZE_CLASS;
}) {
  const tone = avatarTone(personId);
  return (
    <span
      className={`grid flex-none place-items-center rounded-full font-display font-extrabold tracking-wide ${AVATAR_BG_CLASS[tone]} ${avatarInkClass(tone)} ${SIZE_CLASS[size]}`}
      aria-hidden="true"
    >
      {initials(firstName, lastName)}
    </span>
  );
}
