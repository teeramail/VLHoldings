import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "~/env";

export const s3Client = new S3Client({
  region: env.AWS_REGION,
  endpoint: env.AWS_ENDPOINT,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
  forcePathStyle: false,
});

export const BUCKET = env.AWS_S3_BUCKET;
export const ROOT_FOLDER = env.AWS_S3_ROOT_FOLDER;

export function getS3Key(folderPath: string, fileName: string): string {
  return `${ROOT_FOLDER}/${folderPath}/${fileName}`.replace(/\/+/g, "/");
}

export function getPublicUrl(key: string): string {
  return `${env.AWS_ENDPOINT}/${BUCKET}/${key}`;
}

export async function generateUploadUrl(key: string, contentType: string): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
    ACL: "public-read",
  });
  return getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

export async function deleteS3Object(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });
  await s3Client.send(command);
}

export async function listS3Folder(prefix: string): Promise<string[]> {
  const command = new ListObjectsV2Command({
    Bucket: BUCKET,
    Prefix: `${ROOT_FOLDER}/${prefix}`.replace(/\/+/g, "/"),
  });
  const response = await s3Client.send(command);
  return (response.Contents ?? []).map((item) => item.Key ?? "");
}
