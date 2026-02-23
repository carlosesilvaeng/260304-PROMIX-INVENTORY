#!/bin/bash

# ============================================================================
# PROMIX PLANT INVENTORY - Edge Function Deploy Script
# ============================================================================
# Este script descarga la carpeta de Edge Functions y la despliega a Supabase

set -e

echo "🚀 PROMIX Edge Function Deployment"
echo "===================================="
echo ""

# Verificar que Supabase CLI está instalado
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI no está instalado"
    echo ""
    echo "Instalar con:"
    echo "  macOS: brew install supabase/tap/supabase"
    echo "  Windows: scoop install supabase"
    echo ""
    exit 1
fi

echo "✅ Supabase CLI encontrado"

# Verificar que estamos en el directorio correcto
if [ ! -d "supabase/functions/make-server-02205af0" ]; then
    echo "❌ Error: No se encuentra el directorio supabase/functions/make-server-02205af0"
    echo "   Por favor ejecuta este script desde la raíz del proyecto"
    exit 1
fi

echo "✅ Directorio de funciones encontrado"
echo ""

# Verificar que Docker NO es necesario (ignorar el warning)
echo "ℹ️  Docker no es necesario para este deployment"
echo ""

# Desplegar la función
echo "📤 Desplegando make-server-02205af0..."
echo ""

supabase functions deploy make-server-02205af0 --project-ref olieryxyhakumgyohlrr

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ ¡Deployment exitoso!"
    echo ""
    echo "🔗 Función disponible en:"
    echo "   https://olieryxyhakumgyohlrr.supabase.co/functions/v1/make-server-02205af0"
    echo ""
    echo "📋 Próximos pasos:"
    echo "   1. Verifica que la función responde: /make-server-02205af0/health"
    echo "   2. Prueba el login en tu aplicación"
    echo ""
else
    echo ""
    echo "❌ Error en el deployment"
    echo ""
    echo "💡 Soluciones:"
    echo "   1. Verifica que estés autenticado: supabase login"
    echo "   2. Verifica el Project ID: olieryxyhakumgyohlrr"
    echo "   3. Intenta con: supabase functions deploy make-server-02205af0 --debug"
    echo ""
    exit 1
fi
