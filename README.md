# SupaClothes

Proyecto organizado en una interfaz web estática y un backend REST Spring Boot.

## Carpetas

- `Supaclothes-frontend/`: página HTML, estilos CSS y JavaScript.
- `Supaclothes-backend/`: API REST, autenticación JWT, persistencia, pruebas y Maven Wrapper.
- `docs/`: documentación general del proyecto, incluidos los [diagramas de secuencia](docs/Diagramas_Secuencia_HU_01_02_03_04_07.md) y el [diagrama completo de clases en draw.io](docs/Diagrama_Clases_Completo_SupaClothes.drawio).

El MVP aplica autorización por rol en la API y la interfaz, administración de productos y variantes, consultas/entradas de inventario y flujo de venta con pago y comprobante reimprimible. Consulta los README de backend y frontend para ejecutar las pruebas automatizadas.

El repositorio del backend incluye la versión desplegable de la web en `Supaclothes-backend/src/main/resources/static/`. Maven empaqueta esa copia para servir la interfaz y la API desde el mismo origen. Si editas la copia de trabajo en `Supaclothes-frontend`, sincroniza los recursos de `static/` antes de compilar o desplegar.

## Ejecutar

Desde la raíz:

```powershell
Set-Location .\Supaclothes-backend
.\mvnw.cmd spring-boot:run
```

Abre `http://localhost:8081`. El backend usa la base local `supaclothes` de PostgreSQL por defecto. Consulta las [variables de entorno y los pasos de despliegue en Render](Supaclothes-backend/README.md#despliegue-en-render) para configurar otra conexión o iniciar una base vacía.

Para ejecutar las pruebas:

```powershell
.\mvnw.cmd test
```

## Funciones del sprint 2

La venta permite registrar, buscar y seleccionar un cliente o usar consumidor final (HU-06). Los clientes se identifican con tipo y número de documento; teléfono y correo son opcionales. Un administrador puede aplicar un descuento porcentual de 0 a 100 sobre la base de productos antes de calcular impuestos (HU-09). El backend calcula y almacena importes por línea con redondeo `HALF_UP` a dos decimales; la pantalla anticipa el mismo desglose. Los precios del catálogo se tratan como valores antes de impuestos; las ventas históricas no se recalculan y conservan la regla con la que fueron creadas.

El personal accede por el inicio de sesión general y el botón **Acceso administrativo** abre una entrada diferenciada. Ambos flujos emiten JWT; el endpoint administrativo rechaza cuentas que no sean ADMIN. El cierre de sesión invalida los tokens anteriores del usuario. Cada confirmación web lleva una referencia idempotente para poder recuperar el resultado de un reintento sin descontar stock dos veces.

Los comprobantes son internos, con consecutivo generado por el servidor; no son facturas electrónicas ni procesan pagos bancarios. Se registran efectivo, tarjeta y transferencia; solo el efectivo calcula cambio.

En Ventas se pueden consultar el historial por fechas y comprobante, abrir el detalle del comprobante (HU-12) y consultar las ventas realizadas, las devoluciones y el saldo neto de un día (HU-13). Los controles de tema y tamaño de texto se guardan en el navegador (HU-16). El resumen diario es una consulta, no un cierre contable irreversible.

La devolución total desde un comprobante (HU-11) registra motivo y usuario, reintegra el inventario una sola vez y conserva la venta original. El dashboard de Inicio muestra indicadores y gráfica diaria (HU-14). La sección Reportes permite consultar ventas/devoluciones e inventario actual y exportar archivos Excel `.xlsx` (HU-15). Dashboard y reportes requieren ADMIN; devoluciones permiten ADMIN y VENDEDOR.

Consulta [la guía del sprint 2](docs/Sprint_2_Implementacion.md) para reglas, rutas y pruebas. Las actividades de APK, despliegue, evaluación de accesibilidad y aceptación del Product Owner siguen siendo entregables de cierre separados; no se consideran completadas por implementar las HU web.
