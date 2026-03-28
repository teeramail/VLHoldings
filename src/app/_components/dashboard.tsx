"use client";

import { Suspense } from "react";
import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { brand } from "~/config/brand";
import { StudyCards } from "./study-cards";
import { StatsBar } from "./stats-bar";

export function Dashboard() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-rose-50">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-gray-200/60 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-rose-500 shadow-lg shadow-violet-200">
                <Heart className="h-5 w-5 text-white" fill="white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{brand.name}</h1>
                <p className="text-xs text-gray-500">{brand.tagline}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <StatsBar />
              <button
                onClick={handleLogout}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
            </div>
          }
        >
          <StudyCards />
        </Suspense>
      </main>
    </div>
  );
}
