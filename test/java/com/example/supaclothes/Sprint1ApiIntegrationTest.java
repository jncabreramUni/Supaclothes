package com.example.supaclothes;

import com.example.supaclothes.entity.Product;
import com.example.supaclothes.entity.ProductVariant;
import com.example.supaclothes.entity.Role;
import com.example.supaclothes.entity.User;
import com.example.supaclothes.repository.InventoryMovementRepository;
import com.example.supaclothes.repository.PaymentRepository;
import com.example.supaclothes.repository.ProductRepository;
import com.example.supaclothes.repository.ProductVariantRepository;
import com.example.supaclothes.repository.RoleRepository;
import com.example.supaclothes.repository.SaleRepository;
import com.example.supaclothes.repository.UserRepository;
import com.example.supaclothes.security.JwtService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class Sprint1ApiIntegrationTest {

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private RoleRepository roleRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private ProductRepository productRepository;
    @Autowired
    private ProductVariantRepository variantRepository;
    @Autowired
    private SaleRepository saleRepository;
    @Autowired
    private PaymentRepository paymentRepository;
    @Autowired
    private InventoryMovementRepository movementRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Autowired
    private JwtService jwtService;

    @Test
    void enforcesRolePermissionsAcrossTheSprintOneApi() throws Exception {
        User admin = createUser("ADMIN");
        User seller = createUser("VENDEDOR");
        User warehouse = createUser("BODEGA");
        String sku = "ROLE-" + UUID.randomUUID().toString().substring(0, 8);
        createProduct(sku, 10);

        mockMvc.perform(get("/api/users")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/users").header("Authorization", bearer(seller)))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/users").header("Authorization", bearer(admin)))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/inventory").header("Authorization", bearer(seller)))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/products").header("Authorization", bearer(seller))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"No permitido\",\"category\":\"Prueba\",\"variants\":[]}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(put("/api/products/1").header("Authorization", bearer(warehouse))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"No permitido\",\"category\":\"Prueba\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/sales").header("Authorization", bearer(warehouse)))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/inventory/entries").header("Authorization", bearer(seller))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sku\":\"" + sku + "\",\"quantity\":1,\"reference\":\"test\"}"))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/inventory/entries").header("Authorization", bearer(warehouse))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sku\":\"" + sku + "\",\"quantity\":4,\"reference\":\"Factura 42\"}"))
                .andExpect(status().isCreated());
        assertEquals(14, variantRepository.findBySku(sku).orElseThrow().getCurrentStock());
        assertTrue(movementRepository.findTop100ByOrderByCreatedAtDesc().stream()
                .anyMatch(movement -> "ENTRADA".equals(movement.getType())
                        && movement.getReference().equals("Factura 42")));
    }

    @Test
    void createsPersistsPaysAndReprintsSalesWithStockIntegrity() throws Exception {
        User seller = createUser("VENDEDOR");
        User warehouse = createUser("BODEGA");
        User admin = createUser("ADMIN");
        String sku = "SALE-" + UUID.randomUUID().toString().substring(0, 8);
        ProductVariant variant = createProduct(sku, 5);
        Long productId = variant.getProduct().getId();

        String response = mockMvc.perform(post("/api/sales").header("Authorization", bearer(seller))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"customerId\":null,\"items\":[{\"sku\":\"" + sku
                                + "\",\"quantity\":2}],\"paymentMethod\":\"EFECTIVO\",\"amountReceived\":250.00}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.receiptNumber").isNotEmpty())
                .andExpect(jsonPath("$.subtotal").value(200.0))
                .andExpect(jsonPath("$.taxTotal").value(30.0))
                .andExpect(jsonPath("$.total").value(230.0))
                .andReturn().getResponse().getContentAsString();

        String receiptNumber = extractJsonValue(response, "receiptNumber");
        assertEquals(3, variantRepository.findBySku(sku).orElseThrow().getCurrentStock());

        var sale = saleRepository.findByReceiptNumber(receiptNumber).orElseThrow();
        var payment = paymentRepository.findBySaleId(sale.getId()).orElseThrow();
        assertEquals("EFECTIVO", payment.getMethod());
        assertEquals(0, new BigDecimal("250.00").compareTo(payment.getAmountReceived()));
        assertEquals(0, new BigDecimal("20.00").compareTo(payment.getChangeGiven()));
        assertTrue(movementRepository.findTop100ByOrderByCreatedAtDesc().stream()
                .anyMatch(movement -> Integer.valueOf(sale.getId()).equals(movement.getSaleId())));

        mockMvc.perform(put("/api/products/{id}", productId)
                        .header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Nombre nuevo\",\"category\":\"Prueba\",\"description\":\"Editado\"}"))
                .andExpect(status().isOk());
        String changedSku = "RENAMED-" + UUID.randomUUID().toString().substring(0, 8);
        mockMvc.perform(put("/api/products/{productId}/variants/{variantId}", productId, variant.getId())
                        .header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sku\":\"" + changedSku + "\",\"size\":\"L\",\"color\":\"Verde\","
                                + "\"price\":120,\"taxRate\":0.15,\"minStock\":2}"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/sales/{receiptNumber}", receiptNumber)
                        .header("Authorization", bearer(seller)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.receiptNumber").value(receiptNumber))
                .andExpect(jsonPath("$.paymentMethod").value("EFECTIVO"))
                .andExpect(jsonPath("$.amountReceived").value(250.0))
                .andExpect(jsonPath("$.changeGiven").value(20.0))
                .andExpect(jsonPath("$.items[0].sku").value(sku))
                .andExpect(jsonPath("$.items[0].productName").value("Producto " + sku));
        mockMvc.perform(get("/api/sales/{receiptNumber}", receiptNumber)
                        .header("Authorization", bearer(warehouse)))
                .andExpect(status().isForbidden());
        assertTrue(movementRepository.findTop100ByOrderByCreatedAtDesc().stream()
                .filter(movement -> Integer.valueOf(sale.getId()).equals(movement.getSaleId()))
                .allMatch(movement -> sku.equals(movement.getSkuAtMovement())));
    }

    @Test
    void rejectsInvalidPaymentsWithoutPersistingSaleOrChangingStock() throws Exception {
        User seller = createUser("VENDEDOR");
        String sku = "PAY-" + UUID.randomUUID().toString().substring(0, 8);
        createProduct(sku, 5);
        long saleCount = saleRepository.count();
        long paymentCount = paymentRepository.count();

        mockMvc.perform(post("/api/sales").header("Authorization", bearer(seller))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"customerId\":null,\"items\":[{\"sku\":\"" + sku
                                + "\",\"quantity\":2}],\"paymentMethod\":\"EFECTIVO\",\"amountReceived\":1.00}"))
                .andExpect(status().isBadRequest());

        assertEquals(saleCount, saleRepository.count());
        assertEquals(paymentCount, paymentRepository.count());
        assertEquals(5, variantRepository.findBySku(sku).orElseThrow().getCurrentStock());
    }

    @Test
    void createsAndEditsProductsWithMultipleUniqueVariants() throws Exception {
        User admin = createUser("ADMIN");
        String firstSku = "MULTI-" + UUID.randomUUID().toString().substring(0, 8);
        String secondSku = firstSku + "-L";

        var result = mockMvc.perform(post("/api/products").header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Camisa\",\"category\":\"Ropa\",\"description\":\"Base\","
                                + "\"variants\":["
                                + "{\"sku\":\"" + firstSku + "\",\"size\":\"M\",\"color\":\"Azul\","
                                + "\"price\":100,\"taxRate\":0.15,\"minStock\":2},"
                                + "{\"sku\":\"" + secondSku + "\",\"size\":\"L\",\"color\":\"Azul\","
                                + "\"price\":110,\"taxRate\":0.15,\"minStock\":2}]}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.variants.length()").value(2))
                .andReturn();
        Long productId = Long.valueOf(extractJsonValue(result.getResponse().getContentAsString(), "id"));
        assertEquals(0, variantRepository.findBySku(firstSku).orElseThrow().getCurrentStock());

        String thirdSku = firstSku + "-XL";
        mockMvc.perform(post("/api/products/{id}/variants", productId)
                        .header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sku\":\"" + thirdSku + "\",\"size\":\"XL\",\"color\":\"Azul\","
                                + "\"price\":115,\"taxRate\":0.15,\"minStock\":1}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.variants.length()").value(3));

        mockMvc.perform(put("/api/products/{id}", productId)
                        .header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Camisa editada\",\"category\":\"Ropa\",\"description\":\"Actualizada\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Camisa editada"));

        ProductVariant addedVariant = variantRepository.findBySku(thirdSku).orElseThrow();
        mockMvc.perform(patch("/api/products/{productId}/variants/{variantId}/deactivate", productId, addedVariant.getId())
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isOk());
        assertFalse(variantRepository.findBySku(thirdSku).orElseThrow().isActive());
    }

    @Test
    void preventsReactivatingVariantsUntilTheirProductIsActiveAgain() throws Exception {
        User admin = createUser("ADMIN");
        String sku = "STATE-" + UUID.randomUUID().toString().substring(0, 8);
        ProductVariant variant = createProduct(sku, 1);
        Long productId = variant.getProduct().getId();

        mockMvc.perform(patch("/api/products/{id}/deactivate", productId)
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isOk());
        mockMvc.perform(patch("/api/products/{productId}/variants/{variantId}/activate", productId, variant.getId())
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isConflict());
        mockMvc.perform(patch("/api/products/{id}/activate", productId)
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isOk());
        mockMvc.perform(patch("/api/products/{productId}/variants/{variantId}/activate", productId, variant.getId())
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isOk());
        assertTrue(variantRepository.findBySku(sku).orElseThrow().isActive());
    }

    @Test
    void acceptsElectronicPaymentAtTheExactSaleTotalWithoutGivingChange() throws Exception {
        User seller = createUser("VENDEDOR");
        String sku = "CARD-" + UUID.randomUUID().toString().substring(0, 8);
        createProduct(sku, 2);
        String response = mockMvc.perform(post("/api/sales").header("Authorization", bearer(seller))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"items\":[{\"sku\":\"" + sku
                                + "\",\"quantity\":1}],\"paymentMethod\":\"TARJETA\",\"amountReceived\":115.00}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        var sale = saleRepository.findByReceiptNumber(extractJsonValue(response, "receiptNumber")).orElseThrow();
        var payment = paymentRepository.findBySaleId(sale.getId()).orElseThrow();
        assertEquals("TARJETA", payment.getMethod());
        assertEquals(0, BigDecimal.ZERO.compareTo(payment.getChangeGiven()));
    }

    @Test
    void returnsRoleAtLoginAndAllowsAdminToDeactivateUsers() throws Exception {
        User admin = createUser("ADMIN");
        User seller = createUser("VENDEDOR");

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + seller.getUsername() + "\",\"password\":\"Prueba123!\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("VENDEDOR"))
                .andExpect(jsonPath("$.fullName").value(seller.getFullName()))
                .andExpect(jsonPath("$.token").isNotEmpty());

        mockMvc.perform(post("/api/auth/admin/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + seller.getUsername() + "\",\"password\":\"Prueba123!\"}"))
                .andExpect(status().isUnauthorized());
        String adminToken = mockMvc.perform(post("/api/auth/admin/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + admin.getUsername() + "\",\"password\":\"Prueba123!\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("ADMIN"))
                .andReturn().getResponse().getContentAsString();
        assertTrue(adminToken.contains("\"token\":\""));

        String createdName = "nuevo-" + UUID.randomUUID().toString().substring(0, 8);
        String createdUserResponse = mockMvc.perform(post("/api/users")
                        .header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + createdName + "\",\"password\":\"Prueba123!\","
                                + "\"fullName\":\"Cuenta creada\",\"roleName\":\"BODEGA\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        Long createdId = Long.valueOf(extractJsonValue(createdUserResponse, "id"));

        mockMvc.perform(patch("/api/users/{id}/deactivate", createdId)
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isNoContent());
        User deactivated = userRepository.findById(createdId).orElseThrow();
        assertFalse(deactivated.isActive());
        assertNotNull(deactivated.getUpdatedAt());
    }

    @Test
    void logoutRevokesPreviouslyIssuedJwtTokens() throws Exception {
        User admin = createUser("ADMIN");
        String response = mockMvc.perform(post("/api/auth/admin/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + admin.getUsername() + "\",\"password\":\"Prueba123!\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String token = extractJsonValue(response, "token");
        mockMvc.perform(post("/api/auth/logout").header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/users").header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized());
    }

    @ParameterizedTest
    @ValueSource(strings = {"application/json", "*/*"})
    void acceptsStandardMobileHeadersForJsonEndpoints(String accept) throws Exception {
        User admin = createUser("ADMIN");
        String credentials = "{\"username\":\"" + admin.getUsername() + "\",\"password\":\"Prueba123!\"}";

        for (String path : new String[]{"/api/auth/login", "/api/auth/admin/login"}) {
            mockMvc.perform(post(path).accept(accept).contentType(MediaType.APPLICATION_JSON).content(credentials))
                    .andExpect(status().isOk())
                    .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                    .andExpect(jsonPath("$.token").isNotEmpty());
        }
        mockMvc.perform(get("/api/products").accept(accept).header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON));
    }

    @Test
    void customerDiscountHistoryAndDailySummary() throws Exception {
        User admin = createUser("ADMIN"); User seller = createUser("VENDEDOR"); User warehouse = createUser("BODEGA");
        String doc = UUID.randomUUID().toString().substring(0, 8);
        String customer = mockMvc.perform(post("/api/customers").header("Authorization", bearer(seller)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Cliente prueba\",\"documentType\":\"CC\",\"documentNumber\":\"" + doc + "\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String customerId = extractJsonValue(customer, "id");
        mockMvc.perform(post("/api/customers").header("Authorization", bearer(seller)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Duplicado\",\"documentType\":\"CC\",\"documentNumber\":\"" + doc + "\"}"))
                .andExpect(status().isConflict());
        mockMvc.perform(post("/api/customers").header("Authorization", bearer(seller)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Sin tipo\",\"documentNumber\":\"" + UUID.randomUUID() + "\"}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/customers").param("q", doc).header("Authorization", bearer(seller))).andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value(Integer.parseInt(customerId)));
        mockMvc.perform(get("/api/customers").header("Authorization", bearer(warehouse))).andExpect(status().isForbidden());
        String sku = "DISC-" + UUID.randomUUID().toString().substring(0,8); createProduct(sku, 5);
        String body = "{\"customerId\":" + customerId + ",\"items\":[{\"sku\":\"" + sku + "\",\"quantity\":1}],\"paymentMethod\":\"EFECTIVO\",\"amountReceived\":120,\"discountPercent\":10}";
        mockMvc.perform(post("/api/sales").header("Authorization", bearer(seller)).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isForbidden());
        assertEquals(5, variantRepository.findBySku(sku).orElseThrow().getCurrentStock());
        String response = mockMvc.perform(post("/api/sales").header("Authorization", bearer(admin)).contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.total").value(103.5)).andExpect(jsonPath("$.discountValue").value(10.0)).andReturn().getResponse().getContentAsString();
        String receipt = extractJsonValue(response, "receiptNumber");
        mockMvc.perform(get("/api/sales/" + receipt).header("Authorization", bearer(admin))).andExpect(status().isOk()).andExpect(jsonPath("$.discountPercent").value(10));
        mockMvc.perform(get("/api/sales/" + receipt).header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.customerName").value("Cliente prueba"));
        mockMvc.perform(get("/api/sales").param("receipt",receipt).header("Authorization", bearer(admin))).andExpect(status().isOk()).andExpect(jsonPath("$[0].receiptNumber").value(receipt));
        mockMvc.perform(get("/api/sales/daily-summary").param("date",java.time.LocalDate.now().toString()).header("Authorization", bearer(admin))).andExpect(status().isOk()).andExpect(jsonPath("$.count").isNumber());
        mockMvc.perform(post("/api/sales").header("Authorization", bearer(admin)).contentType(MediaType.APPLICATION_JSON).content(body.replace("\"discountPercent\":10", "\"discountPercent\":101"))).andExpect(status().isBadRequest());
    }

    @Test
    void appliesSaleDiscountBeforeTaxAndReusesTheSameOperationAfterRetry() throws Exception {
        User admin = createUser("ADMIN");
        String sku = "CALC-" + UUID.randomUUID().toString().substring(0, 8);
        ProductVariant variant = createProduct(sku, 2);
        variant.setPrice(new BigDecimal("50000.00"));
        variant.setTaxRate(new BigDecimal("0.19"));
        variantRepository.saveAndFlush(variant);
        String operationId = UUID.randomUUID().toString();
        String body = "{\"items\":[{\"sku\":\"" + sku + "\",\"quantity\":2}],"
                + "\"paymentMethod\":\"EFECTIVO\",\"amountReceived\":110000,"
                + "\"discountPercent\":10,\"idempotencyKey\":\"" + operationId + "\"}";

        String response = mockMvc.perform(post("/api/sales").header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.subtotal").value(100000.0))
                .andExpect(jsonPath("$.discountValue").value(10000.0))
                .andExpect(jsonPath("$.taxTotal").value(17100.0))
                .andExpect(jsonPath("$.total").value(107100.0))
                .andReturn().getResponse().getContentAsString();
        String receiptNumber = extractJsonValue(response, "receiptNumber");
        assertEquals(0, variantRepository.findBySku(sku).orElseThrow().getCurrentStock());

        mockMvc.perform(post("/api/sales").header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.receiptNumber").value(receiptNumber))
                .andExpect(jsonPath("$.total").value(107100.0));
        mockMvc.perform(post("/api/sales").header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body.replace("\"amountReceived\":110000", "\"amountReceived\":110001")))
                .andExpect(status().isConflict());
        assertEquals(0, variantRepository.findBySku(sku).orElseThrow().getCurrentStock());
        assertEquals(1, saleRepository.findAll().stream()
                .filter(sale -> operationId.equals(sale.getIdempotencyKey())).count());

        mockMvc.perform(get("/api/sales/{receipt}", receiptNumber).header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.customerName").value("Consumidor final"))
                .andExpect(jsonPath("$.items[0].discountValue").value(10000.0))
                .andExpect(jsonPath("$.items[0].taxValue").value(17100.0))
                .andExpect(jsonPath("$.items[0].lineTotal").value(107100.0));
    }

    @Test
    void acceptsFullDiscountAndRejectsDiscountsOutsideTheRange() throws Exception {
        User admin = createUser("ADMIN");
        String sku = "RANGE-" + UUID.randomUUID().toString().substring(0, 8);
        createProduct(sku, 4);
        String body = "{\"items\":[{\"sku\":\"" + sku + "\",\"quantity\":1}],"
                + "\"paymentMethod\":\"EFECTIVO\",\"amountReceived\":0,\"discountPercent\":100}";
        mockMvc.perform(post("/api/sales").header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.total").value(0.0));
        for (String invalidPercent : new String[] {"-1", "101"}) {
            mockMvc.perform(post("/api/sales").header("Authorization", bearer(admin))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(body.replace("\"discountPercent\":100", "\"discountPercent\":" + invalidPercent)))
                    .andExpect(status().isBadRequest());
        }
        assertEquals(3, variantRepository.findBySku(sku).orElseThrow().getCurrentStock());
    }

    @Test
    void concurrentSalesCannotSellTheLastUnitTwice() throws Exception {
        User firstSeller = createUser("VENDEDOR");
        User secondSeller = createUser("VENDEDOR");
        String sku = "RACE-" + UUID.randomUUID().toString().substring(0, 8);
        createProduct(sku, 1);
        String body = "{\"items\":[{\"sku\":\"" + sku + "\",\"quantity\":1}],"
                + "\"paymentMethod\":\"EFECTIVO\",\"amountReceived\":115}";
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<Integer> first = executor.submit(() -> {
                start.await();
                return mockMvc.perform(post("/api/sales").header("Authorization", bearer(firstSeller))
                                .contentType(MediaType.APPLICATION_JSON).content(body))
                        .andReturn().getResponse().getStatus();
            });
            Future<Integer> second = executor.submit(() -> {
                start.await();
                return mockMvc.perform(post("/api/sales").header("Authorization", bearer(secondSeller))
                                .contentType(MediaType.APPLICATION_JSON).content(body))
                        .andReturn().getResponse().getStatus();
            });
            start.countDown();
            int firstStatus = first.get();
            int secondStatus = second.get();
            assertTrue((firstStatus == 201 && secondStatus == 409)
                    || (firstStatus == 409 && secondStatus == 201));
        } finally {
            executor.shutdownNow();
        }
        assertEquals(0, variantRepository.findBySku(sku).orElseThrow().getCurrentStock());
        assertEquals(1, movementRepository.findTop100ByOrderByCreatedAtDesc().stream()
                .filter(movement -> sku.equals(movement.getSkuAtMovement())
                        && "SALIDA_VENTA".equals(movement.getType()))
                .count());
    }

    private User createUser(String roleName) {
        Role role = roleRepository.findByName(roleName).orElseThrow();
        String username = roleName.toLowerCase() + "-" + UUID.randomUUID().toString().substring(0, 8);
        User user = new User();
        user.setUsername(username);
        user.setFullName("Usuario de prueba " + roleName);
        user.setPasswordHash(passwordEncoder.encode("Prueba123!"));
        user.setRole(role);
        user.setActive(true);
        return userRepository.save(user);
    }

    private ProductVariant createProduct(String sku, int stock) {
        Product product = new Product();
        product.setName("Producto " + sku);
        product.setCategory("Prueba");
        product.setActive(true);
        ProductVariant variant = new ProductVariant();
        variant.setSku(sku);
        variant.setSize("M");
        variant.setColor("Negro");
        variant.setPrice(new BigDecimal("100.00"));
        variant.setTaxRate(new BigDecimal("0.15"));
        variant.setMinStock(2);
        variant.setCurrentStock(stock);
        variant.setActive(true);
        product.addVariant(variant);
        productRepository.save(product);
        return variant;
    }

    private String bearer(User user) {
        return "Bearer " + jwtService.generateToken(user);
    }

    private String extractJsonValue(String json, String field) {
        Matcher matcher = Pattern.compile("\"" + field + "\":(?:\"([^\"]+)\"|(\\d+))").matcher(json);
        if (!matcher.find()) {
            throw new AssertionError("JSON field not found: " + field);
        }
        return matcher.group(1) == null ? matcher.group(2) : matcher.group(1);
    }
}
