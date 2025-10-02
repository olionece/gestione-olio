'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

type Option = { label: string; value: string };

export default function Filters({
  onChange
}: {
  onChange: (f: { year?: string; lot?: string; format_ml?: string; warehouse_id?: string }) => void
}) {
  const [years, setYears] = useState<Option[]>([]);
  const [warehouses, setWarehouses] = useState<Option[]>([]);
  const lots: Option[] = ['A','B','C'].map(l => ({ label: `Lotto ${l}`, value: l }));
  const formats: Option[] = [
    { label: '250 ml', value: '250' },
    { label: '500 ml', value: '500' },
    { label: '5 L', value: '5000' },
  ];

  useEffect(() => {
    (async () => {
      // anni presenti nei movimenti (oppure costruisci tu un range fisso)
      const { data: ym } = await supabase
        .from('inventory_movements')
        .select('year')
        .order('year', { ascending: false });
      const distinctYears = Array.from(new Set((ym ?? []).map(r => r.year))).map((y: number) => ({ label: `${y}`, value: `${y}` }));
      setYears(distinctYears);

      const { data: ws } = await supabase.from('warehouses').select('id,name').order('name');
      setWarehouses((ws ?? []).map(w => ({ label: w.name, value: w.id })));
    })();
  }, []);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Select onValueChange={(v) => onChange({ year: v })}>
        <SelectTrigger className="w-full"><SelectValue placeholder="Annata" /></SelectTrigger>
        <SelectContent>
          {years.map(y => <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select onValueChange={(v) => onChange({ lot: v })}>
        <SelectTrigger className="w-full"><SelectValue placeholder="Lotto" /></SelectTrigger>
        <SelectContent>
          {lots.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select onValueChange={(v) => onChange({ format_ml: v })}>
        <SelectTrigger className="w-full"><SelectValue placeholder="Formato" /></SelectTrigger>
        <SelectContent>
          {formats.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select onValueChange={(v) => onChange({ warehouse_id: v })}>
        <SelectTrigger className="w-full"><SelectValue placeholder="Magazzino" /></SelectTrigger>
        <SelectContent>
          {warehouses.map(w => <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
