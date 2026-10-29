# Dirección visual

Aplicación operativa de escritorio y móvil. Nombre provisional GYM; cada gimnasio muestra su propio nombre.
Fondo marfil, paneles blancos, texto carbón y acento verde bosque; estados con texto además del color.
DM Sans y Manrope; navegación lateral agrupada en escritorio y menú plegable en móvil/tableta (hasta 1000 px).
Pantallas: acceso, selección de gimnasio, resumen, punto de venta, clientes, productos, máquinas, equipo, finanzas e historial.
Formularios con etiquetas visibles, foco contrastado, botones de al menos 44px, mensajes de error y bloqueo durante guardado.
Sin datos ficticios presentados como reales. Estados vacíos explican la acción siguiente.
Firma discreta: Creado por Zenubit, https://zenubit.com.
UI UX Pro Max consultada con el Python incluido en el entorno. Se eligió una dirección deportiva editorial para la landing y se conserva el panel verde bosque/marfil.

Landing: navegación pública, hero con fotografía de pesas, entrenamiento, dos planes de referencia y acceso discreto al panel. Acento lima sobre verde oscuro, títulos grandes y sin testimonios ni métricas inventadas. Precios públicos de referencia: pase COP 15.000 y membresía de 30 días COP 100.000; todavía no se sincronizan con la configuración privada del gimnasio.

Fotografías externas de Victor Freitas y Greg Rosenke, Unsplash, con enlaces de crédito. Representan el concepto, no las instalaciones reales del cliente. Sustituirlas por fotos propias cuando existan.

Rutas por fragmento: inicio/secciones públicas, #login y #panel. Recuperación e invitación pueden abrir la pantalla para establecer contraseña.

Superadministración: vista propia después del login de José, con contadores, alta de gimnasio e invitación del encargado, tarjetas de estado y controles Activar / Dar 7 días / Suspender. Permite entrar a cada gimnasio y volver a la plataforma.

Encargado/operarios: acceso directo a los gimnasios asignados; no se presenta un formulario de alta de gimnasios. El panel muestra el tiempo de prueba restante. Al vencer, una pantalla de bloqueo explica que los datos se conservan y pide contactar a José.

El acceso a la plataforma y las acciones permitidas derivan del backend, aunque el usuario manipule componentes o URLs.

Preparado localmente: Resumen muestra ingresos cobrados, gastos y balance, con filtros de hoy, semana actual (desde lunes) y mes actual, todos hasta hoy en Bogotá. La gráfica tiene leyenda textual y tabla de valores. El valor registrado de máquinas se muestra aparte de caja, con cantidad sin valorar. Gastos e ingresos permite describir compras como agua, aseo o servicios. Productos explica precio de venta y existencias frente al costo de compra.

Ingreso repetido: aviso con fecha/hora y apertura de cuenta existente; una cuenta pagada conserva conceptos visibles y controles de edición deshabilitados. Migración aplicada e interfaz publicada, según CONTEXTO.

Inicio público: aviso visible de demostración; sección de dirección/ubicación pendiente de personalizar, horarios y actividades expresamente ilustrativos. Tarifas e imágenes siguen siendo referencias. No se implementa gestión de publicaciones en esta etapa.

Alta manual: Equipo muestra Crear usuario manual con nombre, correo y contraseña inicial repetida. El permiso fijo Operario se explica en texto y no hay tarifa por hora. Invitaciones pendientes ofrecen Crear acceso sin correo, fijando nombre/correo a la asignación existente. La plataforma permite crear el gimnasio con usuario manual como opción inicial y crear encargados desde cada tarjeta. No se envía correo ni se inicia sesión por la persona. Las contraseñas permanecen en campos ocultos y se limpian tras cada intento; nunca se muestran en el mensaje de éxito. El administrador las comparte de forma privada.

Formularios operativos: separación de campos de 20 px; acciones relacionadas con 12 px entre sí; notas finales separadas por 24 px. Los mensajes se muestran en fila propia. El formulario manual usa dos columnas en escritorio y una en móvil; ayudas y explicación del permiso ocupan la fila completa. Acciones secundarias/cancelar permanecen junto al envío dentro de la tarjeta. Objetivos táctiles de 44 px también en encabezados móviles. Las tablas de personal e invitaciones se convierten en registros verticales a 650 px, con acciones visibles sin desplazamiento lateral. La navegación y la identidad existentes se conservan.

Acceso refinado con Taste Skill e Impeccable: una columna centrada de hasta 440 px, marca y nombre del producto sin bloque promocional. Una sola acción primaria, Entrar al panel. Volver al inicio es un enlace separado, de 44 px de altura; ¿Olvidaste tu contraseña? queda en una fila propia. Registro y reenvío de confirmación están bajo ¿Es tu primer acceso?; al recuperar, registrar o confirmar se ofrece Volver a entrar junto al envío. Mensajes específicos sin repetir Operación completada. Foco del título al cambiar de vista, controles con foco visible y alturas mínimas de 44–48 px.

Navegación: cuatro destinos cotidianos (Resumen, Ingresos y ventas, Clientes, Ventas), Inventario agrupa Productos/Máquinas y Administración agrupa Gastos e ingresos/Equipo/Gimnasio solo para encargado. Las secciones conservan sus permisos; el grupo activo queda abierto. Hasta 1000 px, Menú abre/cierra la navegación; elegir destino la cierra y lleva el foco al título. La cabecera del panel usa títulos concretos, sin un eslogan previo.

Ingresos y ventas: selector Ingreso al gimnasio / Solo productos, búsqueda de cliente por nombre con hasta 20 coincidencias, aviso de membresía activa y vencimiento antes de registrar. Ingreso incluido se muestra a $0 y puede finalizarse sin elegir pago; productos aparte. En la cuenta, Agregar productos tiene su propio bloque y botón secundario Añadir a la cuenta; Cobro final está separado y usa el botón principal Cerrar cuenta y cobrar. Una cuenta pagada muestra Nueva compra para este cliente en vez de controles para editarla. En móvil/tableta, la cuenta activa se presenta primero y se desplaza hacia ella al abrirla; se respeta movimiento reducido.
