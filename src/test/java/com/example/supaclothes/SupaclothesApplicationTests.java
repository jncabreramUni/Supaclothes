package com.example.supaclothes;

import com.example.supaclothes.repository.RoleRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
class SupaclothesApplicationTests {

	@Autowired
	private RoleRepository roleRepository;

	@Test
	void contextLoads() {
	}

	@Test
	void initializesEveryUserRoleEvenWhenAdminAlreadyExists() {
		assertTrue(roleRepository.findByName("ADMIN").isPresent());
		assertTrue(roleRepository.findByName("VENDEDOR").isPresent());
		assertTrue(roleRepository.findByName("BODEGA").isPresent());
	}

}
