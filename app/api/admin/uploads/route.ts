import { put } from "@vercel/blob";
import { errorResponse, owner, sameOrigin } from "@/lib/server";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const IMAGE_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export async function POST(req: Request) {
  try {
    if (!(await owner()))
      return errorResponse(Error("Owner access required"), 403);
    sameOrigin(req);
    if (!process.env.BLOB_READ_WRITE_TOKEN)
      throw Error(
        "Image storage setup required. Connect Vercel Blob, or add the image later.",
      );

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw Error("Choose an image to upload");
    if (!IMAGE_TYPES.has(file.type))
      throw Error("Use a JPG, PNG or WebP image");
    if (file.size > MAX_IMAGE_BYTES)
      throw Error("Images must be smaller than 4 MB");

    // Name the stored file from its checked type, not the uploaded file name.
    const extension = IMAGE_TYPES.get(file.type);
    const blob = await put(`recipes/${crypto.randomUUID()}.${extension}`, file, {
      access: "public",
      addRandomSuffix: false,
      contentType: file.type,
    });

    return Response.json({ url: blob.url });
  } catch (error) {
    return errorResponse(error);
  }
}
