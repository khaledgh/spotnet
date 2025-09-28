<?php
/**
 * Authentication API
 * Handles user login and token generation
 */

require_once 'config/db.php';

setCorsHeaders();

$database = new Database();
$db = $database->getConnection();

$action = isset($_GET['action']) ? $_GET['action'] : '';

switch ($action) {
    case 'login':
        login($db);
        break;
    case 'verify':
        verifyToken();
        break;
    default:
        sendResponse(false, 'Invalid action', null, 400);
}

function login($db) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['email']) || !isset($input['password'])) {
        sendResponse(false, 'Email and password are required', null, 400);
    }
    
    $email = trim($input['email']);
    $password = $input['password'];
    
    try {
        $query = "SELECT id, name, email, password, role FROM system_users WHERE email = :email";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':email', $email);
        $stmt->execute();
        
        if ($stmt->rowCount() === 0) {
            sendResponse(false, 'Invalid credentials', null, 401);
        }
        
        $user = $stmt->fetch();
        
        if (!password_verify($password, $user['password'])) {
            sendResponse(false, 'Invalid credentials', null, 401);
        }
        
        // Generate JWT token
        $token = generateJWT($user['id'], $user['email'], $user['role']);
        
        $userData = [
            'id' => $user['id'],
            'name' => $user['name'],
            'email' => $user['email'],
            'role' => $user['role'],
            'token' => $token
        ];
        
        sendResponse(true, 'Login successful', $userData);
        
    } catch (PDOException $e) {
        sendResponse(false, 'Database error: ' . $e->getMessage(), null, 500);
    }
}

function verifyToken() {
    $userData = requireAuth();
    sendResponse(true, 'Token is valid', $userData);
}
?>
