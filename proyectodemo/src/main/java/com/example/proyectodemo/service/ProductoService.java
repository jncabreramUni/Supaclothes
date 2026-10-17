package com.example.proyectodemo.service;

import org.springframework.stereotype.Service;

@Service
public class ProductoService {

    public String consultarProductos() {

        return "Se han consultado los productos correctamente";
    }

    public String crearProducto() {

        return "Se ha creado el producto correctamente";
    }

    public String editarProducto() {

        return "Se ha editado el producto correctamente";
    }

    public String eliminarProducto() {

        return "Se ha eliminado el producto correctamente";
    }

    public String administrarVariantes() {

        return "Se han administrado las variantes del producto";
    }
}