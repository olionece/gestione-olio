'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

function useSession() {
  const [session, setSession] = useState<any>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);
  return session;
}

export default function Home() {
  const session = useSession();
  const [stock, setStock] = useState<any[]>([]);
  const [roles, setRoles] = useState<string[]>([]);

  const canInsert = useMemo(() => roles.includes('operator') || roles.includes('admin'), [roles]);

  useEffect(() => {
    const load = async () => {
      if (!session) return;

      const { data: r1 } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id);
      setRoles((r1 || []).map((r: any) => r.role));

      const { data: r2 } = await supabase
        .from('v_stock_detailed')
        .select('*')
        .order('vintage', { ascending: false })
        .order('lot_code', { ascending: true })
        .order('ml', { ascending: true });
      setStock(r2 || []);
    };
    load();
  }, [session]);

  const signOut = async () => { await supabase.auth.signOut(); };

  if (!session) {
    const AuthBox = require('@/components/Auth').default;
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Gestione Olio</h1>
        <AuthBox />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Giacenze</h1>
        <div className="text-sm flex items-center gap-3">
          <span>Ruoli: {roles.join(', ') || 'viewer'}</span>
          <button className="border rounded px-3 py-1" onClick={signOut}>Esci</button>
        </div>
      </div>

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
          {stock.map((r, i) => (
            <tr key={i} className="border-b">
              <td className="p-2">{r.vintage}</td>
              <td className="p-2">{r.lot_code}</td>
              <td className="p-2">{r.size_label}</td>
              <td className="p-2 text-right">{r.units_on_hand}</td>
              <td className="p-2 text-right">{r.liters_on_hand}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {canInsert && <MovementForm onInserted={() => location.reload()} />}
      {!canInsert && <p className="text-sm opacity-80">Hai permessi di sola lettura (viewer).</p>}
    </div>
  );
}

function MovementForm({ onInserted }: { onInserted: () => void }) {
  const [variants, setVariants] = useState<any[]>([]);
  const [variantId, setVariantId] = useState('');
  const [movement, setMovement] = useState<'in' | 'out' | 'adjust'>('in');
  const [qty, setQty] = useState<number>(1);
  const [note, setNote] = useState('');

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('v_stock_units')
        .select('*')
        .order('vintage', { ascending: false })
        .order('lot_code', { ascending: true })
        .order('ml', { ascending: true });
      setVariants(data || []);
      if (data && data[0]) setVariantId(data[0].variant_id);
    };
    load();
  }, []);

  const submit = async () => {
    if (!variantId) return;
    const { error } = await supabase.from('inventory_movements').insert({
      variant_id: variantId,
      movement,
      quantity_units: qty,
      note,
      created_by: (await supabase.auth.getUser()).data.user?.id
    });
    if (error) alert(error.message); else onInserted();
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
        <select className="border rounded p-2" value={movement} onChange={e => setMovement(e.target.value as any)}>
          <option value="in">Ingresso</option>
          <option value="out">Uscita</option>
          <option value="adjust">Rettifica</option>
        </select>
        <input
          className="border rounded p-2"
          type="number"
          min={1}
          value={qty}
          onChange={e => setQty(parseInt(e.target.value || '1'))}
        />
        <input
          className="border rounded p-2"
          placeholder="Nota (facoltativa)"
          value={note}
          onChange={e => setNote(e.target.value)}
        />
      </div>
      <button className="border rounded px-4 py-2" onClick={submit}>Salva</button>
    </div>
  );
}
