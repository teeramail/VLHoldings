import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "~/env";

const s3Client = new S3Client({
  region: env.AWS_REGION,
  endpoint: env.AWS_ENDPOINT,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
  forcePathStyle: false,
});

async function testS3Bucket() {
  console.log("🔍 Testing S3 Bucket Configuration...\n");
  console.log("Configuration:");
  console.log(`  Bucket: ${env.AWS_S3_BUCKET}`);
  console.log(`  Region: ${env.AWS_REGION}`);
  console.log(`  Endpoint: ${env.AWS_ENDPOINT}`);
  console.log(`  Root Folder: ${env.AWS_S3_ROOT_FOLDER}\n`);

  try {
    // Test 1: List objects in bucket
    console.log("📋 Test 1: Listing objects in bucket...");
    const listCommand = new ListObjectsV2Command({
      Bucket: env.AWS_S3_BUCKET,
      Prefix: env.AWS_S3_ROOT_FOLDER,
      MaxKeys: 10,
    });
    const listResult = await s3Client.send(listCommand);
    console.log(`✅ Success! Found ${listResult.Contents?.length ?? 0} objects`);
    if (listResult.Contents && listResult.Contents.length > 0) {
      console.log("   First few objects:");
      listResult.Contents.slice(0, 5).forEach((obj) => {
        console.log(`   - ${obj.Key} (${obj.Size} bytes)`);
      });
    }
    console.log();

    // Test 2: Upload a test file
    console.log("📤 Test 2: Uploading test file...");
    const testKey = `${env.AWS_S3_ROOT_FOLDER}/test-${Date.now()}.txt`;
    const testContent = `Test file created at ${new Date().toISOString()}`;
    
    const putCommand = new PutObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: testKey,
      Body: testContent,
      ContentType: "text/plain",
    });
    
    await s3Client.send(putCommand);
    console.log(`✅ Success! Uploaded to: ${testKey}\n`);

    // Test 3: Generate presigned URL
    console.log("🔗 Test 3: Generating presigned URL...");
    const getCommand = new GetObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: testKey,
    });
    
    const presignedUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 });
    console.log(`✅ Success! Presigned URL generated (expires in 1 hour):`);
    console.log(`   ${presignedUrl}\n`);

    // Test 4: Download the test file
    console.log("📥 Test 4: Downloading test file...");
    const downloadResult = await s3Client.send(getCommand);
    const downloadedContent = await downloadResult.Body?.transformToString();
    console.log(`✅ Success! Downloaded content: "${downloadedContent}"\n`);

    console.log("🎉 All S3 tests passed successfully!");
    console.log("\n✨ Your S3 bucket is configured correctly and working!");
    
  } catch (error) {
    console.error("❌ S3 Test Failed:");
    if (error instanceof Error) {
      console.error(`   Error: ${error.message}`);
      console.error(`   Name: ${error.name}`);
    }
    console.error("\n🔧 Troubleshooting tips:");
    console.error("   1. Verify AWS credentials are correct");
    console.error("   2. Check bucket name and region");
    console.error("   3. Ensure bucket permissions allow read/write");
    console.error("   4. Verify endpoint URL is correct for DigitalOcean Spaces");
    process.exit(1);
  }
}

testS3Bucket();
