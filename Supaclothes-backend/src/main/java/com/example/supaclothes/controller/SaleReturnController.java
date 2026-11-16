package com.example.supaclothes.controller;

import com.example.supaclothes.dto.ReturnRequest;
import com.example.supaclothes.dto.ReturnResponse;
import com.example.supaclothes.service.SaleReturnService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import java.security.Principal;

@RestController
@RequestMapping("/api/sales/{receiptNumber}/return")
public class SaleReturnController {
    private final SaleReturnService service;
    public SaleReturnController(SaleReturnService service) { this.service = service; }

    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public ReturnResponse create(@PathVariable String receiptNumber, @RequestBody ReturnRequest request, Principal principal) {
        return service.create(receiptNumber, request, principal.getName());
    }

    @GetMapping
    public ReturnResponse get(@PathVariable String receiptNumber) { return service.get(receiptNumber); }
}
