"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import {
  dataSource,
  errorMessage,
  isNotImplemented,
  memberById,
  permissions,
} from "@/lib/data";
import { useData } from "@/lib/data/useData";
import { useT } from "@/lib/i18n";
import type { Member, News } from "@/lib/types";
import { newsDict } from "../i18n";
import { NewsCard } from "./NewsCard";
import { NewsDetailSheet } from "./NewsDetailSheet";
import { NewsFormSheet } from "./NewsFormSheet";
import { DeleteNewsDialog } from "./DeleteNewsDialog";

/** Stabiler Leer-Fallback, solange die Facade noch lädt (kein useMemo-Flackern). */
const NO_NEWS: News[] = [];

/**
 * Neuigkeiten-Screen (Schwarzes Brett): liest Nachrichten, Mitglieder und den
 * aktuellen Nutzer über die Facade. Die Facade liefert die Liste bereits
 * sortiert (gepinnt zuerst, dann nach Veröffentlichung); hier wird sie nur in
 * die Blöcke „Angepinnt“ und „Weitere“ getrennt. Trainer+ (is_club_trainer)
 * sehen Schreib-Aktionen (Verfassen/Bearbeiten/Löschen) — die Sichtbarkeit ist
 * rein kosmetisch, die Durchsetzung bleibt serverseitig (RLS); ein 403 wird in
 * den Sheets als Toast behandelt. Nach jedem Schreiben lädt der Screen neu.
 */
export function NewsScreen() {
  const t = useT(newsDict);

  const core = useData(async (repo) => {
    const [news, members, currentUser] = await Promise.all([
      repo.listNews(),
      repo.getMembers(),
      repo.getCurrentUser(),
    ]);
    return { news, members, currentUser };
  });

  const [openId, setOpenId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<News | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<News | null>(null);

  const news = core.status === "ready" ? core.data.news : NO_NEWS;
  const members: Member[] = core.status === "ready" ? core.data.members : [];
  const currentUser = core.status === "ready" ? core.data.currentUser : null;
  const canWrite = permissions(currentUser).isTrainer || dataSource === "mock";

  const { pinned, rest } = useMemo(
    () => ({
      pinned: news.filter((item) => item.isPinned),
      rest: news.filter((item) => !item.isPinned),
    }),
    [news],
  );

  const authorOf = (item: News) => memberById(members, item.authorMemberId);

  function compose() {
    setEditing(null);
    setFormOpen(true);
  }
  function startEdit(item: News) {
    setOpenId(null);
    setEditing(item);
    setFormOpen(true);
  }
  function startDelete(item: News) {
    setOpenId(null);
    setDeleteTarget(item);
  }

  const header = (
    <SectionHeader
      level={1}
      eyebrow={t("pageEyebrow")}
      title={t("pageTitle")}
      sub={t("pageSub")}
      action={
        canWrite ? (
          <Button icon="plus" disabled={core.status !== "ready"} onClick={compose}>
            {t("compose")}
          </Button>
        ) : undefined
      }
    />
  );

  if (core.status === "error") {
    return (
      <div className="grid content-start gap-6">
        {header}
        {isNotImplemented(core.error) ? (
          <EmptyState icon="sparkle" title={t("niTitle")} body={t("niBody")} />
        ) : (
          <EmptyState
            icon="zap"
            title={t("loadErrorTitle")}
            body={errorMessage(core.error)}
            action={
              <Button variant="secondary" onClick={core.reload}>
                {t("loadErrorRetry")}
              </Button>
            }
          />
        )}
      </div>
    );
  }

  if (core.status === "loading") {
    return (
      <div className="grid content-start gap-6">
        {header}
        <div className="grid gap-3">
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
          <SkeletonCard lines={2} />
        </div>
        <Skeleton className="h-6 w-40" />
      </div>
    );
  }

  const openNews = openId ? (news.find((item) => item.id === openId) ?? null) : null;

  return (
    <div className="grid content-start gap-6">
      {header}

      {news.length === 0 ? (
        <EmptyState
          icon="bell"
          title={t("emptyTitle")}
          body={canWrite ? t("emptyBodyTrainer") : t("emptyBodyMember")}
          action={
            canWrite ? (
              <Button icon="plus" onClick={compose}>
                {t("emptyCta")}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {pinned.length > 0 && (
            <NewsSection title={t("pinnedTitle")}>
              {pinned.map((item) => (
                <NewsCard
                  key={item.id}
                  news={item}
                  author={authorOf(item)}
                  canWrite={canWrite}
                  onOpen={() => setOpenId(item.id)}
                  onEdit={() => startEdit(item)}
                  onDelete={() => startDelete(item)}
                />
              ))}
            </NewsSection>
          )}

          {rest.length > 0 && (
            <NewsSection title={pinned.length > 0 ? t("moreTitle") : undefined}>
              {rest.map((item) => (
                <NewsCard
                  key={item.id}
                  news={item}
                  author={authorOf(item)}
                  canWrite={canWrite}
                  onOpen={() => setOpenId(item.id)}
                  onEdit={() => startEdit(item)}
                  onDelete={() => startDelete(item)}
                />
              ))}
            </NewsSection>
          )}
        </>
      )}

      {openNews && (
        <NewsDetailSheet
          news={openNews}
          author={authorOf(openNews)}
          canWrite={canWrite}
          onClose={() => setOpenId(null)}
          onEdit={() => startEdit(openNews)}
          onDelete={() => startDelete(openNews)}
        />
      )}

      <NewsFormSheet
        open={formOpen}
        editing={editing}
        onClose={() => setFormOpen(false)}
        onSaved={core.reload}
      />

      <DeleteNewsDialog
        news={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={core.reload}
      />
    </div>
  );
}

/** Optional betitelter Block — trennt „Angepinnt“ von „Weitere“. */
function NewsSection({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3">
      {title && (
        <h2 className="font-display text-h3 tracking-[-0.01em] text-ink">{title}</h2>
      )}
      <div className="grid gap-3">{children}</div>
    </section>
  );
}
