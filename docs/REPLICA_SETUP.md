# Read Replica Setup Guide
## Convex (profile/credits) + CockroachDB (scan history/analytics)

---

## PART 1 — COCKROACHDB READ REPLICA

### Step 1 — Create CockroachDB Serverless cluster (if not done)
1. Go to https://cockroachlabs.cloud → **Create Cluster → Serverless**
2. Region: `ap-southeast-1` (Singapore — closest to Pakistan)
3. Name: `aiscern-analytics`
4. Click **Create Cluster**

### Step 2 — Get your connection string
In CockroachDB Cloud: **Connect → Connection string**
Copy the string — looks like:
```
postgresql://aiscern:<password>@your-cluster.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full
```

### Step 3 — Run the migration
In CockroachDB Cloud console → **SQL Shell**, paste and run:

```sql
-- Run v15_cockroach_replica.sql contents here
-- (file is at: supabase/migrations/v15_cockroach_replica.sql)
```

Or via CLI:
```bash
cockroach sql --url "$COCKROACH_URL" < supabase/migrations/v15_cockroach_replica.sql
```

### Step 4 — Create read-only user
In CockroachDB Cloud SQL Shell:
```sql
CREATE USER aiscern_replica_ro WITH PASSWORD 'generate-strong-password-here';
GRANT SELECT ON DATABASE defaultdb TO aiscern_replica_ro;
GRANT SELECT ON TABLE scan_replicas TO aiscern_replica_ro;
GRANT SELECT ON TABLE platform_stats_cache TO aiscern_replica_ro;
```

### Step 5 — Add env vars to Vercel
```
COCKROACH_URL=postgresql://aiscern:<password>@your-cluster.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full
COCKROACH_REPLICA_URL=postgresql://aiscern_replica_ro:<password>@your-cluster.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full
```

---

## PART 2 — CONVEX READ REPLICA

### Step 1 — Initialize Convex project
Run from **repo root** (not frontend/):
```bash
cd /path/to/AI-SCERN
npx convex dev
```
This will:
- Open browser → log in to Convex dashboard
- Create a new project called `aiscern`
- Generate `convex/_generated/` folder automatically
- Print your `CONVEX_URL` (e.g. `https://happy-animal-123.convex.cloud`)

**Keep the terminal open** — it watches for schema changes.

### Step 2 — Deploy to production
Once dev is working:
```bash
npx convex deploy
```
This deploys schema + functions to production and prints your deploy key.

### Step 3 — Get your Deploy Key
Convex Dashboard → your project → **Settings → Deploy Keys → Generate Production Key**
Copy it — looks like: `prod:abc123...`

### Step 4 — Add env vars to Vercel
```
CONVEX_URL=https://your-project.convex.cloud
CONVEX_DEPLOY_KEY=prod:your-deploy-key-here
```

### Step 5 — Add to Next.js (client-side optional)
If you want to use Convex real-time subscriptions in React components later,
also add to Vercel:
```
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
```

---

## PART 3 — VERIFY EVERYTHING WORKS

### Test CockroachDB replica
```bash
# In your local .env.local, add both COCKROACH_URL vars, then:
cd frontend
node -e "
const postgres = require('postgres')
const sql = postgres(process.env.COCKROACH_REPLICA_URL, { ssl: 'require' })
sql\`SELECT 1 AS ping\`.then(r => { console.log('CockroachDB replica OK:', r); process.exit(0) }).catch(e => { console.error(e); process.exit(1) })
"
```

### Test Convex replica
```bash
# After npx convex dev, test a query:
npx convex run health:ping
# Should return: { ok: true, ts: <timestamp> }
```

### Test full health check via API
Once deployed, hit:
```
GET https://aiscern.com/api/admin/stats
```
The response will include replica health status.

---

## SUMMARY — All new env vars needed

| Variable | Where to get it | Required |
|---|---|---|
| `COCKROACH_URL` | CockroachDB Cloud → Connect | For analytics writes |
| `COCKROACH_REPLICA_URL` | CockroachDB Cloud → create read-only user | For replica reads |
| `CONVEX_URL` | `npx convex dev` output | For Convex reads/writes |
| `CONVEX_DEPLOY_KEY` | Convex Dashboard → Settings → Deploy Keys | For server-side mutations |
| `NEXT_PUBLIC_CONVEX_URL` | Same as CONVEX_URL | Only if using client-side Convex |

Add all of these to Vercel: **Project Settings → Environment Variables → Production**
