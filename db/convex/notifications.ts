/**
 * Convex functions — notifications
 * Called by lib/db/replicas.ts convexGetNotifications()
 */

import { v }     from 'convex/values'
import { query } from './_generated/server'

export const list = query({
  args: {
    userId: v.string(),
    limit:  v.optional(v.number()),
  },
  handler: async (ctx, { userId, limit = 10 }) => {
    return ctx.db
      .query('notifications')
      .withIndex('by_user_id', q => q.eq('userId', userId))
      .order('desc')
      .take(limit)
  },
})
