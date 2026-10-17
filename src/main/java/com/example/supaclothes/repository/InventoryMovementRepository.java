package com.example.supaclothes.repository;

import com.example.supaclothes.entity.InventoryMovement;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InventoryMovementRepository extends JpaRepository<InventoryMovement, Integer> {
}