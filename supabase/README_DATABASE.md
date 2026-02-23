# PROMIX Plant Inventory - Database Setup Guide

Este documento explica cómo configurar la base de datos del sistema de inventarios PROMIX.

## 📋 Resumen del Sistema

El sistema utiliza un modelo de datos de dos capas:

1. **Tablas de Configuración (`plant_*_config`)**: Definen qué equipos, medidores y productos tiene cada planta
2. **Tablas Mensuales (`inventory_*_entries`)**: Almacenan las lecturas y datos del inventario de cada mes

## 🚀 Instrucciones de Setup

### Opción 1: Setup Automático (Recomendado)

1. Inicia sesión como **super_admin** en la aplicación
2. Ve a **Database Setup** en el menú lateral
3. Haz clic en **"Ejecutar Setup Completo"**
4. El sistema verificará si las tablas existen
5. Si faltan tablas, continúa con la Opción 2

### Opción 2: Setup Manual (Si la Opción 1 falla)

#### Paso 1: Crear las Tablas en Supabase

1. Ve a tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard)
2. Haz clic en **SQL Editor** en el menú lateral
3. Crea una nueva query
4. Copia y pega el contenido completo del archivo `/supabase/schema.sql`
5. Haz clic en **"Run"** para ejecutar el SQL
6. Deberías ver el mensaje: "✅ PROMIX Inventory Database Schema created successfully!"

#### Paso 2: Cargar Datos de Configuración

1. Vuelve a la aplicación PROMIX
2. Ve a **Database Setup** en el menú lateral
3. Haz clic en **"Cargar Configuraciones"**
4. Esto cargará las configuraciones de las 6 plantas PROMIX con:
   - Silos (4 por planta)
   - Agregados/Cajones (4 por planta)
   - Aditivos (4 por planta)
   - Tanque de diesel
   - Productos (aceites, etc)
   - Medidores de utilidades (agua, luz)
   - Petty Cash

## 🏭 Plantas Configuradas

El sistema incluye configuraciones para las 6 plantas PROMIX:

| Planta | Petty Cash |
|--------|-----------|
| CAROLINA | $1,500.00 |
| CEIBA | $1,200.00 |
| GUAYNABO | $1,500.00 |
| GURABO | $1,200.00 |
| VEGA_BAJA | $1,000.00 |
| HUMACAO | $1,000.00 |

## 📊 Estructura de Tablas

### Tablas de Configuración

- `calibration_curves` - Curvas de calibración (pulgadas → galones)
- `plant_aggregates_config` - Configuración de cajones/conos
- `plant_silos_config` - Configuración de silos
- `silo_allowed_products` - Productos permitidos por silo
- `plant_additives_config` - Configuración de aditivos
- `plant_diesel_config` - Configuración de tanque diesel
- `plant_products_config` - Configuración de otros productos
- `plant_utilities_meters_config` - Configuración de medidores
- `plant_petty_cash_config` - Configuración de petty cash

### Tablas Mensuales

- `inventory_month` - Encabezado de inventario mensual (status: IN_PROGRESS → SUBMITTED → APPROVED)
- `inventory_aggregates_entries` - Lecturas de agregados
- `inventory_silos_entries` - Lecturas de silos
- `inventory_additives_entries` - Lecturas de aditivos
- `inventory_diesel_entries` - Lectura de diesel
- `inventory_products_entries` - Lecturas de otros productos
- `inventory_utilities_entries` - Lecturas de medidores
- `inventory_petty_cash_entries` - Registro de petty cash

## 🔄 Flujo de Trabajo

1. **Configuración Inicial** (una vez):
   - Ejecutar schema SQL
   - Cargar configuraciones de plantas

2. **Uso Mensual**:
   - El gerente de planta inicia un nuevo inventario
   - El sistema crea automáticamente un registro `inventory_month` con status "IN_PROGRESS"
   - El gerente ingresa lecturas en cada sección
   - Las lecturas se guardan en las tablas `inventory_*_entries`
   - Al terminar, envía el inventario (status → "SUBMITTED")
   - Un admin/super_admin revisa y aprueba (status → "APPROVED")

## 🛠️ API Endpoints

El backend expone los siguientes endpoints:

### Configuración
- `POST /make-server-02205af0/db/initialize` - Verifica que existan todas las tablas
- `POST /make-server-02205af0/db/seed` - Carga configuraciones de plantas
- `GET /make-server-02205af0/plants/:plantId/config` - Obtiene configuración completa de una planta

### Inventarios Mensuales
- `POST /make-server-02205af0/inventory/month` - Crea o obtiene inventario del mes
- `GET /make-server-02205af0/inventory/month/:id` - Obtiene datos completos del inventario
- `PUT /make-server-02205af0/inventory/month/:id/status` - Actualiza status (submit/approve)

### Guardar Secciones
- `POST /make-server-02205af0/inventory/aggregates` - Guarda lecturas de agregados
- `POST /make-server-02205af0/inventory/silos` - Guarda lecturas de silos
- `POST /make-server-02205af0/inventory/additives` - Guarda lecturas de aditivos
- `POST /make-server-02205af0/inventory/diesel` - Guarda lectura de diesel
- `POST /make-server-02205af0/inventory/products` - Guarda lecturas de productos
- `POST /make-server-02205af0/inventory/utilities` - Guarda lecturas de medidores
- `POST /make-server-02205af0/inventory/petty-cash` - Guarda registro de petty cash

## 🔒 Permisos y Seguridad

- **Gerente de Planta**: Puede crear y enviar inventarios de sus plantas asignadas
- **Admin**: Puede revisar y aprobar inventarios de sus plantas asignadas
- **Super Admin**: Acceso completo a todas las plantas + configuración del sistema

## ⚠️ Notas Importantes

1. **No modifiques directamente las tablas de configuración** - Usa la interfaz de administración
2. **Los inventarios aprobados no deberían modificarse** - Implementa auditoría si necesario
3. **Las curvas de calibración son reusables** - Se comparten entre plantas similares
4. **Backup regular** - Configura backups automáticos en Supabase

## 🐛 Troubleshooting

### Error: "Missing tables"
- Solución: Ejecuta el SQL schema en Supabase Dashboard

### Error: "No data after seed"
- Solución: Verifica que las tablas existan antes de ejecutar seed
- Revisa los logs del servidor para ver errores específicos

### Error: "Cannot read property 'id'"
- Solución: Verifica que los foreign keys estén correctamente configurados
- Asegúrate de que las curvas de calibración se crearon antes de los tanques

## 📞 Soporte

Para problemas o preguntas, contacta al equipo de desarrollo de PROMIX.
