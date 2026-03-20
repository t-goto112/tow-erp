import { supabase } from "@/lib/supabase";

// ─── Types for Master page forms ───
export interface FormSubcontractor {
    name: string;
    unitPrice: number;
}

export interface FormProcess {
    id: string;
    name: string;
    sortOrder: number;
    isAssemblyPoint?: boolean;
    subcontractors: FormSubcontractor[];
}

export interface FormGroup {
    id: string;
    label: string;
    templates: FormProcess[];
}

// ─── Supabase product with nested processes ───
export interface MasterProduct {
    id: string;
    name: string;
    code: string;
    processes: MasterProcess[];
}

export interface MasterProcess {
    id: string;
    name: string;
    sort_order: number;
    group_index: number;
    is_assembly_point: boolean;
    process_subcontractor_rates: {
        id: string;
        unit_price: number;
        subcontractors: { id: string; name: string } | null;
    }[];
}

// ─── Fetch all products with processes and rates ───
export async function fetchMasterProducts(): Promise<MasterProduct[]> {
    const { data, error } = await supabase
        .from('products')
        .select(`
            id, name, code,
            processes(
                id, name, sort_order, group_index, is_assembly_point,
                process_subcontractor_rates(id, unit_price, subcontractors(id, name))
            )
        `)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return (data as any) || [];
}

// ─── Helper: find or create subcontractor by name ───
async function findOrCreateSubcontractor(name: string): Promise<string> {
    if (!name) throw new Error("外注先名が必要です");

    const { data: existing } = await supabase
        .from('subcontractors')
        .select('id')
        .eq('name', name)
        .limit(1);

    if (existing && existing.length > 0) return existing[0].id;

    const { data: created, error } = await supabase
        .from('subcontractors')
        .insert({ name })
        .select('id')
        .single();

    if (error) throw error;
    return created.id;
}

// ─── Create a product with process groups ───
export async function createProduct(
    name: string,
    code: string,
    groups: FormGroup[]
): Promise<string> {
    // 1. Insert product
    const { data: product, error: pErr } = await supabase
        .from('products')
        .insert({ name, code })
        .select('id')
        .single();
    if (pErr) throw pErr;

    // 2. Insert processes and rates for each group
    for (let gi = 0; gi < groups.length; gi++) {
        const group = groups[gi];
        for (const tpl of group.templates) {
            if (!tpl.name) continue;

            const { data: proc, error: procErr } = await supabase
                .from('processes')
                .insert({
                    product_id: product.id,
                    name: tpl.name,
                    sort_order: tpl.sortOrder,
                    group_index: gi,
                    is_assembly_point: !!tpl.isAssemblyPoint,
                })
                .select('id')
                .single();
            if (procErr) throw procErr;

            // Insert subcontractor rates
            for (const sub of tpl.subcontractors) {
                if (!sub.name) continue;
                const subId = await findOrCreateSubcontractor(sub.name);
                const { error: rErr } = await supabase
                    .from('process_subcontractor_rates')
                    .insert({
                        process_id: proc.id,
                        subcontractor_id: subId,
                        unit_price: sub.unitPrice || 0,
                    });
                if (rErr) throw rErr;
            }
        }
    }

    return product.id;
}

// ─── Update a product (delete old processes, re-insert) ───
export async function updateProduct(
    productId: string,
    name: string,
    code: string,
    groups: FormGroup[]
): Promise<void> {
    // 1. Update product fields
    const { error: pErr } = await supabase
        .from('products')
        .update({ name, code, updated_at: new Date().toISOString() })
        .eq('id', productId);
    if (pErr) throw pErr;

    // 2. Get existing processes for this product
    const { data: existingProcs } = await supabase
        .from('processes')
        .select('id')
        .eq('product_id', productId);
    const existingIds = new Set<string>((existingProcs || []).map((p: any) => p.id));

    // 3. Collect all process IDs that will remain after update
    const keepIds = new Set<string>();
    const newProcesses: { group: FormGroup; gi: number; tpl: FormProcess }[] = [];

    for (let gi = 0; gi < groups.length; gi++) {
        const group = groups[gi];
        for (const tpl of group.templates) {
            if (!tpl.name) continue;
            // If the template ID matches an existing process, it's an update
            if (existingIds.has(tpl.id)) {
                keepIds.add(tpl.id);
            }
            newProcesses.push({ group, gi, tpl });
        }
    }

    // 4. Delete processes that are no longer referenced (only those without lot_processes FK)
    const idsToRemove = Array.from(existingIds).filter(id => !keepIds.has(id));
    for (const id of idsToRemove) {
        // Check if any lot_processes reference this process
        const { data: refs } = await supabase
            .from('lot_processes')
            .select('id')
            .eq('process_id', id)
            .limit(1);
        if (!refs || refs.length === 0) {
            // Safe to delete
            await supabase.from('processes').delete().eq('id', id);
        }
        // If referenced, leave it (orphan process that will be cleaned up later)
    }

    // 5. Upsert processes: update existing, insert new
    for (const { gi, tpl } of newProcesses) {
        if (keepIds.has(tpl.id)) {
            // Update existing process
            await supabase.from('processes').update({
                name: tpl.name,
                sort_order: tpl.sortOrder,
                group_index: gi,
                is_assembly_point: !!tpl.isAssemblyPoint,
            }).eq('id', tpl.id);

            // Delete old rates and re-insert
            await supabase.from('process_subcontractor_rates').delete().eq('process_id', tpl.id);
            for (const sub of tpl.subcontractors) {
                if (!sub.name) continue;
                const subId = await findOrCreateSubcontractor(sub.name);
                await supabase.from('process_subcontractor_rates').insert({
                    process_id: tpl.id,
                    subcontractor_id: subId,
                    unit_price: sub.unitPrice || 0,
                });
            }
        } else {
            // Insert new process
            const { data: proc, error: procErr } = await supabase
                .from('processes')
                .insert({
                    product_id: productId,
                    name: tpl.name,
                    sort_order: tpl.sortOrder,
                    group_index: gi,
                    is_assembly_point: !!tpl.isAssemblyPoint,
                })
                .select('id')
                .single();
            if (procErr) throw procErr;

            for (const sub of tpl.subcontractors) {
                if (!sub.name) continue;
                const subId = await findOrCreateSubcontractor(sub.name);
                await supabase.from('process_subcontractor_rates').insert({
                    process_id: proc.id,
                    subcontractor_id: subId,
                    unit_price: sub.unitPrice || 0,
                });
            }
        }
    }
}

// ─── Delete a product (CASCADE handles processes and rates) ───
export async function deleteProduct(productId: string): Promise<void> {
    const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);
    if (error) throw error;
}

// ─── Convert Supabase process data to form groups ───
export function processesToFormGroups(processes: MasterProcess[]): FormGroup[] {
    const groupMap = new Map<number, FormGroup>();

    for (const proc of processes) {
        const gi = proc.group_index;
        if (!groupMap.has(gi)) {
            groupMap.set(gi, {
                id: `g-${gi}`,
                label: gi === 0 ? "工程登録1" : `工程登録${gi + 1}`,
                templates: [],
            });
        }
        const group = groupMap.get(gi)!;
        group.templates.push({
            id: proc.id,
            name: proc.name,
            sortOrder: proc.sort_order,
            isAssemblyPoint: proc.is_assembly_point,
            subcontractors: (proc.process_subcontractor_rates || []).map((r: any) => ({
                name: r.subcontractors?.name || "",
                unitPrice: r.unit_price || 0,
            })),
        });
    }

    // Sort templates within each group by sortOrder
    for (const group of Array.from(groupMap.values())) {
        group.templates.sort((a, b) => a.sortOrder - b.sortOrder);
    }

    // Return groups sorted by group index
    return Array.from(groupMap.entries())
        .sort(([a]: [number, FormGroup], [b]: [number, FormGroup]) => a - b)
        .map(([, g]: [number, FormGroup]) => g);
}
