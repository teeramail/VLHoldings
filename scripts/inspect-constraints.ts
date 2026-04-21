import "dotenv/config";
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
async function main() {
  const rows = await sql`
    SELECT conname, conrelid::regclass AS table_name, contype
    FROM pg_constraint
    WHERE conrelid::regclass::text LIKE 'varit_%'
    ORDER BY conrelid::regclass::text, conname
  `;
  for (const r of rows) console.log(`${r.table_name} | ${r.contype} | ${r.conname}`);
  await sql.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
