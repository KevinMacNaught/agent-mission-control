"use client";

import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

const stateOptions = ["all", "open", "closed", "merged"] as const;

export default function Home() {
  const [repoInput, setRepoInput] = useState("KevinMacNaught/agent-mission-control");
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState<(typeof stateOptions)[number]>("all");

  const addRepository = useMutation(api.visibility.addRepository);
  const syncRepository = useMutation(api.visibility.syncRepository);

  const dashboard = useQuery(api.visibility.getDashboard, {
    search: search.trim() ? search : undefined,
    state: stateFilter,
  });

  const repositories = useQuery(api.visibility.listRepositories);

  const counterCards = useMemo(() => {
    const counters = dashboard?.counters;
    if (!counters) return [];
    return [
      { label: "Repos", value: counters.repositories },
      { label: "Open Issues", value: counters.openIssues },
      { label: "Open PRs", value: counters.openPullRequests },
      { label: "Pending Review", value: counters.pendingReviews },
    ];
  }, [dashboard?.counters]);

  const handleOnboardRepo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!repoInput.trim()) return;
    const repositoryId = await addRepository({ fullName: repoInput });
    await syncRepository({ repositoryId });
    setRepoInput("");
  };

  return (
    <main className="min-h-screen bg-background p-6 text-foreground md:p-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="space-y-2">
          <Badge variant="secondary">Milestone 1 · Read-Only Visibility</Badge>
          <h1 className="text-3xl font-semibold tracking-tight">Agent Mission Control</h1>
          <p className="text-sm text-muted-foreground">
            Manual repo onboarding + read-only GitHub issue/PR visibility with concise counters.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Repository onboarding</CardTitle>
            <CardDescription>Add a repo in owner/name form and sync sample issue + PR visibility data.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="flex flex-col gap-2 md:flex-row" onSubmit={handleOnboardRepo}>
              <Input
                value={repoInput}
                onChange={(event) => setRepoInput(event.target.value)}
                placeholder="owner/name"
              />
              <Button type="submit">Add & sync</Button>
            </form>
            <div className="space-y-2 text-sm">
              {(repositories ?? []).map((repo) => (
                <div key={repo._id} className="flex items-center justify-between rounded-md border p-2">
                  <span>{repo.fullName}</span>
                  <Badge variant={repo.syncStatus === "synced" ? "default" : "secondary"}>{repo.syncStatus}</Badge>
                </div>
              ))}
              {repositories?.length === 0 ? (
                <p className="text-muted-foreground">No repositories onboarded yet.</p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <section className="grid gap-4 md:grid-cols-4">
          {counterCards.map((card) => (
            <Card key={card.label}>
              <CardHeader className="pb-2">
                <CardDescription>{card.label}</CardDescription>
                <CardTitle className="text-2xl">{card.value}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Basic search + state filtering across synced issues and PRs.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search title or repo"
            />
            <div className="flex gap-2">
              {stateOptions.map((option) => (
                <Button
                  key={option}
                  type="button"
                  variant={stateFilter === option ? "default" : "outline"}
                  onClick={() => setStateFilter(option)}
                  className="capitalize"
                >
                  {option}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <section className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Pending review</CardTitle>
              <CardDescription>Open PRs currently requiring review.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {(dashboard?.pendingReview ?? []).map((pr) => (
                <div key={pr._id} className="rounded-md border p-3">
                  <p className="text-sm font-medium">#{pr.number} {pr.title}</p>
                  <p className="text-xs text-muted-foreground">{pr.repositoryFullName}</p>
                </div>
              ))}
              {dashboard && dashboard.pendingReview.length === 0 ? (
                <p className="text-sm text-muted-foreground">No PRs awaiting review.</p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Read-only issue + PR visibility</CardTitle>
              <CardDescription>Synced records for quick triage.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(dashboard?.issues ?? []).slice(0, 4).map((issue) => (
                  <div key={issue._id} className="rounded-md border p-2 text-sm">
                    <p className="font-medium">Issue #{issue.number}: {issue.title}</p>
                    <p className="text-xs text-muted-foreground">{issue.repositoryFullName} · {issue.state}</p>
                  </div>
                ))}

                <Separator className="my-3" />

                {(dashboard?.pullRequests ?? []).slice(0, 4).map((pr) => (
                  <div key={pr._id} className="rounded-md border p-2 text-sm">
                    <p className="font-medium">PR #{pr.number}: {pr.title}</p>
                    <p className="text-xs text-muted-foreground">{pr.repositoryFullName} · {pr.state} · {pr.reviewDecision}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
