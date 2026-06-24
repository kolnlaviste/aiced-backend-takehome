import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { asUser, asOwner, pool, ALICE, BOB, CAROL, ACME, GLOBEX } from "./helpers";

// Seed one note per tenant before the suite runs.
// asOwner bypasses RLS, so these rows are committed and visible across all asUser blocks.
beforeAll(async () => {
  await asOwner(
    "insert into notes (group_id, author_id, body) values ($1, $2, $3), ($4, $5, $6)",
    [ACME, ALICE, "Acme note", GLOBEX, BOB, "Globex note"]
  );
});

afterAll(async () => {
  await asOwner("delete from notes");
  await pool.end();
});

describe("notes tenant isolation", () => {
  it("Alice (Acme only) sees only Acme notes", async () => {
    const rows = await asUser(ALICE, async (q) => {
      return (await q("select body from notes")).rows;
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].body).toBe("Acme note");
  });

  it("Bob (Globex only) sees only Globex notes", async () => {
    const rows = await asUser(BOB, async (q) => {
      return (await q("select body from notes")).rows;
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].body).toBe("Globex note");
  });

  it("Carol (both groups) sees notes from both tenants", async () => {
    const rows = await asUser(CAROL, async (q) => {
      return (await q("select body from notes order by body")).rows;
    });
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.body)).toEqual(["Acme note", "Globex note"]);
  });

  it("Alice cannot insert a note into Globex", async () => {
    await expect(
      asUser(ALICE, async (q) => {
        await q("insert into notes (group_id, author_id, body) values ($1, $2, $3)", [
          GLOBEX,
          ALICE,
          "Alice sneaking into Globex",
        ]);
      })
    ).rejects.toThrow();
  });

  it("Bob cannot insert a note into Acme", async () => {
    await expect(
      asUser(BOB, async (q) => {
        await q("insert into notes (group_id, author_id, body) values ($1, $2, $3)", [
          ACME,
          BOB,
          "Bob sneaking into Acme",
        ]);
      })
    ).rejects.toThrow();
  });
});
