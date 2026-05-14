import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    AWS_ACCESS_KEY_ID: z.string(),
    AWS_SECRET_ACCESS_KEY: z.string(),
    AWS_S3_BUCKET: z.string(),
    AWS_REGION: z.string(),
    AWS_ENDPOINT: z.string().url(),
    AWS_S3_ROOT_FOLDER: z.string().default("varit"),
    VALID_EMAIL: z.string().optional(),
    VALID_PASSWORD: z.string().optional(),
    PRESIDENT_API_KEY: z.string().optional(),
    CARDX_EXPORT_API_KEY: z.string().optional(),
    AUTH_SECRET: z.string().optional(),
    AUTH_GOOGLE_ID: z.string().optional(),
    AUTH_GOOGLE_SECRET: z.string().optional(),
    AUTH_URL: z.string().url().optional(),
    PROJECT_SLUG: z.string().default("VLHoldings"),
    PROJECT_BASE_URL: z.string().url().optional(),
    PROJECT_ACCESS_MODE: z
      .enum(["public", "signed_in", "anon_create", "closed"])
      .default("public"),
    REGISTRY_DATABASE_URL: z.string().url().optional(),
    CARDX_PUBLIC_FETCH_SECRET: z.string().optional(),
  },

  client: {},

  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_S3_BUCKET: process.env.AWS_S3_BUCKET,
    AWS_REGION: process.env.AWS_REGION,
    AWS_ENDPOINT: process.env.AWS_ENDPOINT,
    AWS_S3_ROOT_FOLDER: process.env.AWS_S3_ROOT_FOLDER,
    VALID_EMAIL: process.env.VALID_EMAIL,
    VALID_PASSWORD: process.env.VALID_PASSWORD,
    PRESIDENT_API_KEY: process.env.PRESIDENT_API_KEY,
    CARDX_EXPORT_API_KEY: process.env.CARDX_EXPORT_API_KEY,
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID,
    AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET,
    AUTH_URL: process.env.AUTH_URL,
    PROJECT_SLUG: process.env.PROJECT_SLUG,
    PROJECT_BASE_URL: process.env.PROJECT_BASE_URL,
    PROJECT_ACCESS_MODE: process.env.PROJECT_ACCESS_MODE,
    REGISTRY_DATABASE_URL: process.env.REGISTRY_DATABASE_URL,
    CARDX_PUBLIC_FETCH_SECRET: process.env.CARDX_PUBLIC_FETCH_SECRET,
  },

  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
