import { v } from "convex/values"

import { mutation, query } from "./_generated/server"
import type { Doc, Id } from "./_generated/dataModel"

const DEFAULT_COLUMNS = ["Backlog", "In Progress", "Done"] as const

const DEFAULT_CARDS = [
  {
    title: "Refine Milestone 2 scope",
    column: "Backlog",
  },
  {
    title: "Wire Convex board schema",
    column: "In Progress",
  },
  {
    title: "Ship drag and drop MVP",
    column: "Done",
  },
] as const

const IN_PROGRESS_COLUMN_TITLE = "In Progress" as const

type ExecutionStatus = "queued" | "running" | "succeeded" | "failed"

function getExecutionTransitionMessage(status: ExecutionStatus, cardTitle: string) {
  if (status === "queued") {
    return `Execution queued for "${cardTitle}" (dry run)`
  }

  if (status === "running") {
    return `Execution running for "${cardTitle}" (dry run)`
  }

  if (status === "succeeded") {
    return `Execution succeeded for "${cardTitle}" (dry run)`
  }

  return `Execution failed for "${cardTitle}" (dry run)`
}

function moveInArray<T>(items: T[], fromIndex: number, toIndex: number) {
  const next = [...items]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return next
}

function clamp(value: number, min: number, max: number) {
  if (value < min) {
    return min
  }

  if (value > max) {
    return max
  }

  return value
}

async function getPrimaryBoard(
  getBoards: () => Promise<Doc<"boards">[]>
) {
  const boards = await getBoards()

  if (boards.length === 0) {
    return null
  }

  return boards.sort((a, b) => a.createdAt - b.createdAt)[0]
}

export const ensureBoard = mutation({
  args: {},
  handler: async (ctx) => {
    const existingBoard = await getPrimaryBoard(() =>
      ctx.db.query("boards").collect()
    )

    if (existingBoard) {
      return existingBoard._id
    }

    const now = Date.now()
    const boardId = await ctx.db.insert("boards", {
      name: "Milestone 2 Board",
      createdAt: now,
      updatedAt: now,
    })

    const columnIdsByTitle = new Map<string, Id<"columns">>()

    for (const [index, title] of DEFAULT_COLUMNS.entries()) {
      const columnId = await ctx.db.insert("columns", {
        boardId,
        title,
        order: index,
        createdAt: now,
        updatedAt: now,
      })
      columnIdsByTitle.set(title, columnId)
    }

    const cardsInColumn = new Map<string, number>()

    for (const card of DEFAULT_CARDS) {
      const columnId = columnIdsByTitle.get(card.column)

      if (!columnId) {
        continue
      }

      const order = cardsInColumn.get(card.column) ?? 0

      await ctx.db.insert("cards", {
        boardId,
        columnId,
        title: card.title,
        order,
        createdAt: now,
        updatedAt: now,
      })

      cardsInColumn.set(card.column, order + 1)
    }

    return boardId
  },
})

export const getBoard = query({
  args: {},
  handler: async (ctx) => {
    const board = await getPrimaryBoard(() => ctx.db.query("boards").collect())

    if (!board) {
      return null
    }

    const [columns, cards, activities, executions] = await Promise.all([
      ctx.db
        .query("columns")
        .withIndex("by_board_order", (q) => q.eq("boardId", board._id))
        .collect(),
      ctx.db
        .query("cards")
        .withIndex("by_board", (q) => q.eq("boardId", board._id))
        .collect(),
      ctx.db
        .query("activities")
        .withIndex("by_board_createdAt", (q) => q.eq("boardId", board._id))
        .order("desc")
        .take(25),
      ctx.db
        .query("executions")
        .withIndex("by_board", (q) => q.eq("boardId", board._id))
        .collect(),
    ])

    const cardsByColumn = new Map<Id<"columns">, Doc<"cards">[]>()
    const latestExecutionByCard = new Map<Id<"cards">, Doc<"executions">>()

    for (const card of cards) {
      const existingCards = cardsByColumn.get(card.columnId) ?? []
      existingCards.push(card)
      cardsByColumn.set(card.columnId, existingCards)
    }

    for (const execution of executions) {
      const existingExecution = latestExecutionByCard.get(execution.cardId)

      if (!existingExecution || execution.createdAt > existingExecution.createdAt) {
        latestExecutionByCard.set(execution.cardId, execution)
      }
    }

    return {
      board,
      columns: columns.map((column) => ({
        ...column,
        cards: (cardsByColumn.get(column._id) ?? [])
          .sort((a, b) => a.order - b.order)
          .map((card) => {
            const execution = latestExecutionByCard.get(card._id)

            if (!execution) {
              return card
            }

            return {
              ...card,
              execution: {
                _id: execution._id,
                mode: execution.mode,
                status: execution.status,
                updatedAt: execution.updatedAt,
              },
            }
          }),
      })),
      activities,
    }
  },
})

export const moveColumn = mutation({
  args: {
    boardId: v.id("boards"),
    columnId: v.id("columns"),
    toIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const columns = await ctx.db
      .query("columns")
      .withIndex("by_board_order", (q) => q.eq("boardId", args.boardId))
      .collect()

    const fromIndex = columns.findIndex((column) => column._id === args.columnId)

    if (fromIndex === -1) {
      return
    }

    const toIndex = clamp(args.toIndex, 0, columns.length - 1)

    if (fromIndex === toIndex) {
      return
    }

    const now = Date.now()
    const reordered = moveInArray(columns, fromIndex, toIndex)

    for (const [index, column] of reordered.entries()) {
      if (column.order === index) {
        continue
      }

      await ctx.db.patch(column._id, {
        order: index,
        updatedAt: now,
      })
    }

    await ctx.db.patch(args.boardId, {
      updatedAt: now,
    })

    const movedColumn = reordered[toIndex]

    await ctx.db.insert("activities", {
      boardId: args.boardId,
      type: "column_moved",
      message: `Moved column "${movedColumn.title}"`,
      columnId: movedColumn._id,
      fromIndex,
      toIndex,
      createdAt: now,
    })
  },
})

export const moveCard = mutation({
  args: {
    boardId: v.id("boards"),
    cardId: v.id("cards"),
    sourceColumnId: v.id("columns"),
    targetColumnId: v.id("columns"),
    toIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const [card, sourceColumn, targetColumn] = await Promise.all([
      ctx.db.get(args.cardId),
      ctx.db.get(args.sourceColumnId),
      ctx.db.get(args.targetColumnId),
    ])

    if (!card || card.boardId !== args.boardId) {
      return
    }

    if (
      !sourceColumn ||
      sourceColumn.boardId !== args.boardId ||
      !targetColumn ||
      targetColumn.boardId !== args.boardId
    ) {
      return
    }

    const sourceCards = await ctx.db
      .query("cards")
      .withIndex("by_column_order", (q) => q.eq("columnId", args.sourceColumnId))
      .collect()

    const fromIndex = sourceCards.findIndex((currentCard) => currentCard._id === card._id)

    if (fromIndex === -1) {
      return
    }

    const now = Date.now()

    if (args.sourceColumnId === args.targetColumnId) {
      const toIndex = clamp(args.toIndex, 0, sourceCards.length - 1)

      if (fromIndex === toIndex) {
        return
      }

      const reordered = moveInArray(sourceCards, fromIndex, toIndex)

      for (const [index, currentCard] of reordered.entries()) {
        if (currentCard.order === index) {
          continue
        }

        await ctx.db.patch(currentCard._id, {
          order: index,
          updatedAt: now,
        })
      }

      await ctx.db.patch(args.boardId, {
        updatedAt: now,
      })

      await ctx.db.insert("activities", {
        boardId: args.boardId,
        type: "card_moved",
        message: `Reordered card "${card.title}" in "${sourceColumn.title}"`,
        cardId: card._id,
        fromColumnId: args.sourceColumnId,
        toColumnId: args.targetColumnId,
        fromIndex,
        toIndex,
        createdAt: now,
      })

      return
    }

    const targetCards = await ctx.db
      .query("cards")
      .withIndex("by_column_order", (q) => q.eq("columnId", args.targetColumnId))
      .collect()

    const toIndex = clamp(args.toIndex, 0, targetCards.length)
    const sourceWithoutMovedCard = sourceCards.filter(
      (currentCard) => currentCard._id !== card._id
    )
    const targetWithMovedCard = [...targetCards]
    targetWithMovedCard.splice(toIndex, 0, card)

    for (const [index, currentCard] of sourceWithoutMovedCard.entries()) {
      if (currentCard.order === index) {
        continue
      }

      await ctx.db.patch(currentCard._id, {
        order: index,
        updatedAt: now,
      })
    }

    for (const [index, currentCard] of targetWithMovedCard.entries()) {
      if (
        currentCard._id === card._id &&
        currentCard.columnId === args.targetColumnId &&
        currentCard.order === index
      ) {
        continue
      }

      if (currentCard._id !== card._id && currentCard.order === index) {
        continue
      }

      await ctx.db.patch(currentCard._id, {
        columnId: currentCard._id === card._id ? args.targetColumnId : currentCard.columnId,
        order: index,
        updatedAt: now,
      })
    }

    await ctx.db.patch(args.boardId, {
      updatedAt: now,
    })

    await ctx.db.insert("activities", {
      boardId: args.boardId,
      type: "card_moved",
      message: `Moved card "${card.title}" from "${sourceColumn.title}" to "${targetColumn.title}"`,
      cardId: card._id,
      fromColumnId: args.sourceColumnId,
      toColumnId: args.targetColumnId,
      fromIndex,
      toIndex,
      createdAt: now,
    })

    if (targetColumn.title !== IN_PROGRESS_COLUMN_TITLE) {
      return
    }

    const queuedAt = Date.now()
    const executionId = await ctx.db.insert("executions", {
      boardId: args.boardId,
      cardId: card._id,
      mode: "dry_run",
      status: "queued",
      createdAt: queuedAt,
      updatedAt: queuedAt,
    })

    await ctx.db.insert("activities", {
      boardId: args.boardId,
      type: "execution_transition",
      message: getExecutionTransitionMessage("queued", card.title),
      cardId: card._id,
      executionId,
      executionStatus: "queued",
      fromIndex: 0,
      toIndex: 0,
      createdAt: queuedAt,
    })

    try {
      const runningAt = Date.now()
      await ctx.db.patch(executionId, {
        status: "running",
        startedAt: runningAt,
        updatedAt: runningAt,
      })

      await ctx.db.insert("activities", {
        boardId: args.boardId,
        type: "execution_transition",
        message: getExecutionTransitionMessage("running", card.title),
        cardId: card._id,
        executionId,
        executionStatus: "running",
        fromIndex: 0,
        toIndex: 0,
        createdAt: runningAt,
      })

      const succeededAt = Date.now()
      await ctx.db.patch(executionId, {
        status: "succeeded",
        completedAt: succeededAt,
        updatedAt: succeededAt,
      })

      await ctx.db.insert("activities", {
        boardId: args.boardId,
        type: "execution_transition",
        message: getExecutionTransitionMessage("succeeded", card.title),
        cardId: card._id,
        executionId,
        executionStatus: "succeeded",
        fromIndex: 0,
        toIndex: 0,
        createdAt: succeededAt,
      })
    } catch (error) {
      const failedAt = Date.now()
      const executionError = error instanceof Error ? error.message : "Unknown execution error"

      await ctx.db.patch(executionId, {
        status: "failed",
        error: executionError,
        completedAt: failedAt,
        updatedAt: failedAt,
      })

      await ctx.db.insert("activities", {
        boardId: args.boardId,
        type: "execution_transition",
        message: getExecutionTransitionMessage("failed", card.title),
        cardId: card._id,
        executionId,
        executionStatus: "failed",
        fromIndex: 0,
        toIndex: 0,
        createdAt: failedAt,
      })
    }
  },
})
