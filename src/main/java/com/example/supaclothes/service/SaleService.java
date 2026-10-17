package com.example.supaclothes.service;

import com.example.supaclothes.dto.SaleItemRequest;
import com.example.supaclothes.dto.SaleRequest;
import com.example.supaclothes.entity.InventoryMovement;
import com.example.supaclothes.entity.ProductVariant;
import com.example.supaclothes.entity.Sale;
import com.example.supaclothes.entity.SaleItem;
import com.example.supaclothes.entity.User;
import com.example.supaclothes.repository.InventoryMovementRepository;
import com.example.supaclothes.repository.ProductVariantRepository;
import com.example.supaclothes.repository.SaleRepository;
import com.example.supaclothes.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@Service
public class SaleService {

    private final SaleRepository saleRepository;
    private final ProductVariantRepository productVariantRepository;
    private final UserRepository userRepository;
    private final InventoryMovementRepository inventoryMovementRepository;

    public SaleService(
            SaleRepository saleRepository,
            ProductVariantRepository productVariantRepository,
            UserRepository userRepository,
            InventoryMovementRepository inventoryMovementRepository) {
        this.saleRepository = saleRepository;
        this.productVariantRepository = productVariantRepository;
        this.userRepository = userRepository;
        this.inventoryMovementRepository = inventoryMovementRepository;
    }

    @Transactional
    public Sale createSale(SaleRequest request, String sellerUsername) {
        // 1. Identificar al vendedor usando el token JWT
        User seller = userRepository.findByUsername(sellerUsername)
                .orElseThrow(() -> new RuntimeException("Error: Vendedor no encontrado."));

        // 2. Inicializar la cabecera de la factura
        Sale sale = new Sale();
        String receipt = "FAC-" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
        sale.setReceiptNumber(receipt);
        sale.setSellerId(seller.getId());
        sale.setCustomerId(request.customerId());
        sale.setStatus("CONFIRMADA");
        
        // Dejamos descuentos en cero por ahora (hasta la HU-09)
        sale.setDiscountPercent(BigDecimal.ZERO);
        sale.setDiscountValue(BigDecimal.ZERO);

        BigDecimal subtotal = BigDecimal.ZERO;
        BigDecimal taxTotal = BigDecimal.ZERO;

        // 3. Procesar el carrito de compras
        for (SaleItemRequest itemReq : request.items()) {
            if (itemReq.quantity() <= 0) {
                throw new RuntimeException("Error: La cantidad a vender debe ser mayor a cero.");
            }

            ProductVariant variant = productVariantRepository.findBySku(itemReq.sku())
                    .orElseThrow(() -> new RuntimeException("Error: SKU no encontrado: " + itemReq.sku()));

            if (!variant.isActive()) {
                throw new RuntimeException("Error: El producto " + itemReq.sku() + " está descatalogado.");
            }

            // REGLA DE NEGOCIO: Validar que haya inventario suficiente
            if (variant.getCurrentStock() < itemReq.quantity()) {
                throw new RuntimeException("Error: Stock insuficiente para " + itemReq.sku() + ". Disponible: " + variant.getCurrentStock());
            }

            // 4. Cálculos financieros precisos
            BigDecimal unitPrice = variant.getPrice();
            BigDecimal taxRate = variant.getTaxRate();
            
            BigDecimal itemSubtotal = unitPrice.multiply(new BigDecimal(itemReq.quantity()));
            BigDecimal itemTax = itemSubtotal.multiply(taxRate);
            BigDecimal lineTotal = itemSubtotal.add(itemTax);

            subtotal = subtotal.add(itemSubtotal);
            taxTotal = taxTotal.add(itemTax);

            // 5. Ensamblar la línea de venta
            SaleItem saleItem = new SaleItem();
            saleItem.setVariant(variant);
            saleItem.setQuantity(itemReq.quantity());
            saleItem.setUnitPrice(unitPrice);
            saleItem.setTaxRate(taxRate);
            saleItem.setLineTotal(lineTotal);
            
            sale.addItem(saleItem); // El método que creamos en la entidad

            // 6. Descontar Stock y generar Trazabilidad (HU-04 y HU-07 se unen aquí)
            int previousStock = variant.getCurrentStock();
            int newStock = previousStock - itemReq.quantity();
            variant.setCurrentStock(newStock);
            productVariantRepository.save(variant);

            InventoryMovement movement = new InventoryMovement();
            movement.setVariantId(variant.getId());
            movement.setUserId(seller.getId());
            movement.setType("SALIDA_VENTA");
            movement.setQuantity(itemReq.quantity());
            movement.setPreviousStock(previousStock);
            movement.setResultingStock(newStock);
            movement.setReference("Venta comprobante: " + receipt);
            
            inventoryMovementRepository.save(movement);
        }

        // 7. Consolidar totales finales y guardar todo
        sale.setSubtotal(subtotal);
        sale.setTaxTotal(taxTotal);
        sale.setTotal(subtotal.add(taxTotal));

        return saleRepository.save(sale);
    }
}