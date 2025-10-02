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
};

function useSession(): Session | null {
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);
  return session;
}

export default function Home() {
  const session = useSession();
  const [stock, setStock] = useState<StockRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [reloadLog, setReloadLog] = useState<number>(0);

  // ── FILTRI GIACENZE ─────────────────────────────────────────────
  const [fVintage, setFVintage] = useState<number | 'all'>('all');
  const [fLot, setFLot] = useState<'all' | 'A' | 'B' | 'C'>('all');
  const [fSize, setFSize] = useState<'all' | string>('all');

  // ── RECAP VARIANTE ─────────────────────────────────────────────
  const [openVariantId, setOpenVariantId] = useState<string>('');

  const canInsert = useMemo(() => roles.includes('operator') || roles.includes('admin'), [roles]);

  const refreshStock = async () => {
    const { data, error } = await supabase
      .from('v_stock_detailed').select('*')
      .order('vintage', { ascending: false })
      .order('lot_code', { ascending: true })
      .order('ml', { ascending: true });
    if (error) { console.error(error); return; }
    setStock((data ?? []) as StockRow[]);
  };

  useEffect(() => {
    const load = async () => {
      if (!session) return;
      const { data: r1 } = await supabase.from('user_roles').select('role').eq('user_id', session.user.id);
      setRoles(((r1 ?? []) as UserRoleRow[]).map(r => r.role));
      await refreshStock();
    };
    load();
  }, [session]);

  // Opzioni uniche per i filtri giacenze
  const stockVintages = useMemo(() => Array.from(new Set(stock.map(s => s.vintage))).sort((a, b) => b - a), [stock]);
  const stockLots = useMemo(() => Array.from(new Set(stock.map(s => s.lot_code))).sort(), [stock]);
  const stockSizes = useMemo(() => {
    const ordered = [...stock].sort((a, b) => a.ml - b.ml);
    return Array.from(new Set(ordered.map(s => s.size_label)));
  }, [stock]);

  // Applica filtri alla tabella giacenze
  const stockFiltered = useMemo(() => {
    return stock.filter(s =>
      (fVintage === 'all' || s.vintage === fVintage) &&
      (fLot === 'all' || s.lot_code === fLot) &&
      (fSize === 'all' || s.size_label === fSize)
    );
  }, [stock, fVintage, fLot, fSize]);

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
            Magazzino annate 2024–2025 · Lotti A/B/C · Formati 250/500 ml e 5 L
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ThemeToggle />
          <RolesChips roles={roles} />
          <button
            className="inline-flex items-center rounded-lg border px-3 py-1.5 text-sm shadow-sm
                       bg-white hover:bg-stone-50 border-stone-200
                       dark:bg-stone-900 dark:hover:bg-stone-800 dark:border-stone-700"
            onClick={signOut}
          >
            Esci
          </button>
        </div>
      </div>

      {/* Stat cards (sui dati filtrati) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Litri (filtro)" value={`${totals.liters.toLocaleString(undefined, { maximumFractionDigits: 2 })} L`} />
        <StatCard label="Unità (filtro)" value={totals.units.toLocaleString()} />
        <StatCard label="Varianti (filtro)" value={stockFiltered.length.toString()} />
      </div>

      {/* Giacenze con filtri + Dettagli variante */}
      <div className="rounded-2xl border bg-white shadow-sm border-stone-200 dark:bg-stone-900 dark:border-stone-700">
        <div className="p-4 md:p-6 border-b border-stone-200 dark:border-stone-700 flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-lg md:text-xl font-semibold">Giacenze</h2>
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <select
              className="border rounded-lg p-2 bg-white border-stone-200 dark:bg-stone-950 dark:text-stone-100 dark:border-stone-700"
              value={fVintage === 'all' ? 'all' : String(fVintage)}
              onChange={e => setFVintage(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            >
              <option value="all">Tutte le annate</option>
              {stockVintages.map(v => <option key={v} value={v}>{v}</option>)}
            </select>

            <select
              className="border rounded-lg p-2 bg-white border-stone-200 dark:bg-stone-950 dark:text-stone-100 dark:border-stone-700"
              value={fLot}
              onChange={e => setFLot(e.target.value as 'all'|'A'|'B'|'C')}
            >
              <option value="all">Tutti i lotti</option>
              {stockLots.map(l => <option key={l} value={l}>{l}</option>)}
            </select>

            <select
              className="border rounded-lg p-2 bg-white border-stone-200 dark:bg-stone-950 dark:text-stone-100 dark:border-stone-700"
              value={fSize}
              onChange={e => setFSize(e.target.value as 'all'|string)}
            >
              <option value="all">Tutti i formati</option>
              {stockSizes.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <button
              className="rounded-lg border px-3 py-1.5 bg-white hover:bg-stone-50 shadow-sm
                         border-stone-200 dark:bg-stone-900 dark:hover:bg-stone-800 dark:border-stone-700"
              onClick={() => { setFVintage('all'); setFLot('all'); setFSize('all'); }}
            >
              Azzera filtri
            </button>
          </div>
        </div>

        <div className="p-4 md:p-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60
                              dark:bg-stone-900/80 dark:supports-[backdrop-filter]:bg-stone-900/60">
              <tr className="border-b font-medium text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700">
                <th className="text-left p-2">Annata</th>
                <th className="text-left p-2">Lotto</th>
                <th className="text-left p-2">Formato</th>
                <th className="text-right p-2">Unità</th>
                <th className="text-right p-2">Litri</th>
                <th className="text-right p-2">Dettagli</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
              {stockFiltered.map((r) => (
                <tr key={r.variant_id} className="hover:bg-amber-50/40 dark:hover:bg-stone-800/40">
                  <td className="p-2">{r.vintage}</td>
                  <td className="p-2">{r.lot_code}</td>
                  <td className="p-2">{r.size_label}</td>
                  <td className="p-2 text-right">{r.units_on_hand}</td>
                  <td className="p-2 text-right">{r.liters_on_hand}</td>
                  <td className="p-2 text-right">
                    <button
                      className={`text-sm underline ${openVariantId === r.variant_id ? 'text-amber-700 dark:text-amber-300' : 'text-stone-700 dark:text-stone-200'}`}
                      onClick={() => setOpenVariantId(prev => prev === r.variant_id ? '' : r.variant_id)}
                    >
                      {openVariantId === r.variant_id ? 'Chiudi' : 'Dettagli'}
                    </button>
                  </td>
                </tr>
              ))}
              {stockFiltered.length === 0 && (
                <tr><td className="p-2 opacity-60" colSpan={6}>Nessuna variante per i filtri selezionati.</td></tr>
              )}
            </tbody>
          </table>

          {openVariantId && (
            <div className="mt-6">
              <VariantRecap variantId={openVariantId} onClose={() => setOpenVariantId('')} />
            </div>
          )}
        </div>
      </div>

      {/* Form movimenti con selezione a cascata Annata → Lotto → Formato */}
      <div className="rounded-2xl border bg-white shadow-sm border-stone-200 dark:bg-stone-900 dark:border-stone-700">
        <div className="p-4 md:p-6 border-b border-stone-200 dark:border-stone-700">
          <h2 className="text-lg md:text-xl font-semibold">Registra movimento</h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Usa Rettifica per correzioni inventariali (può essere negativa). Scegli annata, lotto e formato per identificare la variante.
          </p>
        </div>
        <div className="p-4 md:p-6">
          <MovementForm
            onInserted={async () => { await refreshStock(); setReloadLog(n => n + 1); }}
          />
        </div>
      </div>

      {/* Storico movimenti con ricerca & paginazione */}
      <div className="rounded-2xl border bg-white shadow-sm border-stone-200 dark:bg-stone-900 dark:border-stone-700">
        <MovementsLog
          reloadKey={reloadLog}
          vintages={stockVintages}
          lots={stockLots}
          sizes={stockSizes}
        />
      </div>
    </div>
  );
}

/* ====== piccoli componenti UI ====== */
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

/* ====== Form movimenti con menu a tendina a cascata ====== */
function MovementForm({ onInserted }: { onInserted: () => void }) {
  const [variants, setVariants] = useState<VariantRow[]>([]);
  // selezioni a cascata
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
    const load = async () => {
      const { data, error } = await supabase
        .from('v_stock_units').select('*')
        .order('vintage', { ascending: false })
        .order('lot_code', { ascending: true })
        .order('ml', { ascending: true });
      if (error) { console.error(error); return; }
      const rows = (data ?? []) as VariantRow[];
      setVariants(rows);
      if (rows[0]) {
        setSelVintage(rows[0].vintage);
        setSelLot(rows[0].lot_code as 'A'|'B'|'C');
        setSelSize(rows[0].size_label);
      }
    };
    load();
  }, []);

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
    } else {
      setVariantId('');
    }
  }, [variants, selVintage, selLot, selSize]);

  const normalizeQty = (s: string): number => {
    const n = parseInt(s, 10);
    if (movement === 'adjust') {
      if (Number.isNaN(n) || n === 0) return -1;
      return n;
    }
    if (Number.isNaN(n) || n < 1) return 1;
    return n;
  };

  const submit = async () => {
    if (!variantId || busy) return;
    setBusy(true);
    const qty = normalizeQty(qtyInput);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from('inventory_movements').insert({
      variant_id: variantId, movement, quantity_units: qty,
      note: note || null, created_by: userData.user?.id ?? null
    });
    setBusy(false);
    if (error) {
      setToast({ type:'err', msg: error.message });
    } else {
      setToast({ type:'ok', msg: 'Movimento registrato' });
      setNote(''); setQtyInput(movement === 'adjust' ? '-1' : '1');
      onInserted();
    }
    setTimeout(() => setToast(null), 2500);
  };

  const mvBtn = (val: 'in'|'out'|'adjust', label: string, cls: string) => (
    <button
      type="button"
      onClick={() => { setMovement(val); setQtyInput(val === 'adjust' ? '-1' : '1'); }}
      className={`px-3 py-1.5 text-sm rounded-lg border transition
        ${movement === val ? `${cls} ring-2 ring-offset-1 ring-offset-amber-50 dark:ring-offset-stone-900`
                           : 'bg-white hover:bg-stone-50 dark:bg-stone-900 dark:hover:bg-stone-800 dark:border-stone-700'}
      `}
    >
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

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <select
          className="border rounded-lg p-2.5 bg-white border-stone-200 dark:bg-stone-950 dark:text-stone-100 dark:border-stone-700"
          value={selVintage ?? ''}
          onChange={e => {
            const v = e.target.value ? Number(e.target.value) : null;
            setSelVintage(v); setSelLot(''); setSelSize('');
          }}
        >
          {formVintages.length === 0 && <option value="">(nessuna)</option>}
          {formVintages.map(v => <option key={v} value={v}>{v}</option>)}
        </select>

        <select
          className="border rounded-lg p-2.5 bg-white border-stone-200 dark:bg-stone-950 dark:text-stone-100 dark:border-stone-700"
          value={selLot}
          onChange={e => { setSelLot(e.target.value as 'A'|'B'|'C'|''); setSelSize(''); }}
          disabled={!selVintage}
        >
          {(!selVintage || formLots.length === 0) && <option value="">(seleziona annata)</option>}
          {formLots.map(l => <option key={l} value={l}>{l}</option>)}
        </select>

        <select
          className="border rounded-lg p-2.5 bg-white border-stone-200 dark:bg-stone-950 dark:text-stone-100 dark:border-stone-700"
          value={selSize}
          onChange={e => setSelSize(e.target.value)}
          disabled={!selVintage || !selLot}
        >
          {(!selVintage || !selLot || formSizes.length === 0) && <option value="">(seleziona lotto)</option>}
          {formSizes.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <input
          className="border rounded-lg p-2.5 bg-white border-stone-200
                     dark:bg-stone-950 dark:text-stone-100 dark:border-stone-700"
          type="text" inputMode="numeric"
          pattern={movement === 'adjust' ? '[0-9-]*' : '[0-9]*'}
          value={qtyInput}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => {
            const ctl = ['Backspace','Delete','ArrowLeft','ArrowRight','Home','End','Tab','Enter'];
            const isDigit = /^\d$/.test(e.key);
            const minusOK = movement === 'adjust' && e.key === '-' &&
                            e.currentTarget.selectionStart === 0 && !qtyInput.includes('-');
            if (isDigit || minusOK || ctl.includes(e.key)) return;
            e.preventDefault();
          }}
          onChange={(e) => {
            let v = e.target.value;
            v = movement === 'adjust' ? v.replace(/[^\d-]/g, '').replace(/(?!^)-/g, '') : v.replace(/[^\d]/g, '');
            setQtyInput(v);
          }}
          onBlur={() => setQtyInput(String(normalizeQty(qtyInput)))}
          placeholder={movement === 'adjust' ? 'es. -3 per scarto' : 'Quantità'}
        />

        <button
          onClick={submit}
          className="rounded-lg border px-4 py-2.5 bg-amber-600 text-white hover:bg-amber-700 shadow-sm disabled:opacity-60
                     border-amber-700 dark:border-amber-700"
          disabled={busy || !variantId}
          title={!variantId ? 'Seleziona annata, lotto e formato' : 'Salva movimento'}
        >
          {busy ? 'Salvataggio…' : 'Salva'}
        </button>
      </div>

      <input
        className="w-full border rounded-lg p-2.5 bg-white border-stone-200
                   dark:bg-stone-950 dark:text-stone-100 dark:border-stone-700"
        placeholder="Nota (facoltativa)"
        value={note}
        onChange={e=>setNote(e.target.value)}
        onKeyDown={(e)=>{ if (e.key === 'Enter') submit(); }}
      />

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

/* ====== Storico movimenti: ricerca + paginazione ====== */
function MovementsLog({ reloadKey, vintages, lots, sizes }: { reloadKey: number; vintages: number[]; lots: string[]; sizes: string[] }) {
  const PAGE_SIZE = 50;
  const [rows, setRows] = useState<MovementLogRow[]>([]);
  const [mvType, setMvType] = useState<MovementType>('all');
  const [vintage, setVintage] = useState<number | 'all'>('all');
  const [lot, setLot] = useState<string | 'all'>('all');
  const [size, setSize] = useState<string | 'all'>('all');
  const [q, setQ] = useState<string>(''); // search in note or operator_email

  const [page, setPage] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const refreshMovements = async () => {
    let query = supabase
      .from('v_movements_detailed')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (mvType !== 'all') query = query.eq('movement', mvType);
    if (vintage !== 'all') query = query.eq('vintage', vintage as number);
    if (lot !== 'all') query = query.eq('lot_code', lot);
    if (size !== 'all') query = query.eq('size_label', size);
    if (q.trim() !== '') {
      const term = q.trim().replace(/%/g, '\\%').replace(/_/g, '\\_');
      query = query.or(`note.ilike.%${term}%,operator_email.ilike.%${term}%`);
    }

    const { data, error, count } = await query;
    if (error) { console.error(error); return; }
    setRows((data ?? []) as MovementLogRow[]);
    setTotal(count ?? 0);
  };

  // debounce search & watchers
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); }, 0); // reset page when filters change
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mvType, vintage, lot, size, q, reloadKey]);

  useEffect(() => { refreshMovements(); }, [page, mvType, vintage, lot, size, q, reloadKey]);

  const csvEscape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const exportCsv = () => {
    const header = ['Data','Tipo','Annata','Lotto','Formato','Qtà','Nota','Operatore','Variante'];
    const lines = rows.map(r => [
      new Date(r.created_at).toLocaleString(), r.movement, String(r.vintage), r.lot_code,
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
          <input
            className="border rounded-lg p-2 text-sm bg-white border-stone-200
                       dark:bg-stone-950 dark:text-stone-100 dark:border-stone-700"
            placeholder="Cerca in Nota o Operatore…"
            value={q}
            onChange={e => { setQ(e.target.value); setPage(1); }}
          />

          <select className="border rounded-lg p-2 text-sm bg-white border-stone-200 dark:bg-stone-950 dark:text-stone-100 dark:border-stone-700"
                  value={mvType} onChange={e => { setMvType(e.target.value as MovementType); setPage(1); }}>
            <option value="all">Tutti i tipi</option>
            <option value="in">Ingresso</option>
            <option value="out">Uscita</option>
            <option value="adjust">Rettifica</option>
          </select>

          <select className="border rounded-lg p-2 text-sm bg-white border-stone-200 dark:bg-stone-950 dark:text-stone-100 dark:border-stone-700"
                  value={vintage === 'all' ? 'all' : String(vintage)}
                  onChange={e => { setVintage(e.target.value === 'all' ? 'all' : Number(e.target.value)); setPage(1); }}>
            <option value="all">Tutte le annate</option>
            {vintages.map(v => <option key={v} value={v}>{v}</option>)}
          </select>

          <select className="border rounded-lg p-2 text-sm bg-white border-stone-200 dark:bg-stone-950 dark:text-stone-100 dark:border-stone-700"
                  value={lot} onChange={e => { setLot(e.target.value); setPage(1); }}>
            <option value="all">Tutti i lotti</option>
            {lots.map(l => <option key={l} value={l}>{l}</option>)}
          </select>

          <select className="border rounded-lg p-2 text-sm bg-white border-stone-200 dark:bg-stone-950 dark:text-stone-100 dark:border-stone-700"
                  value={size} onChange={e => { setSize(e.target.value); setPage(1); }}>
            <option value="all">Tutti i formati</option>
            {sizes.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <button className="rounded-lg border px-3 py-1.5 text-sm bg-white hover:bg-stone-50 shadow-sm
                             border-stone-200 dark:bg-stone-900 dark:hover:bg-stone-800 dark:border-stone-700"
                  onClick={() => { setQ(''); setMvType('all'); setVintage('all'); setLot('all'); setSize('all'); setPage(1); }}>
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
                <td className="p-2">{r.vintage}</td>
                <td className="p-2">{r.lot_code}</td>
                <td className="p-2">{r.size_label}</td>
                <td className="p-2 text-right">{r.quantity_units}</td>
                <td className="p-2">{r.note}</td>
                <td className="p-2">{r.operator_email ?? ''}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td className="p-2 opacity-60" colSpan={8}>Nessun movimento trovato per i filtri selezionati.</td></tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-4 text-sm">
          <div className="text-stone-600 dark:text-stone-300">
            {total > 0
              ? <>Mostra {Math.min(total, from + 1)}–{Math.min(total, to + 1)} di {total}</>
              : <>Nessun risultato</>}
          </div>
          <div className="flex items-center gap-2">
            <button
              className="rounded-lg border px-3 py-1.5 bg-white hover:bg-stone-50 shadow-sm
                         border-stone-200 dark:bg-stone-900 dark:hover:bg-stone-800 dark:border-stone-700 disabled:opacity-50"
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >← Precedente</button>
            <span className="min-w-[80px] text-center">Pag. {page}/{totalPages}</span>
            <button
              className="rounded-lg border px-3 py-1.5 bg-white hover:bg-stone-50 shadow-sm
                         border-stone-200 dark:bg-stone-900 dark:hover:bg-stone-800 dark:border-stone-700 disabled:opacity-50"
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            >Successiva →</button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ====== Recap variante: ultimo (o ultimi 5) movimenti ====== */
function VariantRecap({ variantId, onClose }: { variantId: string; onClose: () => void }) {
  const [rows, setRows] = useState<MovementLogRow[]>([]);
  const [limit, setLimit] = useState<number>(1);

  const load = async () => {
    const { data, error } = await supabase
      .from('v_movements_detailed')
      .select('*')
      .eq('variant_id', variantId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) { console.error(error); return; }
    setRows((data ?? []) as MovementLogRow[]);
  };

  useEffect(() => { load(); }, [variantId, limit]);

  const head = rows[0];
  if (!head) return (
    <div className="rounded-xl border p-4 text-sm border-stone-200 dark:border-stone-700">
      Nessun movimento per questa variante. <button className="underline ml-2" onClick={onClose}>Chiudi</button>
    </div>
  );

  return (
    <div className="rounded-xl border p-4 md:p-5 border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900">
      <div className="flex items-center justify-between">
        <div className="text-sm">
          <div className="font-semibold">Dettagli variante</div>
          <div className="text-stone-500 dark:text-stone-400">
            Annata {head.vintage} · Lotto {head.lot_code} · {head.size_label}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded-lg border px-3 py-1.5 text-sm bg-white hover:bg-stone-50 shadow-sm
                       border-stone-200 dark:bg-stone-900 dark:hover:bg-stone-800 dark:border-stone-700"
            onClick={() => setLimit(l => (l === 1 ? 5 : 1))}
          >
            {limit === 1 ? 'Mostra ultimi 5' : 'Mostra ultimo'}
          </button>
          <button className="text-sm underline" onClick={onClose}>Chiudi</button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b font-medium text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700">
              <th className="text-left p-2">Data</th>
              <th className="text-left p-2">Tipo</th>
              <th className="text-right p-2">Qtà</th>
              <th className="text-left p-2">Nota</th>
              <th className="text-left p-2">Operatore</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
            {rows.map(r => (
              <tr key={r.id}>
                <td className="p-2">{new Date(r.created_at).toLocaleString()}</td>
                <td className="p-2"><TypeBadge type={r.movement} /></td>
                <td className="p-2 text-right">{r.quantity_units}</td>
                <td className="p-2">{r.note}</td>
                <td className="p-2">{r.operator_email ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${map[type]}`}>
      {label}
    </span>
  );
}
console.log('SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 28));
console.log('ANON_KEY_START', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.slice(0, 10));
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Filters from './components/Filters';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function Page() {
  const [filters, setFilters] = useState<{year?: string; lot?: string; format_ml?: string; warehouse_id?: string}>({});
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      let q = supabase.from('v_current_stock').select(`
        year, lot, format_ml, qty_ml, warehouse_id,
        warehouses!inner(name)
      `).order('year', { ascending: false });

      if (filters.year) q = q.eq('year', Number(filters.year));
      if (filters.lot) q = q.eq('lot', filters.lot);
      if (filters.format_ml) q = q.eq('format_ml', Number(filters.format_ml));
      if (filters.warehouse_id) q = q.eq('warehouse_id', filters.warehouse_id);

      const { data } = await q;
      setRows(data ?? []);
    })();
  }, [filters]);

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Giacenze Olio</h1>
      <Filters onChange={(f) => setFilters(prev => ({ ...prev, ...f }))} />
      <div className="overflow-auto rounded-2xl border p-3">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="p-2">Annata</th>
              <th className="p-2">Lotto</th>
              <th className="p-2">Formato</th>
              <th className="p-2">Magazzino</th>
              <th className="p-2">Quantità (ml)</th>
              <th className="p-2">Bottiglie</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t">
                <td className="p-2">{r.year}</td>
                <td className="p-2">{r.lot}</td>
                <td className="p-2">{r.format_ml === 5000 ? '5 L' : `${r.format_ml} ml`}</td>
                <td className="p-2">{r.warehouses?.name ?? r.warehouse_id}</td>
                <td className="p-2">{r.qty_ml}</td>
                <td className="p-2">{Math.floor(r.qty_ml / r.format_ml)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
