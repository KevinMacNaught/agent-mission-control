"use client"

import { ConvexProvider, ConvexReactClient } from "convex/react"
import { type ReactNode, useState } from "react"

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? "http://127.0.0.1:3210"

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => new ConvexReactClient(convexUrl))

  return <ConvexProvider client={client}>{children}</ConvexProvider>
}
