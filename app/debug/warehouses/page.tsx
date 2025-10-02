'use client';
import { useEffect, useState } from 'react';
// Se hai l'alias "@/": usa la riga sotto e cancella la successiva
import { supabase } from '@/lib/supabaseClient';
// Se NON hai l'alias "@/": usa questa riga al posto di quella sopra
// import { supabase } from '../../../lib/supabaseClient';

export default function DebugWarehouses() {
  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('warehouses')
        .select('id,name')
        .order('name');
      if (error) setErr(error.message);
      setRows(data ?? []);
      setLoading(false);
      console.log('warehouses →', { data, error });
    })();
  }, []);

  return (
    <main style={{ padding: 24 }}>
      <h1>Debug: Warehouses</h1>

      <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 12, margin: '12px 0' }}>
        <div>SUPABASE_URL: <code>{process.env.NEXT_PUBLIC_SUPABASE_URL || '(manca)'}</code></div>
        <div>ANON_KEY (inizio): <code>{process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.slice(0,10)+'…' : '(manca)'}</code></div>
      </div>

      {loading && <p>Caricamento…</p>}
      {err && <pre style={{color:'crimson', whiteSpace:'pre-wrap'}}>ERROR: {err}</pre>}
      {!loading && !err && rows.length === 0 && (
        <p>Nessun risultato dalla tabella <code>warehouses</code>. (Controlla RLS/policy o ENV)</p>
      )}
      <ul>
        {rows.map(r => <li key={r.id}>{r.name} ({r.id})</li>)}
      </ul>
    </main>
  );
}
