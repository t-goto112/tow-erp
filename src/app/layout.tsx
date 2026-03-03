import type { Metadata } from "next";
import { Inter, Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const noto = Noto_Sans_JP({
    subsets: ["latin"],
    variable: "--font-noto",
    weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
    title: "TOWMEI | 包丁製造ERP",
    description: "次世代の包丁製造管理システム",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="ja">
            <body
                className={`${inter.variable} ${noto.variable} font-sans`}
            >
                <AppShell>{children}</AppShell>
            </body>
        </html>
    );
}
