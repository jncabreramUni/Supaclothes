package com.example.supaclothes.repository;

import com.example.supaclothes.entity.ProductVariant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Optional;

public interface ProductVariantRepository extends JpaRepository<ProductVariant, Long> {
    // Muy importante para evitar SKUs duplicados
    Optional<ProductVariant> findBySku(String sku);
    @Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select variant from ProductVariant variant where variant.sku = :sku")
    Optional<ProductVariant> findBySkuForUpdate(@Param("sku") String sku);
    boolean existsBySkuAndIdNot(String sku, Long id);
}