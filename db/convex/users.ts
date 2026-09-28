/**
 * Convex functions — users
 *
 * Called by:
 *   getProfile       ← lib/db/replicas.ts convexGetProfile()
 *   getCredits       ← lib/db/replicas.ts convexGetCredits()
 *   upsertProfile    ← Inngest syncProfileToConvex job
 */

import { v }        from 'convex/values'
import { query, mutation } from './_generated/server'

// ── Queries ───────────────────────────────────────────────────────────────────

export const getProfile = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return ctx.db
      .query('users')
      .withIndex('by_clerk_id', q => q.eq('clerkId', userId))
      .unique()
  },
})

export const getCredits = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', q => q.eq('clerkId', userId))
      .unique()
    if (!user) return null
    return {
      credits_remaining: user.creditsRemaining,
      plan:              user.plan,
    }
  },
})

// ── Mutations ─────────────────────────────────────────────────────────────────

export const upsertProfile = mutation({
  args: {
    id:               v.string(),
    email:            v.string(),
    plan:             v.string(),
    plan_id:          v.optional(v.string()),
    credits_remaining: v.number(),
    scan_count:       v.number(),
    updated_at:       v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', q => q.eq('clerkId', args.id))
      .unique()

    if (existing) {
      await ctx.db.patch(existing._id, {
        email:            args.email,
        plan:             args.plan,
        planId:           args.plan_id,
        creditsRemaining: args.credits_remaining,
        scanCount:        args.scan_count,
        updatedAt:        args.updated_at,
      })
    } else {
      await ctx.db.insert('users', {
        clerkId:          args.id,
        email:            args.email,
        plan:             args.plan,
        planId:           args.plan_id,
        creditsRemaining: args.credits_remaining,
        scanCount:        args.scan_count,
        updatedAt:        args.updated_at,
      })
    }
  },
})
