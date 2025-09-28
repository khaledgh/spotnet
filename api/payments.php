<?php
/**
 * Payments API
 * Handles payment processing and recording
 */

require_once 'config/db.php';
require_once __DIR__ . '/whatsapp_service.php';

setCorsHeaders();
$userData = requireAuth();

$database = new Database();
$db = $database->getConnection();

$action = isset($_GET['action']) ? $_GET['action'] : '';

switch ($action) {
    case 'pay':
        processPayment($db);
        break;
    case 'list':
        getPayments($db);
        break;
    case 'history':
        getPaymentHistory($db);
        break;
    default:
        sendResponse(false, 'Invalid action', null, 400);
}

function processPayment($db) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $required = ['subscription_id', 'amount'];
    foreach ($required as $field) {
        if (!isset($input[$field]) || empty($input[$field])) {
            sendResponse(false, ucfirst(str_replace('_', ' ', $field)) . ' is required', null, 400);
        }
    }
    
    $subscription_id = (int)$input['subscription_id'];
    $amount = (float)$input['amount'];
    $payment_method = isset($input['payment_method']) ? $input['payment_method'] : 'cash';
    $notes = isset($input['notes']) ? trim($input['notes']) : '';
    $payment_date = isset($input['payment_date']) && !empty($input['payment_date'])
        ? date('Y-m-d', strtotime($input['payment_date']))
        : date('Y-m-d');
    $send_whatsapp_request = isset($input['send_whatsapp']) ? (bool)$input['send_whatsapp'] : null;

    try {
        $db->beginTransaction();
        
        // Get subscription details
        $query = "SELECT s.*, c.name as client_name, c.email as client_email, c.phone as client_phone, c.whatsapp_opt_in 
                  FROM subscriptions s 
                  JOIN clients c ON s.client_id = c.id 
                  WHERE s.id = :subscription_id";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':subscription_id', $subscription_id);
        $stmt->execute();
        
        if ($stmt->rowCount() === 0) {
            $db->rollBack();
            sendResponse(false, 'Subscription not found', null, 404);
        }
        
        $subscription = $stmt->fetch();
        
        // Record payment
        $query = "INSERT INTO payments (subscription_id, amount, payment_date, payment_method, notes) 
                  VALUES (:subscription_id, :amount, :payment_date, :payment_method, :notes)";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':subscription_id', $subscription_id);
        $stmt->bindParam(':amount', $amount);
        $stmt->bindParam(':payment_date', $payment_date);
        $stmt->bindParam(':payment_method', $payment_method);
        $stmt->bindParam(':notes', $notes);
        
        if (!$stmt->execute()) {
            $db->rollBack();
            sendResponse(false, 'Failed to record payment', null, 500);
        }
        
        $payment_id = $db->lastInsertId();
        
        // Calculate new next payment date
        $current_next_date = new DateTime($subscription['next_payment_date']);
        $billing_cycle = $subscription['billing_cycle'];
        $new_next_date = clone $current_next_date;
        $new_next_date->add(new DateInterval('P' . $billing_cycle . 'M'));
        
        // Update subscription next payment date and status
        $query = "UPDATE subscriptions 
                  SET next_payment_date = :next_payment_date, status = 'active' 
                  WHERE id = :subscription_id";
        $stmt = $db->prepare($query);
        
        // Fix: Store the formatted date in a variable first, then pass that variable
        $formatted_date = $new_next_date->format('Y-m-d');
        $stmt->bindParam(':next_payment_date', $formatted_date);
        $stmt->bindParam(':subscription_id', $subscription_id);
        
        if (!$stmt->execute()) {
            $db->rollBack();
            sendResponse(false, 'Failed to update subscription', null, 500);
        }
        
        $db->commit();
        
        // Send email notification
        sendPaymentConfirmationEmail($subscription, $amount, $payment_date, $new_next_date->format('Y-m-d'));

        $whatsapp_sent = false;
        $whatsapp_error = null;

        // Determine if we should send WhatsApp: explicit toggle or automatic opt-in
        $should_send_whatsapp = $send_whatsapp_request === null
            ? ((int)$subscription['whatsapp_opt_in'] === 1 && !empty($subscription['client_phone']))
            : ($send_whatsapp_request && (int)$subscription['whatsapp_opt_in'] === 1 && !empty($subscription['client_phone']));

        $evalMessage = '[payments] WhatsApp eval | payment_id=' . $payment_id . ' | subscription_id=' . $subscription_id . ' | opt_in=' . $subscription['whatsapp_opt_in'] . ' | phone=' . $subscription['client_phone'] . ' | send_request=' . var_export($send_whatsapp_request, true) . ' | should_send=' . ($should_send_whatsapp ? 'yes' : 'no');
        error_log($evalMessage);
        logWhatsAppDebug($evalMessage);

        if ($should_send_whatsapp) {

            $confirmationResult = sendPaymentConfirmationMessage($db, $payment_id, [
                'phone' => $subscription['client_phone'],
                'client_id' => $subscription['client_id'],
            ]);

            $whatsapp_sent = $confirmationResult['success'];
            $whatsapp_error = $confirmationResult['error'] ?? null;

            $responseMessage = '[payments] WhatsApp internal send | payment_id=' . $payment_id . ' | sent=' . ($whatsapp_sent ? 'yes' : 'no') . ' | error=' . ($whatsapp_error ?? 'none') . ' | response=' . json_encode($confirmationResult['response'] ?? null);
            error_log($responseMessage);
            logWhatsAppDebug($responseMessage);
        }

        $response_data = [
            'payment_id' => $payment_id,
            'next_payment_date' => $new_next_date->format('Y-m-d'),
            'whatsapp_sent' => $whatsapp_sent,
            'whatsapp_error' => $whatsapp_error
        ];
        
        sendResponse(true, 'Payment processed successfully', $response_data);
        
    } catch (PDOException $e) {
        $db->rollBack();
        sendResponse(false, 'Database error: ' . $e->getMessage(), null, 500);
    }
}

function getPayments($db) {
    $subscription_id = isset($_GET['subscription_id']) ? (int)$_GET['subscription_id'] : 0;
    $client_id = isset($_GET['client_id']) ? (int)$_GET['client_id'] : 0;
    
    try {
        $query = "SELECT p.*, s.type as subscription_type, c.name as client_name, c.id as client_id 
                  FROM payments p 
                  JOIN subscriptions s ON p.subscription_id = s.id 
                  JOIN clients c ON s.client_id = c.id";
        
        $params = [];
        $conditions = [];
        
        if ($subscription_id > 0) {
            $conditions[] = "p.subscription_id = :subscription_id";
            $params[':subscription_id'] = $subscription_id;
        }
        
        if ($client_id > 0) {
            $conditions[] = "s.client_id = :client_id";
            $params[':client_id'] = $client_id;
        }
        
        if (!empty($conditions)) {
            $query .= " WHERE " . implode(" AND ", $conditions);
        }
        
        $query .= " ORDER BY p.payment_date DESC";
        
        $stmt = $db->prepare($query);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->execute();
        
        $payments = $stmt->fetchAll();
        
        sendResponse(true, 'Payments retrieved successfully', $payments);
        
    } catch (PDOException $e) {
        sendResponse(false, 'Database error: ' . $e->getMessage(), null, 500);
    }
}

function getPaymentHistory($db) {
    try {
        $query = "SELECT 
                    DATE_FORMAT(p.payment_date, '%Y-%m') as month,
                    COUNT(p.id) as payment_count,
                    SUM(p.amount) as total_amount,
                    AVG(p.amount) as avg_amount
                  FROM payments p 
                  WHERE p.payment_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
                  GROUP BY DATE_FORMAT(p.payment_date, '%Y-%m')
                  ORDER BY month DESC";
        
        $stmt = $db->prepare($query);
        $stmt->execute();
        $history = $stmt->fetchAll();
        
        // Get recent payments
        $query = "SELECT p.*, s.type as subscription_type, c.name as client_name 
                  FROM payments p 
                  JOIN subscriptions s ON p.subscription_id = s.id 
                  JOIN clients c ON s.client_id = c.id 
                  ORDER BY p.payment_date DESC 
                  LIMIT 10";
        
        $stmt = $db->prepare($query);
        $stmt->execute();
        $recent_payments = $stmt->fetchAll();
        
        $data = [
            'monthly_history' => $history,
            'recent_payments' => $recent_payments
        ];
        
        sendResponse(true, 'Payment history retrieved successfully', $data);
        
    } catch (PDOException $e) {
        sendResponse(false, 'Database error: ' . $e->getMessage(), null, 500);
    }
}

function sendPaymentConfirmationEmail($subscription, $amount, $payment_date, $next_payment_date) {
    $to = $subscription['client_email'];
    $subject = "Payment Confirmation - " . ucfirst($subscription['type']) . " Subscription";
    
    $message = "
    <html>
    <head>
        <title>Payment Confirmation</title>
    </head>
    <body>
        <h2>Payment Confirmation</h2>
        <p>Dear {$subscription['client_name']},</p>
        <p>We have successfully received your payment for your {$subscription['type']} subscription.</p>
        
        <h3>Payment Details:</h3>
        <ul>
            <li><strong>Amount:</strong> $" . number_format($amount, 2) . "</li>
            <li><strong>Payment Date:</strong> " . date('F j, Y', strtotime($payment_date)) . "</li>
            <li><strong>Subscription Type:</strong> " . ucfirst($subscription['type']) . "</li>
            <li><strong>Next Payment Due:</strong> " . date('F j, Y', strtotime($next_payment_date)) . "</li>
        </ul>
        
        <p>Thank you for your continued business!</p>
        
        <p>Best regards,<br>
        Subscription Management Team</p>
    </body>
    </html>
    ";
    
    $headers = "MIME-Version: 1.0" . "\r\n";
    $headers .= "Content-type:text/html;charset=UTF-8" . "\r\n";
    $headers .= "From: noreply@subscription-system.com" . "\r\n";
    
    // In a real application, you would use a proper email service
    // For now, we'll just log the email
    error_log("Email sent to: $to\nSubject: $subject\nMessage: $message");
    
    return true;
}
?>
