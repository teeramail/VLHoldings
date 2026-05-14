import { HydrateClient } from "~/trpc/server";
import { Dashboard } from "~/app/_components/dashboard";
import { SharedFromOtherProjects } from "~/app/_components/shared-from-other-projects";

export default function DashboardPage() {
  return (
    <HydrateClient>
      <Dashboard />
      <div className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
        {/* Server-rendered section, only visible to signed-in Google users
            who have cards shared to them from other Cardx projects. */}
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <SharedFromOtherProjects />
      </div>
    </HydrateClient>
  );
}
