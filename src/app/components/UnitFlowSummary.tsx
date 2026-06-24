import type { EffectiveMeasurementConfig } from '../utils/unitConversion';

export function UnitFlowSummary({
  effectiveConfig,
  className = '',
}: {
  effectiveConfig: EffectiveMeasurementConfig;
  className?: string;
}) {
  return (
    <div className={`rounded border border-[#D4D2CF] bg-[#F8FAFC] px-4 py-3 text-xs text-[#5F6773] ${className}`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span><strong>Captura:</strong> {effectiveConfig.captureLabel || '-'}</span>
        <span><strong>Calculo:</strong> {effectiveConfig.calculationLabel || '-'}</span>
        <span><strong>Visible:</strong> {effectiveConfig.displayLabel || '-'}</span>
        <span><strong>Inventario:</strong> {effectiveConfig.inventoryLabel || '-'}</span>
        <span><strong>Regla:</strong> {effectiveConfig.ruleLabel}</span>
      </div>
      <p className="mt-1">{effectiveConfig.ruleDetail}</p>
    </div>
  );
}
