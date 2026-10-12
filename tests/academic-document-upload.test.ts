import { describe, expect, it, vi } from "vitest";
import {
  documentPath,
  DocumentUploadError,
  findExistingDocument,
  formatFileSize,
  MAX_DOCUMENT_BYTES,
  storageObjectUrl,
  uploadDocument,
  uploadErrorKindForStatus,
  uploadErrorMessages,
  validateDocument,
  type DocumentListClient,
  type UploadRequest,
} from "../lib/academic/document-upload";

const USER_ID = "8d0f6a52-1c3b-4b7e-9a51-0f2c6b1d9e11";
const file = (name: string, type: string, size = 2048) => ({
  name,
  type,
  size,
});

class FakeRequest implements UploadRequest {
  status = 0;
  upload: UploadRequest["upload"] = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  opened: [string, string] | null = null;
  headers: Record<string, string> = {};
  body: Blob | null = null;
  open(method: string, url: string) {
    this.opened = [method, url];
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }
  send(body: Blob) {
    this.body = body;
  }
  abort() {
    this.onabort?.();
  }
  progress(loaded: number, total: number, lengthComputable = true) {
    this.upload.onprogress?.({ loaded, total, lengthComputable });
  }
  finish(status: number) {
    this.status = status;
    this.onload?.();
  }
}

function startUpload(request = new FakeRequest()) {
  const onProgress = vi.fn();
  const blob = new Blob(["%PDF-1.4"], { type: "application/pdf" });
  const handle = uploadDocument({
    supabaseUrl: "https://example.supabase.co/",
    anonKey: "anon-key",
    accessToken: "user-access-token",
    path: documentPath(USER_ID, "pdf"),
    file: blob,
    contentType: "application/pdf",
    onProgress,
    createRequest: () => request,
  });
  return { request, onProgress, blob, ...handle };
}

describe("validateDocument", () => {
  it.each([
    [file("vpisnica.pdf", "application/pdf"), "application/pdf", "pdf"],
    [file("scan.PNG", "image/png"), "image/png", "png"],
    [file("photo.jpeg", "image/jpeg"), "image/jpeg", "jpg"],
    [file("photo.jpg", ""), "image/jpeg", "jpg"],
  ])("accepts %o", (input, contentType, extension) => {
    expect(validateDocument(input)).toEqual({
      ok: true,
      contentType,
      extension,
    });
  });

  it.each([
    file("notes.docx", "application/vnd.openxmlformats"),
    file("image.gif", "image/gif"),
    file("archive", ""),
    file("script.svg", "image/svg+xml"),
  ])("rejects unsupported type %o", (input) => {
    expect(validateDocument(input)).toEqual({
      ok: false,
      message: "Izberi datoteko PDF, JPG ali PNG.",
    });
  });

  it("rejects a file whose extension contradicts its type", () => {
    expect(validateDocument(file("vpisnica.pdf", "image/png"))).toMatchObject({
      ok: false,
      message: "Končnica datoteke se ne ujema z njeno vrsto.",
    });
  });

  it("rejects empty files", () => {
    expect(validateDocument(file("a.pdf", "application/pdf", 0))).toMatchObject(
      { ok: false },
    );
  });

  it("accepts exactly 10 MB and rejects anything larger", () => {
    expect(
      validateDocument(file("a.pdf", "application/pdf", MAX_DOCUMENT_BYTES)).ok,
    ).toBe(true);
    expect(
      validateDocument(
        file("a.pdf", "application/pdf", MAX_DOCUMENT_BYTES + 1),
      ),
    ).toEqual({
      ok: false,
      message: "Datoteka je prevelika (10,0 MB). Največja velikost je 10,0 MB.",
    });
  });
});

describe("formatFileSize", () => {
  it("formats kilobytes and megabytes in Slovenian notation", () => {
    expect(formatFileSize(200)).toBe("1 KB");
    expect(formatFileSize(2048)).toBe("2 KB");
    expect(formatFileSize(3.5 * 1024 * 1024)).toBe("3,5 MB");
  });
});

describe("storage paths", () => {
  it("stores the document in the owner's folder like Android", () => {
    expect(documentPath(USER_ID, "pdf")).toBe(`${USER_ID}/vpisnica.pdf`);
  });

  it("refuses ids that could escape the owner's folder", () => {
    expect(() => documentPath("../other", "pdf")).toThrow();
    expect(() => documentPath("", "pdf")).toThrow();
  });

  it("targets the private bucket's authenticated object endpoint", () => {
    const url = storageObjectUrl(
      "https://example.supabase.co/",
      `${USER_ID}/vpisnica.pdf`,
    );
    expect(url).toBe(
      `https://example.supabase.co/storage/v1/object/vpisnice/${USER_ID}/vpisnica.pdf`,
    );
    expect(url).not.toContain("/public/");
  });
});

describe("uploadDocument", () => {
  it("uploads with the user's token, anon key, content type, and upsert", async () => {
    const { request, blob, promise } = startUpload();
    request.finish(200);
    await promise;

    expect(request.opened).toEqual([
      "POST",
      `https://example.supabase.co/storage/v1/object/vpisnice/${USER_ID}/vpisnica.pdf`,
    ]);
    expect(request.headers).toEqual({
      Authorization: "Bearer user-access-token",
      apikey: "anon-key",
      "Content-Type": "application/pdf",
      "x-upsert": "true",
      "cache-control": "no-store",
    });
    expect(request.body).toBe(blob);
  });

  it("reports progress and reaches 100 only after the server confirms", async () => {
    const { request, onProgress, promise } = startUpload();
    request.progress(25, 100);
    request.progress(100, 100);
    request.progress(5, 0, false);
    expect(onProgress.mock.calls.map(([value]) => value)).toEqual([25, 99]);

    request.finish(201);
    await promise;
    expect(onProgress).toHaveBeenLastCalledWith(100);
  });

  it.each([
    [401, "permission"],
    [403, "permission"],
    [413, "too-large"],
    [500, "unknown"],
  ])("maps HTTP %i to %s", async (status, kind) => {
    const { request, promise } = startUpload();
    request.finish(status);
    await expect(promise).rejects.toMatchObject({
      kind,
      message: uploadErrorMessages[kind as keyof typeof uploadErrorMessages],
    });
  });

  it("maps network failures to the offline message", async () => {
    const { request, promise } = startUpload();
    request.onerror?.();
    await expect(promise).rejects.toMatchObject({ kind: "offline" });
  });

  it("can be cancelled", async () => {
    const { promise, abort } = startUpload();
    abort();
    await expect(promise).rejects.toBeInstanceOf(DocumentUploadError);
    await expect(promise).rejects.toMatchObject({ kind: "aborted" });
  });

  it("never puts the access token in the URL", () => {
    const { request } = startUpload();
    expect(request.opened?.[1]).not.toContain("user-access-token");
  });
});

describe("uploadErrorKindForStatus", () => {
  it("treats status 0 as offline", () => {
    expect(uploadErrorKindForStatus(0)).toBe("offline");
  });
});

describe("findExistingDocument", () => {
  function listClient(
    result: Awaited<
      ReturnType<ReturnType<DocumentListClient["storage"]["from"]>["list"]>
    >,
  ) {
    const list = vi.fn().mockResolvedValue(result);
    const from = vi.fn(() => ({ list }));
    return { client: { storage: { from } } as DocumentListClient, from, list };
  }

  it("finds the user's uploaded document by listing their own folder", async () => {
    const { client, from, list } = listClient({
      data: [
        { name: "other.txt", updated_at: null },
        { name: "vpisnica.pdf", updated_at: "2026-10-01T10:00:00Z" },
      ],
      error: null,
    });
    await expect(findExistingDocument(client, USER_ID)).resolves.toEqual({
      name: "vpisnica.pdf",
      updatedAt: "2026-10-01T10:00:00Z",
    });
    expect(from).toHaveBeenCalledWith("vpisnice");
    expect(list).toHaveBeenCalledWith(USER_ID, {
      limit: 10,
      search: "vpisnica",
    });
  });

  it("returns null when nothing was uploaded", async () => {
    const { client } = listClient({ data: [], error: null });
    await expect(findExistingDocument(client, USER_ID)).resolves.toBeNull();
  });

  it("raises a safe error when listing fails", async () => {
    const { client } = listClient({
      data: null,
      error: { message: "permission denied for bucket" },
    });
    await expect(findExistingDocument(client, USER_ID)).rejects.toMatchObject({
      kind: "unknown",
      message: uploadErrorMessages.unknown,
    });
  });
});
