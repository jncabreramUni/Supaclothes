const { test, expect } = require("@playwright/test");

async function setup(page, role = "ADMIN") {
    const state = { returned: false, posts: 0 };
    await page.route("**/api/**", async route => {
        const request = route.request(), url = new URL(request.url()), path = url.pathname;
        const json = (data, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
        const day = url.searchParams.get("to") || "2026-10-27";
        if (path === "/api/auth/login") return json({token:"test-token",role,fullName:"Prueba sprint 2"});
        const stock = state.returned ? 5 : 3;
        if (path === "/api/products" || path === "/api/inventory") return json([{id:1,name:"Camisa",category:"Ropa",active:true,variants:[{id:1,sku:"CAM-1",size:"M",color:"Azul",price:100,taxRate:0.15,minStock:2,currentStock:stock,active:true}]}]);
        if (path === "/api/inventory/movements") return json([]);
        if (path === "/api/reports/dashboard") return json({from:url.searchParams.get("from"),to:day,salesCount:1,grossSales:207,refunds:state.returned?207:0,netSales:state.returned?0:207,stockUnits:stock,lowStockCount:0,daily:[{date:day,sales:207,refunds:state.returned?207:0,net:state.returned?0:207}]});
        if (path.endsWith("/export")) {
            expect(request.headers().authorization).toBe("Bearer test-token");
            return route.fulfill({contentType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",body:Buffer.from("PK\x03\x04fixture")});
        }
        if (path === "/api/reports/sales") return json({from:url.searchParams.get("from"),to:day,rows:[{receiptNumber:"FAC-TEST",createdAt:day+"T12:00:00",status:"VENTA",total:207,refundedTotal:0,netTotal:207}],grossSales:207,refunds:0,netSales:207});
        if (path === "/api/reports/inventory") return json({rows:[{sku:"CAM-1",productName:"Camisa",size:"M",color:"Azul",stock,minStock:2,price:100,active:true,lowStock:false}],stockUnits:stock,lowStockCount:0});
        if (path === "/api/sales/FAC-TEST/return") {
            if (request.method() === "POST") { state.posts++; expect(request.postDataJSON().reason).toBe("Talla incorrecta"); state.returned=true; }
            return state.returned ? json({id:1,saleId:1,receiptNumber:"FAC-TEST",reason:"Talla incorrecta",refundTotal:207,createdAt:"2026-10-27T15:00:00",userId:1}) : json({message:"Sin devolución"},404);
        }
        if (path === "/api/sales/FAC-TEST") return json({receiptNumber:"FAC-TEST",createdAt:"2026-10-27T12:00:00",sellerName:"Vendedor",items:[{sku:"CAM-1",productName:"Camisa",size:"M",color:"Azul",quantity:2,unitPrice:100,lineTotal:230}],subtotal:200,taxTotal:30,discountPercent:10,discountValue:23,total:207,paymentMethod:"EFECTIVO",amountReceived:210,changeGiven:3});
        if (path === "/api/sales") return json([{receiptNumber:"FAC-TEST",createdAt:"2026-10-27T12:00:00",total:207,status:state.returned?"DEVUELTA":"CONFIRMADA"}]);
        return json({message:"No encontrado"},404);
    });
    await page.goto("/");
    await page.locator("#login-username").fill("usuario"); await page.locator("#login-password").fill("password");
    await page.getByRole("button",{name:"Iniciar sesión"}).click();
    return state;
}

test("muestra los registros antes de los formularios de alta", async ({page}) => {
    await setup(page);
    const sections = [
        ["productos", "#products-table", "#product-form"],
        ["inventario", "#movements-table", "#inventory-form"],
        ["ventas", "#sales-history", "#sale-item-form"],
        ["usuarios", "#users-table", "#user-form"]
    ];

    for (const [section, recordsSelector, formSelector] of sections) {
        await page.locator(`nav [data-section="${section}"]`).click();
        const recordsBeforeForm = await page.evaluate(({recordsSelector, formSelector}) => {
            const records = document.querySelector(recordsSelector).closest(".content-card");
            const form = document.querySelector(formSelector).closest(".form-card");
            return Boolean(records.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING);
        }, {recordsSelector, formSelector});
        expect(recordsBeforeForm, `${section}: el listado debe aparecer antes del formulario`).toBe(true);
    }
});

test("ADMIN consulta dashboard, filtra reportes y descarga ventas e inventario", async ({page}) => {
    await setup(page);
    await expect(page.locator("#dashboard-count")).toHaveText("1");
    await expect(page.locator("#sales-chart .chart-day")).toHaveCount(1);
    await page.locator('nav [data-section="reportes"]').click();
    await page.locator('#report-form input[name="from"]').fill("2026-10-01");
    await page.locator('#report-form input[name="to"]').fill("2026-10-27");
    await page.getByRole("button",{name:"Consultar reporte"}).click();
    await expect(page.locator("#report-body")).toContainText("FAC-TEST");
    const download = page.waitForEvent("download"); await page.locator("#export-report").click();
    expect((await download).suggestedFilename()).toBe("ventas-2026-10-01-2026-10-27.xlsx");
    await page.locator("#report-type").selectOption("inventory");
    await expect(page.locator("#report-body")).toContainText("CAM-1");
    await expect(page.locator('#report-form input[name="from"]')).toBeDisabled();
    const inventory = page.waitForEvent("download"); await page.locator("#export-report").click();
    expect((await inventory).suggestedFilename()).toMatch(/^inventario-.*\.xlsx$/);
});

test("devolución desde comprobante restaura stock y no ofrece devolver dos veces", async ({page}) => {
    const state = await setup(page,"VENDEDOR");
    await expect(page.locator('nav [data-section="reportes"]')).toBeHidden();
    await page.locator('nav [data-section="ventas"]').click();
    await page.locator('#receipt-search input').fill("FAC-TEST"); await page.getByRole("button",{name:"Buscar comprobante"}).click();
    await expect(page.locator("#return-form")).toBeVisible();
    await page.locator('#return-form input[name="reason"]').fill("Talla incorrecta");
    page.once("dialog", dialog => dialog.accept()); await page.locator("#submit-return").click();
    await expect(page.locator("#return-status")).toContainText("Devolución registrada");
    await expect(page.locator("#return-form")).toBeHidden(); await expect(page.locator("#receipt-content")).toContainText("VENTA DEVUELTA");
    await page.locator("#close-receipt").click();
    await page.getByRole("button",{name:"Buscar comprobante"}).click(); await expect(page.locator("#return-form")).toBeHidden();
    expect(state.posts).toBe(1);
    await page.locator("#close-receipt").click(); await page.locator('nav [data-section="inventario"]').click();
    await expect(page.locator("#inventory-table tr").first()).toContainText("5");
});

test("dashboard móvil en tema oscuro y rango inválido", async ({page},testInfo) => {
    await page.setViewportSize({width:390,height:844}); await setup(page);
    await page.locator("#theme-choice").selectOption("dark");
    await expect(page.locator("#dashboard-results")).toBeVisible();
    await page.screenshot({path:testInfo.outputPath("dashboard-mobile.png"),fullPage:true});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('#dashboard-form input[name="from"]').fill("2026-10-28");
    await page.locator('#dashboard-form input[name="to"]').fill("2026-10-27");
    await page.getByRole("button",{name:"Actualizar indicadores"}).click();
    await expect(page.locator("#dashboard-message")).toContainText("rango válido");
});

test("HU-16 conserva preferencias y mantiene contraste y foco visibles", async ({page}) => {
    await page.setViewportSize({width:320,height:740});
    await setup(page);
    const lightContrast = await page.evaluate(() => {
        const luminance = color => {
            const channels = color.match(/\d+/g).slice(0,3).map(Number).map(value => value / 255);
            const linear = channels.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
            return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
        };
        const ratio = (foreground, background) => {
            const values = [luminance(foreground), luminance(background)].sort((a,b) => b-a);
            return (values[0] + 0.05) / (values[1] + 0.05);
        };
        const small = document.querySelector(".stat-card small");
        const card = small.closest(".stat-card");
        const header = document.querySelector("#products-table").closest("table").querySelector("th");
        return Math.min(
            ratio(getComputedStyle(small).color, getComputedStyle(card).backgroundColor),
            ratio(getComputedStyle(header).color, getComputedStyle(header).backgroundColor)
        );
    });
    expect(lightContrast).toBeGreaterThanOrEqual(4.5);

    await page.locator("#theme-choice").selectOption("dark");
    await page.locator("#text-choice").selectOption("large");

    await page.locator("#theme-choice").focus();
    await page.keyboard.press("Tab");
    await expect(page.locator("#text-choice")).toBeFocused();
    await expect(page.locator("#text-choice")).toHaveCSS("outline-style","solid");

    const contrast = await page.evaluate(() => {
        const luminance = color => {
            const channels = color.match(/\d+/g).slice(0,3).map(Number).map(value => value / 255);
            const linear = channels.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
            return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
        };
        const button = getComputedStyle(document.querySelector("#submit-sale"));
        const values = [luminance(button.color), luminance(button.backgroundColor)].sort((a,b) => b-a);
        return (values[0] + 0.05) / (values[1] + 0.05);
    });
    expect(contrast).toBeGreaterThanOrEqual(4.5);

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme","dark");
    await expect(page.locator("html")).toHaveAttribute("data-text","large");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
