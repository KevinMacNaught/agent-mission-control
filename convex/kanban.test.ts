import assert from "node:assert/strict"
import test from "node:test"

import { moveCard, moveColumn } from "./kanban.ts"

type TableName = "boards" | "columns" | "cards" | "activities"
type Row = { _id: string; [key: string]: unknown }

const TABLES: TableName[] = ["boards", "columns", "cards", "activities"]
const NOW = 1_730_000_000_000

class InMemoryDb {
  private tables: Record<TableName, Row[]>
  private sequence = 1

  constructor(seed: Record<TableName, Row[]>) {
    this.tables = {
      boards: seed.boards.map((row) => ({ ...row })),
      columns: seed.columns.map((row) => ({ ...row })),
      cards: seed.cards.map((row) => ({ ...row })),
      activities: seed.activities.map((row) => ({ ...row })),
    }
  }

  query(table: TableName) {
    return {
      withIndex: (
        indexName: string,
        applyIndex: (query: { eq: (field: string, value: unknown) => unknown }) => unknown
      ) => {
        let filterField: string | null = null
        let filterValue: unknown
        const queryBuilder = {
          eq: (field: string, value: unknown) => {
            filterField = field
            filterValue = value
            return queryBuilder
          },
        }
        applyIndex(queryBuilder)

        return {
          collect: async () => this.collect(table, indexName, filterField, filterValue),
        }
      },
    }
  }

  async get(id: string) {
    for (const tableName of TABLES) {
      const row = this.tables[tableName].find((currentRow) => currentRow._id === id)
      if (row) {
        return { ...row }
      }
    }
    return null
  }

  async patch(id: string, patch: Record<string, unknown>) {
    for (const tableName of TABLES) {
      const index = this.tables[tableName].findIndex((row) => row._id === id)
      if (index === -1) {
        continue
      }

      this.tables[tableName][index] = {
        ...this.tables[tableName][index],
        ...patch,
      }
      return
    }

    throw new Error(`Unknown record id: ${id}`)
  }

  async insert(table: TableName, value: Record<string, unknown>) {
    const id = `${table}-${this.sequence}`
    this.sequence += 1
    this.tables[table].push({
      _id: id,
      ...value,
    })
    return id
  }

  rows(table: TableName) {
    return this.tables[table].map((row) => ({ ...row }))
  }

  private collect(
    table: TableName,
    indexName: string,
    filterField: string | null,
    filterValue: unknown
  ) {
    const rows = this.tables[table]
      .filter((row) => (filterField === null ? true : row[filterField] === filterValue))
      .map((row) => ({ ...row }))

    if (indexName === "by_board_order" || indexName === "by_column_order") {
      rows.sort((a, b) => Number(a.order) - Number(b.order))
    }

    return rows
  }
}

type Fixture = ReturnType<typeof createFixture>

const moveColumnHandler = (moveColumn as { handler: (ctx: unknown, args: unknown) => Promise<void> })
  .handler
const moveCardHandler = (moveCard as { handler: (ctx: unknown, args: unknown) => Promise<void> }).handler

function createFixture(
  seedCards: {
    backlog: string[]
    inProgress: string[]
    done: string[]
  } = {
    backlog: ["Card 1", "Card 2", "Card 3"],
    inProgress: ["Card 4", "Card 5"],
    done: [],
  }
) {
  const ids = {
    board: "board-1",
    columns: {
      backlog: "column-backlog",
      inProgress: "column-in-progress",
      done: "column-done",
    },
    cards: {
      card1: "card-1",
      card2: "card-2",
      card3: "card-3",
      card4: "card-4",
      card5: "card-5",
    },
  }

  const now = 1
  const cards: Row[] = []
  const cardIdsByTitle = new Map<string, string>()

  for (const [columnName, titles] of Object.entries(seedCards) as Array<
    [keyof typeof seedCards, string[]]
  >) {
    const columnId =
      columnName === "backlog"
        ? ids.columns.backlog
        : columnName === "inProgress"
          ? ids.columns.inProgress
          : ids.columns.done

    for (const [order, title] of titles.entries()) {
      const cardId = ids.cards[`card${cards.length + 1}` as keyof typeof ids.cards]
      cards.push({
        _id: cardId,
        boardId: ids.board,
        columnId,
        title,
        order,
        createdAt: now,
        updatedAt: now,
      })
      cardIdsByTitle.set(title, cardId)
    }
  }

  const db = new InMemoryDb({
    boards: [
      {
        _id: ids.board,
        name: "Milestone 2 Board",
        createdAt: now,
        updatedAt: now,
      },
    ],
    columns: [
      {
        _id: ids.columns.backlog,
        boardId: ids.board,
        title: "Backlog",
        order: 0,
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: ids.columns.inProgress,
        boardId: ids.board,
        title: "In Progress",
        order: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: ids.columns.done,
        boardId: ids.board,
        title: "Done",
        order: 2,
        createdAt: now,
        updatedAt: now,
      },
    ],
    cards,
    activities: [],
  })

  return {
    db,
    ids,
    cardIdsByTitle,
    ctx: { db },
  }
}

function columnsInOrder(fixture: Fixture) {
  return fixture.db
    .rows("columns")
    .sort((a, b) => Number(a.order) - Number(b.order))
    .map((column) => ({
      id: column._id,
      order: Number(column.order),
      title: String(column.title),
    }))
}

function cardsInColumn(fixture: Fixture, columnId: string) {
  return fixture.db
    .rows("cards")
    .filter((card) => card.columnId === columnId)
    .sort((a, b) => Number(a.order) - Number(b.order))
    .map((card) => ({
      id: card._id,
      order: Number(card.order),
      columnId: String(card.columnId),
      title: String(card.title),
    }))
}

function activities(fixture: Fixture) {
  return fixture.db.rows("activities")
}

async function withFixedNow(run: () => Promise<void>) {
  const originalNow = Date.now
  Date.now = () => NOW
  try {
    await run()
  } finally {
    Date.now = originalNow
  }
}

test("moveColumn reorder keeps contiguous ordering and records activity", async () => {
  const fixture = createFixture()

  await withFixedNow(async () => {
    await moveColumnHandler(fixture.ctx, {
      boardId: fixture.ids.board,
      columnId: fixture.ids.columns.backlog,
      toIndex: 2,
    })
  })

  assert.deepEqual(columnsInOrder(fixture), [
    { id: fixture.ids.columns.inProgress, order: 0, title: "In Progress" },
    { id: fixture.ids.columns.done, order: 1, title: "Done" },
    { id: fixture.ids.columns.backlog, order: 2, title: "Backlog" },
  ])

  const [activity] = activities(fixture)
  assert.equal(activity.type, "column_moved")
  assert.equal(activity.message, 'Moved column "Backlog"')
  assert.equal(activity.fromIndex, 0)
  assert.equal(activity.toIndex, 2)
  assert.equal(activity.createdAt, NOW)
})

test("moveColumn clamps toIndex to valid range", async () => {
  const fixture = createFixture()

  await withFixedNow(async () => {
    await moveColumnHandler(fixture.ctx, {
      boardId: fixture.ids.board,
      columnId: fixture.ids.columns.inProgress,
      toIndex: 99,
    })
  })

  assert.deepEqual(columnsInOrder(fixture), [
    { id: fixture.ids.columns.backlog, order: 0, title: "Backlog" },
    { id: fixture.ids.columns.done, order: 1, title: "Done" },
    { id: fixture.ids.columns.inProgress, order: 2, title: "In Progress" },
  ])

  const [activity] = activities(fixture)
  assert.equal(activity.fromIndex, 1)
  assert.equal(activity.toIndex, 2)
})

test("moveCard same-column reorder updates order and records activity", async () => {
  const fixture = createFixture({
    backlog: ["Card 1", "Card 2", "Card 3"],
    inProgress: [],
    done: [],
  })
  const cardId = fixture.cardIdsByTitle.get("Card 1")
  assert.ok(cardId)

  await withFixedNow(async () => {
    await moveCardHandler(fixture.ctx, {
      boardId: fixture.ids.board,
      cardId,
      sourceColumnId: fixture.ids.columns.backlog,
      targetColumnId: fixture.ids.columns.backlog,
      toIndex: 2,
    })
  })

  assert.deepEqual(cardsInColumn(fixture, fixture.ids.columns.backlog), [
    { id: fixture.cardIdsByTitle.get("Card 2"), order: 0, columnId: fixture.ids.columns.backlog, title: "Card 2" },
    { id: fixture.cardIdsByTitle.get("Card 3"), order: 1, columnId: fixture.ids.columns.backlog, title: "Card 3" },
    { id: fixture.cardIdsByTitle.get("Card 1"), order: 2, columnId: fixture.ids.columns.backlog, title: "Card 1" },
  ])

  const [activity] = activities(fixture)
  assert.equal(activity.type, "card_moved")
  assert.equal(activity.message, 'Reordered card "Card 1" in "Backlog"')
  assert.equal(activity.fromColumnId, fixture.ids.columns.backlog)
  assert.equal(activity.toColumnId, fixture.ids.columns.backlog)
  assert.equal(activity.fromIndex, 0)
  assert.equal(activity.toIndex, 2)
  assert.equal(activity.createdAt, NOW)
})

test("moveCard cross-column move reorders both columns and records activity", async () => {
  const fixture = createFixture({
    backlog: ["Card 1", "Card 2"],
    inProgress: ["Card 3", "Card 4"],
    done: [],
  })
  const cardId = fixture.cardIdsByTitle.get("Card 2")
  assert.ok(cardId)

  await withFixedNow(async () => {
    await moveCardHandler(fixture.ctx, {
      boardId: fixture.ids.board,
      cardId,
      sourceColumnId: fixture.ids.columns.backlog,
      targetColumnId: fixture.ids.columns.inProgress,
      toIndex: 1,
    })
  })

  assert.deepEqual(cardsInColumn(fixture, fixture.ids.columns.backlog), [
    { id: fixture.cardIdsByTitle.get("Card 1"), order: 0, columnId: fixture.ids.columns.backlog, title: "Card 1" },
  ])
  assert.deepEqual(cardsInColumn(fixture, fixture.ids.columns.inProgress), [
    { id: fixture.cardIdsByTitle.get("Card 3"), order: 0, columnId: fixture.ids.columns.inProgress, title: "Card 3" },
    { id: fixture.cardIdsByTitle.get("Card 2"), order: 1, columnId: fixture.ids.columns.inProgress, title: "Card 2" },
    { id: fixture.cardIdsByTitle.get("Card 4"), order: 2, columnId: fixture.ids.columns.inProgress, title: "Card 4" },
  ])

  const [activity] = activities(fixture)
  assert.equal(activity.type, "card_moved")
  assert.equal(
    activity.message,
    'Moved card "Card 2" from "Backlog" to "In Progress"'
  )
  assert.equal(activity.fromIndex, 1)
  assert.equal(activity.toIndex, 1)
})

test("moveCard can move to an empty target column", async () => {
  const fixture = createFixture({
    backlog: ["Card 1", "Card 2"],
    inProgress: [],
    done: [],
  })
  const cardId = fixture.cardIdsByTitle.get("Card 2")
  assert.ok(cardId)

  await withFixedNow(async () => {
    await moveCardHandler(fixture.ctx, {
      boardId: fixture.ids.board,
      cardId,
      sourceColumnId: fixture.ids.columns.backlog,
      targetColumnId: fixture.ids.columns.done,
      toIndex: 99,
    })
  })

  assert.deepEqual(cardsInColumn(fixture, fixture.ids.columns.backlog), [
    { id: fixture.cardIdsByTitle.get("Card 1"), order: 0, columnId: fixture.ids.columns.backlog, title: "Card 1" },
  ])
  assert.deepEqual(cardsInColumn(fixture, fixture.ids.columns.done), [
    { id: fixture.cardIdsByTitle.get("Card 2"), order: 0, columnId: fixture.ids.columns.done, title: "Card 2" },
  ])

  const [activity] = activities(fixture)
  assert.equal(activity.toIndex, 0)
})

test("moveCard clamps negative toIndex for same-column reorder", async () => {
  const fixture = createFixture({
    backlog: ["Card 1", "Card 2", "Card 3"],
    inProgress: [],
    done: [],
  })
  const cardId = fixture.cardIdsByTitle.get("Card 3")
  assert.ok(cardId)

  await withFixedNow(async () => {
    await moveCardHandler(fixture.ctx, {
      boardId: fixture.ids.board,
      cardId,
      sourceColumnId: fixture.ids.columns.backlog,
      targetColumnId: fixture.ids.columns.backlog,
      toIndex: -10,
    })
  })

  assert.deepEqual(cardsInColumn(fixture, fixture.ids.columns.backlog), [
    { id: fixture.cardIdsByTitle.get("Card 3"), order: 0, columnId: fixture.ids.columns.backlog, title: "Card 3" },
    { id: fixture.cardIdsByTitle.get("Card 1"), order: 1, columnId: fixture.ids.columns.backlog, title: "Card 1" },
    { id: fixture.cardIdsByTitle.get("Card 2"), order: 2, columnId: fixture.ids.columns.backlog, title: "Card 2" },
  ])

  const [activity] = activities(fixture)
  assert.equal(activity.fromIndex, 2)
  assert.equal(activity.toIndex, 0)
})
