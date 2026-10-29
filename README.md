# GYM

Landing pública y panel de gestión para múltiples gimnasios. React, TypeScript, Vite y Supabase.

## Ejecutar

1. Instalar Node.js 24 o superior y ejecutar `npm install`.
2. Copiar `.env.example` a `.env.local` y completar la URL y clave pública del proyecto.
3. Ejecutar `npm run dev`.

La landing abre en `/`; `/#login` muestra acceso y `/#panel` el espacio autorizado de la cuenta. José ve la superadministración; los encargados y operarios ven los gimnasios asignados.

## Comprobar

- `npm run build`: TypeScript y compilación de producción.
- `npm run lint`: revisión estática.
- `npm test`: nueve pruebas de importes POS, CSV, recuperación y límites de acceso de pruebas.
- `supabase/tests/security.sql`: comprobaciones de solo lectura de plataforma, RLS y privilegios mínimos. No crea datos de prueba.

## Datos y acceso

Única base: Supabase **GYM**, `cjmffrhnlsypasnijuhm`. Cambios SQL en `supabase/migrations`. No crear bases paralelas.

La cuenta administradora inicial fue creada por solicitud del propietario. Su acceso generado está únicamente en `.admin-access.local`, excluido de Git. Es necesario confirmar el correo para ingresar. No publicar ese archivo.

José crea gimnasios e invita encargados desde Superadministración. La prueba de siete días empieza al aceptar la invitación y bloquea todo el panel al vencer. José puede activar, suspender o conceder otros siete días. Los datos se conservan.

El módulo Equipo permite al encargado invitar operarios, inventario e instructores. La función `invite-staff` valida el token, el permiso y la vigencia. Las invitaciones duran siete días y se aceptan al ingresar con el correo confirmado. Las tarifas y los días de membresía se configuran en cada gimnasio.

Antes de usar enlaces de invitación o recuperación, configurar en Supabase Auth las URLs de redirección locales y la URL de producción. Para local: `http://127.0.0.1:5173/**` y `http://localhost:5173/**`; establecer Site URL al origen usado. Verificar la entrega del correo y configurar SMTP para uso real.

Producción: `https://gymtuchin.vercel.app`. En Supabase Auth, Site URL debe ser ese origen; Redirect URLs debe incluir `https://gymtuchin.vercel.app/**`. El código de registro y reenvío usa el origen de la página actual. Los correos generados antes de cambiar la configuración conservan el destino anterior; pedir uno nuevo desde Reenviar correo de confirmación en el login.

## Estado

Frontend publicado por el usuario en https://gymtuchin.vercel.app. Plataforma y panel operativo implementados; falta verificar la entrega y aceptación de una invitación real de encargado. Recordatorios automáticos: cola SQL preparada, worker y programación pendientes.

Contexto y límites: [docs/CONTEXTO.md](docs/CONTEXTO.md). Diseño: [docs/DISENO.md](docs/DISENO.md). Requisitos: [docs/PRD.md](docs/PRD.md).
