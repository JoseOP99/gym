# Plataforma de pruebas para gimnasios

## Usuarios

- **Superadministrador (José):** crea gimnasios, invita o reemplaza encargados, consulta cada gimnasio, concede siete días adicionales, activa y suspende accesos. Su rol se guarda en una tabla privada sin autoasignación desde el cliente.
- **Encargado:** administra un gimnasio asignado; ve dashboard, clientes, membresías, ventas, finanzas, equipo y configuración. Puede archivar o reactivar clientes, productos y máquinas.
- **Operario:** registra clientes, visitas y ventas, cobra membresías y consulta el historial operativo. No crea gimnasios, configura tarifas ni archiva registros.
- **Inventario:** mantiene existencias, productos y disponibilidad de máquinas, sin retirar registros ni consultar finanzas.
- **Instructor:** consulta clientes/membresías dentro del gimnasio asignado.

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
- R10: las eliminaciones operativas son archivados. Nadie borra ventas cerradas desde el panel.

## Pendiente

Verificación de entrega real de una nueva invitación de encargado y su aceptación; cuenta SMTP propia si se ofrece a terceros; recordatorios automáticos de membresía (cola SQL preparada, envío/programación pendientes); marca y referencias definitivas de cada cliente.
