"use client";

import { Bot, Rocket } from "lucide-react";

import { KanbanBoard } from "@/components/kanban/kanban-board";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="min-h-screen bg-background p-4 text-foreground md:p-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <Card className="py-0">
          <CardHeader className="gap-3 pb-3">
            <Badge variant="secondary" className="w-fit">
              Thin Slice v1
            </Badge>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Bot className="size-5" />
              Agent Mission Control
            </CardTitle>
            <CardDescription>
              One board, real execution lifecycle. Create tasks, drag cards, and run dry-run executions with live status and timeline updates.
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-5 pt-0">
            <div className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm text-muted-foreground">
              <Rocket className="size-4" />
              Start any card directly from the board to watch queued → running → succeeded.
            </div>
          </CardContent>
        </Card>

        <KanbanBoard />
      </div>
    </main>
  );
}
