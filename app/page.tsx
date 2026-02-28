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

export default function Home() {
  return (
    <main className="min-h-screen bg-background p-6 text-foreground md:p-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <Badge variant="secondary">Agent Mission Control</Badge>
            <h1 className="text-3xl font-semibold tracking-tight">Starter Workspace</h1>
            <p className="text-sm text-muted-foreground">
              Minimal shell for dashboard + kanban planning.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">View Specs</Button>
            <Button>Launch Agent</Button>
          </div>
        </header>

        <Separator />

        <section className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Dashboard</CardTitle>
              <CardDescription>
                Placeholder metrics and activity feed area.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                Dashboard widgets will live here.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Kanban</CardTitle>
              <CardDescription>
                Placeholder board for agent tasks and milestones.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  "Backlog",
                  "In Progress",
                  "Done",
                ].map((column) => (
                  <div
                    key={column}
                    className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground"
                  >
                    {column}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  )
}
