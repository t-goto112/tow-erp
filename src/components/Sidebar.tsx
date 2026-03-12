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
} from "lucide-react";
import { supabase } from "@/lib/supabase";

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

export default function Sidebar() {
    const pathname = usePathname();
    const [profile, setProfile] = useState<{ full_name: string; role: string; permissions?: any } | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchProfile = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;

            if (!user) {
                console.log("Sidebar: No session user found");
                setProfile(null);
                setLoading(false);
                return;
            }

            console.log("Sidebar: Fetching profile for", user.id);

            // 1. Get profile from DB (Source of truth)
            const { data, error } = await supabase
                .from('profiles')
                .select('full_name, role, permissions')
                .eq('id', user.id)
                .single();

            if (error) {
                console.error("Sidebar: DB Fetch error", error);

                // 2. Fallback to metadata if DB fetch fails
                const metaRole = user.app_metadata?.role || user.user_metadata?.role;
                const metaName = user.user_metadata?.full_name || "ゲストユーザー";

                console.log("Sidebar: Fallback to metadata", { metaRole, metaName });
                setProfile({
                    full_name: metaName,
                    role: (metaRole as string) || 'user',
                    permissions: {}
                });
            } else if (data) {
                console.log("Sidebar: Profile loaded successfully", data);
                setProfile(data);
            }
        } catch (err) {
            console.error("Sidebar catch error:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProfile();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            console.log("Sidebar: Auth Change Event", event);
            if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') {
                fetchProfile();
            } else if (event === 'SIGNED_OUT') {
                setProfile(null);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const isAdmin = profile?.role === 'admin';
    const permissions = profile?.permissions || {};

    const isVisible = (href: string) => {
        if (isAdmin) return true;
        const pageKey = href.replace('/', '') || 'dashboard';
        if (href === '/admin') return false;
        // Check permissions explicitly
        const perms = permissions as any;
        return perms[pageKey]?.view !== false;
    };

    const filteredNavItems = navItems.filter(item => isVisible(item.href));
    const filteredSubNavItems = subNavItems.filter(item => {
        if (item.href === '/admin') return isAdmin;
        return isVisible(item.href);
    });

    return (
        <aside className="hidden md:flex w-64 flex-col bg-white border-r border-slate-200 shrink-0 z-10 h-full">
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

            <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto mt-4">
                {filteredNavItems.map((item) => {
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

                {filteredSubNavItems.map((item) => {
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

            <div className="border-t border-slate-100 p-4">
                <UserProfileFooter profile={profile} loading={loading} />
            </div>
        </aside>
    );
}
