import { randomBytes } from "crypto";
import { and, eq } from "drizzle-orm";

import { db } from "~/server/db";
import {
  studyCardShares,
  studyCards,
  type CardVisibility,
  type SharePermission,
} from "~/server/db/schema";

export function generateShareToken(): string {
  return randomBytes(18).toString("base64url");
}

export type CardAccess = {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  reason:
    | "owner"
    | "password-owner"
    | "public"
    | "signed_in"
    | "share-view"
    | "share-edit"
    | "denied";
};

export async function resolveCardAccess(
  card: {
    ownerUserId: string | null;
    visibility: string;
  },
  viewer: {
    userId: string | null;
    email: string | null;
    isOwner: boolean;
  },
  cardId: number,
): Promise<CardAccess> {
  const visibility = card.visibility as CardVisibility;

  // Project owner (password login) is super-owner for legacy rows
  if (viewer.isOwner) {
    return { canView: true, canEdit: true, canDelete: true, reason: "password-owner" };
  }

  if (card.ownerUserId && viewer.userId && card.ownerUserId === viewer.userId) {
    return { canView: true, canEdit: true, canDelete: true, reason: "owner" };
  }

  // Share grant?
  if (viewer.email) {
    const grant = await db
      .select({ permission: studyCardShares.permission })
      .from(studyCardShares)
      .where(
        and(
          eq(studyCardShares.cardId, cardId),
          eq(studyCardShares.email, viewer.email),
        ),
      )
      .limit(1);
    const g = grant[0];
    if (g) {
      const perm = g.permission as SharePermission;
      return {
        canView: true,
        canEdit: perm === "edit",
        canDelete: false,
        reason: perm === "edit" ? "share-edit" : "share-view",
      };
    }
  }

  if (visibility === "public") {
    return { canView: true, canEdit: false, canDelete: false, reason: "public" };
  }

  if (visibility === "signed_in" && viewer.email) {
    return { canView: true, canEdit: false, canDelete: false, reason: "signed_in" };
  }

  return { canView: false, canEdit: false, canDelete: false, reason: "denied" };
}

export async function requireCardOwnership(
  cardId: number,
  viewer: { userId: string | null; isOwner: boolean },
) {
  const [card] = await db
    .select({ id: studyCards.id, ownerUserId: studyCards.ownerUserId })
    .from(studyCards)
    .where(eq(studyCards.id, cardId))
    .limit(1);
  if (!card) return { ok: false as const, reason: "not_found" as const };
  if (viewer.isOwner) return { ok: true as const, card };
  if (card.ownerUserId && viewer.userId && card.ownerUserId === viewer.userId) {
    return { ok: true as const, card };
  }
  return { ok: false as const, reason: "forbidden" as const };
}
