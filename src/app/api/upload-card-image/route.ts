import { type NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { s3Client, BUCKET, getS3Key, getPublicUrl } from "~/server/s3";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const subfolder = (formData.get("subfolder") as string | null) ?? "study-cards/images";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Convert to WebP and compress to under 100KB
    let quality = 80;
    let webpBuffer = await sharp(buffer)
      .resize({ width: 800, height: 600, fit: "inside", withoutEnlargement: true })
      .webp({ quality })
      .toBuffer();

    // Iteratively reduce quality until under 100KB
    while (webpBuffer.length > 100 * 1024 && quality > 10) {
      quality -= 10;
      webpBuffer = await sharp(buffer)
        .resize({ width: 800, height: 600, fit: "inside", withoutEnlargement: true })
        .webp({ quality })
        .toBuffer();
    }

    // If still over 100KB, resize smaller
    if (webpBuffer.length > 100 * 1024) {
      webpBuffer = await sharp(buffer)
        .resize({ width: 400, height: 300, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 50 })
        .toBuffer();
    }

    const timestamp = Date.now();
    const safeName = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniqueName = `${timestamp}_${safeName}.webp`;
    const s3Key = getS3Key(subfolder, uniqueName);

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: s3Key,
      Body: webpBuffer,
      ContentType: "image/webp",
      ACL: "public-read",
    });

    await s3Client.send(command);

    const publicUrl = getPublicUrl(s3Key);

    return NextResponse.json({
      s3Key,
      imageUrl: publicUrl,
      originalSize: file.size,
      compressedSize: webpBuffer.length,
      subfolder,
    });
  } catch (error) {
    console.error("Card image upload error:", error);
    return NextResponse.json(
      { error: "Image upload failed" },
      { status: 500 }
    );
  }
}
