#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────
//  Aiscern — Auto-set all Cloudflare Pages secrets
//  Run: node scripts/set-cf-secrets.mjs
// ─────────────────────────────────────────────────────────────

const ACCOUNT_ID  = "34400e6e147e83e95c942135f54aeba7"
const PROJECT     = "aiscern"
const API_TOKEN   = "4qbyOx4dHUdx_rcQwEtgKEwoTeZVIGLeGWsQwprh"

const SECRETS = {
  SUPABASE_SERVICE_ROLE_KEY:   "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwZ3ptcnV4YWVpa3h4YXlqbXplIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzE2MTg5MiwiZXhwIjoyMDg4NzM3ODkyfQ.GTrqe030n4s53wY2CFCjkUSe3SOec-zNaFxITmA53Ls",
  CLERK_SECRET_KEY:            "sk_live_q5OtwYSNsUTaYifrZdgNp0RatuZ1UKyDfb2pDvblg7",
  CLERK_WEBHOOK_SECRET:        "whsec_qf0DNZt2aulv9Y7RVXoOe7ayEvymg7jM",
  GEMINI_API_KEY:              "AIzaSyDCv-r8rfk18HI0qNb3WI_1tYAVFOPVImw",
  HUGGINGFACE_API_TOKEN:       "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",
  NVIDIA_API_KEY:              "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",
  NVIDIA_API_KEY_2:            "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",
  UPSTASH_REDIS_REST_TOKEN:    "gQAAAAAAARg3AAIncDJkZTEwOGI4ZmFmMjY0YTJlYjQ0NjkzZWVlOTkwMzcwM3AyNzE3MzU",
  REDIS_URL:                   "rediss://default:gQAAAAAAARg3AAIncDJkZTEwOGI4ZmFmMjY0YTJlYjQ0NjkzZWVlOTkwMzcwM3AyNzE3MzU@eager-robin-71735.upstash.io:6379",
  QSTASH_TOKEN:                "eyJVc2VySUQiOiI4YTdjMDQ5NC02Mjk1LTQ3MWItYWIwMS0yMjNiNmNjMjRjMmQiLCJQYXNzd29yZCI6ImEwODc3NzRhNDJmYzQ3NGM5NzcwMDJiZDEzYjFjM2NkIn0=",
  QSTASH_CURRENT_SIGNING_KEY:  "sig_5Pxoi4KQLUAoF4MszbdmsyjZtcC8",
  QSTASH_NEXT_SIGNING_KEY:     "sig_5b5hpjKDq5nMowcV9BRvhUPzwnfF",
  INNGEST_EVENT_KEY:           "JKXbLexSGI2eLDTKY3vIRbBlUwsjK8p_d61tAvUgaUSGcLpHizThyu6prDWR8URWiQtLZX5jkLT1A5jfVGCO9w",
  INNGEST_SIGNING_KEY:         "signkey-prod-c50d1dc8ee0955a14e69cb642114a59b617fd81ea35bfb84a081bec08065444b",
  RESEND_API_KEY:              "re_YWEYVur6_Jusg62G8UpvQuwUkyRMMeZKy",
  CLOUDFLARE_API_TOKEN:        "4qbyOx4dHUdx_rcQwEtgKEwoTeZVIGLeGWsQwprh",
}

async function setSecret(key, value) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT}`
  
  // Read current project to get existing env vars
  const getRes = await fetch(url, {
    headers: { "Authorization": `Bearer ${API_TOKEN}` }
  })
  const project = await getRes.json()
  
  if (!project.success) {
    throw new Error(`Failed to get project: ${JSON.stringify(project.errors)}`)
  }

  const existing = project.result.deployment_configs?.production?.env_vars || {}
  
  // Merge new secret
  existing[key] = { type: "secret_text", value }

  // Patch project
  const patchRes = await fetch(url, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${API_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      deployment_configs: {
        production:  { env_vars: existing },
        preview:     { env_vars: existing }
      }
    })
  })

  const result = await patchRes.json()
  if (!result.success) {
    throw new Error(JSON.stringify(result.errors))
  }
  return true
}

async function main() {
  console.log(`\n🔐 Setting ${Object.keys(SECRETS).length} secrets on Cloudflare Pages project: ${PROJECT}\n`)
  
  // Fetch current project once
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT}`
  const getRes = await fetch(url, { headers: { "Authorization": `Bearer ${API_TOKEN}` } })
  const project = await getRes.json()
  
  if (!project.success) {
    console.error("❌ Could not reach Cloudflare API:", project.errors)
    console.error("   Make sure you have internet access and run this from your local machine")
    process.exit(1)
  }

  const existing = project.result.deployment_configs?.production?.env_vars || {}
  
  // Add all secrets at once
  for (const [key, value] of Object.entries(SECRETS)) {
    existing[key] = { type: "secret_text", value }
  }

  // One single PATCH with all secrets
  const patchRes = await fetch(url, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${API_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      deployment_configs: {
        production: { env_vars: existing },
        preview:    { env_vars: existing }
      }
    })
  })

  const result = await patchRes.json()

  if (result.success) {
    console.log(`✅ All ${Object.keys(SECRETS).length} secrets set successfully!\n`)
    console.log("Next: Go to Cloudflare Pages → aiscern → Deployments → Retry\n")
  } else {
    console.error("❌ Failed:", JSON.stringify(result.errors, null, 2))
    process.exit(1)
  }
}

main()
