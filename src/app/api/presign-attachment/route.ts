import { type NextRequest, NextResponse } from "next/server";
import { getS3Key, getPublicUrl, generateUploadUrl } from "~/server/s3";

const MAX_ATTACHMENT_SIZE_BYTES = 12 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      fileName?: string;
      contentType?: string;
      fileSize?: number;
      subfolder?: string;
    };

    const { fileName, contentType, fileSize, subfolder } = body;

    if (!fileName || !contentType || !fileSize) {
      return NextResponse.json(
        { error: "Missing fileName, contentType, or fileSize" },
        { status: 400 }
      );
    }

    if (fileSize > MAX_ATTACHMENT_SIZE_BYTES) {
      return NextResponse.json(
        { error: "File too large. Max allowed size is 12 MB." },
        { status: 400 }
      );
    }

    const folder = subfolder ?? "study-cards/attachments";
    const timestamp = Date.now();
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniqueName = `${timestamp}_${safeName}`;
    const s3Key = getS3Key(folder, uniqueName);

    const uploadUrl = await generateUploadUrl(s3Key, contentType);
    const publicUrl = getPublicUrl(s3Key);

    return NextResponse.json({
      uploadUrl,
      fileName: uniqueName,
      originalName: fileName,
      mimeType: contentType,
      fileSize,
      s3Key,
      url: publicUrl,
      subfolder: folder,
    });
  } catch (error) {
    console.error("Presign attachment error:", error);
    return NextResponse.json(
      { error: "Failed to generate upload URL" },
      { status: 500 }
    );
  }
}
