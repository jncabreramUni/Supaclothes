package com.example.supaclothes.controller;

import com.example.supaclothes.dto.InventoryEntryRequest;
import com.example.supaclothes.entity.InventoryMovement;
import com.example.supaclothes.repository.InventoryMovementRepository;
import com.example.supaclothes.repository.ProductRepository;
import com.example.supaclothes.entity.Product;
import com.example.supaclothes.dto.InventoryMovementResponse;
import com.example.supaclothes.repository.ProductVariantRepository;
import com.example.supaclothes.repository.UserRepository;
import com.example.supaclothes.service.InventoryService;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.GetMapping;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/inventory")
@SecurityRequirement(name = "bearerAuth")
public class InventoryController {

    private final InventoryService inventoryService;
    private final InventoryMovementRepository movementRepository;
    private final ProductRepository productRepository;
    private final ProductVariantRepository variantRepository;
    private final UserRepository userRepository;

    public InventoryController(
            InventoryService inventoryService,
            InventoryMovementRepository movementRepository,
            ProductRepository productRepository,
            ProductVariantRepository variantRepository,
            UserRepository userRepository) {
        this.inventoryService = inventoryService;
        this.movementRepository = movementRepository;
        this.productRepository = productRepository;
        this.variantRepository = variantRepository;
        this.userRepository = userRepository;
    }

    @GetMapping
    public ResponseEntity<List<Product>> getInventory() {
        return ResponseEntity.ok(productRepository.findAll());
    }

    @GetMapping("/movements")
    public ResponseEntity<List<InventoryMovementResponse>> getMovements() {
        List<InventoryMovementResponse> movements = movementRepository.findTop100ByOrderByCreatedAtDesc()
                .stream()
                .map(movement -> new InventoryMovementResponse(
                        movement.getId(),
                        movement.getSkuAtMovement() != null
                                ? movement.getSkuAtMovement()
                                : variantRepository.findById(movement.getVariantId())
                                        .map(variant -> variant.getSku()).orElse("SKU eliminado"),
                        movement.getType(),
                        movement.getQuantity(),
                        movement.getPreviousStock(),
                        movement.getResultingStock(),
                        userRepository.findById(movement.getUserId())
                                .map(user -> user.getUsername()).orElse("Usuario eliminado"),
                        movement.getReference(),
                        movement.getCreatedAt()))
                .toList();
        return ResponseEntity.ok(movements);
    }

    @PostMapping("/entries")
    public ResponseEntity<InventoryMovement> registerEntry(
            @RequestBody InventoryEntryRequest request,
            Principal principal) {
        String username = principal.getName();
        InventoryMovement movement = inventoryService.registerEntry(request, username);
        return ResponseEntity.status(HttpStatus.CREATED).body(movement);
    }
}