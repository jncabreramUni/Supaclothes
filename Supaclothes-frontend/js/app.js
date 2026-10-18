const API = "/api";
const cart = [];
let products = [];
let users = [];
let noticeTimer;
let currentReceipt;

function getRole() {
    return localStorage.getItem("supaclothes.role");
}

async function setProductStatus(path, message) {
    try {
        await api(path, { method: "PATCH" });
        showNotice(message);
        await refreshProducts();
    } catch (error) {
        showNotice(error.message, true);
    }
}

async function deactivateProductVariant(product, variant) {
    if (!window.confirm(`¿Desactivar la variante "${variant.sku}"?`)) {
        return;
    }
    try {
        await api(`/products/${product.id}/variants/${variant.id}/deactivate`, { method: "PATCH" });
        showNotice(`Variante "${variant.sku}" desactivada.`);
        await refreshProducts();
    } catch (error) {
        showNotice(error.message, true);
    }
}

const loginView = document.querySelector("#login-view");
const appShell = document.querySelector("#app-shell");
const notice = document.querySelector("#notice");

function showNotice(message, isError = false) {
    window.clearTimeout(noticeTimer);
    notice.textContent = message;
    notice.classList.toggle("error", isError);
    notice.hidden = false;
    noticeTimer = window.setTimeout(() => { notice.hidden = true; }, 5000);
}

function setAuthenticated(isAuthenticated) {
    loginView.hidden = isAuthenticated;
    appShell.hidden = !isAuthenticated;
    if (isAuthenticated) {
        document.querySelector("#current-user").textContent =
            localStorage.getItem("supaclothes.fullName") || localStorage.getItem("supaclothes.username") || "Usuario";
        const role = getRole();
        document.querySelector("#current-role").textContent = role || "";
        document.querySelector('[data-section="usuarios"]').hidden = role !== "ADMIN";
        document.querySelectorAll('[data-section="ventas"]').forEach(button => {
            button.hidden = role === "BODEGA";
        });
        document.querySelector("#product-form").closest(".form-card").hidden = role !== "ADMIN";
        document.querySelector("#inventory-form").closest(".form-card").hidden = !["ADMIN", "BODEGA"].includes(role);
    }
}

function getToken() {
    return localStorage.getItem("supaclothes.token");
}

function logout(message) {
    localStorage.removeItem("supaclothes.token");
    localStorage.removeItem("supaclothes.username");
    localStorage.removeItem("supaclothes.role");
    localStorage.removeItem("supaclothes.fullName");
    cart.length = 0;
    renderCart();
    setAuthenticated(false);
    if (message) {
        document.querySelector("#login-message").textContent = message;
    }
}

async function api(path, options = {}) {
    const token = getToken();
    const headers = { Accept: "application/json", ...options.headers };
    if (options.body !== undefined) {
        headers["Content-Type"] = "application/json";
    }
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API}${path}`, { ...options, headers });
    const contentType = response.headers.get("content-type") || "";
    const result = contentType.includes("application/json")
        ? await response.json()
        : await response.text();

    if (response.status === 401 && token) {
        logout("Tu sesión expiró. Inicia sesión nuevamente.");
    }
    if (!response.ok) {
        const message = typeof result === "string"
            ? result
            : result.message || result.error || `Error ${response.status}`;
        throw new Error(message);
    }
    return result;
}

function setEmptyRow(tbody, colspan, message) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = colspan;
    cell.className = "empty-cell";
    cell.textContent = message;
    row.append(cell);
    tbody.replaceChildren(row);
}

function addCell(row, value) {
    const cell = document.createElement("td");
    cell.textContent = value ?? "—";
    row.append(cell);
    return cell;
}

function addState(cell, text, active) {
    const badge = document.createElement("span");
    badge.className = `state ${active ? "state-active" : "state-inactive"}`;
    badge.textContent = text;
    cell.replaceChildren(badge);
}

function formatMoney(value) {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP" }).format(Number(value || 0));
}

async function refreshProducts() {
    products = await api("/products");
    renderProducts();
    renderInventory();
    renderDashboard();
    renderSaleOptions();
}

async function refreshInventory() {
    products = await api("/inventory");
    renderInventory();
    renderDashboard();
}

async function refreshMovements() {
    const movements = await api("/inventory/movements");
    const tbody = document.querySelector("#movements-table");
    tbody.replaceChildren();
    if (!movements.length) {
        setEmptyRow(tbody, 8, "No hay movimientos registrados.");
        return;
    }
    const variants = new Map(products.flatMap(product => (product.variants || []).map(variant => [variant.id, variant.sku])));
    movements.forEach(movement => {
        const row = document.createElement("tr");
        addCell(row, movement.createdAt ? new Date(movement.createdAt).toLocaleString("es-CO") : "—");
        addCell(row, movement.sku || variants.get(movement.variantId) || movement.variantId);
        addCell(row, movement.type);
        addCell(row, movement.quantity);
        addCell(row, movement.previousStock);
        addCell(row, movement.resultingStock);
        addCell(row, movement.username);
        addCell(row, movement.reference);
        tbody.append(row);
    });
}

function renderProducts() {
    const tbody = document.querySelector("#products-table");
    tbody.replaceChildren();
    const variants = products.flatMap(product => (product.variants || []).map(variant => ({ product, variant })));
    if (!variants.length) {
        setEmptyRow(tbody, 8, "No hay productos registrados.");
        return;
    }

    variants.forEach(({ product, variant }) => {
        const row = document.createElement("tr");
        addCell(row, product.name);
        addCell(row, product.category);
        addCell(row, variant.sku);
        addCell(row, `${variant.size} / ${variant.color}`);
        addCell(row, formatMoney(variant.price));
        addCell(row, variant.currentStock);
        const stateCell = addCell(row, "");
        addState(stateCell, product.active && variant.active ? "Activo" : "Inactivo", product.active && variant.active);
        const actionCell = document.createElement("td");
        if (getRole() === "ADMIN") {
            const editProduct = document.createElement("button");
            editProduct.className = "table-action";
            editProduct.type = "button";
            editProduct.textContent = "Editar producto";
            editProduct.addEventListener("click", () => openProductEditor(product));
            actionCell.append(editProduct);

            const editVariant = document.createElement("button");
            editVariant.className = "table-action";
            editVariant.type = "button";
            editVariant.textContent = "Editar variante";
            editVariant.addEventListener("click", () => openVariantEditor(product, variant));
            actionCell.append(editVariant);
            if (variant.active) {
                const deactivateVariant = document.createElement("button");
                deactivateVariant.className = "table-action";
                deactivateVariant.type = "button";
                deactivateVariant.textContent = "Desactivar variante";
                deactivateVariant.addEventListener("click", () => deactivateProductVariant(product, variant));
                actionCell.append(deactivateVariant);
            } else if (product.active) {
                const activateVariant = document.createElement("button");
                activateVariant.className = "table-action";
                activateVariant.type = "button";
                activateVariant.textContent = "Activar variante";
                activateVariant.addEventListener("click", () => setProductStatus(
                    `/products/${product.id}/variants/${variant.id}/activate`,
                    `Variante "${variant.sku}" activada.`
                ));
                actionCell.append(activateVariant);
            }

            if (product.active) {
                const addVariant = document.createElement("button");
                addVariant.className = "table-action";
                addVariant.type = "button";
                addVariant.textContent = "Agregar variante";
                addVariant.addEventListener("click", () => openVariantEditor(product));
                actionCell.append(addVariant);
                const deactivate = document.createElement("button");
                deactivate.className = "table-action";
                deactivate.type = "button";
                deactivate.textContent = "Desactivar";
                deactivate.addEventListener("click", () => deactivateProduct(product.id, product.name));
                actionCell.append(deactivate);
            } else {
                const activate = document.createElement("button");
                activate.className = "table-action";
                activate.type = "button";
                activate.textContent = "Activar producto";
                activate.addEventListener("click", () => setProductStatus(
                    `/products/${product.id}/activate`,
                    `Producto "${product.name}" activado.`
                ));
                actionCell.append(activate);
            }
        }
        row.append(actionCell);
        tbody.append(row);
    });
}

function renderInventory() {
    const tbody = document.querySelector("#inventory-table");
    tbody.replaceChildren();
    const variants = products.flatMap(product => (product.variants || []).map(variant => ({ product, variant })));
    if (!variants.length) {
        setEmptyRow(tbody, 7, "No hay variantes para mostrar.");
        return;
    }

    variants.forEach(({ product, variant }) => {
        const row = document.createElement("tr");
        addCell(row, product.name);
        addCell(row, variant.sku);
        addCell(row, variant.size);
        addCell(row, variant.color);
        addCell(row, variant.currentStock);
        addCell(row, variant.minStock);
        const lowStock = Number(variant.currentStock) <= Number(variant.minStock);
        const stateCell = addCell(row, "");
        const badge = document.createElement("span");
        badge.className = `state ${lowStock ? "state-low" : "state-stock"}`;
        badge.textContent = lowStock ? "Stock bajo" : "Disponible";
        stateCell.replaceChildren(badge);
        tbody.append(row);
    });
}

function renderDashboard() {
    const activeProducts = products.filter(product => product.active);
    const variants = activeProducts.flatMap(product => (product.variants || []).filter(variant => variant.active));
    document.querySelector("#stat-products").textContent = activeProducts.length;
    document.querySelector("#stat-variants").textContent = variants.length;
    document.querySelector("#stat-low-stock").textContent = variants.filter(variant => Number(variant.currentStock) <= Number(variant.minStock)).length;
}

function renderSaleOptions() {
    const select = document.querySelector("#sale-sku");
    const previousValue = select.value;
    select.replaceChildren(new Option("Selecciona un SKU", ""));
    products
        .filter(product => product.active)
        .forEach(product => (product.variants || [])
            .filter(variant => variant.active)
            .forEach(variant => {
                const option = new Option(
                    `${variant.sku} — ${product.name} (${variant.size}, ${variant.color}) · stock ${variant.currentStock}`,
                    variant.sku
                );
                select.add(option);
            }));
    if ([...select.options].some(option => option.value === previousValue)) {
        select.value = previousValue;
    }
}

async function deactivateProduct(id, name) {
    if (!window.confirm(`¿Desactivar "${name}" y sus variantes?`)) {
        return;
    }

    function openProductEditor(product) {
        const form = document.querySelector("#product-edit-form");
        form.elements.id.value = product.id;
        form.elements.name.value = product.name;
        form.elements.category.value = product.category;
        form.elements.description.value = product.description || "";
        document.querySelector("#product-edit-dialog").showModal();
    }

    function openVariantEditor(product, variant = null) {
        const form = document.querySelector("#variant-edit-form");
        form.reset();
        form.elements.productId.value = product.id;
        form.elements.variantId.value = variant?.id || "";
        form.elements.sku.value = variant?.sku || "";
        form.elements.size.value = variant?.size || "";
        form.elements.color.value = variant?.color || "";
        form.elements.price.value = variant?.price ?? "";
        form.elements.taxRate.value = variant?.taxRate ?? "0.15";
        form.elements.minStock.value = variant?.minStock ?? "0";
        document.querySelector("#variant-dialog-title").textContent = variant ? "Editar variante" : "Agregar variante";
        document.querySelector("#variant-edit-dialog").showModal();
    }
    try {
        await api(`/products/${id}/deactivate`, { method: "PATCH" });
        showNotice(`Producto "${name}" desactivado.`);
        await refreshProducts();
    } catch (error) {
        showNotice(error.message, true);
    }
}

async function refreshUsers() {
    users = await api("/users");
    const tbody = document.querySelector("#users-table");
    tbody.replaceChildren();
    if (!users.length) {
        setEmptyRow(tbody, 5, "No hay usuarios registrados.");
        return;
    }
    users.forEach(user => {
        const row = document.createElement("tr");
        addCell(row, user.fullName);
        addCell(row, user.username);
        addCell(row, user.role);
        const stateCell = addCell(row, "");
        addState(stateCell, user.active ? "Activo" : "Inactivo", user.active);
        const actionCell = document.createElement("td");
        if (user.active && user.username !== localStorage.getItem("supaclothes.username")) {
            const button = document.createElement("button");
            button.className = "table-action";
            button.type = "button";
            button.textContent = "Desactivar";
            button.addEventListener("click", () => deactivateUser(user.id, user.username));
            actionCell.append(button);
        }
        row.append(actionCell);
        tbody.append(row);
    });
}

async function deactivateUser(id, username) {
    if (!window.confirm(`¿Desactivar el acceso de "${username}"?`)) {
        return;
    }
    try {
        await api(`/users/${id}/deactivate`, { method: "PATCH" });
        showNotice(`Usuario "${username}" desactivado.`);
        await refreshUsers();
    } catch (error) {
        showNotice(error.message, true);
    }
}

function renderCart() {
    const tbody = document.querySelector("#cart-table");
    tbody.replaceChildren();
    document.querySelector("#cart-empty").hidden = cart.length > 0;
    document.querySelector("#submit-sale").disabled = cart.length === 0;
    updateSaleEstimate();
    if (!cart.length) {
        setEmptyRow(tbody, 6, "Agrega artículos para iniciar la venta.");
        return;
    }

    cart.forEach((item, index) => {
        const row = document.createElement("tr");
        addCell(row, item.sku);
        addCell(row, item.productName);
        addCell(row, `${item.size} / ${item.color}`);
        addCell(row, formatMoney(item.price));
        addCell(row, item.quantity);
        const actionCell = document.createElement("td");
        const button = document.createElement("button");
        button.className = "table-action";
        button.type = "button";
        button.textContent = "Quitar";
        button.addEventListener("click", () => {
            cart.splice(index, 1);
            renderCart();
        });
        actionCell.append(button);
        row.append(actionCell);
        tbody.append(row);
    });
}

function estimatedTotal() {
    return cart.reduce((sum, item) => {
        const lineSubtotal = Number(item.price) * item.quantity;
        return sum + Math.round(lineSubtotal * 100) / 100
            + Math.round(lineSubtotal * Number(item.taxRate) * 100) / 100;
    }, 0);
}

function updateSaleEstimate() {
    const total = estimatedTotal();
    const method = document.querySelector("#payment-method").value;
    const received = document.querySelector("#amount-received");
    document.querySelector("#sale-estimate").textContent = `Total estimado: ${formatMoney(total)}`;
    received.readOnly = method !== "EFECTIVO";
    if (method !== "EFECTIVO") {
        received.value = total.toFixed(2);
    }
    const change = Math.max(0, Number(received.value || 0) - total);
    document.querySelector("#change-estimate").textContent = method === "EFECTIVO"
        ? `Cambio estimado: ${formatMoney(change)}`
        : "El pago electrónico debe coincidir exactamente con el total.";
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
}

function receiptMarkup(receipt) {
    const rows = receipt.items.map(item => `<tr>
        <td>${escapeHtml(item.sku)}<br>${escapeHtml(item.productName)} (${escapeHtml(item.size)} / ${escapeHtml(item.color)})</td>
        <td>${item.quantity}</td><td>${formatMoney(item.unitPrice)}</td><td>${formatMoney(item.lineTotal)}</td>
    </tr>`).join("");
    return `<h2>SupaClothes</h2>
        <p><strong>Comprobante:</strong> ${escapeHtml(receipt.receiptNumber)}</p>
        <p><strong>Fecha:</strong> ${escapeHtml(new Date(receipt.createdAt).toLocaleString("es-CO"))}</p>
        <p><strong>Vendedor:</strong> ${escapeHtml(receipt.sellerName)}</p>
        <table><thead><tr><th>Artículo</th><th>Cant.</th><th>Unitario</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>
        <p>Subtotal: ${formatMoney(receipt.subtotal)}</p>
        <p>Impuestos: ${formatMoney(receipt.taxTotal)}</p>
        <p><strong>Total: ${formatMoney(receipt.total)}</strong></p>
        <p>Pago: ${escapeHtml(receipt.paymentMethod)} · Recibido: ${formatMoney(receipt.amountReceived)} · Cambio: ${formatMoney(receipt.changeGiven)}</p>`;
}

async function loadReceipt(receiptNumber) {
    currentReceipt = await api(`/sales/${encodeURIComponent(receiptNumber)}`);
    document.querySelector("#receipt-content").innerHTML = receiptMarkup(currentReceipt);
    document.querySelector("#receipt-dialog").showModal();
}

function receiptDocument() {
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Comprobante ${escapeHtml(currentReceipt.receiptNumber)}</title>
        <style>body{font:14px Arial,sans-serif;max-width:760px;margin:32px auto;color:#162235}table{width:100%;border-collapse:collapse;margin:20px 0}th,td{text-align:left;padding:8px;border-bottom:1px solid #ddd}h2{margin-bottom:6px}@media print{body{margin:0}}</style>
        </head><body>${receiptMarkup(currentReceipt)}</body></html>`;
}

function downloadReceipt() {
    const file = new Blob([receiptDocument()], { type: "text/html;charset=utf-8" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(file);
    link.href = url;
    link.download = `${currentReceipt.receiptNumber}.html`;
    link.click();
    URL.revokeObjectURL(url);
}

function printReceipt() {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
        showNotice("El navegador bloqueó la ventana de impresión. Permite ventanas emergentes para este sitio.", true);
        return;
    }
    printWindow.document.write(receiptDocument());
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
}

function showSection(name) {
    const role = getRole();
    if ((name === "usuarios" && role !== "ADMIN") || (name === "ventas" && role === "BODEGA")) {
        showNotice("Tu rol no tiene acceso a esa sección.", true);
        return;
    }
    document.querySelectorAll(".page-section").forEach(section => {
        section.hidden = section.id !== `section-${name}`;
    });
    document.querySelectorAll(".nav-link[data-section]").forEach(button => {
        button.classList.toggle("active", button.dataset.section === name);
    });
    const titles = { inicio: "Resumen", productos: "Productos", inventario: "Inventario", ventas: "Ventas", usuarios: "Usuarios" };
    document.querySelector("#page-title").textContent = titles[name] || "SupaClothes";

    if (name === "productos" || name === "ventas") {
        refreshProducts().catch(error => showNotice(error.message, true));
    } else if (name === "inventario") {
        refreshInventory().catch(error => showNotice(error.message, true));
        refreshMovements().catch(error => showNotice(error.message, true));
    } else if (name === "usuarios") {
        refreshUsers().catch(error => showNotice(error.message, true));
    } else if (name === "inicio") {
        refreshProducts().catch(error => showNotice(error.message, true));
    }
}

document.querySelector("#login-form").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const message = document.querySelector("#login-message");
    message.textContent = "";
    const data = new FormData(form);
    try {
        const response = await api("/auth/login", {
            method: "POST",
            body: JSON.stringify({ username: data.get("username"), password: data.get("password") })
        });
        localStorage.setItem("supaclothes.token", response.token);
        localStorage.setItem("supaclothes.username", data.get("username"));
        localStorage.setItem("supaclothes.role", response.role);
        localStorage.setItem("supaclothes.fullName", response.fullName);
        form.reset();
        setAuthenticated(true);
        showSection("inicio");
    } catch (error) {
        message.textContent = error.message;
    }
});

document.querySelector("#logout-button").addEventListener("click", () => logout());

document.querySelectorAll("[data-section]").forEach(button => {
    button.addEventListener("click", event => {
        event.preventDefault();
        showSection(button.dataset.section);
    });
});

document.querySelector("#refresh-products").addEventListener("click", async () => {
    try {
        await refreshProducts();
        showNotice("Catálogo actualizado.");
    } catch (error) {
        showNotice(error.message, true);
    }
});

document.querySelector("#refresh-inventory").addEventListener("click", async () => {
    try {
        await refreshProducts();
        await refreshMovements();
        showNotice("Existencias actualizadas.");
    } catch (error) {
        showNotice(error.message, true);
    }
});

document.querySelector("#refresh-users").addEventListener("click", async () => {
    try {
        await refreshUsers();
        showNotice("Usuarios actualizados.");
    } catch (error) {
        showNotice(error.message, true);
    }
});

document.querySelector("#user-form").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const request = {
        fullName: data.get("fullName").trim(),
        username: data.get("username").trim(),
        password: data.get("password"),
        roleName: data.get("roleName")
    };

    try {
        await api("/users", { method: "POST", body: JSON.stringify(request) });
        form.reset();
        showNotice(`Usuario "${request.username}" creado correctamente.`);
        await refreshUsers();
    } catch (error) {
        showNotice(error.message, true);
    }
});

document.querySelector("#product-form").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const request = {
        name: data.get("name").trim(),
        category: data.get("category").trim(),
        description: data.get("description").trim(),
        variants: [...document.querySelectorAll(".variant-input-row")].map(row => ({
            sku: row.querySelector(".variant-sku").value.trim(),
            size: row.querySelector(".variant-size").value.trim(),
            color: row.querySelector(".variant-color").value.trim(),
            price: Number(row.querySelector(".variant-price").value),
            taxRate: Number(row.querySelector(".variant-tax").value),
            minStock: Number(row.querySelector(".variant-min-stock").value)
        }))
    };
    try {
        await api("/products", { method: "POST", body: JSON.stringify(request) });
        form.reset();
        document.querySelectorAll(".variant-input-row:not(:first-child)").forEach(row => row.remove());
        showNotice("Producto creado correctamente.");
        await refreshProducts();
    } catch (error) {
        showNotice(error.message, true);
    }
});

document.querySelector("#add-variant-row").addEventListener("click", () => {
    const rows = document.querySelector("#variant-rows");
    const row = rows.querySelector(".variant-input-row").cloneNode(true);
    row.querySelectorAll("input").forEach(input => {
        input.value = input.classList.contains("variant-tax") ? "0.15"
            : input.classList.contains("variant-min-stock") ? "0" : "";
    });
    rows.append(row);
});

document.querySelector("#product-edit-form").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const id = form.elements.id.value;
    try {
        await api(`/products/${id}`, {
            method: "PUT",
            body: JSON.stringify({
                name: form.elements.name.value.trim(),
                category: form.elements.category.value.trim(),
                description: form.elements.description.value.trim()
            })
        });
        document.querySelector("#product-edit-dialog").close();
        showNotice("Producto actualizado.");
        await refreshProducts();
    } catch (error) {
        showNotice(error.message, true);
    }
});

document.querySelector("#variant-edit-form").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const productId = form.elements.productId.value;
    const variantId = form.elements.variantId.value;
    const request = {
        sku: form.elements.sku.value.trim(),
        size: form.elements.size.value.trim(),
        color: form.elements.color.value.trim(),
        price: Number(form.elements.price.value),
        taxRate: Number(form.elements.taxRate.value),
        minStock: Number(form.elements.minStock.value)
    };
    try {
        await api(variantId ? `/products/${productId}/variants/${variantId}` : `/products/${productId}/variants`, {
            method: variantId ? "PUT" : "POST",
            body: JSON.stringify(request)
        });
        document.querySelector("#variant-edit-dialog").close();
        showNotice(variantId ? "Variante actualizada." : "Variante agregada.");
        await refreshProducts();
    } catch (error) {
        showNotice(error.message, true);
    }
});

document.querySelector("#cancel-product-edit").addEventListener("click", () => {
    document.querySelector("#product-edit-dialog").close();
});
document.querySelector("#cancel-variant-edit").addEventListener("click", () => {
    document.querySelector("#variant-edit-dialog").close();
});

document.querySelector("#inventory-form").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const request = {
        sku: data.get("sku").trim(),
        quantity: Number(data.get("quantity")),
        reference: data.get("reference").trim()
    };
    try {
        await api("/inventory/entries", { method: "POST", body: JSON.stringify(request) });
        form.reset();
        showNotice(`Entrada de ${request.quantity} unidades registrada para ${request.sku}.`);
        await refreshInventory();
        await refreshMovements();
    } catch (error) {
        showNotice(error.message, true);
    }
});

document.querySelector("#sale-item-form").addEventListener("submit", event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const sku = data.get("sku");
    const quantity = Number(data.get("quantity"));
    const match = products
        .filter(product => product.active)
        .flatMap(product => (product.variants || []).map(variant => ({ product, variant })))
        .find(({ variant }) => variant.sku === sku && variant.active);
    if (!match) {
        showNotice("El SKU seleccionado ya no está disponible. Actualiza el catálogo.", true);
        return;
    }
    const existing = cart.find(item => item.sku === sku);
    const requestedQuantity = quantity + (existing ? existing.quantity : 0);
    if (requestedQuantity > Number(match.variant.currentStock)) {
        showNotice(`Stock insuficiente para ${sku}. Disponible: ${match.variant.currentStock}.`, true);
        return;
    }
    if (existing) {
        existing.quantity = requestedQuantity;
    } else {
        cart.push({
            sku,
            quantity,
            productName: match.product.name,
            size: match.variant.size,
            color: match.variant.color,
            price: match.variant.price,
            taxRate: match.variant.taxRate
        });
    }
    event.currentTarget.reset();
    renderCart();
});

document.querySelector("#payment-method").addEventListener("change", updateSaleEstimate);
document.querySelector("#amount-received").addEventListener("input", updateSaleEstimate);

document.querySelector("#submit-sale").addEventListener("click", async () => {
    const result = document.querySelector("#sale-result");
    result.textContent = "";
    const paymentMethod = document.querySelector("#payment-method").value;
    const amountReceived = Number(document.querySelector("#amount-received").value);
    const total = estimatedTotal();
    if (paymentMethod === "EFECTIVO" && amountReceived < total) {
        showNotice("El efectivo recibido no cubre el total.", true);
        return;
    }
    try {
        const sale = await api("/sales", {
            method: "POST",
            body: JSON.stringify({
                customerId: null,
                items: cart.map(({ sku, quantity }) => ({ sku, quantity })),
                paymentMethod,
                amountReceived
            })
        });
        result.textContent = `Venta registrada · Comprobante ${sale.receiptNumber} · Total ${formatMoney(sale.total)}.`;
        document.querySelector("#receipt-search").elements.receiptNumber.value = sale.receiptNumber;
        cart.length = 0;
        renderCart();
        await refreshProducts();
        await refreshMovements();
        try {
            await loadReceipt(sale.receiptNumber);
        } catch (error) {
            showNotice(`Venta registrada, pero no se pudo cargar el comprobante: ${error.message}`, true);
        }
    } catch (error) {
        showNotice(error.message, true);
    }
});

document.querySelector("#receipt-search").addEventListener("submit", async event => {
    event.preventDefault();
    const receiptNumber = new FormData(event.currentTarget).get("receiptNumber").trim();
    try {
        await loadReceipt(receiptNumber);
    } catch (error) {
        showNotice(error.message, true);
    }
});

document.querySelector("#download-receipt").addEventListener("click", downloadReceipt);
document.querySelector("#print-receipt").addEventListener("click", printReceipt);
document.querySelector("#close-receipt").addEventListener("click", () => {
    document.querySelector("#receipt-dialog").close();
});

setAuthenticated(Boolean(getToken()));
renderCart();
if (getToken() && !getRole()) {
    logout("Inicia sesión nuevamente para cargar los permisos de tu rol.");
} else if (getToken()) {
    showSection("inicio");
}
