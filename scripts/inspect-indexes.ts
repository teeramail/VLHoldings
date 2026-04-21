import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

async function main() {
  const rows = await sql`
    SELECT schemaname, tablename, indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename LIKE 'varit_%'
    ORDER BY tablename, indexname
  `;
  for (const r of rows) console.log(`${r.tablename}  |  ${r.indexname}`);

  const ext = await sql`SELECT extname FROM pg_extension WHERE extname = 'pg_trgm'`;
  console.log("\npg_trgm installed:", ext.length > 0);

  await sql.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
