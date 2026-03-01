"use client"

import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useMutation, useQuery } from "convex/react"
import { ArrowRightLeft, GripVertical } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type DragTarget =
  | {
      kind: "column"
      id: string
    }
  | {
      kind: "card"
      id: string
    }

type ExecutionStatus = "queued" | "running" | "succeeded" | "failed"

type BoardCard = {
  _id: Id<"cards">
  title: string
  order: number
  execution?: {
    _id: Id<"executions">
    mode: "dry_run"
    status: ExecutionStatus
    updatedAt: number
  }
}

type BoardColumn = {
  _id: Id<"columns">
  title: string
  order: number
  cards: BoardCard[]
}

type BoardData = {
  board: {
    _id: Id<"boards">
    name: string
  }
  columns: BoardColumn[]
  activities: {
    _id: Id<"activities">
    message: string
    createdAt: number
  }[]
}

function createColumnDragId(columnId: string) {
  return `column:${columnId}`
}

function createCardDragId(cardId: string) {
  return `card:${cardId}`
}

function parseDragTarget(id: string): DragTarget | null {
  const [kind, rawId] = id.split(":")

  if (!kind || !rawId) {
    return null
  }

  if (kind === "column") {
    return { kind, id: rawId }
  }

  if (kind === "card") {
    return { kind, id: rawId }
  }

  return null
}

function formatTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp)
}

function getExecutionBadgeVariant(status: ExecutionStatus) {
  if (status === "failed") {
    return "destructive"
  }

  if (status === "succeeded") {
    return "secondary"
  }

  return "outline"
}

function getExecutionBadgeLabel(status: ExecutionStatus) {
  if (status === "queued") {
    return "Queued"
  }

  if (status === "running") {
    return "Running"
  }

  if (status === "succeeded") {
    return "Succeeded"
  }

  return "Failed"
}

function SortableCardItem({ card }: { card: BoardCard }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: createCardDragId(String(card._id)) })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      {...attributes}
      {...listeners}
      className={cn(
        "touch-none rounded-lg border bg-background px-3 py-2 shadow-xs",
        isDragging && "opacity-60"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm leading-5">{card.title}</p>
        <GripVertical className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      </div>
      {card.execution ? (
        <div className="mt-2">
          <Badge variant={getExecutionBadgeVariant(card.execution.status)}>
            Dry run: {getExecutionBadgeLabel(card.execution.status)}
          </Badge>
        </div>
      ) : null}
    </div>
  )
}

function SortableColumnItem({ column }: { column: BoardColumn }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: createColumnDragId(String(column._id)) })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className="w-80 shrink-0"
    >
      <Card className={cn("gap-4 py-4", isDragging && "opacity-60")}>
        <CardHeader className="px-4 pb-0">
          <div
            className="flex cursor-grab items-center justify-between active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <CardTitle className="text-base">{column.title}</CardTitle>
            <Badge variant="secondary">{column.cards.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <SortableContext
            items={column.cards.map((card) => createCardDragId(String(card._id)))}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {column.cards.map((card) => (
                <SortableCardItem key={card._id} card={card} />
              ))}
              {column.cards.length === 0 ? (
                <div className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                  Drop cards here
                </div>
              ) : null}
            </div>
          </SortableContext>
        </CardContent>
      </Card>
    </div>
  )
}

export function KanbanBoard() {
  const boardState = useQuery(api.kanban.getBoard) as BoardData | null | undefined
  const ensureBoard = useMutation(api.kanban.ensureBoard)
  const moveColumn = useMutation(api.kanban.moveColumn)
  const moveCard = useMutation(api.kanban.moveCard)
  const [moveError, setMoveError] = useState<string | null>(null)
  const seededBoardRef = useRef(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    if (boardState !== null || seededBoardRef.current) {
      return
    }

    seededBoardRef.current = true
    void ensureBoard().catch(() => {
      seededBoardRef.current = false
      setMoveError("Could not initialize the board.")
    })
  }, [boardState, ensureBoard])

  if (boardState === undefined) {
    return (
      <Card>
        <CardContent className="px-6 py-8 text-sm text-muted-foreground">
          Loading board state...
        </CardContent>
      </Card>
    )
  }

  if (boardState === null) {
    return (
      <Card>
        <CardContent className="px-6 py-8 text-sm text-muted-foreground">
          Preparing board...
        </CardContent>
      </Card>
    )
  }

  const { board, columns, activities } = boardState

  const findCardPosition = (cardId: string) => {
    for (const column of columns) {
      const index = column.cards.findIndex((card) => String(card._id) === cardId)

      if (index !== -1) {
        return {
          columnId: column._id,
          index,
        }
      }
    }

    return null
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const activeTarget = parseDragTarget(String(active.id))
    const overTarget = parseDragTarget(String(over.id))

    if (!activeTarget || !overTarget) {
      return
    }

    if (activeTarget.kind === "column" && overTarget.kind === "column") {
      const fromIndex = columns.findIndex(
        (column) => String(column._id) === activeTarget.id
      )
      const toIndex = columns.findIndex((column) => String(column._id) === overTarget.id)

      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
        return
      }

      setMoveError(null)
      void moveColumn({
        boardId: board._id,
        columnId: activeTarget.id as Id<"columns">,
        toIndex,
      }).catch(() => {
        setMoveError("Could not move column.")
      })

      return
    }

    if (activeTarget.kind !== "card") {
      return
    }

    const sourcePosition = findCardPosition(activeTarget.id)

    if (!sourcePosition) {
      return
    }

    let targetColumnId: Id<"columns">
    let targetIndex: number

    if (overTarget.kind === "card") {
      const overCardPosition = findCardPosition(overTarget.id)

      if (!overCardPosition) {
        return
      }

      targetColumnId = overCardPosition.columnId
      targetIndex = overCardPosition.index
    } else {
      const targetColumn = columns.find(
        (column) => String(column._id) === overTarget.id
      )

      if (!targetColumn) {
        return
      }

      targetColumnId = targetColumn._id
      targetIndex = targetColumn.cards.length

      if (sourcePosition.columnId === targetColumn._id) {
        targetIndex = Math.max(0, targetIndex - 1)
      }
    }

    if (
      sourcePosition.columnId === targetColumnId &&
      sourcePosition.index === targetIndex
    ) {
      return
    }

    setMoveError(null)
    void moveCard({
      boardId: board._id,
      cardId: activeTarget.id as Id<"cards">,
      sourceColumnId: sourcePosition.columnId,
      targetColumnId,
      toIndex: targetIndex,
    }).catch(() => {
      setMoveError("Could not move card.")
    })
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <Card className="py-4">
        <CardHeader className="px-4 pb-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-lg">{board.name}</CardTitle>
            <Badge variant="outline">
              <ArrowRightLeft className="size-3.5" />
              Persisted drag and drop
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="px-4 pt-2">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={columns.map((column) => createColumnDragId(String(column._id)))}
              strategy={horizontalListSortingStrategy}
            >
              <div className="flex gap-4 overflow-x-auto pb-2">
                {columns.map((column) => (
                  <SortableColumnItem key={column._id} column={column} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          {moveError ? (
            <p className="mt-3 text-sm text-destructive">{moveError}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="py-4">
        <CardHeader className="px-4 pb-1">
          <CardTitle className="text-lg">Activity</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pt-2">
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground">Move history will appear here.</p>
          ) : (
            <div className="space-y-3">
              {activities.map((activity) => (
                <div key={activity._id} className="rounded-md border p-3">
                  <p className="text-sm leading-5">{activity.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatTimestamp(activity.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
