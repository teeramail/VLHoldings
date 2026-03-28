import { type NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3Client, BUCKET, getS3Key, getPublicUrl } from "~/server/s3";

const MAX_ATTACHMENT_SIZE_BYTES = 12 * 1024 * 1024;

// Next.js App Router body size limit config
export const maxDuration = 60; // Allow more time for large uploads

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const subfolder = (formData.get("subfolder") as string | null) ?? "study-cards/attachments";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      return NextResponse.json(
        { error: "File too large. Max allowed size is 12 MB." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniqueName = `${timestamp}_${safeName}`;
    const s3Key = getS3Key(subfolder, uniqueName);

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: s3Key,
      Body: buffer,
      ContentType: file.type || "application/octet-stream",
      ACL: "public-read",
    });

    await s3Client.send(command);

    const publicUrl = getPublicUrl(s3Key);

    return NextResponse.json({
      fileName: uniqueName,
      originalName: file.name,
      mimeType: file.type,
      fileSize: file.size,
      s3Key,
      url: publicUrl,
      subfolder,
    });
  } catch (error) {
    console.error("Attachment upload error:", error);
    return NextResponse.json(
      { error: "Attachment upload failed" },
      { status: 500 }
    );
  }
}
