package com.example.supaclothes.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "inventory_movement")
public class InventoryMovement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private int id;

    @Column(name = "variant_id", nullable = false)
    private Long variantId; // FK -> product_variant.id

    @Column(name = "user_id", nullable = false)
    private Long userId; // FK -> users.id

    @Column(name = "sale_id")
    private Integer saleId; // FK -> sale.id; nulo si no viene de una venta

    @Column(name = "type", nullable = false, length = 30)
    private String type; // ENTRADA | SALIDA_VENTA | REINTEGRO_DEVOLUCION

    @Column(name = "quantity", nullable = false)
    private int quantity; // entero positivo

    @Column(name = "previous_stock", nullable = false)
    private int previousStock;

    @Column(name = "resulting_stock", nullable = false)
    private int resultingStock;

    @Column(name = "reference", length = 150)
    private String reference;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public InventoryMovement() {
    }

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    public int getId() {
        return id;
    }

    public void setId(int id) {
        this.id = id;
    }

    public Long getVariantId() {
        return variantId;
    }

    public void setVariantId(Long variantId) {
        this.variantId = variantId;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public Integer getSaleId() {
        return saleId;
    }

    public void setSaleId(Integer saleId) {
        this.saleId = saleId;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public int getQuantity() {
        return quantity;
    }

    public void setQuantity(int quantity) {
        this.quantity = quantity;
    }

    public int getPreviousStock() {
        return previousStock;
    }

    public void setPreviousStock(int previousStock) {
        this.previousStock = previousStock;
    }

    public int getResultingStock() {
        return resultingStock;
    }

    public void setResultingStock(int resultingStock) {
        this.resultingStock = resultingStock;
    }

    public String getReference() {
        return reference;
    }

    public void setReference(String reference) {
        this.reference = reference;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

}