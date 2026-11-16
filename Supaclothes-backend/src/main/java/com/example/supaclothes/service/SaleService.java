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
import com.example.supaclothes.repository.CustomerRepository;
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
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class SaleService {

    private final SaleRepository saleRepository;
    private final CustomerRepository customerRepository;
    private final ProductVariantRepository productVariantRepository;
    private final UserRepository userRepository;
    private final InventoryMovementRepository inventoryMovementRepository;
    private final PaymentRepository paymentRepository;

    public SaleService(
            SaleRepository saleRepository,
            CustomerRepository customerRepository,
            ProductVariantRepository productVariantRepository,
            UserRepository userRepository,
            InventoryMovementRepository inventoryMovementRepository,
            PaymentRepository paymentRepository) {
        this.saleRepository = saleRepository;
        this.customerRepository = customerRepository;
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
        String idempotencyKey = request.idempotencyKey();
        if (idempotencyKey != null && !idempotencyKey.matches(
                "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La referencia de operación no es válida");
        }

        User seller = userRepository.findByUsername(sellerUsername)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Vendedor no encontrado"));

        var customer = request.customerId() == null ? null : customerRepository.findById(request.customerId().longValue())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cliente no encontrado"));
        BigDecimal discount = request.discountPercent() == null ? BigDecimal.ZERO : request.discountPercent();
        if (discount.scale() > 2 || discount.compareTo(BigDecimal.ZERO) < 0 || discount.compareTo(new BigDecimal("100")) > 0)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El descuento debe estar entre 0 y 100, con máximo dos decimales");
        if (discount.signum() > 0 && seller.getAuthorities().stream().noneMatch(a -> a.getAuthority().equals("ROLE_ADMIN")))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo un administrador puede aplicar descuentos");
        Sale sale = new Sale();
        String receipt = "FAC-" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmssSSS"))
                + "-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
        sale.setReceiptNumber(receipt);
        sale.setIdempotencyKey(idempotencyKey);
        sale.setSellerId(seller.getId());
        sale.setCustomerId(request.customerId());
        sale.setCustomerNameAtSale(customer == null ? null : customer.getName());
        sale.setStatus("CONFIRMADA");
        
        sale.setDiscountPercent(discount);
        sale.setDiscountValue(BigDecimal.ZERO);
        sale.setDiscountBeforeTax(true);

        BigDecimal subtotal = BigDecimal.ZERO;
        BigDecimal taxTotal = BigDecimal.ZERO;
        var movements = new ArrayList<InventoryMovement>();

        // Todas las operaciones de varias variantes toman los bloqueos en orden de ID.
        var requestedIds = new java.util.TreeSet<Long>();
        for (SaleItemRequest item : request.items()) {
            if (item == null || item.sku() == null || item.sku().isBlank() || item.quantity() <= 0)
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "SKU y cantidad positiva son obligatorios");
            requestedIds.add(productVariantRepository.findIdBySku(item.sku())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "SKU no encontrado: " + item.sku())));
        }
        for (Long id : requestedIds) {
            productVariantRepository.findByIdForUpdate(id)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "La variante ya no existe"));
        }
        if (idempotencyKey != null) {
            Sale previousOperation = saleRepository.findByIdempotencyKey(idempotencyKey).orElse(null);
            if (previousOperation != null) {
                if (!seller.getId().equals(previousOperation.getSellerId())) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "La referencia de operación ya fue utilizada");
                }
                if (!sameOperation(previousOperation, request, discount)) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "La referencia ya existe con datos diferentes");
                }
                return previousOperation;
            }
        }
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
            BigDecimal itemDiscount = itemSubtotal.multiply(discount)
                    .divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP);
            BigDecimal discountedBase = itemSubtotal.subtract(itemDiscount).setScale(2, RoundingMode.HALF_UP);
            BigDecimal itemTax = discountedBase.multiply(taxRate).setScale(2, RoundingMode.HALF_UP);
            BigDecimal lineTotal = discountedBase.add(itemTax).setScale(2, RoundingMode.HALF_UP);

            subtotal = subtotal.add(itemSubtotal);
            taxTotal = taxTotal.add(itemTax);
            sale.setDiscountValue(sale.getDiscountValue().add(itemDiscount));

            SaleItem saleItem = new SaleItem();
            saleItem.setVariant(variant);
            saleItem.setQuantity(itemReq.quantity());
            saleItem.setUnitPrice(unitPrice);
            saleItem.setTaxRate(taxRate);
            saleItem.setDiscountValue(itemDiscount);
            saleItem.setTaxValue(itemTax);
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
        BigDecimal discountValue = sale.getDiscountValue().setScale(2, RoundingMode.HALF_UP);
        sale.setDiscountValue(discountValue);
        if (discount.signum() > 0) sale.setDiscountUserId(Math.toIntExact(seller.getId()));
        BigDecimal total = subtotal.subtract(discountValue).add(taxTotal).setScale(2, RoundingMode.HALF_UP);
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
        String customerName = sale.getCustomerNameAtSale();
        if (customerName == null && sale.getCustomerId() != null) {
            customerName = customerRepository.findById(sale.getCustomerId().longValue())
                    .map(customer -> customer.getName())
                    .orElse("Cliente no disponible");
        }
        boolean discountBeforeTax = sale.isDiscountBeforeTax();
        var items = sale.getItems().stream()
                .map(item -> {
                    BigDecimal itemSubtotal = item.getUnitPrice().multiply(BigDecimal.valueOf(item.getQuantity()));
                    BigDecimal itemDiscount = discountBeforeTax ? item.getDiscountValue() : null;
                    BigDecimal itemTax = discountBeforeTax
                            ? item.getTaxValue()
                            : item.getLineTotal().subtract(itemSubtotal).setScale(2, RoundingMode.HALF_UP);
                    return new SaleReceiptResponse.Item(
                            item.getSkuAtSale() == null ? item.getVariant().getSku() : item.getSkuAtSale(),
                            item.getProductNameAtSale() == null ? item.getVariant().getProduct().getName() : item.getProductNameAtSale(),
                            item.getSizeAtSale() == null ? item.getVariant().getSize() : item.getSizeAtSale(),
                            item.getColorAtSale() == null ? item.getVariant().getColor() : item.getColorAtSale(),
                            item.getQuantity(),
                            item.getUnitPrice(),
                            itemDiscount,
                            itemTax,
                            item.getLineTotal());
                })
                .toList();
        return new SaleReceiptResponse(
                sale.getReceiptNumber(), sale.getCreatedAt(), sellerName,
                customerName == null ? "Consumidor final" : customerName, items,
                sale.getSubtotal(), sale.getTaxTotal(), sale.getDiscountPercent(), sale.getDiscountValue(),
                discountBeforeTax, sale.getTotal(),
                payment.getMethod(), payment.getAmountReceived(), payment.getChangeGiven());
    }

    private boolean sameOperation(Sale savedSale, SaleRequest request, BigDecimal discount) {
        if (!Objects.equals(savedSale.getCustomerId(), request.customerId())
                || savedSale.getDiscountPercent().compareTo(discount) != 0) {
            return false;
        }

        Map<String, Integer> requestedItems = new TreeMap<>();
        for (SaleItemRequest item : request.items()) {
            requestedItems.merge(item.sku(), item.quantity(), Integer::sum);
        }
        Map<String, Integer> savedItems = new TreeMap<>();
        for (SaleItem item : savedSale.getItems()) {
            savedItems.merge(item.getSkuAtSale(), item.getQuantity(), Integer::sum);
        }
        if (!requestedItems.equals(savedItems)) {
            return false;
        }

        Payment payment = paymentRepository.findBySaleId(savedSale.getId()).orElse(null);
        return payment != null
                && payment.getMethod().equals(request.paymentMethod().trim().toUpperCase(Locale.ROOT))
                && payment.getAmountReceived().compareTo(request.amountReceived()) == 0;
    }
}