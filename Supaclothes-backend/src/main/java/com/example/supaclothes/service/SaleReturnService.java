package com.example.supaclothes.service;

import com.example.supaclothes.dto.ReturnRequest;
import com.example.supaclothes.dto.ReturnResponse;
import com.example.supaclothes.entity.*;
import com.example.supaclothes.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.util.TreeMap;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.PersistenceContext;

@Service
public class SaleReturnService {
    private final SaleRepository sales;
    private final SaleReturnRepository returns;
    private final ProductVariantRepository variants;
    private final InventoryMovementRepository movements;
    private final UserRepository users;
    @PersistenceContext private EntityManager entityManager;

    public SaleReturnService(SaleRepository sales, SaleReturnRepository returns,
                             ProductVariantRepository variants, InventoryMovementRepository movements,
                             UserRepository users) {
        this.sales = sales; this.returns = returns; this.variants = variants;
        this.movements = movements; this.users = users;
    }

    @Transactional
    public ReturnResponse create(String receiptNumber, ReturnRequest request, String username) {
        if (request == null || request.reason() == null || request.reason().isBlank() || request.reason().trim().length() > 500)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Indica el motivo de devolución (máximo 500 caracteres)");
        Sale sale = sales.findByReceiptNumberForUpdate(receiptNumber)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Venta no encontrada"));
        if (!"CONFIRMADA".equals(sale.getStatus()) || returns.existsBySaleId(sale.getId()))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "La venta ya fue devuelta o no está confirmada");
        User user = users.findByUsername(username)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));
        if (sale.getItems().isEmpty())
            throw new ResponseStatusException(HttpStatus.CONFLICT, "La venta no contiene artículos que puedan devolverse");

        // Consolidar líneas repetidas y bloquear variantes en el mismo orden para todas las devoluciones.
        var quantities = new TreeMap<Long, Integer>();
        for (SaleItem item : sale.getItems()) {
            try { quantities.merge(item.getVariant().getId(), item.getQuantity(), Math::addExact); }
            catch (ArithmeticException e) { throw stockOverflow(); }
        }
        String reason = request.reason().trim();
        for (var entry : quantities.entrySet()) {
            ProductVariant variant = variants.findByIdForUpdate(entry.getKey())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "La variante de la venta ya no existe"));
            // Un bloqueo no refresca entidades que ya estaban en el contexto de persistencia.
            entityManager.refresh(variant, LockModeType.PESSIMISTIC_WRITE);
            int previous = variant.getCurrentStock();
            int resulting;
            try { resulting = Math.addExact(previous, entry.getValue()); }
            catch (ArithmeticException e) { throw stockOverflow(); }
            variant.setCurrentStock(resulting);
            variants.save(variant);
            InventoryMovement movement = new InventoryMovement();
            movement.setVariantId(variant.getId()); movement.setSkuAtMovement(variant.getSku());
            movement.setUserId(user.getId()); movement.setSaleId(sale.getId());
            movement.setType("ENTRADA_DEVOLUCION"); movement.setQuantity(entry.getValue());
            movement.setPreviousStock(previous); movement.setResultingStock(resulting);
            String reference = "Devolución " + receiptNumber + ": " + reason;
            movement.setReference(reference.substring(0, Math.min(reference.length(), 150)));
            movements.save(movement);
        }
        SaleReturn returned = new SaleReturn();
        returned.setSaleId(sale.getId()); returned.setReceiptNumber(receiptNumber);
        returned.setReason(reason); returned.setUserId(user.getId());
        // Usar el total cobrado originalmente, incluidos impuestos y descuento; no recalcular precios actuales.
        returned.setRefundTotal(sale.getTotal());
        sale.setStatus("DEVUELTA");
        sales.save(sale);
        return response(returns.save(returned));
    }

    @Transactional(readOnly = true)
    public ReturnResponse get(String receiptNumber) {
        return returns.findByReceiptNumber(receiptNumber).map(this::response)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Esta venta no tiene una devolución registrada"));
    }

    private ReturnResponse response(SaleReturn returned) {
        return new ReturnResponse(returned.getId(), returned.getSaleId(), returned.getReceiptNumber(),
                returned.getReason(), returned.getRefundTotal(), returned.getCreatedAt(), returned.getUserId());
    }

    private ResponseStatusException stockOverflow() {
        return new ResponseStatusException(HttpStatus.CONFLICT, "La devolución excede el stock máximo permitido");
    }
}
