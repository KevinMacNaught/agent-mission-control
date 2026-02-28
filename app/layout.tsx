import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent Mission Control",
  description:
    "Milestone 0 shell scaffold with Next.js App Router, shadcn/ui, and the darkmatter theme.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
