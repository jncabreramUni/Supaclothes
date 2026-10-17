package com.example.proyectodemo.service;

import org.springframework.stereotype.Service;

@Service
public class ComprobanteService {

    public String generarComprobante() {

        return "Se ha generado el comprobante de venta correctamente";
    }

    public String consultarComprobantes() {

        return "Se han consultado los comprobantes correctamente";
    }

    public String reimprimirComprobante() {

        return "Se ha reimpreso el comprobante correctamente";
    }
}