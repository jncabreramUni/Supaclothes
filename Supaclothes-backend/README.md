# SupaClothes backend

Backend REST construido con Spring Boot, Spring Security, JWT, JPA y PostgreSQL.

## Permisos por rol

- `ADMIN`: administración de usuarios, productos y variantes, inventario, ventas y comprobantes.
- `VENDEDOR`: consulta de catálogo/inventario y registro, consulta e impresión de ventas.
- `BODEGA`: consulta de catálogo/inventario y registro de entradas; sin ventas ni administración.

La API aplica estos permisos además de ocultar las secciones no autorizadas en la interfaz.

Las ventas guardan el pago junto con el descuento de stock. Se soporta efectivo, tarjeta y transferencia; el cambio se calcula para efectivo y el importe de pagos electrónicos debe coincidir con el total. Cada comprobante se puede consultar nuevamente por número para descargarlo como HTML o imprimirlo.

## Ejecutar

Desde `Supaclothes-backend`:

```powershell
.\mvnw.cmd spring-boot:run
```

La aplicación usa el puerto `8081`. Configura la conexión de PostgreSQL en `src/main/resources/application.properties` antes de iniciar.

## Pruebas

```powershell
.\mvnw.cmd test
```

Las pruebas usan H2 en memoria y cubren reglas de negocio de productos, persistencia de ventas/pagos, integridad de stock, comprobantes y autorización por rol.

Los archivos de interfaz se mantienen en `Supaclothes-frontend` y Maven los incluye automáticamente en el artefacto del backend.
