const { test, expect } = require("@playwright/test");
const { readFile } = require("node:fs/promises");

const receipt = {
    receiptNumber: "FAC-PARIDAD", createdAt: "2026-10-27T10:00:00", sellerName: "Lucía Ávila",
    customerName: "Martín Peña", subtotal: 250, taxTotal: 47.5, discountPercent: 0, discountValue: 0,
    discountBeforeTax: true, total: 297.5, paymentMethod: "EFECTIVO", amountReceived: 300, changeGiven: 2.5,
    items: [{ sku: "CAM-1", productName: "Camiseta", size: "M", color: "Azul", quantity: 1,
        unitPrice: 250, taxValue: 47.5, lineTotal: 297.5 }]
};

const product = {
    id: 1, name: "Camiseta", category: "Ropa", description: "Algodón", active: true,
    variants: [
        { id: 1, sku: "CAM-1", size: "M", color: "Azul", price: 250, taxRate: 0.19, minStock: 2, currentStock: 2, active: true },
        { id: 2, sku: "CAM-2", size: "L", color: "Rojo", price: 250, taxRate: 0.19, minStock: 2, currentStock: 0, active: false }
    ]
};

async function signIn(page, role, overrides = {}) {
    await page.route("**/api/**", async route => {
        const request = route.request();
        const url = new URL(request.url());
        const respond = (data, status = 200) => route.fulfill({ status, json: data });
        if (overrides[url.pathname]) return overrides[url.pathname](request, respond, route);
        switch (url.pathname) {
            case "/api/auth/login": return respond({ token: "phase-two", role, fullName: "Lucía Ávila" });
            case "/api/products":
            case "/api/inventory": return respond([product]);
            case "/api/inventory/movements": return respond([]);
            case "/api/reports/dashboard": return respond({ salesCount: 0, grossSales: 0, refunds: 0, netSales: 0, stockUnits: 2, lowStockCount: 1, daily: [] });
            case "/api/sales": return respond([{ ...receipt, status: "CONFIRMADA" }]);
            case "/api/sales/FAC-PARIDAD": return respond(receipt);
            case "/api/sales/FAC-PARIDAD/return": return respond({ message: "Sin devolución" }, 404);
            case "/api/sales/daily-summary": return respond({ date: url.searchParams.get("date"), count: 1, grossSales: 297.5, refunds: 0, total: 297.5 });
            default: return respond({ message: "No encontrado" }, 404);
        }
    });
    await page.goto("/");
    const login = page.locator("#login-form");
    await login.getByLabel("Usuario", { exact: true }).fill("lucia");
    await login.getByLabel("Contraseña", { exact: true }).fill("password");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page.locator("#app-shell")).toBeVisible();
}

const navigate = (page, section) => page.locator(`nav [data-section="${section}"]`).click();

test("conserva localStorage tras recargar y verifica un 401 antes de cerrar", async ({ page }) => {
    let expired = false;
    let catalogRequests = 0;
    await signIn(page, "ADMIN", {
        "/api/products": (request, respond) => { catalogRequests++; return respond(expired ? {} : [product], expired ? 401 : 200); },
        "/api/users": (_, respond) => respond({}, 401)
    });
    await page.reload();
    await expect(page.locator("#app-shell")).toBeVisible();
    const requestsBefore = catalogRequests;
    await navigate(page, "usuarios");
    await expect(page.locator("#notice")).toContainText("rechazó la operación");
    expect(catalogRequests).toBeGreaterThan(requestsBefore);
    expect(await page.evaluate(() => localStorage.getItem("supaclothes.token"))).toBe("phase-two");
    expired = true;
    await page.locator("#refresh-users").click();
    await expect(page.locator("#login-message")).toContainText("expiró");
    expect(await page.evaluate(() => localStorage.getItem("supaclothes.token"))).toBeNull();
});

test("filtra catálogo e inventario y abre los editores bajo ADMIN", async ({ page }) => {
    await signIn(page, "ADMIN");
    await navigate(page, "productos");
    await page.locator("#filter-products").fill("cam-1");
    await expect(page.locator("#products-table")).toContainText("Algodón");
    await expect(page.locator("#products-table")).not.toContainText("CAM-2");
    await page.getByRole("button", { name: "Editar producto", exact: true }).click();
    await expect(page.locator("#product-edit-dialog input[name=description]")).toHaveValue("Algodón");
    await page.locator("#cancel-product-edit").click();
    await page.getByRole("button", { name: "Editar variante", exact: true }).click();
    await expect(page.locator("#variant-edit-dialog input[name=taxRate]")).toHaveValue("0.19");
    await page.locator("#cancel-variant-edit").click();
    await navigate(page, "inventario");
    await page.locator("#only-low-stock").check();
    await expect(page.locator("#inventory-table")).toContainText("CAM-1");
    await expect(page.locator("#inventory-table")).not.toContainText("CAM-2");
    await expect(page.locator("#inventory-form input[name=reference]")).toHaveAttribute("maxlength", "150");
});

test("registra cliente desde su apartado, consulta el día y descarga el PDF desde historial", async ({ page }) => {
    let registered;
    await signIn(page, "VENDEDOR", {
        "/api/sales/FAC-PARIDAD/return": (_, respond) => respond({}, 401),
        "/api/customers": (request, respond) => {
            if (request.method() === "POST") {
                registered = request.postDataJSON();
                return respond({ ...registered, id: 7 }, 201);
            }
            return respond(registered ? [{ ...registered, id: 7 }] : []);
        }
    });
    await navigate(page, "clientes");
    await page.getByRole("button", { name: "Registrar cliente" }).click();
    await page.getByLabel("Número de documento", { exact: true }).fill("987654321");
    await page.locator("#customer-dialog").getByLabel("Nombre", { exact: true }).fill("Martín Peña");
    await page.getByRole("button", { name: "Guardar cliente" }).click();
    await expect(page.locator("#customer-directory")).toContainText("••••4321");
    await expect(page.locator("#customer-directory")).not.toContainText("987654321");
    expect(registered.phone).toBe("");
    await navigate(page, "resumen-diario");
    await expect(page.locator("#daily-result")).toContainText("Neto");
    await navigate(page, "historial");
    await page.getByRole("button", { name: "Ver comprobante FAC-PARIDAD" }).click();
    await expect(page.locator("#return-form")).toBeVisible();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Descargar PDF" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe("FAC-PARIDAD.pdf");
    expect((await readFile(await file.path())).subarray(0, 5).toString()).toBe("%PDF-");
});

test("libera la venta rechazada y conserva la referencia si se pierde la respuesta", async ({ page }) => {
    const operations = [];
    await signIn(page, "VENDEDOR", {
        "/api/sales": (request, respond, route) => {
            operations.push(request.postDataJSON());
            if (operations.length === 1) return respond({ message: "Stock insuficiente" }, 409);
            if (operations.length === 2) return route.abort();
            return respond(receipt, 201);
        }
    });
    await navigate(page, "ventas");
    await page.locator("#filter-sale-sku").fill("cam-1");
    await page.locator("#sale-sku").selectOption("CAM-1");
    await page.getByRole("button", { name: "Agregar artículo" }).click();
    await page.locator("#amount-received").fill("290");
    await expect(page.locator("#change-estimate")).toContainText("no cubre");
    await page.locator("#amount-received").fill("300");
    await expect(page.locator("#change-estimate")).toContainText("2,50");
    await page.locator("#submit-sale").click();
    await expect(page.locator("#notice")).toContainText("Stock insuficiente");
    await expect(page.locator("#submit-sale")).toBeEnabled();
    await page.locator("#submit-sale").click();
    await expect(page.locator("#retry-sale")).toBeEnabled();
    await page.locator("#retry-sale").click();
    await expect(page.locator("#receipt-content")).toContainText("FAC-PARIDAD");
    expect(operations[0].idempotencyKey).not.toBe(operations[1].idempotencyKey);
    expect(operations[2]).toEqual(operations[1]);
});
