import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  repositories: defineTable({
    owner: v.string(),
    name: v.string(),
    fullName: v.string(),
    isActive: v.boolean(),
    syncStatus: v.union(
      v.literal("never_synced"),
      v.literal("syncing"),
      v.literal("synced"),
      v.literal("error"),
    ),
    lastSyncedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_full_name", ["fullName"]),

  issues: defineTable({
    repositoryId: v.id("repositories"),
    githubId: v.number(),
    number: v.number(),
    title: v.string(),
    state: v.union(v.literal("open"), v.literal("closed")),
    assignee: v.optional(v.string()),
    labels: v.array(v.string()),
    updatedAtGitHub: v.string(),
    syncedAt: v.number(),
  })
    .index("by_repository", ["repositoryId"])
    .index("by_github_id", ["githubId"]),

  pullRequests: defineTable({
    repositoryId: v.id("repositories"),
    githubId: v.number(),
    number: v.number(),
    title: v.string(),
    state: v.union(v.literal("open"), v.literal("closed"), v.literal("merged")),
    author: v.string(),
    reviewDecision: v.union(
      v.literal("review_required"),
      v.literal("approved"),
      v.literal("changes_requested"),
      v.literal("unknown"),
    ),
    updatedAtGitHub: v.string(),
    syncedAt: v.number(),
  })
    .index("by_repository", ["repositoryId"])
    .index("by_github_id", ["githubId"]),

  boards: defineTable({
    name: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_createdAt", ["createdAt"]),

  columns: defineTable({
    boardId: v.id("boards"),
    title: v.string(),
    order: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_board_order", ["boardId", "order"]),

  cards: defineTable({
    boardId: v.id("boards"),
    columnId: v.id("columns"),
    title: v.string(),
    description: v.optional(v.string()),
    order: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_board", ["boardId"])
    .index("by_column_order", ["columnId", "order"]),

  executions: defineTable({
    boardId: v.id("boards"),
    cardId: v.id("cards"),
    mode: v.union(v.literal("dry_run")),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("succeeded"),
      v.literal("failed"),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    error: v.optional(v.string()),
  }).index("by_board", ["boardId"]),

  activities: defineTable({
    boardId: v.id("boards"),
    type: v.union(
      v.literal("card_moved"),
      v.literal("column_moved"),
      v.literal("execution_transition"),
    ),
    message: v.string(),
    cardId: v.optional(v.id("cards")),
    executionId: v.optional(v.id("executions")),
    executionStatus: v.optional(
      v.union(
        v.literal("queued"),
        v.literal("running"),
        v.literal("succeeded"),
        v.literal("failed"),
      )
    ),
    columnId: v.optional(v.id("columns")),
    fromColumnId: v.optional(v.id("columns")),
    toColumnId: v.optional(v.id("columns")),
    fromIndex: v.number(),
    toIndex: v.number(),
    createdAt: v.number(),
  }).index("by_board_createdAt", ["boardId", "createdAt"]),
});
