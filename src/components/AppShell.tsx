"use client";

import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { usePathname } from "next/navigation";

const pageTitles: Record<string, string> = {
    "/": "ダッシュボード",
    "/orders": "受注管理",
    "/inventory": "在庫管理",
    "/payments": "支払管理",
    "/routing": "工程実績・納入報告",
    "/master": "マスタ・各種設定",
    "/lots": "ロット管理",
    "/admin": "管理者設定",
    "/mypage": "マイアカウント",
};

export default function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const title = pageTitles[pathname] || "";

    // login page has no shell
    if (pathname === "/login") {
        return <>{children}</>;
    }

    return (
        <div className="flex h-screen w-full overflow-hidden bg-[#F8FAFC] text-slate-800 antialiased">
            <Sidebar />
            <main className="flex-1 flex flex-col bg-white overflow-hidden rounded-tl-3xl border-t border-l border-slate-200/60 shadow-inner my-2 mr-2">
                <Header title={title} />
                <div className="flex-1 overflow-y-auto px-6 md:px-10 pb-12">
                    {children}
                </div>
            </main>
        </div>
    );
}
