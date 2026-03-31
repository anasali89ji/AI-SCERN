# Cold Start Prevention Setup

Vercel serverless functions cold-start after ~5 min idle. HuggingFace models cold-start after ~15 min.
These free services keep both warm 24/7.

---

## 1. GitHub Actions — HF Model Warm-up (already configured)

File: `.github/workflows/hf-warmup.yml`

Runs every 15 minutes. Pings all three primary HF models + the `/api/health` endpoint.

**Setup**: Add `HF_TOKEN` secret in GitHub repo → Settings → Secrets → Actions.

---

## 2. cron-job.org (Free — keeps Vercel warm)

Sign up at https://cron-job.org and add:

| Job Title           | URL                                      | Interval     | Method |
|---------------------|------------------------------------------|--------------|--------|
| Aiscern Health      | https://aiscern.com/api/health           | Every 5 min  | GET    |
| Aiscern Text Warm   | https://aiscern.com/api/detect/text      | Every 14 min | POST   |

For the text warmup POST, set body: `{"text":"This is a warmup ping from cron-job.org to keep the Vercel serverless function warm and responsive for users."}`

---

## 3. UptimeRobot (Free — 50 monitors, 5-min intervals)

Sign up at https://uptimerobot.com and add:

- Monitor type: HTTP(s)
- URL: `https://aiscern.com/api/health`
- Check interval: 5 minutes

This doubles as uptime monitoring — you'll get email alerts if the site goes down.

---

## 4. Supabase Keep-Alive (prevents free-tier pause after 7 days)

Add a cron-job.org job:

- URL: `https://YOUR_PROJECT.supabase.co/rest/v1/profiles?limit=1`
- Headers: `apikey: YOUR_ANON_KEY`
- Interval: Every 3 days

---

## Expected Result

With all four services active:
- Vercel API cold starts: eliminated (pinged every 5 min)
- HuggingFace cold starts: reduced 80%+ (models warmed every 15 min)
- Gemini API: no cold start (Google Cloud, always warm)
- Supabase: never pauses
