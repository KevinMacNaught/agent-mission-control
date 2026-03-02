import { v } from "convex/values"

import { internalMutation, internalQuery, mutation, query } from "./_generated/server"
import { internal } from "./_generated/api.js"
import type { Doc, Id } from "./_generated/dataModel"

const DEFAULT_COLUMNS = ["Backlog", "In Progress", "Done"] as const
const DEFAULT_CARDS = [
  { title: "Refine Milestone 2 scope", column: "Backlog" },
  { title: "Wire Convex board schema", column: "In Progress" },
  { title: "Ship drag and drop MVP", column: "Done" },
] as const

const IN_PROGRESS_COLUMN_TITLE = "In Progress" as const
const DONE_COLUMN_TITLE = "Done" as const

type ExecutionStatus = "queued" | "running" | "succeeded" | "failed"

function getExecutionTransitionMessage(status: ExecutionStatus, cardTitle: string) {
  if (status === "queued") return `Execution queued for "${cardTitle}"`
  if (status === "running") return `Execution running for "${cardTitle}"`
  if (status === "succeeded") return `Execution succeeded for "${cardTitle}"`
  return `Execution failed for "${cardTitle}"`
}

function moveInArray<T>(items: T[], fromIndex: number, toIndex: number) {
  const next = [...items]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return next
}

function clamp(value: number, min: number, max: number) {
  if (value < min) return min
  if (value > max) return max
  return value
}

async function getPrimaryBoard(getBoards: () => Promise<Doc<"boards">[]>) {
  const boards = await getBoards()
  if (boards.length === 0) return null
  return boards.sort((a, b) => a.createdAt - b.createdAt)[0]
}


export const ensureBoard = mutation({
  args: {},
  handler: async (ctx) => {
    const existingBoard = await getPrimaryBoard(() => ctx.db.query("boards").collect())
    if (existingBoard) return existingBoard._id

    const now = Date.now()
    const boardId = await ctx.db.insert("boards", { name: "Milestone 2 Board", createdAt: now, updatedAt: now })

    const columnIdsByTitle = new Map<string, Id<"columns">>()
    for (const [index, title] of DEFAULT_COLUMNS.entries()) {
      const columnId = await ctx.db.insert("columns", { boardId, title, order: index, createdAt: now, updatedAt: now })
      columnIdsByTitle.set(title, columnId)
    }

    const cardsInColumn = new Map<string, number>()
    for (const card of DEFAULT_CARDS) {
      const columnId = columnIdsByTitle.get(card.column)
      if (!columnId) continue
      const order = cardsInColumn.get(card.column) ?? 0
      await ctx.db.insert("cards", { boardId, columnId, title: card.title, order, createdAt: now, updatedAt: now })
      cardsInColumn.set(card.column, order + 1)
    }

    return boardId
  },
})

export const getBoard = query({
  args: {},
  handler: async (ctx) => {
    const board = await getPrimaryBoard(() => ctx.db.query("boards").collect())
    if (!board) return null

    const [columns, cards, activities, executions] = await Promise.all([
      ctx.db.query("columns").withIndex("by_board_order", (q) => q.eq("boardId", board._id)).collect(),
      ctx.db.query("cards").withIndex("by_board", (q) => q.eq("boardId", board._id)).collect(),
      ctx.db.query("activities").withIndex("by_board_createdAt", (q) => q.eq("boardId", board._id)).order("desc").take(25),
      ctx.db.query("executions").withIndex("by_board", (q) => q.eq("boardId", board._id)).collect(),
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
        cards: (cardsByColumn.get(column._id) ?? []).sort((a, b) => a.order - b.order).map((card) => {
          const execution = latestExecutionByCard.get(card._id)
          if (!execution) return card
          return {
            ...card,
            execution: {
              _id: execution._id,
              mode: execution.mode,
              status: execution.status,
              updatedAt: execution.updatedAt,
              error: execution.error,
              runId: execution.runId,
              sessionKey: execution.sessionKey,
              runLastUpdateAt: execution.runLastUpdateAt,
              taskPrompt: execution.taskPrompt,
            },
          }
        }),
      })),
      activities,
    }
  },
})

export const moveColumn = mutation({
  args: { boardId: v.id("boards"), columnId: v.id("columns"), toIndex: v.number() },
  handler: async (ctx, args) => {
    const columns = await ctx.db.query("columns").withIndex("by_board_order", (q) => q.eq("boardId", args.boardId)).collect()
    const fromIndex = columns.findIndex((column) => column._id === args.columnId)
    if (fromIndex === -1) return
    const toIndex = clamp(args.toIndex, 0, columns.length - 1)
    if (fromIndex === toIndex) return

    const now = Date.now()
    const reordered = moveInArray(columns, fromIndex, toIndex)
    for (const [index, column] of reordered.entries()) {
      if (column.order === index) continue
      await ctx.db.patch(column._id, { order: index, updatedAt: now })
    }

    await ctx.db.patch(args.boardId, { updatedAt: now })

    await ctx.db.insert("activities", {
      boardId: args.boardId,
      type: "column_moved",
      message: `Moved column "${reordered[toIndex].title}"`,
      columnId: reordered[toIndex]._id,
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
    if (!card || card.boardId !== args.boardId) return
    if (!sourceColumn || sourceColumn.boardId !== args.boardId || !targetColumn || targetColumn.boardId !== args.boardId) return

    const sourceCards = await ctx.db.query("cards").withIndex("by_column_order", (q) => q.eq("columnId", args.sourceColumnId)).collect()
    const fromIndex = sourceCards.findIndex((currentCard) => currentCard._id === card._id)
    if (fromIndex === -1) return

    const now = Date.now()

    if (args.sourceColumnId === args.targetColumnId) {
      const toIndex = clamp(args.toIndex, 0, sourceCards.length - 1)
      if (fromIndex === toIndex) return
      const reordered = moveInArray(sourceCards, fromIndex, toIndex)
      for (const [index, currentCard] of reordered.entries()) {
        if (currentCard.order === index) continue
        await ctx.db.patch(currentCard._id, { order: index, updatedAt: now })
      }
      await ctx.db.patch(args.boardId, { updatedAt: now })
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

    const targetCards = await ctx.db.query("cards").withIndex("by_column_order", (q) => q.eq("columnId", args.targetColumnId)).collect()
    const toIndex = clamp(args.toIndex, 0, targetCards.length)
    const sourceWithoutMovedCard = sourceCards.filter((currentCard) => currentCard._id !== card._id)
    const targetWithMovedCard = [...targetCards]
    targetWithMovedCard.splice(toIndex, 0, card)

    for (const [index, currentCard] of sourceWithoutMovedCard.entries()) {
      if (currentCard.order === index) continue
      await ctx.db.patch(currentCard._id, { order: index, updatedAt: now })
    }

    for (const [index, currentCard] of targetWithMovedCard.entries()) {
      if (currentCard._id === card._id && currentCard.columnId === args.targetColumnId && currentCard.order === index) continue
      if (currentCard._id !== card._id && currentCard.order === index) continue
      await ctx.db.patch(currentCard._id, {
        columnId: currentCard._id === card._id ? args.targetColumnId : currentCard.columnId,
        order: index,
        updatedAt: now,
      })
    }

    await ctx.db.patch(args.boardId, { updatedAt: now })
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
  },
})

export const startCardExecution = mutation({
  args: { boardId: v.id("boards"), cardId: v.id("cards") },
  handler: async (ctx, args) => {
    const card = await ctx.db.get(args.cardId)
    if (!card || card.boardId !== args.boardId) return null

    const inProgressColumn = (
      await ctx.db
        .query("columns")
        .withIndex("by_board_order", (q) => q.eq("boardId", args.boardId))
        .collect()
    ).find((column) => column.title === IN_PROGRESS_COLUMN_TITLE)
    if (!inProgressColumn) return null

    if (card.columnId !== inProgressColumn._id) {
      const inProgressCards = await ctx.db.query("cards").withIndex("by_column_order", (q) => q.eq("columnId", inProgressColumn._id)).collect()
      const sourceCards = await ctx.db.query("cards").withIndex("by_column_order", (q) => q.eq("columnId", card.columnId)).collect()
      const now = Date.now()
      const sourceWithoutMovedCard = sourceCards.filter((c) => c._id !== card._id)
      for (const [index, currentCard] of sourceWithoutMovedCard.entries()) {
        if (currentCard.order === index) continue
        await ctx.db.patch(currentCard._id, { order: index, updatedAt: now })
      }
      await ctx.db.patch(card._id, { columnId: inProgressColumn._id, order: inProgressCards.length, updatedAt: now })
    }

    const queuedAt = Date.now()
    const executionId = await ctx.db.insert("executions", {
      boardId: args.boardId,
      cardId: card._id,
      mode: "openclaw_agent",
      status: "queued",
      runId: crypto.randomUUID(),
      sessionKey: "agent:main:main",
      taskPrompt: card.title,
      runLastUpdateAt: queuedAt,
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

    await ctx.scheduler.runAfter(0, internal.kanbanNode.executeOpenClawRun, {
      executionId,
    })

    return executionId
  },
})

export const createTaskCardAndStart = mutation({
  args: { task: v.string() },
  handler: async (ctx, args) => {
    const board = await getPrimaryBoard(() => ctx.db.query("boards").collect())
    if (!board) return null
    const inProgressColumn = (
      await ctx.db
        .query("columns")
        .withIndex("by_board_order", (q) => q.eq("boardId", board._id))
        .collect()
    ).find((column) => column.title === IN_PROGRESS_COLUMN_TITLE)
    if (!inProgressColumn) return null

    const columnCards = await ctx.db.query("cards").withIndex("by_column_order", (q) => q.eq("columnId", inProgressColumn._id)).collect()
    const now = Date.now()
    const cardId = await ctx.db.insert("cards", {
      boardId: board._id,
      columnId: inProgressColumn._id,
      title: args.task,
      order: columnCards.length,
      createdAt: now,
      updatedAt: now,
    })

    await ctx.db.insert("activities", {
      boardId: board._id,
      type: "card_moved",
      message: `Created task card "${args.task}" in "${IN_PROGRESS_COLUMN_TITLE}"`,
      cardId,
      fromIndex: 0,
      toIndex: columnCards.length,
      createdAt: now,
    })

    const queuedAt = Date.now()
    const executionId = await ctx.db.insert("executions", {
      boardId: board._id,
      cardId,
      mode: "openclaw_agent",
      status: "queued",
      runId: crypto.randomUUID(),
      sessionKey: "agent:main:main",
      taskPrompt: args.task,
      runLastUpdateAt: queuedAt,
      createdAt: queuedAt,
      updatedAt: queuedAt,
    })

    await ctx.db.insert("activities", {
      boardId: board._id,
      type: "execution_transition",
      message: getExecutionTransitionMessage("queued", args.task),
      cardId,
      executionId,
      executionStatus: "queued",
      fromIndex: 0,
      toIndex: 0,
      createdAt: queuedAt,
    })

    await ctx.scheduler.runAfter(0, internal.kanbanNode.executeOpenClawRun, {
      executionId,
    })

    return { boardId: board._id, cardId, executionId }
  },
})

export const retryExecution = mutation({
  args: { boardId: v.id("boards"), cardId: v.id("cards") },
  handler: async (ctx, args) => {
    const card = await ctx.db.get(args.cardId)
    if (!card || card.boardId !== args.boardId) return null
    const queuedAt = Date.now()
    const executionId = await ctx.db.insert("executions", {
      boardId: args.boardId,
      cardId: args.cardId,
      mode: "openclaw_agent",
      status: "queued",
      runId: crypto.randomUUID(),
      sessionKey: "agent:main:main",
      taskPrompt: card.title,
      runLastUpdateAt: queuedAt,
      createdAt: queuedAt,
      updatedAt: queuedAt,
    })

    await ctx.db.insert("activities", {
      boardId: args.boardId,
      type: "execution_transition",
      message: getExecutionTransitionMessage("queued", card.title),
      cardId: args.cardId,
      executionId,
      executionStatus: "queued",
      fromIndex: 0,
      toIndex: 0,
      createdAt: queuedAt,
    })

    await ctx.scheduler.runAfter(0, internal.kanbanNode.executeOpenClawRun, {
      executionId,
    })

    return executionId
  },
})

export const markExecutionRunning = internalMutation({
  args: { executionId: v.id("executions"), runId: v.string(), sessionKey: v.string() },
  handler: async (ctx, args) => {
    const execution = await ctx.db.get(args.executionId)
    if (!execution) return
    const now = Date.now()
    const card = await ctx.db.get(execution.cardId)
    await ctx.db.patch(args.executionId, {
      status: "running",
      startedAt: now,
      runId: args.runId,
      sessionKey: args.sessionKey,
      runLastUpdateAt: now,
      updatedAt: now,
    })
    await ctx.db.insert("activities", {
      boardId: execution.boardId,
      type: "execution_transition",
      message: getExecutionTransitionMessage("running", card?.title ?? "Task"),
      cardId: execution.cardId,
      executionId: execution._id,
      executionStatus: "running",
      fromIndex: 0,
      toIndex: 0,
      createdAt: now,
    })
  },
})

export const markExecutionSucceeded = internalMutation({
  args: { executionId: v.id("executions") },
  handler: async (ctx, args) => {
    const execution = await ctx.db.get(args.executionId)
    if (!execution) return
    const card = await ctx.db.get(execution.cardId)
    const doneColumn = (
      await ctx.db
        .query("columns")
        .withIndex("by_board_order", (q) => q.eq("boardId", execution.boardId))
        .collect()
    ).find((column) => column.title === DONE_COLUMN_TITLE)
    const now = Date.now()

    await ctx.db.patch(args.executionId, {
      status: "succeeded",
      completedAt: now,
      runLastUpdateAt: now,
      updatedAt: now,
      error: undefined,
    })

    if (doneColumn && card) {
      const doneCards = await ctx.db.query("cards").withIndex("by_column_order", (q) => q.eq("columnId", doneColumn._id)).collect()
      const sourceCards = await ctx.db.query("cards").withIndex("by_column_order", (q) => q.eq("columnId", card.columnId)).collect()
      const sourceWithoutMovedCard = sourceCards.filter((c) => c._id !== card._id)
      for (const [index, currentCard] of sourceWithoutMovedCard.entries()) {
        if (currentCard.order === index) continue
        await ctx.db.patch(currentCard._id, { order: index, updatedAt: now })
      }
      await ctx.db.patch(card._id, { columnId: doneColumn._id, order: doneCards.length, updatedAt: now })
    }

    await ctx.db.insert("activities", {
      boardId: execution.boardId,
      type: "execution_transition",
      message: getExecutionTransitionMessage("succeeded", card?.title ?? "Task"),
      cardId: execution.cardId,
      executionId: execution._id,
      executionStatus: "succeeded",
      fromIndex: 0,
      toIndex: 0,
      createdAt: now,
    })
  },
})

export const markExecutionFailed = internalMutation({
  args: { executionId: v.id("executions"), error: v.string() },
  handler: async (ctx, args) => {
    const execution = await ctx.db.get(args.executionId)
    if (!execution) return
    const card = await ctx.db.get(execution.cardId)
    const now = Date.now()
    await ctx.db.patch(args.executionId, {
      status: "failed",
      error: args.error,
      completedAt: now,
      runLastUpdateAt: now,
      updatedAt: now,
    })

    await ctx.db.insert("activities", {
      boardId: execution.boardId,
      type: "execution_transition",
      message: getExecutionTransitionMessage("failed", card?.title ?? "Task"),
      cardId: execution.cardId,
      executionId: execution._id,
      executionStatus: "failed",
      fromIndex: 0,
      toIndex: 0,
      createdAt: now,
    })
  },
})

export const getExecutionForRun = internalQuery({
  args: { executionId: v.id("executions") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.executionId)
  },
})
