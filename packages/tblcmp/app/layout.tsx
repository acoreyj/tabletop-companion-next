import type React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BoardGameGeek Chat",
  description: "Discuss your favorite board games with the community",
  generator: "v0.dev",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={cn(inter.className, "dark")}>
        <main className="min-h-screen">{children}</main>
      </body>
    </html>
  );
}

import "./globals.css";
