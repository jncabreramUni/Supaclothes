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
import java.time.LocalDate;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.server.ResponseStatusException;
import com.example.supaclothes.repository.SaleRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

@RestController
@RequestMapping("/api/sales")
@SecurityRequirement(name = "bearerAuth")
public class SaleController {

    private final SaleService saleService;
    private final SaleRepository sales;
    private final com.example.supaclothes.repository.SaleReturnRepository returns;

    public SaleController(SaleService saleService, SaleRepository sales, com.example.supaclothes.repository.SaleReturnRepository returns) {
        this.returns = returns;
        this.sales = sales;
        this.saleService = saleService;
    }

    @PostMapping
    public ResponseEntity<Sale> createSale(@RequestBody SaleRequest request, Principal principal) {
        return ResponseEntity.status(HttpStatus.CREATED).body(saleService.createSale(request, principal.getName()));
    }

    public record SaleSummary(String receiptNumber, java.time.LocalDateTime createdAt, Integer customerId, BigDecimal total, String status) {}
    public record DailySummary(LocalDate date, long count, BigDecimal total, BigDecimal grossSales, BigDecimal refunds) {}
    @GetMapping public List<SaleSummary> history(@RequestParam(required=false) LocalDate from, @RequestParam(required=false) LocalDate to, @RequestParam(defaultValue="") String receipt) {
        LocalDate start = from == null ? LocalDate.of(2000,1,1) : from;
        LocalDate end = to == null ? LocalDate.now() : to;
        if (end.isBefore(start)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El rango de fechas es inválido");
        return sales.findByCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtDesc(start.atStartOfDay(), end.plusDays(1).atStartOfDay()).stream()
            .filter(s -> s.getReceiptNumber().toLowerCase().contains(receipt.toLowerCase()))
            .map(s -> new SaleSummary(s.getReceiptNumber(),s.getCreatedAt(),s.getCustomerId(),s.getTotal(),s.getStatus())).toList();
    }
    @GetMapping("/daily-summary") public DailySummary daily(@RequestParam(required=false) LocalDate date) {
        LocalDate day = date == null ? LocalDate.now() : date;
        var list = sales.findByCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtDesc(day.atStartOfDay(),day.plusDays(1).atStartOfDay());
        BigDecimal gross = list.stream().map(Sale::getTotal).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal refunded = returns.findByCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtDesc(day.atStartOfDay(), day.plusDays(1).atStartOfDay()).stream()
                .map(com.example.supaclothes.entity.SaleReturn::getRefundTotal).reduce(BigDecimal.ZERO, BigDecimal::add);
        return new DailySummary(day, list.size(), gross.subtract(refunded), gross, refunded);
    }
    @GetMapping("/{receiptNumber}")
    public ResponseEntity<SaleReceiptResponse> getReceipt(@PathVariable String receiptNumber) {
        return ResponseEntity.ok(saleService.getReceipt(receiptNumber));
    }
}