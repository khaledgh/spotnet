-- Create the message_templates table
CREATE TABLE IF NOT EXISTS message_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert some default message templates
INSERT INTO message_templates (name, content) VALUES
('Payment Due', 'Your subscription payment is due tomorrow. Please make the payment to continue your service.'),
('Payment Received', 'Thank you for your payment! Your subscription has been renewed successfully.'),
('Expiry Warning', 'Your subscription will expire in 3 days. Please renew to avoid service interruption.'),
('Service Update', 'We have updated your service plan. Please contact us if you have any questions.'),
('Payment Reminder', 'Reminder: Your monthly subscription payment is now due.');
