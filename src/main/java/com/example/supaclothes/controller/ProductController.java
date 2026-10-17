package com.example.supaclothes.controller;

import com.example.supaclothes.dto.ProductRequest;
import com.example.supaclothes.entity.Product;
import com.example.supaclothes.service.ProductService;
import org.springframework.http.HttpStatus;
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
    public ResponseEntity<Object> createProduct(@RequestBody ProductRequest request) {
        try {
            Product createdProduct = productService.createProduct(request);
            return ResponseEntity.status(HttpStatus.CREATED).body(createdProduct);
        } catch (RuntimeException e) {
            // Si el SKU está duplicado u ocurre otro error controlado
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
    @PatchMapping("/{id}/deactivate")
    public ResponseEntity<Object> deactivateProduct(@PathVariable Long id) {
        try {
            Product deactivatedProduct = productService.deactivateProduct(id);
            return ResponseEntity.ok(deactivatedProduct);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}