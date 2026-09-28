/**
 * Aiscern — Convex Schema
 *
 * Convex is used as a read replica for user profiles and notifications.
 * Data is written here by the Inngest syncProfileToConvex background job
 * whenever a profile changes (plan upgrade, credit grant, etc).
 *
 * Setup:
 *   1. npm install convex
 *   2. npx convex dev  (creates project, generates CONVEX_URL)
 *   3. npx convex deploy --cmd "npm run build"  (Vercel build step)
 *   4. Set CONVEX_URL and CONVEX_DEPLOY_KEY in Vercel env vars
 *
 * Convex docs: https://docs.convex.dev
 */

import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  // ── User profile replica ──────────────────────────────────────────────────
  // Synced from Supabase profiles table via Inngest profile/updated event.
  // Read by: profile page, dashboard credits display, admin panel.
  users: defineTable({
    // Clerk user ID (matches Supabase profiles.id)
    clerkId:          v.string(),
    email:            v.string(),
    plan:             v.string(),              // 'free' | 'pro' | 'team' | 'enterprise'
    planId:           v.optional(v.string()),
    creditsRemaining: v.number(),
    scanCount:        v.number(),
    updatedAt:        v.string(),             // ISO timestamp from Supabase
  })
    .index('by_clerk_id', ['clerkId']),

  // ── Notifications ─────────────────────────────────────────────────────────
  // Pushed here when admin grants plan/credits so user sees it in real-time.
  notifications: defineTable({
    userId:    v.string(),    // Clerk user ID
    type:      v.string(),    // 'plan_upgrade' | 'credits_added' | 'info'
    title:     v.string(),
    message:   v.string(),
    read:      v.boolean(),
    createdAt: v.string(),
  })
    .index('by_user_id',      ['userId'])
    .index('by_user_unread',  ['userId', 'read']),
})
