import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!);

async function main() {
  const r = await sql`UPDATE varit_study_card SET visibility = 'public' WHERE visibility = 'private'`;
  console.log("Updated", r.count, "cards to visibility=public");
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
