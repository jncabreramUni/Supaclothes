package com.example.supaclothes.service;

import com.example.supaclothes.dto.ProductRequest;
import com.example.supaclothes.dto.ProductVariantRequest;
import com.example.supaclothes.entity.Product;
import com.example.supaclothes.repository.ProductRepository;
import com.example.supaclothes.repository.ProductVariantRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProductServiceTest {

    @Mock
    private ProductRepository productRepository;
    @Mock
    private ProductVariantRepository variantRepository;
    @InjectMocks
    private ProductService productService;

    @Test
    void createsProductWithEveryVariantAndZeroStartingStock() {
        when(variantRepository.findBySku(any())).thenReturn(Optional.empty());
        when(productRepository.save(any(Product.class))).thenAnswer(invocation -> invocation.getArgument(0));
        ProductRequest request = new ProductRequest("  Camisa  ", "  Ropa ", "  Básica  ", List.of(
                variant("SKU-M", "M"), variant("SKU-L", "L")));

        Product created = productService.createProduct(request);

        assertEquals("Camisa", created.getName());
        assertEquals("Ropa", created.getCategory());
        assertEquals(2, created.getVariants().size());
        assertEquals(0, created.getVariants().get(0).getCurrentStock());
        assertEquals("SKU-L", created.getVariants().get(1).getSku());
    }

    @Test
    void rejectsDuplicateSkusInSameProductRequest() {
        when(variantRepository.findBySku("SKU-M")).thenReturn(Optional.empty());
        ProductRequest request = new ProductRequest("Camisa", "Ropa", null, List.of(
                variant("SKU-M", "M"), variant("SKU-M", "L")));

        assertThrows(ResponseStatusException.class, () -> productService.createProduct(request));
        verify(productRepository, never()).save(any(Product.class));
    }

    @Test
    void rejectsProductWithoutVariants() {
        ProductRequest request = new ProductRequest("Camisa", "Ropa", null, List.of());

        assertThrows(ResponseStatusException.class, () -> productService.createProduct(request));
        verify(productRepository, never()).save(any(Product.class));
    }

    private ProductVariantRequest variant(String sku, String size) {
        return new ProductVariantRequest(
                sku, size, "Azul", new BigDecimal("100.00"), new BigDecimal("0.15"), 2);
    }
}
