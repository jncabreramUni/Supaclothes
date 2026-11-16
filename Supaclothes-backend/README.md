# SupaClothes backend

Backend REST construido con Spring Boot, Spring Security, JWT, JPA y PostgreSQL.

## Permisos por rol

- `ADMIN`: administración de usuarios, productos y variantes, inventario, ventas y comprobantes.
- `VENDEDOR`: consulta de catálogo/inventario y registro, consulta e impresión de ventas.
- `BODEGA`: consulta de catálogo/inventario y registro de entradas; sin ventas ni administración.

La API aplica estos permisos además de ocultar las secciones no autorizadas en la interfaz.

Las ventas guardan el pago junto con el descuento de stock. Se soporta efectivo, tarjeta y transferencia; el cambio se calcula para efectivo y el importe de pagos electrónicos debe coincidir con el total. Cada comprobante se puede consultar nuevamente por número para descargarlo como HTML o imprimirlo.

El acceso normal usa `POST /api/auth/login`; la entrada diferenciada de administración usa `POST /api/auth/admin/login` y acepta únicamente cuentas `ADMIN`. `POST /api/auth/logout` incrementa la versión de sesión del usuario e invalida sus JWT anteriores. La API valida permisos en cada operación.

Los precios del catálogo son antes de impuestos. El descuento de venta (solo ADMIN, 0–100 %) se reparte por línea antes del impuesto; se redondean descuento e impuesto por línea a dos decimales con `HALF_UP`. El comprobante interno conserva sus importes y datos de producto al momento de vender. La web envía una referencia idempotente para recuperar una confirmación reintentada sin repetir el movimiento de inventario.

Los clientes requieren tipo y número de documento y nombre; teléfono y correo son opcionales. El esquema añade `document_type` de forma opcional para no invalidar registros anteriores; los nuevos registros enviados por la interfaz sí exigen el tipo.
Con `spring.jpa.hibernate.ddl-auto=update`, el arranque agrega las columnas de sesión, referencia idempotente, datos históricos de cliente y desglose de descuento/impuestos. Las columnas nuevas que afectan filas existentes tienen valores predeterminados o admiten `NULL`; los importes de ventas antiguas no se recalculan. Respalda PostgreSQL antes de la primera actualización y verifica el esquema desplegado.

## Ejecutar

Desde `Supaclothes-backend`:

```powershell
.\mvnw.cmd spring-boot:run
```

Por defecto, la aplicación escucha en `8081` y conecta a `jdbc:postgresql://localhost:5432/supaclothes` con usuario y contraseña `postgres`. Puedes cambiar esos valores con `PORT` y las variables `SPRING_DATASOURCE_*`, o mantener los ajustes de tu equipo en `config/supaclothes-local.properties`, excluido de Git. Para inicializar una base vacía, proporciona `SUPACLOTHES_ADMIN_PASSWORD`. La cuenta inicial se llama `admin`. Si `SUPACLOTHES_JWT_SECRET` está vacía, la aplicación genera una clave temporal y los JWT se invalidan al reiniciar.

Si enlazas el repositorio con Neon, el archivo `.env.local` de la raíz contiene `DATABASE_URL` y `DATABASE_URL_UNPOOLED`. El script `node Supaclothes-backend/scripts/configure-neon.cjs`, ejecutado desde la raíz, adapta la conexión con pool a JDBC y guarda los ajustes locales que Spring Boot carga al iniciar. Ejecuta el script otra vez después de renovar las credenciales o cambiar de rama en Neon. Las configuraciones de conexión de Neon se excluyen de Git.

## Despliegue en Render

Crea un **Web Service** con runtime **Docker** y plan **Free**. Conecta el repositorio de `Supaclothes-backend` y deja **Root Directory** vacío. Usa `./Dockerfile` y el contexto de construcción raíz `.`. El contenedor activa el perfil `render` y usa el `PORT` asignado por Render, normalmente `10000`.

| Variable de Render | Valor |
| --- | --- |
| `SPRING_DATASOURCE_URL` | URL JDBC con pool de Neon, con forma `jdbc:postgresql://<host-pooler>/<base>?sslmode=verify-full&sslfactory=org.postgresql.ssl.DefaultJavaSSLFactory&channelBinding=require`. |
| `SPRING_DATASOURCE_USERNAME` | Usuario de Neon con permisos para crear y actualizar el esquema. |
| `SPRING_DATASOURCE_PASSWORD` | Contraseña de ese usuario de Neon. |
| `SUPACLOTHES_JWT_SECRET` | Clave aleatoria estable en Base64 de al menos 32 bytes decodificados. |
| `SUPACLOTHES_ADMIN_PASSWORD` | Contraseña fuerte de hasta 72 bytes UTF-8 para `admin` en la primera puesta en marcha con una tabla de usuarios vacía. |

Usa los tres valores `spring.datasource.*` de `config/supaclothes-neon.properties` para completar las variables JDBC. Configúralas en **Environment** de Render. Puedes generar la clave JWT en PowerShell con `[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))`.

Hibernate crea o actualiza el esquema al arrancar. Se crean los roles `ADMIN`, `VENDEDOR` y `BODEGA` que falten. Si la tabla de usuarios está vacía y la contraseña inicial falta, está en blanco o supera el límite de BCrypt, el servidor arranca y registra `Administrador inicial pendiente`. Define una contraseña válida en Render y vuelve a desplegar para habilitar el primer acceso. La contraseña de las cuentas existentes se conserva si vuelves a desplegar.

Para verificar la actividad 57 de la Matriz RACI, comprueba el inicio del servicio y autentícate en `/api/auth/admin/login` contra la cuenta inicial. Para la actividad 58, abre `/` en la misma URL pública y comprueba la carga de los recursos y el acceso desde la web. Puedes usar `/` como ruta de comprobación de salud en Render.

## Pruebas

```powershell
.\mvnw.cmd test
```

Las pruebas usan H2 en memoria y cubren reglas de negocio de productos, persistencia de ventas/pagos, integridad de stock, comprobantes y autorización por rol.

Maven empaqueta la interfaz desde `src/main/resources/static/`. Si editas la copia de trabajo externa `Supaclothes-frontend`, copia los archivos web actualizados a `static/` y súbelos con los cambios del backend.
