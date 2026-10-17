package com.example.proyectodemo.controller;

import com.example.proyectodemo.service.ComprobanteService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/comprobantes")
public class ComprobanteController {

    private final ComprobanteService comprobanteService;

    public ComprobanteController(ComprobanteService comprobanteService) {
        this.comprobanteService = comprobanteService;
    }

    @GetMapping("/generar")
    public String generarComprobante() {

        return comprobanteService.generarComprobante();
    }

    @GetMapping
    public String consultarComprobantes() {

        return comprobanteService.consultarComprobantes();
    }

    @GetMapping("/reimprimir")
    public String reimprimirComprobante() {

        return comprobanteService.reimprimirComprobante();
    }
}