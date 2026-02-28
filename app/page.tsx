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
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

const navItems = [
  { label: "Overview", icon: LayoutDashboard, active: true },
  { label: "Operations", icon: Gauge, active: false },
  { label: "Tasks", icon: ListTodo, active: false },
  { label: "Kanban", icon: Kanban, active: false },
  { label: "Settings", icon: Settings2, active: false },
]

const metricCards = [
  { label: "Active Agents", value: "06", detail: "2 queued for handoff" },
  { label: "Mission Uptime", value: "99.8%", detail: "last 24 hours" },
  { label: "Queued Work", value: "14", detail: "ready to execute" },
  { label: "Review Debt", value: "03", detail: "pending approvals" },
]

const boardColumns = [
  { name: "Backlog", count: 9, note: "Issue definitions and specs" },
  { name: "In Progress", count: 3, note: "Scaffold and shell implementation" },
  { name: "Review", count: 2, note: "QA and accessibility pass" },
  { name: "Done", count: 5, note: "Completed milestone deliverables" },
]

export default function Home() {
  return (
    <main className="min-h-screen bg-background p-4 text-foreground md:p-6">
      <div className="mx-auto grid w-full max-w-7xl gap-4 xl:grid-cols-[280px_1fr]">
        <aside className="xl:sticky xl:top-6 xl:h-[calc(100vh-3rem)]">
          <Card className="h-full gap-0 overflow-hidden border-sidebar-border bg-sidebar text-sidebar-foreground">
            <CardHeader className="gap-3 border-b border-sidebar-border">
              <Badge variant="secondary" className="w-fit">
                Milestone 0
              </Badge>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bot className="size-4" />
                Agent Mission Control
              </CardTitle>
              <CardDescription className="text-sidebar-foreground/80">
                Scaffold + design system shell
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-4 px-3 py-4">
              <div className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon

                  return (
                    <Button
                      key={item.label}
                      variant={item.active ? "secondary" : "ghost"}
                      className="w-full justify-start"
                    >
                      <Icon className="size-4" />
                      {item.label}
                    </Button>
                  )
                })}
              </div>

              <Separator className="bg-sidebar-border" />

              <Card className="gap-3 border-sidebar-border bg-sidebar-accent py-4">
                <CardHeader className="px-4">
                  <CardTitle className="text-sm">Upcoming Checkpoint</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 px-4">
                  <p className="text-xs text-muted-foreground">
                    Complete shell validation and prepare milestone handoff notes.
                  </p>
                  <Button size="sm" className="w-full">
                    <Rocket className="size-4" />
                    Launch Standup
                  </Button>
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
                  <h1 className="text-2xl font-semibold tracking-tight">
                    Dashboard Shell
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Sidebar, top bar, and placeholder panels for upcoming milestone work.
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
            {metricCards.map((metric) => (
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

          <section className="grid gap-4 2xl:grid-cols-[2fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Workflow className="size-4" />
                  Milestone Board Placeholder
                </CardTitle>
                <CardDescription>
                  Core dashboard area reserved for upcoming kanban integration.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-4">
                {boardColumns.map((column) => (
                  <Card key={column.name} className="gap-3 border-dashed py-4 shadow-none">
                    <CardHeader className="px-4">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-sm">{column.name}</CardTitle>
                        <Badge variant="secondary">{column.count}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="px-4">
                      <p className="text-xs text-muted-foreground">{column.note}</p>
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Activity Placeholder</CardTitle>
                <CardDescription>Recent command center events will appear here.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  "Design system shell initialized",
                  "Sidebar navigation scaffolded",
                  "Top bar action area created",
                  "Dashboard cards prepared for integrations",
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground"
                  >
                    {item}
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>
        </section>
      </div>
    </main>
  )
}
