import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Team Sync',
  description: 'チームのための最強タスク管理アプリ',
  // ↓ これを追加しておくとより確実です
  openGraph: {
    title: 'Team Sync',
    description: 'チームのための最強タスク管理アプリ',
  },
}


export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
