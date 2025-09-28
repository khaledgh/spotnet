<?php
/**
 * WhatsApp service helpers.
 * Provides reusable functions for sending WhatsApp messages and confirmations.
 */

require_once __DIR__ . '/config/db.php';

function logWhatsAppDebug($message)
{
    $logFile = __DIR__ . '/whatsapp_debug.log';
    $timestamp = date('Y-m-d H:i:s');
    file_put_contents($logFile, "[$timestamp] $message" . PHP_EOL, FILE_APPEND);
}

function sendWhatsAppViaApi($db, $phoneRaw, $message)
{
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
        'message' => $message,
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

function sendPaymentConfirmationInternal($db, array $params)
{
    $paymentId = isset($params['payment_id']) ? (int) $params['payment_id'] : 0;

    if ($paymentId <= 0) {
        return [
            'success' => false,
            'error' => 'Valid payment ID is required',
            'http_code' => 400,
        ];
    }

    try {
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

        if ((int) $payment['whatsapp_opt_in'] !== 1) {
            return [
                'success' => false,
                'error' => 'Client has not opted in for WhatsApp notifications',
                'http_code' => 400,
            ];
        }

        $subscriptionType = ucfirst($payment['subscription_type']);
        $amount = number_format($payment['amount'], 2);
        $paymentDate = date('F j, Y', strtotime($payment['payment_date']));

        $message = "Hello {$payment['client_name']},\n\n" .
                   "We have received your {$subscriptionType} subscription payment.\n" .
                   'Amount: $' . $amount . "\n" .
                   "Date: {$paymentDate}\n\n" .
                   "Thank you for your prompt payment.\n" .
                   "- Spotnet Team";

        $insertReminder = $db->prepare("INSERT INTO reminders (client_id, message, send_via_whatsapp, status, scheduled_date, sent_date)
                  VALUES (:client_id, :message, 1, 'sent', NOW(), NOW())");
        $insertReminder->bindParam(':client_id', $payment['client_id']);
        $insertReminder->bindParam(':message', $message);
        $insertReminder->execute();
        $reminderId = (int) $db->lastInsertId();

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

function sendPaymentConfirmationMessage($db, $paymentId, array $options = [])
{
    $params = array_merge($options, ['payment_id' => $paymentId]);
    return sendPaymentConfirmationInternal($db, $params);
}
