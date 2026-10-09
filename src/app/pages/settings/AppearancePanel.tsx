import { useEffect, useState } from 'react';
import { PALETTES, type PaletteId } from '../../config/appearance';
import { useAppearance } from '../../contexts/AppearanceContext';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Alert } from '../../components/Alert';

export function AppearancePanel() {
  const { palette, saving, savePalette } = useAppearance();
  const [selected, setSelected] = useState<PaletteId>(palette);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  useEffect(() => { setSelected(palette); }, [palette]);
  const save = async () => {
    setMessage(null);
    try {
      await savePalette(selected);
      setMessage({ type: 'success', text: 'Paleta guardada para toda la empresa. Los demás dispositivos conectados la recibirán en hasta un minuto.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'No se pudo guardar la apariencia.' });
    }
  };
  return (
    <Card>
      <h3 className="text-lg font-semibold text-foreground">Apariencia</h3>
      <p className="mt-2 text-muted-foreground">Selecciona los colores de toda la aplicación para todos los usuarios. Solo cambia la presentación visual.</p>
      <fieldset disabled={saving} className="mt-6">
        <legend className="mb-3 font-medium text-foreground">Paleta de la empresa</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {PALETTES.map(option => (
            <label key={option.id} className={`flex cursor-pointer gap-3 rounded-lg border p-4 ${selected === option.id ? 'border-primary ring-2 ring-primary/20' : 'border-border'}`}>
              <input type="radio" name="appearance-palette" value={option.id} checked={selected === option.id} onChange={() => { setSelected(option.id); setMessage(null); }} className="mt-1 accent-primary" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-foreground">{option.name}{palette === option.id && <span className="ml-2 text-sm font-normal text-muted-foreground">Actual</span>}</span>
                <span className="mt-1 block text-sm text-muted-foreground">{option.description}</span>
                <span className="mt-4 flex gap-2" aria-label={`Muestra de colores ${option.name}`}>
                  {option.colors.map(color => <span key={color} className="h-8 w-8 rounded border border-black/20" style={{ backgroundColor: color }} aria-hidden="true" />)}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-6"><Button type="button" loading={saving} disabled={saving || selected === palette} onClick={save}>Guardar para toda la empresa</Button></div>
      {message && <div className="mt-4" role="status"><Alert type={message.type} message={message.text} /></div>}
    </Card>
  );
}
