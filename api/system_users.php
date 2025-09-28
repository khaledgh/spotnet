<?php
/**
 * System Users API
 * Handles CRUD operations for system users (admin/staff)
 */

require_once 'config/db.php';

setCorsHeaders();
$userData = requireAuth();

// Only admins can manage system users
if ($userData['role'] !== 'admin') {
    sendResponse(false, 'Access denied. Admin privileges required.', null, 403);
}

$database = new Database();
$db = $database->getConnection();

$action = isset($_GET['action']) ? $_GET['action'] : '';

switch ($action) {
    case 'list':
        getSystemUsers($db);
        break;
    case 'add':
        addSystemUser($db);
        break;
    case 'edit':
        editSystemUser($db);
        break;
    case 'delete':
        deleteSystemUser($db);
        break;
    default:
        sendResponse(false, 'Invalid action', null, 400);
}

function getSystemUsers($db) {
    try {
        $query = "SELECT id, name, email, role, created_at FROM system_users ORDER BY created_at DESC";
        $stmt = $db->prepare($query);
        $stmt->execute();
        $users = $stmt->fetchAll();
        
        sendResponse(true, 'System users retrieved successfully', $users);
        
    } catch (PDOException $e) {
        sendResponse(false, 'Database error: ' . $e->getMessage(), null, 500);
    }
}

function addSystemUser($db) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $required = ['name', 'email', 'password', 'role'];
    foreach ($required as $field) {
        if (!isset($input[$field]) || empty(trim($input[$field]))) {
            sendResponse(false, ucfirst($field) . ' is required', null, 400);
        }
    }
    
    $name = trim($input['name']);
    $email = trim($input['email']);
    $password = $input['password'];
    $role = $input['role'];
    
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        sendResponse(false, 'Invalid email format', null, 400);
    }
    
    if (!in_array($role, ['admin', 'staff'])) {
        sendResponse(false, 'Role must be admin or staff', null, 400);
    }
    
    if (strlen($password) < 6) {
        sendResponse(false, 'Password must be at least 6 characters long', null, 400);
    }
    
    try {
        // Check if email already exists
        $query = "SELECT id FROM system_users WHERE email = :email";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':email', $email);
        $stmt->execute();
        
        if ($stmt->rowCount() > 0) {
            sendResponse(false, 'Email already exists', null, 400);
        }
        
        // Hash password
        $hashed_password = password_hash($password, PASSWORD_DEFAULT);
        
        $query = "INSERT INTO system_users (name, email, password, role) 
                  VALUES (:name, :email, :password, :role)";
        
        $stmt = $db->prepare($query);
        $stmt->bindParam(':name', $name);
        $stmt->bindParam(':email', $email);
        $stmt->bindParam(':password', $hashed_password);
        $stmt->bindParam(':role', $role);
        
        if ($stmt->execute()) {
            $userId = $db->lastInsertId();
            sendResponse(true, 'System user added successfully', ['id' => $userId]);
        } else {
            sendResponse(false, 'Failed to add system user', null, 500);
        }
        
    } catch (PDOException $e) {
        sendResponse(false, 'Database error: ' . $e->getMessage(), null, 500);
    }
}

function editSystemUser($db) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['id']) || (int)$input['id'] <= 0) {
        sendResponse(false, 'Valid user ID is required', null, 400);
    }
    
    $id = (int)$input['id'];
    $name = trim($input['name']);
    $email = trim($input['email']);
    $role = $input['role'];
    $password = isset($input['password']) ? trim($input['password']) : '';
    
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        sendResponse(false, 'Invalid email format', null, 400);
    }
    
    if (!in_array($role, ['admin', 'staff'])) {
        sendResponse(false, 'Role must be admin or staff', null, 400);
    }
    
    try {
        // Check if email already exists for another user
        $query = "SELECT id FROM system_users WHERE email = :email AND id != :id";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':email', $email);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        
        if ($stmt->rowCount() > 0) {
            sendResponse(false, 'Email already exists', null, 400);
        }
        
        // Update user
        if (!empty($password)) {
            if (strlen($password) < 6) {
                sendResponse(false, 'Password must be at least 6 characters long', null, 400);
            }
            
            $hashed_password = password_hash($password, PASSWORD_DEFAULT);
            $query = "UPDATE system_users 
                      SET name = :name, email = :email, password = :password, role = :role 
                      WHERE id = :id";
            
            $stmt = $db->prepare($query);
            $stmt->bindParam(':name', $name);
            $stmt->bindParam(':email', $email);
            $stmt->bindParam(':password', $hashed_password);
            $stmt->bindParam(':role', $role);
            $stmt->bindParam(':id', $id);
        } else {
            $query = "UPDATE system_users 
                      SET name = :name, email = :email, role = :role 
                      WHERE id = :id";
            
            $stmt = $db->prepare($query);
            $stmt->bindParam(':name', $name);
            $stmt->bindParam(':email', $email);
            $stmt->bindParam(':role', $role);
            $stmt->bindParam(':id', $id);
        }
        
        if ($stmt->execute()) {
            sendResponse(true, 'System user updated successfully');
        } else {
            sendResponse(false, 'Failed to update system user', null, 500);
        }
        
    } catch (PDOException $e) {
        sendResponse(false, 'Database error: ' . $e->getMessage(), null, 500);
    }
}

function deleteSystemUser($db) {
    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
    
    if ($id <= 0) {
        sendResponse(false, 'Valid user ID is required', null, 400);
    }
    
    try {
        // Don't allow deleting the last admin
        $query = "SELECT COUNT(*) as admin_count FROM system_users WHERE role = 'admin'";
        $stmt = $db->prepare($query);
        $stmt->execute();
        $result = $stmt->fetch();
        
        if ($result['admin_count'] <= 1) {
            $query = "SELECT role FROM system_users WHERE id = :id";
            $stmt = $db->prepare($query);
            $stmt->bindParam(':id', $id);
            $stmt->execute();
            
            if ($stmt->rowCount() > 0) {
                $user = $stmt->fetch();
                if ($user['role'] === 'admin') {
                    sendResponse(false, 'Cannot delete the last admin user', null, 400);
                }
            }
        }
        
        $query = "DELETE FROM system_users WHERE id = :id";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':id', $id);
        
        if ($stmt->execute()) {
            if ($stmt->rowCount() > 0) {
                sendResponse(true, 'System user deleted successfully');
            } else {
                sendResponse(false, 'System user not found', null, 404);
            }
        } else {
            sendResponse(false, 'Failed to delete system user', null, 500);
        }
        
    } catch (PDOException $e) {
        sendResponse(false, 'Database error: ' . $e->getMessage(), null, 500);
    }
}
?>
