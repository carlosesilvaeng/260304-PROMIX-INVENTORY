# Guia Rapida: Deploy de make-server

## Cuando usarla

Usa esta guia cada vez que publiques la Edge Function `make-server`.

## Paso 1

Ejecuta:

```bash
npm run deploy:make-server
```

## Paso 2

Verifica el estado:

```bash
npm run check:make-server
```

## Paso 3

Confirma que en la salida aparezca:

```json
"verify_jwt": false
```

## Si sale `true`

No continúes. Vuelve a publicar con:

```bash
supabase functions deploy make-server --project-ref jnlsahsxqiufusfamccz --no-verify-jwt
```

## Señales de que quedó mal publicado

- Configuración de Plantas no carga
- Usuarios no carga
- Auditoría no carga
- Respuestas `401` o `Invalid JWT`

## Nota importante

`login` puede parecer que funciona aunque el deploy esté mal. El problema se nota sobre todo en endpoints protegidos como plantas, usuarios y auditoría.
