"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { Icon } from "@/components/shell/icons";
import { useToast } from "@/components/ui/Toast";
import { data, errorMessage, fullName, isForbidden, memberById } from "@/lib/data";
import { useT } from "@/lib/i18n";
import type { Id, Member, PhotoTag } from "@/lib/types";
import { galerieDict } from "../i18n";

/**
 * „Wer ist auf dem Bild" — Markieren-Sektion der Lightbox.
 *
 * MARKIEREN dürfen NUR Staff (Trainer/Vorstand/Moderator, OHNE Kassenwart);
 * `canTag` blendet das Feld für andere aus. Das ist reine Sichtbarkeit — die
 * verbindliche Grenze ist der Server (POST /photo-tags → 403), ein 403 landet
 * hier als Toast. Die Auswahl kommt AUSSCHLIESSLICH aus der bereits redigierten
 * Mitgliederliste (`members`, RLS-gescoped) — kein zweiter Weg an der Redaktion
 * vorbei. ENTFERNEN darf laut Server die markierte Person, ein Vormund ODER
 * Staff; im UI zeigen wir den Knopf für Staff und für die eigene Markierung.
 *
 * WICHTIG (Einwilligung): Die hier gezeigte Liste ist die VERWALTUNGS-Sicht
 * (GET /gallery/{itemId}/tags, RLS-gescoped). Ob ein markiertes Foto auf dem
 * PROFIL der Person erscheint, hängt zusätzlich an der Foto-Einwilligung und
 * entscheidet der Server — diese Sektion ändert daran nichts.
 */
export function PhotoTagSection({
  itemId,
  members,
  canTag,
  currentMemberId,
}: {
  itemId: Id;
  /** Redigierte (RLS-gescopte) Mitgliederliste — einzige Quelle der Auswahl. */
  members: Member[];
  /** Darf der Betrachter markieren (Staff, ohne Kassenwart)? Nur Sichtbarkeit. */
  canTag: boolean;
  /** Eigene member_id (für „eigene Markierung entfernen") — kann null sein. */
  currentMemberId: Id | null;
}) {
  const t = useT(galerieDict);
  const { showToast } = useToast();

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [tags, setTags] = useState<PhotoTag[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [savingId, setSavingId] = useState<Id | null>(null);
  const [removeTarget, setRemoveTarget] = useState<PhotoTag | null>(null);
  const [removing, setRemoving] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const rows = await data.listPhotoTags(itemId);
      setTags(rows);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [itemId]);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    data
      .listPhotoTags(itemId)
      .then((rows) => {
        if (active) {
          setTags(rows);
          setStatus("ready");
        }
      })
      .catch(() => {
        if (active) setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [itemId]);

  const taggedIds = useMemo(() => new Set(tags.map((tag) => tag.memberId)), [tags]);

  /** Noch nicht markierte, sichtbare Mitglieder, gefiltert nach der Sucheingabe. */
  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members
      .filter((m) => !taggedIds.has(m.id))
      .filter((m) => (q ? fullName(m).toLowerCase().includes(q) : true))
      .sort((a, b) => fullName(a).localeCompare(fullName(b)));
  }, [members, taggedIds, query]);

  /** Menschlicher Name einer markierten Person (Fallback, falls RLS sie verbirgt). */
  const nameOf = useCallback(
    (memberId: Id): string => {
      const m = memberById(members, memberId);
      return m ? fullName(m) : t("tagUnknownMember");
    },
    [members, t],
  );

  async function addTag(memberId: Id) {
    if (savingId) return;
    setSavingId(memberId);
    try {
      const created = await data.tagPhoto(itemId, memberId);
      setTags((prev) =>
        prev.some((tag) => tag.id === created.id) ? prev : [...prev, created],
      );
      showToast(t("tagAddedToast", { name: nameOf(memberId) }), { tone: "success" });
      setQuery("");
    } catch (error) {
      showToast(isForbidden(error) ? t("tagErrForbidden") : errorMessage(error), {
        tone: "danger",
      });
      // Server ist die Wahrheit — Liste neu ziehen, falls der Zustand abwich.
      void load();
    } finally {
      setSavingId(null);
    }
  }

  async function confirmRemove() {
    if (!removeTarget || removing) return;
    setRemoving(true);
    const target = removeTarget;
    try {
      await data.removePhotoTag(target.id);
      setTags((prev) => prev.filter((tag) => tag.id !== target.id));
      setRemoveTarget(null);
      showToast(t("tagRemovedToast"), { tone: "success" });
    } catch (error) {
      showToast(isForbidden(error) ? t("tagErrForbidden") : errorMessage(error), {
        tone: "danger",
      });
      void load();
    } finally {
      setRemoving(false);
    }
  }

  function canRemove(tag: PhotoTag): boolean {
    return canTag || (currentMemberId != null && tag.memberId === currentMemberId);
  }

  return (
    <section className="grid gap-3 border-t border-line pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="inline-flex items-center gap-2 text-[13px] font-bold text-ink">
          <Icon name="user" className="ic h-[15px] w-[15px] text-ink-faint" />
          {t("tagsTitle")}
          {status === "ready" && tags.length > 0 && (
            <span className="text-caption font-semibold text-ink-faint">({tags.length})</span>
          )}
        </h3>
        {canTag && status !== "loading" && (
          <Button
            variant="secondary"
            icon="plus"
            onClick={() => setPickerOpen((v) => !v)}
            aria-expanded={pickerOpen}
          >
            {t("tagAdd")}
          </Button>
        )}
      </div>

      {status === "loading" ? (
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-8 w-32 rounded-full" />
          <Skeleton className="h-8 w-28 rounded-full" />
        </div>
      ) : status === "error" ? (
        <p className="text-caption text-danger">{t("tagsError")}</p>
      ) : tags.length === 0 ? (
        <p className="text-caption text-ink-soft">
          {canTag ? t("tagsEmptyStaff") : t("tagsEmpty")}
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {tags.map((tag) => {
            const m = memberById(members, tag.memberId);
            const name = nameOf(tag.memberId);
            return (
              <li
                key={tag.id}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-sunken py-1 pl-1 pr-1.5"
              >
                <Avatar
                  personId={tag.memberId}
                  firstName={m?.firstName ?? name}
                  lastName={m?.lastName ?? ""}
                  avatarUrl={m?.avatarUrl}
                  size="s"
                />
                <span className="max-w-[10rem] truncate text-[13px] font-semibold text-ink">
                  {name}
                </span>
                {canRemove(tag) && (
                  <button
                    type="button"
                    onClick={() => setRemoveTarget(tag)}
                    aria-label={t("tagRemoveAria", { name })}
                    className="grid h-6 w-6 flex-none place-items-center rounded-full text-ink-faint transition-colors duration-150 hover:bg-danger-soft hover:text-danger"
                  >
                    <Icon name="close" className="ic h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canTag && pickerOpen && status === "ready" && (
        <div className="grid gap-2 rounded-lg border border-line bg-surface p-3">
          <label className="sr-only" htmlFor={`tagpick-${itemId}`}>
            {t("tagPickLabel")}
          </label>
          <div className="relative">
            <Icon
              name="search"
              className="ic pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
            />
            <input
              id={`tagpick-${itemId}`}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("tagSearchPh")}
              autoComplete="off"
              className="w-full rounded-md border border-transparent bg-sunken py-2.5 pl-9 pr-3 text-body text-ink placeholder:text-ink-faint"
            />
          </div>
          {candidates.length === 0 ? (
            <p className="px-1 py-2 text-caption text-ink-faint">
              {query.trim() ? t("tagNoMatch") : t("tagAllTagged")}
            </p>
          ) : (
            <ul className="max-h-56 overflow-y-auto">
              {candidates.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    disabled={savingId != null}
                    onClick={() => void addTag(m.id)}
                    className="flex min-h-11 w-full items-center gap-2.5 rounded-md px-2 text-left transition-colors duration-150 hover:bg-sunken disabled:opacity-60"
                  >
                    <Avatar
                      personId={m.id}
                      firstName={m.firstName}
                      lastName={m.lastName}
                      avatarUrl={m.avatarUrl}
                      size="s"
                    />
                    <span className="min-w-0 flex-1 truncate text-body font-semibold text-ink">
                      {fullName(m)}
                    </span>
                    {savingId === m.id ? (
                      <span className="text-caption text-ink-faint">{t("tagSaving")}</span>
                    ) : (
                      <Icon name="plus" className="ic h-4 w-4 flex-none text-ink-faint" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {removeTarget && (
        <Modal
          open
          onClose={removing ? () => {} : () => setRemoveTarget(null)}
          eyebrow={t("tagRemoveEyebrow")}
          title={t("tagRemoveTitle")}
          maxWidthClass="max-w-md"
          footer={
            <>
              <Button
                variant="ghost"
                onClick={() => setRemoveTarget(null)}
                disabled={removing}
              >
                {t("tagRemoveCancel")}
              </Button>
              <Button
                variant="danger"
                icon="trash"
                onClick={() => void confirmRemove()}
                disabled={removing}
              >
                {removing ? t("tagRemoving") : t("tagRemoveConfirm")}
              </Button>
            </>
          }
        >
          <p className="text-body text-ink-soft">
            {t("tagRemoveBody", { name: nameOf(removeTarget.memberId) })}
          </p>
        </Modal>
      )}
    </section>
  );
}
