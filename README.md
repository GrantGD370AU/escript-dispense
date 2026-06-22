# eScript Dispensing System (simulation)

The pharmacist-side app. Pharmacists sign in, enter or scan the token the
patient brings from the prescriber, review the prescription, and dispense.
Pairs with the separate **Prescribing** app, sharing the same D1 database.

> SIMULATION ONLY — NOT A VALID PRESCRIPTION.

## Shared database
This app and the prescribing app both bind the SAME D1 database
(`escript-emulator`). Use the identical `database_id` in both `wrangler.toml`
files. Migrations only need to be run once against the shared database.

## Deploy (GitHub → Cloudflare)
1. Push this repo to GitHub.
2. Workers & Pages → Create → Connect to Git → pick this repo.
3. Build command: `npm install` · Deploy command: `npx wrangler deploy`.
4. Ensure `wrangler.toml` has the shared `database_id` before the build runs.

The worker name is `gu-escript-dispense`.
