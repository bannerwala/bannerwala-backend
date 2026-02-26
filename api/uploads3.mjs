import fs from "fs";
import path from "path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import dotenv from 'dotenv';
dotenv.config();
// Create S3 client
const s3 = new S3Client({
  region: process.env.AWS_REGION,      // AWS region e.g., "ap-south-1"
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

/**
 * Upload a local file to S3
 * @param {String} filePath - Local path of the file
 * @param {String} bucketName - Your S3 bucket
 * @param {String} keyName - File name / key in the bucket
 */
export async function uploadFileToS3(filePath, bucketName, keyName) {
  // const fileStream = fs.createReadStream(filePath);

  const params = {
    Bucket: bucketName,
    Key: keyName,
    Body: filePath,
    ContentType: "application/octet-stream", // optional, good to set correct MIME
  };

  console.log('params: ', params);
  try {
    const command = new PutObjectCommand(params);
    const result = await s3.send(command);
    console.log("🔥 Upload successful!", result);
    return {
      bucket: bucketName,
      key: keyName
    }

  } catch (error) {
    console.error("❌ Upload failed:", error);
  }

}


export async function getSignedImageUrl(bucket, key) {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  const signedUrl = await getSignedUrl(s3, command, {
    expiresIn: 3600, // 1 hour
  });

  return signedUrl;
}