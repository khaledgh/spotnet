<?php
/**
 * WhatsApp API
 * Handles sending WhatsApp messages via wpbot.gocami.com
 */

require_once 'config/db.php';

setCorsHeaders();
$userData = requireAuth();

$database = new Database();
$db = $database->getConnection();

/*$action = isset($_GET['action']) ? $_GET['action'] : '';

switch ($action) {
    case 'send':
        sendWhatsAppMessage($db);
        break;
    case 'send_payment_confirmation':
        sendPaymentConfirmation($db);
        break;
    case 'generate_reminders':
        generatePaymentReminders($db);
        break;
    default:
        sendResponse(false, 'Invalid action', null, 400);
}*/

function logWhatsAppDebug($message) {
    $logFile = __DIR__ . '/whatsapp_debug.log';
    $timestamp = date('Y-m-d H:i:s');
    file_put_contents($logFile, "[$timestamp] $message" . PHP_EOL, FILE_APPEND);
}

function sendWhatsAppViaApi($db, $phoneRaw, $message) {
    if (empty($phoneRaw)) {
        return [
            'success' => false,
            'error' => 'Phone number is required',
            'http_code' => 400,
        ];
    }

    if (empty($message)) {
        return [
            'success' => false,
            'http_code' => 400,
        ];
    }

    $apiKey = getenv('WPBOT_API_KEY') ?: 'secure';
    logWhatsAppDebug('[whatsapp] using API key: ' . $apiKey);
    $phone = preg_replace('/[^0-9]/', '', $phoneRaw);

    $data = [
        'apiKey' => $apiKey,
        'number' => $phone,
        'message' => $message
    ];

    error_log('[whatsapp] sending payload: ' . json_encode($data));
    logWhatsAppDebug('[whatsapp] sending payload to external API: ' . json_encode($data));

    $ch = curl_init('https://wpbot.gocami.com/send-message');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    $curlInfo = curl_getinfo($ch);
    curl_close($ch);
    
    logWhatsAppDebug('[whatsapp] external API response: code=' . $httpCode . ' | response=' . $response . ' | error=' . ($curlError ?: 'none'));
    logWhatsAppDebug('[whatsapp] curl info: url=' . $curlInfo['url'] . ' | total_time=' . $curlInfo['total_time']);

    $decodedResponse = json_decode($response, true);
    $responseData = json_last_error() === JSON_ERROR_NONE ? $decodedResponse : $response;

    // Log the message attempt
    try {
        $query = "INSERT INTO whatsapp_logs (phone, message, response_code, response_data, created_at) 
                  VALUES (:phone, :message, :response_code, :response_data, NOW())";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':phone', $phone);
        $stmt->bindParam(':message', $message);
        $stmt->bindParam(':response_code', $httpCode, PDO::PARAM_INT);
        $responseToStore = is_string($responseData) ? $responseData : json_encode($responseData);
        $stmt->bindParam(':response_data', $responseToStore);
        $stmt->execute();
    } catch (PDOException $e) {
        error_log('Error logging WhatsApp message: ' . $e->getMessage());
    }

    if ($curlError) {
        return [
            'success' => false,
            'error' => $curlError,
            'http_code' => $httpCode ?: 500,
            'response' => $responseData,
        ];
    }

    $success = $httpCode >= 200 && $httpCode < 300;
    if (!$success) {
        $errorMessage = is_array($responseData) && isset($responseData['message'])
            ? $responseData['message']
            : 'Error sending WhatsApp message';

        return [
            'success' => false,
            'error' => $errorMessage,
            'http_code' => $httpCode,
            'response' => $responseData,
        ];
    }

    return [
        'success' => true,
        'http_code' => $httpCode,
        'response' => $responseData,
    ];
}

function sendPaymentConfirmation($db) {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) {
        $input = [];
    }

    $paymentId = $input['payment_id'] ?? ($_GET['payment_id'] ?? null);
    if (empty($paymentId)) {
        sendResponse(false, 'payment_id is required', null, 400);
    }

    $params = [
        'payment_id' => (int)$paymentId,
    ];

    if (isset($input['phone']) && $input['phone'] !== '') {
        $params['phone'] = $input['phone'];
    } elseif (!empty($_GET['phone'])) {
        $params['phone'] = $_GET['phone'];
    }

    if (isset($input['client_id'])) {
        $params['client_id'] = (int)$input['client_id'];
    } elseif (isset($_GET['client_id'])) {
        $params['client_id'] = (int)$_GET['client_id'];
    }

    logWhatsAppDebug('[whatsapp] payment confirmation request | params=' . json_encode($params));

    $result = sendPaymentConfirmationInternal($db, $params);

    if (!$result['success']) {
        sendResponse(false, $result['error'] ?? 'Error sending WhatsApp payment confirmation', $result['response'] ?? null, $result['http_code'] ?? 500);
    }

    sendResponse(true, 'WhatsApp payment confirmation sent successfully', [
        'response' => $result['response'] ?? null,
        'http_code' => $result['http_code'] ?? 200,
    ]);
}

function sendPaymentConfirmationInternal($db, array $params) {
    $paymentId = isset($params['payment_id']) ? (int)$params['payment_id'] : 0;

    if ($paymentId <= 0) {
        return [
            'success' => false,
            'error' => 'Valid payment ID is required',
            'http_code' => 400,
        ];
    }

    try {
        // Get payment details with client information
        $query = "SELECT p.*, s.client_id, c.name as client_name, c.phone, c.whatsapp_opt_in, s.type as subscription_type 
                  FROM payments p 
                  JOIN subscriptions s ON p.subscription_id = s.id 
                  JOIN clients c ON s.client_id = c.id 
                  WHERE p.id = :payment_id";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':payment_id', $paymentId);
        $stmt->execute();

        if ($stmt->rowCount() === 0) {
            return [
                'success' => false,
                'error' => 'Payment not found',
                'http_code' => 404,
            ];
        }

        $payment = $stmt->fetch(PDO::FETCH_ASSOC);

        $phone = $params['phone'] ?? $payment['phone'] ?? '';

        if (empty($phone)) {
            return [
                'success' => false,
                'error' => 'Client phone number is missing',
                'http_code' => 400,
            ];
        }

        if ((int)$payment['whatsapp_opt_in'] !== 1) {
            return [
                'success' => false,
                'error' => 'Client has not opted in for WhatsApp notifications',
                'http_code' => 400,
            ];
        }

        // Prepare message content
        $subscriptionType = ucfirst($payment['subscription_type']);
        $amount = number_format($payment['amount'], 2);
        $paymentDate = date('F j, Y', strtotime($payment['payment_date']));

        $message = "Hello {$payment['client_name']},\n\n" .
                   "We have received your {$subscriptionType} subscription payment.\n" .
                   "Amount: \\${$amount}\n" .
                   "Date: {$paymentDate}\n\n" .
                   "Thank you for your prompt payment.\n" .
                   "- Spotnet Team";

        // Create a new reminder entry for this message
        $insertReminder = $db->prepare("INSERT INTO reminders (client_id, message, send_via_whatsapp, status, scheduled_date, sent_date) 
                  VALUES (:client_id, :message, 1, 'sent', NOW(), NOW())");
        $insertReminder->bindParam(':client_id', $payment['client_id']);
        $insertReminder->bindParam(':message', $message);
        $insertReminder->execute();
        $reminderId = (int)$db->lastInsertId();

        $sendResult = sendWhatsAppViaApi($db, $phone, $message);

        if (!$sendResult['success']) {
            if ($reminderId > 0) {
                $updateReminder = $db->prepare("UPDATE reminders SET status = 'failed' WHERE id = :id");
                $updateReminder->bindParam(':id', $reminderId, PDO::PARAM_INT);
                $updateReminder->execute();
            }

            return [
                'success' => false,
                'error' => $sendResult['error'] ?? 'Unknown error sending WhatsApp message',
                'http_code' => $sendResult['http_code'] ?? 500,
                'response' => $sendResult['response'] ?? null,
            ];
        }

        return [
            'success' => true,
            'http_code' => $sendResult['http_code'] ?? 200,
            'response' => $sendResult['response'] ?? null,
        ];

    } catch (PDOException $e) {
        return [
            'success' => false,
            'error' => 'Database error: ' . $e->getMessage(),
            'http_code' => 500,
        ];
    }
}

/**
 * Send a WhatsApp message using the wpbot.gocami.com API
 */
function sendWhatsAppMessage($db) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Validate required fields
    if (!isset($input['phone']) || empty($input['phone'])) {
        sendResponse(false, 'Phone number is required', null, 400);
    }
    
    if (!isset($input['message']) || empty($input['message'])) {
        sendResponse(false, 'Message is required', null, 400);
    }
    
    $result = sendWhatsAppViaApi($db, $input['phone'], $input['message']);

    if (!$result['success']) {
        sendResponse(false, 'Error sending WhatsApp message: ' . ($result['error'] ?? 'Unknown error'), $result['response'] ?? null, $result['http_code'] ?? 500);
    }

    sendResponse(true, 'WhatsApp message sent successfully', [
        'response' => $result['response'] ?? null,
        'http_code' => $result['http_code'] ?? 200,
    ]);
}

/**
 * Generate payment reminders for subscriptions due in 5 days
 */
function generatePaymentReminders($db) {
    try {
        // Find subscriptions with payments due in 5 days
        $dueDate = date('Y-m-d', strtotime('+5 days'));
        
        $query = "SELECT s.*, c.name as client_name, c.phone, c.whatsapp_opt_in 
                  FROM subscriptions s 
                  JOIN clients c ON s.client_id = c.id 
                  WHERE s.status = 'active' 
                  AND DATE(s.next_payment_date) = :due_date 
                  AND c.whatsapp_opt_in = 1 
                  AND c.phone IS NOT NULL 
                  AND c.phone != ''";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':due_date', $dueDate);
        $stmt->execute();
        
        $subscriptions = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $count = count($subscriptions);
        
        if ($count === 0) {
            sendResponse(true, 'No upcoming payments due in 5 days', ['count' => 0]);
        }
        
        $created = 0;
        foreach ($subscriptions as $subscription) {
            // Format payment amount
            $amount = number_format($subscription['monthly_amount'], 2);
            $dueDate = date('d/m/Y', strtotime($subscription['next_payment_date']));
            
            // Create reminder message
            $message = "Hello " . $subscription['client_name'] . ", this is a reminder that your payment of $" . 
                       $amount . " for your " . $subscription['type'] . " subscription is due on " . $dueDate . 
                       ". Please ensure your account has sufficient funds.";
            
            // Check if a reminder for this subscription already exists
            $query = "SELECT id FROM reminders 
                      WHERE client_id = :client_id 
                      AND DATE(scheduled_date) = :scheduled_date 
                      AND status = 'pending'";
            $stmt = $db->prepare($query);
            $stmt->bindParam(':client_id', $subscription['client_id']);
            $stmt->bindParam(':scheduled_date', $dueDate);
            $stmt->execute();
            
            if ($stmt->rowCount() === 0) {
                // Create a new reminder
                $query = "INSERT INTO reminders (client_id, message, send_via_whatsapp, status, scheduled_date) 
                          VALUES (:client_id, :message, 1, 'pending', :scheduled_date)";
                $stmt = $db->prepare($query);
                $stmt->bindParam(':client_id', $subscription['client_id']);
                $stmt->bindParam(':message', $message);
                $stmt->bindParam(':scheduled_date', $subscription['next_payment_date']);
                $stmt->execute();
                $created++;
            }
        }
        
        sendResponse(true, 'Payment reminders generated successfully', [
            'total_subscriptions' => $count,
            'reminders_created' => $created
        ]);
        
    } catch (PDOException $e) {
        sendResponse(false, 'Database error: ' . $e->getMessage(), null, 500);
    }
}
?>
