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
});
