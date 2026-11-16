# Sprint 2: historias implementadas

## Uso en la aplicación web

| Historia | Dónde se usa | Resultado |
| --- | --- | --- |
| HU-06 | Ventas → cliente | Registrar/buscar por nombre o documento; consumidor final opcional. |
| HU-09 | Ventas → descuento | ADMIN aplica porcentaje de 0 a 100 sobre subtotal más impuestos. |
| HU-11 | Ventas → consultar comprobante → devolución | ADMIN/VENDEDOR devuelve toda la venta con motivo obligatorio. |
| HU-12 | Ventas → historial | Filtrar por fecha/comprobante y abrir el detalle. |
| HU-13 | Ventas → resumen diario | Cantidad de ventas, importe de ventas, devoluciones del día y neto. |
| HU-14 | Inicio, como ADMIN | Rango de fechas, indicadores, gráfica y tabla diaria accesible. |
| HU-15 | Reportes, como ADMIN | Movimientos de ventas/devoluciones e inventario actual, descarga XLSX. |
| HU-16 | Controles de la cabecera | Tema claro/oscuro y tamaño de texto persistente en el navegador. |

## Reglas de devolución y totales

- La devolución básica es **total**, una sola por comprobante. No hay devoluciones parciales en este alcance.
- Se guardan fecha, usuario, motivo (hasta 500 caracteres), venta y total original cobrado, incluidos descuento e impuestos. Cambiar precios o SKU después de vender no cambia el importe de devolución.
- La venta pasa a `DEVUELTA`. El comprobante original se conserva y la interfaz, impresión y descarga indican la devolución registrada.
- Una transacción bloquea la venta y las variantes, reintegra stock y registra movimientos `ENTRADA_DEVOLUCION`. Reintentos y solicitudes simultáneas no duplican existencias; si una variante falla se revierte toda la operación.
- Se permite reintegrar una variante inactiva. No se reactiva automáticamente.
- El sistema registra el importe a devolver; el reembolso efectivo o bancario lo realiza el encargado por fuera del sistema. No existe una conexión a pasarela de pagos.
- Las ventas se contabilizan en su fecha original y las devoluciones en su propia fecha. Neto = ventas menos devoluciones del periodo. Un día puede tener saldo negativo si se devuelve una venta anterior.
- Los filtros de dashboard/reportes admiten como máximo 366 días, incluyendo ambos extremos; por defecto muestran los últimos siete días. El inventario siempre corresponde a las existencias actuales, no a una reconstrucción histórica.
- Stock bajo significa existencias menores o iguales al mínimo para variantes y productos activos. Unidades en inventario incluye también existencias inactivas.
- Las fechas persistidas usan la hora local del servidor. Ejecutar el servidor con la zona `America/Bogota`, igual que los selectores de fechas de la interfaz.

La matriz RACI describe los entregables, sin criterios de aceptación completos. La devolución total, la autorización ADMIN para reportes y la regla de descuentos son decisiones de implementación que debe validar el Product Owner. La implementación de una HU no equivale a su aceptación por el Product Owner.

## API añadida

| Método y ruta | Acceso |
| --- | --- |
| POST `/api/sales/{receiptNumber}/return`, cuerpo `{ "reason": "Motivo" }` | ADMIN, VENDEDOR |
| GET `/api/sales/{receiptNumber}/return` | ADMIN, VENDEDOR; 404 si aún no hay devolución |
| GET `/api/reports/dashboard?from=AAAA-MM-DD&to=AAAA-MM-DD` | ADMIN |
| GET `/api/reports/sales?from=AAAA-MM-DD&to=AAAA-MM-DD` | ADMIN |
| GET `/api/reports/sales/export?from=AAAA-MM-DD&to=AAAA-MM-DD` | ADMIN, archivo XLSX |
| GET `/api/reports/inventory` | ADMIN |
| GET `/api/reports/inventory/export` | ADMIN, archivo XLSX |

Los Excel contienen filtros/fecha de generación, encabezados, datos numéricos y totales. Los textos se exportan como cadenas literales para evitar fórmulas procedentes de nombres o SKUs. No se implementó PDF: la exportación escogida para HU-15 es Excel.

## Validación

Desde `Supaclothes-backend`: `./mvnw.cmd test`. Maven incluye `../test/java` y `../test/resources`; Mockito se carga explícitamente para evitar el bloqueo de auto-attach de Windows.

Desde `Supaclothes-frontend/xd`: `npm run test:e2e`. El servidor de pruebas sirve la raíz real del frontend. Las pruebas de navegador usan API simulada; las pruebas de integración del backend validan persistencia y permisos con H2, sin alterar PostgreSQL.

Resultados verificados: 30 pruebas backend aprobadas y 7 pruebas de navegador aprobadas. Incluyen concurrencia de devoluciones, rollback de stock, descuento original, límites de fechas, totales por fecha del movimiento, estructura XLSX, flujo móvil oscuro y preferencias/contraste/foco accesible. No sustituyen la prueba de aceptación sobre PostgreSQL ni la integración con APK.

## Revisión contra la RACI del Sprint 2

Las actividades 44–51 (HU-06 y HU-09–HU-16) tienen implementación web/API; los escenarios automatizados y reglas descritas arriba son su evidencia técnica disponible. La matriz asigna un único responsable y aprobador por actividad, y esas asignaciones no se modifican aquí. La decisión de alcance o aceptación funcional sigue siendo del Product Owner (A).

| Actividad RACI | Asignación (R / A) | Estado verificable | Evidencia o siguiente paso |
| --- | --- | --- | --- |
| 43 · Planeación del Sprint 2 | Scrum Master / Product Owner | Pendiente de evidencia de ceremonia | Registrar Sprint Planning y backlog acordado. |
| 44 · HU-06 Clientes | Frontend/Móvil / Product Owner | Implementada en web/API | Aceptación funcional del flujo de registro, búsqueda y selección. |
| 45 · HU-09 Descuento | Backend/DevOps / Product Owner | Implementada en web/API | Aceptar autorización ADMIN y base del cálculo (subtotal más impuestos). |
| 46 · HU-11 Devolución | Backend/DevOps / Product Owner | Implementada en web/API | Aceptar alcance de devolución total y una por comprobante. |
| 47 · HU-12 Historial | Frontend/Móvil / Product Owner | Implementada en web/API | Aceptación funcional de filtros y detalle. |
| 48 · HU-13 Resumen diario | Backend/DevOps / Product Owner | Implementada en web/API | Aceptación funcional del tratamiento de ventas y devoluciones por fecha del movimiento. |
| 49 · HU-14 Dashboard | Frontend/Móvil / Product Owner | Implementada en web/API | Aceptación funcional de indicadores y gráfica. |
| 50 · HU-15 Reportes | Frontend/Móvil / Product Owner | Implementada en web/API | Aceptar XLSX como formato y validar contenido exportado. |
| 51 · HU-16 Preferencias | Frontend/Móvil / Product Owner | Implementada; accesibilidad reforzada | Aceptación funcional de tema/tamaño de texto; completar evaluación formal de accesibilidad/usabilidad de la actividad 52. |
| 52 · Accesibilidad y usabilidad (meta >70) | Frontend / Product Owner | Parcial; mejora técnica aplicada, medición pendiente | El frontend ahora refuerza contraste, foco de teclado y persistencia de preferencias; falta ejecutar y guardar el indicador exigido y la evaluación de usuarios. Las pruebas de navegador no sustituyen esa medición. |
| 53 · Responsive y dispositivos objetivo | Frontend / Backend-DevOps | Parcial | Hay diseño responsive y prueba automatizada a 320/390 px; falta validar en dispositivos objetivo, especialmente la APK y el flujo web–móvil. |
| 54 · Logs, errores y auditoría básica | Backend-DevOps / Frontend | Parcial | La devolución conserva usuario, motivo y movimientos, y los errores de API se notifican; falta verificar y evidenciar logs/respaldos del ambiente desplegado. |
| 55 · Minificación/ofuscación cuando corresponda | Frontend / Backend-DevOps | Pendiente de decisión técnica | El frontend es estático y no tiene proceso de build. Definir si se incorpora al empaquetado/despliegue antes de minificar; no ofuscar el código fuente mantenido. |
| 56 · Evidencias y defectos por HU | Scrum Master / Product Owner | Parcial | Hay pruebas automatizadas y resultados registrados en este documento; falta consolidar evidencias de ejecución y defectos/cierres en el tablero del equipo. |
| 57–60 · Despliegue, APK e integración web–móvil | Según cada fila de la matriz | Pendientes | Desplegar, instalar la APK y ejecutar la prueba de humo con datos compartidos. |
| 61 · Validación de exportaciones | Frontend / Product Owner | Implementada; aceptación pendiente | Se exportan XLSX; falta validar el formato elegido y su contenido con el Product Owner. |
| 62–63 · Manual técnico y manual de usuario | Backend-DevOps / Frontend | Pendientes | Elaborar y revisar ambos manuales. |
| 64–66 · Review, aceptación y retrospectiva final | Scrum Master / Product Owner | Pendientes | Demostrar el incremento, registrar aceptación del cliente y documentar lecciones/acciones. |

## Pendientes de cierre del proyecto

La app web no cubre por sí sola el cierre RACI: siguen pendientes APK y prueba web-móvil, despliegue, medición formal de accesibilidad/usabilidad, validación de respaldos/logs, manuales, consolidación de evidencias y aceptación del cliente. No se han modificado las asignaciones ni estados de la matriz RACI.
