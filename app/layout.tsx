import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "二打一 · 3D 战术沙盘",
  description: "移动端优先的 Three.js 二打一回合制战术游戏。",
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
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
