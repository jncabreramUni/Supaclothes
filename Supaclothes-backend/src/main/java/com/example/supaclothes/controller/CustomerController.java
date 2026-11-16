package com.example.supaclothes.controller;

import com.example.supaclothes.entity.Customer;
import com.example.supaclothes.repository.CustomerRepository;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Locale;

@RestController
@RequestMapping("/api/customers")
public class CustomerController {

    private final CustomerRepository customers;

    public CustomerController(CustomerRepository customers) {
        this.customers = customers;
    }

    @GetMapping
    public List<Customer> search(@RequestParam(defaultValue = "") String q) {
        String query = q.trim();
        return customers.findTop50ByNameContainingIgnoreCaseOrDocumentNumberContainingIgnoreCaseOrderByName(query, query);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Customer create(@RequestBody Customer input) {
        if (input == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Se requieren los datos del cliente");
        }

        String name = input.getName() == null ? null : input.getName().trim();
        String documentType = input.getDocumentType() == null ? null : input.getDocumentType().trim();
        String document = input.getDocumentNumber() == null ? null : input.getDocumentNumber().trim();
        String phone = input.getPhone() == null ? null : input.getPhone().trim();
        String email = input.getEmail() == null ? null : input.getEmail().trim();
        if (name == null || name.isEmpty() || name.length() > 120
                || documentType == null || documentType.isEmpty() || documentType.length() > 20
                || document == null || document.isEmpty() || document.length() > 30) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tipo y número de documento y nombre son obligatorios");
        }
        if (phone != null && !phone.isEmpty() && (phone.length() > 20 || !phone.matches("\\+?[0-9 ()-]{7,20}"))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El teléfono no tiene un formato válido");
        }
        if (email != null && !email.isEmpty() && (email.length() > 120 || !email.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+"))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El correo no tiene un formato válido");
        }
        if (customers.existsByDocumentNumber(document)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "El documento ya está registrado");
        }

        Customer customer = new Customer();
        customer.setName(name);
        customer.setDocumentType(documentType.toUpperCase(Locale.ROOT));
        customer.setDocumentNumber(document);
        customer.setPhone(phone == null || phone.isEmpty() ? null : phone);
        customer.setEmail(email == null || email.isEmpty() ? null : email);
        return customers.save(customer);
    }
}
