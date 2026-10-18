package com.example.supaclothes.controller;

import com.example.supaclothes.dto.ProductRequest;
import com.example.supaclothes.dto.ProductUpdateRequest;
import com.example.supaclothes.dto.ProductVariantRequest;
import com.example.supaclothes.entity.Product;
import com.example.supaclothes.service.ProductService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;

import java.util.List;

@RestController
@RequestMapping("/api/products")
@SecurityRequirement(name = "bearerAuth")
public class ProductController {

    private final ProductService productService;

    public ProductController(ProductService productService) {
        this.productService = productService;
    }

    // Endpoint para listar todos los productos
    @GetMapping
    public ResponseEntity<List<Product>> getAllProducts() {
        return ResponseEntity.ok(productService.getAllProducts());
    }

    // Endpoint para crear el producto con sus variantes
    @PostMapping
    public ResponseEntity<Product> createProduct(@RequestBody ProductRequest request) {
        return ResponseEntity.status(201).body(productService.createProduct(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Product> updateProduct(
            @PathVariable Long id,
            @RequestBody ProductUpdateRequest request) {
        return ResponseEntity.ok(productService.updateProduct(id, request));
    }

    @PostMapping("/{id}/variants")
    public ResponseEntity<Product> addVariant(
            @PathVariable Long id,
            @RequestBody ProductVariantRequest request) {
        return ResponseEntity.status(201).body(productService.addVariant(id, request));
    }

    @PutMapping("/{productId}/variants/{variantId}")
    public ResponseEntity<Product> updateVariant(
            @PathVariable Long productId,
            @PathVariable Long variantId,
            @RequestBody ProductVariantRequest request) {
        return ResponseEntity.ok(productService.updateVariant(productId, variantId, request));
    }

    @PatchMapping("/{productId}/variants/{variantId}/deactivate")
    public ResponseEntity<Product> deactivateVariant(
            @PathVariable Long productId,
            @PathVariable Long variantId) {
        return ResponseEntity.ok(productService.deactivateVariant(productId, variantId));
    }

    @PatchMapping("/{id}/deactivate")
    public ResponseEntity<Product> deactivateProduct(@PathVariable Long id) {
        return ResponseEntity.ok(productService.deactivateProduct(id));
    }

    @PatchMapping("/{id}/activate")
    public ResponseEntity<Product> activateProduct(@PathVariable Long id) {
        return ResponseEntity.ok(productService.activateProduct(id));
    }

    @PatchMapping("/{productId}/variants/{variantId}/activate")
    public ResponseEntity<Product> activateVariant(
            @PathVariable Long productId,
            @PathVariable Long variantId) {
        return ResponseEntity.ok(productService.activateVariant(productId, variantId));
    }
}