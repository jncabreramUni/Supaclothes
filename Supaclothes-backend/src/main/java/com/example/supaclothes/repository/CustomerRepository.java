package com.example.supaclothes.repository;
import com.example.supaclothes.entity.Customer;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface CustomerRepository extends JpaRepository<Customer, Long> {
    boolean existsByDocumentNumber(String documentNumber);
    List<Customer> findTop50ByNameContainingIgnoreCaseOrDocumentNumberContainingIgnoreCaseOrderByName(String name, String document);
}
