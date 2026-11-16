package com.example.supaclothes;

import com.example.supaclothes.entity.User;
import com.example.supaclothes.repository.RoleRepository;
import com.example.supaclothes.repository.UserRepository;
import com.example.supaclothes.security.JwtService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class AnalyticsIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired RoleRepository roles;
    @Autowired JwtService jwt;

    @Test
    void onlyAdministratorsCanReadOrExportReports() throws Exception {
        String admin = token("ADMIN");
        String seller = token("VENDEDOR");
        String warehouse = token("BODEGA");
        for (String path : new String[]{"/dashboard", "/sales", "/inventory", "/sales/export", "/inventory/export"}) {
            mvc.perform(get("/api/reports" + path)).andExpect(status().isUnauthorized());
            mvc.perform(get("/api/reports" + path).header("Authorization", seller)).andExpect(status().isForbidden());
            mvc.perform(get("/api/reports" + path).header("Authorization", warehouse)).andExpect(status().isForbidden());
            mvc.perform(get("/api/reports" + path).header("Authorization", admin)).andExpect(status().isOk());
        }
    }

    @Test
    void rejectsInvalidAndExcessiveDateRanges() throws Exception {
        String admin = token("ADMIN");
        mvc.perform(get("/api/reports/dashboard").header("Authorization", admin).param("from", "2026-11-01").param("to", "2026-10-01"))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/reports/sales/export").header("Authorization", admin).param("from", "2025-01-01").param("to", "2026-12-31"))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/reports/sales").header("Authorization", admin).param("from", "invalid"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void exportHasExcelContentTypeFilenameAndZipSignature() throws Exception {
        var response = mvc.perform(get("/api/reports/sales/export").header("Authorization", token("ADMIN"))
                        .param("from", "2001-01-01").param("to", "2001-01-02"))
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .andExpect(header().string("Content-Disposition", "attachment; filename=\"ventas-2001-01-01-2001-01-02.xlsx\""))
                .andReturn().getResponse();
        assertEquals('P', response.getContentAsByteArray()[0]);
        assertEquals('K', response.getContentAsByteArray()[1]);
        mvc.perform(get("/api/reports/dashboard").header("Authorization", token("ADMIN"))
                        .param("from", "2001-01-01").param("to", "2001-01-02"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.salesCount").value(0))
                .andExpect(jsonPath("$.daily.length()").value(2)).andExpect(jsonPath("$.netSales").value(0));
    }

    private String token(String role) {
        User user = new User();
        user.setUsername("report-" + UUID.randomUUID().toString().substring(0, 8));
        user.setFullName("Prueba reportes"); user.setPasswordHash("unused");
        user.setRole(roles.findByName(role).orElseThrow()); user.setActive(true);
        return "Bearer " + jwt.generateToken(users.save(user));
    }
}
