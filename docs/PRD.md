# Primera versión

- R1: acceso por correo y contraseña; propietarios y colaboradores, nunca clientes finales.
- R2: un propietario crea varios gimnasios y asigna recepción, inventario e instructores a cada uno.
- R3: cuentas POS abiertas por cliente, pase diario y productos; cierre atómico e idempotente, importes conservados e inventario descontado una sola vez.
- R4: clientes y membresías con fecha de vencimiento; historial de pagos y estado calculado por fecha local.
- R5: productos y máquinas; personal de inventario administra existencias y estados sin borrar.
- R6: ingresos/egresos adicionales y exportación CSV con filtros de fecha y paginación.
- R7: recordatorio tres días antes de vencer, con proveedor de correo y ejecución programada por configurar.
- R8: aislamiento obligatorio por gimnasio; recepción no administra equipo ni finanzas; instructor no accede a ventas.

Nombre provisional GYM. Cuenta inicial del propietario creada; confirmación de correo pendiente al crearla. Logo comercial y remitente propio pendientes. COP y America/Bogota son valores iniciales. La primera versión usa membresías de 30 días; mostrar siempre fechas exactas.

- R9: inicio público con fotografías y planes de referencia; botón Ingresar separado del contenido público.
- R10: propietario invita personal por correo con roles recepción, inventario o instructor. La invitación se acepta únicamente desde una cuenta con el mismo correo confirmado.
