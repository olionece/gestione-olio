'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import AuthBox from '@/components/Auth';
import ThemeToggle from '@/components/ThemeToggle';
import type { Session } from '@supabase/supabase-js';

type Role = 'viewer' | 'operator' | 'admin';
type MovementType = 'all' | 'in' | 'out' | 'adjust';

type UserRoleRow = { role: Role };

type StockRow = {
  variant_id: string; lot_id: string; lot_code: string; vintage: number;
  size_id: string; size_label: string; ml: number;
  units_on_hand: number; liters_on_hand: number;
  warehouse_id?: string | null; warehouse_name?: string | null;
};

type VariantRow = {
  variant_id: string; lot_id: string; lot_code: string; vintage: number;
  size_id: string; size_label: string; ml: number; units_on_hand: number;
};

type MovementLogRow = {
  id: string; created_at: string; movement: 'in'|'out'|'adjust';
  quantity_units: number; note: string | null; variant_id: string;
  vintage: number; lot_code: string; size_label: string; ml: number;
  created_by: string | null; operator_email: string | null;
  warehouse_id: string; warehouse_name: string;
};

type WarehouseRow = { id: string; name: string };

const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
const [wh, setWh] = useState<'all' | string>('all'); // filtro magazzino

useEffect(() => {
  if (!session) return;
  (async () => {
    // 1) tenta dalla tabella 'warehouses'
    const { data: w, error } = await supabase
      .from('warehouses')
      .select('id,name')
      .order('name');

    let list = (w ?? []) as WarehouseRow[];

    // 2) fallback: deduci da v_stock_detailed_wh (nel caso RLS/altro blocchi la tabella)
    if ((!list || list.length === 0) && !error) {
      const { data: vw } = await supabase
        .from('v_stock_detailed_wh')
        .select('warehouse_id,warehouse_name')
        .limit(1000);
      const seen = new Set<string>();
      list = (vw ?? [])
        .map((r: any) => ({ id: r.warehouse_id as string, name: r.warehouse_name as string }))
        .filter(r => r.id && !seen.has(r.id) && seen.add(r.id));
      // ordina alfabetico
      list.sort((a, b) => a.name.localeCompare(b.name));
    }

    setWarehouses(list);

    // imposta un default sensato
    if (wh === 'all' && list.length === 1) setWh(list[0].id);
  })();
}, [session]); // <-- non mettere [wh] qui: il fetch magazzini serve solo a login/cambio utente

export default function Home() {
  const session = useSession();
  const [roles, setRoles] = useState<Role[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [wh, setWh] = useState<'all' | string>('all');  // filtro magazzino

  const [stock, setStock] = useState<StockRow[]>([]);
  const [fVintage, setFVintage] = useState<number | 'all'>('all');
  const [fLot, setFLot] = useState<'all' | 'A' | 'B' | 'C'>('all');
  const [fSize, setFSize] = useState<'all' | string>('all');

  const [reloadLog, setReloadLog] = useState<number>(0);
  const canInsert = useMemo(() => roles.includes('operator') || roles.includes('admin'), [roles]);

  useEffect(() => {
    if (!session) return;
    (async () => {
      const { data: r1 } = await supabase.from('user_roles').select('role').eq('user_id', session.user.id);
      setRoles(((r1 ?? []) as UserRoleRow[]).map(r => r.role));
      const { data: w } = await supabase.from('warehouses').select('id,name').order('name');
      setWarehouses((w ?? []) as WarehouseRow[]);
    })();
  }, [session]);

  const refreshStock = async () => {
    if (wh === 'all') {
      const { data, error } = await supabase
        .from('v_stock_detailed_sum').select('*')
        .order('vintage', { ascending: false })
        .order('lot_code', { ascending: true })
        .order('ml', { ascending: true });
      if (!error) setStock((data ?? []) as StockRow[]);
    } else {
      const { data, error } = await supabase
        .from('v_stock_detailed_wh').select('*')
        .eq('warehouse_id', wh)
        .order('vintage', { ascending: false })
        .order('lot_code', { ascending: true })
        .order('ml', { ascending: true });
      if (!error) setStock((data ?? []) as StockRow[]);
    }
  };
  useEffect(() => { if (session) void refreshStock(); }, [session, wh]);

  const stockVintages = useMemo(() => Array.from(new Set(stock.map(s => s.vintage))).sort((a, b) => b - a), [stock]);
  const stockLots = useMemo(() => Array.from(new Set(stock.map(s => s.lot_code))).sort(), [stock]);
  const stockSizes = useMemo(() => {
    const ordered = [...stock].sort((a, b) => a.ml - b.ml);
    return Array.from(new Set(ordered.map(s => s.size_label)));
  }, [stock]);

  const stockFiltered = useMemo(() => stock.filter(s =>
    (fVintage === 'all' || s.vintage === fVintage) &&
    (fLot === 'all' || s.lot_code === fLot) &&
    (fSize === 'all' || s.size_label === fSize)
  ), [stock, fVintage, fLot, fSize]);

  const totals = useMemo(() => {
    const liters = stockFiltered.reduce((sum, r) => sum + (r.liters_on_hand ?? 0), 0);
    const units  = stockFiltered.reduce((sum, r) => sum + (r.units_on_hand ?? 0), 0);
    return { liters, units };
  }, [stockFiltered]);

  const signOut = async () => { await supabase.auth.signOut(); };

  if (!session) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight">🫒 Gestione Olio</h1>
        <p className="text-stone-600 dark:text-stone-300">Accedi con la tua email per entrare nel magazzino.</p>
        <div className="rounded-2xl border bg-white shadow-sm p-6 border-stone-200 dark:bg-stone-900 dark:border-stone-700">
          <AuthBox />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-700 to-amber-500
                             dark:from-amber-400 dark:to-amber-200">
              Gestione Olio
            </span>
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Magazzini: {warehouses.map(w => w.name).join(' · ') || '—'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ThemeToggle />
          <RolesChips roles={roles} />
          <button className="inline-flex items-center rounded-lg border px-3 py-1.5 text-sm shadow-sm
                             bg-white hover:bg-stone-50 border-stone-200
                             dark:bg-stone-900 dark:hover:bg-stone-800 dark:border-stone-700"
                  onClick={signOut}>Esci</button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label={`Litri (${wh === 'all' ? 'tutti i magazzini' : (warehouses.find(x=>x.id===wh)?.name || 'magazzino')})`}
                  value={`${totals.liters.toLocaleString(undefined, { maximumFractionDigits: 2 })} L`} />
        <StatCard label="Unità (filtro)" value={totals.units.toLocaleString()} />
        <StatCard label="Varianti (filtro)" value={stockFiltered.length.toString()} />
      </div>

      {/* Giacenze + Filtri (Magazzino/Annata/Lotto/Formato) */}
      <div className="rounded-2xl border bg-white shadow-sm border-stone-200 dark:bg-stone-900 dark:border-stone-700">
        <div className="p-4 md:p-6 border-b border-stone-200 dark:border-stone-700 flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-lg md:text-xl font-semibold">Giacenze</h2>
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <select className="border rounded-lg p-2 bg-white border-stone-200 dark:bg-stone-950 dark:text-stone-100 dark:border-stone-700"
                    value={wh} onChange={e => setWh(e.target.value)} title="Filtra per magazzino">
              <option value="all">Tutti i magazzini</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <select className="border rounded-lg p-2 bg-white border-stone-200 dark:bg-stone-950 dark:text-stone-100 dark:border-stone-700"
                    value={fVintage === 'all' ? 'all' : String(fVintage)}
                    onChange={e => setFVintage(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
              <option value="all">Tutte le annate</option>
              {stockVintages.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <select className="border rounded-lg p-2 bg-white border-stone-200 dark:bg-stone-950 dark:text-stone-100 dark:border-stone-700"
                    value={fLot}
                    onChange={e => setFLot(e.target.value as 'all'|'A'|'B'|'C')}>
              <option value="all">Tutti i lotti</option>
              {stockLots.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <select className="border rounded-lg p-2 bg-white border-stone-200 dark:bg-stone-950 dark:text-stone-100 dark:border-stone-700"
                    value={fSize}
                    onChange={e => setFSize(e.target.value as 'all'|string)}>
              <option value="all">Tutti i formati</option>
              {stockSizes.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button className="rounded-lg border px-3 py-1.5 bg-white hover:bg-stone-50 shadow-sm
                               border-stone-200 dark:bg-stone-900 dark:hover:bg-stone-800 dark:border-stone-700"
                    onClick={() => { setFVintage('all'); setFLot('all'); setFSize('all'); }}>
              Azzera filtri
            </button>
          </div>
        </div>

        <div className="p-4 md:p-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60
                              dark:bg-stone-900/80 dark:supports-[backdrop-filter]:bg-stone-900/60">
              <tr className="border-b font-medium text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700">
                {wh !== 'all' && <th className="text-left p-2">Magazzino</th>}
                <th className="text-left p-2">Annata</th>
                <th className="text-left p-2">Lotto</th>
                <th className="text-left p-2">Formato</th>
                <th className="text-right p-2">Unità</th>
                <th className="text-right p-2">Litri</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
              {stockFiltered.map((r) => (
                <tr key={`${r.variant_id}-${r.warehouse_id ?? 'sum'}`} className="hover:bg-amber-50/40 dark:hover:bg-stone-800/40">
                  {wh !== 'all' && <td className="p-2">{r.warehouse_name}</td>}
                  <td className="p-2">{r.vintage}</td>
                  <td className="p-2">{r.lot_code}</td>
                  <td className="p-2">{r.size_label}</td>
                  <td className="p-2 text-right">{r.units_on_hand}</td>
                  <td className="p-2 text-right">{r.liters_on_hand}</td>
                </tr>
              ))}
              {stockFiltered.length === 0 && (
                <tr><td className="p-2 opacity-60" colSpan={wh !== 'all' ? 6 : 5}>Nessuna variante per i filtri selezionati.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form movimenti (con magazzino) */}
      <div className="rounded-2xl border bg-white shadow-sm border-stone-200 dark:bg-stone-900 dark:border-stone-700">
        <div className="p-4 md:p-6 border-b border-stone-200 dark:border-stone-700">
          <h2 className="text-lg md:text-xl font-semibold">Registra movimento</h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Scegli magazzino, annata, lotto e formato. Usa Rettifica per correzioni (può essere negativa).
          </p>
        </div>
        <div className="p-4 md:p-6">
          <MovementForm
            warehouses={warehouses}
            wh={wh}
            onInserted={async () => { await refreshStock(); setReloadLog(n => n + 1); }}
          />
        </div>
      </div>

      {/* Storico movimenti con filtro Magazzino */}
      <div className="rounded-2xl border bg-white shadow-sm border-stone-200 dark:bg-stone-900 dark:border-stone-700">
        <MovementsLog reloadKey={reloadLog} warehouses={warehouses} />
      </div>
    </div>
  );
}

/* ====== UI helpers ====== */
function RolesChips({ roles }: { roles: Role[] }) {
  const map: Record<Role, { txt: string; cls: string }> = {
    admin:    { txt: 'admin',    cls: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-200 dark:border-purple-800' },
    operator: { txt: 'operator', cls: 'bg-amber-50  text-amber-700  border-amber-200  dark:bg-amber-900/30  dark:text-amber-200  dark:border-amber-800' },
    viewer:   { txt: 'viewer',   cls: 'bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-800/50  dark:text-stone-200 dark:border-stone-700' },
  };
  return (
    <div className="flex items-center gap-1.5">
      {roles.length === 0 && (
        <span className="inline-flex items-center rounded-full border px-2 py-1 text-xs
                         bg-stone-100 text-stone-700 border-stone-200
                         dark:bg-stone-800/50 dark:text-stone-200 dark:border-stone-700">
          viewer
        </span>
      )}
      {roles.map(r => (
        <span key={r} className={`inline-flex items-center rounded-full border px-2 py-1 text-xs ${map[r].cls}`}>
          {map[r].txt}
        </span>
      ))}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white shadow-sm p-4 md:p-6
                    border-stone-200 dark:bg-stone-900 dark:border-stone-700">
      <div className="text-xs uppercase tracking-wide text-stone-500 dark:text-stone-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

/* ====== Form movimenti (warehouse + cascata variante) ====== */
function MovementForm({ onInserted, warehouses, wh }: {
  onInserted: () => void;
  warehouses: WarehouseRow[];
  wh: 'all' | string;
}) {
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [warehouseId, setWarehouseId] = useState<string>('');

  const [selVintage, setSelVintage] = useState<number | null>(null);
  const [selLot, setSelLot] = useState<'A'|'B'|'C' | ''>('');
  const [selSize, setSelSize] = useState<string>('');
  const [variantId, setVariantId] = useState<string>('');
  const [movement, setMovement] = useState<'in' | 'out' | 'adjust'>('in');
  const [qtyInput, setQtyInput] = useState<string>('1');
  const [note, setNote] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);
  const [toast, setToast] = useState<{type:'ok'|'err'; msg:string} | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('v_stock_units').select('*')
        .order('vintage', { ascending: false })
        .order('lot_code', { ascending: true })
        .order('ml', { ascending: true });
      if (!error) {
        const rows = (data ?? []) as VariantRow[];
        setVariants(rows);
        if (rows[0]) { setSelVintage(rows[0].vintage); setSelLot(rows[0].lot_code as 'A'|'B'|'C'); setSelSize(rows[0].size_label); }
      }
    })();
  }, []);

  useEffect(() => {
    if (wh !== 'all') setWarehouseId(wh);
    else if (warehouses[0]) setWarehouseId(warehouses[0].id);
  }, [wh, warehouses]);

  const formVintages = useMemo(() => Array.from(new Set(variants.map(v => v.vintage))).sort((a,b)=>b-a), [variants]);
  const formLots = useMemo(() => {
    const src = selVintage ? variants.filter(v => v.vintage === selVintage) : variants;
    return Array.from(new Set(src.map(v => v.lot_code))).sort() as ('A'|'B'|'C')[];
  }, [variants, selVintage]);
  const formSizes = useMemo(() => {
    const src = variants.filter(v =>
      (selVintage ? v.vintage === selVintage : true) &&
      (selLot ? v.lot_code === selLot : true)
    ).sort((a,b)=>a.ml-b.ml);
    return Array.from(new Set(src.map(v => v.size_label)));
  }, [variants, selVintage, selLot]);

  useEffect(() => {
    if (selVintage && selLot && selSize) {
      const match = variants.find(v => v.vintage === selVintage && v.lot_code === selLot && v.size_label === selSize);
      setVariantId(match?.variant_id ?? '');
    } else { setVariantId(''); }
  }, [variants, selVintage, selLot, selSize]);

  const normalizeQty = (s: string): number => {
    const n = parseInt(s, 10);
    if (movement === 'adjust') { if (Number.isNaN(n) || n === 0) return -1; return n; }
    if (Number.isNaN(n) || n < 1) return 1;
    return n;
  };

  const submit = async () => {
    if (!variantId || !warehouseId || busy) return;
    setBusy(true);
    const qty = normalizeQty(qtyInput);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from('inventory_movements').insert({
      variant_id: variantId, movement, quantity_units: qty,
      warehouse_id: warehouseId, note: note || null, created_by: userData.user?.id ?? null
    });
    setBusy(false);
    if (error) setToast({ type:'err', msg: error.message });
    else { setToast({ type:'ok', msg: 'Movimento registrato' }); setNote(''); setQtyInput(movement === 'adjust' ? '-1' : '1'); onInserted(); }
    setTimeout(() => setToast(null), 2500);
  };

  const mvBtn = (val: 'in'|'out'|'adjust', label: string, cls: string) => (
    <button type="button" onClick={() => { setMovement(val); setQtyInput(val === 'adjust' ? '-1' : '1'); }}
      className={`px-3 py-1.5 text-sm rounded-lg border transition
        ${movement === val ? `${cls} ring-2 ring-offset-1 ring-offset-amber-50 dark:ring-offset-stone-900`
                           : 'bg-white hover:bg-stone-50 dark:bg-stone-900 dark:hover:bg-stone-800 dark:border-stone-700'}`}>
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="inline-flex gap-2 rounded-xl p-1 border bg-stone-50
                      border-stone-200 dark:bg-stone-800/40 dark:border-stone-700">
        {mvBtn('in', 'Ingresso', 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/30 dark:border-green-800 dark:text-green-200')}
        {mvBtn('out','Uscita',   'bg-rose-50  border-rose-200  text-rose-700  dark:bg-rose-900/30  dark:border-rose-800  dark:text-rose-200')}
        {mvBtn('adjust','Rettifica','bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-200')}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
        {/* Magazzino */}
        <select className="border rounded-lg p-2.5 bg-white border-stone-200 dark:bg-stone-950 dark:text-stone-100 dark:border-stone-700"
                value={warehouseId} onChange={e => setWarehouseId(e.target.value)} disabled={wh !== 'all'} title="Magazzino">
          {(wh === 'all' ? warehouses : warehouses.filter(w => w.id === wh))
            .map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>

        {/* Annata */}
        <select className="border rounded-lg p-2.5 bg-white border-stone-200 dark:bg-stone-950 dark:text-stone-100 dark:border-stone-700"
                value={selVintage ?? ''} onChange={e => { const v = e.target.value ? Number(e.target.value) : null; setSelVintage(v); setSelLot(''); setSelSize(''); }}
                title="Annata">
          {formVintages.length === 0 && <option value="">(nessuna)</option>}
          {formVintages.map(v => <option key={v} value={v}>{v}</option>)}
        </select>

        {/* Lotto */}
        <select className="border rounded-lg p-2.5 bg-white border-stone-200 dark:bg-stone-950 dark:text-stone-100 dark:border-stone-700"
                value={selLot} onChange={e => { setSelLot(e.target.value as 'A'|'B'|'C'|''); setSelSize(''); }}
                disabled={!selVintage} title="Lotto">
          {(!selVintage || formLots.length === 0) && <option value="">(seleziona annata)</option>}
          {formLots.map(l => <option key={l} value={l}>{l}</option>)}
        </select>

        {/* Formato */}
        <select className="border rounded-lg p-2.5 bg-white border-stone-200 dark:bg-stone-950 dark:text-stone-100 dark:border-stone-700"
                value={selSize} onChange={e => setSelSize(e.target.value)} disabled={!selVintage || !selLot} title="Formato">
          {(!selVintage || !selLot || formSizes.length === 0) && <option value="">(seleziona lotto)</option>}
          {formSizes.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* Quantità */}
        <input className="border rounded-lg p-2.5 bg-white border-stone-200 dark:bg-stone-950 dark:text-stone-100 dark:border-stone-700"
               type="text" inputMode="numeric" pattern={movement === 'adjust' ? '[0-9-]*' : '[0-9]*'}
               value={qtyInput}
               onFocus={(e) => e.currentTarget.select()}
               onKeyDown={(e) => {
                 const ctl = ['Backspace','Delete','ArrowLeft','ArrowRight','Home','End','Tab','Enter'];
                 const isDigit = /^\d$/.test(e.key);
                 const minusOK = movement === 'adjust' && e.key === '-' && e.currentTarget.selectionStart === 0 && !qtyInput.includes('-');
                 if (isDigit || minusOK || ctl.includes(e.key)) return;
                 e.preventDefault();
               }}
               onChange={(e) => {
                 let v = e.target.value;
                 v = movement === 'adjust' ? v.replace(/[^\d-]/g, '').replace(/(?!^)-/g, '') : v.replace(/[^\d]/g, '');
                 setQtyInput(v);
               }}
               onBlur={() => setQtyInput(String(normalizeQty(qtyInput)))}
               placeholder={movement === 'adjust' ? 'es. -3 per scarto' : 'Quantità'} />

        {/* Salva */}
        <button onClick={submit}
                className="rounded-lg border px-4 py-2.5 bg-amber-600 text-white hover:bg-amber-700 shadow-sm disabled:opacity-60
                           border-amber-700 dark:border-amber-700"
                disabled={busy || !variantId || !warehouseId}
                title={!variantId ? 'Seleziona annata, lotto e formato' : (!warehouseId ? 'Seleziona magazzino' : 'Salva movimento')}>
          {busy ? 'Salvataggio…' : 'Salva'}
        </button>
      </div>

      <input className="w-full border rounded-lg p-2.5 bg-white border-stone-200 dark:bg-stone-950 dark:text-stone-100 dark:border-stone-700"
             placeholder="Nota (facoltativa)" value={note}
             onChange={e=>setNote(e.target.value)}
             onKeyDown={(e)=>{ if (e.key === 'Enter') submit(); }} />

      {toast && (
        <div className={`fixed bottom-5 right-5 rounded-xl border px-4 py-2.5 shadow-lg
                         ${toast.type === 'ok'
                           ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/30 dark:border-green-800 dark:text-green-200'
                           : 'bg-rose-50  border-rose-200  text-rose-800  dark:bg-rose-900/30  dark:border-rose-800  dark:text-rose-200'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

/* ====== Storico movimenti (con filtro Magazzino) ====== */
function MovementsLog({ reloadKey, warehouses }: { reloadKey: number; warehouses: WarehouseRow[] }) {
  const PAGE_SIZE = 50;
  const [rows, setRows] = useState<MovementLogRow[]>([]);
  const [mvType, setMvType] = useState<MovementType>('all');
  const [warehouse, setWarehouse] = useState<'all' | string>('all');
  const [vintage, setVintage] = useState<number | 'all'>('all');
  const [lot, setLot] = useState<string | 'all'>('all');
  const [size, setSize] = useState<string | 'all'>('all');
  const [q, setQ] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const refreshMovements = async () => {
    let query = supabase.from('v_movements_detailed').select('*', { count: 'exact' })
      .order('created_at', { ascending: false }).range(from, to);
    if (mvType !== 'all') query = query.eq('movement', mvType);
    if (warehouse !== 'all') query = query.eq('warehouse_id', warehouse);
    if (vintage !== 'all') query = query.eq('vintage', vintage as number);
    if (lot !== 'all') query = query.eq('lot_code', lot);
    if (size !== 'all') query = query.eq('size_label', size);
    if (q.trim() !== '') {
      const term = q.trim().replace(/%/g, '\\%').replace(/_/g, '\\_');
      query = query.or(`note.ilike.%${term}%,operator_email.ilike.%${term}%`);
    }
    const { data, error, count } = await query;
    if (!error) { setRows((data ?? []) as MovementLogRow[]); setTotal(count ?? 0); }
  };

  useEffect(() => { setPage(1); }, [reloadKey, mvType, warehouse, vintage, lot, size, q]);
  useEffect(() => { void refreshMovements(); }, [page, reloadKey, mvType, warehouse, vintage, lot, size, q]);

  const csvEscape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const exportCsv = () => {
    const header = ['Data','Tipo','Magazzino','Annata','Lotto','Formato','Qtà','Nota','Operatore','Variante'];
    const lines = rows.map(r => [
      new Date(r.created_at).toLocaleString(), r.movement, r.warehouse_name, String(r.vintage), r.lot_code,
      r.size_label, String(r.quantity_units), r.note ?? '', r.operator_email ?? '', r.variant_id
    ].map(x => csvEscape(String(x))).join(','));
    const csv = header.map(csvEscape).join(',') + '\n' + lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = 'movimenti.csv'; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="p-4 md:p-6 border-b border-stone-200 dark:border-stone-700
                      flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <h2 className="text-lg md:text-xl font-semibold">📜 Movimenti (ultimi 200)</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <input className="border rounded-lg p-2 text-sm bg-white border-stone-200 dark:bg-stone-950 dark:text-stone-100 dark:border-stone-700"
                 placeholder="Cerca in Nota o Operatore…" value={q}
                 onChange={e => setQ(e.target.value)} />
          <select className="border rounded-lg p-2 text-sm bg-white border-stone-200 dark:bg-stone-950 dark:text-stone-100 dark:border-stone-700"
                  value={mvType} onChange={e => setMvType(e.target.value as MovementType)}>
            <option value="all">Tutti i tipi</option><option value="in">Ingresso</option>
            <option value="out">Uscita</option><option value="adjust">Rettifica</option>
          </select>
          <select className="border rounded-lg p-2 text-sm bg-white border-stone-200 dark:bg-stone-950 dark:text-stone-100 dark:border-stone-700"
                  value={warehouse} onChange={e => setWarehouse(e.target.value)}>
            <option value="all">Tutti i magazzini</option>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <select className="border rounded-lg p-2 text-sm bg-white border-stone-200 dark:bg-stone-950 dark:text-stone-100 dark:border-stone-700"
                  value={vintage === 'all' ? 'all' : String(vintage)}
                  onChange={e => setVintage(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
            <option value="all">Tutte le annate</option>
            {[...new Set(rows.map(r => r.vintage))].sort((a,b)=>Number(b)-Number(a)).map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <select className="border rounded-lg p-2 text-sm bg-white border-stone-200 dark:bg-stone-950 dark:text-stone-100 dark:border-stone-700"
                  value={lot} onChange={e => setLot(e.target.value)}>
            <option value="all">Tutti i lotti</option>
            {[...new Set(rows.map(r => r.lot_code))].sort().map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <select className="border rounded-lg p-2 text-sm bg-white border-stone-200 dark:bg-stone-950 dark:text-stone-100 dark:border-stone-700"
                  value={size} onChange={e => setSize(e.target.value)}>
            <option value="all">Tutti i formati</option>
            {[...new Set(rows.map(r => r.size_label))].sort().map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button className="rounded-lg border px-3 py-1.5 text-sm bg-white hover:bg-stone-50 shadow-sm
                             border-stone-200 dark:bg-stone-900 dark:hover:bg-stone-800 dark:border-stone-700"
                  onClick={() => { setQ(''); setMvType('all'); setWarehouse('all'); setVintage('all'); setLot('all'); setSize('all'); setPage(1); }}>
            Azzera filtri
          </button>
          <button className="rounded-lg border px-3 py-1.5 text-sm bg-white hover:bg-stone-50 shadow-sm
                             border-stone-200 dark:bg-stone-900 dark:hover:bg-stone-800 dark:border-stone-700"
                  onClick={exportCsv}>Export CSV</button>
        </div>
      </div>

      <div className="p-4 md:p-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60
                            dark:bg-stone-900/80 dark:supports-[backdrop-filter]:bg-stone-900/60">
            <tr className="border-b font-medium text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700">
              <th className="text-left p-2">Data</th>
              <th className="text-left p-2">Tipo</th>
              <th className="text-left p-2">Magazzino</th>
              <th className="text-left p-2">Annata</th>
              <th className="text-left p-2">Lotto</th>
              <th className="text-left p-2">Formato</th>
              <th className="text-right p-2">Qtà</th>
              <th className="text-left p-2">Nota</th>
              <th className="text-left p-2">Operatore</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
            {rows.map(r => (
              <tr key={r.id} className="hover:bg-amber-50/40 dark:hover:bg-stone-800/40">
                <td className="p-2">{new Date(r.created_at).toLocaleString()}</td>
                <td className="p-2"><TypeBadge type={r.movement} /></td>
                <td className="p-2">{r.warehouse_name}</td>
                <td className="p-2">{r.vintage}</td>
                <td className="p-2">{r.lot_code}</td>
                <td className="p-2">{r.size_label}</td>
                <td className="p-2 text-right">{r.quantity_units}</td>
                <td className="p-2">{r.note}</td>
                <td className="p-2">{r.operator_email ?? ''}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td className="p-2 opacity-60" colSpan={9}>Nessun movimento trovato per i filtri selezionati.</td></tr>
            )}
          </tbody>
        </table>

        <Pagination page={page} total={total} pageSize={PAGE_SIZE}
                    onPrev={() => setPage(p => Math.max(1, p - 1))}
                    onNext={() => setPage(p => Math.min(Math.max(1, Math.ceil(total / PAGE_SIZE)), p + 1))} />
      </div>
    </>
  );
}

function Pagination({ page, total, pageSize, onPrev, onNext }:
  { page: number; total: number; pageSize: number; onPrev: () => void; onNext: () => void; }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex items-center justify-between mt-4 text-sm">
      <div className="text-stone-600 dark:text-stone-300">{total > 0 ? <>Mostra {from}–{to} di {total}</> : <>Nessun risultato</>}</div>
      <div className="flex items-center gap-2">
        <button className="rounded-lg border px-3 py-1.5 bg-white hover:bg-stone-50 shadow-sm
                           border-stone-200 dark:bg-stone-900 dark:hover:bg-stone-800 dark:border-stone-700 disabled:opacity-50"
                disabled={page <= 1} onClick={onPrev}>← Precedente</button>
        <span className="min-w-[80px] text-center">Pag. {page}/{totalPages}</span>
        <button className="rounded-lg border px-3 py-1.5 bg-white hover:bg-stone-50 shadow-sm
                           border-stone-200 dark:bg-stone-900 dark:hover:bg-stone-800 dark:border-stone-700 disabled:opacity-50"
                disabled={page >= totalPages} onClick={onNext}>Successiva →</button>
      </div>
    </div>
  );
}

function TypeBadge({ type }: { type: 'in'|'out'|'adjust' }) {
  const map = {
    in:     'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-200 dark:border-green-800',
    out:    'bg-rose-50  text-rose-700  border-rose-200  dark:bg-rose-900/30  dark:text-rose-200  dark:border-rose-800',
    adjust: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800',
  } as const;
  const label = { in: 'Ingresso', out: 'Uscita', adjust: 'Rettifica' }[type];
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${map[type]}`}>{label}</span>;
}
