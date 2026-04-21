#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────
//  Aiscern — Connect aiscern.com domain to Cloudflare Pages
//  Run: node scripts/connect-domain.mjs
// ─────────────────────────────────────────────────────────────

const ACCOUNT_ID = "34400e6e147e83e95c942135f54aeba7"
const PROJECT    = "aiscern"
const API_TOKEN  = "4qbyOx4dHUdx_rcQwEtgKEwoTeZVIGLeGWsQwprh"
const DOMAINS    = ["aiscern.com", "www.aiscern.com"]

async function addDomain(domain) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT}/domains`
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${API_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ name: domain })
  })
  return res.json()
}

async function main() {
  console.log("\n🌐 Connecting domains to Cloudflare Pages project:", PROJECT, "\n")

  for (const domain of DOMAINS) {
    process.stdout.write(`  Adding ${domain}... `)
    const result = await addDomain(domain)
    if (result.success) {
      console.log("✅ done")
    } else {
      const msg = result.errors?.[0]?.message || JSON.stringify(result.errors)
      if (msg.includes("already")) {
        console.log("✅ already connected")
      } else {
        console.log("❌", msg)
      }
    }
  }

  console.log("\n✅ Domain setup complete!")
  console.log("   aiscern.com will go live automatically once next deployment succeeds.\n")
}

main()
