package com.example.proyectodemo.service;

import org.springframework.stereotype.Service;

@Service
public class InventarioService {

    public String registrarEntrada() {

        return "Se ha registrado la entrada de inventario correctamente";
    }

    public String consultarInventario() {

        return "Se ha consultado el inventario correctamente";
    }

    public String consultarStockBajo() {

        return "Se ha consultado el stock bajo correctamente";
    }
}