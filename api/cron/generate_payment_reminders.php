<?php
/**
 * Cron job to generate payment reminders for subscriptions due in 5 days
 * 
 * This script should be run daily via cron job:
 * 0 8 * * * php /path/to/generate_payment_reminders.php
 */

// Set to true to run in CLI mode, false for web mode
define('CLI_MODE', php_sapi_name() === 'cli');

// Include database configuration
require_once dirname(__DIR__) . '/api/config/db.php';

// Initialize database connection
$database = new Database();
$db = $database->getConnection();

// API endpoint URL
$apiUrl = CLI_MODE ? 'http://localhost/api/whatsapp.php?action=generate_reminders' : 
          'http://' . $_SERVER['HTTP_HOST'] . '/api/whatsapp.php?action=generate_reminders';

// Make API call to generate reminders
$ch = curl_init($apiUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([]));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);

// Add authentication header if available
if (!CLI_MODE && isset($_SERVER['HTTP_AUTHORIZATION'])) {
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Authorization: ' . $_SERVER['HTTP_AUTHORIZATION']
    ]);
} else {
    // For CLI mode, we need to create a valid auth token
    // This is a simplified example - in production, use a more secure approach
    $token = generateAuthToken($db);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $token
    ]);
}

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

// Parse response
$result = json_decode($response, true);

// Output result
if (CLI_MODE) {
    echo "Payment reminders generation result:\n";
    echo "Status: " . ($result['success'] ? 'Success' : 'Failed') . "\n";
    echo "Message: " . $result['message'] . "\n";
    
    if (isset($result['data'])) {
        echo "Total subscriptions due in 5 days: " . $result['data']['total_subscriptions'] . "\n";
        echo "Reminders created: " . $result['data']['reminders_created'] . "\n";
    }
} else {
    header('Content-Type: application/json');
    echo json_encode($result);
}

/**
 * Generate a temporary auth token for CLI mode
 */
function generateAuthToken($db) {
    try {
        // Get the first admin user
        $query = "SELECT id FROM system_users WHERE role = 'admin' LIMIT 1";
        $stmt = $db->prepare($query);
        $stmt->execute();
        
        if ($stmt->rowCount() === 0) {
            die("No admin user found to generate token\n");
        }
        
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        $userId = $user['id'];
        
        // Generate a token valid for 5 minutes
        $expiry = time() + 300; // 5 minutes
        $tokenData = [
            'user_id' => $userId,
            'exp' => $expiry
        ];
        
        // In a real app, you would use a proper JWT library
        // This is a simplified example
        $token = base64_encode(json_encode($tokenData));
        
        return $token;
    } catch (PDOException $e) {
        die("Database error: " . $e->getMessage() . "\n");
    }
}
?>
