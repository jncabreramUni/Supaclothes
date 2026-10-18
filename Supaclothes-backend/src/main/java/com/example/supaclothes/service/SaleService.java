package com.example.supaclothes.service;

import com.example.supaclothes.dto.SaleItemRequest;
import com.example.supaclothes.dto.SaleReceiptResponse;
import com.example.supaclothes.dto.SaleRequest;
import com.example.supaclothes.entity.InventoryMovement;
import com.example.supaclothes.entity.Payment;
import com.example.supaclothes.entity.ProductVariant;
import com.example.supaclothes.entity.Sale;
import com.example.supaclothes.entity.SaleItem;
import com.example.supaclothes.entity.User;
import com.example.supaclothes.repository.InventoryMovementRepository;
import com.example.supaclothes.repository.PaymentRepository;
import com.example.supaclothes.repository.ProductVariantRepository;
import com.example.supaclothes.repository.SaleRepository;
import com.example.supaclothes.repository.UserRepository;
import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class SaleService {

    private final SaleRepository saleRepository;
    private final ProductVariantRepository productVariantRepository;
    private final UserRepository userRepository;
    private final InventoryMovementRepository inventoryMovementRepository;
    private final PaymentRepository paymentRepository;

    public SaleService(
            SaleRepository saleRepository,
            ProductVariantRepository productVariantRepository,
            UserRepository userRepository,
            InventoryMovementRepository inventoryMovementRepository,
            PaymentRepository paymentRepository) {
        this.saleRepository = saleRepository;
        this.productVariantRepository = productVariantRepository;
        this.userRepository = userRepository;
        this.inventoryMovementRepository = inventoryMovementRepository;
        this.paymentRepository = paymentRepository;
    }

    @Transactional
    public Sale createSale(SaleRequest request, String sellerUsername) {
        if (request == null || request.items() == null || request.items().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La venta debe incluir al menos un artículo");
        }
        if (request.paymentMethod() == null || request.amountReceived() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El método de pago y el valor recibido son obligatorios");
        }

        User seller = userRepository.findByUsername(sellerUsername)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Vendedor no encontrado"));

        Sale sale = new Sale();
        String receipt = "FAC-" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmssSSS"))
                + "-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
        sale.setReceiptNumber(receipt);
        sale.setSellerId(seller.getId());
        sale.setCustomerId(request.customerId());
        sale.setStatus("CONFIRMADA");
        
        sale.setDiscountPercent(BigDecimal.ZERO);
        sale.setDiscountValue(BigDecimal.ZERO);

        BigDecimal subtotal = BigDecimal.ZERO;
        BigDecimal taxTotal = BigDecimal.ZERO;
        var movements = new ArrayList<InventoryMovement>();

        for (SaleItemRequest itemReq : request.items()) {
            if (itemReq == null || itemReq.sku() == null || itemReq.sku().isBlank() || itemReq.quantity() <= 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "SKU y cantidad positiva son obligatorios");
            }

            ProductVariant variant = productVariantRepository.findBySkuForUpdate(itemReq.sku())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "SKU no encontrado: " + itemReq.sku()));

            if (!variant.isActive() || !variant.getProduct().isActive()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "El producto " + itemReq.sku() + " está inactivo");
            }

            if (variant.getCurrentStock() < itemReq.quantity()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Stock insuficiente para " + itemReq.sku() + ". Disponible: " + variant.getCurrentStock());
            }

            BigDecimal unitPrice = variant.getPrice();
            BigDecimal taxRate = variant.getTaxRate();
            
            BigDecimal itemSubtotal = unitPrice.multiply(BigDecimal.valueOf(itemReq.quantity())).setScale(2, RoundingMode.HALF_UP);
            BigDecimal itemTax = itemSubtotal.multiply(taxRate).setScale(2, RoundingMode.HALF_UP);
            BigDecimal lineTotal = itemSubtotal.add(itemTax).setScale(2, RoundingMode.HALF_UP);

            subtotal = subtotal.add(itemSubtotal);
            taxTotal = taxTotal.add(itemTax);

            SaleItem saleItem = new SaleItem();
            saleItem.setVariant(variant);
            saleItem.setQuantity(itemReq.quantity());
            saleItem.setUnitPrice(unitPrice);
            saleItem.setTaxRate(taxRate);
            saleItem.setLineTotal(lineTotal);
            saleItem.setSkuAtSale(variant.getSku());
            saleItem.setProductNameAtSale(variant.getProduct().getName());
            saleItem.setSizeAtSale(variant.getSize());
            saleItem.setColorAtSale(variant.getColor());
            
            sale.addItem(saleItem);

            int previousStock = variant.getCurrentStock();
            int newStock = previousStock - itemReq.quantity();
            variant.setCurrentStock(newStock);
            productVariantRepository.save(variant);

            InventoryMovement movement = new InventoryMovement();
            movement.setVariantId(variant.getId());
            movement.setSkuAtMovement(variant.getSku());
            movement.setUserId(seller.getId());
            movement.setType("SALIDA_VENTA");
            movement.setQuantity(itemReq.quantity());
            movement.setPreviousStock(previousStock);
            movement.setResultingStock(newStock);
            movement.setReference("Venta comprobante: " + receipt);
            
            movements.add(movement);
        }

        subtotal = subtotal.setScale(2, RoundingMode.HALF_UP);
        taxTotal = taxTotal.setScale(2, RoundingMode.HALF_UP);
        BigDecimal total = subtotal.add(taxTotal).setScale(2, RoundingMode.HALF_UP);
        sale.setSubtotal(subtotal);
        sale.setTaxTotal(taxTotal);
        sale.setTotal(total);

        String method = request.paymentMethod().trim().toUpperCase(Locale.ROOT);
        if (!List.of("EFECTIVO", "TARJETA", "TRANSFERENCIA").contains(method)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Método de pago inválido");
        }
        BigDecimal amountReceived = request.amountReceived().setScale(2, RoundingMode.HALF_UP);
        BigDecimal change;
        if ("EFECTIVO".equals(method)) {
            if (amountReceived.compareTo(total) < 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El efectivo recibido no cubre el total");
            }
            change = amountReceived.subtract(total).setScale(2, RoundingMode.HALF_UP);
        } else {
            if (amountReceived.compareTo(total) != 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El valor recibido debe coincidir con el total");
            }
            change = BigDecimal.ZERO.setScale(2);
        }

        Sale savedSale = saleRepository.save(sale);
        for (InventoryMovement movement : movements) {
            movement.setSaleId(savedSale.getId());
            inventoryMovementRepository.save(movement);
        }
        Payment payment = new Payment();
        payment.setSaleId(savedSale.getId());
        payment.setMethod(method);
        payment.setAmountReceived(amountReceived);
        payment.setChangeGiven(change);
        paymentRepository.save(payment);
        return savedSale;
    }

    @Transactional(readOnly = true)
    public SaleReceiptResponse getReceipt(String receiptNumber) {
        Sale sale = saleRepository.findByReceiptNumber(receiptNumber)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Comprobante no encontrado"));
        Payment payment = paymentRepository.findBySaleId(sale.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pago no encontrado para el comprobante"));
        String sellerName = userRepository.findById(sale.getSellerId())
                .map(User::getFullName)
                .orElse("Usuario desconocido");
        var items = sale.getItems().stream()
                .map(item -> new SaleReceiptResponse.Item(
                        item.getSkuAtSale() == null ? item.getVariant().getSku() : item.getSkuAtSale(),
                        item.getProductNameAtSale() == null ? item.getVariant().getProduct().getName() : item.getProductNameAtSale(),
                        item.getSizeAtSale() == null ? item.getVariant().getSize() : item.getSizeAtSale(),
                        item.getColorAtSale() == null ? item.getVariant().getColor() : item.getColorAtSale(),
                        item.getQuantity(),
                        item.getUnitPrice(),
                        item.getLineTotal()))
                .toList();
        return new SaleReceiptResponse(
                sale.getReceiptNumber(), sale.getCreatedAt(), sellerName, items,
                sale.getSubtotal(), sale.getTaxTotal(), sale.getTotal(),
                payment.getMethod(), payment.getAmountReceived(), payment.getChangeGiven());
    }
}