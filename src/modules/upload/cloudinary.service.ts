import crypto from "crypto";

export interface UploadSignature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  signature: string;
}

function httpError(message: string, status: number): Error {
  return Object.assign(new Error(message), { status });
}

function readEnv(): {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
} {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw httpError(
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.",
      500,
    );
  }
  return { cloudName, apiKey, apiSecret };
}

/**
 * Builds a Cloudinary upload signature for direct browser uploads. The frontend
 * posts the file to https://api.cloudinary.com/v1_1/<cloud>/auto/upload with
 * api_key, timestamp, folder, and signature in the multipart body.
 */
export function signUpload(params: {
  tenantId: string;
  projectId: string;
}): UploadSignature {
  const { cloudName, apiKey, apiSecret } = readEnv();
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `projectflow/${params.tenantId}/${params.projectId}`;

  // Cloudinary signs the alphabetically sorted, &-joined params with the api secret.
  const toSign = `folder=${folder}&timestamp=${timestamp}`;
  const signature = crypto
    .createHash("sha256")
    .update(toSign + apiSecret)
    .digest("hex");

  return {
    cloudName,
    apiKey,
    timestamp,
    folder,
    signature,
  };
}
