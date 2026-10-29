# GYM

Landing pública y panel de gestión para múltiples gimnasios. React, TypeScript, Vite y Supabase.

## Ejecutar

1. Instalar Node.js 24 o superior y ejecutar `npm install`.
2. Copiar `.env.example` a `.env.local` y completar la URL y clave pública del proyecto.
3. Ejecutar `npm run dev`.

La landing abre en `/`; `/#login` muestra acceso y `/#panel` el espacio autorizado de la cuenta. El propietario puede seleccionar sus gimnasios y administrar colaboradores.

## Comprobar

- `npm run build`: TypeScript y compilación de producción.
- `npm run lint`: revisión estática.
- `npm test`: importes POS, exportación CSV y vencimientos.
- `supabase/tests/security.sql`: comprobaciones transaccionales de permisos, aislamiento, ventas e inventario. Ejecutar únicamente contra la base autorizada, revisando primero el archivo; todos los datos ficticios se revierten con ROLLBACK.

## Datos y acceso

Única base: Supabase **GYM**, `cjmffrhnlsypasnijuhm`. Cambios SQL en `supabase/migrations`. No crear bases paralelas.

La cuenta administradora inicial fue creada por solicitud del propietario. Su acceso generado está únicamente en `.admin-access.local`, excluido de Git. Es necesario confirmar el correo para ingresar. No publicar ese archivo.

El módulo Equipo guarda invitaciones por correo y rol. La función `invite-staff` valida el token del usuario y comprueba que sea propietario antes de enviar el correo. Las invitaciones duran siete días y se aceptan al ingresar con el correo confirmado.

Antes de usar enlaces de invitación o recuperación, configurar en Supabase Auth las URLs de redirección locales y la URL de producción. Para local: `http://127.0.0.1:5173/**` y `http://localhost:5173/**`; establecer Site URL al origen usado. Verificar la entrega del correo y configurar SMTP para uso real.

Producción: `https://gymtuchin.vercel.app`. En Supabase Auth, Site URL debe ser ese origen; Redirect URLs debe incluir `https://gymtuchin.vercel.app/**`. El código de registro y reenvío usa el origen de la página actual. Los correos generados antes de cambiar la configuración conservan el destino anterior; pedir uno nuevo desde Reenviar correo de confirmación en el login.

## Estado

Landing con fotografías de referencia y precios iniciales; panel POS, clientes, membresías, productos, máquinas, historial, finanzas y equipo. Recordatorios automáticos: cola SQL preparada, worker y programación pendientes. Sin despliegue público de la aplicación.

Contexto y límites: [docs/CONTEXTO.md](docs/CONTEXTO.md). Diseño: [docs/DISENO.md](docs/DISENO.md). Requisitos: [docs/PRD.md](docs/PRD.md).
