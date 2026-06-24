# NOTES.md

## RLS Approach

I enabled Row-Level Security on the `notes` table and wrote two separate policies, one for SELECT and one for INSERT. Both check the `memberships` table to confirm that the calling user (identified by `auth.uid()` from their JWT) actually belongs to the group the note is in. The idea is that tenant isolation lives entirely in the database — even if the application code had a bug and forgot to filter by group, Postgres would still apply the policy on every query and only return what that user is allowed to see. The API route uses `createUserClient(req)` which forwards the caller's JWT with the anon key, never the service-role key, since that would skip RLS entirely.

## How I Used AI

I used Claude Code as a pair-programming tool during this take-home — not to generate the solution, but to move faster on the parts I already knew how to do. I read through the existing migration, documents route, and test harness myself first to understand the patterns before writing anything, then used Claude to help me draft the boilerplate (migration DDL, route scaffolding) so I could focus on the parts that actually matter: the RLS policy logic, the tenant isolation model, and making sure the tests genuinely proved isolation rather than just passing. When Claude suggested an approach I wasn't sure about, I pushed back or asked it to explain the tradeoff before accepting it. I also ran into a connection issue where Node.js on Windows was defaulting to IPv6 when connecting to Supabase, which kept timing out — I suspected it was a DNS/network resolution issue and used Claude to confirm the diagnosis and land on the connection pooler URL as the fix.
