import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  marker,
  signInA,
  signInB,
  skip,
  type Session,
} from "./clients";

const BUCKET = "vpisnice";

/** Academic documents: private bucket, each user limited to their own `<uid>/` folder. */
describe.skipIf(skip)("Storage (vpisnice)", () => {
  let a: Session;
  let b: Session;
  let pathB: string;
  const cleanup: Array<{ session: () => Session; path: string }> = [];

  const file = () =>
    new Blob([`integration ${marker("doc")}`], { type: "application/pdf" });

  beforeAll(async () => {
    a = await signInA();
    b = await signInB();
    pathB = `${b.userId}/${marker("b")}.pdf`;
    const upload = await b.client.storage.from(BUCKET).upload(pathB, file());
    if (upload.error) throw upload.error;
    cleanup.push({ session: () => b, path: pathB });
  });

  afterAll(async () => {
    for (const { session, path } of cleanup) {
      await session().client.storage.from(BUCKET).remove([path]);
    }
    await a?.client.auth.signOut();
    await b?.client.auth.signOut();
  });

  it("lets a user upload into their own folder", async () => {
    const path = `${a.userId}/${marker("a")}.pdf`;
    const { error } = await a.client.storage.from(BUCKET).upload(path, file());
    expect(error).toBeNull();
    cleanup.push({ session: () => a, path });
  });

  it("refuses uploads into another user's folder or the bucket root", async () => {
    for (const path of [
      `${b.userId}/${marker("forge")}.pdf`,
      `${marker("root")}.pdf`,
    ]) {
      const { error } = await a.client.storage
        .from(BUCKET)
        .upload(path, file());
      if (!error) cleanup.push({ session: () => a, path });
      expect(error, path).not.toBeNull();
    }
  });

  it("does not let another user list, download, overwrite, or delete B's document", async () => {
    const list = await a.client.storage.from(BUCKET).list(b.userId);
    expect(list.error ? [] : list.data).toEqual([]);

    const download = await a.client.storage.from(BUCKET).download(pathB);
    expect(download.error).not.toBeNull();

    const overwrite = await a.client.storage
      .from(BUCKET)
      .upload(pathB, file(), { upsert: true });
    expect(overwrite.error).not.toBeNull();

    await a.client.storage.from(BUCKET).remove([pathB]);
    const still = await b.client.storage.from(BUCKET).download(pathB);
    expect(still.error).toBeNull();
  });

  it("is not public: no anonymous download or working public URL", async () => {
    const anon = anonClient();
    const download = await anon.storage.from(BUCKET).download(pathB);
    expect(download.error).not.toBeNull();
    const { data } = anon.storage.from(BUCKET).getPublicUrl(pathB);
    const response = await fetch(data.publicUrl);
    expect(response.ok).toBe(false);
  });
});
