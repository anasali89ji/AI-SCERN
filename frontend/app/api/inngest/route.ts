/**
 * GET/POST /api/inngest
 *
 * Inngest webhook endpoint — handles event fan-out and function invocation.
 * The Inngest Vercel integration calls this endpoint to execute functions.
 *
 * Vercel integration: https://vercel.com/integrations/inngest
 * After installing the integration, INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY
 * are injected automatically into Vercel env vars.
 */

import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import { INNGEST_FUNCTIONS } from '@/lib/inngest/functions'

export const { GET, POST, PUT } = serve({
  client:    inngest,
  functions: INNGEST_FUNCTIONS,
})
