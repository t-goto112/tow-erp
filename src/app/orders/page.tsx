"use client";

import React, { useState, useEffect } from "react";
import {
    FileText,
    ArrowLeft,
    Search,
    Plus,
    ChevronRight,
    Clock,
    CheckCircle2,
    Loader2,
    XCircle,
    ShoppingCart,
    Store,
    Menu,
    X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

const channelConfig = {
    ec: { label: "EC", icon: ShoppingCart, color: "bg-blue-50 text-blue-700" },
    wholesale: { label: "卸", icon: Store, color: "bg-amber-50 text-amber-700" },
    direct: { label: "直販", icon: FileText, color: "bg-emerald-50 text-emerald-700" }
};

const statusConfig = {
    pending: { label: "未処理", color: "bg-slate-100 text-slate-600" },
    partial: { label: "一部出荷済", color: "bg-amber-100 text-amber-700" },
    in_progress: { label: "制作中", color: "bg-blue-50 text-blue-700" },
    completed: { label: "完了", color: "bg-emerald-50 text-emerald-700" },
    cancelled: { label: "キャンセル", color: "bg-red-50 text-red-600" }
};

export default function OrdersPage() {
    const [search, setSearch] = useState("");
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [mobileMenu, setMobileMenu] = useState(false);

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("orders")
            .select(`
                *,
                order_items (
                    id,
                    quantity,
                    unit_price,
                    products (name)
                )
            `)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Error fetching orders:", error);
        } else {
            const mappedOrders = data.map((o: any) => ({
                ...o,
                items: (o.order_items || []).map((i: any) => ({
                    product: i.products?.name || "Unknown",
                    qty: i.quantity,
                    price: i.unit_price,
                    shipped: 0
                }))
            }));
            setOrders(mappedOrders);
        }
        setLoading(false);
    };

    return (
        <div className="flex h-screen bg-slate-50 font-sans text-slate-800">
            {/* Desktop Sidebar */}
            <aside className="hidden md:flex w-60 flex-col bg-white border-r border-slate-200 shrink-0">
                <div className="p-5">
                    <h1 className="text-xl font-bold text-blue-600 tracking-tight">TOWMEI</h1>
                    <p className="text-[10px] text-slate-400 mt-0.5">包丁製造 ERP</p>
                </div>
                <nav className="flex-1 px-3 space-y-0.5">
                    <a href="/" className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-100 transition"><ArrowLeft size={18} /> ダッシュボード</a>
                    <a href="/orders" className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white shadow-md shadow-blue-600/20"><FileText size={18} /> 受注管理</a>
                </nav>
            </aside>

            {/* Mobile Sidebar Drawer */}
            {mobileMenu && (
                <div className="fixed inset-0 z-50 flex md:hidden">
                    <div className="w-64 bg-white shadow-xl flex flex-col animate-in slide-in-from-left duration-200">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h1 className="text-lg font-bold text-blue-600 tracking-tight">TOWMEI</h1>
                            <button onClick={() => setMobileMenu(false)} className="p-1 text-slate-400 hover:bg-slate-100 rounded-lg"><X size={20} /></button>
                        </div>
                        <nav className="flex-1 p-3 space-y-0.5">
                            <a href="/" className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-100"><ArrowLeft size={18} /> ダッシュボード</a>
                            <a href="/orders" className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white shadow-md shadow-blue-600/20"><FileText size={18} /> 受注管理</a>
                        </nav>
                    </div>
                    <div className="flex-1 bg-black/40" onClick={() => setMobileMenu(false)} />
                </div>
            )}

            <main className="flex-1 flex flex-col overflow-hidden">
                <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-6 shrink-0">
                    <div className="flex items-center gap-3">
                        <button className="md:hidden p-1 text-slate-500 hover:bg-slate-100 rounded-lg" onClick={() => setMobileMenu(true)}>
                            <Menu size={22} />
                        </button>
                        <h2 className="text-base font-semibold">受注管理</h2>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 pb-24">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                        <div className="relative flex-1 max-w-sm">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input type="text" placeholder="受注番号・顧客名で検索..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition" />
                        </div>
                        <button className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold shadow-lg shadow-blue-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
                            <Plus size={16} /> 新規受注入力
                        </button>
                    </div>

                    {/* Order cards */}
                    <div className="space-y-3">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                                <Loader2 className="animate-spin" size={24} />
                                <p className="text-sm font-medium">受注データを読み込み中...</p>
                            </div>
                        ) : orders.length === 0 ? (
                            <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-200">
                                <p className="text-sm text-slate-400">受注データがありません</p>
                            </div>
                        ) : (
                            orders.filter((o) => o.order_number.includes(search) || o.customer_name.includes(search)).map((order) => {
                                const ch = channelConfig[order.channel as keyof typeof channelConfig] || channelConfig.direct;
                                const st = statusConfig[order.status as keyof typeof statusConfig] || statusConfig.pending;
                                const ChIcon = ch.icon;
                                const totalAmount = (order.items || []).reduce((s: number, i: any) => s + i.qty * i.price, 0);
                                return (
                                    <div key={order.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:shadow-md transition group">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-mono text-sm font-bold text-blue-600">{order.order_number}</span>
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${ch.color} flex items-center gap-1`}><ChIcon size={10} />{ch.label}</span>
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${st.color}`}>{st.label}</span>
                                                </div>
                                                <p className="text-sm font-medium">{order.customer_name}</p>
                                                <p className="text-xs text-slate-400 mt-0.5">納期: {order.due_date}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-lg font-bold">¥{totalAmount.toLocaleString()}</p>
                                                <p className="text-[10px] text-slate-400">{(order.items || []).length}品目</p>
                                            </div>
                                        </div>
                                        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-2">
                                            {(order.items || []).map((item: any, i: number) => (
                                                <div key={i} className="flex items-center gap-1.5 text-[10px] bg-slate-50 px-2 py-1 rounded border border-slate-100">
                                                    <span className="font-bold">{item.product}</span>
                                                    <span className="text-slate-400">×</span>
                                                    <span>{item.qty}</span>
                                                    {item.shipped > 0 && (
                                                        <span className="flex items-center gap-0.5 text-blue-600 font-bold bg-blue-50 px-1 rounded">
                                                            <CheckCircle2 size={8} /> {item.shipped}
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
