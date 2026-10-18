# SupaClothes frontend

La interfaz está separada del código Java del backend. Spring Boot copia estos recursos al paquete de la aplicación durante la compilación, por lo que la página y la API se sirven desde el mismo origen.

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

El punto de venta permite capturar la forma de pago, efectivo recibido y cambio. Los comprobantes pueden buscarse otra vez por número, descargarse en HTML e imprimirse o reimprimirse desde la vista del comprobante.

## Pruebas web E2E

Desde esta carpeta instala dependencias y ejecuta:

```powershell
npm install
npx playwright install chromium
npm run test:e2e
```

Las pruebas cubren permisos visibles por rol y el flujo de creación de variantes, entrada de inventario, venta, pago, descarga e impresión/reimpresión del comprobante. No incluyen el cliente móvil.