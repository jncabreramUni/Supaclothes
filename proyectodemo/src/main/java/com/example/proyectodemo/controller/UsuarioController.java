package com.example.proyectodemo.controller;

import com.example.proyectodemo.service.UsuarioService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/usuarios")
public class UsuarioController {

    private final UsuarioService usuarioService;

    public UsuarioController(UsuarioService usuarioService) {
        this.usuarioService = usuarioService;
    }

    @GetMapping
    public String consultarUsuarios() {

        return usuarioService.consultarUsuarios();
    }

    @GetMapping("/nuevo")
    public String crearUsuario() {

        return usuarioService.crearUsuario();
    }

    @GetMapping("/editar")
    public String editarUsuario() {

        return usuarioService.editarUsuario();
    }

    @GetMapping("/eliminar")
    public String eliminarUsuario() {

        return usuarioService.eliminarUsuario();
    }
}