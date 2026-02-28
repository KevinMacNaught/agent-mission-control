import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { moduleCache: false });
const visibility = jiti("./visibility.ts");

const addRepositoryHandler = visibility.addRepository._handler;
const listRepositoriesHandler = visibility.listRepositories._handler;
const syncRepositoryHandler = visibility.syncRepository._handler;
const getDashboardHandler = visibility.getDashboard._handler;

class FakeIndexFilterBuilder {
  #field = null;
  #value = null;

  eq(field, value) {
    this.#field = field;
    this.#value = value;
    return this;
  }

  toPredicate() {
    if (this.#field === null) {
      return () => true;
    }

    return (doc) => doc[this.#field] === this.#value;
  }
}

class FakeQuery {
  #db;
  #tableName;
  #predicates = [];
  #orderDirection = null;

  constructor(db, tableName) {
    this.#db = db;
    this.#tableName = tableName;
  }

  order(direction) {
    this.#orderDirection = direction;
    return this;
  }

  withIndex(_indexName, callback) {
    const builder = new FakeIndexFilterBuilder();
    callback(builder);
    this.#predicates.push(builder.toPredicate());
    return this;
  }

  async collect() {
    let docs = this.#db.tableDocs(this.#tableName);
    for (const predicate of this.#predicates) {
      docs = docs.filter(predicate);
    }

    if (this.#orderDirection === "desc") {
      docs = docs.sort((a, b) => b._creationTime - a._creationTime);
    } else if (this.#orderDirection === "asc") {
      docs = docs.sort((a, b) => a._creationTime - b._creationTime);
    }

    return docs.map((doc) => ({ ...doc }));
  }

  async unique() {
    const docs = await this.collect();
    if (docs.length === 0) return null;
    if (docs.length > 1) {
      throw new Error(`Expected unique result for ${this.#tableName}, got ${docs.length}`);
    }
    return docs[0];
  }
}

class FakeDb {
  #tables = {
    repositories: [],
    issues: [],
    pullRequests: [],
  };

  #ids = {
    repositories: 0,
    issues: 0,
    pullRequests: 0,
  };

  #creation = 0;

  tableDocs(tableName) {
    const table = this.#tables[tableName];
    if (!table) {
      throw new Error(`Unknown table ${tableName}`);
    }
    return [...table];
  }

  async get(id) {
    const [tableName] = id.split(":");
    const table = this.#tables[tableName];
    if (!table) return null;
    const doc = table.find((entry) => entry._id === id);
    return doc ? { ...doc } : null;
  }

  query(tableName) {
    return new FakeQuery(this, tableName);
  }

  async insert(tableName, value) {
    const table = this.#tables[tableName];
    if (!table) {
      throw new Error(`Unknown table ${tableName}`);
    }

    const id = `${tableName}:${++this.#ids[tableName]}`;
    table.push({
      _id: id,
      _creationTime: ++this.#creation,
      ...value,
    });
    return id;
  }

  async patch(id, patch) {
    const [tableName] = id.split(":");
    const table = this.#tables[tableName];
    if (!table) {
      throw new Error(`Unknown table for id ${id}`);
    }

    const index = table.findIndex((entry) => entry._id === id);
    if (index === -1) {
      throw new Error(`Document not found for id ${id}`);
    }

    table[index] = {
      ...table[index],
      ...patch,
    };
  }

  async delete(id) {
    const [tableName] = id.split(":");
    const table = this.#tables[tableName];
    if (!table) {
      throw new Error(`Unknown table for id ${id}`);
    }

    const index = table.findIndex((entry) => entry._id === id);
    if (index === -1) {
      return;
    }
    table.splice(index, 1);
  }
}

function makeCtx() {
  const db = new FakeDb();
  return { db };
}

test("addRepository validates owner/name format and normalizes case/whitespace", async () => {
  const ctx = makeCtx();

  const repoId = await addRepositoryHandler(ctx, {
    fullName: "  KevinMacNaught/Agent-Mission-Control  ",
  });
  const repo = await ctx.db.get(repoId);

  assert.equal(repo?.fullName, "kevinmacnaught/agent-mission-control");
  assert.equal(repo?.owner, "kevinmacnaught");
  assert.equal(repo?.name, "agent-mission-control");
  assert.equal(repo?.syncStatus, "never_synced");

  const sameRepoId = await addRepositoryHandler(ctx, {
    fullName: "kevinmacnaught/agent-mission-control",
  });
  assert.equal(sameRepoId, repoId);

  const repos = await listRepositoriesHandler(ctx, {});
  assert.equal(repos.length, 1);

  await assert.rejects(
    () => addRepositoryHandler(ctx, { fullName: "invalid" }),
    /owner\/name format/,
  );
  await assert.rejects(
    () => addRepositoryHandler(ctx, { fullName: "owner/name/extra" }),
    /owner\/name format/,
  );
  await assert.rejects(
    () => addRepositoryHandler(ctx, { fullName: "/missing-owner" }),
    /owner\/name format/,
  );
  await assert.rejects(
    () => addRepositoryHandler(ctx, { fullName: "missing-name/" }),
    /owner\/name format/,
  );
});

test("getDashboard applies state matrix filters and search across title/repository", async () => {
  const ctx = makeCtx();

  const alphaId = await ctx.db.insert("repositories", {
    owner: "alpha",
    name: "one",
    fullName: "alpha/one",
    isActive: true,
    syncStatus: "synced",
    createdAt: 1,
    updatedAt: 1,
  });
  const betaId = await ctx.db.insert("repositories", {
    owner: "beta",
    name: "two",
    fullName: "beta/two",
    isActive: true,
    syncStatus: "synced",
    createdAt: 1,
    updatedAt: 2,
  });

  await ctx.db.insert("issues", {
    repositoryId: alphaId,
    githubId: 1001,
    number: 101,
    title: "Alpha bug",
    state: "open",
    labels: ["bug"],
    updatedAtGitHub: "2026-02-28T10:00:00Z",
    syncedAt: 1,
  });
  await ctx.db.insert("issues", {
    repositoryId: betaId,
    githubId: 1002,
    number: 102,
    title: "Beta cleanup",
    state: "closed",
    labels: ["chore"],
    updatedAtGitHub: "2026-02-27T10:00:00Z",
    syncedAt: 1,
  });
  await ctx.db.insert("issues", {
    repositoryId: betaId,
    githubId: 1003,
    number: 103,
    title: "Search index",
    state: "open",
    labels: ["enhancement"],
    updatedAtGitHub: "2026-02-26T10:00:00Z",
    syncedAt: 1,
  });

  await ctx.db.insert("pullRequests", {
    repositoryId: alphaId,
    githubId: 2001,
    number: 201,
    title: "Alpha feature",
    state: "open",
    author: "odin",
    reviewDecision: "review_required",
    updatedAtGitHub: "2026-02-28T09:00:00Z",
    syncedAt: 1,
  });
  await ctx.db.insert("pullRequests", {
    repositoryId: betaId,
    githubId: 2002,
    number: 202,
    title: "Beta hotfix",
    state: "closed",
    author: "kevin",
    reviewDecision: "approved",
    updatedAtGitHub: "2026-02-27T09:00:00Z",
    syncedAt: 1,
  });
  await ctx.db.insert("pullRequests", {
    repositoryId: alphaId,
    githubId: 2003,
    number: 203,
    title: "Alpha release",
    state: "merged",
    author: "kevin",
    reviewDecision: "approved",
    updatedAtGitHub: "2026-02-26T09:00:00Z",
    syncedAt: 1,
  });
  await ctx.db.insert("pullRequests", {
    repositoryId: betaId,
    githubId: 2004,
    number: 204,
    title: "Unrelated open",
    state: "open",
    author: "odin",
    reviewDecision: "approved",
    updatedAtGitHub: "2026-02-25T09:00:00Z",
    syncedAt: 1,
  });

  const matrix = [
    { state: "all", issueNumbers: [101, 102, 103], prNumbers: [201, 202, 203, 204] },
    { state: "open", issueNumbers: [101, 103], prNumbers: [201, 204] },
    { state: "closed", issueNumbers: [102], prNumbers: [202] },
    { state: "merged", issueNumbers: [], prNumbers: [203] },
  ];

  for (const expected of matrix) {
    const dashboard = await getDashboardHandler(ctx, { state: expected.state });
    assert.deepEqual(
      dashboard.issues.map((issue) => issue.number),
      expected.issueNumbers,
      `issue matrix for ${expected.state}`,
    );
    assert.deepEqual(
      dashboard.pullRequests.map((pr) => pr.number),
      expected.prNumbers,
      `PR matrix for ${expected.state}`,
    );
  }

  const repoSearch = await getDashboardHandler(ctx, {
    state: "all",
    search: "  BETA/TWO ",
  });
  assert.deepEqual(repoSearch.issues.map((issue) => issue.number), [102, 103]);
  assert.deepEqual(repoSearch.pullRequests.map((pr) => pr.number), [202, 204]);

  const titleSearch = await getDashboardHandler(ctx, {
    state: "all",
    search: "  fEaTuRe ",
  });
  assert.deepEqual(titleSearch.issues.map((issue) => issue.number), []);
  assert.deepEqual(titleSearch.pullRequests.map((pr) => pr.number), [201]);

  const combinedSearch = await getDashboardHandler(ctx, {
    state: "open",
    search: "beta",
  });
  assert.deepEqual(combinedSearch.issues.map((issue) => issue.number), [103]);
  assert.deepEqual(combinedSearch.pullRequests.map((pr) => pr.number), [204]);
});

test("getDashboard derives pending review from open review_required PRs and sorts newest first", async () => {
  const ctx = makeCtx();

  const alphaId = await ctx.db.insert("repositories", {
    owner: "alpha",
    name: "one",
    fullName: "alpha/one",
    isActive: true,
    syncStatus: "synced",
    createdAt: 1,
    updatedAt: 1,
  });
  const betaId = await ctx.db.insert("repositories", {
    owner: "beta",
    name: "two",
    fullName: "beta/two",
    isActive: true,
    syncStatus: "synced",
    createdAt: 1,
    updatedAt: 1,
  });

  await ctx.db.insert("pullRequests", {
    repositoryId: alphaId,
    githubId: 3001,
    number: 301,
    title: "Needs review older",
    state: "open",
    author: "odin",
    reviewDecision: "review_required",
    updatedAtGitHub: "2026-02-25T09:00:00Z",
    syncedAt: 1,
  });
  await ctx.db.insert("pullRequests", {
    repositoryId: alphaId,
    githubId: 3002,
    number: 302,
    title: "Already approved",
    state: "open",
    author: "odin",
    reviewDecision: "approved",
    updatedAtGitHub: "2026-02-28T09:00:00Z",
    syncedAt: 1,
  });
  await ctx.db.insert("pullRequests", {
    repositoryId: betaId,
    githubId: 3003,
    number: 303,
    title: "Needs review newer",
    state: "open",
    author: "kevin",
    reviewDecision: "review_required",
    updatedAtGitHub: "2026-02-27T09:00:00Z",
    syncedAt: 1,
  });
  await ctx.db.insert("pullRequests", {
    repositoryId: betaId,
    githubId: 3004,
    number: 304,
    title: "Closed but required",
    state: "closed",
    author: "kevin",
    reviewDecision: "review_required",
    updatedAtGitHub: "2026-02-28T09:30:00Z",
    syncedAt: 1,
  });

  const dashboard = await getDashboardHandler(ctx, {
    state: "all",
  });

  assert.equal(dashboard.counters.pendingReviews, 2);
  assert.deepEqual(
    dashboard.pendingReview.map((pr) => pr.number),
    [303, 301],
  );
  assert.deepEqual(
    dashboard.pendingReview.map((pr) => pr.repositoryFullName),
    ["beta/two", "alpha/one"],
  );
});

test("add -> sync -> dashboard flow produces expected counters and records", async () => {
  const ctx = makeCtx();

  const repositoryId = await addRepositoryHandler(ctx, {
    fullName: "  KevinMacNaught/Agent-Mission-Control ",
  });

  const beforeSync = await listRepositoriesHandler(ctx, {});
  assert.equal(beforeSync.length, 1);
  assert.equal(beforeSync[0].syncStatus, "never_synced");

  await syncRepositoryHandler(ctx, { repositoryId });

  const dashboard = await getDashboardHandler(ctx, {
    state: "all",
  });
  const repositories = await listRepositoriesHandler(ctx, {});

  assert.equal(repositories.length, 1);
  assert.equal(repositories[0].fullName, "kevinmacnaught/agent-mission-control");
  assert.equal(repositories[0].syncStatus, "synced");
  assert.ok(typeof repositories[0].lastSyncedAt === "number");

  assert.deepEqual(dashboard.counters, {
    repositories: 1,
    openIssues: 1,
    openPullRequests: 1,
    pendingReviews: 1,
  });

  assert.equal(dashboard.repositories.length, 1);
  assert.equal(dashboard.repositories[0].issueCount, 2);
  assert.equal(dashboard.repositories[0].pullRequestCount, 2);
  assert.deepEqual(dashboard.issues.map((issue) => issue.number), [12, 11]);
  assert.deepEqual(dashboard.pullRequests.map((pr) => pr.number), [27, 24]);
  assert.deepEqual(dashboard.pendingReview.map((pr) => pr.number), [27]);
});
