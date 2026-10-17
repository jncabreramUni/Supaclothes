package com.example.proyectodemo.service;

import org.springframework.stereotype.Service;

@Service
public class UsuarioService {

    public String consultarUsuarios() {

        return "Se han consultado los usuarios correctamente";
    }

    public String crearUsuario() {

        return "Se ha creado el usuario correctamente";
    }

    public String editarUsuario() {

        return "Se ha editado el usuario correctamente";
    }

    public String eliminarUsuario() {

        return "Se ha eliminado el usuario correctamente";
    }
}