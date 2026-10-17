package com.example.proyectodemo.service;

import org.springframework.stereotype.Service;

@Service
public class LoginService {

    public String iniciarSesion() {

        return "Se ha iniciado sesión correctamente";
    }

    public String cerrarSesion() {

        return "Se ha cerrado la sesión correctamente";
    }
}