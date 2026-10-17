package com.example.supaclothes.controller;

import com.example.supaclothes.dto.InventoryEntryRequest;
import com.example.supaclothes.entity.InventoryMovement;
import com.example.supaclothes.service.InventoryService;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;

@RestController
@RequestMapping("/api/inventory")
@SecurityRequirement(name = "bearerAuth")
public class InventoryController {

    private final InventoryService inventoryService;

    public InventoryController(InventoryService inventoryService) {
        this.inventoryService = inventoryService;
    }

    @PostMapping("/entries")
    public ResponseEntity<Object> registerEntry(@RequestBody InventoryEntryRequest request, Principal principal) {
        try {
            // principal.getName() nos da el username extraído del JWT en el JwtAuthenticationFilter
            String username = principal.getName();

            InventoryMovement movement = inventoryService.registerEntry(request, username);
            return ResponseEntity.status(HttpStatus.CREATED).body(movement);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}