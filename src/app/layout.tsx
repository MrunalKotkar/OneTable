import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OneTable",
  description: "A memory-powered group dining agent.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

