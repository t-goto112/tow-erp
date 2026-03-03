"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    ShoppingCart,
    Box,
    CreditCard,
    ClipboardEdit,
    Database,
    User,
} from "lucide-react";

const navItems = [
    { href: "/", icon: LayoutDashboard, label: "ダッシュボード" },
    { href: "/orders", icon: ShoppingCart, label: "受注管理" },
    { href: "/inventory", icon: Box, label: "在庫管理" },
    { href: "/payments", icon: CreditCard, label: "支払管理" },
];

const subNavItems = [
    { href: "/routing", icon: ClipboardEdit, label: "工程実績・納入" },
    { href: "/master", icon: Database, label: "マスタ管理" },
];

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="hidden md:flex w-64 flex-col bg-white border-r border-slate-200 shrink-0 z-10">
            {/* Logo - Blue Theme */}
            <div className="p-6">
                <Link href="/" className="flex items-center gap-3 group">
                    <div className="w-8 h-8 flex items-center justify-center border-2 border-blue-600 rounded-bl-xl rounded-tr-xl transform rotate-3 group-hover:scale-105 transition">
                        <span className="font-bold text-blue-600 text-lg tracking-tighter leading-none italic pr-0.5">
                            T
                        </span>
                    </div>
                    <h1 className="text-xl font-bold text-blue-600 tracking-widest uppercase font-sans">
                        Towmei
                    </h1>
                </Link>
            </div>

            {/* Main Nav */}
            <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto mt-4">
                {navItems.map((item) => {
                    const active = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition ${active
                                    ? "bg-slate-100 text-blue-600 font-semibold"
                                    : "text-slate-500 hover:bg-slate-50"
                                }`}
                        >
                            <item.icon
                                className={`w-5 h-5 ${active ? "text-blue-500" : "text-slate-400"
                                    }`}
                            />
                            {item.label}
                        </Link>
                    );
                })}

                <div className="my-4 border-t border-slate-100" />

                {subNavItems.map((item) => {
                    const active = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition ${active
                                    ? "bg-slate-100 text-blue-600 font-semibold"
                                    : "text-slate-500 hover:bg-slate-50"
                                }`}
                        >
                            <item.icon
                                className={`w-5 h-5 ${active ? "text-blue-500" : "text-slate-400"
                                    }`}
                            />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            {/* User Account Footer */}
            <div className="border-t border-slate-100 p-4">
                <Link
                    href="/mypage"
                    className="flex items-center gap-3 px-2 py-2 cursor-pointer hover:bg-slate-50 rounded-xl transition"
                >
                    <div className="w-9 h-9 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                        <User className="text-blue-600 w-4 h-4" />
                    </div>
                    <div className="overflow-hidden">
                        <p className="text-sm font-bold text-slate-700 truncate">
                            田中 義男
                        </p>
                        <p className="text-[10px] text-slate-400 truncate tracking-wider uppercase">
                            Administrator
                        </p>
                    </div>
                </Link>
            </div>
        </aside>
    );
}
