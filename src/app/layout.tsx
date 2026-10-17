import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Smart Campus Management System",
    template: "%s · Smart Campus",
  },
  description:
    "Centralised college administration, academics, student services and automation.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
