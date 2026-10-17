package com.example.proyectodemo.controller;

import com.example.proyectodemo.service.LoginService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class LoginController {

    private final LoginService loginService;

    public LoginController(LoginService loginService) {
        this.loginService = loginService;
    }

    @PostMapping("/login")
    public String iniciarSesion() {

        return loginService.iniciarSesion();
    }

    @GetMapping("/logout")
    public String cerrarSesion() {

        return loginService.cerrarSesion();
    }
}