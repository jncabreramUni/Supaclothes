package com.example.supaclothes.repository;

import com.example.supaclothes.entity.ProductVariant;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface ProductVariantRepository extends JpaRepository<ProductVariant, Long> {
    // Muy importante para evitar SKUs duplicados
    Optional<ProductVariant> findBySku(String sku);
}