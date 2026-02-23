import React, { useState } from 'react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Select } from '../components/Select';
import { Alert } from '../components/Alert';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { PromixLogo } from '../components/PromixLogo';

// Mock historical data
const MOCK_REPORTS = [
  {
    id: 'rep-1',
    plantId: '1',
    plantName: 'CAROLINA',
    month: 'Diciembre',
    year: 2024,
    status: 'approved',
    startTimestamp: new Date('2024-12-30T08:30:00'),
    endTimestamp: new Date('2024-12-31T14:45:00'),
    aggregates: 12,
    silos: 3,
    createdBy: 'Carlos Rodríguez',
    createdByRole: 'Gerente de Planta',
    approvedBy: 'Ana García',
    approvedByRole: 'Administrador',
    approvedAt: new Date('2024-12-31T15:30:00'),
  },
  {
    id: 'rep-2',
    plantId: '1',
    plantName: 'CAROLINA',
    month: 'Noviembre',
    year: 2024,
    status: 'approved',
    startTimestamp: new Date('2024-11-29T09:00:00'),
    endTimestamp: new Date('2024-11-30T13:20:00'),
    aggregates: 15,
    silos: 3,
    createdBy: 'Carlos Rodríguez',
    createdByRole: 'Gerente de Planta',
    approvedBy: 'Ana García',
    approvedByRole: 'Administrador',
    approvedAt: new Date('2024-11-30T14:00:00'),
  },
  {
    id: 'rep-3',
    plantId: '3',
    plantName: 'GUAYNABO',
    month: 'Diciembre',
    year: 2024,
    status: 'approved',
    startTimestamp: new Date('2024-12-29T08:00:00'),
    endTimestamp: new Date('2024-12-30T12:30:00'),
    aggregates: 10,
    silos: 3,
    createdBy: 'María López',
    createdByRole: 'Gerente de Planta',
    approvedBy: 'Ana García',
    approvedByRole: 'Super Administrador',
    approvedAt: new Date('2024-12-30T13:15:00'),
  },
  {
    id: 'rep-4',
    plantId: '2',
    plantName: 'CEIBA',
    month: 'Diciembre',
    year: 2024,
    status: 'completed',
    startTimestamp: new Date('2024-12-27T07:45:00'),
    endTimestamp: new Date('2024-12-28T15:00:00'),
    aggregates: 8,
    silos: 2,
    createdBy: 'Carlos Rodríguez',
    createdByRole: 'Gerente de Planta',
    approvedBy: null,
    approvedByRole: null,
    approvedAt: null,
  },
  {
    id: 'rep-5',
    plantId: '5',
    plantName: 'VEGA BAJA',
    month: 'Noviembre',
    year: 2024,
    status: 'in-progress',
    startTimestamp: new Date('2024-11-28T08:15:00'),
    endTimestamp: null,
    aggregates: 11,
    silos: 3,
    createdBy: 'Pedro Martínez',
    createdByRole: 'Gerente de Planta',
    approvedBy: null,
    approvedByRole: null,
    approvedAt: null,
  },
  {
    id: 'rep-6',
    plantId: '6',
    plantName: 'HUMACAO',
    month: 'Diciembre',
    year: 2024,
    status: 'approved',
    startTimestamp: new Date('2024-12-28T09:30:00'),
    endTimestamp: new Date('2024-12-29T14:00:00'),
    aggregates: 9,
    silos: 2,
    createdBy: 'Luis Torres',
    createdByRole: 'Gerente de Planta',
    approvedBy: 'Ana García',
    approvedByRole: 'Administrador',
    approvedAt: new Date('2024-12-29T15:45:00'),
  },
];

export function Reports() {
  const { currentPlant, user } = useAuth();
  const { t, language } = useLanguage();
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedYear, setSelectedYear] = useState('2024');
  const [showExportSuccess, setShowExportSuccess] = useState(false);

  const filteredReports = MOCK_REPORTS.filter(report => {
    if (user?.role !== 'admin') {
      // Gerentes solo ven su planta
      if (report.plantId !== currentPlant?.id) return false;
    }
    if (selectedMonth !== 'all' && report.month !== selectedMonth) return false;
    if (selectedYear !== 'all' && report.year.toString() !== selectedYear) return false;
    return true;
  });

  const handleExportPDF = () => {
    setShowExportSuccess(true);
    setTimeout(() => setShowExportSuccess(false), 3000);
    // Aquí iría la lógica real de exportación
  };

  const handleExportExcel = () => {
    setShowExportSuccess(true);
    setTimeout(() => setShowExportSuccess(false), 3000);
    // Aquí iría la lógica real de exportación
  };

  return (
    <div className="p-6 space-y-6">
      {/* Logo Header */}
      <div className="flex justify-center mb-2">
        <PromixLogo size="lg" />
      </div>
      
      <div>
        <h2 className="text-2xl text-[#3B3A36]">Reportes</h2>
        <p className="text-[#5F6773]">Historial y exportación de inventarios</p>
      </div>

      {showExportSuccess && (
        <Alert 
          type="success" 
          message="Reporte exportado exitosamente" 
          autoClose 
        />
      )}

      {/* Filters */}
      <Card>
        <h3 className="text-lg text-[#3B3A36] mb-4">Filtros</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Select
            label="Mes"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            options={[
              { value: 'all', label: 'Todos los meses' },
              { value: 'Enero', label: 'Enero' },
              { value: 'Febrero', label: 'Febrero' },
              { value: 'Marzo', label: 'Marzo' },
              { value: 'Abril', label: 'Abril' },
              { value: 'Mayo', label: 'Mayo' },
              { value: 'Junio', label: 'Junio' },
              { value: 'Julio', label: 'Julio' },
              { value: 'Agosto', label: 'Agosto' },
              { value: 'Septiembre', label: 'Septiembre' },
              { value: 'Octubre', label: 'Octubre' },
              { value: 'Noviembre', label: 'Noviembre' },
              { value: 'Diciembre', label: 'Diciembre' },
            ]}
          />
          
          <Select
            label="Año"
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            options={[
              { value: 'all', label: 'Todos los años' },
              { value: '2025', label: '2025' },
              { value: '2024', label: '2024' },
              { value: '2023', label: '2023' },
            ]}
          />

          <div className="flex items-end gap-2">
            <Button variant="secondary" onClick={handleExportPDF} className="flex-1">
              📄 PDF
            </Button>
            <Button variant="secondary" onClick={handleExportExcel} className="flex-1">
              📊 Excel
            </Button>
          </div>
        </div>
      </Card>

      {/* Reports Table */}
      <Card noPadding>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#3B3A36] text-white">
              <tr>
                <th className="px-6 py-3 text-left">Planta</th>
                <th className="px-6 py-3 text-left">Período</th>
                <th className="px-6 py-3 text-left">Fecha Completado</th>
                <th className="px-6 py-3 text-center">Agregados</th>
                <th className="px-6 py-3 text-center">Silos</th>
                <th className="px-6 py-3 text-left">Diligenciado por</th>
                <th className="px-6 py-3 text-left">Aprobado por</th>
                <th className="px-6 py-3 text-center">Estado</th>
                <th className="px-6 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-[#5F6773]">
                    No hay reportes que coincidan con los filtros seleccionados
                  </td>
                </tr>
              ) : (
                filteredReports.map((report) => {
                  // Determinar qué timestamp mostrar en "Diligenciado por"
                  const completionTimestamp = report.status === 'in-progress' 
                    ? report.startTimestamp 
                    : report.endTimestamp;
                    
                  return (
                  <tr key={report.id} className="border-b border-[#9D9B9A] hover:bg-[#F2F3F5] transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-[#3B3A36] font-medium">
                        {report.plantName}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-[#3B3A36]">
                      {report.month} {report.year}
                    </td>
                    <td className="px-6 py-4">
                      {report.endTimestamp ? (
                        <>
                          <p className="text-[#3B3A36] text-sm">
                            {report.endTimestamp.toLocaleDateString(language === 'es' ? 'es' : 'en', { 
                              day: '2-digit', 
                              month: 'short', 
                              year: 'numeric' 
                            })}
                          </p>
                          <p className="text-xs text-[#5F6773]">
                            {report.endTimestamp.toLocaleTimeString(language === 'es' ? 'es' : 'en', { 
                              hour: '2-digit', 
                              minute: '2-digit',
                              hour12: true 
                            })}
                          </p>
                        </>
                      ) : (
                        <p className="text-[#9D9B9A] text-sm">{t('status.inProgress')}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center text-[#3B3A36]">
                      {report.aggregates}
                    </td>
                    <td className="px-6 py-4 text-center text-[#3B3A36]">
                      {report.silos}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[#3B3A36] text-sm font-medium">{report.createdBy}</p>
                      <p className="text-xs text-[#5F6773] mb-1">{report.createdByRole}</p>
                      {completionTimestamp && (
                        <div className="mt-1 pt-1 border-t border-[#9D9B9A]/20">
                          <p className="text-xs text-[#2475C7] font-medium">
                            {completionTimestamp.toLocaleDateString(language === 'es' ? 'es' : 'en', { 
                              day: '2-digit', 
                              month: 'short', 
                              year: 'numeric' 
                            })}
                          </p>
                          <p className="text-xs text-[#5F6773]">
                            {completionTimestamp.toLocaleTimeString(language === 'es' ? 'es' : 'en', { 
                              hour: '2-digit', 
                              minute: '2-digit',
                              hour12: true 
                            })}
                          </p>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {report.approvedBy ? (
                        <>
                          <p className="text-[#3B3A36] text-sm font-medium">{report.approvedBy}</p>
                          <p className="text-xs text-[#5F6773] mb-1">{report.approvedByRole}</p>
                          {report.approvedAt && (
                            <div className="mt-1 pt-1 border-t border-[#9D9B9A]/20">
                              <p className="text-xs text-[#2ecc71] font-medium">
                                {report.approvedAt.toLocaleDateString(language === 'es' ? 'es' : 'en', { 
                                  day: '2-digit', 
                                  month: 'short', 
                                  year: 'numeric' 
                                })}
                              </p>
                              <p className="text-xs text-[#5F6773]">
                                {report.approvedAt.toLocaleTimeString(language === 'es' ? 'es' : 'en', { 
                                  hour: '2-digit', 
                                  minute: '2-digit',
                                  hour12: true 
                                })}
                              </p>
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-[#9D9B9A] text-sm">{t('review.pendingApproval')}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-3 py-1 rounded text-sm ${
                        report.status === 'approved' ? 'bg-[#2ecc71]/10 text-[#2ecc71]' :
                        report.status === 'completed' ? 'bg-[#2475C7]/10 text-[#2475C7]' :
                        'bg-[#f59e0b]/10 text-[#f59e0b]'
                      }`}>
                        {report.status === 'approved' ? t('status.approved') :
                         report.status === 'completed' ? t('status.completed') :
                         t('status.inProgress')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <Button variant="ghost" size="sm">
                          {t('common.view')}
                        </Button>
                        <Button variant="ghost" size="sm">
                          📄
                        </Button>
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <h3 className="text-sm text-[#5F6773] mb-1">Total Reportes</h3>
          <p className="text-3xl font-bold text-[#2475C7]">{filteredReports.length}</p>
        </Card>
        
        <Card>
          <h3 className="text-sm text-[#5F6773] mb-1">Este Año</h3>
          <p className="text-3xl font-bold text-[#2475C7]">
            {MOCK_REPORTS.filter(r => r.year === 2024).length}
          </p>
        </Card>
        
        <Card>
          <h3 className="text-sm text-[#5F6773] mb-1">Completados</h3>
          <p className="text-3xl font-bold text-[#2ecc71]">
            {MOCK_REPORTS.filter(r => r.status === 'completed').length}
          </p>
        </Card>
      </div>
    </div>
  );
}