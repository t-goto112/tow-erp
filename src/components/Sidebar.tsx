"use client";

import React, { useState, useEffect } from "react";
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
    Shield,
    Loader2,
    X,
} from "lucide-react";
import { useSupabaseData } from "@/lib/useSupabaseData";

const navItems = [
    { href: "/", icon: LayoutDashboard, label: "ダッシュボード" },
    { href: "/orders", icon: ShoppingCart, label: "受注管理" },
    { href: "/inventory", icon: Box, label: "在庫管理" },
    { href: "/payments", icon: CreditCard, label: "支払管理" },
];

const subNavItems = [
    { href: "/routing", icon: ClipboardEdit, label: "工程実績・納入" },
    { href: "/master", icon: Database, label: "マスタ管理" },
    { href: "/admin", icon: Shield, label: "管理者設定" },
];

function UserProfileFooter({ profile, loading }: { profile: any; loading: boolean }) {
    if (loading) return (
        <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center">
                <Loader2 className="w-4 h-4 animate-spin text-slate-300" />
            </div>
        </div>
    );

    return (
        <Link
            href="/mypage"
            className="flex items-center gap-3 px-2 py-2 cursor-pointer hover:bg-slate-50 rounded-xl transition group"
        >
            <div className="w-9 h-9 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition">
                <User className="text-blue-600 w-4 h-4" />
            </div>
            <div className="overflow-hidden">
                <p className="text-sm font-bold text-slate-700 truncate">
                    {profile?.full_name || "ゲストユーザー"}
                </p>
                <p className="text-[10px] text-slate-400 truncate tracking-wider uppercase font-bold">
                    {profile?.role === 'admin' ? 'Administrator' : 'Staff Member'}
                </p>
            </div>
        </Link>
    );
}

interface SidebarProps {
    mobileOpen?: boolean;
    onMobileClose?: () => void;
}

export default function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
    const pathname = usePathname();
    const { profile, loading } = useSupabaseData();

    const isAdmin = profile?.role === 'admin';
    const permissions = profile?.permissions || {};

    const isVisible = (href: string) => {
        if (isAdmin) return true;
        const pageKey = href.replace('/', '') || 'dashboard';

        // Explicitly hide admin page for non-admins
        if (href === '/admin') return false;

        const perms = permissions as any;
        // Check view permission. Default to true if not explicitly false.
        return perms[pageKey]?.view !== false;
    };

    const filteredNavItems = navItems.filter(item => isVisible(item.href));
    const filteredSubNavItems = subNavItems.filter(item => {
        if (item.href === '/admin') return isAdmin;
        return isVisible(item.href);
    });

    // Close mobile menu on route change
    useEffect(() => {
        if (onMobileClose) onMobileClose();
    }, [pathname]);

    const sidebarContent = (
        <>
            <div className="p-6">
                <Link href="/" className="flex items-center gap-3 group" onClick={onMobileClose}>
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

            <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto mt-4">
                {filteredNavItems.map((item) => {
                    const active = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={onMobileClose}
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

                {filteredSubNavItems.map((item) => {
                    const active = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={onMobileClose}
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

            <div className="border-t border-slate-100 p-4">
                <UserProfileFooter profile={profile} loading={loading} />
            </div>
        </>
    );

    return (
        <>
            {/* Desktop sidebar */}
            <aside className="hidden md:flex w-64 flex-col bg-white border-r border-slate-200 shrink-0 z-10 h-full">
                {sidebarContent}
            </aside>

            {/* Mobile drawer overlay */}
            {mobileOpen && (
                <div className="fixed inset-0 z-[100] md:hidden">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
                        onClick={onMobileClose}
                    />
                    {/* Drawer */}
                    <aside className="absolute left-0 top-0 bottom-0 w-72 flex flex-col bg-white shadow-2xl animate-in slide-in-from-left duration-200">
                        <button
                            onClick={onMobileClose}
                            className="absolute top-4 right-4 p-2 text-slate-400 hover:bg-slate-100 rounded-full transition z-10"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        {sidebarContent}
                    </aside>
                </div>
            )}
        </>
    );
}
