import type { EffectiveMeasurementConfig } from '../utils/unitConversion';

const OPERATIONAL_LABELS: Record<string, string> = {
  gallons: 'galones',
  gallon: 'galón',
  drums: 'tambores',
  drum: 'tambor',
  pails: 'pailas',
  pail: 'paila',
  inches: 'pulgadas',
  inch: 'pulgada',
};

function localizeLabel(value: string | null | undefined) {
  if (!value) return '-';
  return OPERATIONAL_LABELS[value.toLowerCase()] || value;
}

function getOperationalRule(config: EffectiveMeasurementConfig) {
  if (config.source === 'legacy') {
    return {
      label: 'Configuración del equipo',
      detail: 'La aplicación calcula el inventario con la configuración asignada a este equipo.',
    };
  }

  return {
    label: config.ruleLabel,
    detail: config.ruleDetail
      .replace(/El cliente muestra una vista previa; el servidor recalcula el valor autoritativo\.?/gi, 'El valor se verifica automáticamente al guardar.')
      .replace(/El servidor recalcula/gi, 'La aplicación verifica'),
  };
}

export function UnitFlowSummary({
  effectiveConfig,
  className = '',
}: {
  effectiveConfig: EffectiveMeasurementConfig;
  className?: string;
}) {
  const rule = getOperationalRule(effectiveConfig);
  const content = (
    <>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span><strong>Captura:</strong> {localizeLabel(effectiveConfig.captureLabel)}</span>
        <span><strong>Cálculo:</strong> {localizeLabel(effectiveConfig.calculationLabel)}</span>
        <span><strong>Resultado:</strong> {localizeLabel(effectiveConfig.displayLabel)}</span>
        <span><strong>Inventario:</strong> {localizeLabel(effectiveConfig.inventoryLabel)}</span>
        <span><strong>Método:</strong> {rule.label}</span>
      </div>
      <p className="mt-1">{rule.detail}</p>
    </>
  );

  return (
    <div className={className}>
      <details className="rounded border border-[var(--ui-border-d4d2cf)] bg-[var(--ui-background-f8fafc)] px-3 py-2 text-xs text-[color:var(--ui-text-muted-5f6773)] sm:hidden">
        <summary className="min-h-8 cursor-pointer py-1 font-semibold text-[color:var(--ui-text-3b3a36)]">
          Unidades y método de cálculo
        </summary>
        <div className="pt-2">{content}</div>
      </details>
      <div className="hidden rounded border border-[var(--ui-border-d4d2cf)] bg-[var(--ui-background-f8fafc)] px-4 py-3 text-xs text-[color:var(--ui-text-muted-5f6773)] sm:block">
        {content}
      </div>
    </div>
  );
}
