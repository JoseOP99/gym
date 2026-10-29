# Verificación

## Comprobado

- npm run build: TypeScript y compilación correctos. El panel se carga por separado de la landing.
- npm run lint: sin errores ni advertencias.
- npm test: nueve pruebas de importes POS, CSV, vencimientos, captura de recuperación, enlaces inválidos y límites de siete días.
- SQL de solo lectura: la cuenta autorizada de José tiene superadministración; una cuenta no asignada no tiene ese rol ni ve gimnasios; authenticated no tiene alta directa de gimnasios.
- Migraciones aplicadas: roles globales privados, pruebas, invitaciones de encargado, guardas de archivado y vigencia configurable de membresías.
- Función invite-staff desplegada: valida identidad y permiso de plataforma/encargado, tipo de invitación y vigencia.
- Revisión previa en navegador: landing, imágenes, navegación de login y anchura móvil sin desbordamiento.
- Superadministración revisada visualmente en escritorio y móvil mediante render estático con datos ficticios fuera de la base. Formulario sin desbordamiento horizontal. Esta revisión no envió invitaciones ni probó las acciones de las tarjetas.

## Límites y pendiente

- No se crearon gimnasios/clientes ficticios en la base real para probar esta versión.
- Las pruebas SQL con fixtures se retiraron después del bloqueo de la revisión automática. La suite actual en supabase/tests/security.sql es de solo lectura.
- Falta completar el primer recorrido real de crear un gimnasio, entregar la invitación, establecer contraseña, aceptar como encargado e invitar a un operario.
- Las pruebas de vencimiento son de lógica y lectura de permisos/configuración. No se cambió la fecha de un gimnasio real para ensayar su bloqueo.
- Confirmar en el dashboard las URLs de redirección de Auth; comprobar SMTP propio antes de ofrecer el servicio a terceros.
- El flujo completo de recuperación exige que el usuario abra su correo y establezca su contraseña; no se cambia una contraseña real para verificar.
- Recordatorios automáticos: cola SQL preparada; envío y programación pendientes.

Los avisos Supabase sobre protección de contraseñas filtradas y la cola privada están descritos en CONTEXTO. La revisión no es una auditoría completa.
