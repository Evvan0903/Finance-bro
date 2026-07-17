import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#071827",
};

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const metadataBase = new URL(`${protocol}://${host}`);

  return {
    metadataBase,
    title: "ScopeLine｜行业感知研究 · Sector-Aware Research",
    description: "选择行业并输入公司或代码，生成中英文可切换、来源可追溯的机构级研究报告。 Select a sector and company to generate a bilingual, source-linked institutional research report.",
    applicationName: "ScopeLine",
    icons: {
      icon: "/favicon.png",
      shortcut: "/favicon.png",
    },
    openGraph: {
      title: "ScopeLine 行业感知研究 · Sector-Aware Research",
      description: "为能源与半导体公司生成中英文可切换、事实与假设分离、来源可追溯的研究报告。",
      type: "website",
      locale: "zh_CN",
      images: [{ url: "/og.png", width: 1200, height: 630, alt: "ScopeLine 行业感知研究 / Sector-Aware Research" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "ScopeLine 行业感知研究 · Sector-Aware Research",
      description: "Bilingual, sector-aware institutional research grounded in public filings and dated industry evidence.",
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
