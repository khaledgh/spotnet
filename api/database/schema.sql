-- Subscription Management System Database Schema
-- Created: 2025-09-28

CREATE DATABASE IF NOT EXISTS subscription_management;
USE subscription_management;

-- System Users Table (for admin/staff login)
CREATE TABLE system_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'staff') DEFAULT 'staff',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Clients Table
CREATE TABLE clients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20),
    status ENUM('active', 'stopped') DEFAULT 'active',
    whatsapp_opt_in TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Subscriptions Table
CREATE TABLE subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT NOT NULL,
    type ENUM('internet', 'satellite') NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    billing_cycle INT NOT NULL CHECK (billing_cycle IN (1, 3)), -- 1 or 3 months
    status ENUM('active', 'stopped', 'expired') DEFAULT 'active',
    next_payment_date DATE NOT NULL,
    monthly_amount DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- Payments Table
CREATE TABLE payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    subscription_id INT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'cash',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE
);

-- Reminders Table
CREATE TABLE reminders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT NOT NULL,
    message TEXT NOT NULL,
    send_via_whatsapp TINYINT(1) DEFAULT 0,
    status ENUM('pending', 'sent', 'failed') DEFAULT 'pending',
    scheduled_date DATETIME,
    sent_date DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- Insert default admin user (password: admin123)
INSERT INTO system_users (name, email, password, role) VALUES 
('Administrator', 'admin@subscription.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin'),
('Staff User', 'staff@subscription.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'staff');

-- Insert sample clients
INSERT INTO clients (name, email, phone, status, whatsapp_opt_in) VALUES 
('John Doe', 'john@example.com', '+1234567890', 'active', 1),
('Jane Smith', 'jane@example.com', '+1234567891', 'active', 0),
('Bob Johnson', 'bob@example.com', '+1234567892', 'stopped', 1);

-- Insert sample subscriptions
INSERT INTO subscriptions (client_id, type, start_date, billing_cycle, next_payment_date, monthly_amount) VALUES 
(1, 'internet', '2024-01-01', 1, '2025-10-01', 50.00),
(1, 'satellite', '2024-01-01', 3, '2025-10-01', 30.00),
(2, 'internet', '2024-02-01', 1, '2025-10-01', 45.00),
(3, 'internet', '2024-03-01', 1, '2025-10-01', 55.00);

-- Insert sample payments
INSERT INTO payments (subscription_id, amount, payment_date, payment_method) VALUES 
(1, 50.00, '2024-09-01', 'cash'),
(2, 90.00, '2024-07-01', 'bank_transfer'),
(3, 45.00, '2024-09-01', 'cash');

-- Insert sample reminders
INSERT INTO reminders (client_id, message, send_via_whatsapp, status, scheduled_date) VALUES 
(1, 'Your internet subscription payment is due tomorrow.', 1, 'pending', '2025-09-30 10:00:00'),
(2, 'Please update your contact information.', 0, 'sent', '2025-09-25 14:00:00');
