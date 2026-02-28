import { KanbanBoard } from "@/components/kanban/kanban-board"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

export default function Home() {
  return (
    <main className="min-h-screen bg-background p-6 text-foreground md:p-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <Badge variant="secondary">Milestone 2 Kanban MVP</Badge>
            <h1 className="text-3xl font-semibold tracking-tight">
              Agent Mission Control
            </h1>
            <p className="text-sm text-muted-foreground">
              Convex-first board state with persisted drag/drop move history.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">Specs</Button>
            <Button>Launch Agent</Button>
          </div>
        </header>

        <Separator />

        <KanbanBoard />
      </div>
    </main>
  )
}
