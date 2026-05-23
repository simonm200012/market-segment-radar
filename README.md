# Market Segment Radar

Small MVP for exploring which market segments may be healthier for longs and which stocks may look fragile enough to study as short candidates.

## What it does

- Scores sectors and stocks with transparent heuristic factors.
- Surfaces `Potential long candidate`, `Potential short candidate`, and `Mixed / watchlist`.
- Explains the main reasons behind each score.
- Runs with zero external dependencies.

## Run it

```bash
python3 server.py
```

Then open `http://127.0.0.1:8000`.

If port `8000` is busy:

```bash
python3 server.py 8080
```

Inside the app, switch the data source selector to `Live Yahoo` to fetch current data for the built-in watchlist.

The app also includes an investments page at `http://127.0.0.1:8000/investments`.

The customer BigQuery dashboard is available at `http://127.0.0.1:8000/customers`.
It reads aggregate metrics from `adrialvallis.customers.customer_modified` through the
local `bq` CLI and keeps raw customer PII out of the browser response.

To rebuild the React dashboard after editing it:

```bash
npm install
npm run build
python3 server.py
```

## Customer dashboard cloud sync

The customer dashboard can run with local-only browser storage or shared cloud
sync. For cross-device saving, create a Supabase project with this table:

```sql
create table public.garage_states (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);
```

For a private personal demo, enable row-level security and add policies that
allow your anon key to read/write this single table, or keep the project locked
behind your own Supabase auth rules before sharing the URL publicly.

Add these GitHub repository secrets before the Pages deploy runs:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_GARAGE_SYNC_ID=simon-garage
```

Without those secrets, the dashboard still works online but saves only in the
current browser.

To connect that page to Trading 212, export these variables before starting the server:

```bash
export T212_API_KEY="your_api_key"
export T212_API_SECRET="your_api_secret"
export T212_ENV="live"   # or demo
python3 server.py
```

You can also override the full API host with `T212_BASE_URL`.

## Current data model

This version can run in two modes:

- `Sample`: bundled static data for reliable local demos
- `Live Yahoo`: request-time fetches from Yahoo Finance endpoints

The scoring model uses fields shaped like a Yahoo Finance style feed:

- price momentum
- earnings revisions
- revenue growth
- gross margin trend
- relative valuation
- short interest
- borrow fee
- news sentiment
- event risk

## Next steps

To turn this into a real trading research product, the next pieces would be:

1. Persist Yahoo snapshots locally so we can chart score changes over time.
2. Add proper backtesting and paper-trading validation.
3. Add borrow availability and earnings calendar data before trusting short ideas.
4. Let the watchlist be edited in the UI instead of being fixed in code.
5. Separate informational research output from anything that could be interpreted as personalized investment advice.
