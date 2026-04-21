"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { api } from "~/trpc/react";
import { getCardPermissions } from "~/config/card-settings";

export function DeleteCardButton({ cardId, cardTitle }: { cardId: number; cardTitle: string }) {
  const router = useRouter();
  const permissions = getCardPermissions(cardTitle);

  const deleteCard = api.studyCards.delete.useMutation({
    onSuccess: () => {
      router.push("/");
    },
  });

  if (!permissions.canDeleteCard) return null;

  return (
    <button
      type="button"
      disabled={deleteCard.isPending}
      onClick={() => {
        if (confirm("Are you sure you want to delete this card? This cannot be undone.")) {
          deleteCard.mutate({ id: cardId });
        }
      }}
      className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-5 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-100 disabled:opacity-50"
    >
      <Trash2 className="h-4 w-4" />
      {deleteCard.isPending ? "Deleting..." : "Delete Card"}
    </button>
  );
}
