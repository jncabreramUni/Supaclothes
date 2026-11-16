package com.example.supaclothes.repository;

import com.example.supaclothes.entity.SaleReturn;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface SaleReturnRepository extends JpaRepository<SaleReturn, Long> {
    boolean existsBySaleId(Integer saleId);
    Optional<SaleReturn> findByReceiptNumber(String receiptNumber);
    List<SaleReturn> findByCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtDesc(LocalDateTime from, LocalDateTime to);
}
