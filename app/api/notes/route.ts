import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createUserClient } from "@/lib/supabase";

const CreateNoteSchema = z.object({
  group_id: z.string().uuid({ message: "group_id must be a valid UUID" }),
  body: z.string().min(1, { message: "body must not be empty" }),
});

/**
 * GET /api/notes
 * Returns all notes the caller is allowed to see.
 * RLS enforces tenant isolation — only notes from the caller's groups are returned.
 */
export async function GET(req: NextRequest) {
  const supabase = createUserClient(req);

  const { data, error } = await supabase
    .from("notes")
    .select("id, group_id, author_id, body, created_at, updated_at");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ notes: data });
}

/**
 * POST /api/notes
 * Creates a note. The caller must belong to the target group (enforced by RLS).
 * Returns 400 on invalid input, 403 if RLS rejects the insert.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CreateNoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const supabase = createUserClient(req);

  const { data, error } = await supabase
    .from("notes")
    .insert({
      group_id: parsed.data.group_id,
      author_id: (await supabase.auth.getUser()).data.user?.id,
      body: parsed.data.body,
    })
    .select("id, group_id, author_id, body, created_at, updated_at")
    .single();

  if (error) {
    const status = error.code === "42501" ? 403 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ note: data }, { status: 201 });
}
