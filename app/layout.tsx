import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tavern board — Daily Fire Emblem Discussions",
  description: "A warm, modern campfire for Fire Emblem questions, theories, replies, and reactions.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
