import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LoopCI",
  description: "AI-driven CI/CD repair loop dashboard"
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
