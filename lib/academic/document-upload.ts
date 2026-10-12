export const ACADEMIC_BUCKET = "vpisnice";
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

/** Android accepts PDF, PNG and JPEG and stores them as `{uid}/vpisnica.{ext}`. */
export const ALLOWED_DOCUMENT_TYPES = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
} as const;

export type AllowedDocumentType = keyof typeof ALLOWED_DOCUMENT_TYPES;
export type DocumentExtension =
  (typeof ALLOWED_DOCUMENT_TYPES)[AllowedDocumentType];

export const DOCUMENT_ACCEPT =
  ".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg";

export type DocumentValidation =
  | { ok: true; contentType: AllowedDocumentType; extension: DocumentExtension }
  | { ok: false; message: string };

const EXTENSION_TYPES: Record<string, AllowedDocumentType> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

/**
 * Validates a browser file before upload. The declared MIME type must match an
 * allowed type; when the browser reports no type, the extension decides.
 */
export function validateDocument(
  file: Pick<File, "name" | "size" | "type">,
): DocumentValidation {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const declared = file.type.toLowerCase();
  const contentType = (declared || EXTENSION_TYPES[extension]) as
    AllowedDocumentType | undefined;

  if (!contentType || !(contentType in ALLOWED_DOCUMENT_TYPES)) {
    return { ok: false, message: "Izberi datoteko PDF, JPG ali PNG." };
  }
  if (
    declared &&
    EXTENSION_TYPES[extension] &&
    EXTENSION_TYPES[extension] !== declared
  ) {
    return {
      ok: false,
      message: "Končnica datoteke se ne ujema z njeno vrsto.",
    };
  }
  if (file.size === 0) {
    return { ok: false, message: "Datoteka je prazna. Izberi drugo datoteko." };
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return {
      ok: false,
      message: `Datoteka je prevelika (${formatFileSize(file.size)}). Največja velikost je ${formatFileSize(MAX_DOCUMENT_BYTES)}.`,
    };
  }
  return {
    ok: true,
    contentType,
    extension: ALLOWED_DOCUMENT_TYPES[contentType],
  };
}

/** The first folder must be the owner's id; Storage RLS relies on it. */
export function documentPath(
  userId: string,
  extension: DocumentExtension,
): string {
  if (!/^[0-9a-f-]{8,}$/i.test(userId)) throw new Error("Invalid user id");
  return `${userId}/vpisnica.${extension}`;
}

export function storageObjectUrl(supabaseUrl: string, path: string): string {
  const base = supabaseUrl.replace(/\/+$/, "");
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${base}/storage/v1/object/${ACADEMIC_BUCKET}/${encoded}`;
}

export type UploadErrorKind =
  "permission" | "too-large" | "offline" | "aborted" | "unknown";

export const uploadErrorMessages: Record<UploadErrorKind, string> = {
  permission: "Za nalaganje se moraš znova prijaviti.",
  "too-large": "Datoteka je prevelika za nalaganje.",
  offline: "Ni povezave. Preveri internet in poskusi znova.",
  aborted: "Nalaganje je bilo preklicano.",
  unknown: "Nalaganje ni uspelo. Poskusi znova.",
};

export class DocumentUploadError extends Error {
  constructor(public readonly kind: UploadErrorKind) {
    super(uploadErrorMessages[kind]);
    this.name = "DocumentUploadError";
  }
}

export function uploadErrorKindForStatus(status: number): UploadErrorKind {
  if (status === 401 || status === 403) return "permission";
  if (status === 413) return "too-large";
  if (status === 0) return "offline";
  return "unknown";
}

/** Minimal XMLHttpRequest surface, so uploads can be tested without a browser. */
export type UploadRequest = {
  open: (method: string, url: string) => void;
  setRequestHeader: (name: string, value: string) => void;
  send: (body: Blob) => void;
  abort: () => void;
  status: number;
  upload: {
    onprogress:
      | ((event: {
          loaded: number;
          total: number;
          lengthComputable: boolean;
        }) => void)
      | null;
  };
  onload: (() => void) | null;
  onerror: (() => void) | null;
  onabort: (() => void) | null;
};

export type UploadOptions = {
  supabaseUrl: string;
  anonKey: string;
  accessToken: string;
  path: string;
  file: Blob;
  contentType: AllowedDocumentType;
  onProgress: (percent: number) => void;
  createRequest?: () => UploadRequest;
};

/**
 * Uploads to the private bucket through the Storage REST API with the user's
 * own access token, reporting progress. The object is never made public.
 */
export function uploadDocument({
  supabaseUrl,
  anonKey,
  accessToken,
  path,
  file,
  contentType,
  onProgress,
  createRequest = () => new XMLHttpRequest() as unknown as UploadRequest,
}: UploadOptions): { promise: Promise<void>; abort: () => void } {
  const request = createRequest();
  const promise = new Promise<void>((resolve, reject) => {
    request.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(
          Math.min(99, Math.floor((event.loaded / event.total) * 100)),
        );
      }
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(
          new DocumentUploadError(uploadErrorKindForStatus(request.status)),
        );
      }
    };
    request.onerror = () => reject(new DocumentUploadError("offline"));
    request.onabort = () => reject(new DocumentUploadError("aborted"));

    request.open("POST", storageObjectUrl(supabaseUrl, path));
    request.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    request.setRequestHeader("apikey", anonKey);
    request.setRequestHeader("Content-Type", contentType);
    request.setRequestHeader("x-upsert", "true");
    request.setRequestHeader("cache-control", "no-store");
    request.send(file);
  });
  return { promise, abort: () => request.abort() };
}

export type ExistingDocument = {
  name: string;
  updatedAt: string | null;
} | null;

export type DocumentListClient = {
  storage: {
    from: (bucket: string) => {
      list: (
        folder: string,
        options: { limit: number; search: string },
      ) => Promise<{
        data: { name: string; updated_at?: string | null }[] | null;
        error: { message: string } | null;
      }>;
    };
  };
};

/** Looks up the user's previously uploaded document without downloading it. */
export async function findExistingDocument(
  client: DocumentListClient,
  userId: string,
): Promise<ExistingDocument> {
  const { data, error } = await client.storage
    .from(ACADEMIC_BUCKET)
    .list(userId, { limit: 10, search: "vpisnica" });
  if (error) throw new DocumentUploadError("unknown");
  const file = (data ?? []).find((item) =>
    /^vpisnica\.(pdf|png|jpg)$/.test(item.name),
  );
  return file ? { name: file.name, updatedAt: file.updated_at ?? null } : null;
}
