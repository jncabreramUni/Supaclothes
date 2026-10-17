package com.example.proyectodemo.controller;

import com.example.proyectodemo.service.ProductoService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/productos")
public class ProductoController {

    private final ProductoService productoService;

    public ProductoController(ProductoService productoService) {
        this.productoService = productoService;
    }

    @GetMapping
    public String consultarProductos() {

        return productoService.consultarProductos();
    }

    @GetMapping("/nuevo")
    public String crearProducto() {

        return productoService.crearProducto();
    }

    @GetMapping("/editar")
    public String editarProducto() {

        return productoService.editarProducto();
    }

    @GetMapping("/eliminar")
    public String eliminarProducto() {

        return productoService.eliminarProducto();
    }

    @GetMapping("/variantes")
    public String administrarVariantes() {

        return productoService.administrarVariantes();
    }
}