import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL ?? "");

const rows = await sql`
  select id, title, attachments
  from varit_study_card
  order by id desc
  limit 20
`;

for (const row of rows) {
  let parsed: unknown[] = [];
  try {
    parsed = row.attachments ? (JSON.parse(row.attachments) as unknown[]) : [];
  } catch {
    parsed = [];
  }

  const attachmentCount = parsed.filter((item) => {
    return typeof item === "object" && item !== null && (item as { kind?: string }).kind !== "card-image";
  }).length;

  console.log({
    id: row.id,
    title: row.title,
    attachmentCount,
    totalItemsInJson: parsed.length,
  });

  const details = parsed.map((item) => {
    if (typeof item !== "object" || item === null) return item;
    const typed = item as {
      originalName?: string;
      mimeType?: string;
      kind?: string;
      s3Key?: string;
    };

    return {
      originalName: typed.originalName,
      mimeType: typed.mimeType,
      kind: typed.kind ?? "attachment",
      s3Key: typed.s3Key,
    };
  });

  console.log(details);
}

await sql.end();
