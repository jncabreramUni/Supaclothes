# SupaClothes frontend

Esta carpeta contiene la copia de trabajo de la interfaz y las pruebas web. Copia los cambios de `index.html`, `favicon.svg`, `css/` y `js/` a `Supaclothes-backend/src/main/resources/static/`. Maven empaqueta esos recursos para servir la página y la API desde el mismo origen.

## Estructura

- `index.html`: página y formularios.
- `css/estilos.css`: estilos.
- `js/app.js`: navegación, sesión JWT y llamadas a la API.

## Ejecución

Desde la carpeta raíz del proyecto:

```powershell
Set-Location .\Supaclothes-backend
.\mvnw.cmd spring-boot:run
```

Abre `http://localhost:8081`. El backend requiere PostgreSQL según su configuración en `Supaclothes-backend/src/main/resources/application.properties`.

La interfaz consume los endpoints de autenticación, productos, usuarios, inventario, ventas, pagos y comprobantes.

## Permisos de interfaz

El menú se ajusta al rol autenticado: ADMIN administra usuarios, productos, variantes e inventario; VENDEDOR consulta catálogo e inventario y opera ventas; BODEGA consulta existencias y registra entradas. La autorización efectiva se valida también en el backend.

La pantalla de acceso incluye un modo administrativo diferenciado, que consume el endpoint de login exclusivo para ADMIN sin duplicar la autenticación. Cerrar sesión solicita revocación del JWT en el servidor. La interfaz presenta como agotadas las variantes activas sin stock y no permite agregarlas al carrito.

El punto de venta muestra subtotal, descuento antes de impuestos, base neta, impuestos y total con el mismo cálculo por línea que el backend. Las confirmaciones usan una referencia persistida en la pestaña para recuperar un reintento sin duplicar la venta. Se registran efectivo, tarjeta y transferencia, sin pasarela bancaria. Los comprobantes internos pueden buscarse por número, descargarse en HTML e imprimirse o reimprimirse; se aclara que no son facturas electrónicas.

## Pruebas web E2E

Desde `Supaclothes-frontend/xd` instala dependencias y ejecuta:

```powershell
npm install
npx playwright install chromium
npm run test:e2e
```

Las pruebas cubren permisos visibles por rol y el flujo de creación de variantes, entrada de inventario, venta, pago, descarga e impresión/reimpresión del comprobante. No incluyen el cliente móvil.
## Sprint 2

ADMIN dispone del dashboard en Inicio y de la sección Reportes para exportar ventas e inventario a Excel. ADMIN y VENDEDOR pueden registrar una devolución total desde un comprobante. Consulta `../docs/Sprint_2_Implementacion.md` para alcance y reglas de cálculo.
