'use client';

import { useEffect, useState } from 'react';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

type Option = { label: string; value: string };

/**
 * Fallback statico: usa SOLO gli UUID (senza “-ROMA”, “-NECI”).
 * Prendo i tuoi e rimuovo i suffissi.
 */
const STATIC_WAREHOUSES: Option[] = [
  { label: 'Roma', value: '5630b7e1-becf-4f4e-8ed3-84f8c82f8bd4' },
  { label: 'Neci', value: '16a1716a-e748-4895-bd38-9807e8fcaaf4' },
];

export default function Filters({
  onChange
}: {
  onChange: (f: { year?: string; lot?: string; format_ml?: string; warehouse_id?: string }) => void
}) {
  // --- stato visuale dei filtri
  const [year, setYear] = useState<string | undefined>(undefined);
  const [lot, setLot] = useState<string | undefined>(undefined);
  const [formatMl, setFormatMl] = useState<string | undefined>(undefined);
  const [warehouseId, setWarehouseId] = useState<string | undefined>(undefined);

  // --- opzioni
  const [years, setYears] = useState<Option[]>([]);
  const [warehouses, setWarehouses] = useState<Option[]>([]);
  const [wLoading, setWLoading] = useState(true);
  const [wError, setWError] = useState('');

  // anni: range semplice
  useEffect(() => {
    const cur = new Date().getFullYear();
    setYears([cur + 1, cur, cur - 1, cur - 2, cur - 3].map(y => ({ label: String(y), value: String(y) })));
  }, []);

  // ► QUI: carico la lista statica (zero Supabase, zero policy)
  useEffect(() => {
    setWarehouses(STATIC_WAREHOUSES);
    setWLoading(false);
    setWError('');
  }, []);

  // helper per inoltrare i cambi al padre
  function pushChange(partial: { year?: string; lot?: string; format_ml?: string; warehouse_id?: string }) {
    onChange(partial);
  }

  function resetFilters() {
    setYear(undefined);
    setLot(undefined);
    setFormatMl(undefined);
    setWarehouseId(undefined);
    pushChange({ year: undefined, lot: undefined, format_ml: undefined, warehouse_id: undefined });
  }

  const lots: Option[] = ['A', 'B', 'C'].map(l => ({ label: `Lotto ${l}`, value: l }));
  const formats: Option[] = [
    { label: '250 ml', value: '250' },
    { label: '500 ml', value: '500' },
    { label: '5 L', value: '5000' },
  ];

  return (
    <div className="space-y-3">
      {wError && (
        <div className="text-sm text-red-600">
          Errore nel caricamento dei magazzini: {wError}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {/* Annata */}
        <Select
          value={year}
          onValueChange={(v) => {
            setYear(v);
            pushChange({ year: v });
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Annata" />
          </SelectTrigger>
          <SelectContent>
            {years.map(y => (
              <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Lotto */}
        <Select
          value={lot}
          onValueChange={(v) => {
            setLot(v);
            pushChange({ lot: v });
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Lotto" />
          </SelectTrigger>
          <SelectContent>
            {['A','B','C'].map(l => (
              <SelectItem key={l} value={l}>Lotto {l}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Formato */}
        <Select
          value={formatMl}
          onValueChange={(v) => {
            setFormatMl(v);
            pushChange({ format_ml: v });
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Formato" />
          </SelectTrigger>
          <SelectContent>
            {formats.map(f => (
              <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Magazzino */}
        <Select
          value={warehouseId}
          onValueChange={(v) => {
            setWarehouseId(v);
            pushChange({ warehouse_id: v }); // passerai l’UUID puro nelle query
          }}
          disabled={wLoading || !!wError}
        >
          <SelectTrigger className="w-full">
            <SelectValue
              placeholder={
                wLoading
                  ? "Caricamento…"
                  : (warehouses.length ? "Magazzino" : "Nessun magazzino")
              }
            />
          </SelectTrigger>
          <SelectContent>
            {warehouses.map(w => (
              <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Reset */}
        <div className="flex items-center">
          <Button type="button" variant="secondary" className="w-full" onClick={resetFilters}>
            Reset filtri
          </Button>
        </div>
      </div>

      {!wLoading && !wError && warehouses.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Nessun magazzino disponibile.
        </p>
      )}
    </div>
  );
}
