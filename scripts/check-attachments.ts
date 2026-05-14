import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

async function main() {
  const rows = await sql`SELECT id, title, attachments FROM varit_study_card ORDER BY id`;
  for (const r of rows) {
    console.log("---");
    console.log("ID:", r.id, "|", r.title);
    if (r.attachments) {
      try {
        const parsed = JSON.parse(r.attachments as string);
        console.log("Attachment count:", parsed.length);
        for (const a of parsed) {
          console.log("  ->", a.originalName, "|", a.kind, "|", a.s3Key);
        }
      } catch {
        console.log("RAW (not JSON):", (r.attachments as string).substring(0, 300));
      }
    } else {
      console.log("attachments: NULL");
    }
  }
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
