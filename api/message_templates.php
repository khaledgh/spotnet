<?php
/**
 * Message Templates API
 * Handles CRUD operations for message templates
 */

require_once 'config/db.php';

setCorsHeaders();
$userData = requireAuth();

$database = new Database();
$db = $database->getConnection();

$action = isset($_GET['action']) ? $_GET['action'] : '';

switch ($action) {
    case 'list':
        getMessageTemplates($db);
        break;
    case 'add':
        addMessageTemplate($db);
        break;
    case 'delete':
        deleteMessageTemplate($db);
        break;
    default:
        sendResponse(false, 'Invalid action', null, 400);
}

function getMessageTemplates($db) {
    try {
        $query = "SELECT * FROM message_templates ORDER BY created_at DESC";
        $stmt = $db->prepare($query);
        $stmt->execute();
        $templates = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        sendResponse(true, 'Message templates retrieved successfully', $templates);
    } catch (PDOException $e) {
        sendResponse(false, 'Database error: ' . $e->getMessage(), null, 500);
    }
}

function addMessageTemplate($db) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['content']) || empty(trim($input['content']))) {
        sendResponse(false, 'Message content is required', null, 400);
    }
    
    $content = trim($input['content']);
    $name = isset($input['name']) ? trim($input['name']) : substr($content, 0, 30) . '...';
    
    try {
        $query = "INSERT INTO message_templates (name, content) VALUES (:name, :content)";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':name', $name);
        $stmt->bindParam(':content', $content);
        
        if ($stmt->execute()) {
            $templateId = $db->lastInsertId();
            sendResponse(true, 'Message template added successfully', ['id' => $templateId]);
        } else {
            sendResponse(false, 'Failed to add message template', null, 500);
        }
    } catch (PDOException $e) {
        sendResponse(false, 'Database error: ' . $e->getMessage(), null, 500);
    }
}

function deleteMessageTemplate($db) {
    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
    
    if ($id <= 0) {
        sendResponse(false, 'Valid template ID is required', null, 400);
    }
    
    try {
        $query = "DELETE FROM message_templates WHERE id = :id";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':id', $id);
        
        if ($stmt->execute()) {
            if ($stmt->rowCount() > 0) {
                sendResponse(true, 'Message template deleted successfully');
            } else {
                sendResponse(false, 'Message template not found', null, 404);
            }
        } else {
            sendResponse(false, 'Failed to delete message template', null, 500);
        }
    } catch (PDOException $e) {
        sendResponse(false, 'Database error: ' . $e->getMessage(), null, 500);
    }
}
?>
