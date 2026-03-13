
  # 260223 Promix Plant Inventory

  This is a code bundle for  Promix Plant Inventory. INICIADO EN FIGMA

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

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
