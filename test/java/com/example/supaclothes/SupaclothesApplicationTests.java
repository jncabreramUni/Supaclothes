package com.example.supaclothes;

import com.example.supaclothes.repository.RoleRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class SupaclothesApplicationTests {

	@Autowired
	private RoleRepository roleRepository;

	@Autowired
	private MockMvc mockMvc;

	@Test
	void contextLoads() {
	}

	@Test
	void initializesEveryUserRoleEvenWhenAdminAlreadyExists() {
		assertTrue(roleRepository.findByName("ADMIN").isPresent());
		assertTrue(roleRepository.findByName("VENDEDOR").isPresent());
		assertTrue(roleRepository.findByName("BODEGA").isPresent());
	}

	@Test
	void servesFrontendAssetsWithoutAuthentication() throws Exception {
		mockMvc.perform(get("/"))
				.andExpect(status().isOk());
		mockMvc.perform(get("/index.html"))
				.andExpect(status().isOk())
				.andExpect(content().string(containsString("SupaClothes")));
		mockMvc.perform(get("/css/estilos.css")).andExpect(status().isOk());
		mockMvc.perform(get("/js/app.js")).andExpect(status().isOk());
		mockMvc.perform(get("/favicon.svg")).andExpect(status().isOk());
	}

	@Test
	void protectsApiEndpointsWithoutAuthentication() throws Exception {
		mockMvc.perform(get("/api/products")).andExpect(status().isUnauthorized());
	}

}
