package com.example.supaclothes;

import com.example.supaclothes.entity.*;
import com.example.supaclothes.repository.*;
import com.example.supaclothes.security.JwtService;
import com.example.supaclothes.service.SaleReturnService;
import com.example.supaclothes.dto.ReturnRequest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import java.math.BigDecimal;
import java.util.UUID;
import java.util.regex.Pattern;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class SaleReturnIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired RoleRepository roles;
    @Autowired UserRepository users;
    @Autowired ProductRepository products;
    @Autowired ProductVariantRepository variants;
    @Autowired SaleRepository sales;
    @Autowired SaleReturnRepository returns;
    @Autowired InventoryMovementRepository movements;
    @Autowired JwtService jwt;
    @Autowired SaleReturnService returnService;

    @Test
    void returnsEntireDiscountedSaleOnceAndPreservesAudit() throws Exception {
        User admin = user("ADMIN");
        ProductVariant variant = variant(7);
        String receipt = sell(admin, "[{\"sku\":\"" + variant.getSku() + "\",\"quantity\":2}]", 10);
        ProductVariant changed = variants.findById(variant.getId()).orElseThrow();
        changed.setSku("RENAMED-" + UUID.randomUUID().toString().substring(0,8));
        changed.setActive(false); changed.setPrice(new BigDecimal("999")); variants.save(changed);
        mvc.perform(post("/api/sales/{receipt}/return", receipt).header("Authorization", bearer(admin))
                .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Talla incorrecta\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.refundTotal").value(207))
                .andExpect(jsonPath("$.reason").value("Talla incorrecta")).andExpect(jsonPath("$.userId").value(admin.getId()));
        assertEquals(7, variants.findById(variant.getId()).orElseThrow().getCurrentStock());
        var sale = sales.findByReceiptNumber(receipt).orElseThrow();
        assertEquals("DEVUELTA", sale.getStatus());
        assertEquals(0, sale.getTotal().compareTo(new BigDecimal("207")));
        var movement = movements.findAll().stream().filter(m -> Integer.valueOf(sale.getId()).equals(m.getSaleId()) && "ENTRADA_DEVOLUCION".equals(m.getType())).findFirst().orElseThrow();
        assertEquals(5, movement.getPreviousStock()); assertEquals(7, movement.getResultingStock());
        assertEquals(changed.getSku(), movement.getSkuAtMovement()); assertEquals(admin.getId(), movement.getUserId());
        mvc.perform(get("/api/sales/{receipt}/return", receipt).header("Authorization", bearer(admin)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.receiptNumber").value(receipt));
        mvc.perform(post("/api/sales/{receipt}/return", receipt).header("Authorization", bearer(admin))
                .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Reintento\"}"))
                .andExpect(status().isConflict());
        assertEquals(7, variants.findById(variant.getId()).orElseThrow().getCurrentStock());
    }

    @Test
    void invalidOrUnauthorizedReturnsDoNotChangeStock() throws Exception {
        User seller = user("VENDEDOR"), warehouse = user("BODEGA");
        ProductVariant variant = variant(5);
        String receipt = sell(seller, "[{\"sku\":\"" + variant.getSku() + "\",\"quantity\":1}]", 0);
        mvc.perform(get("/api/sales/{receipt}/return",receipt).header("Authorization",bearer(seller))).andExpect(status().isNotFound());
        mvc.perform(post("/api/sales/{receipt}/return", receipt).header("Authorization",bearer(warehouse)).contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Prueba\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/sales/{receipt}/return", receipt).contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Prueba\"}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/sales/{receipt}/return", receipt).header("Authorization",bearer(seller)).contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"  \"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/sales/INEXISTENTE/return").header("Authorization",bearer(seller)).contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Prueba\"}"))
                .andExpect(status().isNotFound());
        assertEquals(4,variants.findById(variant.getId()).orElseThrow().getCurrentStock());
        assertEquals("CONFIRMADA",sales.findByReceiptNumber(receipt).orElseThrow().getStatus());
        mvc.perform(post("/api/sales/{receipt}/return", receipt).header("Authorization",bearer(seller)).contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Cambio de opinión\"}"))
                .andExpect(status().isCreated());
    }

    @Test
    void failureInSecondVariantRollsBackAllStockAndAudit() throws Exception {
        User seller = user("VENDEDOR"); ProductVariant first=variant(8), second=variant(8);
        String receipt = sell(seller,"[{\"sku\":\""+first.getSku()+"\",\"quantity\":1},{\"sku\":\""+second.getSku()+"\",\"quantity\":1}]",0);
        ProductVariant changed=variants.findById(second.getId()).orElseThrow(); changed.setCurrentStock(Integer.MAX_VALUE); variants.save(changed);
        mvc.perform(post("/api/sales/{receipt}/return",receipt).header("Authorization",bearer(seller)).contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Retorno\"}"))
                .andExpect(status().isConflict());
        assertEquals(7,variants.findById(first.getId()).orElseThrow().getCurrentStock());
        assertEquals(Integer.MAX_VALUE,variants.findById(second.getId()).orElseThrow().getCurrentStock());
        var sale=sales.findByReceiptNumber(receipt).orElseThrow();
        assertEquals("CONFIRMADA",sale.getStatus()); assertFalse(returns.existsBySaleId(sale.getId()));
        assertFalse(movements.findAll().stream().anyMatch(m -> Integer.valueOf(sale.getId()).equals(m.getSaleId()) && "ENTRADA_DEVOLUCION".equals(m.getType())));
    }

    @Test
    void concurrentReturnsRestoreStockOnlyOnce() throws Exception {
        User seller = user("VENDEDOR"); ProductVariant variant = variant(10);
        String receipt = sell(seller,"[{\"sku\":\""+variant.getSku()+"\",\"quantity\":2}]",0);
        var start = new java.util.concurrent.CountDownLatch(1);
        var pool = java.util.concurrent.Executors.newFixedThreadPool(2);
        java.util.concurrent.Callable<Integer> attempt = () -> {
            start.await();
            try { returnService.create(receipt,new ReturnRequest("Reintento simultáneo"),seller.getUsername()); return 201; }
            catch (org.springframework.web.server.ResponseStatusException e) { return e.getStatusCode().value(); }
        };
        try {
            var first=pool.submit(attempt); var second=pool.submit(attempt); start.countDown();
            int firstStatus=first.get(15,java.util.concurrent.TimeUnit.SECONDS);
            int secondStatus=second.get(15,java.util.concurrent.TimeUnit.SECONDS);
            assertTrue((firstStatus==201 && secondStatus==409) || (firstStatus==409 && secondStatus==201));
            assertEquals(10,variants.findById(variant.getId()).orElseThrow().getCurrentStock());
            int saleId=sales.findByReceiptNumber(receipt).orElseThrow().getId();
            assertEquals(1,returns.findAll().stream().filter(r -> r.getSaleId()==saleId).count());
            assertEquals(1,movements.findAll().stream().filter(m -> Integer.valueOf(saleId).equals(m.getSaleId()) && "ENTRADA_DEVOLUCION".equals(m.getType())).count());
        } finally { pool.shutdownNow(); }
    }

    private String sell(User user,String items,int discount) throws Exception {
        String json = mvc.perform(post("/api/sales").header("Authorization",bearer(user)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"items\":"+items+",\"paymentMethod\":\"EFECTIVO\",\"amountReceived\":1000,\"discountPercent\":"+discount+"}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        var matcher=Pattern.compile("\"receiptNumber\":\"([^\"]+)\"").matcher(json); assertTrue(matcher.find()); return matcher.group(1);
    }
    private ProductVariant variant(int stock) {
        Product product=new Product(); product.setName("Prenda devolución"); product.setCategory("Prueba"); product.setActive(true);
        ProductVariant variant=new ProductVariant(); variant.setSku("RET-"+UUID.randomUUID().toString().substring(0,8));
        variant.setSize("M"); variant.setColor("Negro"); variant.setPrice(new BigDecimal("100")); variant.setTaxRate(new BigDecimal("0.15")); variant.setMinStock(2); variant.setCurrentStock(stock); variant.setActive(true);
        product.addVariant(variant); products.save(product); return variant;
    }
    private User user(String role) {
        User user=new User(); user.setUsername("ret-"+UUID.randomUUID().toString().substring(0,8)); user.setFullName("Operador devolución"); user.setPasswordHash("unused"); user.setRole(roles.findByName(role).orElseThrow()); user.setActive(true); return users.save(user);
    }
    private String bearer(User user) { return "Bearer "+jwt.generateToken(user); }
}
