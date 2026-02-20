import { HydrateClient } from "~/trpc/server";
import { Dashboard } from "~/app/_components/dashboard";

export default async function Home() {
  return (
    <HydrateClient>
      <Dashboard />
    </HydrateClient>
  );
}
