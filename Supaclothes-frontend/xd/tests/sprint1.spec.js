const { test, expect } = require("@playwright/test");

function mockApi(page, role) {
    const products = [];
    const movements = [];
    const receipts = new Map();
    const users = [];
    let nextProductId = 1;
    let nextUserId = 1;

    page.route("**/api/**", async route => {
        const request = route.request();
        const url = new URL(request.url());
        const path = url.pathname.replace(/^\/api/, "");
        const body = request.postDataJSON?.() || {};
        const json = data => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
        const created = data => route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(data) });
        const notFound = () => route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ message: "No encontrado" }) });

        if (path === "/auth/admin/login" && request.method() === "POST" && role !== "ADMIN") {
            return route.fulfill({ status: 401, body: "" });
        }
        if ((path === "/auth/login" || path === "/auth/admin/login") && request.method() === "POST") {
            return json({ token: "e2e-token", role, fullName: `${role} Usuario` });
        }
        if (path === "/products" && request.method() === "GET") {
            return json(products);
        }
        if (path === "/inventory" && request.method() === "GET") {
            return json(products);
        }
        if (path === "/products" && request.method() === "POST") {
            const product = { id: nextProductId++, active: true, ...body, variants: body.variants.map((variant, index) => ({
                ...variant, id: index + 1, currentStock: 0, active: true
            })) };
            products.push(product);
            return created(product);
        }
        const productRoute = path.match(/^\/products\/(\d+)$/);
        if (productRoute && request.method() === "PUT") {
            const product = products.find(item => item.id === Number(productRoute[1]));
            if (!product) return notFound();
            Object.assign(product, body);
            return json(product);
        }
        const variantRoute = path.match(/^\/products\/(\d+)\/variants$/);
        if (variantRoute && request.method() === "POST") {
            const product = products.find(item => item.id === Number(variantRoute[1]));
            if (!product) return notFound();
            product.variants.push({ ...body, id: product.variants.length + 1, currentStock: 0, active: true });
            return created(product);
        }
        if (path === "/inventory/movements" && request.method() === "GET") {
            return json(movements);
        }
        if (path === "/inventory/entries" && request.method() === "POST") {
            const variant = products.flatMap(product => product.variants).find(item => item.sku === body.sku);
            if (!variant) return notFound();
            const previousStock = variant.currentStock;
            variant.currentStock += body.quantity;
            const movement = {
                sku: variant.sku, type: "ENTRADA", quantity: body.quantity,
                previousStock, resultingStock: variant.currentStock, username: "Usuario E2E",
                reference: body.reference, createdAt: new Date().toISOString()
            };
            movements.unshift(movement);
            return created(movement);
        }
        if (path === "/sales" && request.method() === "POST") {
            const discountPercent = Number(body.discountPercent || 0);
            const items = body.items.map(item => {
                const found = products.flatMap(product => product.variants.map(variant => ({ product, variant })))
                    .find(entry => entry.variant.sku === item.sku);
                found.variant.currentStock -= item.quantity;
                const subtotal = found.variant.price * item.quantity;
                const discountValue = Math.round(subtotal * discountPercent) / 100;
                const taxValue = Math.round((subtotal - discountValue) * found.variant.taxRate * 100) / 100;
                const lineTotal = subtotal - discountValue + taxValue;
                return {
                    sku: item.sku, productName: found.product.name, size: found.variant.size, color: found.variant.color,
                    quantity: item.quantity, unitPrice: found.variant.price, discountValue, taxValue, lineTotal
                };
            });
            const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
            const discountValue = items.reduce((sum, item) => sum + item.discountValue, 0);
            const taxTotal = items.reduce((sum, item) => sum + item.taxValue, 0);
            const total = subtotal - discountValue + taxTotal;
            const receiptNumber = "FAC-E2E-001";
            const received = Number(body.amountReceived);
            receipts.set(receiptNumber, {
                receiptNumber, createdAt: new Date().toISOString(), sellerName: "Usuario E2E", items,
                customerName: "Consumidor final", subtotal, taxTotal, discountPercent, discountValue,
                discountBeforeTax: true, total,
                paymentMethod: body.paymentMethod, amountReceived: received,
                changeGiven: body.paymentMethod === "EFECTIVO" ? received - total : 0
            });
            items.forEach(item => movements.unshift({
                sku: item.sku, type: "SALIDA_VENTA", quantity: item.quantity,
                previousStock: 0, resultingStock: 0, username: "Usuario E2E",
                reference: `Venta comprobante: ${receiptNumber}`, createdAt: new Date().toISOString()
            }));
            return created({ receiptNumber, total });
        }
        const receiptRoute = path.match(/^\/sales\/(.+)$/);
        if (receiptRoute && request.method() === "GET") {
            const receiptData = receipts.get(decodeURIComponent(receiptRoute[1]));
            return receiptData ? json(receiptData) : notFound();
        }
        if (path === "/users" && request.method() === "POST") {
            const user = {
                id: nextUserId++,
                active: true,
                fullName: body.fullName,
                username: body.username,
                role: body.roleName
            };
            users.push(user);
            return created(user);
        }
        if (path === "/users" && request.method() === "GET") return json(users);
        return notFound();
    });
}

test("muestra un mensaje cuando el usuario o la contraseña no son correctos", async ({ page }) => {
    mockApi(page, "ADMIN");
    await page.route("**/api/auth/login", route => route.fulfill({ status: 401, body: "" }));
    await page.goto("/");
    await page.locator("#login-username").fill("admin");
    await page.locator("#login-password").fill("incorrecta");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();

    await expect(page.locator("#login-message")).toHaveText(
        "Usuario o contraseña incorrectos. Verifica tus datos e inténtalo de nuevo."
    );
    await expect(page.locator("#login-view")).toBeVisible();
    await expect(page.locator("#app-shell")).toBeHidden();
});

test("el acceso administrativo utiliza una entrada diferenciada y rechaza otros roles", async ({ page }) => {
    mockApi(page, "VENDEDOR");
    await page.goto("/");
    await page.getByRole("button", { name: "Acceso administrativo" }).click();
    await expect(page.locator(".login-card")).toHaveClass(/admin-login/);
    await page.locator("#login-username").fill("vendedor");
    await page.locator("#login-password").fill("secret");
    await page.getByRole("button", { name: "Ingresar al panel administrativo" }).click();
    await expect(page.locator("#login-message")).toContainText("Credenciales incorrectas");
    await expect(page.locator("#app-shell")).toBeHidden();
});

test("una cuenta ADMIN puede ingresar por su acceso diferenciado", async ({ page }) => {
    mockApi(page, "ADMIN");
    await page.goto("/");
    await page.getByRole("button", { name: "Acceso administrativo" }).click();
    await page.locator("#login-username").fill("admin");
    await page.locator("#login-password").fill("secret");
    await page.getByRole("button", { name: "Ingresar al panel administrativo" }).click();
    await expect(page.locator("#app-shell")).toBeVisible();
    await expect(page.locator("#current-role")).toHaveText("ADMIN");
});

test("cada rol ve un resumen y accesos rápidos acordes a sus funciones", async ({ page }) => {
    mockApi(page, "VENDEDOR");
    await page.goto("/");
    await page.locator("#login-username").fill("vendedor");
    await page.locator("#login-password").fill("secret");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();

    await expect(page.locator("#welcome-title")).toHaveText("Hola, VENDEDOR");
    await expect(page.locator("#welcome-description")).toContainText("Atiende a tus clientes");
    await expect(page.locator("#quick-actions-eyebrow")).toContainText("VENDEDOR");
    await expect(page.locator("#quick-actions")).toContainText("Registrar venta");
    await expect(page.locator("#quick-actions")).toContainText("Consultar productos");
    await expect(page.locator("#quick-actions")).toContainText("Consultar inventario");
    await expect(page.locator("#quick-actions [data-section='usuarios']")).toHaveCount(0);
    await expect(page.locator("#quick-actions [data-section='reportes']")).toHaveCount(0);
});

test("ADMIN can create variants, receive stock, sell, pay, download and reprint a receipt", async ({ page }) => {
    mockApi(page, "ADMIN");
    await page.goto("/");
    await page.locator("#login-username").fill("admin");
    await page.locator("#login-password").fill("secret");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page.locator("#welcome-title")).toHaveText("Hola, ADMIN");
    await expect(page.locator("#quick-actions")).toContainText("Consultar reportes");
    await expect(page.locator("#quick-actions")).toContainText("Administrar usuarios");

    await page.locator('nav [data-section="productos"]').click();
    await page.locator('#product-form input[name="name"]').fill("Camisa E2E");
    await page.locator('#product-form input[name="category"]').fill("Ropa");
    const rows = page.locator(".variant-input-row");
    await rows.nth(0).locator(".variant-sku").fill("E2E-M");
    await rows.nth(0).locator(".variant-size").fill("M");
    await rows.nth(0).locator(".variant-color").fill("Azul");
    await rows.nth(0).locator(".variant-price").fill("100");
    await rows.nth(0).locator(".variant-tax").fill("0.15");
    await page.getByRole("button", { name: "Agregar otra variante" }).click();
    await rows.nth(1).locator(".variant-sku").fill("E2E-L");
    await rows.nth(1).locator(".variant-size").fill("L");
    await rows.nth(1).locator(".variant-color").fill("Azul");
    await rows.nth(1).locator(".variant-price").fill("110");
    await rows.nth(1).locator(".variant-tax").fill("0.15");
    await page.getByRole("button", { name: "Crear producto" }).click();
    await expect(page.locator("#products-table").getByText("E2E-M")).toBeVisible();
    await expect(page.locator("#products-table").getByText("E2E-L")).toBeVisible();

    await page.locator('nav [data-section="inventario"]').click();
    await expect(page.locator("#inventory-table .state-low").first()).toBeVisible();
    await page.locator('#inventory-form input[name="sku"]').fill("E2E-M");
    await page.locator('#inventory-form input[name="quantity"]').fill("5");
    await page.locator('#inventory-form input[name="reference"]').fill("Factura E2E");
    await page.getByRole("button", { name: "Registrar entrada" }).click();
    await expect(page.getByText("Factura E2E")).toBeVisible();

    await page.locator('nav [data-section="ventas"]').click();
    await page.locator("#sale-sku").selectOption("E2E-M");
    await page.locator('#sale-item-form input[name="quantity"]').fill("2");
    await page.getByRole("button", { name: "Agregar artículo" }).click();
    await page.locator("#sale-discount").fill("10");
    await expect(page.locator("#sale-estimate")).toContainText("Base después del descuento");
    await page.locator("#amount-received").fill("210");
    await expect(page.locator("#change-estimate")).toContainText("3,00");
    await page.getByRole("button", { name: "Confirmar venta" }).click();
    await expect(page.locator("#receipt-dialog")).toBeVisible();
    await expect(page.locator("#receipt-content")).toContainText("FAC-E2E-001");
    await expect(page.locator("#receipt-content")).toContainText("no es una factura electrónica");
    await expect(page.locator("#receipt-content")).toContainText("Descuento");
    await expect(page.locator("#receipt-content")).toContainText("EFECTIVO");

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Descargar comprobante" }).click();
    expect((await downloadPromise).suggestedFilename()).toBe("FAC-E2E-001.html");
    const printPopup = page.waitForEvent("popup");
    await page.getByRole("button", { name: "Imprimir / reimprimir" }).click();
    await expect((await printPopup).locator("body")).toContainText("FAC-E2E-001");
    await page.getByRole("button", { name: "Cerrar", exact: true }).click();

    await page.locator('#receipt-search input[name="receiptNumber"]').fill("FAC-E2E-001");
    await page.getByRole("button", { name: "Buscar comprobante" }).click();
    await expect(page.locator("#receipt-content")).toContainText("Cambio:");
});

test("BODEGA sees inventory controls but cannot access sales or user administration", async ({ page }) => {
    mockApi(page, "BODEGA");
    await page.goto("/");
    await page.locator("#login-username").fill("warehouse");
    await page.locator("#login-password").fill("secret");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page.locator("#welcome-title")).toHaveText("Hola, BODEGA");
    await expect(page.locator("#welcome-description")).toContainText("Controla las existencias");
    await expect(page.locator("#quick-actions")).toContainText("Registrar inventario");
    await expect(page.locator('nav [data-section="inventario"]')).toBeVisible();
    await expect(page.locator('nav [data-section="ventas"]')).toBeHidden();
    await expect(page.locator('nav [data-section="usuarios"]')).toBeHidden();
    for (const section of ["clientes", "historial", "resumen-diario"]) {
        await expect(page.locator(`nav [data-section="${section}"]`)).toBeHidden();
    }
    await expect(page.locator("#quick-actions [data-section='ventas']")).toHaveCount(0);
    await expect(page.locator("#quick-actions [data-section='reportes']")).toHaveCount(0);
    await page.locator('nav [data-section="inventario"]').click();
    await expect(page.locator("#inventory-form")).toBeVisible();
    await expect(page.locator("#product-form").locator("xpath=ancestor::div[contains(@class,'form-card')]"))
        .toHaveJSProperty("hidden", true);
});

test("ADMIN creates a user without reloading or navigating away", async ({ page }) => {
    mockApi(page, "ADMIN");
    await page.goto("/");
    await page.locator("#login-username").fill("admin");
    await page.locator("#login-password").fill("secret");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await page.locator('nav [data-section="usuarios"]').click();

    await page.locator('#user-form input[name="fullName"]').fill("Usuario nuevo");
    await page.locator('#user-form input[name="username"]').fill("usuario.nuevo");
    await page.locator('#user-form input[name="password"]').fill("Clave123");
    await page.locator('#user-form select[name="roleName"]').selectOption("BODEGA");
    await page.getByRole("button", { name: "Crear usuario" }).click();

    await expect(page).toHaveURL("/#usuarios");
    await expect(page.locator("#page-title")).toHaveText("Usuarios");
    await expect(page.locator("#users-table")).toContainText("usuario.nuevo");
    await expect(page.locator("#users-table")).toContainText("BODEGA");
    await expect(page.locator("#notice")).toContainText("creado correctamente");
});
