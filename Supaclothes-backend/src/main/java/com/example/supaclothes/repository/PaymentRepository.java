package com.example.supaclothes.repository;

import com.example.supaclothes.entity.Payment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PaymentRepository extends JpaRepository<Payment, Integer> {
    Optional<Payment> findBySaleId(Integer saleId);
}
