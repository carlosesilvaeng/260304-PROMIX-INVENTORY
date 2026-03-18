
  # 260223 Promix Plant Inventory

  This is a code bundle for  Promix Plant Inventory. INICIADO EN FIGMA

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

  ## Initial setup

  For a fresh Supabase project, the database schema must already exist before using the app bootstrap flow.

  The app's initial setup now does this:

  1. Verifies the required schema/tables exist.
  2. Verifies no users exist yet.
  3. Creates the first `super_admin`.

  It does not create tables automatically from the UI. If the schema is missing, execute the SQL in `supabase/schema.sql` first.

  ## Edge Function deploy

  The `make-server` function must be deployed with JWT verification disabled at the gateway level.
  If it is deployed without that flag, login may still work but protected modules like Plants, Users,
  and Audit can start failing with `Invalid JWT`.

  Correct deploy command:

  `npm run deploy:make-server`

  Quick verification after deploy:

  `npm run check:make-server`

  Confirm that the deployed function shows `"verify_jwt": false`.
  <!-- trigger vercel deploy -->
