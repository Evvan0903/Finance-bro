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
    title: "ScopeLine｜机构研究台 · Institutional Research",
    description: "输入公司名，基于 SEC 公开申报生成中英文可切换、来源可追溯的机构研究报告。 Enter a company to generate a bilingual, source-linked institutional research report.",
    applicationName: "ScopeLine",
    icons: {
      icon: "/favicon.png",
      shortcut: "/favicon.png",
    },
    openGraph: {
      title: "ScopeLine 机构研究台 · Institutional Research",
      description: "输入公司名，生成中英文可切换、事实与假设分离、来源可追溯的研究报告。",
      type: "website",
      locale: "zh_CN",
      images: [{ url: "/og.png", width: 1200, height: 630, alt: "ScopeLine 机构研究台 / Institutional Research" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "ScopeLine 机构研究台 · Institutional Research",
      description: "Bilingual, source-linked institutional research from public SEC filings.",
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
