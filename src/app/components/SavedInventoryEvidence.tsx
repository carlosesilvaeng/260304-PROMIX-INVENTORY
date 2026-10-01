import { useEffect, useState } from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { getInventoryMonth, InventoryMonthData } from '../utils/api';

const fields: Record<string, string> = {
  box_width_ft: 'Ancho (ft)', box_height_ft: 'Alto (ft)', box_length_ft: 'Largo (ft)',
  cone_m1: 'M1 (ft)', cone_m2: 'M2 (ft)', cone_m3: 'M3 (ft)', cone_m4: 'M4 (ft)',
  cone_m5: 'M5 (ft)', cone_m6: 'M6 (ft)', cone_d1: 'D1 (ft)', cone_d2: 'D2 (ft)',
  calculated_volume_cy: 'Volumen (yd³)', product_name: 'Producto', product_in_silo: 'Producto en silo',
  reading_value: 'Lectura', reading_inches: 'Lectura (in)', reading: 'Lectura', reading_uom: 'Unidad de lectura',
  calculated_result_cy: 'Resultado calculado', calculated_volume: 'Volumen calculado',
  calculated_gallons: 'Volumen (gal)', quantity: 'Cantidad', uom: 'Unidad', unit: 'Unidad',
  beginning_inventory: 'Inventario inicial', purchases_gallons: 'Compras (gal)',
  ending_inventory: 'Inventario final', consumption_gallons: 'Consumo (gal)',
  unit_count: 'Unidades', unit_volume: 'Volumen por unidad', total_volume: 'Volumen total',
  calculated_quantity: 'Cantidad calculada', previous_reading: 'Lectura anterior', current_reading: 'Lectura actual',
  consumption: 'Consumo', established_amount: 'Fondo establecido', receipts: 'Recibos', cash: 'Efectivo',
  total: 'Total', difference: 'Diferencia', beginning_balance: 'Saldo inicial', ending_balance: 'Saldo final',
  amount: 'Monto', currency: 'Moneda', notes: 'Observaciones',
};

function formatDate(value?: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Sin fecha registrada';
  return new Date(value).toLocaleString('es-PR', {
    timeZone: 'America/Puerto_Rico', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
  });
}

export function SavedInventoryEvidence({ plantId, yearMonth }: { plantId: string; yearMonth: string }) {
  const [data, setData] = useState<InventoryMonthData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setData(null);
    setError(null);
    getInventoryMonth(plantId, yearMonth).then(response => {
      if (!active) return;
      if (!response.success || !response.data || response.data.month.plant_id !== plantId || response.data.month.year_month !== yearMonth) {
        setError(response.error || 'No se pudieron verificar los datos guardados de este período.');
      } else {
        setData(response.data);
      }
      setLoading(false);
    }).catch(() => {
      if (!active) return;
      setError('No se pudieron consultar los datos guardados.');
      setLoading(false);
    });
    return () => { active = false; };
  }, [plantId, yearMonth, revision]);

  const sections = data ? [
    { name: 'Agregados', rows: data.agregados || [] },
    { name: 'Silos', rows: data.silos || [] },
    { name: 'Aditivos', rows: data.aditivos || [] },
    { name: 'Diesel', rows: data.diesel ? [data.diesel] : [] },
    { name: 'Aceites y Productos', rows: data.productos || [] },
    { name: 'Utilidades', rows: data.utilities || [] },
    { name: 'Petty Cash', rows: data.pettyCash ? [data.pettyCash] : [] },
  ] : [];
  const total = sections.reduce((sum, section) => sum + section.rows.length, 0);
  const latestSave = sections.flatMap(section => section.rows)
    .map(row => row.updated_at || row.created_at)
    .filter((date): date is string => typeof date === 'string' && Number.isFinite(Date.parse(date)))
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0];

  return (
    <Card>
      <div className="p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xl font-bold text-[#3B3A36]">Datos guardados del inventario</h3>
          <Button size="sm" variant="outline" disabled={loading} onClick={() => setRevision(value => value + 1)}>Actualizar datos guardados</Button>
        </div>
        <p className="text-sm text-[#5F6773]">Consulta de lo guardado en el sistema para este período. Los registros pueden tener datos pendientes; revisa también la validación por sección.</p>
        {loading && <p role="status">Consultando datos guardados…</p>}
        {error && <p role="alert" className="text-red-700">{error}</p>}
        {data && !loading && <>
          <dl className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div><dt className="font-semibold">Iniciado por</dt><dd>{data.month.created_by || 'Sin usuario registrado'}</dd></div>
            <div><dt className="font-semibold">Fecha y hora de inicio</dt><dd>{formatDate(data.month.created_at)} (Puerto Rico)</dd></div>
            <div><dt className="font-semibold">Último guardado de los registros actuales</dt><dd>{latestSave ? `${formatDate(latestSave)} (Puerto Rico)` : 'Sin registros guardados'}</dd></div>
          </dl>
          <p className={total ? 'font-semibold text-green-800' : 'font-semibold text-amber-800'}>
            {total ? `Sí hay información guardada: ${total} registros en ${sections.filter(section => section.rows.length).length} de 7 secciones.` : 'El inventario fue iniciado, pero todavía no tiene registros guardados.'}
          </p>
          {sections.map(section => (
            <details key={section.name} className="rounded border border-[#D4D2CF] p-3">
              <summary className="cursor-pointer font-semibold">{section.name} · {section.rows.length} registros guardados</summary>
              {section.rows.length === 0 ? <p className="mt-3 text-sm text-[#5F6773]">Sin registros guardados en esta sección.</p> : (
                <div className="mt-3 space-y-3">
                  {section.rows.map((row, index) => (
                    <div key={row.id || index} className="rounded bg-[#F2F3F5] p-3">
                      <h4 className="font-semibold">{row.aggregate_name || row.silo_name || row.tank_name || row.product_name || row.meter_name || `${section.name} ${index + 1}`}</h4>
                      <p className="mt-1 text-xs text-[#5F6773]">Guardado: {formatDate(row.updated_at || row.created_at)} (Puerto Rico)</p>
                      <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                        {Object.entries(fields).filter(([key]) => row[key] !== null && row[key] !== undefined && row[key] !== '').map(([key, label]) => (
                          <div key={key}><dt className="text-[#5F6773]">{label}</dt><dd className="font-medium break-words">{String(row[key])}</dd></div>
                        ))}
                      </dl>
                      <p className="mt-3 text-sm">{row.photo_url ? <a href={row.photo_url} target="_blank" rel="noopener noreferrer" className="text-[#2475C7] underline">Ver foto de evidencia</a> : 'Sin foto guardada'}</p>
                    </div>
                  ))}
                </div>
              )}
            </details>
          ))}
        </>}
      </div>
    </Card>
  );
}
