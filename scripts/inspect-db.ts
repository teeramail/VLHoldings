import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

async function main() {
  console.log("\n=== drizzle.__drizzle_migrations (if exists) ===");
  try {
    const rows = await sql`SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id`;
    console.table(rows);
  } catch (e) {
    console.log("drizzle schema/table not found:", (e as Error).message);
  }

  console.log("\n=== Tables in public schema ===");
  const tables = await sql`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
  `;
  console.table(tables);

  console.log("\n=== varit_study_card columns ===");
  const cols = await sql`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'varit_study_card' ORDER BY ordinal_position
  `;
  console.table(cols);

  console.log("\n=== Row counts ===");
  for (const t of ["varit_study_card", "varit_study_card_post", "varit_study_card_item"]) {
    try {
      const r = await sql.unsafe(`SELECT COUNT(*)::int AS count FROM "${t}"`);
      console.log(`${t}: ${(r as any)[0].count}`);
    } catch (e) {
      console.log(`${t}: MISSING (${(e as Error).message.split("\n")[0]})`);
    }
  }

  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
