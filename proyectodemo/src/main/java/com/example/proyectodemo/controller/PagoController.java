package com.example.proyectodemo.controller;

import com.example.proyectodemo.service.PagoService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/pagos")
public class PagoController {

    private final PagoService pagoService;

    public PagoController(PagoService pagoService) {
        this.pagoService = pagoService;
    }

    @GetMapping
    public String registrarPago() {

        return pagoService.registrarPago();
    }

    @GetMapping("/cambio")
    public String calcularCambio() {

        return pagoService.calcularCambio();
    }
}