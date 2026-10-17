package com.example.proyectodemo.controller;

import com.example.proyectodemo.service.InventarioService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/inventario")
public class InventarioController {

    private final InventarioService inventarioService;

    public InventarioController(InventarioService inventarioService) {
        this.inventarioService = inventarioService;
    }

    @GetMapping("/entrada")
    public String registrarEntrada() {

        return inventarioService.registrarEntrada();
    }

    @GetMapping
    public String consultarInventario() {

        return inventarioService.consultarInventario();
    }

    @GetMapping("/stock-bajo")
    public String consultarStockBajo() {

        return inventarioService.consultarStockBajo();
    }
}