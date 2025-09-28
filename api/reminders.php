<?php
/**
 * Reminders API
 * Handles reminder management and WhatsApp messaging
 */

require_once 'config/db.php';

setCorsHeaders();
$userData = requireAuth();

$database = new Database();
$db = $database->getConnection();

$action = isset($_GET['action']) ? $_GET['action'] : '';

switch ($action) {
    case 'list':
        getReminders($db);
        break;
    case 'add':
        addReminder($db);
        break;
    case 'delete':
        deleteReminder($db);
        break;
    case 'send':
        sendReminder($db);
        break;
    case 'send_bulk':
        sendBulkReminders($db);
        break;
    default:
        sendResponse(false, 'Invalid action', null, 400);
}

function getReminders($db) {
    $client_id = isset($_GET['client_id']) ? (int)$_GET['client_id'] : 0;
    
    // Get pagination parameters
    $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
    $pageSize = isset($_GET['pageSize']) ? (int)$_GET['pageSize'] : 10;
    $offset = ($page - 1) * $pageSize;
    
    // Get sorting parameters
    $sortField = isset($_GET['sortField']) ? $_GET['sortField'] : 'created_at';
    $sortDirection = isset($_GET['sortDirection']) ? strtoupper($_GET['sortDirection']) : 'DESC';
    
    // Validate sort field to prevent SQL injection
    $allowedSortFields = ['id', 'client_id', 'message', 'status', 'send_via_whatsapp', 
                         'scheduled_date', 'sent_date', 'created_at'];
    if (!in_array($sortField, $allowedSortFields)) {
        $sortField = 'created_at';
    }
    
    // Validate sort direction
    if ($sortDirection !== 'ASC' && $sortDirection !== 'DESC') {
        $sortDirection = 'DESC';
    }
    
    // Get search parameters
    $search = isset($_GET['search']) ? $_GET['search'] : '';
    $status = isset($_GET['status']) && $_GET['status'] !== 'all' ? $_GET['status'] : null;
    $whatsappOnly = isset($_GET['whatsappOnly']) ? (int)$_GET['whatsappOnly'] : null;
    
    try {
        // Build the query
        $whereConditions = [];
        $params = [];
        
        if ($client_id > 0) {
            $whereConditions[] = "r.client_id = :client_id";
            $params[':client_id'] = $client_id;
        }
        
        if (!empty($search)) {
            $whereConditions[] = "(c.name LIKE :search OR r.message LIKE :search)";
            $params[':search'] = "%$search%";
        }
        
        if ($status !== null) {
            $whereConditions[] = "r.status = :status";
            $params[':status'] = $status;
        }
        
        if ($whatsappOnly !== null) {
            $whereConditions[] = "r.send_via_whatsapp = :whatsapp_only";
            $params[':whatsapp_only'] = $whatsappOnly;
        }
        
        $whereClause = '';
        if (!empty($whereConditions)) {
            $whereClause = 'WHERE ' . implode(' AND ', $whereConditions);
        }
        
        // Count total records for pagination
        $countQuery = "SELECT COUNT(*) as total FROM reminders r 
                      JOIN clients c ON r.client_id = c.id 
                      $whereClause";
        $countStmt = $db->prepare($countQuery);
        foreach ($params as $key => $value) {
            $countStmt->bindValue($key, $value);
        }
        $countStmt->execute();
        $totalItems = $countStmt->fetch(PDO::FETCH_ASSOC)['total'];
        
        // Get paginated data
        $query = "SELECT r.*, c.name as client_name, c.phone as client_phone, c.whatsapp_opt_in 
                  FROM reminders r 
                  JOIN clients c ON r.client_id = c.id 
                  $whereClause 
                  ORDER BY r.$sortField $sortDirection 
                  LIMIT :limit OFFSET :offset";
        
        $stmt = $db->prepare($query);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->bindValue(':limit', $pageSize, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $reminders = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Calculate total pages
        $totalPages = ceil($totalItems / $pageSize);
        
        $response = [
            'data' => $reminders,
            'pagination' => [
                'page' => $page,
                'pageSize' => $pageSize,
                'totalItems' => $totalItems,
                'totalPages' => $totalPages
            ]
        ];
        
        sendResponse(true, 'Reminders retrieved successfully', $response);
        
    } catch (PDOException $e) {
        sendResponse(false, 'Database error: ' . $e->getMessage(), null, 500);
    }
}

function addReminder($db) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $required = ['client_id', 'message'];
    foreach ($required as $field) {
        if (!isset($input[$field]) || empty(trim($input[$field]))) {
            sendResponse(false, ucfirst(str_replace('_', ' ', $field)) . ' is required', null, 400);
        }
    }
    
    $client_id = (int)$input['client_id'];
    $message = trim($input['message']);
    $send_via_whatsapp = isset($input['send_via_whatsapp']) ? (int)$input['send_via_whatsapp'] : 0;
    $scheduled_date = isset($input['scheduled_date']) ? $input['scheduled_date'] : null;
    
    try {
        // Check if client exists and get WhatsApp opt-in status
        $query = "SELECT whatsapp_opt_in FROM clients WHERE id = :client_id";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':client_id', $client_id);
        $stmt->execute();
        
        if ($stmt->rowCount() === 0) {
            sendResponse(false, 'Client not found', null, 404);
        }
        
        $client = $stmt->fetch();
        
        // If trying to send via WhatsApp but client hasn't opted in, adjust the setting
        if ($send_via_whatsapp && !$client['whatsapp_opt_in']) {
            $send_via_whatsapp = 0;
        }
        
        $query = "INSERT INTO reminders (client_id, message, send_via_whatsapp, scheduled_date) 
                  VALUES (:client_id, :message, :send_via_whatsapp, :scheduled_date)";
        
        $stmt = $db->prepare($query);
        $stmt->bindParam(':client_id', $client_id);
        $stmt->bindParam(':message', $message);
        $stmt->bindParam(':send_via_whatsapp', $send_via_whatsapp);
        $stmt->bindParam(':scheduled_date', $scheduled_date);
        
        if ($stmt->execute()) {
            $reminderId = $db->lastInsertId();
            
            // If scheduled for now or past, send immediately
            if (!$scheduled_date || strtotime($scheduled_date) <= time()) {
                sendReminderById($db, $reminderId);
            }
            
            sendResponse(true, 'Reminder added successfully', ['id' => $reminderId]);
        } else {
            sendResponse(false, 'Failed to add reminder', null, 500);
        }
        
    } catch (PDOException $e) {
        sendResponse(false, 'Database error: ' . $e->getMessage(), null, 500);
    }
}

function sendReminder($db) {
    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
    
    if ($id <= 0) {
        sendResponse(false, 'Valid reminder ID is required', null, 400);
    }
    
    $result = sendReminderById($db, $id);
    
    if ($result['success']) {
        sendResponse(true, $result['message']);
    } else {
        sendResponse(false, $result['message'], null, 500);
    }
}

function sendReminderById($db, $reminder_id) {
    try {
        // Get reminder and client details
        $query = "SELECT r.*, c.name as client_name, c.phone as client_phone, c.whatsapp_opt_in 
                  FROM reminders r 
                  JOIN clients c ON r.client_id = c.id 
                  WHERE r.id = :reminder_id AND r.status = 'pending'";
        
        $stmt = $db->prepare($query);
        $stmt->bindParam(':reminder_id', $reminder_id);
        $stmt->execute();
        
        if ($stmt->rowCount() === 0) {
            return ['success' => false, 'message' => 'Reminder not found or already sent'];
        }
        
        $reminder = $stmt->fetch();
        
        $status = 'sent';
        $error_message = null;
        
        // Check if should send via WhatsApp
        if ($reminder['send_via_whatsapp'] && $reminder['whatsapp_opt_in']) {
            $whatsapp_result = sendWhatsAppMessage($reminder['client_phone'], $reminder['message']);
            if (!$whatsapp_result['success']) {
                $status = 'failed';
                $error_message = $whatsapp_result['message'];
            }
        } else if ($reminder['send_via_whatsapp'] && !$reminder['whatsapp_opt_in']) {
            $status = 'failed';
            $error_message = 'Client has not opted in for WhatsApp messages';
        }
        
        // Update reminder status
        $query = "UPDATE reminders 
                  SET status = :status, sent_date = NOW() 
                  WHERE id = :reminder_id";
        
        $stmt = $db->prepare($query);
        $stmt->bindParam(':status', $status);
        $stmt->bindParam(':reminder_id', $reminder_id);
        $stmt->execute();
        
        if ($status === 'sent') {
            return ['success' => true, 'message' => 'Reminder sent successfully'];
        } else {
            return ['success' => false, 'message' => 'Failed to send reminder: ' . $error_message];
        }
        
    } catch (PDOException $e) {
        return ['success' => false, 'message' => 'Database error: ' . $e->getMessage()];
    }
}

function sendBulkReminders($db) {
    try {
        // Get all pending reminders that are scheduled for now or past
        $query = "SELECT r.*, c.name as client_name, c.phone as client_phone, c.whatsapp_opt_in 
                  FROM reminders r 
                  JOIN clients c ON r.client_id = c.id 
                  WHERE r.status = 'pending' 
                  AND (r.scheduled_date IS NULL OR r.scheduled_date <= NOW())";
        
        $stmt = $db->prepare($query);
        $stmt->execute();
        $reminders = $stmt->fetchAll();
        
        $sent_count = 0;
        $failed_count = 0;
        
        foreach ($reminders as $reminder) {
            $result = sendReminderById($db, $reminder['id']);
            if ($result['success']) {
                $sent_count++;
            } else {
                $failed_count++;
            }
        }
        
        $message = "Bulk send completed. Sent: $sent_count, Failed: $failed_count";
        sendResponse(true, $message, ['sent' => $sent_count, 'failed' => $failed_count]);
        
    } catch (PDOException $e) {
        sendResponse(false, 'Database error: ' . $e->getMessage(), null, 500);
    }
}

function deleteReminder($db) {
    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
    
    if ($id <= 0) {
        sendResponse(false, 'Valid reminder ID is required', null, 400);
    }
    
    try {
        $query = "DELETE FROM reminders WHERE id = :id";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':id', $id);
        
        if ($stmt->execute()) {
            if ($stmt->rowCount() > 0) {
                sendResponse(true, 'Reminder deleted successfully');
            } else {
                sendResponse(false, 'Reminder not found', null, 404);
            }
        } else {
            sendResponse(false, 'Failed to delete reminder', null, 500);
        }
        
    } catch (PDOException $e) {
        sendResponse(false, 'Database error: ' . $e->getMessage(), null, 500);
    }
}

function sendWhatsAppMessage($phone, $message) {
    // In a real application, you would integrate with WhatsApp Business API
    // For this demo, we'll simulate the sending
    
    // Remove any non-numeric characters from phone
    $phone = preg_replace('/[^0-9]/', '', $phone);
    
    // Simulate API call delay
    usleep(500000); // 0.5 second delay
    
    // Simulate 90% success rate
    $success = (rand(1, 10) <= 9);
    
    if ($success) {
        // Log the message (in real app, this would be the actual API call)
        error_log("WhatsApp message sent to $phone: $message");
        return ['success' => true, 'message' => 'WhatsApp message sent successfully'];
    } else {
        return ['success' => false, 'message' => 'WhatsApp API error: Failed to deliver message'];
    }
}
?>
