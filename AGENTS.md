# GYM · Gestión de gimnasios

Leer docs/CONTEXTO.md, docs/DISENO.md y docs/PRD.md antes de modificar reglas de negocio.
Stack: React, TypeScript, Vite, Supabase Auth y PostgreSQL.
Comandos: npm install, npm run dev, npm run build, npm run lint, npm test.
Una sola base autorizada: Supabase GYM, cjmffrhnlsypasnijuhm. No crear proyectos, ramas ni tablas paralelas de prueba.
No alterar datos reales para verificar. No guardar secretos ni subir .env.local a Git.
Permisos y aislamiento se validan en PostgreSQL, nunca solamente en componentes.
Solo José crea gimnasios y gestiona pruebas. El rol global vive en private.platform_admins; nunca autoasignarlo desde signup o metadata.
La prueba empieza al aceptar el encargado, dura siete días y bloquea todo el panel al vencer. Solo la plataforma reactiva.
Preferir verificaciones SQL de solo lectura; no insertar fixtures en la base real sin alcance explícito.
Importes en centavos enteros; ventas cerradas inmutables. Archivar registros operativos en lugar de borrar historia.
Mantener firma discreta Creado por Zenubit con enlace https://zenubit.com.
