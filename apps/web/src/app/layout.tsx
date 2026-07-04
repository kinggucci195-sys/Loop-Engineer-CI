import type { Metadata } from "next";
import { Urbanist } from "next/font/google";
import "./globals.css";

export const metadata: Metadata = {
  title: "LoopCI",
  description: "AI-driven CI/CD repair loop dashboard"
};

const urbanist = Urbanist({
  subsets: ["latin"],
  variable: "--font-urbanist",
  display: "swap"
});

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={urbanist.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
