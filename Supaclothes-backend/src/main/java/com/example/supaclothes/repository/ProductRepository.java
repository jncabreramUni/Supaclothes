package com.example.supaclothes.repository;

import com.example.supaclothes.entity.Product;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductRepository extends JpaRepository<Product, Long> {
}