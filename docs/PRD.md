# Plataforma de pruebas para gimnasios

## Usuarios

- **Superadministrador (José):** crea gimnasios, invita o reemplaza encargados, consulta cada gimnasio, concede siete días adicionales, activa y suspende accesos. Su rol se guarda en una tabla privada sin autoasignación desde el cliente.
- **Encargado:** administra un gimnasio asignado; ve dashboard, clientes, membresías, ventas, finanzas, equipo y configuración. Puede archivar o reactivar clientes, productos y máquinas.
- **Operario:** registra clientes, visitas y ventas, cobra membresías, mantiene productos/existencias y máquinas, y consulta el historial operativo. No crea gimnasios, configura tarifas del gimnasio, archiva/reactiva/retira registros, gestiona colaboradores ni consulta finanzas. Los anteriores valores Inventario e Instructor se conservan como datos heredados y tienen este mismo permiso efectivo. No se solicita ni muestra tarifa por hora.

## Primera versión implementada

- R1: login y recuperación por correo. Capturar el tipo de recuperación antes de que Supabase consuma su fragmento.
- R2: solo José crea un gimnasio y una invitación de encargado, de forma atómica.
- R3: el encargado acepta con el mismo correo confirmado. Su aceptación inicia una prueba de siete períodos de 24 horas.
- R4: tras la prueba se bloquea todo el panel. Los datos permanecen; José puede reactivar o conceder otros siete días. No hay cobro automático.
- R5: cada gimnasio conserva sus clientes, ventas, productos, máquinas, membresías y colaboradores, aislados por RLS.
- R6: el encargado configura precio del pase, precio de membresía y su duración (1 a 365 días). Pagos anteriores conservan importes y períodos.
- R7: POS con pase diario y productos, cierre transaccional, stock y ventas cerradas inmutables.
- R8: consulta y CSV de ventas paginados. Clientes con mensualidad y estado por fecha.
- R9: encargado invita colaboradores por correo con permisos limitados.
- R16: alta manual de cuentas nuevas sin envío de correo, con contraseña inicial de 12 a 128 caracteres y confirmación. José crea encargados; el encargado crea colaboradores de su gimnasio habilitado. Se pueden aprovechar asignaciones pendientes. No modifica contraseñas de cuentas existentes ni otorga roles globales. El acceso se acepta al primer inicio de sesión, antes de vencer la asignación; la prueba nueva empieza entonces. Las identidades manuales solo aceptan su asignación original.
- R10: las eliminaciones operativas son archivados. Nadie borra ventas cerradas desde el panel.
- R17: membresía vigente cubre el ingreso diario, con aviso de vigencia y concepto de valor cero validado en PostgreSQL; los productos se cobran normalmente. Inicio incluido y vencimiento excluido según Bogotá. Ventas pagadas inmutables.
- R18: compras adicionales para clientes con cuenta cerrada generan una venta independiente de productos, sin registrar otra visita ni cobrar pase. Búsqueda remota de clientes y presentación separada de agregar productos/cobro final, adaptada a móvil.

## Pendiente

Migración aplicada y frontend publicado en producción:

- R11: resumen financiero para encargado/plataforma con hoy, semana y mes, ventas cobradas más ingresos adicionales, gastos y balance; gráfica y valores diarios accesibles.
- R12: registrar compras operativas desde Gastos e ingresos, sin confundir el costo de compra con catálogo/precio de venta.
- R13: valor opcional de máquinas en centavos; total de activos excluye retiradas y señala registros sin valoración. Guardar un activo no genera automáticamente un egreso.
- R14: una visita por cliente/gimnasio/día de Bogotá. Intentos repetidos abren la cuenta existente, incluso con recepciones concurrentes. Cuentas abiertas anteriores también se continúan. Ventas pagadas siguen inmutables; no se limpian duplicados históricos.
- R15: inicio público de muestra con información claramente ilustrativa para personalizar por gimnasio. Gestión de publicaciones fuera de esta etapa.

Verificación de entrega real de una nueva invitación de encargado y su aceptación; cuenta SMTP propia si se ofrece a terceros; recordatorios automáticos de membresía (cola SQL preparada, envío/programación pendientes); marca y referencias definitivas de cada cliente.

- R19: descontar stock al agregar productos, devolver al quitar de una cuenta abierta y no descontar al cobrar. Regreso del día abre compra adicional sin nuevo pase. Buscar cuentas pendientes por cliente con paginación.
