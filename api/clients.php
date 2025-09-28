<?php
/**
 * Clients API
 * Handles CRUD operations for clients
 */

require_once 'config/db.php';

setCorsHeaders();
$userData = requireAuth();

$database = new Database();
$db = $database->getConnection();

$action = isset($_GET['action']) ? $_GET['action'] : '';

switch ($action) {
    case 'list':
        getClients($db);
        break;
    case 'add':
        addClient($db);
        break;
    case 'edit':
        editClient($db);
        break;
    case 'delete':
        deleteClient($db);
        break;
    case 'get':
        getClient($db);
        break;
    default:
        sendResponse(false, 'Invalid action', null, 400);
}

function getClients($db) {
    try {
        // Get pagination parameters
        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        $pageSize = isset($_GET['pageSize']) ? (int)$_GET['pageSize'] : 10;
        $offset = ($page - 1) * $pageSize;
        
        // Get sorting parameters
        $sortField = isset($_GET['sortField']) ? $_GET['sortField'] : 'created_at';
        $sortDirection = isset($_GET['sortDirection']) ? strtoupper($_GET['sortDirection']) : 'DESC';
        
        // Validate sort field to prevent SQL injection
        $allowedSortFields = ['id', 'name', 'email', 'phone', 'status', 'created_at'];
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
        $whatsappOptIn = isset($_GET['whatsappOptIn']) ? (int)$_GET['whatsappOptIn'] : null;
        
        // Build the query
        $whereConditions = [];
        $params = [];
        
        if (!empty($search)) {
            $whereConditions[] = "(c.name LIKE :search OR c.email LIKE :search OR c.phone LIKE :search)";
            $params[':search'] = "%$search%";
        }
        
        if ($status !== null) {
            $whereConditions[] = "c.status = :status";
            $params[':status'] = $status;
        }
        
        if ($whatsappOptIn !== null) {
            $whereConditions[] = "c.whatsapp_opt_in = :whatsapp_opt_in";
            $params[':whatsapp_opt_in'] = $whatsappOptIn;
        }
        
        $whereClause = '';
        if (!empty($whereConditions)) {
            $whereClause = 'WHERE ' . implode(' AND ', $whereConditions);
        }
        
        // Count total records for pagination
        $countQuery = "SELECT COUNT(DISTINCT c.id) as total FROM clients c $whereClause";
        $countStmt = $db->prepare($countQuery);
        foreach ($params as $key => $value) {
            $countStmt->bindValue($key, $value);
        }
        $countStmt->execute();
        $totalItems = $countStmt->fetch(PDO::FETCH_ASSOC)['total'];
        
        // Get paginated data
        $query = "SELECT c.*, 
                       COUNT(s.id) as subscription_count,
                       COUNT(CASE WHEN s.status = 'active' THEN 1 END) as active_subscriptions
                FROM clients c 
                LEFT JOIN subscriptions s ON c.id = s.client_id 
                $whereClause
                GROUP BY c.id 
                ORDER BY c.$sortField $sortDirection
                LIMIT :limit OFFSET :offset";
        
        $stmt = $db->prepare($query);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->bindValue(':limit', $pageSize, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $clients = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Calculate total pages
        $totalPages = ceil($totalItems / $pageSize);
        
        $response = [
            'data' => $clients,
            'pagination' => [
                'page' => $page,
                'pageSize' => $pageSize,
                'totalItems' => $totalItems,
                'totalPages' => $totalPages
            ]
        ];
        
        sendResponse(true, 'Clients retrieved successfully', $response);
        
    } catch (PDOException $e) {
        sendResponse(false, 'Database error: ' . $e->getMessage(), null, 500);
    }
}

function getClient($db) {
    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
    
    if ($id <= 0) {
        sendResponse(false, 'Valid client ID is required', null, 400);
    }
    
    try {
        $query = "SELECT * FROM clients WHERE id = :id";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        
        if ($stmt->rowCount() === 0) {
            sendResponse(false, 'Client not found', null, 404);
        }
        
        $client = $stmt->fetch();
        
        $query = "SELECT * FROM subscriptions WHERE client_id = :client_id ORDER BY created_at DESC";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':client_id', $id);
        $stmt->execute();
        $subscriptions = $stmt->fetchAll();

        // Get client's reminders
        $query = "SELECT * FROM reminders WHERE client_id = :client_id ORDER BY created_at DESC";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':client_id', $id);
        $stmt->execute();
        $reminders = $stmt->fetchAll();

        // Get client's payments
        $query = "SELECT p.*, s.type as subscription_type
                  FROM payments p
                  JOIN subscriptions s ON p.subscription_id = s.id
                  WHERE s.client_id = :client_id
                  ORDER BY p.payment_date DESC";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':client_id', $id);
        $stmt->execute();
        $payments = $stmt->fetchAll();

        $client['subscriptions'] = $subscriptions;
        $client['reminders'] = $reminders;
        $client['payments'] = $payments;

        sendResponse(true, 'Client retrieved successfully', $client);

    } catch (PDOException $e) {
        sendResponse(false, 'Database error: ' . $e->getMessage(), null, 500);
    }
}

function addClient($db) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Only name is required
    if (!isset($input['name']) || empty(trim($input['name']))) {
        sendResponse(false, 'Name is required', null, 400);
    }
    
    $name = trim($input['name']);
    $email = isset($input['email']) && !empty(trim($input['email'])) ? trim($input['email']) : '';
    $phone = isset($input['phone']) ? trim($input['phone']) : '';
    $status = isset($input['status']) ? $input['status'] : 'active';
    $whatsapp_opt_in = isset($input['whatsapp_opt_in']) ? (int)$input['whatsapp_opt_in'] : 0;
    
    // Only validate email if it's provided
    if (!empty($email) && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        sendResponse(false, 'Invalid email format', null, 400);
    }
    
    try {
        // Only check for duplicate email if one is provided
        if (!empty($email)) {
            // Check if email already exists
            $query = "SELECT id FROM clients WHERE email = :email";
            $stmt = $db->prepare($query);
            $stmt->bindParam(':email', $email);
            $stmt->execute();
            
            if ($stmt->rowCount() > 0) {
                sendResponse(false, 'Email already exists', null, 400);
            }
        }
        
        $query = "INSERT INTO clients (name, email, phone, status, whatsapp_opt_in) 
                  VALUES (:name, :email, :phone, :status, :whatsapp_opt_in)";
        
        $stmt = $db->prepare($query);
        $stmt->bindParam(':name', $name);
        $stmt->bindParam(':email', $email);
        $stmt->bindParam(':phone', $phone);
        $stmt->bindParam(':status', $status);
        $stmt->bindParam(':whatsapp_opt_in', $whatsapp_opt_in);
        
        if ($stmt->execute()) {
            $clientId = $db->lastInsertId();
            sendResponse(true, 'Client added successfully', ['id' => $clientId]);
        } else {
            sendResponse(false, 'Failed to add client', null, 500);
        }
        
    } catch (PDOException $e) {
        sendResponse(false, 'Database error: ' . $e->getMessage(), null, 500);
    }
}

function editClient($db) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['id']) || (int)$input['id'] <= 0) {
        sendResponse(false, 'Valid client ID is required', null, 400);
    }
    
    if (!isset($input['name']) || empty(trim($input['name']))) {
        sendResponse(false, 'Name is required', null, 400);
    }
    
    $id = (int)$input['id'];
    $name = trim($input['name']);
    $email = isset($input['email']) && !empty(trim($input['email'])) ? trim($input['email']) : '';
    $phone = isset($input['phone']) ? trim($input['phone']) : '';
    $status = isset($input['status']) ? $input['status'] : 'active';
    $whatsapp_opt_in = isset($input['whatsapp_opt_in']) ? (int)$input['whatsapp_opt_in'] : 0;
    
    // Only validate email if it's provided
    if (!empty($email) && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        sendResponse(false, 'Invalid email format', null, 400);
    }
    
    try {
        // Only check for duplicate email if one is provided
        if (!empty($email)) {
            // Check if email already exists for another client
            $query = "SELECT id FROM clients WHERE email = :email AND id != :id";
            $stmt = $db->prepare($query);
            $stmt->bindParam(':email', $email);
            $stmt->bindParam(':id', $id);
            $stmt->execute();
            
            if ($stmt->rowCount() > 0) {
                sendResponse(false, 'Email already exists', null, 400);
            }
        }
        
        $query = "UPDATE clients 
                  SET name = :name, email = :email, phone = :phone, 
                      status = :status, whatsapp_opt_in = :whatsapp_opt_in 
                  WHERE id = :id";
        
        $stmt = $db->prepare($query);
        $stmt->bindParam(':name', $name);
        $stmt->bindParam(':email', $email);
        $stmt->bindParam(':phone', $phone);
        $stmt->bindParam(':status', $status);
        $stmt->bindParam(':whatsapp_opt_in', $whatsapp_opt_in);
        $stmt->bindParam(':id', $id);
        
        if ($stmt->execute()) {
            sendResponse(true, 'Client updated successfully');
        } else {
            sendResponse(false, 'Failed to update client', null, 500);
        }
        
    } catch (PDOException $e) {
        sendResponse(false, 'Database error: ' . $e->getMessage(), null, 500);
    }
}

function deleteClient($db) {
    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
    
    if ($id <= 0) {
        sendResponse(false, 'Valid client ID is required', null, 400);
    }
    
    try {
        $query = "DELETE FROM clients WHERE id = :id";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':id', $id);
        
        if ($stmt->execute()) {
            if ($stmt->rowCount() > 0) {
                sendResponse(true, 'Client deleted successfully');
            } else {
                sendResponse(false, 'Client not found', null, 404);
            }
        } else {
            sendResponse(false, 'Failed to delete client', null, 500);
        }
        
    } catch (PDOException $e) {
        sendResponse(false, 'Database error: ' . $e->getMessage(), null, 500);
    }
}
?>
