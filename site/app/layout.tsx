import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0055FF",
};

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const metadataBase = new URL(`${protocol}://${host}`);

  return {
    metadataBase,
    title: "FinBro | Your overworked entry-level analyst.",
    description: "Give Ethan a ticker. He’ll read the filings, learn the sector, check the numbers, and prepare something you can send upstairs.",
    applicationName: "FinBro",
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title: "FinBro | Your overworked entry-level analyst.",
      description: "Give Ethan a ticker. Filing-backed, source-linked equity research with clear assumptions.",
      type: "website",
      locale: "zh_CN",
      images: [{ url: "/og.png", width: 1200, height: 630, alt: "FinBro — Your overworked entry-level analyst" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "FinBro | Your overworked entry-level analyst.",
      description: "Give Ethan a ticker. He’ll do the filing work.",
      images: ["/og.png"],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
