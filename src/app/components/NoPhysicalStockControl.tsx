import React, { useState } from 'react';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription,
  AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from './ui/alert-dialog';
import { physicalStockUpdates, type PhysicalStockSection } from '../utils/noPhysicalStock';

export function NoPhysicalStockControl({ section, entry, label, disabled, onChange }: {
  section: PhysicalStockSection; entry: any; label: string; disabled?: boolean; onChange: (updates: any) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  return <div className="my-4 space-y-2">
    <label className="flex items-center gap-2 font-semibold cursor-pointer">
      <input type="checkbox" checked={entry.no_physical_stock === true} disabled={disabled}
        onChange={event => event.target.checked ? setConfirming(true) : onChange(physicalStockUpdates(section, false))} />
      NO HAY FÍSICO
    </label>
    {entry.no_physical_stock === true && <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
      Sin existencia física. Inventario en cero; se omiten las mediciones{section === 'silos' ? ', la selección de producto' : ''} y la foto requerida.
      {entry.no_physical_stock_at ? <p>Registrado por {entry.no_physical_stock_user_name || entry.no_physical_stock_by} · {new Date(entry.no_physical_stock_at).toLocaleString('es-PR')}</p>
        : <p>El usuario y la fecha quedarán registrados al guardar.</p>}
    </div>}
    <AlertDialog open={confirming} onOpenChange={setConfirming}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar NO HAY FÍSICO</AlertDialogTitle>
          <AlertDialogDescription>¿Confirmas que no hay existencia física de {label}?
            El inventario quedará en cero y se omitirán los campos de captura y la foto requerida.
            Esta declaración se registrará con tu usuario y fecha al guardar. Al desmarcarla deberás capturar las mediciones nuevamente.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction disabled={disabled} onClick={() => onChange(physicalStockUpdates(section, true))}>Sí, confirmar NO HAY FÍSICO</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}
