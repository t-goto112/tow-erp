"use client";

import React, { useEffect, useState } from "react";
import { Bell, X, Info, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

export type Notification = {
    id: string;
    title: string;
    message: string;
    type: "info" | "success" | "warning" | "error";
    is_read: boolean;
    created_at: string;
};

export default function NotificationCenter() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        fetchNotifications();

        // Subscribe to real-time changes in notifications table
        const channel = supabase
            .channel("realtime:notifications")
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "notifications" },
                (payload) => {
                    const newNotif = payload.new as Notification;
                    setNotifications((prev) => [newNotif, ...prev]);
                    setUnreadCount((prev) => prev + 1);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const fetchNotifications = async () => {
        const { data, error } = await supabase
            .from("notifications")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(20);

        if (!error && data) {
            setNotifications(data as Notification[]);
            setUnreadCount(data.filter(n => !n.is_read).length);
        }
    };

    const markAsRead = async (id: string) => {
        const { error } = await supabase
            .from("notifications")
            .update({ is_read: true })
            .eq("id", id);

        if (!error) {
            setNotifications(prev =>
                prev.map(n => n.id === id ? { ...n, is_read: true } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        }
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative text-slate-400 hover:text-blue-500 transition p-1.5 rounded-lg hover:bg-slate-50"
            >
                <Bell size={20} />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold flex items-center justify-center rounded-full border-2 border-white">
                        {unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <h3 className="text-sm font-bold text-slate-800">通知センター</h3>
                            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
                        </div>
                        <div className="max-h-[400px] overflow-y-auto">
                            {notifications.length === 0 ? (
                                <div className="p-10 text-center text-slate-400">
                                    <Bell size={32} className="mx-auto mb-2 opacity-20" />
                                    <p className="text-xs">新しい通知はありません</p>
                                </div>
                            ) : (
                                notifications.map((n) => (
                                    <div
                                        key={n.id}
                                        onClick={() => markAsRead(n.id)}
                                        className={`p-4 border-b border-slate-50 hover:bg-slate-50 transition cursor-pointer flex gap-3 ${!n.is_read ? "bg-blue-50/30" : ""}`}
                                    >
                                        <div className={`mt-0.5 shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${n.type === "success" ? "bg-emerald-100 text-emerald-600" :
                                                n.type === "error" ? "bg-red-100 text-red-600" :
                                                    n.type === "warning" ? "bg-amber-100 text-amber-600" :
                                                        "bg-blue-100 text-blue-600"
                                            }`}>
                                            {n.type === "success" ? <CheckCircle2 size={16} /> :
                                                n.type === "error" ? <AlertCircle size={16} /> :
                                                    <Info size={16} />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-xs font-bold ${!n.is_read ? "text-slate-900" : "text-slate-600"}`}>{n.title}</p>
                                            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{n.message}</p>
                                            <p className="text-[9px] text-slate-400 mt-1.5 uppercase font-medium">{new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                        </div>
                                        {!n.is_read && <div className="w-1.5 h-1.5 bg-blue-500 rounded-full self-center" />}
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="p-3 bg-slate-50 text-center border-top border-slate-100">
                            <button className="text-[10px] font-bold text-blue-600 hover:text-blue-700">すべての通知を見る</button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
