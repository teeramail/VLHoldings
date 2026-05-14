"use client";

import { useState } from "react";
import { Trash2, X } from "lucide-react";
import { api } from "~/trpc/react";

const VISIBILITIES = ["public", "signed_in", "private"] as const;

export function ShareCardDialog({
  cardId,
  onClose,
}: {
  cardId: number;
  onClose: () => void;
}) {
  const utils = api.useUtils();
  const card = api.studyCards.getById.useQuery({ id: cardId });
  const shares = api.studyCardShares.listShares.useQuery({ cardId });

  const setVisibility = api.studyCardShares.setVisibility.useMutation({
    onSuccess: async () => {
      await card.refetch();
      await utils.studyCards.getAll.invalidate();
    },
  });
  const addShare = api.studyCardShares.addShare.useMutation({
    onSuccess: async () => {
      setEmail("");
      await shares.refetch();
    },
  });
  const removeShare = api.studyCardShares.removeShare.useMutation({
    onSuccess: async () => {
      await shares.refetch();
    },
  });

  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState<"view" | "edit">("view");

  const visibility = (card.data?.visibility ?? "private") as
    (typeof VISIBILITIES)[number];
  const shareToken = card.data?.shareToken ?? null;
  const publicUrl =
    typeof window !== "undefined" && shareToken
      ? `${window.location.origin}/api/public/cards/${shareToken}`
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Share card</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-500 hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-5">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Visibility
          </div>
          <div className="flex gap-2">
            {VISIBILITIES.map((v) => (
              <button
                key={v}
                onClick={() =>
                  setVisibility.mutate({ cardId, visibility: v })
                }
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                  visibility === v
                    ? "border-violet-500 bg-violet-50 text-violet-700"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          {visibility === "public" && publicUrl && (
            <div className="mt-2 flex items-center gap-2">
              <input
                readOnly
                value={publicUrl}
                className="flex-1 truncate rounded border border-gray-200 bg-gray-50 px-2 py-1 font-mono text-[11px] text-gray-700"
              />
              <button
                onClick={() => navigator.clipboard.writeText(publicUrl)}
                className="rounded bg-violet-600 px-2 py-1 text-xs font-semibold text-white"
              >
                Copy
              </button>
            </div>
          )}
        </div>

        <div className="mb-4">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Share with Google account
          </div>
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@gmail.com"
              className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
            <select
              value={permission}
              onChange={(e) =>
                setPermission(e.target.value as "view" | "edit")
              }
              className="rounded border border-gray-300 px-2 py-1.5 text-sm"
            >
              <option value="view">view</option>
              <option value="edit">edit</option>
            </select>
            <button
              disabled={!email || addShare.isPending}
              onClick={() =>
                addShare.mutate({ cardId, email, permission })
              }
              className="rounded bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              Add
            </button>
          </div>
          {addShare.error && (
            <div className="mt-1 text-xs text-red-600">
              {addShare.error.message}
            </div>
          )}
        </div>

        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
            People with access
          </div>
          {shares.isLoading ? (
            <div className="text-xs text-gray-500">Loading…</div>
          ) : shares.data && shares.data.length > 0 ? (
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
              {shares.data.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between px-3 py-2 text-sm"
                >
                  <span className="truncate text-gray-900">{s.email}</span>
                  <span className="mx-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-600">
                    {s.permission}
                  </span>
                  <button
                    onClick={() =>
                      removeShare.mutate({ cardId, email: s.email })
                    }
                    className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-200 p-3 text-xs text-gray-500">
              Nobody has been granted access yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
