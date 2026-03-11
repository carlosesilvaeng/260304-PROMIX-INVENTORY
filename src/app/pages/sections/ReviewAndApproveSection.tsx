import React, { useEffect, useState } from 'react';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { useAuth } from '../../contexts/AuthContext';
import { usePlantPrefill } from '../../contexts/PlantPrefillContext';
import {
  validateAllSections,
  OverallValidationResult,
  SectionValidationResult,
} from '../../utils/validation';
import {
  submitInventoryForApproval,
  approveInventory,
  rejectInventory,
  saveInventoryDraft,
} from '../../utils/api';
import { formatYearMonthLabel } from '../../utils/dateFormatting';

interface ReviewAndApproveSectionProps {
  reportContext?: { plantId: string; yearMonth: string } | null;
  onNavigate?: (view: string, sectionId?: string, context?: { plantId?: string; yearMonth?: string }) => void;
}

export function ReviewAndApproveSection({ reportContext, onNavigate }: ReviewAndApproveSectionProps) {
  const { user, currentPlant, allPlants } = useAuth();
  const { prefillData, loadPlantData, getCurrentYearMonth } = usePlantPrefill();
  const normalizedRole = String(user?.role || '').toLowerCase();
  const userDisplayName = user?.name || user?.email || user?.id || 'Usuario';
  
  const [validation, setValidation] = useState<OverallValidationResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // Load data when component mounts — supports reportContext (from Reports "Ver" button) or falls back to currentPlant + current month
  useEffect(() => {
    const targetPlantId = reportContext?.plantId ?? currentPlant?.id;
    const currentYearMonth = getCurrentYearMonth();
    const targetYearMonth = reportContext?.yearMonth ?? currentYearMonth;

    if (targetPlantId) {
      console.log('[ReviewAndApprove] Loading data for plant:', targetPlantId, targetYearMonth);
      loadPlantData(targetPlantId, targetYearMonth);
    }
  }, [currentPlant, reportContext, loadPlantData, getCurrentYearMonth]);

  // Run validation whenever prefillData changes
  useEffect(() => {
    if (prefillData && !prefillData.loading && !prefillData.error) {
      console.log('[ReviewAndApprove] Running validation...');
      const result = validateAllSections(prefillData);
      setValidation(result);
      console.log('[ReviewAndApprove] Validation result:', result);
    }
  }, [prefillData]);

  // Toggle section expansion
  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const mapValidationSectionToRoute = (sectionId: string): string | null => {
    const mapping: Record<string, string> = {
      aggregates: 'agregados',
      silos: 'silos',
      additives: 'aditivos',
      diesel: 'diesel',
      products: 'aceites',
      utilities: 'utilidades',
      petty_cash: 'petty-cash',
    };

    return mapping[sectionId] || null;
  };

  const handleContinueSection = (section: SectionValidationResult) => {
    const routeSectionId = mapValidationSectionToRoute(section.sectionId);
    if (!routeSectionId || !onNavigate) return;

    onNavigate('section', routeSectionId, {
      plantId: reportContext?.plantId ?? currentPlant?.id,
      yearMonth: reportContext?.yearMonth ?? prefillData.inventoryMonth?.year_month,
    });
  };

  // ============================================================================
  // ACTION HANDLERS
  // ============================================================================

  const handleSaveDraft = async () => {
    if (!prefillData.inventoryMonth) {
      setActionMessage({ type: 'error', text: 'No hay mes de inventario disponible' });
      return;
    }

    try {
      const response = await saveInventoryDraft(prefillData.inventoryMonth.id);
      if (response.success) {
        setActionMessage({ type: 'success', text: '✓ Borrador guardado exitosamente' });
      } else {
        setActionMessage({ type: 'error', text: `Error: ${response.error}` });
      }
    } catch (error) {
      setActionMessage({ type: 'error', text: 'Error al guardar borrador' });
    }
    
    setTimeout(() => setActionMessage(null), 3000);
  };

  const handleSubmitForApproval = async () => {
    if (!prefillData.inventoryMonth) {
      setActionMessage({ type: 'error', text: 'No hay mes de inventario disponible' });
      return;
    }

    if (!user) {
      setActionMessage({ type: 'error', text: 'Usuario no autenticado' });
      return;
    }

    if (!validation?.canSubmit) {
      setActionMessage({ type: 'error', text: 'Hay errores críticos que deben corregirse antes de enviar' });
      return;
    }

    setSubmitting(true);
    setActionMessage(null);

    try {
      const response = await submitInventoryForApproval(
        prefillData.inventoryMonth.id,
        userDisplayName
      );

      if (response.success) {
        setActionMessage({ 
          type: 'success', 
          text: '✓ Inventario enviado a aprobación exitosamente. Ahora está en modo solo lectura.' 
        });
        // Reload data to reflect new status
        if (currentPlant) {
          const yearMonth = getCurrentYearMonth();
          await loadPlantData(currentPlant.id, yearMonth);
        }
      } else {
        setActionMessage({ type: 'error', text: `Error: ${response.error}` });
      }
    } catch (error) {
      setActionMessage({ type: 'error', text: 'Error al enviar a aprobación' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async () => {
    if (!prefillData.inventoryMonth) {
      setActionMessage({ type: 'error', text: 'No hay mes de inventario disponible' });
      return;
    }

    if (!user) {
      setActionMessage({ type: 'error', text: 'Usuario no autenticado' });
      return;
    }

    if (!validation?.canApprove) {
      setActionMessage({ type: 'error', text: 'Hay errores críticos que deben corregirse antes de aprobar' });
      return;
    }

    setApproving(true);
    setActionMessage(null);

    try {
      const response = await approveInventory(
        prefillData.inventoryMonth.id,
        userDisplayName
      );

      if (response.success) {
        setActionMessage({ 
          type: 'success', 
          text: '✓ Inventario aprobado exitosamente' 
        });
        // Reload data to reflect new status
        if (currentPlant) {
          const yearMonth = getCurrentYearMonth();
          await loadPlantData(currentPlant.id, yearMonth);
        }
      } else {
        setActionMessage({ type: 'error', text: `Error: ${response.error}` });
      }
    } catch (error) {
      setActionMessage({ type: 'error', text: 'Error al aprobar inventario' });
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!prefillData.inventoryMonth) {
      setActionMessage({ type: 'error', text: 'No hay mes de inventario disponible' });
      return;
    }

    if (!user) {
      setActionMessage({ type: 'error', text: 'Usuario no autenticado' });
      return;
    }

    if (!rejectionNotes.trim()) {
      setActionMessage({ type: 'error', text: 'Debes proporcionar notas de rechazo' });
      return;
    }

    setRejecting(true);
    setActionMessage(null);

    try {
      const response = await rejectInventory(
        prefillData.inventoryMonth.id,
        userDisplayName,
        rejectionNotes
      );

      if (response.success) {
        setActionMessage({ 
          type: 'success', 
          text: '✓ Inventario rechazado. El gerente puede editarlo nuevamente.' 
        });
        setShowRejectModal(false);
        setRejectionNotes('');
        // Reload data to reflect new status
        if (currentPlant) {
          const yearMonth = getCurrentYearMonth();
          await loadPlantData(currentPlant.id, yearMonth);
        }
      } else {
        setActionMessage({ type: 'error', text: `Error: ${response.error}` });
      }
    } catch (error) {
      setActionMessage({ type: 'error', text: 'Error al rechazar inventario' });
    } finally {
      setRejecting(false);
    }
  };

  // ============================================================================
  // RENDER: LOADING STATE
  // ============================================================================

  if (prefillData.loading) {
    return (
      <div className="p-6">
        <Card>
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#2475C7] mb-4"></div>
              <p className="text-[#5F6773]">Cargando datos del inventario...</p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // ============================================================================
  // RENDER: ERROR STATE
  // ============================================================================

  if (prefillData.error) {
    return (
      <div className="p-6">
        <Card className="border-red-300 bg-red-50">
          <div className="p-6">
            <div className="flex items-start gap-3">
              <div className="text-3xl">❌</div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-red-900 mb-2">
                  Error al Cargar Datos
                </h3>
                <p className="text-red-800">{prefillData.error}</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (!prefillData.inventoryMonth || !validation) {
    return (
      <div className="p-6">
        <Card className="text-center py-12">
          <p className="text-[#5F6773]">No hay datos de inventario para revisar</p>
        </Card>
      </div>
    );
  }

  const inventoryMonth = prefillData.inventoryMonth;
  const isInProgress = inventoryMonth.status === 'IN_PROGRESS';
  const isSubmitted = inventoryMonth.status === 'SUBMITTED';
  const isApproved = inventoryMonth.status === 'APPROVED';
  const reviewedPlantId = reportContext?.plantId ?? currentPlant?.id ?? inventoryMonth.plant_id;
  const reviewedPlantName =
    allPlants.find((plant) => plant.id === reviewedPlantId)?.name ||
    currentPlant?.name ||
    reviewedPlantId ||
    'Sin planta';

  // Check user permissions
  const canSubmit = isInProgress && normalizedRole === 'plant_manager';
  const canApprove = isSubmitted && (normalizedRole === 'admin' || normalizedRole === 'super_admin');
  const canReject = isSubmitted && (normalizedRole === 'admin' || normalizedRole === 'super_admin');
  const firstIncompleteSection = validation.allSections.find((section) => !section.isComplete) || null;

  // ============================================================================
  // RENDER: MAIN UI
  // ============================================================================

  return (
    <div className="p-6 space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#3B3A36]">Revisar y Aprobar Inventario</h2>
          <p className="text-[#5F6773]">Verificación de completitud y aprobación final</p>
        </div>
        <div className="text-sm text-[#5F6773]">
          <span className="font-semibold">{reviewedPlantName}</span>
          {' • '}
          <span>{formatYearMonthLabel(inventoryMonth.year_month)}</span>
        </div>
      </div>

      {/* STATUS BADGE */}
      <Card className={`p-4 ${
        isInProgress ? 'bg-yellow-50 border-yellow-300' :
        isSubmitted ? 'bg-blue-50 border-blue-300' :
        isApproved ? 'bg-green-50 border-green-300' : ''
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-3xl">
              {isInProgress && '📝'}
              {isSubmitted && '⏳'}
              {isApproved && '✅'}
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#3B3A36]">
                Estado: {
                  isInProgress ? 'En Progreso' :
                  isSubmitted ? 'Enviado a Aprobación' :
                  isApproved ? 'Aprobado' : 'Desconocido'
                }
              </h3>
              <p className="text-sm text-[#5F6773]">
                {isInProgress && 'El inventario está siendo completado por el gerente de planta'}
                {isSubmitted && 'El inventario ha sido enviado y está en espera de aprobación'}
                {isApproved && 'El inventario ha sido aprobado y está finalizado'}
              </p>
            </div>
          </div>
          {isSubmitted && inventoryMonth.created_by && (
            <div className="text-right text-sm text-[#5F6773]">
              <p className="font-semibold">Llenado por:</p>
              <p>{inventoryMonth.created_by}</p>
            </div>
          )}
          {isApproved && inventoryMonth.approved_by && (
            <div className="text-right text-sm text-[#5F6773]">
              <p className="font-semibold">Aprobado por:</p>
              <p>{inventoryMonth.approved_by}</p>
              {inventoryMonth.approved_at && (
                <p className="text-xs">
                  {new Date(inventoryMonth.approved_at).toLocaleString('es-ES')}
                </p>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* READ-ONLY WARNING */}
      {!isInProgress && (
        <Card className="bg-orange-50 border-orange-300">
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="text-2xl">🔒</div>
              <div>
                <h3 className="text-lg font-bold text-orange-900 mb-1">
                  Modo Solo Lectura
                </h3>
                <p className="text-sm text-orange-800">
                  Este inventario ha sido {isSubmitted ? 'enviado a aprobación' : 'aprobado'} y no puede ser editado.
                  {canReject && ' Como aprobador, puedes rechazarlo para permitir ediciones.'}
                </p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {isInProgress && (normalizedRole === 'admin' || normalizedRole === 'super_admin') && (
        <Card className="bg-blue-50 border-blue-300">
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="text-2xl">ℹ️</div>
              <div>
                <h3 className="text-lg font-bold text-blue-900 mb-1">
                  Aún no se puede aprobar
                </h3>
                <p className="text-sm text-blue-800">
                  Este inventario sigue en estado "En Progreso". El gerente de planta debe enviarlo a aprobación para que aparezca el botón de aprobar o rechazar.
                </p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* OVERALL SUMMARY */}
      <Card>
        <div className="p-6">
          <h3 className="text-xl font-bold text-[#3B3A36] mb-4">Resumen General</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
              <p className="text-sm text-[#5F6773] mb-1">Secciones Totales</p>
              <p className="text-3xl font-bold text-blue-600">{validation.totalSections}</p>
            </div>
            
            <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4">
              <p className="text-sm text-[#5F6773] mb-1">Secciones Completas</p>
              <p className="text-3xl font-bold text-green-600">{validation.completeSections}</p>
            </div>
            
            <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
              <p className="text-sm text-[#5F6773] mb-1">Errores Críticos</p>
              <p className="text-3xl font-bold text-red-600">{validation.totalCriticalIssues}</p>
            </div>
            
            <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
              <p className="text-sm text-[#5F6773] mb-1">Advertencias</p>
              <p className="text-3xl font-bold text-yellow-600">{validation.totalWarningIssues}</p>
            </div>
          </div>

          {/* COMPLETION BAR */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm font-semibold text-[#3B3A36]">Progreso de Completitud</p>
              <p className="text-sm font-semibold text-[#3B3A36]">
                {validation.totalSections === 0 ? 0 : Math.round((validation.completeSections / validation.totalSections) * 100)}%
              </p>
            </div>
            <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-500"
                style={{ width: `${validation.totalSections === 0 ? 0 : (validation.completeSections / validation.totalSections) * 100}%` }}
              />
            </div>
          </div>

          {/* CAN SUBMIT INDICATOR */}
          {validation.canSubmit ? (
            <div className="bg-green-50 border border-green-300 rounded p-3">
              <p className="text-green-800 font-semibold">
                ✓ El inventario está completo y listo para enviar a aprobación
              </p>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-300 rounded p-3">
              <p className="text-red-800 font-semibold">
                ⚠️ Hay {validation.totalCriticalIssues} errores críticos que deben corregirse antes de enviar
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* SECTION VALIDATION DETAILS */}
      <div className="space-y-4">
        <h3 className="text-xl font-bold text-[#3B3A36]">Detalle por Sección</h3>
        
        {validation.allSections.map((section) => (
          <Card key={section.sectionId} className={
            section.isComplete ? 'border-green-300 bg-green-50/30' : 'border-red-300 bg-red-50/30'
          }>
            <div className="p-4">
              {/* SECTION HEADER */}
              <div 
                className="flex items-center justify-between cursor-pointer"
                onClick={() => toggleSection(section.sectionId)}
              >
                <div className="flex items-center gap-3">
                  <div className="text-2xl">
                    {section.isComplete ? '✅' : '⚠️'}
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-[#3B3A36]">{section.sectionName}</h4>
                    <p className="text-sm text-[#5F6773]">
                      {section.completeItems} / {section.totalItems} ítems completos
                      {section.criticalIssues > 0 && (
                        <span className="text-red-600 ml-2">
                          • {section.criticalIssues} errores
                        </span>
                      )}
                      {section.warningIssues > 0 && (
                        <span className="text-yellow-600 ml-2">
                          • {section.warningIssues} advertencias
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="text-[#5F6773]">
                  {expandedSections.has(section.sectionId) ? '▼' : '▶'}
                </div>
              </div>

              {isInProgress && normalizedRole === 'plant_manager' && !section.isComplete && (
                <div className="mt-4 flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => handleContinueSection(section)}
                  >
                    Continuar sección
                  </Button>
                </div>
              )}

              {/* SECTION DETAILS (EXPANDABLE) */}
              {expandedSections.has(section.sectionId) && section.issues.length > 0 && (
                <div className="mt-4 pt-4 border-t border-[#D4D2CF]">
                  <h5 className="text-sm font-semibold text-[#3B3A36] mb-2">Problemas Encontrados:</h5>
                  <ul className="space-y-2">
                    {section.issues.map((issue, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <span className="text-lg">
                          {issue.severity === 'error' ? '❌' : '⚠️'}
                        </span>
                        <div>
                          <p className={`font-semibold ${
                            issue.severity === 'error' ? 'text-red-700' : 'text-yellow-700'
                          }`}>
                            {issue.field}
                          </p>
                          <p className="text-[#5F6773]">{issue.message}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* ACTION MESSAGE */}
      {actionMessage && (
        <Card className={`p-4 ${
          actionMessage.type === 'success' 
            ? 'bg-green-50 border-green-300' 
            : 'bg-red-50 border-red-300'
        }`}>
          <p className={`text-sm font-semibold ${
            actionMessage.type === 'success' ? 'text-green-800' : 'text-red-800'
          }`}>
            {actionMessage.text}
          </p>
        </Card>
      )}

      {/* ACTION BUTTONS */}
      <Card className="p-6">
        <div className="flex justify-between items-center gap-4">
          {/* LEFT SIDE: INFO */}
          <div className="flex-1">
            {isInProgress && canSubmit && (
              <p className="text-sm text-[#5F6773]">
                {validation.canSubmit 
                  ? '✓ Puedes guardar como borrador o enviar a aprobación'
                  : '⚠️ Corrige los errores antes de enviar a aprobación'}
              </p>
            )}
            {isSubmitted && canApprove && (
              <p className="text-sm text-[#5F6773]">
                {validation.canApprove
                  ? '✓ Puedes aprobar o rechazar este inventario'
                  : '⚠️ Hay errores que deben corregirse antes de aprobar'}
              </p>
            )}
          </div>

          {/* RIGHT SIDE: BUTTONS */}
          <div className="flex gap-3">
            {isInProgress && normalizedRole === 'plant_manager' && firstIncompleteSection && (
              <Button
                onClick={() => handleContinueSection(firstIncompleteSection)}
                variant="secondary"
                size="lg"
              >
                ↩️ Continuar llenado
              </Button>
            )}

            {/* DRAFT BUTTON (Plant Manager, IN_PROGRESS) */}
            {isInProgress && canSubmit && (
              <Button
                onClick={handleSaveDraft}
                variant="secondary"
                size="lg"
              >
                💾 Guardar Borrador
              </Button>
            )}

            {/* SUBMIT BUTTON (Plant Manager, IN_PROGRESS) */}
            {isInProgress && canSubmit && (
              <Button
                onClick={handleSubmitForApproval}
                disabled={!validation.canSubmit || submitting}
                size="lg"
                className="bg-blue-600 hover:bg-blue-700"
              >
                {submitting ? 'Enviando...' : '📤 Enviar a Aprobación'}
              </Button>
            )}

            {/* REJECT BUTTON (Admin, SUBMITTED) */}
            {isSubmitted && canReject && (
              <Button
                onClick={() => setShowRejectModal(true)}
                variant="secondary"
                size="lg"
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                ❌ Rechazar
              </Button>
            )}

            {/* APPROVE BUTTON (Admin, SUBMITTED) */}
            {isSubmitted && canApprove && (
              <Button
                onClick={handleApprove}
                disabled={!validation.canApprove || approving}
                size="lg"
                className="bg-green-600 hover:bg-green-700"
              >
                {approving ? 'Aprobando...' : '✅ Aprobar Inventario'}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* REJECT MODAL */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-lg w-full">
            <div className="p-6 space-y-4">
              <h3 className="text-xl font-bold text-[#3B3A36]">Rechazar Inventario</h3>
              <p className="text-sm text-[#5F6773]">
                El inventario volverá al estado "En Progreso" y el gerente podrá editarlo nuevamente.
                Por favor, proporciona las razones del rechazo:
              </p>
              
              <textarea
                value={rejectionNotes}
                onChange={(e) => setRejectionNotes(e.target.value)}
                placeholder="Explica por qué estás rechazando este inventario..."
                className="w-full px-4 py-2.5 border border-[#9D9B9A] rounded focus:outline-none focus:ring-2 focus:ring-[#2475C7] focus:border-transparent resize-none"
                rows={4}
                required
              />

              <div className="flex justify-end gap-3">
                <Button
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectionNotes('');
                  }}
                  variant="secondary"
                  disabled={rejecting}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleReject}
                  disabled={!rejectionNotes.trim() || rejecting}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {rejecting ? 'Rechazando...' : 'Confirmar Rechazo'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
