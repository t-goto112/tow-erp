"use client";

import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { showToast } from "@/components/Toast";

// Data types aligned with Supabase schema
export interface SupabaseProduct {
    id: string;
    code: string;
    name: string;
}

export interface SupabaseOrder {
    id: string;
    order_number: string;
    customer_name: string;
    channel: string;
    due_date: string;
    status: string;
    notes: string;
    created_at: string;
    order_items: SupabaseOrderItem[];
}

export interface SupabaseOrderItem {
    id: string;
    order_id: string;
    product_id: string;
    quantity: number;
    unit_price: number;
    shipped_quantity: number;
    products: { name: string; code: string };
}

export interface SupabaseLot {
    id: string;
    lot_number: string;
    product_id: string;
    total_quantity: number;
    status: string;
    order_id: string | null;
    created_at: string;
    products: { name: string } | null;
    lot_processes?: SupabaseLotProcess[];
}

export interface SupabaseLotProcess {
    id: string;
    lot_id: string;
    process_id: string;
    subcontractor_id: string | null;
    input_quantity: number;
    completed_quantity: number;
    defect_quantity: number;
    loss_qty: number;
    status: string;
    processes: { name: string; sort_order: number; group_index: number } | null;
    subcontractors: { name: string } | null;
    lot_process_deliveries?: SupabaseLotProcessDelivery[];
}

export interface SupabaseLotProcessDelivery {
    id: string;
    lot_process_id: string;
    qty: number;
    delivery_date: string | null;
    due_date: string | null;
    completion_date: string | null;
    status: string;
}

export interface SupabaseInventory {
    id: string;
    product_id: string;
    quantity: number;
    item_type: string;
    location: string | null;
    products: { name: string; code: string } | null;
}

export interface SupabaseProcess {
    id: string;
    product_id: string;
    name: string;
    sort_order: number;
    group_index: number;
    is_parallel: boolean;
}

export interface SupabaseSubcontractor {
    id: string;
    name: string;
}

export interface SupabaseProcessSubcontractorRate {
    id: string;
    process_id: string;
    subcontractor_id: string;
    unit_price: number;
    subcontractors: SupabaseSubcontractor | null;
}

export interface SupabasePaymentItem {
    id: string;
    payment_id: string;
    lot_process_id: string;
    good_quantity: number;
    unit_price: number;
    amount: number;
    created_at: string;
    payments: {
        status: string;
        period_start: string;
        subcontractors: { name: string; id: string } | null;
    } | null;
    lot_processes: {
        unit_price_override: number | null;
        lots: { lot_number: string } | null;
        processes: { name: string } | null;
    } | null;
}

export function useSupabaseData() {
    const [products, setProducts] = useState<SupabaseProduct[]>([]);
    const [orders, setOrders] = useState<SupabaseOrder[]>([]);
    const [lots, setLots] = useState<SupabaseLot[]>([]);
    const [inventory, setInventory] = useState<SupabaseInventory[]>([]);

    // Master data for routing
    const [processes, setProcesses] = useState<SupabaseProcess[]>([]);
    const [subcontractors, setSubcontractors] = useState<SupabaseSubcontractor[]>([]);
    const [processRates, setProcessRates] = useState<SupabaseProcessSubcontractorRate[]>([]);

    const [paymentItems, setPaymentItems] = useState<SupabasePaymentItem[]>([]);

    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async (isInitial = false) => {
        try {
            if (isInitial) setLoading(true);

            // 1. Fetch Products
            const { data: pData, error: pErr } = await supabase.from('products').select('*');
            if (pErr) throw pErr;
            setProducts(pData || []);

            // 2. Fetch Orders with Items
            const { data: oData, error: oErr } = await supabase
                .from('orders')
                .select('*, order_items(*, products(name, code))')
                .order('created_at', { ascending: false });
            if (oErr) throw oErr;
            setOrders(oData || []);

            // 3. Fetch Lots with nested processes, process definitions, and deliveries
            const { data: lData, error: lErr } = await supabase
                .from('lots')
                .select('*, products(name), lot_processes(*, processes(name, sort_order, group_index), subcontractors(name), lot_process_deliveries(*))')
                .order('created_at', { ascending: false });
            if (lErr) throw lErr;
            setLots(lData || []);

            // 3.5 Fetch Payments
            const { data: piData, error: piErr } = await supabase
                .from('payment_items')
                .select(`
                    id, payment_id, lot_process_id, good_quantity, unit_price, amount, created_at,
                    payments(status, period_start, subcontractors(name, id)),
                    lot_processes(unit_price_override, lots(lot_number), processes(name))
                `)
                .order('created_at', { ascending: false });
            if (piErr) throw piErr;
            setPaymentItems(piData as any || []);

            // 4. Fetch Inventory
            const { data: iData, error: iErr } = await supabase
                .from('inventory')
                .select('*, products(name, code)');
            if (iErr) throw iErr;
            setInventory(iData || []);

            // 5. Fetch Master Data for routing/processing
            const { data: procData } = await supabase.from('processes').select('*').order('sort_order', { ascending: true });
            setProcesses(procData || []);

            const { data: subData } = await supabase.from('subcontractors').select('*');
            setSubcontractors(subData || []);

            const { data: ratesData } = await supabase.from('process_subcontractor_rates').select('*, subcontractors(id, name)');
            setProcessRates(ratesData || []);

        } catch (error: any) {
            console.error("Failed to fetch data:", error);
            showToast("error", "データの取得に失敗しました");
        } finally {
            if (isInitial) setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData(true);
    }, [fetchData]);

    return { products, orders, lots, inventory, processes, subcontractors, processRates, paymentItems, loading, refresh: () => fetchData(false) };
}
