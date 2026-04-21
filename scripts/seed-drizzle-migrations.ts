import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

const entriesToSeed = [
  { tag: "0000_dapper_kate_bishop", when: 1770552513829 },
  { tag: "0001_heavy_roxanne_simpson", when: 1771415789617 },
  { tag: "0002_material_giant_man", when: 1774167440134 },
];

async function main() {
  await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;
  await sql`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `;

  const existing = await sql`SELECT created_at FROM drizzle.__drizzle_migrations`;
  if (existing.length > 0) {
    console.log("Already seeded:", existing.length, "rows. Skipping.");
    await sql.end();
    return;
  }

  for (const e of entriesToSeed) {
    const file = path.join("drizzle", `${e.tag}.sql`);
    const content = fs.readFileSync(file).toString();
    const hash = crypto.createHash("sha256").update(content).digest("hex");
    await sql`
      INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
      VALUES (${hash}, ${e.when})
    `;
    console.log(`Seeded ${e.tag}  hash=${hash.substring(0, 12)}...  when=${e.when}`);
  }

  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
