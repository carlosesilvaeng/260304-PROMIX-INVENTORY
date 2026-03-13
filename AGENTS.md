# Repo Notes

## make-server deploy

- Always deploy `make-server` with JWT verification disabled at the Supabase gateway.
- Do not rely only on `supabase/functions/make-server/config.toml`; production may still end up with `verify_jwt = true` unless the deploy command includes the explicit flag.
- Required command:
  `npm run deploy:make-server`
- Required verification right after deploy:
  `npm run check:make-server`
- Confirm the deployed function reports `"verify_jwt": false`.
- If `verify_jwt` is `true`, modules such as Plants, Users, and Audit can fail with `Invalid JWT` even when login appears to work.
- Avoid using `supabase functions download make-server` on top of the current working tree unless you review the diff immediately, because it can overwrite local files with an older deployed copy.
