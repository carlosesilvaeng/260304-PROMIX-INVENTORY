import React from 'react';
import { Button } from '../components/Button';
import { PromixLogo } from '../components/PromixLogo';

export function Documentation() {
  const handlePrint = () => {
    window.print();
  };

  const currentDate = new Date().toLocaleString('es-PR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'America/Puerto_Rico'
  });

  return (
    <div className="min-h-screen bg-white">
      {/* Print Button - Hidden when printing */}
      <div className="fixed top-4 right-4 print:hidden">
        <Button onClick={handlePrint} className="shadow-lg">
          📄 Exportar a PDF
        </Button>
      </div>

      {/* Document Content */}
      <div className="max-w-4xl mx-auto p-8 print:p-12">
        {/* Header */}
        <div className="border-b-4 border-[#2B7DE9] pb-6 mb-8">
          <div className="flex justify-center mb-4">
            <PromixLogo size="xl" />
          </div>
          <p className="text-xl text-[#3D3F42] mb-4 text-center">
            Sistema de Gestión de Inventarios Mensuales
          </p>
          <div className="flex justify-between items-center">
            <p className="text-sm text-[#5F6773]">
              <strong>Versión:</strong> 1.0.0
            </p>
            <p className="text-sm text-[#5F6773]">
              <strong>Fecha de generación:</strong> {currentDate}
            </p>
          </div>
        </div>

        {/* Executive Summary */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-[#3B3A36] mb-4 border-l-4 border-[#2475C7] pl-4">
            Resumen Ejecutivo
          </h2>
          <p className="text-[#3B3A36] leading-relaxed mb-4">
            PROMIX Plant Inventory es una aplicación web completa desarrollada para realizar y aprobar 
            inventarios mensuales de plantas de concreto con captura en campo móvil/tablet, validación 
            obligatoria, evidencia fotográfica y sincronización central.
          </p>
          <p className="text-[#3B3A36] leading-relaxed">
            La aplicación está diseñada con una identidad visual industrial específica basada en la 
            marca PROMIX, enfocada en operación técnica y eficiencia en campo.
          </p>
        </section>

        {/* Plantas */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-[#3B3A36] mb-4 border-l-4 border-[#2475C7] pl-4">
            Plantas PROMIX
          </h2>
          <p className="text-[#3B3A36] leading-relaxed">
            La información de plantas, códigos, ubicaciones, silos, cajones y caja menor se toma de la
            configuración activa del sistema. Esta documentación no incluye ejemplos fijos para evitar
            confusión con datos reales de operación.
          </p>
        </section>

        {/* Roles y Permisos */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-[#3B3A36] mb-4 border-l-4 border-[#2475C7] pl-4">
            Roles y Permisos
          </h2>
          <div className="space-y-4">
            <div className="border border-[#9D9B9A] p-4 rounded bg-[#F2F3F5]">
              <h3 className="font-bold text-[#3B3A36] mb-2">👨‍💼 Super Administrador</h3>
              <ul className="list-disc list-inside text-[#5F6773] text-sm space-y-1">
                <li>Crear y gestionar plantas</li>
                <li>Activar/desactivar plantas</li>
                <li>Configuración completa del sistema</li>
                <li>Acceso a todas las plantas activas</li>
                <li>Gestión de usuarios y asignaciones</li>
              </ul>
            </div>
            <div className="border border-[#9D9B9A] p-4 rounded">
              <h3 className="font-bold text-[#3B3A36] mb-2">👨‍💻 Administrador</h3>
              <ul className="list-disc list-inside text-[#5F6773] text-sm space-y-1">
                <li>Aprobar inventarios completados</li>
                <li>Visualizar reportes y estadísticas</li>
                <li>Acceso a plantas asignadas</li>
                <li>Configuración de plantas</li>
                <li>Auditoría y trazabilidad</li>
              </ul>
            </div>
            <div className="border border-[#9D9B9A] p-4 rounded">
              <h3 className="font-bold text-[#3B3A36] mb-2">👷 Gerente de Planta</h3>
              <ul className="list-disc list-inside text-[#5F6773] text-sm space-y-1">
                <li>Captura de inventario en campo</li>
                <li>Toma de fotografías como evidencia</li>
                <li>Acceso a plantas asignadas específicamente</li>
                <li>Completar secciones del inventario</li>
                <li>Visualizar historial de su planta</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Secciones de Inventario */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-[#3B3A36] mb-4 border-l-4 border-[#2475C7] pl-4">
            Secciones de Inventario (7 Total)
          </h2>
          <div className="space-y-3">
            <div className="flex items-start gap-3 border-b border-[#9D9B9A] pb-3">
              <span className="text-2xl">📦</span>
              <div>
                <h3 className="font-bold text-[#3B3A36]">1. Agregados</h3>
                <p className="text-sm text-[#5F6773]">
                  Medición de Arena, Piedra y Gravilla con métodos Cajón y Cono. Incluye cálculos 
                  automáticos de volúmenes y fotografías obligatorias.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 border-b border-[#9D9B9A] pb-3">
              <span className="text-2xl">🏢</span>
              <div>
                <h3 className="font-bold text-[#3B3A36]">2. Silos</h3>
                <p className="text-sm text-[#5F6773]">
                  Lecturas de Cemento y Slag por silo con nombre específico. Cada planta tiene 
                  configuración personalizada de silos.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 border-b border-[#9D9B9A] pb-3">
              <span className="text-2xl">⚗️</span>
              <div>
                <h3 className="font-bold text-[#3B3A36]">3. Aditivos</h3>
                <p className="text-sm text-[#5F6773]">
                  Control de tanques de aditivos y productos químicos con lecturas de nivel y 
                  registro de productos manuales adicionales.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 border-b border-[#9D9B9A] pb-3">
              <span className="text-2xl">⛽</span>
              <div>
                <h3 className="font-bold text-[#3B3A36]">4. Diesel</h3>
                <p className="text-sm text-[#5F6773]">
                  Inventario de diesel con lectura inicial, final, recibos y cálculo automático 
                  de consumo.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 border-b border-[#9D9B9A] pb-3">
              <span className="text-2xl">🛢️</span>
              <div>
                <h3 className="font-bold text-[#3B3A36]">5. Aceites y Productos</h3>
                <p className="text-sm text-[#5F6773]">
                  Registro de aceites, lubricantes y otros productos adicionales con cantidades 
                  y evidencia fotográfica.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 border-b border-[#9D9B9A] pb-3">
              <span className="text-2xl">💧</span>
              <div>
                <h3 className="font-bold text-[#3B3A36]">6. Utilidades</h3>
                <p className="text-sm text-[#5F6773]">
                  Control de Agua AAA, Agua de Pozo y Electricidad (AEE) con lecturas iniciales 
                  y finales para cálculo de consumo.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-2xl">💵</span>
              <div>
                <h3 className="font-bold text-[#3B3A36]">7. Petty Cash</h3>
                <p className="text-sm text-[#5F6773]">
                  Control de efectivo con monto establecido por planta, registro de recibos con 
                  fotos, cálculo automático de diferencias y balance final.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Características Técnicas */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-[#3B3A36] mb-4 border-l-4 border-[#2475C7] pl-4">
            Características Técnicas
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-bold text-[#3B3A36] mb-2">📱 Responsive Design</h3>
              <ul className="list-disc list-inside text-[#5F6773] text-sm space-y-1">
                <li>Desktop: 1440px optimizado</li>
                <li>Móvil/Tablet: 390px+</li>
                <li>Diseño adaptable a campo</li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-[#3B3A36] mb-2">📸 Captura Fotográfica</h3>
              <ul className="list-disc list-inside text-[#5F6773] text-sm space-y-1">
                <li>Evidencia obligatoria</li>
                <li>Acceso a cámara nativa</li>
                <li>Preview antes de guardar</li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-[#3B3A36] mb-2">🔢 Cálculos Automáticos</h3>
              <ul className="list-disc list-inside text-[#5F6773] text-sm space-y-1">
                <li>Volúmenes de agregados</li>
                <li>Consumo de diesel y utilidades</li>
                <li>Balance de Petty Cash</li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-[#3B3A36] mb-2">✅ Validación Completa</h3>
              <ul className="list-disc list-inside text-[#5F6773] text-sm space-y-1">
                <li>Campos obligatorios</li>
                <li>Fotos requeridas</li>
                <li>Progreso por sección</li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-[#3B3A36] mb-2">💾 Persistencia Local</h3>
              <ul className="list-disc list-inside text-[#5F6773] text-sm space-y-1">
                <li>LocalStorage para datos</li>
                <li>Recuperación automática</li>
                <li>Trabajo sin conexión</li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-[#3B3A36] mb-2">📊 Reportes y Auditoría</h3>
              <ul className="list-disc list-inside text-[#5F6773] text-sm space-y-1">
                <li>Historial completo</li>
                <li>Filtros por planta y fecha</li>
                <li>Exportación de datos</li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-[#3B3A36] mb-2">👥 Trazabilidad Total</h3>
              <ul className="list-disc list-inside text-[#5F6773] text-sm space-y-1">
                <li>Registro de "Diligenciado por"</li>
                <li>Registro de "Aprobado por"</li>
                <li>Fechas de creación y aprobación</li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-[#3B3A36] mb-2">🏭 Gestión de Plantas</h3>
              <ul className="list-disc list-inside text-[#5F6773] text-sm space-y-1">
                <li>Activar/desactivar plantas</li>
                <li>Asignación múltiple de plantas</li>
                <li>Configuración de silos por nombre</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Identidad Visual */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-[#3B3A36] mb-4 border-l-4 border-[#2475C7] pl-4">
            Identidad Visual PROMIX
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="w-full h-20 bg-[#2475C7] rounded mb-2 flex items-center justify-center">
                <span className="text-white text-xs font-bold">Primario</span>
              </div>
              <p className="text-xs text-[#5F6773] font-mono">#2475C7</p>
            </div>
            <div className="text-center">
              <div className="w-full h-20 bg-[#3B3A36] rounded mb-2 flex items-center justify-center">
                <span className="text-white text-xs font-bold">Oscuro</span>
              </div>
              <p className="text-xs text-[#5F6773] font-mono">#3B3A36</p>
            </div>
            <div className="text-center">
              <div className="w-full h-20 bg-[#5F6773] rounded mb-2 flex items-center justify-center">
                <span className="text-white text-xs font-bold">Gris</span>
              </div>
              <p className="text-xs text-[#5F6773] font-mono">#5F6773</p>
            </div>
            <div className="text-center">
              <div className="w-full h-20 bg-[#F2F3F5] rounded mb-2 border border-[#9D9B9A] flex items-center justify-center">
                <span className="text-[#3B3A36] text-xs font-bold">Claro</span>
              </div>
              <p className="text-xs text-[#5F6773] font-mono">#F2F3F5</p>
            </div>
          </div>
          <p className="text-sm text-[#5F6773] mt-4">
            <strong>Tipografía:</strong> Sans-serif técnica de alta legibilidad optimizada para 
            operación en campo e interfaces industriales.
          </p>
        </section>

        {/* Stack Técnico */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-[#3B3A36] mb-4 border-l-4 border-[#2475C7] pl-4">
            Stack Tecnológico
          </h2>
          <div className="bg-[#F2F3F5] p-6 rounded border border-[#9D9B9A]">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="font-bold text-[#3B3A36]">Frontend</p>
                <p className="text-[#5F6773]">React 18</p>
                <p className="text-[#5F6773]">TypeScript</p>
              </div>
              <div>
                <p className="font-bold text-[#3B3A36]">Estilos</p>
                <p className="text-[#5F6773]">Tailwind CSS v4</p>
                <p className="text-[#5F6773]">Responsive Design</p>
              </div>
              <div>
                <p className="font-bold text-[#3B3A36]">Estado</p>
                <p className="text-[#5F6773]">Context API</p>
                <p className="text-[#5F6773]">LocalStorage</p>
              </div>
              <div>
                <p className="font-bold text-[#3B3A36]">Componentes</p>
                <p className="text-[#5F6773]">Sistema modular</p>
                <p className="text-[#5F6773]">Reutilizables</p>
              </div>
              <div>
                <p className="font-bold text-[#3B3A36]">Compatibilidad</p>
                <p className="text-[#5F6773]">Chrome, Safari, Edge</p>
                <p className="text-[#5F6773]">iOS y Android</p>
              </div>
              <div>
                <p className="font-bold text-[#3B3A36]">Desarrollo</p>
                <p className="text-[#5F6773]">Vite</p>
                <p className="text-[#5F6773]">Hot Reload</p>
              </div>
            </div>
          </div>
        </section>

        {/* Flujo de Trabajo */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-[#3B3A36] mb-4 border-l-4 border-[#2475C7] pl-4">
            Flujo de Trabajo
          </h2>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-[#2475C7] text-white rounded-full flex items-center justify-center font-bold">
                1
              </div>
              <div className="flex-1 border border-[#9D9B9A] p-3 rounded">
                <p className="font-bold text-[#3B3A36]">Login y Autenticación</p>
                <p className="text-sm text-[#5F6773]">Usuario ingresa con credenciales y es validado según su rol</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-[#2475C7] text-white rounded-full flex items-center justify-center font-bold">
                2
              </div>
              <div className="flex-1 border border-[#9D9B9A] p-3 rounded">
                <p className="font-bold text-[#3B3A36]">Selección de Planta</p>
                <p className="text-sm text-[#5F6773]">Usuario selecciona la planta asignada donde realizará el inventario</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-[#2475C7] text-white rounded-full flex items-center justify-center font-bold">
                3
              </div>
              <div className="flex-1 border border-[#9D9B9A] p-3 rounded">
                <p className="font-bold text-[#3B3A36]">Dashboard Principal</p>
                <p className="text-sm text-[#5F6773]">Vista general con progreso de las 7 secciones del inventario</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-[#2475C7] text-white rounded-full flex items-center justify-center font-bold">
                4
              </div>
              <div className="flex-1 border border-[#9D9B9A] p-3 rounded">
                <p className="font-bold text-[#3B3A36]">Captura por Sección</p>
                <p className="text-sm text-[#5F6773]">Ingreso de datos, mediciones y fotografías por cada sección</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-[#2475C7] text-white rounded-full flex items-center justify-center font-bold">
                5
              </div>
              <div className="flex-1 border border-[#9D9B9A] p-3 rounded">
                <p className="font-bold text-[#3B3A36]">Validación y Revisión</p>
                <p className="text-sm text-[#5F6773]">Sistema valida completitud y evidencias antes de finalizar</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-[#2475C7] text-white rounded-full flex items-center justify-center font-bold">
                6
              </div>
              <div className="flex-1 border border-[#9D9B9A] p-3 rounded">
                <p className="font-bold text-[#3B3A36]">Sincronización y Aprobación</p>
                <p className="text-sm text-[#5F6773]">Inventario se sincroniza y queda disponible para aprobación del Admin</p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="border-t-2 border-[#9D9B9A] pt-6 mt-8">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-[#3B3A36] font-bold">PROMIX</p>
              <p className="text-xs text-[#5F6773]">Plant Inventory Management System</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-[#5F6773]">Versión 1.0.0</p>
              <p className="text-xs text-[#5F6773]">© 2026 PROMIX. Todos los derechos reservados.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:p-12 {
            padding: 3rem !important;
          }
          @page {
            margin: 2cm;
            size: letter;
          }
        }
      `}</style>
    </div>
  );
}
