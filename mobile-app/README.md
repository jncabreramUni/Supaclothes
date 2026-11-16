# SupaClothes móvil

Aplicación Expo con TypeScript y Expo Router. Usa la API REST de `Supaclothes-backend`, que escucha en el puerto `8081`.

## Ejecutar desde Windows

Con Spring Boot en ejecución, abre PowerShell en `mobile-app`. Usa Node.js 22.13 o posterior.

```powershell
npm ci
Copy-Item .env.example .env.local
```

- **Emulador de Android Studio**. El valor incluido en `.env.example` apunta a `http://10.0.2.2:8081/api`.
- **Celular físico**. Sustituye `10.0.2.2` por la IPv4 del computador que ejecuta Spring Boot. Conecta ambos equipos a la misma red y verifica que el celular pueda abrir `http://<IP-del-PC>:8081/`.

Para probar el manifiesto Android, abre un emulador o conecta un dispositivo con depuración USB y ejecuta lo siguiente con Android Studio, el SDK de Android y Java configurados.

```powershell
npm run android
```

`app.config.ts` pasa `android.usesCleartextTraffic: true` a `expo-build-properties` cuando la URL de la API empieza por `http://`. La opción se aplica al generar una compilación propia, mediante Prebuild, y afecta al tráfico HTTP de esa compilación. Al pasar a una URL HTTPS, regenera Android y vuelve a compilar para aplicar el nuevo manifiesto. Expo Go usa su propio manifiesto.

Para abrir el proyecto en una versión de Expo Go compatible con SDK 57, ejecuta `npm start`. Si el sistema bloquea HTTP local en Expo Go, usa la compilación propia en Android o una URL HTTPS. Después de cambiar `.env.local`, vuelve a iniciar Metro y recarga la app.

Si ya tenías una compilación de la app instalada, recompílala con `npm run android` para usar los módulos nativos de PDF y archivos. En iOS, recompila localmente con `npm run ios` en macOS.

## Flujos incluidos

- Acceso general y administrativo, sesión JWT guardada con SecureStore y cierre de sesión.
- **Administración.** Alta y desactivación de usuarios. Creación y edición de productos y variantes por SKU, con activación y desactivación.
- **Inventario.** Existencias, movimientos y filtro de stock bajo para variantes activas en productos activos. Administración y Bodega pueden registrar entradas.
- **Ventas y clientes.** Alta y búsqueda de clientes, carrito por SKU, efectivo con cálculo de cambio, tarjeta y transferencia. Administración puede aplicar descuentos porcentuales. El backend calcula y valida el total definitivo. La app conserva la referencia de una venta cuyo envío se interrumpe para poder reintentarla.
- **Historial y comprobantes.** Filtros por fechas y comprobante, detalle de venta, PDF y devolución total con motivo. La devolución registrada aparece en el comprobante.
- **Resumen y reportes.** Resumen diario por fecha para Ventas y Administración. Dashboard por periodo con gráfica y reportes de ventas e inventario con exportación Excel para Administración.
- **Ajustes.** Tema claro, oscuro o del dispositivo y texto normal, grande o extra grande. Las preferencias se guardan en el dispositivo.

Al guardar un PDF o Excel, Android abre el selector de carpetas. En iOS, usa la opción para guardar en Archivos desde la hoja de acciones.

Valida TypeScript con `npm run typecheck`. Para generar los bundles JavaScript de Android e iOS, ejecuta `npx expo export --platform all`.
