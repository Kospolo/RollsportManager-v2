"use client";

import type { GalleryItem, Id } from "@/lib/types";
import { GalleryCard } from "./GalleryCard";

/**
 * Responsives Medien-Raster (2 → 3 → 4 Spalten). Feste 4:3-Kacheln halten das
 * Layout ruhig, während die auth-geschützten Medien asynchron nachladen (kein
 * Springen wie bei echtem Masonry mit unbekannten Höhen). Die Liste kommt
 * bereits sortiert (neueste zuerst) aus der Facade.
 */
export function GalleryGrid({
  items,
  canWrite,
  onOpen,
  onDelete,
}: {
  items: GalleryItem[];
  canWrite: boolean;
  onOpen: (id: Id) => void;
  onDelete: (item: GalleryItem) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => (
        <GalleryCard
          key={item.id}
          item={item}
          canWrite={canWrite}
          onOpen={() => onOpen(item.id)}
          onDelete={() => onDelete(item)}
        />
      ))}
    </div>
  );
}
