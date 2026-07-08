# Capa semántica de PROMIX Inventario

## 1. Propósito y alcance

Este documento describe el significado funcional y técnico de los datos de PROMIX Inventario. Su foco es explicar:

- qué representa cada entidad;
- cómo se determina la configuración efectiva de una planta;
- cómo fluye un inventario mensual;
- qué captura el usuario y qué calcula el sistema;
- cuáles son las unidades, fórmulas, validaciones y reglas de arrastre;
- qué cálculos son recalculados por el servidor y cuáles dependen del cliente;
- cómo se relacionan los módulos con las tablas y endpoints.

La descripción refleja el código del repositorio al 8 de julio de 2026. La configuración productiva concreta de cada planta reside en Supabase y puede cambiar sin modificar el código.

## 2. Modelo conceptual

La unidad de trabajo principal es el **inventario mensual de una planta**:

```text
Planta + año-mes
  └── inventory_month
       ├── agregados
       ├── silos
       ├── aditivos
       ├── diésel
       ├── aceites y productos
       ├── utilidades
       └── petty cash
```

Cada sección se construye a partir de dos capas:

1. **Configuración maestra por planta:** define los equipos, materiales, productos, métodos, unidades, curvas y requisitos de evidencia.
2. **Captura mensual:** conserva las lecturas, cantidades, resultados calculados, fotografías y notas de un periodo.

El inventario mensual evita que una captura de una planta se mezcle con otra mediante `inventory_month_id` y validación de autorización en `make-server`.

## 3. Glosario semántico

| Término | Significado |
|---|---|
| Planta | Centro operativo al que pertenecen configuración e inventario. |
| Año-mes | Periodo de inventario en formato `YYYY-MM`. |
| Configuración | Registro maestro que determina qué debe capturarse en una planta. |
| Entrada | Registro mensual correspondiente a un elemento configurado. |
| Unidad de captura | Unidad en la que el usuario toma la medida física. |
| Unidad de cálculo | Unidad en la que se ejecuta la regla matemática. |
| Unidad de visualización | Unidad mostrada en la interfaz. |
| Unidad de inventario | Unidad canónica usada para reportar o consolidar existencia. |
| Curva de calibración | Tabla de pares lectura-resultado que convierte una lectura física en volumen o cantidad. |
| Factor por material | Multiplicador para cruzar categorías físicas, por ejemplo volumen a masa. |
| Arrastre | Uso del resultado del mes anterior como valor inicial o lectura anterior. |
| Evidencia | Fotografía requerida por la configuración o por la regla del módulo. |
| Cálculo autoritativo | Resultado que el servidor vuelve a calcular antes de persistir. |

## 4. Fuentes de verdad y precedencia

### 4.1 Configuración de planta

La configuración retornada por `GET /make-server/plants/:plantId/config` es la fuente efectiva para:

- agregados y cajones;
- silos;
- aditivos;
- tanque de diésel;
- aceites y productos;
- medidores de utilidades;
- Petty Cash;
- catálogo de unidades;
- configuraciones contextuales de medición;
- curvas de calibración;
- factores de conversión por material.

`utilitiesConfig.ts` y `pettyCashConfig.ts` contienen datos locales para CAROLINA, CEIBA, GUAYNABO, GURABO, VEGA BAJA y HUMACAO, pero funcionan como **fallback legado**. No deben interpretarse como el catálogo productivo completo ni como la fuente primaria.

### 4.2 Configuración contextual de unidades

Una `measurement_config` puede estar acotada por:

- `plant_id`;
- `section_code`;
- `inventory_type_id`;
- `material_id`;
- `equipment_id`.

La selección usa la coincidencia activa con mayor especificidad. La ponderación actual es:

| Coincidencia | Puntaje |
|---|---:|
| Planta | 16 |
| Sección | 8 |
| Material | 4 |
| Equipo | 4 |
| Tipo de inventario | 2 |

El flujo de cantidades es:

```text
captura -> cálculo -> visualización
                   └-> inventario
```

Reglas:

- Si origen y destino pertenecen a la misma categoría física, se usa conversión estándar.
- Si captura y cálculo cruzan categorías, se requiere curva de calibración.
- Si cálculo e inventario cruzan categorías, se requiere factor por material.
- No se permite usar un factor de material como sustituto de una conversión estándar dentro de la misma categoría.

### 4.3 Conversiones estándar

Cada unidad posee `factor_to_base`. La conversión general implementada es:

```text
valor_base = valor_origen × factor_origen
valor_destino = valor_base / factor_destino
```

Solo se convierten directamente unidades de la misma `category_id`. El modelo actual no aplica desplazamientos, por lo que está orientado a unidades con relación puramente multiplicativa.

### 4.4 Factor por material

Cuando se cruza de una categoría a otra en la dirección configurada:

```text
valor_destino = valor_origen × factor
```

En la dirección inversa:

```text
valor_destino = valor_origen / factor
```

El par de unidades debe coincidir con `from_unit_id` y `to_unit_id` en alguna de las dos direcciones.

## 5. Curvas de calibración

Una curva representa pares ordenados:

```text
(lectura_1, salida_1), (lectura_2, salida_2), ...
```

Para una lectura `x` comprendida entre dos puntos:

```text
proporción = (x - x1) / (x2 - x1)
resultado = y1 + (y2 - y1) × proporción
```

Comportamiento de bordes:

- lectura menor o igual al primer punto: devuelve la salida del primer punto;
- lectura mayor o igual al último punto: devuelve la salida del último punto;
- lectura exactamente igual a un punto: devuelve su salida;
- tabla vacía o lectura no numérica: el helper genérico devuelve `0`, aunque los endpoints autoritativos rechazan los tanques sin puntos;
- el servidor redondea a dos decimales.

La interpolación es lineal por tramos y **no extrapola** fuera del rango.

## 6. Ciclo de vida mensual

### 6.1 Creación y precarga

Al entrar a una planta y periodo:

1. se carga la configuración de planta;
2. se busca el `inventory_month`;
3. se consulta el mes inmediatamente anterior;
4. si el periodo no existe, se crea con estado `IN_PROGRESS`;
5. se generan entradas vacías desde la configuración;
6. se aplican valores de arrastre cuando existe el mes anterior.

Si un inventario ya existe, sus entradas guardadas prevalecen. Las entradas faltantes pueden regenerarse desde la configuración actual.

### 6.2 Arrastre entre meses

| Módulo | Regla de arrastre |
|---|---|
| Silos | `previous_reading` toma la lectura del silo equivalente del mes anterior. |
| Agregados | `previous_reading` intenta tomar `current_reading`; no participa en el cálculo geométrico actual. |
| Aditivos | `previous_reading` toma la lectura del mismo aditivo del mes anterior. |
| Diésel | `beginning_inventory` = `ending_inventory` del mes anterior. |
| Productos | el campo legado `beginning` toma `ending` del mes anterior; no interviene en las fórmulas actuales de captura. |
| Utilidades | `previous_reading` = `current_reading` del mismo medidor del mes anterior. |
| Petty Cash | `beginning_balance` y `ending_balance` se inicializan con el `ending_balance` anterior. |

La equivalencia se resuelve principalmente por identificador de configuración; en productos existe respaldo por nombre.

### 6.3 Estados

El inventario mensual usa estados de trabajo como:

- `IN_PROGRESS`: captura activa;
- `SUBMITTED`: enviado para revisión;
- `APPROVED`: aprobado;
- `REJECTED`: rechazado o devuelto, cuando aplica al flujo.

La pantalla de revisión consolida las secciones, permite envío y aprobación según rol y registra auditoría. Los inventarios aprobados deben considerarse históricos controlados.

## 7. Módulo de Agregados

### 7.1 Significado

Representa volumen físico de arena, piedra, gravilla u otro agregado almacenado en un cajón o una pila aproximada como cono.

Configuración principal: `plant_aggregates_config` y `plant_cajones_config`.

Captura mensual: `inventory_aggregates_entries`.

Endpoint: `POST /make-server/inventory/aggregates`.

### 7.2 Métodos

#### Cajón (`BOX`)

Entradas:

- ancho configurado, de solo lectura;
- alto capturado;
- largo capturado;
- unidad lineal de captura;
- fotografía.

Fórmula geométrica:

```text
V_crudo = ancho × alto × largo
```

El volumen crudo está en la unidad cúbica correspondiente a la unidad lineal. Luego:

```text
V_cálculo = conversión_estándar(V_crudo, unidad_cúbica_cruda, unidad_cálculo)
V_mostrado = conversión_estándar(V_cálculo, unidad_cálculo, unidad_visualización)
```

#### Cono (`CONE`)

Entradas:

- seis medidas inclinadas `M1...M6`;
- dos diámetros `D1` y `D2`;
- fotografía.

Fórmulas:

```text
M_promedio = (M1 + M2 + M3 + M4 + M5 + M6) / 6
radio = (D1 + D2) / 4
altura² = M_promedio² - radio²
altura = √altura²
V_crudo = π × radio² × altura / 3
```

Si `altura² <= 0`, el resultado es `0`. Después se aplica el mismo flujo de conversión a cálculo y visualización.

### 7.3 Cantidad de inventario

Si la unidad de inventario difiere de la de cálculo:

- misma categoría: conversión estándar;
- categoría distinta: factor por material.

Ejemplo conceptual:

```text
masa_inventario = volumen_cálculo × densidad_configurada
```

La densidad no está codificada como constante universal: debe existir como `material_conversion_factor`.

### 7.4 Completitud

Una entrada está completa cuando:

- tiene fotografía;
- `BOX`: tiene alto y largo; el ancho proviene de configuración;
- `CONE`: tiene las ocho medidas.

El valor cero es numéricamente posible, aunque una geometría inválida de cono también produce cero.

### 7.5 Autoridad del cálculo

**Cliente:** calcula geometría y conversiones.

**Servidor:** actualmente persiste `calculated_volume_cy` recibido; no recalcula la geometría. Por tanto, para integraciones externas el payload calculado no debe considerarse confiable sin validación adicional.

## 8. Módulo de Silos

### 8.1 Significado

Representa existencia de cemento u otro material ensilado, derivada de una lectura física del nivel y una curva específica del silo.

Configuración: `plant_silos_config`, `silo_allowed_products`, `calibration_curves` y `calibration_curve_points`.

Captura: `inventory_silos_entries`.

Endpoint: `POST /make-server/inventory/silos`.

### 8.2 Cálculo principal

```text
sacos_disponibles = interpolar(lectura, tabla_conversión_silo)
```

La interfaz deriva además métricas de cemento:

```text
libras = sacos_disponibles × 94
toneladas_métricas = libras / 2204.62262185
porcentaje_volumen = sacos_disponibles / capacidad_máxima_curva × 100
```

La capacidad máxima se obtiene como el mayor valor de salida de la tabla de conversión.

Las constantes de 94 lb por saco y 2204.62262185 lb por tonelada métrica son reglas de presentación actuales; el valor persistido principal continúa siendo la salida de la curva.

### 8.3 Completitud

Se requiere:

- lectura;
- tabla de calibración válida;
- fotografía.

### 8.4 Autoridad del cálculo

El servidor exige la tabla y recalcula `calculated_result_cy` y `calculated_volume` mediante interpolación. El resultado enviado por el cliente no es autoritativo.

## 9. Módulo de Aditivos

### 9.1 Significado

Representa aditivos químicos almacenados en tanque o contabilizados manualmente.

Configuración: `additives_catalog` y `plant_additives_config`.

Captura: `inventory_additives_entries`.

Endpoint: `POST /make-server/inventory/additives`.

### 9.2 Métodos de medición

Los identificadores legados `TANK`, `TANK_LEVEL` y `CALIBRATION_CURVE` significan
`CURVE`. `MANUAL_QUANTITY` significa `MANUAL`.

#### Curva (`CURVE`, legado `TANK`)

Entrada principal: lectura física del tanque.

```text
volumen_disponible = interpolar(lectura, tabla_conversión)
```

La curva normalizada puede tener métricas adicionales por punto:

- volumen disponible;
- volumen consumido;
- porcentaje de volumen;
- estado operativo.

La interfaz interpola linealmente las métricas numéricas opcionales. El estado se toma del punto o intervalo aplicable y funciona como indicador visual; el servidor persiste como cantidad principal únicamente el volumen disponible calculado desde `conversion_table`.

#### Cilindro vertical (`CYLINDER_VERTICAL`)

Entrada: altura del líquido medida desde el fondo.

```text
volumen_crudo = π × (diámetro / 2)² × altura_líquido
volumen = min(convertir(volumen_crudo), capacidad_nominal)
porcentaje = volumen / capacidad_nominal × 100
```

#### IBC rectangular (`RECTANGULAR_IBC`)

```text
volumen_crudo = largo × ancho × altura_líquido
volumen = min(convertir(volumen_crudo), capacidad_nominal)
porcentaje = volumen / capacidad_nominal × 100
```

Las dimensiones provienen de configuración. Ambos métodos exigen altura entre cero
y altura total, no usan curvas y reutilizan las unidades contextuales.

### 9.3 Aditivo manual (`MANUAL`)

```text
cantidad_inventario = cantidad_capturada
```

No existe interpolación. Un cero explícito significa existencia cero y es distinto de un campo sin diligenciar.

### 9.4 Completitud

- Todos los tanques deben tener lectura.
- Un tanque debe tener fotografía cuando `requires_photo` está activo.
- Todos los productos manuales deben tener cantidad, incluyendo cero.

### 9.5 Autoridad del cálculo

- `CURVE`: el servidor exige la curva guardada en configuración y recalcula volumen.
- Métodos geométricos: el servidor carga dimensiones, capacidad y unidades desde
  configuración, recalcula volumen, porcentaje, volumen visible y cantidad de inventario.
- `MANUAL`: el servidor conserva la cantidad recibida.

El servidor nunca confía en curvas, dimensiones, capacidad ni resultados enviados
por el cliente. Cada entrada conserva un snapshot de la configuración efectiva.

## 10. Módulo de Diésel

### 10.1 Significado

Modela el balance mensual del tanque de combustible: existencia inicial, compras, existencia final medida y consumo inferido.

Configuración: `plant_diesel_config`.

Captura: `inventory_diesel_entries`.

Endpoint: `POST /make-server/inventory/diesel`.

### 10.2 Fórmulas

```text
existencia_final = interpolar(lectura_tanque, tabla_calibración)
consumo = existencia_inicial + compras - existencia_final
```

Donde:

- `beginning_inventory`: existencia final del mes anterior o inventario inicial configurado;
- `purchases_gallons`: compras del periodo;
- `ending_inventory`: galones calculados desde la lectura;
- `consumption_gallons`: salida inferida por balance.

El consumo puede ser negativo si la ecuación produce ese resultado. El servidor no lo fuerza a cero; un negativo puede revelar compras omitidas, una lectura incorrecta o un problema de continuidad.

### 10.3 Completitud

Se requiere:

- lectura del tanque;
- compras, aceptando cero explícito;
- tabla de calibración;
- fotografía.

### 10.4 Autoridad del cálculo

El servidor recalcula tanto existencia final como consumo y redondea a dos decimales.

## 11. Módulo de Aceites y Productos

### 11.1 Significado

Representa aceites, lubricantes, consumibles y otros productos mediante uno de cuatro modos de medición.

Configuración: `plant_products_config`.

Captura: `inventory_products_entries`.

Endpoint: `POST /make-server/inventory/products`.

### 11.2 Modos y fórmulas

#### Tanque (`TANK_READING`)

```text
cantidad_calculada = interpolar(lectura, tabla_calibración)
cantidad = cantidad_calculada
```

#### Tambor (`DRUM`)

```text
volumen_total = cantidad_tambores × volumen_unitario
cantidad = cantidad_tambores
```

#### Paila (`PAIL`)

```text
volumen_total = cantidad_pailas × volumen_unitario
cantidad = cantidad_pailas
```

#### Conteo (`COUNT`)

```text
cantidad = cantidad_capturada
```

En `DRUM` y `PAIL`, `quantity` significa número de envases, mientras `total_volume` significa volumen físico. No son métricas intercambiables.

### 11.3 Completitud

El campo requerido depende del modo:

- `TANK_READING`: lectura;
- `DRUM` y `PAIL`: cantidad de envases;
- `COUNT`: cantidad directa;
- fotografía solamente cuando `requires_photo` está activo.

Un cero explícito es una captura válida.

### 11.4 Autoridad del cálculo

- `TANK_READING`: el servidor exige curva y recalcula `calculated_quantity` y `quantity`.
- `DRUM`, `PAIL` y `COUNT`: el servidor conserva `total_volume` y `quantity` recibidos. La multiplicación de envases se realiza en el cliente.

## 12. Módulo de Utilidades

### 12.1 Significado

Representa consumo entre lecturas acumulativas de medidores de agua, electricidad, gas u otros servicios.

Configuración primaria: `plant_utilities_meters_config`.

Captura: `inventory_utilities_entries`.

Endpoint: `POST /make-server/inventory/utilities`.

### 12.2 Fórmula

```text
consumo_crudo = lectura_actual - lectura_anterior
consumo = máximo(0, consumo_crudo)
```

La lectura anterior proviene:

1. de la lectura actual del mismo medidor en el mes anterior; o
2. de `initial_reading` cuando no existe historia.

La identidad del medidor se resuelve mediante su identificador de configuración, con normalización para registros legados.

La regla `máximo(0, ...)` impide consumos negativos. Esto también oculta reinicios o vueltas de contador; esos casos deben documentarse en notas o modelarse con una regla futura.

### 12.3 Completitud

Cada medidor debe tener:

- lectura actual;
- fotografía cuando su configuración la requiera.

### 12.4 Autoridad del cálculo

El consumo se calcula en el cliente. El servidor actualmente conserva `previous_reading`, `current_reading` y `consumption` recibidos sin recalcular la resta.

## 13. Módulo de Petty Cash

### 13.1 Significado

Compara el fondo establecido de la planta con la suma de recibos y efectivo disponible.

Configuración primaria: `plant_petty_cash_config` y, para compatibilidad, el valor asociado a la planta.

Captura: `inventory_petty_cash_entries`.

Endpoint: `POST /make-server/inventory/petty-cash`.

### 13.2 Precedencia del monto establecido

El monto se resuelve en este orden:

1. `monthly_amount` de configuración;
2. `initial_amount`;
3. `established_amount`;
4. valor de Petty Cash asociado a la planta;
5. configuración local legada;
6. cero.

### 13.3 Fórmulas

```text
total = recibos + efectivo
diferencia = monto_establecido - total
```

Interpretación:

| Condición | Estado |
|---|---|
| `diferencia = 0` | Correcto |
| `diferencia > 0` | Faltante |
| `diferencia < 0` | Sobrante |

### 13.4 Completitud

Se requiere:

- recibos mayores o iguales a cero;
- efectivo mayor o igual a cero;
- fotografía.

### 13.5 Autoridad del cálculo

La interfaz recalcula total y diferencia. El servidor actualmente persiste los valores recibidos; no vuelve a ejecutar las fórmulas.

## 14. Revisión, aprobación y auditoría

Este módulo no añade una cantidad física; gobierna el estado del inventario.

Responsabilidades semánticas:

- presentar el resumen de todas las secciones;
- distinguir entradas completas y pendientes;
- enviar el inventario a aprobación;
- aprobar o rechazar según permisos;
- conservar quién creó, envió, aprobó o modificó;
- registrar eventos de guardado de sección y cambios de estado.

Cada endpoint de guardado:

- autentica al usuario;
- comprueba acceso al inventario mensual;
- rechaza identificadores de mes inconsistentes dentro del payload;
- reemplaza atómicamente las filas de la sección;
- registra `SECTION_SAVED` en auditoría.

El reemplazo atómico significa que el conjunto enviado pasa a ser la fotografía completa de esa sección, no un parche parcial.

## 15. Reportes y fotografías

Los reportes consultan inventarios históricos y exportan las cantidades persistidas. Por ello heredan:

- las unidades guardadas en cada entrada;
- los resultados de curvas y cálculos del momento de captura;
- la configuración que fue copiada a la entrada;
- posibles inconsistencias de módulos cuyo cálculo no se revalida en servidor.

Las fotografías son evidencia asociada a entradas y se almacenan en el bucket `inventory-photos`; la base conserva su URL pública. El reporte fotográfico permite consolidarlas por planta, periodo y sección.

## 16. Mapa técnico por módulo

| Módulo | Configuración | Entrada mensual | Cálculo principal | Servidor recalcula |
|---|---|---|---|---|
| Agregados | `plant_aggregates_config`, `plant_cajones_config` | `inventory_aggregates_entries` | geometría de caja o cono | No |
| Silos | `plant_silos_config`, curvas | `inventory_silos_entries` | lectura -> existencia | Sí |
| Aditivos | `plant_additives_config`, catálogo, curvas | `inventory_additives_entries` | tanque por curva o cantidad manual | Solo tanque |
| Diésel | `plant_diesel_config`, curva | `inventory_diesel_entries` | inicial + compras - final | Sí |
| Productos | `plant_products_config`, curvas | `inventory_products_entries` | curva, conteo o envases × volumen | Solo tanque |
| Utilidades | `plant_utilities_meters_config` | `inventory_utilities_entries` | actual - anterior, mínimo cero | No |
| Petty Cash | `plant_petty_cash_config` | `inventory_petty_cash_entries` | recibos + efectivo y diferencia | No |

## 17. Reglas transversales de calidad

### 17.1 Cero frente a ausencia

En campos operativos, `0` suele ser un valor válido y distinto de `null`, `undefined` o cadena vacía. Esto es especialmente importante para:

- compras de diésel;
- aditivos manuales;
- conteos de productos;
- recibos y efectivo;
- lecturas o cantidades sin existencia.

### 17.2 Redondeo

La interpolación del backend redondea a dos decimales. Algunas métricas visuales también se redondean, pero los cálculos geométricos del cliente pueden conservar mayor precisión antes del formateo.

### 17.3 Fotografías

La obligatoriedad no es uniforme:

- siempre requerida por las reglas actuales de agregados, silos, diésel y Petty Cash;
- condicional por configuración en aditivos, productos y utilidades.

### 17.4 Configuración histórica

Las entradas mensuales copian nombres, unidades y tablas de conversión. Esto favorece reproducibilidad histórica, pero obliga a distinguir entre:

- configuración actual de la planta;
- configuración y curva efectivamente guardadas con el periodo.

Un cambio futuro de catálogo no debe reinterpretar silenciosamente un inventario aprobado.

## 18. Riesgos y deuda semántica identificada

1. **Cálculos no autoritativos en todos los módulos.** Agregados, utilidades y Petty Cash aceptan resultados derivados del cliente. `DRUM` y `PAIL` también aceptan el volumen total enviado.
2. **Nombres de campos legados.** `calculated_volume_cy` puede contener una unidad de visualización distinta de yardas cúbicas; el nombre ya no expresa siempre la unidad real.
3. **Métricas de silos específicas de cemento.** La conversión a libras y toneladas supone sacos de 94 lb, aunque el silo pueda admitir otros productos.
4. **Consumo negativo de utilidades oculto.** El `max(0, diferencia)` evita negativos, pero no distingue reinicio, reemplazo o rollover de medidor.
5. **Geometría inválida de cono.** Una medición incompatible produce cero y no un error semántico explícito.
6. **Campos de arrastre sin uso actual.** Algunos valores `previous_reading`, `beginning` y `ending` se mantienen por compatibilidad pero no participan en los cálculos visibles.
7. **Duplicidad de fallback local.** Las configuraciones locales de utilidades y Petty Cash pueden divergir de Supabase.
8. **Semántica dual de `quantity`.** En productos envasados representa número de unidades, mientras el volumen vive en `total_volume`.

## 19. Recomendaciones para evolucionar la capa semántica

1. Recalcular en `make-server` todas las métricas derivadas antes de persistir.
2. Guardar explícitamente `capture_unit_id`, `calculation_unit_id`, `display_unit_id` e `inventory_unit_id` con cada entrada histórica.
3. Sustituir nombres ligados a una unidad, como `calculated_volume_cy`, por nombres neutrales acompañados de unidad.
4. Versionar curvas, factores y configuraciones, y guardar la versión aplicada.
5. Validar dominios físicos: dimensiones no negativas, cono geométricamente posible, lectura dentro de rango y capacidad máxima.
6. Modelar rollover o reemplazo de medidor en utilidades.
7. Definir métricas consolidadas canónicas por módulo para reportes y evitar sumar cantidades de unidades incompatibles.
8. Añadir pruebas compartidas cliente-servidor para cada fórmula y caso límite.

## 20. Referencias de implementación

- `src/app/contexts/PlantPrefillContext.tsx`: creación de entradas, carga mensual y arrastre.
- `src/app/utils/unitConversion.ts`: resolución contextual y conversiones.
- `src/app/utils/calibration.ts`: interpolación usada por la interfaz.
- `src/app/pages/sections/*Section.tsx`: captura, fórmulas visuales y completitud.
- `src/app/config/utilitiesConfig.ts`: regla de consumo y fallback legado.
- `src/app/config/pettyCashConfig.ts`: fórmulas y estados de caja.
- `supabase/functions/make-server/index.ts`: autorización, recálculo autoritativo y endpoints.
- `supabase/functions/make-server/database.tsx`: acceso a configuración, importación y persistencia.
- `supabase/migrations/20260623120000_add_contextual_units.sql`: modelo de unidades y medición contextual.
- `supabase/schema_complete.sql`: esquema relacional de configuración e inventarios.
