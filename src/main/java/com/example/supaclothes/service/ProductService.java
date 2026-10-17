package com.example.supaclothes.service;

import com.example.supaclothes.dto.ProductRequest;
import com.example.supaclothes.dto.ProductVariantRequest;
import com.example.supaclothes.entity.Product;
import com.example.supaclothes.entity.ProductVariant;
import com.example.supaclothes.repository.ProductRepository;
import com.example.supaclothes.repository.ProductVariantRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class ProductService {

    private final ProductRepository productRepository;
    private final ProductVariantRepository productVariantRepository;

    public ProductService(
            ProductRepository productRepository,
            ProductVariantRepository productVariantRepository) {
        this.productRepository = productRepository;
        this.productVariantRepository = productVariantRepository;
    }

    @Transactional
    public Product createProduct(ProductRequest request) {
        // 1. Instanciar el producto principal
        Product product = new Product();
        product.setName(request.name());
        product.setCategory(request.category());
        product.setDescription(request.description());
        product.setActive(true); // Se activa por defecto al crearse

        // 2. Procesar cada variante que venga en la lista del DTO
        for (ProductVariantRequest vReq : request.variants()) {
            
            // Validar regla de negocio: El SKU debe ser único a nivel general
            if (productVariantRepository.findBySku(vReq.sku()).isPresent()) {
                throw new RuntimeException("Error: El SKU '" + vReq.sku() + "' ya existe en el inventario.");
            }

            ProductVariant variant = new ProductVariant();
            variant.setSku(vReq.sku());
            variant.setSize(vReq.size());
            variant.setColor(vReq.color());
            variant.setPrice(vReq.price());
            variant.setTaxRate(vReq.taxRate());
            variant.setMinStock(vReq.minStock());
            variant.setCurrentStock(0); // Regla clave: El stock nace en 0. (La HU-04 lo aumentará después)
            variant.setActive(true);

            // 3. Vincular la variante al producto (gracias al método que creaste en la entidad)
            product.addVariant(variant);
        }

        // 4. Guardar en cascada (al guardar el producto, JPA guarda automáticamente sus variantes)
        return productRepository.save(product);
    }

    // Aprovechamos y creamos de una vez el método para listar los productos
    public List<Product> getAllProducts() {
        return productRepository.findAll();
    }
    @Transactional
    public Product deactivateProduct(Long id) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Error: El producto con ID " + id + " no existe."));

        if (!product.isActive()) {
            throw new RuntimeException("Error: El producto ya se encuentra desactivado.");
        }

        // Apagamos el producto principal
        product.setActive(false);
        
        // Opcional pero recomendado: Apagar también sus variantes para que no se puedan vender
        product.getVariants().forEach(variant -> variant.setActive(false));

        return productRepository.save(product);
    }
}