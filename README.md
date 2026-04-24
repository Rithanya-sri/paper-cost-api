# Paper Cost API

This repo is a small Cloudflare Workers API backed by Cloudflare D1.

## Architecture at a Glance

- Runtime: Cloudflare Worker via Wrangler
- Entry point: `src/index.ts`
- Database: D1, exposed to the worker as `env.DB`
- Config: `wrangler.toml`
- Schema: `schema.sql`
- Follow-up schema changes: `migration.sql`, `migration2.sql`

The API is implemented as a single `fetch()` handler in `src/index.ts`. It does three main things:

1. Handles CORS and `OPTIONS` preflight requests.
2. Routes requests by path and method.
3. Runs SQL directly against D1 and returns JSON responses.

There is no separate controller, service, or repository layer yet. All routing, validation-lite behavior, SQL, and response formatting currently live in the same file.

## Route Map

### Health

- `GET /`
- `GET /api/paper-cost`

Both return a simple JSON success payload.

### Production Records

- `GET /api/production`
- `GET /api/production/:id`
- `POST /api/production`
- `PUT /api/production/:id`
- `DELETE /api/production/:id`

These routes read and write `daily_production_records`.

Important behavior:

- `POST` and `PUT` both call `calculateRecord()` before writing to the database.
- Cost and per-tube fields are derived on the server, not expected to be trusted from the client.
- `GET /api/production` returns records ordered by `date DESC`.
- `date` is unique in the schema, so creating two records with the same date will fail.

### Rates

- `GET /api/rates`
- `POST /api/rates`

These routes use `rate_master`.

Important behavior:

- `GET /api/rates` returns only the latest rate row.
- `POST /api/rates` inserts a new snapshot; it does not update the previous one in place.

## Data Model Summary

### `daily_production_records`

Stores one production/cost record per date, including:

- production and outdone counts
- raw quantities and rates for paper, paste, outer paste, packing, labour
- electricity, overheads, food, and others
- calculated totals like `paper_cost`, `paper_cost_per_tube`, and `grand_total_cost_per_tube`
- `rate_snapshot_used_that_day` to preserve whether that record should use the saved rate snapshot

### `rate_master`

Stores market-rate snapshots:

- `paper_rate`
- `paste_rate`
- `outer_paste_rate`
- `packing_rate`
- `labour_wage`
- `electricity_rate`
- `eb_amount`

## Local Development

### Prerequisites

- Node.js installed
- Dependencies installed in this repo

### Start the local server

From `paper-cost-api`:

```powershell
npm run dev -- --local --port 8788
```

Expected local URL:

```text
http://127.0.0.1:8788
```

Quick health check:

```powershell
Invoke-WebRequest -Uri 'http://127.0.0.1:8788/' -UseBasicParsing
```

## Local D1 Setup

The local API uses the D1 state under `.wrangler/state/...`.

If the server starts but some endpoints fail locally with schema errors like missing columns or missing tables, initialize the local database from the repo SQL files.

### Initialize schema

```powershell
npx wrangler d1 execute paper_cost_db --local --file=schema.sql
```

### Apply follow-up migrations if needed

```powershell
npx wrangler d1 execute paper_cost_db --local --file=migration.sql
npx wrangler d1 execute paper_cost_db --local --file=migration2.sql
```

### Important local dev note

If you apply schema changes while `wrangler dev` is already running, restart the dev server after running the D1 commands. During exploration, the worker needed a restart on a fresh port before it picked up the latest local schema cleanly.

## Known Local Warning

Wrangler currently logs that the installed local runtime supports an older compatibility date than the one requested in `wrangler.toml`.

That means local dev falls back to an older compatibility date. The API still ran locally during exploration, but upgrading Wrangler is a good follow-up task:

```powershell
npm install --save-dev wrangler@4
```

Then prefer:

```powershell
npx wrangler dev --local --port 8788
```

## How to Explore the API

Postman assets live in:

- `../Dev workspace/Postman/PaperTube API.postman_collection.json`
- `../Dev workspace/Postman/PaperTube Local.postman_environment.json`
- `../Dev workspace/Postman/curl-commands.md`
- `../Dev workspace/Postman/README.md`

## Updating the API in the Future

When routes or payloads change, update these places together:

1. `src/index.ts`
2. `schema.sql` and migration files if the database shape changed
3. `../Dev workspace/Postman/PaperTube API.postman_collection.json`
4. `../Dev workspace/Postman/PaperTube Local.postman_environment.json` if variables changed
5. `../Dev workspace/Postman/curl-commands.md`
6. This README if startup or architecture assumptions changed

## Practical Checklist for Future Changes

After changing the API:

1. Restart the local worker.
2. Re-run the affected endpoints locally.
3. Update the Postman collection examples and descriptions.
4. Update the curl reference.
5. If schema changed, add a new migration file instead of editing history silently.
