import { type NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { s3Client, BUCKET, getS3Key, getPublicUrl } from "~/server/s3";

const MAX_UPLOAD_IMAGE_BYTES = 25 * 1024 * 1024;
const TARGET_COMPRESSED_BYTES = 450 * 1024;
const MIN_COMPRESSED_BYTES = 300 * 1024;
const RESIZE_STEPS = [1600, 1280, 960, 800];

function toNodeBytes(input: Uint8Array<ArrayBufferLike>): Uint8Array {
  return new Uint8Array(input);
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const subfolder = (formData.get("subfolder") as string | null) ?? "study-cards/images";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_IMAGE_BYTES) {
      return NextResponse.json({ error: "Image is too large. Maximum size is 25 MB." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    let webpBuffer: Uint8Array<ArrayBufferLike> = new Uint8Array();

    for (const width of RESIZE_STEPS) {
      let quality = 82;
      webpBuffer = toNodeBytes(
        await sharp(buffer)
          .rotate()
          .resize({ width, height: width, fit: "inside", withoutEnlargement: true })
          .webp({ quality, effort: 4 })
          .toBuffer(),
      );

      while (webpBuffer.length > TARGET_COMPRESSED_BYTES && quality > 42) {
        quality -= 8;
        webpBuffer = toNodeBytes(
          await sharp(buffer)
            .rotate()
            .resize({ width, height: width, fit: "inside", withoutEnlargement: true })
            .webp({ quality, effort: 4 })
            .toBuffer(),
        );
      }

      if (webpBuffer.length <= TARGET_COMPRESSED_BYTES || width === RESIZE_STEPS[RESIZE_STEPS.length - 1]) {
        break;
      }
    }

    if (webpBuffer.length > TARGET_COMPRESSED_BYTES) {
      webpBuffer = toNodeBytes(
        await sharp(webpBuffer)
          .webp({ quality: 40, effort: 6 })
          .toBuffer(),
      );
    }

    if (webpBuffer.length > MAX_UPLOAD_IMAGE_BYTES) {
      return NextResponse.json({ error: "Compressed image is still too large" }, { status: 400 });
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
      compressionSucceeded: webpBuffer.length <= TARGET_COMPRESSED_BYTES,
      compressionFloorReached: webpBuffer.length > MIN_COMPRESSED_BYTES,
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
