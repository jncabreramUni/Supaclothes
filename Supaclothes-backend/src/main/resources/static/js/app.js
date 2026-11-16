const API = "/api";
const cart = [];
let products = [];
let users = [];
let noticeTimer;
let currentReceipt;
let currentReturn = null;
let receiptLoadVersion = 0;
let reportLoadVersion = 0;
let dashboardLoadVersion = 0;
let adminLoginMode = false;
let pendingSaleOperation = null;
let pendingSaleOperationWarning = "";
let recoveringSaleOperation = false;
let submittingSale = false;
let mayDiscardPendingSale = false;
let sessionCheck;
let activeSection;
let customerFormOrigin;
const queryVersions = { directory: 0, sale: 0, history: 0, daily: 0 };

const staff = ["ADMIN", "VENDEDOR", "BODEGA"];
const salesRoles = ["ADMIN", "VENDEDOR"];
const sections = {
    inicio: { title: "Resumen", roles: staff },
    productos: { title: "Productos", roles: staff },
    inventario: { title: "Inventario", roles: staff },
    ventas: { title: "Ventas", roles: salesRoles },
    clientes: { title: "Clientes", roles: salesRoles },
    historial: { title: "Historial de ventas", roles: salesRoles },
    "resumen-diario": { title: "Resumen diario", roles: salesRoles },
    reportes: { title: "Reportes", roles: ["ADMIN"] },
    usuarios: { title: "Usuarios", roles: ["ADMIN"] },
    ajustes: { title: "Ajustes", roles: staff }
};

try {
    pendingSaleOperation = JSON.parse(sessionStorage.getItem("supaclothes.pendingSaleOperation") || "null");
} catch {
    sessionStorage.removeItem("supaclothes.pendingSaleOperation");
    pendingSaleOperationWarning = "No se pudo recuperar la referencia de una venta pendiente. Verifica el historial antes de registrarla otra vez.";
}

function getRole() {
    return localStorage.getItem("supaclothes.role");
}

function canOpenSection(name, role = getRole()) {
    return Boolean(getToken() && Object.hasOwn(sections, name) && sections[name].roles.includes(role));
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
    noticeTimer = window.setTimeout(() => { notice.textContent = ""; }, 5000);
}

function renderPersonalizedHome() {
    const role = getRole();
    const fullName = localStorage.getItem("supaclothes.fullName")
        || localStorage.getItem("supaclothes.username")
        || "Usuario";
    const firstName = fullName.trim().split(/\s+/)[0];
    const profiles = {
        ADMIN: {
            description: "Administra el catálogo, revisa los resultados de la tienda y gestiona los accesos del equipo.",
            actions: [
                ["▥", "Consultar reportes", "Revisa ventas, devoluciones e inventario.", "reportes"],
                ["▦", "Gestionar productos", "Actualiza el catálogo y sus variantes.", "productos"],
                ["♙", "Administrar usuarios", "Gestiona las cuentas y sus permisos.", "usuarios"],
                ["◷", "Resumen diario", "Consulta ventas y devoluciones por fecha.", "resumen-diario"]
            ]
        },
        VENDEDOR: {
            description: "Atiende a tus clientes, registra ventas y consulta el catálogo disponible.",
            actions: [
                ["↗", "Registrar venta", "Agrega productos y procesa el pago.", "ventas"],
                ["▦", "Consultar productos", "Busca productos, precios y variantes.", "productos"],
                ["♧", "Clientes", "Busca por nombre o documento.", "clientes"],
                ["◷", "Resumen diario", "Consulta ventas y devoluciones por fecha.", "resumen-diario"],
                ["▤", "Consultar inventario", "Verifica las existencias disponibles.", "inventario"]
            ]
        },
        BODEGA: {
            description: "Controla las existencias, registra entradas y consulta los productos de la tienda.",
            actions: [
                ["▤", "Registrar inventario", "Registra las unidades recibidas.", "inventario"],
                ["▦", "Consultar productos", "Revisa el catálogo y las variantes.", "productos"],
                ["↻", "Revisar existencias", "Consulta stock y movimientos recientes.", "inventario"]
            ]
        }
    };
    const profile = profiles[role] || {
        description: "Consulta las funciones disponibles para tu cuenta.",
        actions: [["▦", "Ver productos", "Consulta el catálogo y sus variantes.", "productos"]]
    };

    document.querySelector("#welcome-title").textContent = `Hola, ${firstName}`;
    document.querySelector("#welcome-description").textContent = profile.description;
    document.querySelector("#quick-actions-eyebrow").textContent = `INICIO RÁPIDO · ${role || "USUARIO"}`;
    const actions = document.querySelector("#quick-actions");
    actions.replaceChildren();
    profile.actions.forEach(([icon, title, description, section]) => {
        const button = document.createElement("button");
        button.className = "quick-action";
        button.type = "button";
        button.dataset.section = section;
        const symbol = document.createElement("span");
        symbol.setAttribute("aria-hidden", "true");
        symbol.textContent = icon;
        const heading = document.createElement("strong");
        heading.textContent = title;
        const detail = document.createElement("small");
        detail.textContent = description;
        button.append(symbol, heading, detail);
        button.addEventListener("click", () => showSection(section));
        actions.append(button);
    });
}

function setAuthenticated(isAuthenticated) {
    loginView.hidden = isAuthenticated;
    appShell.hidden = !isAuthenticated;
    if (isAuthenticated) {
        const username = localStorage.getItem("supaclothes.username");
        const fullName = localStorage.getItem("supaclothes.fullName") || username || "Usuario";
        document.querySelector("#current-user").textContent = fullName;
        document.querySelector("#profile-name").textContent = fullName;
        const role = getRole();
        renderPersonalizedHome();
        document.querySelector("#current-role").textContent = role || "";
        document.querySelector("#profile-account").textContent = [username, role].filter(Boolean).join(" · ");
        document.querySelectorAll("nav [data-section]").forEach(button => {
            button.hidden = !canOpenSection(button.dataset.section, role);
        });
        document.querySelector("#sales-dashboard").hidden = role !== "ADMIN";
        document.querySelector("#sale-discount-field").hidden = role !== "ADMIN";
        document.querySelector("#sale-discount").disabled = role !== "ADMIN";
        if (role !== "ADMIN") document.querySelector("#sale-discount").value = 0;
        document.querySelector("#product-form").closest(".form-card").hidden = role !== "ADMIN";
        document.querySelector("#inventory-form").closest(".form-card").hidden = !["ADMIN", "BODEGA"].includes(role);
    }
}

function getToken() {
    return localStorage.getItem("supaclothes.token");
}

async function logout(message, revokeToken = true) {
    const token = getToken();
    if (token && revokeToken) {
        try {
            const response = await fetch(`${API}/auth/logout`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!response.ok) throw new Error(`Error ${response.status}`);
        } catch (error) {
            message = `Se cerró la sesión en este navegador, pero no se pudo revocar en el servidor (${error.message}).`;
        }
    }
    if (token !== getToken()) return;
    localStorage.removeItem("supaclothes.token");
    localStorage.removeItem("supaclothes.username");
    localStorage.removeItem("supaclothes.role");
    localStorage.removeItem("supaclothes.fullName");
    cart.length = 0;
    currentReceipt = null;
    currentReturn = null;
    activeSection = undefined;
    receiptLoadVersion++;
    dashboardLoadVersion++;
    reportLoadVersion++;
    document.querySelectorAll("dialog[open]").forEach(dialog => dialog.close());
    resetPrivateViews();
    renderCart();
    setAuthenticated(false);
    document.querySelector("#login-message").textContent = message || "";
    document.querySelector("#login-username").focus();
}

function verifySession(token) {
    if (sessionCheck?.token === token) return sessionCheck.result;
    const check = { token, result: fetch(`${API}/products`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(8000),
        cache: "no-store"
    }).then(response => response.ok ? "valid" : response.status === 401 ? "expired" : "unknown")
        .catch(() => "unknown")
        .finally(() => { if (sessionCheck === check) sessionCheck = undefined; }) };
    sessionCheck = check;
    return check.result;
}

async function apiResponse(path, options = {}) {
    const token = /^\/auth\/(?:admin\/)?login$/.test(path) ? null : getToken();
    const headers = new Headers({ Accept: "application/json" });
    new Headers(options.headers).forEach((value, key) => headers.set(key, value));
    if (options.body !== undefined) {
        headers.set("Content-Type", "application/json");
    }
    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(`${API}${path}`, { signal: AbortSignal.timeout(20000), ...options, headers });
    if (token && token !== getToken()) throw new Error("La sesión cambió. Vuelve a intentar la operación.");
    if (response.status === 401 && token) {
        const state = await verifySession(token);
        if (token !== getToken()) throw new Error("La sesión cambió. Vuelve a intentar la operación.");
        if (state === "expired") await logout("Tu sesión expiró. Inicia sesión nuevamente.", false);
        if (state === "unknown") throw new Error("No se pudo verificar la sesión. Revisa la conexión e inténtalo de nuevo.");
        if (state === "valid") {
            const error = new Error("SupaClothes rechazó la operación. Revisa los datos o los permisos de tu cuenta.");
            error.status = 401;
            error.sessionVerified = true;
            throw error;
        }
    }
    return response;
}

async function api(path, options = {}) {
    const response = await apiResponse(path, options);
    if (response.status === 204) return null;
    const contentType = response.headers.get("content-type") || "";
    const result = /[/+]json\b/i.test(contentType)
        ? await response.json()
        : await response.text();

    if (!response.ok) {
        const message = typeof result === "string"
            ? result.trim() && !result.trimStart().startsWith("<") ? result : ""
            : result?.detail || result?.message || result?.error;
        const error = new Error(message || `La operación devolvió un error (${response.status}).`);
        error.status = response.status;
        throw error;
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

function matchesSearch(input, values) {
    const term = input.trim().toLocaleLowerCase("es-CO");
    return values.some(value => String(value ?? "").toLocaleLowerCase("es-CO").includes(term));
}

function isLowStock(product, variant) {
    return product.active && variant.active && Number(variant.currentStock) <= Number(variant.minStock);
}

function addState(cell, text, active) {
    const badge = document.createElement("span");
    badge.className = `state ${active ? "state-active" : "state-inactive"}`;
    badge.textContent = text;
    cell.replaceChildren(badge);
}

function formatMoney(value) {
    return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(Number(value || 0));
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
    const filter = document.querySelector("#filter-products").value;
    const variants = products.flatMap(product => (product.variants || []).map(variant => ({ product, variant })))
        .filter(({ product, variant }) => matchesSearch(filter, [product.name, product.category, variant.sku]));
    if (!variants.length) {
        setEmptyRow(tbody, 8, filter.trim() ? "No hay productos para esta búsqueda." : "No hay productos registrados.");
        return;
    }

    variants.forEach(({ product, variant }) => {
        const row = document.createElement("tr");
        const nameCell = addCell(row, product.name);
        if (product.description) {
            const description = document.createElement("small");
            description.className = "product-description";
            description.textContent = product.description;
            nameCell.append(description);
        }
        addCell(row, product.category);
        addCell(row, variant.sku);
        addCell(row, `${variant.size} / ${variant.color}`);
        addCell(row, formatMoney(variant.price));
        addCell(row, variant.currentStock);
        const stateCell = addCell(row, "");
        const available = product.active && variant.active && Number(variant.currentStock) > 0;
        addState(stateCell, !product.active || !variant.active ? "Inactivo" : available ? "Disponible" : "Agotado", available);
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
                deactivateVariant.className = "table-action table-action-danger";
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
                deactivate.className = "table-action table-action-danger";
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
    const filter = document.querySelector("#filter-inventory").value;
    const onlyLow = document.querySelector("#only-low-stock").checked;
    const allVariants = products.flatMap(product => (product.variants || []).map(variant => ({ product, variant })));
    document.querySelector("#inventory-low-count").textContent =
        `(${allVariants.filter(({ product, variant }) => isLowStock(product, variant)).length})`;
    const variants = allVariants.filter(({ product, variant }) =>
        matchesSearch(filter, [product.name, variant.sku]) && (!onlyLow || isLowStock(product, variant)));
    if (!variants.length) {
        setEmptyRow(tbody, 7, onlyLow ? "No hay variantes con stock bajo para esta búsqueda." : "No hay variantes para mostrar.");
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
        const stock = Number(variant.currentStock);
        const lowStock = isLowStock(product, variant);
        const stateCell = addCell(row, "");
        const badge = document.createElement("span");
        const enabled = product.active && variant.active;
        badge.className = `state ${!enabled ? "state-inactive" : lowStock ? "state-low" : "state-stock"}`;
        badge.textContent = !enabled ? "Inactivo" : stock === 0 ? "Agotado" : lowStock ? "Stock bajo" : "Disponible";
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
    const filter = document.querySelector("#filter-sale-sku").value;
    const available = products.flatMap(product => product.active
        ? (product.variants || []).filter(variant => variant.active && matchesSearch(filter, [product.name, variant.sku]))
            .map(variant => ({ product, variant }))
        : []);
    select.replaceChildren(new Option(available.length ? "Selecciona un SKU" : "No hay variantes para esta búsqueda", ""));
    available.forEach(({ product, variant }) => {
                const hasStock = Number(variant.currentStock) > 0;
                const option = new Option(
                    `${variant.sku} — ${product.name} (${variant.size}, ${variant.color}) · ${hasStock ? `stock ${variant.currentStock}` : "Agotado"}`,
                    variant.sku
                );
                option.disabled = !hasStock;
                select.add(option);
    });
    if ([...select.options].some(option => option.value === previousValue)) {
        select.value = previousValue;
    }
}

async function deactivateProduct(id, name) {
    if (!window.confirm(`¿Desactivar "${name}" y sus variantes?`)) {
        return;
    }

    try {
        await api(`/products/${id}/deactivate`, { method: "PATCH" });
        showNotice(`Producto "${name}" desactivado.`);
        await refreshProducts();
    } catch (error) {
        showNotice(error.message, true);
    }
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
    form.elements.taxRate.value = variant?.taxRate ?? "";
    form.elements.minStock.value = variant?.minStock ?? "0";
    document.querySelector("#variant-dialog-title").textContent = variant ? "Editar variante" : "Agregar variante";
    document.querySelector("#variant-edit-dialog").showModal();
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
            button.className = "table-action table-action-danger";
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
    document.querySelector("#submit-sale").disabled = !cart.length || Boolean(pendingSaleOperation) || submittingSale;
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

function toCents(value) {
    return BigInt(Math.round(Number(value) * 100));
}

function estimatedSaleTotals() {
    const discount = document.querySelector("#sale-discount");
    if (!discount.validity.valid) return null;
    const discountBasisPoints = getRole() === "ADMIN" ? toCents(discount.value || 0) : 0n;
    const totals = cart.reduce((sum, item) => {
        const lineSubtotal = toCents(item.price) * BigInt(item.quantity);
        const lineDiscount = (lineSubtotal * discountBasisPoints + 5000n) / 10000n;
        const lineTax = ((lineSubtotal - lineDiscount) * toCents(item.taxRate) + 50n) / 100n;
        sum.subtotal += lineSubtotal;
        sum.discount += lineDiscount;
        sum.tax += lineTax;
        return sum;
    }, { subtotal: 0n, discount: 0n, tax: 0n });
    totals.netBase = totals.subtotal - totals.discount;
    totals.total = totals.netBase + totals.tax;
    return totals;
}

function formatCents(cents) {
    return formatMoney(Number(cents) / 100);
}

function updateSaleEstimate() {
    const totals = estimatedSaleTotals();
    const method = document.querySelector("#payment-method").value;
    const received = document.querySelector("#amount-received");
    const estimate = document.querySelector("#sale-estimate");
    const change = document.querySelector("#change-estimate");
    change.classList.remove("payment-error");
    estimate.textContent = totals
        ? `Subtotal: ${formatCents(totals.subtotal)} · Descuento: ${formatCents(totals.discount)} · Base después del descuento: ${formatCents(totals.netBase)} · Impuestos: ${formatCents(totals.tax)} · Total estimado: ${formatCents(totals.total)}`
        : "Ingresa un descuento entre 0 y 100 %, con máximo dos decimales.";
    received.readOnly = method !== "EFECTIVO";
    if (method !== "EFECTIVO") {
        received.value = totals ? (Number(totals.total) / 100).toFixed(2) : "";
        change.textContent = "El pago electrónico debe coincidir exactamente con el total.";
    } else if (!totals || !received.value || !received.validity.valid) {
        change.textContent = "";
    } else {
        const balance = toCents(received.value) - totals.total;
        change.classList.toggle("payment-error", balance < 0n);
        change.textContent = balance < 0n ? "El efectivo recibido no cubre el total." : `Cambio estimado: ${formatCents(balance)}`;
    }
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
}

function receiptMarkup(receipt) {
    const rows = receipt.items.map(item => `<tr>
        <td>${escapeHtml(item.sku)}<br>${escapeHtml(item.productName)} (${escapeHtml(item.size)} / ${escapeHtml(item.color)})</td>
        <td>${item.quantity}</td><td>${formatMoney(item.unitPrice)}</td><td>${receipt.discountBeforeTax ? formatMoney(item.discountValue || 0) : "—"}</td><td>${formatMoney(item.taxValue || 0)}</td><td>${formatMoney(item.lineTotal)}</td>
    </tr>`).join("");
    return `<h2 id="receipt-title">SupaClothes · Comprobante interno de venta</h2>
        <p><strong>Documento interno; no es una factura electrónica.</strong></p>
        ${currentReturn && currentReturn.receiptNumber === receipt.receiptNumber ? `<p><strong>VENTA DEVUELTA</strong> · ${escapeHtml(new Date(currentReturn.createdAt).toLocaleString("es-CO"))}<br>Motivo: ${escapeHtml(currentReturn.reason)} · Valor: ${formatMoney(currentReturn.refundTotal)}</p>` : ""}
        <p><strong>Comprobante:</strong> ${escapeHtml(receipt.receiptNumber)}</p>
        <p><strong>Fecha:</strong> ${escapeHtml(new Date(receipt.createdAt).toLocaleString("es-CO"))}</p>
        <p><strong>Vendedor:</strong> ${escapeHtml(receipt.sellerName)}</p>
        <p><strong>Cliente:</strong> ${escapeHtml(receipt.customerName || "Consumidor final")}</p>
        <div class="table-wrap" tabindex="0" role="region" aria-label="Artículos del comprobante"><table><thead><tr><th>Artículo</th><th>Cant.</th><th>Unitario</th><th>Descuento</th><th>Impuesto</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table></div>
        <p>Subtotal: ${formatMoney(receipt.subtotal)}</p>
        <p>Base después del descuento: ${receipt.discountBeforeTax
            ? formatMoney(Number(receipt.subtotal) - Number(receipt.discountValue))
            : "No desglosada en comprobantes anteriores"}</p>
        <p>Impuestos: ${formatMoney(receipt.taxTotal)}</p>
        <p>Descuento (${receipt.discountPercent}%): ${formatMoney(receipt.discountValue)}</p><p><strong>Total: ${formatMoney(receipt.total)}</strong></p>
        ${receipt.discountBeforeTax ? "" : "<p>Este comprobante conserva el cálculo anterior al cambio de regla; el descuento global se aplicó después de los impuestos.</p>"}
        <p>Pago: ${escapeHtml(receipt.paymentMethod)} · Recibido: ${formatMoney(receipt.amountReceived)} · Cambio: ${formatMoney(receipt.changeGiven)}</p>`;
}

async function loadReceipt(receiptNumber, knownStatus) {
    const version = ++receiptLoadVersion;
    const receipt = await api(`/sales/${encodeURIComponent(receiptNumber)}`);
    if (version !== receiptLoadVersion) return;
    currentReceipt = receipt;
    currentReturn = null;
    document.querySelector("#receipt-content").innerHTML = receiptMarkup(receipt);
    document.querySelector("#return-form").hidden = true;
    document.querySelector("#return-form").reset();
    document.querySelector("#return-status").textContent = "Consultando estado de devolución…";
    document.querySelector("#receipt-export-status").textContent = "";
    setReceiptActions(false);
    const dialog = document.querySelector("#receipt-dialog");
    if (!dialog.open) dialog.showModal();
    if (knownStatus === "CONFIRMADA") {
        showReturnAvailable();
        return;
    }
    try {
        const returned = await api(`/sales/${encodeURIComponent(receiptNumber)}/return`);
        if (version !== receiptLoadVersion) return;
        currentReturn = returned;
        renderReturnState();
    } catch (error) {
        if (version !== receiptLoadVersion) return;
        if (error.status === 404) {
            showReturnAvailable();
            return;
        }
        if (error.sessionVerified) {
            try {
                const matches = await api(`/sales?receipt=${encodeURIComponent(receiptNumber)}`);
                if (version !== receiptLoadVersion) return;
                if (matches.some(sale => sale.receiptNumber === receipt.receiptNumber && sale.status === "CONFIRMADA")) {
                    showReturnAvailable();
                    return;
                }
            } catch (verificationError) {
                if (version !== receiptLoadVersion) return;
                error = verificationError;
            }
        }
        document.querySelector("#return-status").textContent = `No se pudo verificar la devolución: ${error.message}. Vuelve a abrir el comprobante para reintentar.`;
    }
}

function showReturnAvailable() {
    document.querySelector("#return-status").textContent = "Esta venta no tiene una devolución registrada.";
    document.querySelector("#return-form").hidden = !salesRoles.includes(getRole());
    setReceiptActions(true);
}

function renderReturnState() {
    document.querySelector("#return-form").hidden = true;
    document.querySelector("#return-status").textContent = `Devolución registrada el ${new Date(currentReturn.createdAt).toLocaleString("es-CO")} · Valor ${formatMoney(currentReturn.refundTotal)} · Motivo: ${currentReturn.reason}`;
    document.querySelector("#receipt-content").innerHTML = receiptMarkup(currentReceipt);
    setReceiptActions(true);
}

const pdfType = "application/pdf";
const workbookType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function canShareFile(name, type) {
    try {
        return Boolean(navigator.share && navigator.canShare?.({ files: [new File(["SupaClothes"], name, { type })] }));
    } catch {
        return false;
    }
}

function setReceiptActions(enabled) {
    document.querySelectorAll("#download-receipt, #download-receipt-pdf, #share-receipt-pdf, #print-receipt")
        .forEach(button => { button.disabled = !enabled; });
    document.querySelector("#share-receipt-pdf").hidden = !canShareFile("comprobante.pdf", pdfType);
}

function receiptDocument() {
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Comprobante ${escapeHtml(currentReceipt.receiptNumber)}</title>
        <style>body{font:14px Arial,sans-serif;max-width:760px;margin:32px auto;color:#162235}table{width:100%;border-collapse:collapse;margin:20px 0}th,td{text-align:left;padding:8px;border-bottom:1px solid #ddd}h2{margin-bottom:6px}@media print{body{margin:0}}</style>
        </head><body>${receiptMarkup(currentReceipt)}</body></html>`;
}

function downloadFile(file, filename) {
    const link = document.createElement("a");
    const url = URL.createObjectURL(file);
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadReceipt() {
    downloadFile(new Blob([receiptDocument()], { type: "text/html;charset=utf-8" }), `${currentReceipt.receiptNumber}.html`);
}

async function exportReceiptPdf(share) {
    const status = document.querySelector("#receipt-export-status");
    status.textContent = "";
    try {
        const receipt = currentReceipt;
        const pdf = makeReceiptPdf(receipt, currentReturn, {
            money: formatMoney,
            dateTime: value => new Date(value).toLocaleString("es-CO")
        });
        const name = `${receipt.receiptNumber}.pdf`;
        if (share) await navigator.share({ files: [new File([pdf], name, { type: pdfType })] });
        else {
            downloadFile(pdf, name);
            status.textContent = "Comprobante PDF descargado.";
        }
    } catch (error) {
        if (error.name !== "AbortError") status.textContent = share
            ? "No se pudo compartir el PDF. Puedes descargarlo desde el comprobante."
            : "No se pudo generar el PDF. Puedes imprimir el comprobante desde el navegador.";
    }
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

function showSection(name, { focus = true, remember = true } = {}) {
    if (!canOpenSection(name)) {
        showNotice("Tu rol no tiene acceso a esa sección.", true);
        return;
    }
    activeSection = name;
    if (remember && location.hash !== `#${name}`) history.pushState(null, "", `#${name}`);
    document.querySelectorAll(".page-section").forEach(section => {
        section.hidden = section.id !== `section-${name}`;
    });
    document.querySelectorAll(".nav-link[data-section]").forEach(button => {
        const current = button.dataset.section === name;
        button.classList.toggle("active", current);
        if (current) button.setAttribute("aria-current", "page");
        else button.removeAttribute("aria-current");
    });
    const title = document.querySelector("#page-title");
    title.textContent = sections[name].title;
    if (focus) title.focus();

    if (name === "productos" || name === "ventas") {
        refreshProducts().catch(error => showNotice(error.message, true));
    } else if (name === "inventario") {
        refreshInventory().catch(error => showNotice(error.message, true));
        refreshMovements().catch(error => showNotice(error.message, true));
    } else if (name === "usuarios") {
        refreshUsers().catch(error => showNotice(error.message, true));
    } else if (name === "reportes") {
        void loadReport();
    } else if (name === "historial") {
        void loadHistory();
    } else if (name === "resumen-diario") {
        void loadDailySummary();
    } else if (name === "inicio") {
        refreshProducts().catch(error => showNotice(error.message, true));
        if (getRole() === "ADMIN") void refreshDashboard();
    }
    if (name === "ventas") renderPendingSale();
}

function restoreSection(focus = false) {
    if (!getToken() || !staff.includes(getRole())) return;
    const requested = location.hash.slice(1) || "inicio";
    const allowed = canOpenSection(requested);
    if (!allowed) history.replaceState(null, "", "#inicio");
    showSection(allowed ? requested : "inicio", { focus, remember: false });
    if (!allowed) showNotice("Tu rol no tiene acceso a esa sección.", true);
}

function resetPrivateViews() {
    products = [];
    users = [];
    mayDiscardPendingSale = false;
    Object.keys(queryVersions).forEach(key => { queryVersions[key]++; });
    [
        "#products-table", "#inventory-table", "#movements-table", "#users-table", "#customer-directory", "#sales-history",
        "#report-body", "#dashboard-daily", "#receipt-content", "#daily-result", "#sale-result", "#return-status",
        "#customer-directory-status", "#history-status", "#report-summary", "#report-message"
    ].forEach(selector => document.querySelector(selector).replaceChildren());
    document.querySelectorAll("#app-shell form, dialog form").forEach(form => form.reset());
    document.querySelector("#sale-customer").replaceChildren(new Option("Consumidor final", ""));
    for (const id of ["filter-products", "filter-inventory"]) document.getElementById(id).value = "";
    document.querySelector("#only-low-stock").checked = false;
    document.querySelector("#amount-received").value = "";
    document.querySelector("#payment-method").value = "EFECTIVO";
    notice.textContent = "";
    setupDateRange(document.querySelector("#dashboard-form"));
    setupDateRange(document.querySelector("#report-form"));
    syncReportType();
    document.querySelector("#daily-form").elements.date.value = dateInBogota();
}

function renderPendingSale() {
    const owner = pendingSaleOperation?.username === localStorage.getItem("supaclothes.username");
    document.querySelector("#pending-sale-actions").hidden = !pendingSaleOperation || !owner;
    document.querySelector("#retry-sale").disabled = recoveringSaleOperation || submittingSale;
    document.querySelector("#discard-pending-sale").hidden = !mayDiscardPendingSale || recoveringSaleOperation || submittingSale;
    document.querySelector("#submit-sale").disabled = !cart.length || Boolean(pendingSaleOperation) || submittingSale;
    if (pendingSaleOperation && !owner && getToken()) {
        document.querySelector("#sale-result").textContent = "Otra cuenta tiene una venta pendiente en esta pestaña. Inicia sesión con esa cuenta para comprobarla.";
    }
}

function clearPendingSale() {
    sessionStorage.removeItem("supaclothes.pendingSaleOperation");
    pendingSaleOperation = null;
    mayDiscardPendingSale = false;
    renderPendingSale();
}

function isDefiniteSaleError(error) {
    return [400, 403, 404, 409, 422].includes(error.status);
}

async function confirmSaleResult(sale, recovered = false) {
    if (!sale?.receiptNumber) throw new Error("La API no devolvió un comprobante para confirmar el resultado.");
    clearPendingSale();
    document.querySelector("#sale-result").textContent =
        `${recovered ? "Venta recuperada" : "Venta registrada"} · Comprobante interno ${sale.receiptNumber} · Total ${formatMoney(sale.total)}.`;
    document.querySelector("#receipt-search").elements.receiptNumber.value = sale.receiptNumber;
    cart.length = 0;
    document.querySelector("#sale-discount").value = 0;
    document.querySelector("#sale-customer").value = "";
    document.querySelector("#amount-received").value = "";
    renderCart();
    const updates = [refreshProducts(), refreshMovements()];
    if (activeSection === "ventas") updates.push(loadReceipt(sale.receiptNumber, recovered ? null : (sale.status || "CONFIRMADA")));
    if ((await Promise.allSettled(updates)).some(result => result.status === "rejected")) {
        showNotice("Venta registrada. Revisa el historial o actualiza los datos visibles.", true);
    }
}

async function recoverPendingSaleOperation() {
    if (!pendingSaleOperation || recoveringSaleOperation || submittingSale
        || pendingSaleOperation.username !== localStorage.getItem("supaclothes.username")) return;
    recoveringSaleOperation = true;
    mayDiscardPendingSale = false;
    renderPendingSale();
    try {
        const sale = await api("/sales", {
            method: "POST",
            body: JSON.stringify(pendingSaleOperation.request)
        });
        await confirmSaleResult(sale, true);
    } catch (error) {
        mayDiscardPendingSale = isDefiniteSaleError(error) || Boolean(error.sessionVerified);
        showNotice(`No se pudo confirmar el resultado: ${error.message}`, true);
    } finally {
        recoveringSaleOperation = false;
        renderPendingSale();
    }
}

function setAdminLoginMode(enabled) {
    adminLoginMode = enabled;
    document.querySelector(".login-card").classList.toggle("admin-login", enabled);
    document.querySelector("#login-description").textContent = enabled
        ? "Acceso exclusivo para la cuenta administradora."
        : "Acceso para vendedores y personal de bodega.";
    document.querySelector("#login-submit").textContent = enabled
        ? "Ingresar al panel administrativo"
        : "Iniciar sesión";
    document.querySelector("#admin-login-toggle").textContent = enabled
        ? "Volver al acceso de personal"
        : "Acceso administrativo";
    document.querySelector("#login-message").textContent = "";
}

document.querySelector("#admin-login-toggle").addEventListener("click", () => {
    setAdminLoginMode(!adminLoginMode);
});

document.querySelector("#login-form").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const message = document.querySelector("#login-message");
    message.textContent = "";
    const data = new FormData(form);
    try {
        const response = await api(adminLoginMode ? "/auth/admin/login" : "/auth/login", {
            method: "POST",
            body: JSON.stringify({ username: data.get("username"), password: data.get("password") })
        });
        if (!response?.token || !staff.includes(response.role)) throw new Error("La API no devolvió una sesión válida.");
        if (adminLoginMode && response.role !== "ADMIN") {
            throw new Error("Este acceso es exclusivo para una cuenta administradora.");
        }
        localStorage.setItem("supaclothes.token", response.token);
        localStorage.setItem("supaclothes.username", data.get("username"));
        localStorage.setItem("supaclothes.role", response.role);
        localStorage.setItem("supaclothes.fullName", response.fullName);
        form.reset();
        setAuthenticated(true);
        if (pendingSaleOperationWarning) {
            showNotice(pendingSaleOperationWarning, true);
            pendingSaleOperationWarning = "";
        }
        restoreSection(true);
    } catch (error) {
        message.textContent = error.status === 401
            ? adminLoginMode
                ? "Credenciales incorrectas o la cuenta no tiene permisos de administrador."
                : "Usuario o contraseña incorrectos. Verifica tus datos e inténtalo de nuevo."
            : error.message || "No se pudo iniciar sesión. Inténtalo de nuevo.";
    }
});

document.querySelectorAll("#logout-button, #profile-logout").forEach(button => {
    button.addEventListener("click", () => { void logout(); });
});
document.querySelector(".skip-link").addEventListener("click", event => {
    event.preventDefault();
    document.querySelector("#page-title").focus();
});
window.addEventListener("hashchange", () => restoreSection(true));
window.addEventListener("storage", event => { if (event.key === "supaclothes.token") location.reload(); });

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

document.querySelector("#filter-products").addEventListener("input", renderProducts);
document.querySelector("#filter-inventory").addEventListener("input", renderInventory);
document.querySelector("#only-low-stock").addEventListener("change", renderInventory);
document.querySelector("#filter-sale-sku").addEventListener("input", renderSaleOptions);

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
        input.value = input.classList.contains("variant-min-stock") ? "0" : "";
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
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 2147483647) {
        showNotice("Ingresa una cantidad entera positiva.", true);
        return;
    }
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
    renderSaleOptions();
    renderCart();
});

document.querySelector("#sale-discount").addEventListener("input", updateSaleEstimate);
document.querySelector("#payment-method").addEventListener("change", updateSaleEstimate);
document.querySelector("#amount-received").addEventListener("input", updateSaleEstimate);

document.querySelector("#submit-sale").addEventListener("click", async () => {
    if (submittingSale || recoveringSaleOperation || pendingSaleOperation || !cart.length) return;
    const result = document.querySelector("#sale-result");
    result.textContent = "";
    const discountInput = document.querySelector("#sale-discount");
    if (!discountInput.checkValidity()) { discountInput.reportValidity(); return; }
    const paymentMethod = document.querySelector("#payment-method").value;
    const totals = estimatedSaleTotals();
    const maxCents = 999999999999n;
    if (!totals || totals.total > maxCents || totals.subtotal > maxCents) {
        showNotice("El importe de la venta supera el límite permitido.", true);
        return;
    }
    const received = document.querySelector("#amount-received");
    if (paymentMethod === "EFECTIVO" && !received.reportValidity()) return;
    const receivedCents = paymentMethod === "EFECTIVO" ? toCents(received.value) : totals.total;
    if (receivedCents > maxCents) {
        showNotice("El importe recibido supera el límite permitido.", true);
        return;
    }
    if (receivedCents < totals.total) {
        showNotice("El efectivo recibido no cubre el total.", true);
        return;
    }
    const request = {
        customerId: document.querySelector("#sale-customer").value ? Number(document.querySelector("#sale-customer").value) : null,
        discountPercent: getRole() === "ADMIN" ? Number(discountInput.value || 0) : 0,
        items: cart.map(({ sku, quantity }) => ({ sku, quantity })),
        paymentMethod,
        amountReceived: Number(receivedCents) / 100
    };
    try {
        const operation = {
            username: localStorage.getItem("supaclothes.username"),
            request: { ...request, idempotencyKey: crypto.randomUUID() }
        };
        sessionStorage.setItem("supaclothes.pendingSaleOperation", JSON.stringify(operation));
        pendingSaleOperation = operation;
    } catch {
        showNotice("No se pudo guardar la referencia de esta venta en el navegador.", true);
        return;
    }
    submittingSale = true;
    renderPendingSale();
    try {
        const sale = await api("/sales", {
            method: "POST",
            body: JSON.stringify(pendingSaleOperation.request)
        });
        await confirmSaleResult(sale);
    } catch (error) {
        if (isDefiniteSaleError(error)) {
            clearPendingSale();
            showNotice(`La venta fue rechazada. ${error.message}`, true);
        } else {
            mayDiscardPendingSale = Boolean(error.sessionVerified);
            result.textContent = "El resultado de la venta está pendiente. Comprueba la referencia antes de confirmar otra.";
            showNotice(error.message, true);
        }
    } finally {
        submittingSale = false;
        renderPendingSale();
    }
});

document.querySelector("#retry-sale").addEventListener("click", () => { void recoverPendingSaleOperation(); });
document.querySelector("#discard-pending-sale").addEventListener("click", () => {
    if (!mayDiscardPendingSale || recoveringSaleOperation || submittingSale
        || pendingSaleOperation?.username !== localStorage.getItem("supaclothes.username")) return;
    if (!window.confirm("Comprueba en el historial si la venta ya existe antes de descartar la referencia local.")) return;
    clearPendingSale();
    document.querySelector("#sale-result").textContent = "Referencia local descartada.";
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
document.querySelector("#download-receipt-pdf").addEventListener("click", () => { void exportReceiptPdf(false); });
document.querySelector("#share-receipt-pdf").addEventListener("click", () => { void exportReceiptPdf(true); });
document.querySelector("#print-receipt").addEventListener("click", printReceipt);
document.querySelector("#close-receipt").addEventListener("click", () => {
    document.querySelector("#receipt-dialog").close();
});


const systemTheme = matchMedia("(prefers-color-scheme: dark)");
function syncPreferenceControls(ids, key, allowed, fallback, apply) {
    const controls = ids.map(id => document.getElementById(id));
    function render(input) {
        const value = allowed.includes(input) ? input : fallback;
        controls.forEach(control => { control.value = value; });
        apply(value);
    }
    render(localStorage.getItem(key));
    controls.forEach(control => control.addEventListener("change", () => {
        localStorage.setItem(key, control.value);
        render(control.value);
    }));
    window.addEventListener("storage", event => { if (event.key === key) render(event.newValue); });
}

function applyTheme(value) {
    document.documentElement.dataset.theme = value === "system" ? (systemTheme.matches ? "dark" : "light") : value;
}

syncPreferenceControls(["theme-choice", "settings-theme"], "supaclothes.theme", ["system", "light", "dark"], "system", applyTheme);
syncPreferenceControls(["text-choice", "settings-text"], "supaclothes.text", ["normal", "large", "extra-large"], "normal",
    value => { document.documentElement.dataset.text = value; });
systemTheme.addEventListener("change", () => {
    if (document.querySelector("#theme-choice").value === "system") applyTheme("system");
});

function maskedDocument(customer) {
    const number = String(customer.documentNumber ?? "");
    return `${customer.documentType || "Documento"} ${number.length > 4 ? `••••${number.slice(-4)}` : number}`;
}

function renderCustomers(origin, customers, selected) {
    if (origin === "sale") {
        const select = document.querySelector("#sale-customer");
        const current = Array.from(select.options).find(option => option.value && option.selected);
        const options = customers.map(customer => new Option(`${customer.name} · ${maskedDocument(customer)}`, customer.id));
        if (current && !options.some(option => option.value === current.value)) options.unshift(current);
        select.replaceChildren(new Option("Consumidor final", ""), ...options);
        select.value = String(selected ?? current?.value ?? "");
        return;
    }
    const tbody = document.querySelector("#customer-directory");
    tbody.replaceChildren();
    if (!customers.length) setEmptyRow(tbody, 2, "No hay clientes para esta búsqueda.");
    customers.forEach(customer => {
        const row = tbody.insertRow();
        addCell(row, customer.name);
        addCell(row, maskedDocument(customer));
    });
    document.querySelector("#customer-directory-status").textContent = `${customers.length} clientes encontrados.`;
}

async function searchCustomers(origin) {
    const field = origin === "sale" ? document.querySelector("#customer-query")
        : document.querySelector("#customer-directory-form").elements.query;
    const version = ++queryVersions[origin];
    try {
        const customers = await api(`/customers?q=${encodeURIComponent(field.value.trim())}`);
        if (version !== queryVersions[origin]) return;
        renderCustomers(origin, customers);
        if (origin === "sale") showNotice(customers.length ? `${customers.length} clientes encontrados.` : "No se encontraron clientes.");
    } catch (error) {
        if (version === queryVersions[origin]) showNotice(error.message, true);
    }
}

const customerDialog = document.querySelector("#customer-dialog");
const customerForm = document.querySelector("#customer-form");
const customerError = document.querySelector("#customer-form-error");
function openCustomerForm(origin) {
    if (!canOpenSection("clientes")) return;
    customerFormOrigin = origin;
    customerForm.reset();
    customerError.textContent = "";
    customerDialog.showModal();
}
document.querySelector("#new-customer").addEventListener("click", () => openCustomerForm("directory"));
document.querySelector("#new-sale-customer").addEventListener("click", () => openCustomerForm("sale"));
document.querySelector("#cancel-customer").addEventListener("click", () => customerDialog.close());
customerDialog.addEventListener("cancel", event => { if (customerForm.getAttribute("aria-busy") === "true") event.preventDefault(); });
document.querySelector("#customer-directory-form").addEventListener("submit", event => {
    event.preventDefault();
    void searchCustomers("directory");
});
document.querySelector("#sale-customer-search").addEventListener("submit", event => {
    event.preventDefault();
    void searchCustomers("sale");
});
customerForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (customerForm.getAttribute("aria-busy") === "true") return;
    const request = Object.fromEntries(Array.from(new FormData(customerForm), ([key, value]) => [key, value.trim()]));
    const origin = customerFormOrigin;
    customerError.textContent = "";
    if (!request.name || !request.documentNumber) {
        customerError.textContent = "Ingresa el nombre y el número de documento.";
        return;
    }
    if (request.phone && !/^\+?[0-9 ()-]{7,20}$/.test(request.phone)) {
        customerError.textContent = "Revisa el formato del teléfono.";
        return;
    }
    const buttons = customerForm.querySelectorAll("button");
    customerForm.setAttribute("aria-busy", "true");
    buttons.forEach(button => { button.disabled = true; });
    try {
        const customer = await api("/customers", { method: "POST", body: JSON.stringify(request) });
        queryVersions[origin]++;
        renderCustomers(origin, [customer], customer.id);
        customerDialog.close();
        showNotice(origin === "sale" ? "Cliente registrado y seleccionado." : "Cliente registrado.");
    } catch (error) {
        if (error.status === 409 || error.sessionVerified) {
            try {
                const matches = await api(`/customers?q=${encodeURIComponent(request.documentNumber)}`);
                if (matches.some(customer => customer.documentNumber === request.documentNumber)) {
                    queryVersions[origin]++;
                    renderCustomers(origin, matches);
                    customerDialog.close();
                    showNotice("El documento ya está registrado. Revisa los resultados de la búsqueda.", true);
                    return;
                }
            } catch {
                // Keep the original failure if the duplicate check is unavailable.
            }
        }
        customerError.textContent = error.message;
    } finally {
        customerForm.removeAttribute("aria-busy");
        buttons.forEach(button => { button.disabled = false; });
    }
});

async function loadHistory() {
    if (!canOpenSection("historial")) return;
    const form = document.querySelector("#history-form");
    const status = document.querySelector("#history-status");
    const body = document.querySelector("#sales-history");
    const version = ++queryVersions.history;
    const params = new URLSearchParams(Array.from(new FormData(form), ([key, value]) => [key, value.trim()])
        .filter(([, value]) => value));
    if (params.has("from") && params.has("to") && params.get("from") > params.get("to")) {
        status.textContent = "La fecha Desde debe ser anterior o igual a la fecha Hasta.";
        return;
    }
    body.replaceChildren();
    status.textContent = "Buscando ventas…";
    try {
        const sales = await api(`/sales${params.size ? `?${params}` : ""}`);
        if (version !== queryVersions.history) return;
        status.textContent = `${sales.length} ventas encontradas.`;
        if (!sales.length) setEmptyRow(body, 6, "No hay ventas para los filtros seleccionados.");
        for (const sale of sales) {
            const row = body.insertRow();
            for (const value of [new Date(sale.createdAt).toLocaleString("es-CO"), sale.receiptNumber,
                sale.customerId ?? "Consumidor final", formatMoney(sale.total), sale.status]) addCell(row, value);
            const button = document.createElement("button");
            button.type = "button";
            button.className = "table-action";
            button.textContent = "Ver comprobante";
            button.setAttribute("aria-label", `Ver comprobante ${sale.receiptNumber}`);
            button.addEventListener("click", () => loadReceipt(sale.receiptNumber).catch(error => showNotice(error.message, true)));
            row.insertCell().append(button);
        }
    } catch (error) {
        if (version === queryVersions.history) status.textContent = error.message;
    }
}

async function loadDailySummary() {
    if (!canOpenSection("resumen-diario")) return;
    const input = document.querySelector("#daily-form").elements.date;
    if (!input.value) input.value = dateInBogota();
    const version = ++queryVersions.daily;
    const output = document.querySelector("#daily-result");
    output.textContent = "Consultando ventas del día…";
    try {
        const summary = await api(`/sales/daily-summary?date=${encodeURIComponent(input.value)}`);
        if (version !== queryVersions.daily) return;
        output.textContent = `${summary.date} · ${summary.count} ventas · Ventas brutas ${formatMoney(summary.grossSales)} · Devoluciones ${formatMoney(summary.refunds)} · Neto ${formatMoney(summary.total)}`;
    } catch (error) {
        if (version === queryVersions.daily) output.textContent = error.message;
    }
}
document.querySelector("#history-form").addEventListener("submit", event => { event.preventDefault(); void loadHistory(); });
document.querySelector("#daily-form").addEventListener("submit", event => { event.preventDefault(); void loadDailySummary(); });

function dateInBogota(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
    return ["year", "month", "day"].map(type => parts.find(part => part.type === type).value).join("-");
}
function setupDateRange(form) {
    form.elements.to.value = dateInBogota();
    form.elements.from.value = dateInBogota(new Date(Date.now() - 6 * 86400000));
}
function dateRangeParams(form) {
    const from = form.elements.from.value;
    const to = form.elements.to.value;
    if (!from || !to) throw new Error("Selecciona ambas fechas.");
    const days = (Date.parse(to) - Date.parse(from)) / 86400000;
    if (!Number.isFinite(days) || days < 0 || days > 365) throw new Error("Selecciona un rango válido de hasta 366 días.");
    return new URLSearchParams({from, to});
}
function fillTable(head, body, headings, rows, emptyMessage) {
    head.replaceChildren(); body.replaceChildren();
    const header = document.createElement("tr");
    headings.forEach(label => { const th = document.createElement("th"); th.scope = "col"; th.textContent = label; header.append(th); });
    head.append(header);
    if (!rows.length) { setEmptyRow(body, headings.length, emptyMessage); return; }
    rows.forEach(values => { const row = document.createElement("tr"); values.forEach(value => addCell(row, value)); body.append(row); });
}
async function refreshDashboard() {
    if (getRole() !== "ADMIN") return;
    const version = ++dashboardLoadVersion;
    const message = document.querySelector("#dashboard-message");
    const results = document.querySelector("#dashboard-results");
    results.hidden = true; message.textContent = "Cargando indicadores…";
    try {
        const data = await api(`/reports/dashboard?${dateRangeParams(document.querySelector("#dashboard-form"))}`);
        if (version !== dashboardLoadVersion || getRole() !== "ADMIN") return;
        for (const [id, value] of [["count", data.salesCount], ["sales", formatMoney(data.grossSales)], ["refunds", formatMoney(data.refunds)], ["net", formatMoney(data.netSales)], ["stock", data.stockUnits], ["low", data.lowStockCount]]) document.querySelector(`#dashboard-${id}`).textContent = value;
        const chart = document.querySelector("#sales-chart"); chart.replaceChildren();
        const daily = document.querySelector("#dashboard-daily"); daily.replaceChildren();
        const maximum = Math.max(1, ...data.daily.map(day => Math.max(Number(day.sales), Number(day.refunds))));
        const plot = document.createElement("div"); plot.className = "chart-bars";
        data.daily.forEach(day => {
            const column = document.createElement("div"); column.className = "chart-day";
            const tracks = document.createElement("div"); tracks.className = "chart-tracks";
            [["sales", day.sales], ["refunds", day.refunds]].forEach(([type, value]) => { const bar = document.createElement("div"); bar.className = `chart-bar chart-${type}`; bar.style.height = `${Math.max(0, Number(value)) / maximum * 100}%`; bar.title = `${day.date} · ${type === "sales" ? "Ventas" : "Devoluciones"}: ${formatMoney(value)}`; tracks.append(bar); });
            const label = document.createElement("span"); label.textContent = day.date.slice(5); column.append(tracks, label); plot.append(column);
            const row = document.createElement("tr"); [day.date,formatMoney(day.sales),formatMoney(day.refunds),formatMoney(day.net)].forEach(value => addCell(row,value)); daily.append(row);
        });
        chart.append(plot); results.hidden = false;
        message.textContent = Number(data.grossSales) === 0 && Number(data.refunds) === 0 ? "Sin movimientos monetarios en este periodo." : `Periodo: ${data.from} al ${data.to}.`;
    } catch (error) { if (version === dashboardLoadVersion) message.textContent = `No se pudieron cargar los indicadores: ${error.message}`; }
}
function reportSelection() {
    const form = document.querySelector("#report-form");
    const type = form.elements.type.value;
    return {type, params: type === "sales" ? dateRangeParams(form) : new URLSearchParams()};
}
async function loadReport() {
    if (getRole() !== "ADMIN") return;
    const version = ++reportLoadVersion;
    const message = document.querySelector("#report-message");
    message.textContent = "Cargando reporte…";
    document.querySelector("#report-body").replaceChildren(); document.querySelector("#report-summary").textContent = "";
    try {
        const {type, params} = reportSelection();
        const data = await api(`/reports/${type}?${params}`);
        if (version !== reportLoadVersion || getRole() !== "ADMIN") return;
        const head = document.querySelector("#report-head"), body = document.querySelector("#report-body");
        if (type === "sales") {
            fillTable(head, body, ["Fecha del movimiento", "Comprobante", "Estado / movimiento", "Venta", "Devolución", "Neto"], data.rows.map(row => [new Date(row.createdAt).toLocaleString("es-CO"),row.receiptNumber,row.status,formatMoney(row.total),formatMoney(row.refundedTotal),formatMoney(row.netTotal)]), "No hay movimientos en el periodo.");
            document.querySelector("#report-caption").textContent = `Ventas y devoluciones · ${data.from} al ${data.to}`;
            document.querySelector("#report-summary").textContent = `Ventas: ${formatMoney(data.grossSales)} · Devoluciones: ${formatMoney(data.refunds)} · Neto: ${formatMoney(data.netSales)}. Cada devolución se muestra en su propia fecha, aunque la venta sea anterior al periodo.`;
        } else {
            fillTable(head, body, ["SKU", "Producto", "Talla", "Color", "Stock", "Mínimo", "Precio", "Estado", "Stock bajo"], data.rows.map(row => [row.sku,row.productName,row.size,row.color,row.stock,row.minStock,formatMoney(row.price),row.active ? "Activo" : "Inactivo",row.lowStock ? "Sí" : "No"]), "No hay variantes registradas.");
            document.querySelector("#report-caption").textContent = "Inventario actual · sin filtro histórico";
            document.querySelector("#report-summary").textContent = `${data.stockUnits} unidades · ${data.lowStockCount} variantes con stock bajo.`;
        }
        message.textContent = `${data.rows.length} filas encontradas.`;
    } catch (error) { if (version === reportLoadVersion) message.textContent = `No se pudo cargar el reporte: ${error.message}`; }
}
async function exportReport(share = false) {
    if (!canOpenSection("reportes")) return;
    const buttons = document.querySelectorAll("#export-report, #share-report");
    const message = document.querySelector("#report-message");
    buttons.forEach(button => { button.disabled = true; });
    message.textContent = "Preparando archivo Excel…";
    try {
        const { type, params } = reportSelection();
        const response = await apiResponse(`/reports/${type}/export?${params}`, { headers: { Accept: workbookType } });
        if (!response.ok) throw new Error(`No se pudo exportar el reporte (${response.status}).`);
        const file = await response.blob();
        if (!file.size || file.type.split(";")[0] !== workbookType) throw new Error("La API no devolvió un archivo Excel válido.");
        const serverFilename = response.headers.get("Content-Disposition")?.match(/filename="([\w.-]+\.xlsx)"/i)?.[1];
        const filename = serverFilename || (type === "sales" ? `ventas-${params.get("from")}-${params.get("to")}.xlsx` : `inventario-${dateInBogota()}.xlsx`);
        if (share) {
            await navigator.share({ files: [new File([file], filename, { type: workbookType })] });
            message.textContent = "";
        } else {
            downloadFile(file, filename);
            message.textContent = "Archivo Excel descargado.";
        }
    } catch (error) {
        message.textContent = error.name === "AbortError" ? "" :
            share ? `${error.message} Puedes descargar el Excel.` : error.message;
    } finally {
        buttons.forEach(button => { button.disabled = false; });
    }
}
setupDateRange(document.querySelector("#dashboard-form"));
setupDateRange(document.querySelector("#report-form"));
document.querySelector("#dashboard-form").addEventListener("submit", event => { event.preventDefault(); refreshDashboard(); });
document.querySelector("#report-form").addEventListener("submit", event => { event.preventDefault(); loadReport(); });
document.querySelector("#export-report").addEventListener("click", () => { void exportReport(); });
document.querySelector("#share-report").hidden = !canShareFile("reporte.xlsx", workbookType);
document.querySelector("#share-report").addEventListener("click", () => { void exportReport(true); });
function syncReportType() {
    const inventory = document.querySelector("#report-type").value === "inventory";
    for (const name of ["from", "to"]) {
        document.querySelector(`#report-${name}-label`).hidden = inventory;
        document.querySelector("#report-form").elements[name].disabled = inventory;
    }
}
document.querySelector("#report-type").addEventListener("change", () => {
    syncReportType();
    void loadReport();
});
document.querySelector("#return-form").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget, button = document.querySelector("#submit-return");
    const reason = form.elements.reason.value.trim();
    if (!reason) { form.elements.reason.setCustomValidity("Escribe el motivo de la devolución."); form.elements.reason.reportValidity(); return; }
    if (!currentReceipt || currentReturn || button.disabled) return;
    if (!window.confirm(`¿Registrar la devolución total de ${currentReceipt.receiptNumber} por ${formatMoney(currentReceipt.total)}? Se restituirán todos sus artículos al inventario.`)) return;
    const receiptNumber = currentReceipt.receiptNumber;
    button.disabled = true;
    setReceiptActions(false);
    try {
        const returned = await api(`/sales/${encodeURIComponent(receiptNumber)}/return`, {method:"POST",body:JSON.stringify({reason})});
        if (currentReceipt?.receiptNumber === receiptNumber) { currentReturn = returned; renderReturnState(); }
        showNotice("Devolución registrada. El inventario se ha restituido.");
        const updates = await Promise.allSettled([refreshProducts(), refreshMovements(), loadHistory(), loadDailySummary()]);
        if (updates.some(result => result.status === "rejected")) showNotice("Devolución guardada. Actualiza el inventario para consultar sus existencias.",true);
    } catch (error) {
        if (currentReceipt?.receiptNumber !== receiptNumber) return;
        document.querySelector("#return-status").textContent = `No se pudo registrar la devolución: ${error.message}`;
        if ([400, 403, 404, 422].includes(error.status)) setReceiptActions(true);
        else await loadReceipt(receiptNumber).catch(cause => { document.querySelector("#return-status").textContent = cause.message; });
    } finally { button.disabled = false; }
});
document.querySelector("#return-form").elements.reason.addEventListener("input", event => event.target.setCustomValidity(""));

const hasSession = Boolean(getToken() && staff.includes(getRole()));
document.querySelectorAll(".table-wrap").forEach(wrapper => {
    const title = wrapper.closest(".content-card")?.querySelector("h2, h3")?.textContent;
    const caption = wrapper.querySelector("caption")?.textContent;
    wrapper.tabIndex = 0;
    wrapper.setAttribute("role", "region");
    wrapper.setAttribute("aria-label", title || (caption ? "Resultados del reporte" : "Tabla de datos"));
});
setAuthenticated(hasSession);
renderCart();
if (getToken() && !hasSession) {
    void logout("Inicia sesión nuevamente para cargar los permisos de tu rol.");
} else if (hasSession) {
    restoreSection();
}
window.addEventListener("pageshow", () => {
    if (!getToken()) {
        setAuthenticated(false);
        document.querySelectorAll("dialog[open]").forEach(dialog => dialog.close());
    }
});
