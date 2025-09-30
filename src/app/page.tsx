'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import AuthBox from '@/components/Auth';
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

  const totals = useMemo(() => {
    const liters = stock.reduce((s, r) => s + (r.liters_on_hand ?? 0), 0);
    const units  = stock.reduce((s, r) => s + (r.units_on_hand ?? 0), 0);
    return { liters, units };
  }, [stock]);

  const signOut = async () => { await supabase.auth.signOut(); };

  if (!session) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight">🫒 Gestione Olio</h1>
        <p className="text-stone-600">Accedi con la tua email per entrare nel magazzino.</p>
        <div className="rounded-2xl border bg-white shadow-sm p-6">
          <AuthBox />
        </div>
      </div>
    );
  }

  const vintages = Array.from(new Set(stock.map(s => s.vintage))).sort((a, b) => b - a);

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-700 to-amber-500">
              Gestione Olio
            </span>
          </h1>
          <p className="text-sm text-stone-500">Magazzino annate 2024–2025 · Lotti A/B/C · Formati 250/500 ml e 5 L</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <RolesChips roles={roles} />
          <button className="inline-flex items-center rounded-lg border px-3 py-1.5 text-sm shadow-sm hover:bg-stone-50"
                  onClick={signOut}>Esci</button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Litri totali" value={`${totals.liters.toLocaleString(undefined, { maximumFractionDigits: 2 })} L`} />
        <StatCard label="Unità totali" value={totals.units.toLocaleString()} />
        <StatCard label="Varianti" value={stock.length.toString()} />
      </div>

      {/* Giacenze */}
      <div className="rounded-2xl border bg-white shadow-sm">
        <div className="p-4 md:p-6 border-b flex items-center justify-between">
          <h2 className="text-lg md:text-xl font-semibold">Giacenze</h2>
          <span className="text-xs md:text-sm text-stone-500">Aggiorna con i movimenti</span>
        </div>
        <div className="p-4 md:p-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
              <tr className="border-b font-medium text-stone-600">
                <th className="text-left p-2">Annata</th>
                <th className="text-left p-2">Lotto</th>
                <th className="text-left p-2">Formato</th>
                <th className="text-right p-2">Unità</th>
                <th className="text-right p-2">Litri</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {stock.map((r) => (
                <tr key={r.variant_id} className="hover:bg-amber-50/40">
                  <td className="p-2">{r.vintage}</td>
                  <td className="p-2">{r.lot_code}</td>
                  <td className="p-2">{r.size_label}</td>
                  <td className="p-2 text-right">{r.units_on_hand}</td>
                  <td className="p-2 text-right">{r.liters_on_hand}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form movimenti */}
      {canInsert ? (
        <div className="rounded-2xl border bg-white shadow-sm">
          <div className="p-4 md:p-6 border-b">
            <h2 className="text-lg md:text-xl font-semibold">Registra movimento</h2>
            <p className="text-xs text-stone-500 mt-1">Usa Rettifica per correzioni inventariali (può essere negativa).</p>
          </div>
          <div className="p-4 md:p-6">
            <MovementForm onInserted={async () => { await refreshStock(); setReloadLog(n => n + 1); }} />
          </div>
        </div>
      ) : (
        <p className="text-sm opacity-80">Hai permessi di sola lettura (viewer).</p>
      )}

      {/* Storico movimenti */}
      <div className="rounded-2xl border bg-white shadow-sm">
        <MovementsLog reloadKey={reloadLog} vintages={vintages} />
      </div>
    </div>
  );
}

/* ====== piccoli componenti UI ====== */
function RolesChips({ roles }: { roles: Role[] }) {
  const map: Record<Role, { txt: string; cls: string }> = {
    admin:    { txt: 'admin',    cls: 'bg-purple-50 text-purple-700 border-purple-200' },
    operator: { txt: 'operator', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    viewer:   { txt: 'viewer',   cls: 'bg-stone-100 text-stone-700 border-stone-200' },
  };
  return (
    <div className="flex items-center gap-1.5">
      {roles.length === 0 && (
        <span className="inline-flex items-center rounded-full border px-2 py-1 text-xs bg-stone-100 text-stone-700 border-stone-200">
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
    <div className="rounded-2xl border bg-white shadow-sm p-4 md:p-6">
      <div className="text-xs uppercase tracking-wide text-stone-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

/* ====== Form movimenti (UX rifinita) ====== */
function MovementForm({ onInserted }: { onInserted: () => void }) {
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [variantId, setVariantId] = useState<string>('');
  const [movement, setMovement] = useState<'in' | 'out' | 'adjust'>('in');
  const [qtyInput, setQtyInput] = useState<string>('1');      // string -> digitazione libera
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
      if (rows[0]) setVariantId(rows[0].variant_id);
    };
    load();
  }, []);

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
      variant_id: variantId,
      movement, quantity_units: qty,
      note: note || null,
      created_by: userData.user?.id ?? null
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
        ${movement === val ? `${cls} ring-2 ring-offset-1` : 'bg-white hover:bg-stone-50'}
      `}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      {/* segmented control */}
      <div className="inline-flex gap-2 rounded-xl p-1 border bg-stone-50">
        {mvBtn('in', 'Ingresso', 'bg-green-50 border-green-200 text-green-700')}
        {mvBtn('out','Uscita',   'bg-rose-50  border-rose-200  text-rose-700')}
        {mvBtn('adjust','Rettifica','bg-amber-50 border-amber-200 text-amber-700')}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <select className="border rounded-lg p-2.5 bg-white"
                value={variantId} onChange={e=>setVariantId(e.target.value)}>
          {variants.map(v => (
            <option key={v.variant_id} value={v.variant_id}>
              {v.vintage} · Lotto {v.lot_code} · {v.size_label}
            </option>
          ))}
        </select>

        <input
          className="border rounded-lg p-2.5 bg-white"
          type="text"
          inputMode="numeric"
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

        <input className="border rounded-lg p-2.5 bg-white" placeholder="Nota (facoltativa)"
               value={note} onChange={e=>setNote(e.target.value)}
               onKeyDown={(e)=>{ if (e.key === 'Enter') submit(); }} />

        <button onClick={submit}
                className="rounded-lg border px-4 py-2.5 bg-amber-600 text-white hover:bg-amber-700 shadow-sm disabled:opacity-60"
                disabled={busy}>
          {busy ? 'Salvataggio…' : 'Salva'}
        </button>
      </div>

      {/* toast semplice */}
      {toast && (
        <div className={`fixed bottom-5 right-5 rounded-xl border px-4 py-2.5 shadow-lg
                         ${toast.type === 'ok' ? 'bg-green-50 border-green-200 text-green-800'
                                               : 'bg-rose-50  border-rose-200  text-rose-800'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

/* ====== Storico movimenti (con badge & CSV) ====== */
function MovementsLog({ reloadKey, vintages }: { reloadKey: number; vintages: number[] }) {
  const [rows, setRows] = useState<MovementLogRow[]>([]);
  const [mvType, setMvType] = useState<MovementType>('all');
  const [vintage, setVintage] = useState<number | 'all'>('all');

  const refreshMovements = async () => {
    let q = supabase.from('v_movements_detailed').select('*')
      .order('created_at', { ascending: false }).limit(200);
    if (mvType !== 'all') q = q.eq('movement', mvType);
    if (vintage !== 'all') q = q.eq('vintage', vintage as number);
    const { data, error } = await q;
    if (error) { console.error(error); return; }
    setRows((data ?? []) as MovementLogRow[]);
  };

  useEffect(() => { refreshMovements(); }, [reloadKey, mvType, vintage]);

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
      <div className="p-4 md:p-6 border-b flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <h2 className="text-lg md:text-xl font-semibold">📜 Movimenti (ultimi 200)</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <select className="border rounded-lg p-2 text-sm bg-white" value={mvType}
                  onChange={e => setMvType(e.target.value as MovementType)}>
            <option value="all">Tutti i tipi</option>
            <option value="in">Ingresso</option>
            <option value="out">Uscita</option>
            <option value="adjust">Rettifica</option>
          </select>
          <select className="border rounded-lg p-2 text-sm bg-white"
                  value={vintage === 'all' ? 'all' : String(vintage)}
                  onChange={e => setVintage(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
            <option value="all">Tutte le annate</option>
            {vintages.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <button className="rounded-lg border px-3 py-1.5 text-sm bg-white hover:bg-stone-50 shadow-sm" onClick={refreshMovements}>Aggiorna</button>
          <button className="rounded-lg border px-3 py-1.5 text-sm bg-white hover:bg-stone-50 shadow-sm" onClick={exportCsv}>Export CSV</button>
        </div>
      </div>

      <div className="p-4 md:p-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
            <tr className="border-b font-medium text-stone-600">
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
          <tbody className="divide-y">
            {rows.map(r => (
              <tr key={r.id} className="hover:bg-amber-50/40">
                <td className="p-2">{new Date(r.created_at).toLocaleString()}</td>
                <td className="p-2">
                  <TypeBadge type={r.movement} />
                </td>
                <td className="p-2">{r.vintage}</td>
                <td className="p-2">{r.lot_code}</td>
                <td className="p-2">{r.size_label}</td>
                <td className="p-2 text-right">{r.quantity_units}</td>
                <td className="p-2">{r.note}</td>
                <td className="p-2">{r.operator_email ?? ''}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td className="p-2 opacity-60" colSpan={8}>Nessun movimento trovato.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function TypeBadge({ type }: { type: 'in'|'out'|'adjust' }) {
  const map = {
    in:     'bg-green-50 text-green-700 border-green-200',
    out:    'bg-rose-50  text-rose-700  border-rose-200',
    adjust: 'bg-amber-50 text-amber-700 border-amber-200',
  } as const;
  const label = { in: 'Ingresso', out: 'Uscita', adjust: 'Rettifica' }[type];
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${map[type]}`}>
      {label}
    </span>
  );
}
