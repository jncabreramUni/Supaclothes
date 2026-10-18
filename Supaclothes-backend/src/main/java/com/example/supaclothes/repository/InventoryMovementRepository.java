package com.example.supaclothes.repository;

import com.example.supaclothes.entity.InventoryMovement;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface InventoryMovementRepository extends JpaRepository<InventoryMovement, Integer> {
    List<InventoryMovement> findTop100ByOrderByCreatedAtDesc();
    List<InventoryMovement> findAllByTypeOrderByCreatedAtDesc(String type);
}