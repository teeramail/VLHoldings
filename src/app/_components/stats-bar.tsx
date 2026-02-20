"use client";

import { BookOpen, CheckCircle, Star } from "lucide-react";
import { api } from "~/trpc/react";

export function StatsBar() {
  const { data: stats } = api.studyCards.getStats.useQuery();

  if (!stats) return null;

  return (
    <div className="flex items-center gap-4 text-sm">
      <div className="flex items-center gap-1.5 text-gray-600">
        <BookOpen className="h-4 w-4 text-violet-500" />
        <span className="font-medium">{stats.total}</span>
        <span className="hidden sm:inline">cards</span>
      </div>
      <div className="flex items-center gap-1.5 text-gray-600">
        <CheckCircle className="h-4 w-4 text-green-500" />
        <span className="font-medium">{stats.completed}</span>
        <span className="hidden sm:inline">completed</span>
      </div>
      <div className="flex items-center gap-1.5 text-gray-600">
        <Star className="h-4 w-4 text-amber-500" />
        <span className="font-medium">{stats.avgRating}</span>
        <span className="hidden sm:inline">avg rating</span>
      </div>
    </div>
  );
}
