# Deployment

The app is a standard Next.js 16 server (`npm run build` then `npm start`) backed by a
SQLite file. Railway config lives in `railway.json`; deploys are triggered by Railway's
GitHub integration on every push to `main`.

## The build image needs Python (build-breaking if absent)

`nixpacks.toml` installs `python3`. Removing it breaks the build with:

```
gyp ERR! find Python  Could not find any Python installation to use
npm error path /app/node_modules/better-sqlite3
```

This looks like a native-compilation problem, but nothing is compiled. `better-sqlite3` ships
prebuilt N-API binaries in `prebuilds/` (including `linux-x64.node`), and its `binding.gyp`
resolves to `type: none` whenever a prebuild matches the host — the file's own comment says
"npm's implicit node-gyp rebuild should do nothing when the package contains a prebuild for
the host".

The catch is that npm runs `node-gyp rebuild` for *any* package shipping a `binding.gyp`, and
gyp's configure step is written in Python. Without an interpreter the install aborts before
that no-op condition is ever evaluated. Installing `python3` lets gyp run, immediately
short-circuit, and finish without building anything.

Changing the Node version does **not** fix this — the failure reproduces on Node 18, 22 and
24 alike, because the trigger is the missing interpreter, not ABI compatibility.

## Node version

Node 22 is pinned three consistent ways: `engines.node` (`>=22`, matching better-sqlite3's own
requirement), `.nvmrc`, and `NIXPACKS_NODE_VERSION` in `nixpacks.toml`. `engines` alone is only
a floor, so Nixpacks would otherwise pick the newest release; the explicit pin keeps builds
reproducible.

The bundled binaries are N-API, so they are ABI-stable across Node majors — the pin is for
reproducibility, not compatibility.

`.nvmrc` must keep LF line endings; a trailing `\r` makes the version unparseable. This is
enforced by `.gitattributes`.

## devDependencies are required at build time

`next build` needs `typescript`, `tailwindcss`, `@tailwindcss/postcss` and the `@types/*`
packages, all of which are devDependencies. Do **not** set `NPM_CONFIG_PRODUCTION=true` or
`--omit=dev` for the build step, or the build fails on missing modules.

To trim build time you may optionally set `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` — the
Playwright browser binaries are only needed for E2E runs, never in production.

## Required environment variables

The app **will not start in production** without `JWT_SECRET`, and passkey login **will fail
silently** if the relying-party settings do not match the deployed origin. Set all four:

| Variable | Value | Why |
|---|---|---|
| `JWT_SECRET` | 32+ random characters | Signs session cookies. `lib/auth.ts` throws on boot if unset when `NODE_ENV=production`. |
| `RP_ID` | Bare hostname, e.g. `myapp.up.railway.app` | WebAuthn relying-party ID. **No scheme, no port, no path.** |
| `RP_ORIGIN` | Full origin, e.g. `https://myapp.up.railway.app` | Must exactly match what the browser reports, or `verifyRegistrationResponse` rejects every attempt. |
| `DATABASE_PATH` | `/data/todos.db` | Path on the mounted volume — see below. |

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`RP_ID` and `RP_ORIGIN` must be updated whenever the domain changes. Passkeys are bound to
the RP ID, so **changing `RP_ID` invalidates every already-registered passkey** — users would
have to register again. Pick the final domain before onboarding real users.

## Persistent storage (required)

Railway containers have an ephemeral filesystem: without a volume, `todos.db` is recreated
empty on every deploy and **all users, todos and tags are lost**.

1. In the Railway service, open **Variables → Volumes → New Volume**.
2. Set the mount path to `/data`.
3. Set `DATABASE_PATH=/data/todos.db`.

Singapore public holidays seed themselves the first time the database file is created (see
`seedHolidaysIfEmpty` in `lib/db/client.ts`), so no separate seed step is needed on deploy.
To refresh them after editing `lib/singapore-holidays.ts`, run `npm run seed:holidays`
against the deployed volume.

## Single instance only

Keep `numReplicas` at 1. Two pieces of state are process-local:

- **WebAuthn challenges** (`lib/webauthn.ts`) are held in an in-memory `Map`. A second replica
  would reject any login whose challenge was issued by the other one.
- **SQLite** is a single file; concurrent writers across replicas would need a shared volume
  and would still contend on the write lock.

Scaling horizontally requires moving the challenge store to Redis and the database to
Postgres. Both are contained changes — `challengeStore` is already an interface-shaped
object, and every query lives behind the `lib/db/*` modules.

## Verifying a deploy

1. Open `/login` — should render the passkey form, not a 500.
2. Register a user; a failure here almost always means `RP_ID`/`RP_ORIGIN` mismatch.
3. Open `/calendar` and check a known holiday renders (e.g. National Day, 9 August).
4. Redeploy, then confirm your todos are still present — this is what proves the volume is
   actually mounted.
