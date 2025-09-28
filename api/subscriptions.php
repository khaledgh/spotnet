<?php
/**
 * Subscriptions API
 * Handles CRUD operations for subscriptions
 */

require_once 'config/db.php';

setCorsHeaders();
$userData = requireAuth();

$database = new Database();
$db = $database->getConnection();

$action = isset($_GET['action']) ? $_GET['action'] : '';

switch ($action) {
    case 'list':
        getSubscriptions($db);
        break;
    case 'add':
        addSubscription($db);
        break;
    case 'edit':
        editSubscription($db);
        break;
    case 'stop':
        stopSubscription($db);
        break;
    case 'resume':
        resumeSubscription($db);
        break;
    case 'delete':
        deleteSubscription($db);
        break;
    default:
        sendResponse(false, 'Invalid action', null, 400);
}

function getSubscriptions($db) {
    $client_id = isset($_GET['client_id']) ? (int)$_GET['client_id'] : 0;
    
    // Get pagination parameters
    $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
    $pageSize = isset($_GET['pageSize']) ? (int)$_GET['pageSize'] : 10;
    $offset = ($page - 1) * $pageSize;
    
    // Get sorting parameters
    $sortField = isset($_GET['sortField']) ? $_GET['sortField'] : 'created_at';
    $sortDirection = isset($_GET['sortDirection']) ? strtoupper($_GET['sortDirection']) : 'DESC';
    
    // Validate sort field to prevent SQL injection
    $allowedSortFields = ['id', 'client_id', 'type', 'start_date', 'end_date', 'billing_cycle', 
                         'monthly_amount', 'status', 'next_payment_date', 'created_at'];
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
    $type = isset($_GET['type']) && $_GET['type'] !== 'all' ? $_GET['type'] : null;
    
    try {
        // Update expired subscriptions
        updateExpiredSubscriptions($db);
        
        // Build the query
        $whereConditions = [];
        $params = [];
        
        if ($client_id > 0) {
            $whereConditions[] = "s.client_id = :client_id";
            $params[':client_id'] = $client_id;
        }
        
        if (!empty($search)) {
            $whereConditions[] = "(c.name LIKE :search OR c.email LIKE :search OR s.type LIKE :search)";
            $params[':search'] = "%$search%";
        }
        
        if ($status !== null) {
            $whereConditions[] = "s.status = :status";
            $params[':status'] = $status;
        }
        
        if ($type !== null) {
            $whereConditions[] = "s.type = :type";
            $params[':type'] = $type;
        }
        
        $whereClause = '';
        if (!empty($whereConditions)) {
            $whereClause = 'WHERE ' . implode(' AND ', $whereConditions);
        }
        
        // Count total records for pagination
        $countQuery = "SELECT COUNT(*) as total FROM subscriptions s 
                      JOIN clients c ON s.client_id = c.id 
                      $whereClause";
        $countStmt = $db->prepare($countQuery);
        foreach ($params as $key => $value) {
            $countStmt->bindValue($key, $value);
        }
        $countStmt->execute();
        $totalItems = $countStmt->fetch(PDO::FETCH_ASSOC)['total'];
        
        // Get paginated data
        $query = "SELECT s.*, c.name as client_name, c.email as client_email, c.phone as client_phone, c.whatsapp_opt_in as client_whatsapp_opt_in 
                  FROM subscriptions s 
                  JOIN clients c ON s.client_id = c.id 
                  $whereClause 
                  ORDER BY s.$sortField $sortDirection 
                  LIMIT :limit OFFSET :offset";
        
        $stmt = $db->prepare($query);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->bindValue(':limit', $pageSize, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $subscriptions = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Calculate total pages
        $totalPages = ceil($totalItems / $pageSize);
        
        $response = [
            'data' => $subscriptions,
            'pagination' => [
                'page' => $page,
                'pageSize' => $pageSize,
                'totalItems' => $totalItems,
                'totalPages' => $totalPages
            ]
        ];
        
        sendResponse(true, 'Subscriptions retrieved successfully', $response);
        
    } catch (PDOException $e) {
        sendResponse(false, 'Database error: ' . $e->getMessage(), null, 500);
    }
}

function addSubscription($db) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $required = ['client_id', 'type', 'start_date', 'billing_cycle', 'monthly_amount'];
    foreach ($required as $field) {
        if (!isset($input[$field]) || empty($input[$field])) {
            sendResponse(false, ucfirst(str_replace('_', ' ', $field)) . ' is required', null, 400);
        }
    }
    
    $client_id = (int)$input['client_id'];
    $type = $input['type'];
    $start_date = $input['start_date'];
    $billing_cycle = (int)$input['billing_cycle'];
    $monthly_amount = (float)$input['monthly_amount'];
    $end_date = isset($input['end_date']) ? $input['end_date'] : null;
    
    if (!in_array($billing_cycle, [1, 3])) {
        sendResponse(false, 'Billing cycle must be 1 or 3 months', null, 400);
    }
    
    if (!in_array($type, ['internet', 'satellite'])) {
        sendResponse(false, 'Type must be internet or satellite', null, 400);
    }
    
    // Calculate next payment date
    $next_payment_date = calculateNextPaymentDate($start_date, $billing_cycle);
    
    try {
        $query = "INSERT INTO subscriptions (client_id, type, start_date, end_date, billing_cycle, next_payment_date, monthly_amount) 
                  VALUES (:client_id, :type, :start_date, :end_date, :billing_cycle, :next_payment_date, :monthly_amount)";
        
        $stmt = $db->prepare($query);
        $stmt->bindParam(':client_id', $client_id);
        $stmt->bindParam(':type', $type);
        $stmt->bindParam(':start_date', $start_date);
        $stmt->bindParam(':end_date', $end_date);
        $stmt->bindParam(':billing_cycle', $billing_cycle);
        $stmt->bindParam(':next_payment_date', $next_payment_date);
        $stmt->bindParam(':monthly_amount', $monthly_amount);
        
        if ($stmt->execute()) {
            $subscriptionId = $db->lastInsertId();
            sendResponse(true, 'Subscription added successfully', ['id' => $subscriptionId]);
        } else {
            sendResponse(false, 'Failed to add subscription', null, 500);
        }
        
    } catch (PDOException $e) {
        sendResponse(false, 'Database error: ' . $e->getMessage(), null, 500);
    }
}

function editSubscription($db) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['id']) || (int)$input['id'] <= 0) {
        sendResponse(false, 'Valid subscription ID is required', null, 400);
    }
    
    $id = (int)$input['id'];
    $type = $input['type'];
    $start_date = $input['start_date'];
    $end_date = isset($input['end_date']) ? $input['end_date'] : null;
    $billing_cycle = (int)$input['billing_cycle'];
    $monthly_amount = (float)$input['monthly_amount'];
    
    if (!in_array($billing_cycle, [1, 3])) {
        sendResponse(false, 'Billing cycle must be 1 or 3 months', null, 400);
    }
    
    if (!in_array($type, ['internet', 'satellite'])) {
        sendResponse(false, 'Type must be internet or satellite', null, 400);
    }
    
    // Calculate next payment date
    $next_payment_date = calculateNextPaymentDate($start_date, $billing_cycle);
    
    try {
        $query = "UPDATE subscriptions 
                  SET type = :type, start_date = :start_date, end_date = :end_date, 
                      billing_cycle = :billing_cycle, next_payment_date = :next_payment_date, 
                      monthly_amount = :monthly_amount
                  WHERE id = :id";
        
        $stmt = $db->prepare($query);
        $stmt->bindParam(':type', $type);
        $stmt->bindParam(':start_date', $start_date);
        $stmt->bindParam(':end_date', $end_date);
        $stmt->bindParam(':billing_cycle', $billing_cycle);
        $stmt->bindParam(':next_payment_date', $next_payment_date);
        $stmt->bindParam(':monthly_amount', $monthly_amount);
        $stmt->bindParam(':id', $id);
        
        if ($stmt->execute()) {
            sendResponse(true, 'Subscription updated successfully');
        } else {
            sendResponse(false, 'Failed to update subscription', null, 500);
        }
        
    } catch (PDOException $e) {
        sendResponse(false, 'Database error: ' . $e->getMessage(), null, 500);
    }
}

function stopSubscription($db) {
    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
    
    if ($id <= 0) {
        sendResponse(false, 'Valid subscription ID is required', null, 400);
    }
    
    try {
        $query = "UPDATE subscriptions SET status = 'stopped' WHERE id = :id";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':id', $id);
        
        if ($stmt->execute()) {
            sendResponse(true, 'Subscription stopped successfully');
        } else {
            sendResponse(false, 'Failed to stop subscription', null, 500);
        }
        
    } catch (PDOException $e) {
        sendResponse(false, 'Database error: ' . $e->getMessage(), null, 500);
    }
}

function resumeSubscription($db) {
    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
    
    if ($id <= 0) {
        sendResponse(false, 'Valid subscription ID is required', null, 400);
    }
    
    try {
        $query = "UPDATE subscriptions SET status = 'active' WHERE id = :id";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':id', $id);
        
        if ($stmt->execute()) {
            sendResponse(true, 'Subscription resumed successfully');
        } else {
            sendResponse(false, 'Failed to resume subscription', null, 500);
        }
        
    } catch (PDOException $e) {
        sendResponse(false, 'Database error: ' . $e->getMessage(), null, 500);
    }
}

function deleteSubscription($db) {
    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
    
    if ($id <= 0) {
        sendResponse(false, 'Valid subscription ID is required', null, 400);
    }
    
    try {
        $query = "DELETE FROM subscriptions WHERE id = :id";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':id', $id);
        
        if ($stmt->execute()) {
            if ($stmt->rowCount() > 0) {
                sendResponse(true, 'Subscription deleted successfully');
            } else {
                sendResponse(false, 'Subscription not found', null, 404);
            }
        } else {
            sendResponse(false, 'Failed to delete subscription', null, 500);
        }
        
    } catch (PDOException $e) {
        sendResponse(false, 'Database error: ' . $e->getMessage(), null, 500);
    }
}

function calculateNextPaymentDate($start_date, $billing_cycle) {
    $date = new DateTime($start_date);
    $date->add(new DateInterval('P' . $billing_cycle . 'M'));
    return $date->format('Y-m-d');
}

function updateExpiredSubscriptions($db) {
    try {
        $query = "UPDATE subscriptions 
                  SET status = 'expired' 
                  WHERE status = 'active' AND next_payment_date < CURDATE()";
        $stmt = $db->prepare($query);
        $stmt->execute();
    } catch (PDOException $e) {
        // Log error but don't stop execution
        error_log('Failed to update expired subscriptions: ' . $e->getMessage());
    }
}
?>
