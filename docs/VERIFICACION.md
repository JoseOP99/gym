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

## Bloque preparado: resumen, gastos, activos e ingresos repetidos

Tras autorización explícita del usuario, la migración se aplicó correctamente en Supabase GYM. invite-staff versión 4 está ACTIVE.

- Build y lint correctos; nueve pruebas existentes pasan.
- Navegador Edge con APIs simuladas: filtros mes/semana/día solicitan el período correcto; registrar COP 15.000 envía 1.500.000 centavos como gasto; ingreso repetido abre cuenta existente; una cuenta cerrada mantiene deshabilitados añadir/quitar productos y cerrar pago. Comprobados campo de valoración y página de demostración. Anchos de 1440 y 375 px; sin desbordamiento horizontal en las vistas móviles comprobadas ni errores de JavaScript.
- Verificación real de solo lectura: asset_value existe; finance_summary ejecutada como encargado para los tres períodos, totales contrastados con ventas cerradas y acceso sin identidad rechazado. No se ejecutaron escrituras de prueba en Supabase ni ensayo concurrente de ingresos. Frontend publicado después de que el usuario aprobara el acceso al equipo: deployment dpl_AwTMJbUyft4MgSqBQnF5qpwa3Y86, READY en producción con alias gymtuchin.vercel.app. SMTP propio y entrega siguen pendientes.
- Lecturas reales: políticas de máquinas mantienen escritura para encargado/inventario y las ventas no admiten inserción directa del rol authenticated. Logs de Auth confirman respuestas 429 por límite de correos en los dos intentos de invitación pendientes. El ajuste local muestra ese motivo de forma específica; SMTP y entrega siguen pendientes.

Comprobación pública posterior al despliegue: https://gymtuchin.vercel.app devuelve HTTP 200 y muestra el aviso de demostración y la sección de información de ejemplo. No se inició sesión ni se alteraron datos reales.
La verificación automatizada de /#login quedó bloqueada por Bitdefender del equipo (aviso de certificado no confiable). No se omitió esa protección ni se verificó un login real. El despliegue sí figura READY y el inicio fue leído con HTTP 200.

## Alta manual sin SMTP

- Build y lint correctos; 15 pruebas pasan, incluyendo seis grupos de pruebas del nuevo handler: sesión/RLS/propiedad, creación de encargados, roles operativos, suspensión/vencimientos, validación de entrada, cuentas existentes y errores sin secretos.
- Navegador con APIs simuladas: contraseñas distintas no crean asignaciones; alta manual no llama invite-staff; se limpian contraseñas tras éxito/error; la invitación pendiente conserva correo/nombre y se reutiliza sin insertar otra; cuentas existentes muestran error; alta manual de gimnasio/encargado; formularios a 1440 y 375 px, sin desbordamiento horizontal ni errores JS. No hay creación de usuarios ni envíos reales en esta prueba.
- Migración manual_account_scope aplicada. Consulta real de lectura confirma raw_app_meta_data como fuente del alcance, filtro por ID exacto, ejecución de aceptación anónima denegada y ausencia de INSERT de authenticated en platform_admins. Edge Function create-manual-user v1 ACTIVE con autenticación interna getUser y consultas RLS del solicitante.
- No se ensayó alta Auth real ni el primer inicio de sesión con una nueva identidad. Una petición HTTP de comprobación sin credenciales falló por conectividad del entorno; no demuestra fallo del endpoint. No se omitieron validaciones TLS.

Publicación manual: deployment dpl_2gunMK73q8UUR6Lno4nVjX7PTUfM READY en producción, con alias gymtuchin.vercel.app. La comprobación HTTP sin sesión no pudo completarse: UNABLE_TO_VERIFY_LEAF_SIGNATURE incluso usando la confianza del sistema; no se desactivó TLS. Las pruebas del handler con dependencias simuladas sí comprobaron los rechazos 401/403 y no modificaron Auth real.

## Operario unificado y espaciado

- Build/lint correctos y 16 pruebas pasan. Los tres valores operativos heredados se normalizan a Operario; owner se conserva.
- Navegador con APIs simuladas: reception, inventory e instructor acceden a visitas, clientes, productos, máquinas e historial; no aparecen Equipo, Finanzas ni configuración, botones Archivar ni estado Retirada. Equipo no contiene selector de permisos ni campos/columnas de tarifa. Cancelar pertenece al formulario y mantiene al menos 44 px de alto.
- Capturas revisadas visualmente en 1440, 768 y 375 px, incluidos nombres largos. Se corrigió el ancho de los campos y se apilaron los registros/acciones de equipo en móvil. Sin desbordamiento de página ni errores JS. Detector Impeccable ejecutado una vez: lista de hallazgos vacía; revisión visual posterior corrigió la composición de tabla móvil y columnas del formulario.
- Migración aplicada. Lecturas SQL: las nueve combinaciones operativas están permitidas, ninguna concede owner, RLS permanece activa y authenticated no dispone de DELETE en clientes, productos, máquinas o ventas. Se conserva prueba de regresión de solo lectura en supabase/tests/operator_access.sql. No se crearon fixtures ni se modificaron datos reales para verificar.

Publicación del bloque: deployment dpl_5ZSNXWN1raM68N9Q6ePQdxjp9XZh READY con alias de producción gymtuchin.vercel.app. La suite SQL operator_access.sql terminó sin excepciones. Las comprobaciones de interfaz autenticada usaron APIs simuladas; no se escribieron fixtures en la base real.

## Acceso y navegación con Taste Skill e Impeccable

- Build y lint correctos; 16 pruebas existentes pasan. Lint de Taste: 0 FAIL/0 WARN para Auth/App/Dashboard. Detector Impeccable: sin hallazgos.
- inspect.mjs de Taste se intentó sobre el build previo, pero su cliente CDP agotó el tiempo al habilitar Page. Se usó Playwright/Edge como transporte alternativo para ejecutar los probes y reglas originales de Taste sobre el build de producción. No se afirma una medición anterior completa.
- Revisión final a 1440, 768 y 390 px: 0 FAIL en el acceso; sin avisos en tableta/móvil. Un aviso hero-void en escritorio: el espacio lateral de un formulario de credenciales centrado de 440 px es intencional para mantener legibilidad; se evita rellenarlo con promoción o decoración. Se abrieron todas las capturas finales y se corrigieron el foco visual del título, el bloque promocional vacío y la navegación de tableta.
- Recorridos de navegador con Auth simulado: recuperar/enviar enlace con redirect auth=recovery; volver a entrar; abrir ayuda; registro con mínimo de 12 caracteres; reenvío de confirmación; error de credenciales; enlace a inicio. Alturas mínimas verificadas en volver/recuperar/enviar. No hubo envíos de correo reales.
- Panel con APIs simuladas: abrir Inventario y Máquinas; abrir Administración y Equipo; menú móvil/tableta plegado al entrar y cerrado tras elegir destino. Sin errores JS ni desbordamiento de página. Capturas e informe de medición locales en .taste-skill/after-auth (ignorado en Git).
- Crítica final: tarea principal y texto del acceso claros; acciones auxiliares con peso menor; misma marca y paleta; en móvil/tableta el contenido ocupa el ancho disponible. No se insertaron datos ficticios en la base ni se añadieron imágenes nuevas. La prueba de entrega real de recuperación por correo sigue dependiendo de SMTP.

Acceso y navegación publicados: deployment dpl_91Kcqn6vqFKkq9PJuPk1cfq8Jywv READY, con alias gymtuchin.vercel.app. Verificación de interacción sobre el build local y APIs simuladas; no se inició sesión ni se enviaron correos reales en producción.

## Membresías e ingresos / compras posteriores

- Build/lint correctos; 17 pruebas pasan, incluida cobertura en inicio, último día, vencimiento, inicio futuro y ausencia de membresía.
- Prueba de navegador con APIs simuladas: búsqueda remota ilike con límite 20; aviso de cobertura sin pase; cierre de ingreso por cero; selección/búsqueda limpias tras registrar; nueva compra desde cuenta pagada; agua y bocadillo suman COP 5.000 sin alterar el comprobante anterior; clase secundaria para añadir frente al botón principal de cobro; cierre del nuevo comprobante. Capturas a 1440, 768 y 390 px revisadas, sin desbordamiento ni errores JS. Sin escrituras reales de prueba.
- Ambas migraciones aplicadas a Supabase GYM. Verificación de lectura: función de ingreso contiene cobertura por inicio/vencimiento; open_product_sale existe, ejecución anónima denegada y actualización directa de sales no disponible a authenticated. Falta el ensayo transaccional real de una venta con membresía; no se insertaron fixtures para realizarlo.

## Inventario inmediato, búsqueda y regreso

- Build/lint y 17 pruebas correctos. Navegador con APIs simuladas: búsqueda remota de clientes y cuentas por nombre, cierre conserva acceso a Nueva compra para este cliente, apertura de compra adicional y ancho móvil de 390 px sin desbordamiento.
- Migración aplicada en GYM. Lectura SQL confirma descuento en add_item, devolución en remove_item, ausencia de descuento en close_sale y derivación de regreso a open_product_sale. Las cuatro funciones rechazan ejecución anónima y conservan acceso autenticado con validación interna. Sin fixtures ni escrituras de prueba en producción; no se ensayó una venta real para verificar el saldo transaccional.
