package com.example.supaclothes.controller;

import com.example.supaclothes.dto.SaleRequest;
import com.example.supaclothes.dto.SaleReceiptResponse;
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
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

@RestController
@RequestMapping("/api/sales")
@SecurityRequirement(name = "bearerAuth")
public class SaleController {

    private final SaleService saleService;

    public SaleController(SaleService saleService) {
        this.saleService = saleService;
    }

    @PostMapping
    public ResponseEntity<Sale> createSale(@RequestBody SaleRequest request, Principal principal) {
        return ResponseEntity.status(HttpStatus.CREATED).body(saleService.createSale(request, principal.getName()));
    }

    @GetMapping("/{receiptNumber}")
    public ResponseEntity<SaleReceiptResponse> getReceipt(@PathVariable String receiptNumber) {
        return ResponseEntity.ok(saleService.getReceipt(receiptNumber));
    }
}