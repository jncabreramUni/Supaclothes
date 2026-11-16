function makeReceiptPdf(receipt, returned, { money, dateTime }) {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: "mm", format: "a4", putOnlyUsedFonts: true, compress: true });
    pdf.setProperties({ title: `Comprobante interno ${receipt.receiptNumber}`, author: "SupaClothes" });
    const margin = 18;
    const width = pdf.internal.pageSize.getWidth() - 2 * margin;
    const pageBottom = pdf.internal.pageSize.getHeight() - margin;
    const latin = /^[\u0020-\u007e\u00a0-\u00ff\u2013\u2014\u2018-\u201d\u2022\u2026\u20ac]*$/u;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    let y = margin;

    function drawLine(line, size, bold) {
        if (latin.test(line)) {
            pdf.text(line, margin, y);
            return;
        }
        // Draw characters outside the PDF standard font with the browser's system fonts.
        const font = `${bold ? "bold" : "normal"} ${size * 3}px Inter, "Segoe UI", sans-serif`;
        context.font = font;
        const measured = Math.ceil(context.measureText(line).width);
        canvas.width = Math.max(1, measured + 6);
        canvas.height = Math.ceil(size * 4.4);
        context.font = font;
        context.fillStyle = "#162235";
        context.fillText(line, 2, size * 3.2);
        const scale = Math.min(0.3528 / 3, width / canvas.width);
        pdf.addImage(canvas, "PNG", margin, y - size * 3.2 * scale, canvas.width * scale, canvas.height * scale);
    }

    function write(value, size = 11, bold = false) {
        pdf.setFont("helvetica", bold ? "bold" : "normal");
        pdf.setFontSize(size);
        pdf.setTextColor("#162235");
        const lines = pdf.splitTextToSize(String(value ?? ""), width);
        for (const line of lines) {
            if (y > pageBottom) {
                pdf.addPage();
                y = margin;
            }
            drawLine(line, size, bold);
            y += size * 0.48;
        }
    }

    write("SupaClothes", 22, true);
    write(`Comprobante interno ${receipt.receiptNumber}`, 15, true);
    write("Documento interno de venta. No es una factura electrónica.");
    write(`Fecha: ${dateTime(receipt.createdAt)}`);
    write(`Vendedor: ${receipt.sellerName ?? ""}`);
    write(`Cliente: ${receipt.customerName || "Consumidor final"}`);
    if (returned) {
        y += 3;
        write("VENTA DEVUELTA", 13, true);
        write(`Fecha: ${dateTime(returned.createdAt)} · Valor: ${money(returned.refundTotal)}`);
        write(`Motivo: ${returned.reason}`);
    }
    y += 5;
    write("Artículos", 13, true);
    for (const item of receipt.items) {
        write(`${item.sku} · ${item.productName} (${item.size} / ${item.color})`, 11, true);
        write(`${item.quantity} × ${money(item.unitPrice)} · Impuesto: ${money(item.taxValue)} · Total: ${money(item.lineTotal)}`);
        if (receipt.discountBeforeTax && item.discountValue) write(`Descuento de la línea: ${money(item.discountValue)}`);
        y += 2;
    }
    y += 3;
    write(`Subtotal: ${money(receipt.subtotal)} · Impuestos: ${money(receipt.taxTotal)}`);
    write(`Descuento (${receipt.discountPercent}%): ${money(receipt.discountValue)}`);
    write(`Total: ${money(receipt.total)}`, 15, true);
    write(`Pago: ${receipt.paymentMethod} · Recibido: ${money(receipt.amountReceived)} · Cambio: ${money(receipt.changeGiven)}`);
    return pdf.output("blob");
}
