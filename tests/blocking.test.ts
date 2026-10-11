import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  blockCopy,
  BlockError,
  blockUser,
  hasBlocked,
  reportHref,
  unblockUser,
  type BlockClient,
} from "../lib/chat/blocking";

const ME = "me";
const PEER = "peer";

type Result = { data?: unknown; error: unknown } | Error;
const settle = (r: Result) =>
  r instanceof Error ? Promise.reject(r) : Promise.resolve(r);

function makeClient({
  user = { id: ME } as { id: string } | null,
  select = { data: null, error: null } as Result,
  insert = { error: null } as Result,
  remove = { error: null } as Result,
} = {}) {
  const calls: Array<[string, unknown[]]> = [];
  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user }, error: null })) },
    from: (table: string) => {
      calls.push(["from", [table]]);
      return {
        select: (columns: string) => {
          calls.push(["select", [columns]]);
          const chain = {
            eq: (c: string, v: string) => {
              calls.push(["eq", [c, v]]);
              return chain;
            },
            maybeSingle: () => settle(select),
          };
          return chain;
        },
        insert: (row: unknown) => {
          calls.push(["insert", [row]]);
          return settle(insert);
        },
        delete: () => {
          calls.push(["delete", []]);
          const chain = {
            eq: (c: string, v: string) => {
              calls.push(["eq", [c, v]]);
              return chain;
            },
            then: (
              resolve: (v: unknown) => unknown,
              reject: (e: unknown) => unknown,
            ) => settle(remove).then(resolve, reject),
          };
          return chain;
        },
      };
    },
  };
  return { client: client as unknown as BlockClient, calls };
}

describe("hasBlocked", () => {
  it("checks only my own block row for this person", async () => {
    const { client, calls } = makeClient({
      select: { data: { blocked_id: PEER }, error: null },
    });
    await expect(hasBlocked(client, PEER)).resolves.toBe(true);
    expect(calls).toEqual([
      ["from", ["blocks"]],
      ["select", ["blocked_id"]],
      ["eq", ["blocker_id", ME]],
      ["eq", ["blocked_id", PEER]],
    ]);
  });

  it("is false without a row", async () => {
    await expect(hasBlocked(makeClient().client, PEER)).resolves.toBe(false);
  });

  it("maps errors", async () => {
    await expect(
      hasBlocked(makeClient({ user: null }).client, PEER),
    ).rejects.toMatchObject({
      kind: "signed-out",
    });
    await expect(
      hasBlocked(
        makeClient({ select: new TypeError("Failed to fetch") }).client,
        PEER,
      ),
    ).rejects.toMatchObject({ kind: "offline" });
  });
});

describe("blockUser / unblockUser", () => {
  it("blocks as the current user", async () => {
    const { client, calls } = makeClient();
    await blockUser(client, PEER);
    expect(calls).toContainEqual([
      "insert",
      [{ blocker_id: ME, blocked_id: PEER }],
    ]);
  });

  it("treats an existing block as success", async () => {
    await expect(
      blockUser(
        makeClient({ insert: { error: { code: "23505" } } }).client,
        PEER,
      ),
    ).resolves.toBeUndefined();
  });

  it("refuses to block oneself before calling the server", async () => {
    const { client, calls } = makeClient();
    await expect(blockUser(client, ME)).rejects.toBeInstanceOf(BlockError);
    expect(calls).toEqual([]);
  });

  it("maps failures to safe copy", async () => {
    await expect(
      blockUser(
        makeClient({ insert: { error: { code: "42501", message: "rls" } } })
          .client,
        PEER,
      ),
    ).rejects.toMatchObject({ kind: "failed", message: blockCopy.failed });
  });

  it("unblocks only my own block", async () => {
    const { client, calls } = makeClient();
    await unblockUser(client, PEER);
    expect(calls.slice(1)).toEqual([
      ["delete", []],
      ["eq", ["blocker_id", ME]],
      ["eq", ["blocked_id", PEER]],
    ]);
    await expect(
      unblockUser(
        makeClient({ remove: new TypeError("Failed to fetch") }).client,
        PEER,
      ),
    ).rejects.toMatchObject({ kind: "offline" });
  });
});

describe("reportHref", () => {
  it("links to the report route with the chat as context", () => {
    expect(reportHref("u/1", "m 1")).toBe(
      "/report/u%2F1?from=chat&match=m%201",
    );
  });
});

describe("blocks migration (static checks; not executed without a Supabase project)", () => {
  const sql = readFileSync(
    join(process.cwd(), "supabase/migrations/20261011000000_user_blocks.sql"),
    "utf8",
  ).toLowerCase();

  it("creates the blocks table with RLS enabled", () => {
    expect(sql).toContain("create table if not exists public.blocks");
    expect(sql).toContain("primary key (blocker_id, blocked_id)");
    expect(sql).toContain("check (blocker_id <> blocked_id)");
    expect(sql).toContain(
      "alter table public.blocks enable row level security",
    );
  });

  it("lets users see and manage only their own blocks", () => {
    for (const policy of [
      "blocks_select_own",
      "blocks_insert_own",
      "blocks_delete_own",
    ]) {
      expect(sql).toContain(`create policy ${policy}`);
    }
    expect(sql).not.toMatch(/blocks_\w+ on public\.blocks for update/);
    expect(sql.match(/auth\.uid\(\) = blocker_id/g)?.length).toBe(3);
  });

  it("checks blocks in both directions through a locked-down security definer function", () => {
    expect(sql).toContain("function public.is_blocked_between(a uuid, b uuid)");
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = public");
    expect(sql).toContain(
      "revoke all on function public.is_blocked_between(uuid, uuid) from public",
    );
  });

  it("refuses messages and new match requests between blocked users", () => {
    expect(sql).toMatch(
      /create policy messages_insert[\s\S]*not public\.is_blocked_between/,
    );
    expect(sql).toMatch(
      /create policy matches_insert[\s\S]*not public\.is_blocked_between/,
    );
    // The original conditions are kept.
    expect(sql).toContain("auth.uid() = sender_id");
    expect(sql).toContain("auth.uid() = user_id_a");
  });
});
