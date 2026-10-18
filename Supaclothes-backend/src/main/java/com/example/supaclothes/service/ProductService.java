package com.example.supaclothes.service;

import com.example.supaclothes.dto.ProductRequest;
import com.example.supaclothes.dto.ProductUpdateRequest;
import com.example.supaclothes.dto.ProductVariantRequest;
import com.example.supaclothes.entity.Product;
import com.example.supaclothes.entity.ProductVariant;
import com.example.supaclothes.repository.ProductRepository;
import com.example.supaclothes.repository.ProductVariantRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

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
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La solicitud del producto es obligatoria");
        }
        validateProduct(request.name(), request.category());
        if (request.variants() == null || request.variants().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El producto debe incluir al menos una variante");
        }
        Product product = new Product();
        product.setName(request.name().trim());
        product.setCategory(request.category().trim());
        product.setDescription(request.description() == null ? null : request.description().trim());
        product.setActive(true); // Se activa por defecto al crearse

        Set<String> submittedSkus = new HashSet<>();
        for (ProductVariantRequest vReq : request.variants()) {
            if (vReq == null || vReq.sku() == null || !submittedSkus.add(vReq.sku().trim())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Cada variante debe tener un SKU único");
            }
            product.addVariant(newVariant(vReq));
        }
        return productRepository.save(product);
    }

    // Aprovechamos y creamos de una vez el método para listar los productos
    public List<Product> getAllProducts() {
        return productRepository.findAll();
    }

    @Transactional
    public Product updateProduct(Long id, ProductUpdateRequest request) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La solicitud del producto es obligatoria");
        }
        validateProduct(request.name(), request.category());
        Product product = findProduct(id);
        product.setName(request.name().trim());
        product.setCategory(request.category().trim());
        product.setDescription(request.description() == null ? null : request.description().trim());
        return productRepository.save(product);
    }

    @Transactional
    public Product addVariant(Long productId, ProductVariantRequest request) {
        Product product = findProduct(productId);
        if (!product.isActive()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "No se pueden agregar variantes a un producto inactivo");
        }
        product.addVariant(newVariant(request));
        return productRepository.save(product);
    }

    @Transactional
    public Product updateVariant(Long productId, Long variantId, ProductVariantRequest request) {
        Product product = findProduct(productId);
        ProductVariant variant = product.getVariants().stream()
                .filter(candidate -> candidate.getId().equals(variantId))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Variante no encontrada"));
        validateVariant(request);
        String requestedSku = request.sku().trim();
        if (!variant.getSku().equals(requestedSku)
                && productVariantRepository.existsBySkuAndIdNot(requestedSku, variantId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "El SKU ya está registrado");
        }
        variant.setSku(request.sku().trim());
        variant.setSize(request.size().trim());
        variant.setColor(request.color().trim());
        variant.setPrice(request.price());
        variant.setTaxRate(request.taxRate());
        variant.setMinStock(request.minStock());
        return productRepository.save(product);
    }

    @Transactional
    public Product deactivateVariant(Long productId, Long variantId) {
        Product product = findProduct(productId);
        ProductVariant variant = product.getVariants().stream()
                .filter(candidate -> candidate.getId().equals(variantId))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Variante no encontrada"));
        variant.setActive(false);
        return productRepository.save(product);
    }

    @Transactional
    public Product activateProduct(Long id) {
        Product product = findProduct(id);
        product.setActive(true);
        return productRepository.save(product);
    }

    @Transactional
    public Product activateVariant(Long productId, Long variantId) {
        Product product = findProduct(productId);
        if (!product.isActive()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Primero debe activarse el producto");
        }
        ProductVariant variant = product.getVariants().stream()
                .filter(candidate -> candidate.getId().equals(variantId))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Variante no encontrada"));
        variant.setActive(true);
        return productRepository.save(product);
    }

    private ProductVariant newVariant(ProductVariantRequest request) {
        validateVariant(request);
        if (productVariantRepository.findBySku(request.sku().trim()).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "El SKU ya está registrado");
        }
        ProductVariant variant = new ProductVariant();
        variant.setSku(request.sku().trim());
        variant.setSize(request.size().trim());
        variant.setColor(request.color().trim());
        variant.setPrice(request.price());
        variant.setTaxRate(request.taxRate());
        variant.setMinStock(request.minStock());
        variant.setCurrentStock(0);
        variant.setActive(true);
        return variant;
    }

    private void validateProduct(String name, String category) {
        if (name == null || name.isBlank() || category == null || category.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nombre y categoría son obligatorios");
        }
    }

    private void validateVariant(ProductVariantRequest request) {
        if (request == null || request.sku() == null || request.sku().isBlank()
                || request.sku().trim().length() > 50
                || request.size() == null || request.size().isBlank()
                || request.size().trim().length() > 20
                || request.color() == null || request.color().isBlank()
                || request.color().trim().length() > 40
                || request.price() == null || request.price().signum() < 0
                || request.price().precision() > 12
                || request.taxRate() == null || request.taxRate().signum() < 0
                || request.taxRate().precision() > 5
                || request.minStock() < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Datos de variante inválidos");
        }
    }

    private Product findProduct(Long id) {
        return productRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Producto no encontrado"));
    }

    @Transactional
    public Product deactivateProduct(Long id) {
        Product product = findProduct(id);

        if (!product.isActive()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "El producto ya se encuentra desactivado");
        }

        // Apagamos el producto principal
        product.setActive(false);
        
        // Opcional pero recomendado: Apagar también sus variantes para que no se puedan vender
        product.getVariants().forEach(variant -> variant.setActive(false));

        return productRepository.save(product);
    }
}