package com.example.supaclothes.service;

import com.example.supaclothes.dto.InventoryEntryRequest;
import com.example.supaclothes.entity.InventoryMovement;
import com.example.supaclothes.entity.ProductVariant;
import com.example.supaclothes.entity.User;
import com.example.supaclothes.repository.InventoryMovementRepository;
import com.example.supaclothes.repository.ProductVariantRepository;
import com.example.supaclothes.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InventoryService {

    private final ProductVariantRepository productVariantRepository;
    private final InventoryMovementRepository inventoryMovementRepository;
    private final UserRepository userRepository;

    public InventoryService(
            ProductVariantRepository productVariantRepository,
            InventoryMovementRepository inventoryMovementRepository,
            UserRepository userRepository) {
        this.productVariantRepository = productVariantRepository;
        this.inventoryMovementRepository = inventoryMovementRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public InventoryMovement registerEntry(InventoryEntryRequest request, String username) {
        // 1. Validar cantidad lógica
        if (request.quantity() <= 0) {
            throw new RuntimeException("Error: La cantidad a ingresar debe ser mayor a cero.");
        }

        // 2. Buscar la variante por su SKU
        ProductVariant variant = productVariantRepository.findBySku(request.sku())
                .orElseThrow(() -> new RuntimeException("Error: No se encontró ninguna variante con el SKU " + request.sku()));
        // ---> ¡NUEVA REGLA DE NEGOCIO AÑADIDA! <---
        if (!variant.isActive()) {
            throw new RuntimeException("Error: No se puede ingresar inventario a un producto inactivo o descatalogado.");
        }
        // 3. Buscar el usuario que está haciendo la operación (viene del JWT)
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("Error: Usuario no encontrado."));

        // 4. Capturar el estado antes del cambio
        int previousStock = variant.getCurrentStock();
        int newStock = previousStock + request.quantity();

        // 5. Actualizar el stock en la variante
        variant.setCurrentStock(newStock);
        productVariantRepository.save(variant);

        // 6. Crear el registro de auditoría (Trazabilidad)
        InventoryMovement movement = new InventoryMovement();
        movement.setVariantId(variant.getId());
        movement.setUserId(user.getId());
        movement.setType("ENTRADA");
        movement.setQuantity(request.quantity());
        movement.setPreviousStock(previousStock);
        movement.setResultingStock(newStock);
        movement.setReference(request.reference());

        // 7. Guardar el movimiento
        return inventoryMovementRepository.save(movement);
    }
}