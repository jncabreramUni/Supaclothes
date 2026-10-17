package com.example.supaclothes.controller;

import com.example.supaclothes.dto.SaleRequest;
import com.example.supaclothes.entity.Sale;
import com.example.supaclothes.service.SaleService;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;

@RestController
@RequestMapping("/api/sales")
@SecurityRequirement(name = "bearerAuth")
public class SaleController {

    private final SaleService saleService;

    public SaleController(SaleService saleService) {
        this.saleService = saleService;
    }

    @PostMapping
    public ResponseEntity<Object> createSale(@RequestBody SaleRequest request, Principal principal) {
        try {
            // Spring extrae el usuario directamente de tu token JWT
            String sellerUsername = principal.getName();
            Sale sale = saleService.createSale(request, sellerUsername);
            return ResponseEntity.status(HttpStatus.CREATED).body(sale);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}