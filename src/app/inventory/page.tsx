"use client";

import React, { useState, useMemo } from "react";
import { Box, Layers, Edit2, Check, Loader2, MapPin } from "lucide-react";
import { showToast } from "@/components/Toast";
import Modal from "@/components/Modal";
import { useSupabaseData, SupabaseInventory, SupabaseLot } from "@/lib/useSupabaseData";
import { adjustInventory, updateWarehouse } from "@/lib/services/inventoryService";

export default function InventoryPage() {
    const [tab, setTab] = useState<"stock" | "wip">("stock");
    const { inventory, lots, loading, profile, refresh } = useSupabaseData();
    const canEdit = profile?.role === 'admin' || (profile?.permissions?.inventory?.edit === true);

    const [adjustItem, setAdjustItem] = useState<SupabaseInventory | null>(null);
    const [warehouseEditItem, setWarehouseEditItem] = useState<SupabaseInventory | null>(null);
    const [newWarehouse, setNewWarehouse] = useState("");
    const [newQuantity, setNewQuantity] = useState("");
    const [adjReason, setAdjReason] = useState("棚卸による差異修正");
    const [loadingAction, setLoadingAction] = useState(false);

    const handleAdjust = async () => {
        if (!adjustItem || !newQuantity) return;
        try {
            setLoadingAction(true);
            await adjustInventory(adjustItem.id, Number(newQuantity), adjReason);
            showToast("success", `在庫を ${adjustItem.quantity} → ${newQuantity} に修正しました`);
            setAdjustItem(null);
            setNewQuantity("");
            refresh();
        } catch (err: any) {
            console.error(err);
            showToast("error", "在庫の更新に失敗しました");
        } finally {
            setLoadingAction(false);
        }
    };

    const handleUpdateWarehouse = async () => {
        if (!warehouseEditItem) return;
        try {
            setLoadingAction(true);
            await updateWarehouse(warehouseEditItem.id, newWarehouse);
            showToast("success", `倉庫を「${newWarehouse || "未設定"}」に更新しました`);
            setWarehouseEditItem(null);
            setNewWarehouse("");
            refresh();
        } catch (err: any) {
            console.error(err);
            showToast("error", "倉庫の更新に失敗しました");
        } finally {
            setLoadingAction(false);
        }
    };

    // 完成品在庫（ロット記載なし、同製品を集約）
    const stockItems = useMemo(() => {
        const grouped: Record<string, SupabaseInventory> = {};
        inventory.filter((i: SupabaseInventory) => i.item_type === "finished" || i.item_type === "parts").forEach((i: SupabaseInventory) => {
            const prodName = i.products?.name || "不明な製品";
            const key = `${prodName}-${i.item_type}`; // 名前とタイプでグループ化
            if (grouped[key]) {
                grouped[key].quantity += i.quantity;
            } else {
                grouped[key] = { ...i };
            }
        });
        return Object.values(grouped);
    }, [inventory]);

    // 仕掛品: ロットごとにどの工程にいくつあるか
    const wipByLot = useMemo(() => {
        return lots.filter(l => l.status !== "completed");
    }, [lots]);

    if (loading) {
        return <div className="flex h-full items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;
    }

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex gap-1 bg-white rounded-xl p-1 border border-slate-200 shadow-sm w-fit">
                <button onClick={() => setTab("stock")} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition flex items-center gap-1.5 ${tab === "stock" ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
                    <Box size={14} /> 完成品在庫
                </button>
                <button onClick={() => setTab("wip")} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition flex items-center gap-1.5 ${tab === "wip" ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
                    <Layers size={14} /> 仕掛品
                </button>
            </div>

            {/* 完成品在庫（ロット記載なし） */}
            {tab === "stock" && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                            <tr><th className="px-4 py-3 text-left">商品コード</th><th className="px-4 py-3 text-left">商品</th><th className="px-4 py-3 text-right">数量</th><th className="px-4 py-3 text-left">倉庫</th><th className="px-4 py-3"></th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/60">
                            {stockItems.map((item, index) => (
                                <tr key={item.id || index} className="border-b border-slate-50 hover:bg-slate-50 transition-all group">
                                    <td className="px-4 py-3 font-mono text-xs text-slate-400">{item.products?.product_code}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-700">{item.products?.name}</span>
                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${item.item_type === 'finished' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
                                                {item.item_type === 'finished' ? '完成品' : '仕掛パーツ'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right font-black text-lg">
                                        <div className="flex items-center justify-end gap-1">
                                            {item.quantity}
                                            {canEdit && (
                                                <button onClick={() => { setAdjustItem(item); setNewQuantity(String(item.quantity)); }} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-blue-600">
                                                    <Edit2 size={10} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-slate-400 group cursor-pointer"
                                        onClick={() => {
                                            if (!canEdit) return;
                                            setWarehouseEditItem(item);
                                            setNewWarehouse(item.location || "");
                                        }}>
                                        <div className="flex items-center gap-1 hover:text-blue-600 transition">
                                            <MapPin size={10} className="text-slate-300" />
                                            <span>{item.location || "未設定"}</span>
                                            {canEdit && <Edit2 size={8} className="opacity-0 group-hover:opacity-100 ml-1" />}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                    </td>
                                </tr>
                            ))}
                            {stockItems.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">完成品在庫はありません</td></tr>}
                        </tbody>
                    </table>
                </div>
            )}

            {/* 仕掛品: ロットごとに工程別数量表示 */}
            {tab === "wip" && (
                <div className="space-y-3">
                    {wipByLot.map(lot => {
                        const processList = lot.lot_processes ? [...lot.lot_processes].sort((a: any, b: any) => (a.processes?.group_index || 0) - (b.processes?.group_index || 0) || (a.processes?.sort_order || 0) - (b.processes?.sort_order || 0)) : [];

                        return (
                            <div key={lot.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="font-mono text-sm font-bold text-blue-600">{lot.lot_number}</span>
                                    <span className="text-xs text-slate-500">{lot.products?.name}</span>
                                    <span className="text-[10px] text-slate-400 font-bold ml-auto">受注数 {lot.quantity}個</span>
                                </div>
                                {/* 工程別テーブル */}
                                <div className="bg-slate-50 rounded-xl overflow-hidden border border-slate-100">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="text-[9px] text-slate-400 uppercase font-bold">
                                                <th className="px-3 py-2 text-left">工程</th>
                                                <th className="px-3 py-2 text-left">外注先</th>
                                                <th className="px-3 py-2 text-right">現在数</th>
                                                <th className="px-3 py-2 text-right">完了数</th>
                                                <th className="px-3 py-2 text-right">ロス</th>
                                                <th className="px-3 py-2 text-center">状態</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {processList.map(proc => (
                                                <tr key={proc.id} className={proc.status === "in_progress" ? "bg-blue-50/50" : ""}>
                                                    <td className="px-3 py-2 font-bold text-slate-700">{(proc as any).processes?.name}</td>
                                                    <td className="px-3 py-2 text-slate-500">{proc.subcontractors?.name || "自社"}</td>
                                                    <td className="px-3 py-2 text-right font-bold">{(proc as any).input_quantity > 0 ? <span className="text-blue-600">{(proc as any).input_quantity}</span> : <span className="text-slate-300">0</span>}</td>
                                                    <td className="px-3 py-2 text-right font-bold text-emerald-600">{proc.completed_quantity}</td>
                                                    <td className="px-3 py-2 text-right">{(proc as any).loss_qty > 0 ? <span className="text-red-500 font-bold">{(proc as any).loss_qty}</span> : <span className="text-slate-300">0</span>}</td>
                                                    <td className="px-3 py-2 text-center text-[10px] font-bold">
                                                        {proc.status === "completed" ? <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">完了</span> :
                                                            proc.status === "in_progress" ? <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded">仕掛</span> :
                                                                <span className="text-slate-400 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">未着手</span>}
                                                    </td>
                                                </tr>
                                            ))}
                                            {processList.length === 0 && <tr><td colSpan={6} className="px-3 py-4 text-center text-slate-400">工程レコードがありません</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })}
                    {wipByLot.length === 0 && <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-200"><p className="text-sm text-slate-400">仕掛品はありません</p></div>}
                </div>
            )}

            {/* 在庫修正モーダル */}
            <Modal open={!!adjustItem} onClose={() => setAdjustItem(null)} title="在庫数量を修正" subtitle={adjustItem?.products?.name} width="max-w-xl">
                {adjustItem && (
                    <div className="space-y-5">
                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-400 uppercase">現在数</span>
                            <span className="text-2xl font-black text-slate-800">{adjustItem.quantity}<span className="text-xs text-slate-400 ml-1">個</span></span>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">修正後</label>
                            <input type="number" value={newQuantity} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewQuantity(e.target.value)} className="input-base text-xl font-black text-blue-600" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">理由</label>
                            <select value={adjReason} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAdjReason(e.target.value)} className="select-base">
                                <option>棚卸による差異修正</option>
                                <option>返品による加減</option>
                                <option>破損・廃棄</option>
                                <option>販売・発送</option>
                                <option>入力ミスの訂正</option>
                                <option>その他</option>
                            </select>
                        </div>
                        <button onClick={handleAdjust} disabled={loadingAction || !newQuantity}
                            className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-600/20 hover:bg-blue-700 active:scale-[0.98] transition-all disabled:bg-slate-300 flex items-center justify-center gap-2">
                            {loadingAction ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Check className="w-5 h-5" /> 在庫を修正する</>}
                        </button>
                    </div>
                )}
            </Modal>

            {/* 倉庫編集モーダル */}
            <Modal open={!!warehouseEditItem} onClose={() => setWarehouseEditItem(null)} title="保管場所の変更" subtitle={warehouseEditItem?.products?.name} width="max-w-xl">
                {warehouseEditItem && (
                    <div className="space-y-5">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">倉庫名</label>
                            <input type="text" value={newWarehouse} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewWarehouse(e.target.value)} placeholder="例：第1倉庫 A列" className="input-base text-sm" />
                        </div>
                        <button onClick={handleUpdateWarehouse} disabled={loadingAction}
                            className="w-full bg-blue-600 text-white font-black py-3 rounded-2xl shadow-xl shadow-blue-600/20 hover:bg-blue-700 active:scale-[0.98] transition-all disabled:bg-slate-300 flex items-center justify-center gap-2">
                            {loadingAction ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Check className="w-5 h-5" /> 保存する</>}
                        </button>
                    </div>
                )}
            </Modal>
        </div>
    );
}
