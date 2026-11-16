package com.example.supaclothes.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record ReturnResponse(Long id, Integer saleId, String receiptNumber, String reason,
                             BigDecimal refundTotal, LocalDateTime createdAt, Long userId) {}
