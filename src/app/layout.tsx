import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import AuthSessionProvider from "@/components/AuthSessionProvider";
import AuthButton from "@/components/AuthButton";
import SignInErrorBanner from "@/components/SignInErrorBanner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Repo Warehouse",
  description: "Your personal storage for GitHub repositories — yours or anyone else's.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-neutral-950 text-neutral-100">
        <AuthSessionProvider>
          <SignInErrorBanner />
          <header className="border-b border-neutral-800">
            <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
              <Link href="/" className="text-lg font-semibold tracking-tight">
                📦 Repo Warehouse
              </Link>
              <AuthButton />
            </div>
          </header>
          <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8">{children}</main>
          <footer className="border-t border-neutral-800 py-4">
            <div className="mx-auto max-w-5xl px-4 text-xs text-neutral-500">
              Static-site previews run in a sandboxed iframe. No server-side code execution.
            </div>
          </footer>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
