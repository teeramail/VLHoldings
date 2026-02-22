import { HydrateClient } from "~/trpc/server";
import { Dashboard } from "~/app/_components/dashboard";

export default function DashboardPage() {
  return (
    <HydrateClient>
      <Dashboard />
    </HydrateClient>
  );
}
