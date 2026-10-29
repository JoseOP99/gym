# Verificación

## Comprobado

- `npm run build`: TypeScript y compilación correctos.
- `npm run lint`: sin errores ni advertencias después de corregir los efectos y separar el helper de errores.
- `npm test`: tres pruebas aprobadas sobre centavos POS, CSV seguro y vencimiento de membresías.
- Navegador: landing, fotografías cargadas, regreso desde login al inicio y vista móvil sin desbordamiento horizontal.
- En la etapa inicial, la prueba SQL de seguridad pasó para aislamiento por gimnasio, permisos de recepción/inventario, acceso anónimo denegado, cierre idempotente, stock e inmutabilidad. Las inserciones ficticias se revirtieron.
- Cuenta administradora de prueba creada y asociada al gimnasio GYM; el correo requería confirmación al crearla.

## Pendiente

- Entrega y aceptación real de correos de invitación y recuperación. Configurar primero las URLs de redirección de Auth y comprobar SMTP.
- La nueva prueba `supabase/tests/invitations.sql` está preparada, pero la revisión automática bloqueó su ejecución porque inserta fixtures en la base real, incluso con ROLLBACK. No se debe ejecutar sin autorización explícita del alcance.
- Inicio de sesión completo del administrador una vez confirmado su correo.
- Recordatorios de vencimiento: solo está preparada la cola SQL; falta worker y programación.

Los avisos de Supabase sobre contraseñas filtradas desactivadas y RLS sin políticas de usuario en la cola privada están descritos en CONTEXTO. La revisión realizada no constituye una auditoría completa.
