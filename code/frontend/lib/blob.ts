import { put } from "@vercel/blob";

// NOTE: @vercel/blob's stable API only supports access: "public" --
// resumes are reachable by anyone with the URL (which includes a random
// suffix). This is acceptable for Phase 1 but should be revisited
// (signed/short-lived URLs) before any public launch, since resumes
// contain PII.
export async function uploadResume(userId: string, file: File): Promise<string> {
  const blob = await put(`resumes/${userId}-${Date.now()}-${file.name}`, file, {
    access: "public",
  });
  return blob.url;
}
