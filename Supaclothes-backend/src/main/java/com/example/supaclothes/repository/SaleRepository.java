package com.example.supaclothes.repository;

import com.example.supaclothes.entity.Sale;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.List;
import java.time.LocalDateTime;

public interface SaleRepository extends JpaRepository<Sale, Integer> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select sale from Sale sale where sale.receiptNumber = :receiptNumber")
    Optional<Sale> findByReceiptNumberForUpdate(@org.springframework.data.repository.query.Param("receiptNumber") String receiptNumber);
    List<Sale> findByCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtDesc(LocalDateTime from, LocalDateTime to);
    Optional<Sale> findByReceiptNumber(String receiptNumber);
    Optional<Sale> findByIdempotencyKey(String idempotencyKey);
}
