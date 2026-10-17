package com.example.proyectodemo.controller;

import com.example.proyectodemo.service.VentaService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/ventas")
public class VentaController {

    private final VentaService ventaService;

    public VentaController(VentaService ventaService) {
        this.ventaService = ventaService;
    }

    @GetMapping("/nueva")
    public String registrarVenta() {

        return ventaService.registrarVenta();
    }

    @GetMapping
    public String consultarVentas() {

        return ventaService.consultarVentas();
    }
}