"use client";

import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";
import { Icon, type IconName } from "@/components/shell/icons";

/**
 * Buttons (DESIGN-SYSTEM §3.1): Pill-Form ist Identität.
 * Genau EINE Beere-Primäraktion pro Sichtbereich — alles andere
 * secondary/ghost. `sm` nur in Tabellenzeilen und Karten-Köpfen.
 */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "md" | "sm";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  // Dark Mode: brand-contrast ist automatisch dunkler Text (Signatur-Technik)
  primary: "border-transparent bg-brand text-brand-contrast hover:bg-brand-strong",
  secondary:
    "border-transparent bg-brand-soft text-brand-ink hover:bg-brand hover:text-brand-contrast",
  ghost: "border-line-strong bg-surface text-ink hover:bg-sunken",
  // Destruktiv: canvas-Tinte ist in Light hell und in Dark dunkel — AA auf danger
  danger: "border-transparent bg-danger text-canvas hover:bg-danger/85",
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  md: "min-h-11 px-5 text-[14px]",
  sm: "min-h-9 px-3.5 text-[13px]",
};

const BASE_CLASS =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border font-bold no-underline " +
  "transition-colors duration-150 active:scale-[.98] disabled:pointer-events-none disabled:opacity-45";

function buttonClass(variant: ButtonVariant, size: ButtonSize, className: string): string {
  return `${BASE_CLASS} ${VARIANT_CLASS[variant]} ${SIZE_CLASS[size]} ${className}`.trim();
}

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Optionales Icon links vom Label (17 px, Stroke-Stil) */
  icon?: IconName;
};

export function Button({
  variant = "primary",
  size = "md",
  icon,
  className = "",
  type = "button",
  children,
  ...rest
}: CommonProps & ComponentPropsWithoutRef<"button">) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} {...rest}>
      {icon && <Icon name={icon} className="ic h-[17px] w-[17px]" />}
      {children}
    </button>
  );
}

/** Link im Button-Gewand — für Navigationen, die wie Aktionen aussehen. */
export function ButtonLink({
  variant = "primary",
  size = "md",
  icon,
  className = "",
  children,
  ...rest
}: CommonProps & ComponentPropsWithoutRef<typeof Link>) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {icon && <Icon name={icon} className="ic h-[17px] w-[17px]" />}
      {children}
    </Link>
  );
}
