import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
  boards: defineTable({
    name: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_createdAt", ["createdAt"]),

  columns: defineTable({
    boardId: v.id("boards"),
    title: v.string(),
    order: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_board_order", ["boardId", "order"]),

  cards: defineTable({
    boardId: v.id("boards"),
    columnId: v.id("columns"),
    title: v.string(),
    description: v.optional(v.string()),
    order: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_board", ["boardId"])
    .index("by_column_order", ["columnId", "order"]),

  activities: defineTable({
    boardId: v.id("boards"),
    type: v.union(v.literal("card_moved"), v.literal("column_moved")),
    message: v.string(),
    cardId: v.optional(v.id("cards")),
    columnId: v.optional(v.id("columns")),
    fromColumnId: v.optional(v.id("columns")),
    toColumnId: v.optional(v.id("columns")),
    fromIndex: v.number(),
    toIndex: v.number(),
    createdAt: v.number(),
  }).index("by_board_createdAt", ["boardId", "createdAt"]),
})
