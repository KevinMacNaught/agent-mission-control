"use node"

import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { v } from "convex/values"

import { internalAction } from "./_generated/server"
import { internal } from "./_generated/api"

const execFileAsync = promisify(execFile)

export const executeOpenClawRun = internalAction({
  args: { executionId: v.id("executions") },
  handler: async (ctx, args) => {
    const execution = await ctx.runQuery(internal.kanban.getExecutionForRun, {
      executionId: args.executionId,
    })
    if (!execution) return

    const runId = execution.runId ?? crypto.randomUUID()
    const sessionKey = execution.sessionKey ?? "agent:main:main"

    await ctx.runMutation(internal.kanban.markExecutionRunning, {
      executionId: args.executionId,
      runId,
      sessionKey,
    })

    try {
      await execFileAsync(
        "openclaw",
        [
          "agent",
          "--agent",
          "main",
          "--message",
          execution.taskPrompt ?? "Run card task",
          "--json",
        ],
        { timeout: 1000 * 60 * 10 }
      )

      await ctx.runMutation(internal.kanban.markExecutionSucceeded, {
        executionId: args.executionId,
      })
    } catch (error) {
      await ctx.runMutation(internal.kanban.markExecutionFailed, {
        executionId: args.executionId,
        error: error instanceof Error ? error.message : "OpenClaw execution failed",
      })
    }
  },
})
