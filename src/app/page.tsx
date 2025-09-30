'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import AuthBox from '@/components/Auth';
import type { Session } from '@supabase/supabase-js';

type Role = 'viewer' | 'operator' | 'admin';
type MovementType = 'all' | 'in' | 'out' | 'adjust';

type UserRoleRow = {
  role: Role;
};

type StockRow = {
  variant_id: string;
  lot_id: string;
  lot_code: string;
  vintage: number;
  size_id: string;
  size_label: string;
  ml: number;
  units_on_hand: number;
  liters_on_hand: number;
};

type VariantRow = {
  variant_id: string;
  lot_id: string;
  lot_code: string;
  vintage: number;
  size_id: string;
  size_label: string;
  ml: number;
  units_on_hand: number;
};

type MovementLogRow = {
  id: string;
  created_at: string;
  movement: 'in' | 'out' | 'adjust';
  quantity_units: number;
  note: string | null;
  variant_id: string;
  vintage: number;
  lot_code: string;
  size_label: string;
  ml: number;
  created_by: string | null;
  operator_email: string | null;
};

function useSession(): Session | null {
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
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
      .from('v_stock_detailed')
      .select('*')
      .order('vintage', { ascending: false })
      .order('lot_code', { ascending: true })
      .order('ml', { ascending: true });
    if (error) {
      console.error(error);
      return;
    }
    setStock((data ?? []) as StockRow[]);
  };

  useEffect(() => {
    const load = async () => {
      if (!session) return;

      const { data: r1, error: e1 } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id);
      if (e1) console.error(e1);
      setRoles(((r1 ?? []) as UserRoleRow[]).map(r => r.role));

      await refreshStock();
    };
    load();
  }, [session]);

  const signOut = async () => { await supabase.auth.signOut(); };

  if (!session) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Gestione Olio</h1>
        <AuthBox />
      </div>
    );
  }

  const vintages = Array.from(new Set(stock.map(s => s.vintage))).sort((a, b) => b - a);

  return (
    <div className="space-y-10">
      {/* Header + ruoli */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Giacenze</h1>
        <div className="text-sm flex items-center gap-3">
          <span>Ruoli: {roles.join(', ') || 'viewer'}</span>
          <button className="border rounded px-3 py-1" onClick={signOut}>Esci</button>
        </div>
      </div>

      {/* Tabella giacenze */}
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b font-medium">
            <th className="text-left p-2">Annata</th>
            <th className="text-left p-2">Lotto</th>
            <th className="text-left p-2">Formato</th>
            <th className="text-right p-2">Unità</th>
            <th className="text-right p-2">Litri</th>
          </tr>
        </thead>
        <tbody>
          {stock.map((r) => (
            <tr key={r.variant_id} className="border-b">
              <td className="p-2">{r.vintage}</td>
              <td className="p-2">{r.lot_code}</td>
              <td className="p-2">{r.size_label}</td>
              <td className="p-2 text-right">{r.units_on_hand}</td>
              <td className="p-2 text-right">{r.liters_on_hand}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Form movimenti */}
      {canInsert && (
        <MovementForm
          onInserted={async () => {
            await refreshStock();
            setReloadLog((n) => n + 1); // aggiorna lo storico movimenti
          }}
        />
      )}
      {!canInsert && <p className="text-sm opacity-80">Hai permessi di sola lettura (viewer).</p>}

      {/* Storico Movimenti */}
      <MovementsLog reloadKey={reloadLog} vintages={vintages} />
    </div>
  );
}

function MovementForm({ onInserted }: { onInserted: () => void }) {
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [variantId, setVariantId] = useState<string>('');
  const [movement, setMovement] = useState<'in' | 'out' | 'adjust'>('in');
  // Quantità come stringa; consentiamo '-' SOLO per 'adjust'
  const [qtyInput, setQtyInput] = useState<string>('1');
  const [note, setNote] = useState<string>('');

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('v_stock_units')
        .select('*')
        .order('vintage', { ascending: false })
        .order('lot_code', { ascending: true })
        .order('ml', { ascending: true });
      if (error) {
        console.error(error);
        return;
      }
      const rows = (data ?? []) as VariantRow[];
      setVariants(rows);
      if (rows[0]) setVariantId(rows[0].variant_id);
    };
    load();
  }, []);

  const normalizeQty = (s: string): number => {
    const n = parseInt(s, 10);
    if (movement === 'adjust') {
      if (Number.isNaN(n) || n === 0) return -1; // rettifica non può essere zero
      return n;
    }
    if (Number.isNaN(n) || n < 1) return 1; // in/out min 1
    return n;
  };

  const submit = async () => {
    if (!variantId) return;
    const qty = normalizeQty(qtyInput);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from('inventory_movements').insert({
      variant_id: variantId,
      movement,
      quantity_units: qty,
      note: note || null,
      created_by: userData.user?.id ?? null // il trigger in DB lo compilerebbe comunque
    });
    if (error) {
      alert(error.message);
    } else {
      setNote('');
      setQtyInput(movement === 'adjust' ? '-1' : '1');
      onInserted();
    }
  };

  return (
    <div className="mt-8 p-4 border rounded-xl space-y-3">
      <h2 className="font-medium">Registra movimento</h2>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <select className="border rounded p-2" value={variantId} onChange={e => setVariantId(e.target.value)}>
          {variants.map(v => (
            <option key={v.variant_id} value={v.variant_id}>
              {v.vintage} · Lotto {v.lot_code} · {v.size_label}
            </option>
          ))}
        </select>

        <select
          className="border rounded p-2"
          value={movement}
          onChange={e => {
            const mv = e.target.value as 'in' | 'out' | 'adjust';
            setMovement(mv);
            setQtyInput(mv === 'adjust' ? '-1' : '1');
          }}
        >
          <option value="in">Ingresso</option>
          <option value="out">Uscita</option>
          <option value="adjust">Rettifica</option>
        </select>

        {/* Quantità: testo con filtro; '-' ammesso solo per Rettifica */}
        <input
          className="border rounded p-2"
          type="text"
          inputMode="numeric"
          pattern={movement === 'adjust' ? '[0-9-]*' : '[0-9]*'}
          value={qtyInput}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => {
            const control = ['Backspace','Delete','ArrowLeft','ArrowRight','Home','End','Tab','Enter'];
            const isDigit = /^\d$/.test(e.key);
            const isMinusAllowed =
              movement === 'adjust' &&
              e.key === '-' &&
              e.currentTarget.selectionStart === 0 &&
              !qtyInput.includes('-');
            if (isDigit || isMinusAllowed || control.includes(e.key)) return;
            e.preventDefault();
          }}
          onChange={(e) => {
            let v = e.target.value;
            if (movement === 'adjust') {
              v = v.replace(/[^\d-]/g, '').replace(/(?!^)-/g, '');
            } else {
              v = v.replace(/[^\d]/g, '');
            }
            setQtyInput(v);
          }}
          onBlur={() => setQtyInput(String(normalizeQty(qtyInput)))}
          placeholder={movement === 'adjust' ? 'es. -3 per scarto' : 'Quantità'}
        />

        <input
          className="border rounded p-2"
          placeholder="Nota (facoltativa)"
          value={note}
          onChange={e => setNote(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
        />
      </div>
      <button className="border rounded px-4 py-2" onClick={submit}>Salva</button>
    </div>
  );
}

function MovementsLog({ reloadKey, vintages }: { reloadKey: number; vintages: number[] }) {
  const [rows, setRows] = useState<MovementLogRow[]>([]);
  const [mvType, setMvType] = useState<MovementType>('all');
  const [vintage, setVintage] = useState<number | 'all'>('all');

  const refreshMovements = async () => {
    let q = supabase
      .from('v_movements_detailed')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (mvType !== 'all') q = q.eq('movement', mvType);
    if (vintage !== 'all') q = q.eq('vintage', vintage as number);
    const { data, error } = await q;
    if (error) {
      console.error(error);
      return;
    }
    setRows((data ?? []) as MovementLogRow[]);
  };

  useEffect(() => { refreshMovements(); }, [reloadKey, mvType, vintage]);

  const csvEscape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const exportCsv = () => {
    const header = ['Data', 'Tipo', 'Annata', 'Lotto', 'Formato', 'Qtà', 'Nota', 'Operatore', 'Variante'];
    const lines = rows.map(r => [
      new Date(r.created_at).toLocaleString(),
      r.movement,
      String(r.vintage),
      r.lot_code,
      r.size_label,
      String(r.quantity_units),
      r.note ?? '',
      r.operator_email ?? '',
      r.variant_id,
    ].map(x => csvEscape(String(x))).join(','));
    const csv = header.map(csvEscape).join(',') + '\n' + lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'movimenti.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">📜 Movimenti (ultimi 200)</h2>
        <div className="flex items-center gap-2">
          <select
            className="border rounded p-2 text-sm"
            value={mvType}
            onChange={e => setMvType(e.target.value as MovementType)}
          >
            <option value="all">Tutti i tipi</option>
            <option value="in">Ingresso</option>
            <option value="out">Uscita</option>
            <option value="adjust">Rettifica</option>
          </select>
          <select
            className="border rounded p-2 text-sm"
            value={vintage === 'all' ? 'all' : String(vintage)}
            onChange={e => setVintage(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          >
            <option value="all">Tutte le annate</option>
            {vintages.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <button className="border rounded px-3 py-1 text-sm" onClick={refreshMovements}>Aggiorna</button>
          <button className="border rounded px-3 py-1 text-sm" onClick={exportCsv}>Export CSV</button>
        </div>
      </div>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b font-medium">
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
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className="border-b">
              <td className="p-2">{new Date(r.created_at).toLocaleString()}</td>
              <td className="p-2">{r.movement}</td>
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
  );
}
