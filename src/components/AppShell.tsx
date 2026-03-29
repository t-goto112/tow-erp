"use client";

import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { usePathname } from "next/navigation";
import React, { useState } from "react";

const pageTitles: Record<string, string> = {
    "/": "ダッシュボード",
    "/orders": "受注管理",
    "/inventory": "在庫管理",
    "/payments": "支払管理",
    "/routing": "工程実績・納入報告",
    "/master": "マスタ・各種設定",
    "/admin": "管理者設定",
    "/mypage": "マイアカウント",
};

export default function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const title = pageTitles[pathname] || "";
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // login page has no shell
    if (pathname === "/login") {
        return <>{children}</>;
    }

    return (
        <div className="flex h-screen w-full overflow-hidden bg-[#F8FAFC] text-slate-800 antialiased">
            <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
            <main className="flex-1 flex flex-col bg-white overflow-hidden md:rounded-tl-3xl md:border-t md:border-l border-slate-200/60 shadow-inner md:my-2 md:mr-2">
                <Header title={title} onMenuClick={() => setMobileMenuOpen(true)} />
                <div className="flex-1 overflow-y-auto px-4 md:px-10 pb-12">
                    {children}
                </div>
            </main>
        </div>
    );
}
