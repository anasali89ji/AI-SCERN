/**
 * DETECTAI Pipeline Runner
 * Picks up pending jobs from Supabase and executes them
 */
import { createClient } from '@supabase/supabase-js'
import { runScraper }  from './workers/scraper.js'
import { runCleaner }  from './workers/cleaner.js'
import { runUploader } from './workers/uploader.js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing SUPABASE_URL / SUPABASE_KEY env vars')
  process.exit(1)
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

const WORKERS = {
  scrape:  runScraper,
  clean:   runCleaner,
  augment: runCleaner,  // reuse cleaner for augment pass
  upload:  runUploader,
}

async function setStatus(id, status, result = null) {
  await db.from('pipeline_jobs').update({
    status,
    ...(result ? { result } : {}),
    ...(status === 'running' ? { started_at: new Date().toISOString() } : {}),
    ...((['done','failed'].includes(status)) ? { completed_at: new Date().toISOString() } : {}),
  }).eq('id', id)
}

async function runPipeline() {
  console.log('🚀 Pipeline runner started at', new Date().toISOString())

  // Get all pending jobs ordered by priority
  const { data: jobs, error } = await db
    .from('pipeline_jobs')
    .select('*')
    .eq('status', 'pending')
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) { console.error('❌ Failed to fetch jobs:', error.message); process.exit(1) }
  if (!jobs?.length) { console.log('ℹ️  No pending jobs found'); process.exit(0) }

  console.log(`📋 Found ${jobs.length} pending job(s)`)

  for (const job of jobs) {
    const worker = WORKERS[job.job_type]
    if (!worker) {
      console.warn(`⚠️  No worker for job type: ${job.job_type}`)
      await setStatus(job.id, 'failed', { error: `No worker for type: ${job.job_type}` })
      continue
    }

    console.log(`\n▶️  Running ${job.job_type} job [${job.id.slice(0,8)}]...`)
    await setStatus(job.id, 'running')

    try {
      const result = await worker(job.payload || {}, db)
      await setStatus(job.id, 'done', result || { message: 'Completed successfully' })
      console.log(`✅ ${job.job_type} job done`)
    } catch (err) {
      console.error(`❌ ${job.job_type} job failed:`, err.message)
      await setStatus(job.id, 'failed', { error: err.message })
    }
  }

  console.log('\n🏁 Pipeline run complete at', new Date().toISOString())
}

runPipeline().catch(err => {
  console.error('💥 Fatal pipeline error:', err)
  process.exit(1)
})
