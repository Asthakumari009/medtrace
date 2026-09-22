-- Trigger functions must not be callable as REST RPCs.
--
-- Anything in the `public` schema is exposed at /rest/v1/rpc/<name>, so both
-- trigger helpers were reachable by `anon` and `authenticated`.
-- `handle_new_user()` is SECURITY DEFINER, which means a caller would reach it
-- with the definer's privileges — the database linter flags exactly this
-- (lints 0028 and 0029).
--
-- Neither is exploitable as written: both dereference the trigger-only `new`
-- record and error out when invoked any other way. But a SECURITY DEFINER
-- function on a public endpoint is one edit away from being a real hole, and
-- the triggers themselves are unaffected: a trigger executes its function as
-- the table owner and does not consult these grants.

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
