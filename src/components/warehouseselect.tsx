'use client';
import { useEffect, useState } from 'react';
// Usa l'import che funziona nel tuo progetto:
// import { supabase } from '@/lib/supabaseClient';
import { supabase } from '../../lib/supabaseClient';

type Warehouse = { id: string; name: string };

// Fallback: metti i TUOI UUID reali
const FALLBACK: Warehouse[] = [
  { id: '5630b7e1-becf-4f4e-8ed3-84f8c82f8bd4', name: 'Roma' },
  { id: '16a1716a-e748-4895-bd38-9807e8fcaaf4', name: 'Neci' },
];

export default function WarehouseSelect({
  value,
  onSelect,
}: {
  value?: string;
  onSelect?: (id: string) => void;
}) {
  const [rows, setRows] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr('');
        const { data, error } = await supabase
          .from('warehouses')
          .select('id,name')
          .order('name');
        if (error) throw error;
        setRows(data ?? []);
      } catch (e: any) {
        setErr(e?.message || String(e));
        setRows([]); // useremo il fallback
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const list = rows.length ? rows : FALLBACK;

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <label>Magazzino</label>
      <select
        value={value ?? ''}
        onChange={(e) => onSelect?.(e.target.value)}
        disabled={loading}
        style={{ padding: 8, minWidth: 260 }}
      >
        <option value="">— Scegli magazzino —</option>
        {list.map((w) => (
          <option key={w.id} value={w.id}>{w.name}</option>
        ))}
      </select>

      {!!err && (
        <small style={{ color: 'crimson' }}>
          Lettura live fallita: {err}. Uso elenco di fallback (Roma/Neci).
        </small>
      )}
      {!err && !loading && rows.length === 0 && (
        <small>Uso elenco di fallback (Roma/Neci).</small>
      )}
    </div>
  );
}
