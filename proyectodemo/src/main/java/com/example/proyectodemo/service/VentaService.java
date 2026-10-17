package com.example.proyectodemo.service;

import org.springframework.stereotype.Service;

@Service
public class VentaService {

    public String registrarVenta() {

        return "Se ha registrado la venta correctamente";
    }

    public String consultarVentas() {

        return "Se han consultado las ventas correctamente";
    }
}