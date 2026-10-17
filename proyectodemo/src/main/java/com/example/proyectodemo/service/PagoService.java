package com.example.proyectodemo.service;

import org.springframework.stereotype.Service;

@Service
public class PagoService {

    public String registrarPago() {

        return "Se ha registrado la forma de pago correctamente";
    }

    public String calcularCambio() {

        return "Se ha calculado el cambio correctamente";
    }
}