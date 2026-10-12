"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  documentPath,
  DOCUMENT_ACCEPT,
  DocumentUploadError,
  findExistingDocument,
  formatFileSize,
  uploadDocument,
  uploadErrorMessages,
  validateDocument,
  type DocumentListClient,
  type ExistingDocument,
} from "../lib/academic/document-upload";
import { getSupabaseConfig } from "../lib/config";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";

type Account =
  | { status: "loading" }
  | { status: "unconfigured" }
  | { status: "signed-out" }
  | { status: "error" }
  | {
      status: "ready";
      userId: string;
      accessToken: string;
      existing: ExistingDocument;
    };

type Upload =
  | { status: "idle" }
  | { status: "uploading"; percent: number }
  | { status: "done"; fileName: string }
  | { status: "failed"; message: string };

export function AcademicDocumentUpload() {
  const config = useMemo(() => getSupabaseConfig(), []);
  const client = useMemo(
    () => (config.configured ? createSupabaseBrowserClient() : null),
    [config.configured],
  );
  const [account, setAccount] = useState<Account>({ status: "loading" });
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [upload, setUpload] = useState<Upload>({ status: "idle" });
  const abortRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!client) {
      setAccount({ status: "unconfigured" });
      return;
    }
    let active = true;
    (async () => {
      try {
        const { data } = await client.auth.getSession();
        const session = data.session;
        if (!session) {
          if (active) setAccount({ status: "signed-out" });
          return;
        }
        const existing = await findExistingDocument(
          client as unknown as DocumentListClient,
          session.user.id,
        ).catch(() => null);
        if (active) {
          setAccount({
            status: "ready",
            userId: session.user.id,
            accessToken: session.access_token,
            existing,
          });
        }
      } catch {
        if (active) setAccount({ status: "error" });
      }
    })();
    return () => {
      active = false;
      abortRef.current?.();
    };
  }, [client]);

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setUpload({ status: "idle" });
    if (!selected) {
      setFile(null);
      setFileError(null);
      return;
    }
    const validation = validateDocument(selected);
    setFile(validation.ok ? selected : null);
    setFileError(validation.ok ? null : validation.message);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (account.status !== "ready" || !file || upload.status === "uploading") {
      return;
    }
    const validation = validateDocument(file);
    if (!validation.ok) {
      setFileError(validation.message);
      return;
    }
    setUpload({ status: "uploading", percent: 0 });
    const { promise, abort } = uploadDocument({
      supabaseUrl: config.url,
      anonKey: config.anonKey,
      accessToken: account.accessToken,
      path: documentPath(account.userId, validation.extension),
      file,
      contentType: validation.contentType,
      onProgress: (percent) => setUpload({ status: "uploading", percent }),
    });
    abortRef.current = abort;
    try {
      await promise;
      setUpload({ status: "done", fileName: file.name });
      setAccount({
        ...account,
        existing: {
          name: `vpisnica.${validation.extension}`,
          updatedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      setUpload({
        status: "failed",
        message:
          error instanceof DocumentUploadError
            ? error.message
            : uploadErrorMessages.unknown,
      });
    } finally {
      abortRef.current = null;
    }
  }

  if (account.status === "loading") {
    return (
      <p className="muted" role="status">
        Nalaganje …
      </p>
    );
  }
  if (account.status === "unconfigured" || account.status === "error") {
    return (
      <p className="error-message" role="alert">
        Nalaganje dokumentov trenutno ni na voljo. Poskusi znova kasneje.
      </p>
    );
  }
  if (account.status === "signed-out") {
    return (
      <div className="upload-card">
        <p>Za nalaganje potrdila o vpisu se moraš prijaviti.</p>
        <Link className="button" href="/login">
          Prijava
        </Link>
      </div>
    );
  }

  const uploading = upload.status === "uploading";

  return (
    <form className="upload-card" onSubmit={onSubmit} noValidate>
      {account.existing && upload.status !== "done" && (
        <p className="success-message" role="status">
          Potrdilo je že naloženo in čaka na preverjanje. Novo datoteko lahko
          naložiš, da zamenjaš obstoječo.
        </p>
      )}
      <label className="upload-picker">
        <span>Izberi datoteko (PDF, JPG ali PNG, največ 10 MB)</span>
        <input
          type="file"
          name="document"
          accept={DOCUMENT_ACCEPT}
          onChange={onFileChange}
          disabled={uploading}
          aria-invalid={fileError ? true : undefined}
          aria-describedby={fileError ? "document-error" : "document-help"}
        />
      </label>
      <small className="field-hint" id="document-help">
        Dokument vidiš samo ti in skrbniki, ki preverijo tvoj status.
      </small>
      {fileError && (
        <p className="error-message" id="document-error" role="alert">
          {fileError}
        </p>
      )}
      {file && !fileError && (
        <p className="upload-file">
          {file.name} · {formatFileSize(file.size)}
        </p>
      )}
      {uploading && (
        <div
          className="progress upload-progress"
          role="progressbar"
          aria-label="Napredek nalaganja"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={upload.percent}
        >
          <span style={{ width: `${upload.percent}%` }} />
        </div>
      )}
      {upload.status === "done" && (
        <p className="success-message" role="status">
          Naloženo: {upload.fileName} ✓ Potrdilo čaka na preverjanje skrbnika.
        </p>
      )}
      {upload.status === "failed" && (
        <p className="error-message" role="alert">
          {upload.message}
        </p>
      )}
      <div className="upload-actions">
        {uploading ? (
          <button
            className="button button-outline"
            type="button"
            onClick={() => abortRef.current?.()}
          >
            Prekliči ({upload.percent} %)
          </button>
        ) : (
          <button
            className="button"
            type="submit"
            disabled={!file || Boolean(fileError)}
          >
            {upload.status === "failed"
              ? "Poskusi znova"
              : "Pošlji v preverjanje"}
          </button>
        )}
        <Link className="text-link" href="/profile">
          {upload.status === "done" ? "Nadaljuj" : "Preskoči za zdaj"}
        </Link>
      </div>
    </form>
  );
}
