import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const sampleSyncData = {
  issues: [
    {
      githubId: 201,
      number: 12,
      title: "Improve offline sync retry behavior",
      state: "open" as const,
      assignee: "kevin",
      labels: ["bug", "sync"],
      updatedAtGitHub: "2026-02-28T13:12:00Z",
    },
    {
      githubId: 202,
      number: 11,
      title: "Add issue filters to dashboard",
      state: "closed" as const,
      assignee: "odin",
      labels: ["enhancement"],
      updatedAtGitHub: "2026-02-27T17:05:00Z",
    },
  ],
  pullRequests: [
    {
      githubId: 301,
      number: 27,
      title: "feat: wire read-only visibility widgets",
      state: "open" as const,
      author: "odin-bot",
      reviewDecision: "review_required" as const,
      updatedAtGitHub: "2026-02-28T13:20:00Z",
    },
    {
      githubId: 302,
      number: 24,
      title: "chore: tighten convex env docs",
      state: "merged" as const,
      author: "kevin",
      reviewDecision: "approved" as const,
      updatedAtGitHub: "2026-02-26T10:45:00Z",
    },
  ],
};

export const listRepositories = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("repositories").order("desc").collect();
  },
});

export const addRepository = mutation({
  args: {
    fullName: v.string(),
  },
  handler: async (ctx, args) => {
    const fullName = args.fullName.trim().toLowerCase();
    const [owner, name] = fullName.split("/");

    if (!owner || !name || fullName.split("/").length !== 2) {
      throw new Error("Repository must be in owner/name format.");
    }

    const existing = await ctx.db
      .query("repositories")
      .withIndex("by_full_name", (q) => q.eq("fullName", fullName))
      .unique();

    if (existing) {
      return existing._id;
    }

    const now = Date.now();
    return await ctx.db.insert("repositories", {
      owner,
      name,
      fullName,
      isActive: true,
      syncStatus: "never_synced",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const syncRepository = mutation({
  args: {
    repositoryId: v.id("repositories"),
  },
  handler: async (ctx, args) => {
    const repo = await ctx.db.get(args.repositoryId);
    if (!repo) {
      throw new Error("Repository not found");
    }

    const startedAt = Date.now();
    await ctx.db.patch(repo._id, {
      syncStatus: "syncing",
      updatedAt: startedAt,
    });

    const existingIssues = await ctx.db
      .query("issues")
      .withIndex("by_repository", (q) => q.eq("repositoryId", repo._id))
      .collect();

    for (const issue of existingIssues) {
      await ctx.db.delete(issue._id);
    }

    const existingPrs = await ctx.db
      .query("pullRequests")
      .withIndex("by_repository", (q) => q.eq("repositoryId", repo._id))
      .collect();

    for (const pr of existingPrs) {
      await ctx.db.delete(pr._id);
    }

    for (const issue of sampleSyncData.issues) {
      await ctx.db.insert("issues", {
        repositoryId: repo._id,
        ...issue,
        syncedAt: startedAt,
      });
    }

    for (const pr of sampleSyncData.pullRequests) {
      await ctx.db.insert("pullRequests", {
        repositoryId: repo._id,
        ...pr,
        syncedAt: startedAt,
      });
    }

    await ctx.db.patch(repo._id, {
      syncStatus: "synced",
      lastSyncedAt: startedAt,
      updatedAt: Date.now(),
    });
  },
});

export const getDashboard = query({
  args: {
    search: v.optional(v.string()),
    state: v.optional(v.union(v.literal("all"), v.literal("open"), v.literal("closed"), v.literal("merged"))),
  },
  handler: async (ctx, args) => {
    const [repositories, issues, pullRequests] = await Promise.all([
      ctx.db.query("repositories").collect(),
      ctx.db.query("issues").collect(),
      ctx.db.query("pullRequests").collect(),
    ]);

    const repoById = new Map(repositories.map((repo) => [repo._id, repo]));
    const search = args.search?.trim().toLowerCase();

    const matchesSearch = (title: string, repoName: string) => {
      if (!search) return true;
      return (
        title.toLowerCase().includes(search) ||
        repoName.toLowerCase().includes(search)
      );
    };

    const filteredIssues = issues.filter((issue) => {
      const repoName = repoById.get(issue.repositoryId)?.fullName ?? "unknown";
      const stateOk =
        !args.state || args.state === "all"
          ? true
          : args.state === "merged"
            ? false
            : issue.state === args.state;
      return stateOk && matchesSearch(issue.title, repoName);
    });

    const filteredPullRequests = pullRequests.filter((pr) => {
      const repoName = repoById.get(pr.repositoryId)?.fullName ?? "unknown";
      const stateOk =
        !args.state || args.state === "all"
          ? true
          : pr.state === args.state;
      return stateOk && matchesSearch(pr.title, repoName);
    });

    const pendingReview = pullRequests
      .filter((pr) => pr.state === "open" && pr.reviewDecision === "review_required")
      .map((pr) => ({
        ...pr,
        repositoryFullName: repoById.get(pr.repositoryId)?.fullName ?? "unknown",
      }))
      .sort((a, b) => b.updatedAtGitHub.localeCompare(a.updatedAtGitHub));

    return {
      counters: {
        repositories: repositories.length,
        openIssues: issues.filter((issue) => issue.state === "open").length,
        openPullRequests: pullRequests.filter((pr) => pr.state === "open").length,
        pendingReviews: pendingReview.length,
      },
      repositories: repositories
        .map((repo) => ({
          ...repo,
          issueCount: issues.filter((issue) => issue.repositoryId === repo._id).length,
          pullRequestCount: pullRequests.filter((pr) => pr.repositoryId === repo._id).length,
        }))
        .sort((a, b) => b.updatedAt - a.updatedAt),
      issues: filteredIssues
        .map((issue) => ({
          ...issue,
          repositoryFullName: repoById.get(issue.repositoryId)?.fullName ?? "unknown",
        }))
        .sort((a, b) => b.updatedAtGitHub.localeCompare(a.updatedAtGitHub)),
      pullRequests: filteredPullRequests
        .map((pr) => ({
          ...pr,
          repositoryFullName: repoById.get(pr.repositoryId)?.fullName ?? "unknown",
        }))
        .sort((a, b) => b.updatedAtGitHub.localeCompare(a.updatedAtGitHub)),
      pendingReview,
    };
  },
});
