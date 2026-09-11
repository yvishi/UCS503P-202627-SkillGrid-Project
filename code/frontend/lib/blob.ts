import { put } from "@vercel/blob";

// Private blobs require BLOB_READ_WRITE_TOKEN server-side to read (via get()).
// Only authenticated server code can access; not reachable by URL alone.
// This is intentional since resumes contain PII and nothing needs to read
// the file yet. Future resume-parsing or profile-building jobs will use the
// token to retrieve these blobs.
export async function uploadResume(userId: string, file: File): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
  const blob = await put(`resumes/${userId}-${Date.now()}-${safeName}`, file, {
    access: "private",
  });
  return blob.url;
}
