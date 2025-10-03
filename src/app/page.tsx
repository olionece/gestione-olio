'use client';
import { useEffect, useState } from 'react';


const STATIC = [
  { id: '5630b7e1-becf-4f4e-8ed3-84f8c82f8bd4', name: 'Roma' },
  { id: '16a1716a-e748-4895-bd38-9807e8fcaaf4', name: 'Neci' },
];

export default function Page() {
  const [selected, setSelected] = useState('');
  const [live, setLive] = useState<{id:string;name:string}[]>([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  // 🔘 Test live via REST (no SDK): mostra esito a schermo
  async function loadFromSupabase() {
    setLoading(true);
    setErr('');
    setLive([]);
    try {
      if (!url || !anon) {
        setErr('ENV mancanti: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY');
        return;
      }
      const res = await fetch(`${url}/rest/v1/warehouses?select=id,name&order=name`, {
        headers: { apikey: anon, Authorization: `Bearer ${anon}` }
      });
      if (!res.ok) {
        setErr(`Errore HTTP ${res.status} (probabile RLS/policy o URL/chiave errati)`);
        return;
      }
      const data = await res.json();
      setLive(data);
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>
        Gestione Olio — Test Magazzini
      </h1>

      {/* Sezione A: STATICO (deve SEMPRE vedersi) */}
      <section style={{ border: '1px solid #ddd', borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <h2 style={{ margin: '0 0 8px 0' }}>A) Selezione statica</h2>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          style={{ padding: 8, minWidth: 260 }}
        >
          <option value="">— Scegli magazzino —</option>
          {STATIC.map(w => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
        <div style={{ marginTop: 8 }}>Selezionato: <b>{selected || '—'}</b></div>
        <div style={{ marginTop: 8, fontSize: 12, color: '#555' }}>
          Se qui NON vedi “Roma / Neci”, il problema è di routing/build (file non deployato nel posto giusto).
        </div>
      </section>

      {/* Sezione B: LIVE da Supabase (opzionale, premere bottone) */}
      <section style={{ border: '1px solid #ddd', borderRadius: 12, padding: 16 }}>
        <h2 style={{ margin: '0 0 8px 0' }}>B) Prova lettura LIVE da Supabase</h2>
        <button onClick={loadFromSupabase} disabled={loading} style={{ padding: '8px 12px' }}>
          {loading ? 'Carico…' : 'Prova Supabase'}
        </button>

        {/* Esito */}
        {err && (
          <div style={{ marginTop: 10, color: 'crimson', whiteSpace: 'pre-wrap' }}>
            {err}
          </div>
        )}
        {!err && live.length > 0 && (
          <ul style={{ marginTop: 10 }}>
            {live.map(r => <li key={r.id}>{r.name} ({r.id})</li>)}
          </ul>
        )}
        {!err && !loading && live.length === 0 && (
          <div style={{ marginTop: 10, fontSize: 12, color: '#555' }}>
            (Premi “Prova Supabase” per testare la connessione/permessi)
          </div>
        )}

        <details style={{ marginTop: 12 }}>
          <summary>Dettagli ENV (mascherati)</summary>
          <div>URL: <code>{url || '(manca)'}</code></div>
          <div>ANON: <code>{anon ? anon.slice(0, 10) + '…' : '(manca)'}</code></div>
        </details>
      </section>
    </main>
  );
}
