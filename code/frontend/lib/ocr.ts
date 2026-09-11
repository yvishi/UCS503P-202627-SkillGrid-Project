// OCR.space integration -- used as a fallback when a resume PDF has no
// usable text layer (a scanned/image-only upload), since pdf-parse can
// only read text that's actually embedded in the PDF.
//
// Free-tier keys cap uploads at 1MB and are rate-limited; that's a
// real constraint on a 5MB max resume upload, so callers should treat
// `OcrError` as a normal, user-facing failure mode, not a bug.

const OCR_SPACE_ENDPOINT = "https://api.ocr.space/parse/image";

export class OcrError extends Error {}

export async function extractTextViaOcr(buffer: Buffer, filename: string): Promise<string> {
  const apiKey = process.env.OCR_SPACE_API_KEY;
  if (!apiKey) {
    throw new OcrError("OCR is not configured (missing OCR_SPACE_API_KEY).");
  }

  const form = new FormData();
  form.append("apikey", apiKey);
  form.append("filetype", "PDF");
  form.append("OCREngine", "2");
  form.append("scale", "true");
  form.append("isTable", "false");
  form.append("file", new Blob([new Uint8Array(buffer)], { type: "application/pdf" }), filename);

  let response: Response;
  try {
    response = await fetch(OCR_SPACE_ENDPOINT, { method: "POST", body: form });
  } catch (err) {
    throw new OcrError(`Could not reach the OCR service: ${(err as Error).message}`);
  }

  // OCR.space returns a useful JSON error body even on non-2xx responses
  // (e.g. 503 when a shared/rate-limited key gets throttled), so parse it
  // before falling back to a bare status-code message.
  let data: {
    error?: string;
    IsErroredOnProcessing?: boolean;
    ErrorMessage?: string | string[];
    ParsedResults?: { ParsedText?: string }[];
  };
  try {
    data = await response.json();
  } catch {
    throw new OcrError(`OCR service returned HTTP ${response.status}.`);
  }

  if (!response.ok) {
    throw new OcrError(data.error || `OCR service returned HTTP ${response.status}.`);
  }

  if (data.IsErroredOnProcessing) {
    const message = Array.isArray(data.ErrorMessage) ? data.ErrorMessage.join(" ") : data.ErrorMessage;
    throw new OcrError(message || "OCR service failed to process the file.");
  }

  const text = (data.ParsedResults ?? [])
    .map((result: { ParsedText?: string }) => result.ParsedText ?? "")
    .join("\n");

  return text;
}
