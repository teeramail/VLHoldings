"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";

const VISIBILITIES = ["public", "signed_in", "private"] as const;

export default function ProjectSettingsPage() {
  const router = useRouter();
  const { data, isLoading } = api.projectSettings.get.useQuery();
  const update = api.projectSettings.update.useMutation({
    onSuccess: () => router.refresh(),
  });

  const [allowAnonCreate, setAllowAnonCreate] = useState(false);
  const [defaultVisibility, setDefaultVisibility] = useState<
    (typeof VISIBILITIES)[number]
  >("private");
  const [emailsText, setEmailsText] = useState("");

  useEffect(() => {
    if (!data) return;
    setAllowAnonCreate(data.allowAnonCreate);
    setDefaultVisibility(
      data.defaultCardVisibility as (typeof VISIBILITIES)[number],
    );
    setEmailsText(data.allowedEmails.join("\n"));
  }, [data]);

  if (isLoading || !data) {
    return <div className="p-8 text-sm text-gray-500">Loading…</div>;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    await update.mutateAsync({
      allowAnonCreate,
      defaultCardVisibility: defaultVisibility,
      allowedEmails: emailsText
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    });
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-2 text-2xl font-bold text-gray-900">Project settings</h1>
      <p className="mb-6 text-sm text-gray-500">
        Access mode (hard cap):{" "}
        <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">
          {data.accessMode}
        </code>{" "}
        — change via the <code>PROJECT_ACCESS_MODE</code> env var.
      </p>

      <form onSubmit={handleSave} className="flex flex-col gap-6">
        <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4">
          <input
            type="checkbox"
            checked={allowAnonCreate}
            onChange={(e) => setAllowAnonCreate(e.target.checked)}
            className="mt-1"
            disabled={data.accessMode !== "anon_create"}
          />
          <div>
            <div className="text-sm font-semibold text-gray-900">
              Allow anonymous card creation
            </div>
            <div className="text-xs text-gray-500">
              Only effective when <code>PROJECT_ACCESS_MODE=anon_create</code>.
            </div>
          </div>
        </label>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-2 text-sm font-semibold text-gray-900">
            Default new-card visibility
          </div>
          <div className="flex flex-col gap-2">
            {VISIBILITIES.map((v) => (
              <label key={v} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="visibility"
                  value={v}
                  checked={defaultVisibility === v}
                  onChange={() => setDefaultVisibility(v)}
                />
                {v}
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-1 text-sm font-semibold text-gray-900">
            Allowed Google emails (optional)
          </div>
          <div className="mb-2 text-xs text-gray-500">
            One per line. Leave empty to allow any signed-in Google user.
          </div>
          <textarea
            value={emailsText}
            onChange={(e) => setEmailsText(e.target.value)}
            rows={6}
            className="w-full rounded border border-gray-300 p-2 font-mono text-xs"
            placeholder="alice@example.com&#10;bob@example.com"
          />
        </div>

        <button
          type="submit"
          disabled={update.isPending}
          className="self-start rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
        >
          {update.isPending ? "Saving…" : "Save settings"}
        </button>
      </form>
    </div>
  );
}
