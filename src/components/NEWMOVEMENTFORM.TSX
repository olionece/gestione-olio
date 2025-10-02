'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Warehouse = { id: string; name: string };

export default function NewMovementForm({ onSaved }: { onSaved?: () => void }) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [movement, setMovement] = useState<'in'|'out'|'adjustment'>();
  const [year, setYear] = useState<number>();
  const [lot, setLot] = useState<'A'|'B'|'C'>();
  const [formatMl, setFormatMl] = useState<250|500|5000>();
  const [warehouseId, setWarehouseId] = useState<string>();
  const [bottles, setBottles] = useState<number>(1);
  const [note, setNote] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Carica magazzini + anni utili (o fai un range fisso)
  useEffect(() => {
    (async () => {
      const { data: ws } = await supabase.from('warehouses').select('id,name').order('name');
      setWarehouses(ws ?? []);
      // anni presenti oppure ultimi 5 anni
      const current = new Date().getFullYear();
      setYears([current+1, current, current-1, current-2, curre]()
