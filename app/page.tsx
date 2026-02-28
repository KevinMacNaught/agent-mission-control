"use client";

import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  Bell,
  Bot,
  CalendarClock,
  Gauge,
  Kanban,
  LayoutDashboard,
  ListTodo,
  Rocket,
  Settings2,
  Sparkles,
  Workflow,
} from "lucide-react";

import { api } from "@/convex/_generated/api";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

const stateOptions = ["all", "open", "closed", "merged"] as const;

const navItems = [
  { label: "Overview", icon: LayoutDashboard, active: true },
  { label: "Operations", icon: Gauge, active: false },
  { label: "Tasks", icon: ListTodo, active: false },
  { label: "Kanban", icon: Kanban, active: false },
  { label: "Settings", icon: Settings2, active: false },
];

const boardColumns = [
  { name: "Backlog", count: 9, note: "Issue definitions and specs" },
  { name: "In Progress", count: 3, note: "Scaffold and shell implementation" },
  { name: "Review", count: 2, note: "QA and accessibility pass" },
  { name: "Done", count: 5, note: "Completed milestone deliverables" },
];

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
      { label: "Repos", value: counters.repositories, detail: "onboarded for visibility" },
      { label: "Open Issues", value: counters.openIssues, detail: "current open issues" },
      {
        label: "Open PRs",
        value: counters.openPullRequests,
        detail: "active pull requests",
      },
      {
        label: "Pending Review",
        value: counters.pendingReviews,
        detail: "awaiting reviewer action",
      },
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
    <main className="min-h-screen bg-background p-4 text-foreground md:p-6">
      <div className="mx-auto grid w-full max-w-7xl gap-4 xl:grid-cols-[280px_1fr]">
        <aside className="xl:sticky xl:top-6 xl:h-[calc(100vh-3rem)]">
          <Card className="h-full gap-0 overflow-hidden border-sidebar-border bg-sidebar text-sidebar-foreground">
            <CardHeader className="gap-3 border-b border-sidebar-border">
              <Badge variant="secondary" className="w-fit">
                Milestone 2
              </Badge>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bot className="size-4" />
                Agent Mission Control
              </CardTitle>
              <CardDescription className="text-sidebar-foreground/80">
                Visibility dashboard + persisted Kanban workflow
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-4 px-3 py-4">
              <div className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;

                  return (
                    <Button
                      key={item.label}
                      variant={item.active ? "secondary" : "ghost"}
                      className="w-full justify-start"
                    >
                      <Icon className="size-4" />
                      {item.label}
                    </Button>
                  );
                })}
              </div>

              <Separator className="bg-sidebar-border" />

              <Card className="gap-3 border-sidebar-border bg-sidebar-accent py-4">
                <CardHeader className="px-4">
                  <CardTitle className="text-sm">Repository onboarding</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 px-4">
                  <form className="flex flex-col gap-2" onSubmit={handleOnboardRepo}>
                    <Input
                      value={repoInput}
                      onChange={(event) => setRepoInput(event.target.value)}
                      placeholder="owner/name"
                    />
                    <Button type="submit" size="sm" className="w-full">
                      <Rocket className="size-4" />
                      Add & sync
                    </Button>
                  </form>
                  <p className="text-xs text-muted-foreground">
                    Onboard a repository and sync read-only issue/PR data.
                  </p>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </aside>

        <section className="flex flex-col gap-4">
          <Card className="py-0">
            <CardContent className="flex flex-col gap-4 py-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <Badge variant="outline">Darkmatter Theme Active</Badge>
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">Visibility Dashboard</h1>
                  <p className="text-sm text-muted-foreground">
                    Read-only GitHub visibility for synced repositories, issues, pull requests,
                    and persisted Kanban execution.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm">
                  <Bell className="size-4" />
                  Alerts
                </Button>
                <Button variant="outline" size="sm">
                  <CalendarClock className="size-4" />
                  Timeline
                </Button>
                <Button size="sm">
                  <Sparkles className="size-4" />
                  Start Mission
                </Button>
              </div>
            </CardContent>
          </Card>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {counterCards.map((metric) => (
              <Card key={metric.label} className="gap-3 py-4">
                <CardHeader className="px-4">
                  <CardDescription>{metric.label}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-1 px-4">
                  <p className="text-3xl font-semibold tracking-tight">{metric.value}</p>
                  <p className="text-xs text-muted-foreground">{metric.detail}</p>
                </CardContent>
              </Card>
            ))}
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
              <CardDescription>Search and state filtering across synced issues and PRs.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search title or repo"
              />
              <div className="flex flex-wrap gap-2">
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

          <section className="grid gap-4 2xl:grid-cols-[2fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Workflow className="size-4" />
                  Read-only Visibility
                </CardTitle>
                <CardDescription>Synced issues and pull requests for quick triage.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 lg:grid-cols-2">
                <Card className="gap-3 border-dashed py-4 shadow-none">
                  <CardHeader className="px-4">
                    <CardTitle className="text-sm">Issues</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 px-4">
                    {(dashboard?.issues ?? []).slice(0, 6).map((issue) => (
                      <div key={issue._id} className="rounded-md border p-2 text-sm">
                        <p className="font-medium">
                          Issue #{issue.number}: {issue.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {issue.repositoryFullName} · {issue.state}
                        </p>
                      </div>
                    ))}
                    {dashboard && dashboard.issues.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No matching issues.</p>
                    ) : null}
                  </CardContent>
                </Card>

                <Card className="gap-3 border-dashed py-4 shadow-none">
                  <CardHeader className="px-4">
                    <CardTitle className="text-sm">Pull Requests</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 px-4">
                    {(dashboard?.pullRequests ?? []).slice(0, 6).map((pr) => (
                      <div key={pr._id} className="rounded-md border p-2 text-sm">
                        <p className="font-medium">
                          PR #{pr.number}: {pr.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {pr.repositoryFullName} · {pr.state} · {pr.reviewDecision}
                        </p>
                      </div>
                    ))}
                    {dashboard && dashboard.pullRequests.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No matching pull requests.</p>
                    ) : null}
                  </CardContent>
                </Card>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Activity Placeholder</CardTitle>
                <CardDescription>Recent command center events will appear here.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(repositories ?? []).slice(0, 4).map((repo) => (
                  <div
                    key={repo._id}
                    className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground"
                  >
                    {repo.fullName} · sync status: {repo.syncStatus}
                  </div>
                ))}
                {repositories?.length === 0 ? (
                  <div className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
                    No repositories onboarded yet.
                  </div>
                ) : null}
                <Separator className="my-1" />
                {boardColumns.map((column) => (
                  <div
                    key={column.name}
                    className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground"
                  >
                    {column.name}: {column.count} · {column.note}
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>

          <section className="space-y-3">
            <div className="space-y-1">
              <Badge variant="secondary">Kanban MVP</Badge>
              <h2 className="text-xl font-semibold tracking-tight">Persisted Drag-and-Drop Board</h2>
              <p className="text-sm text-muted-foreground">
                dnd-kit interactions are persisted via Convex and activity is logged in real time.
              </p>
            </div>
            <KanbanBoard />
          </section>
        </section>
      </div>
    </main>
  );
}
