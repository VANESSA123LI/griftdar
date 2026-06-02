import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "griftdar — grifter radar",
  description:
    "Paste a LinkedIn profile URL and get a heuristic grifter red-flag score. For informational purposes only.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
