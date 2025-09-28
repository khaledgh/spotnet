# Subscription Management System

A complete subscription management system built with React.js frontend and PHP backend API.

## Features

### 🔹 Frontend (React.js)
- **Modern Design**: Built with TailwindCSS and Shadcn UI components
- **Responsive**: Mobile-first design that works on all devices
- **Authentication**: JWT-based login system for admin/staff users
- **Dashboard**: Overview of clients, subscriptions, and payments
- **Client Management**: Add, edit, delete clients with WhatsApp opt-in
- **Subscription Management**: Internet/Satellite subscriptions with billing cycles
- **Payment Processing**: Record payments and automatically update next payment dates
- **Reminders System**: Send WhatsApp messages and email reminders
- **Real-time Updates**: Automatic calculation of next payment dates

### 🔹 Backend (PHP API)
- **Pure PHP**: No framework dependencies, clean and lightweight
- **MySQL Database**: Structured data storage with proper relationships
- **JWT Authentication**: Secure token-based authentication
- **RESTful API**: Clean API endpoints for all operations
- **Email Notifications**: Automatic payment confirmation emails
- **WhatsApp Integration**: Simulated WhatsApp messaging (ready for real API)
- **Payment Calculations**: Automatic next payment date calculations
- **Data Validation**: Server-side validation for all inputs

## Database Schema

### Tables:
1. **system_users** - Admin/staff login credentials
2. **clients** - Customer information with WhatsApp opt-in
3. **subscriptions** - Internet/Satellite subscriptions with billing cycles
4. **payments** - Payment history and records
5. **reminders** - Message reminders with WhatsApp integration

## Installation & Setup

### Prerequisites
- WAMP/XAMPP server (PHP 7.4+ and MySQL)
- Node.js 16+ and npm
- Modern web browser

### Backend Setup (PHP API)

1. **Database Setup**:
   ```sql
   # Import the database schema
   mysql -u root -p < database/schema.sql
   ```

2. **API Configuration**:
   - Copy the `api` folder to your web server directory
   - Update database credentials in `api/config/db.php` if needed
   - Ensure PHP has PDO MySQL extension enabled

3. **Test API**:
   - Navigate to `http://localhost/spotnet/api/auth.php?action=login`
   - Should return JSON response

### Frontend Setup (React)

1. **Install Dependencies**:
   ```bash
   cd spotnet
   npm install
   ```

2. **Install Additional Dependencies**:
   ```bash
   npm install react-router-dom axios lucide-react clsx tailwind-merge
   npm install @radix-ui/react-dialog @radix-ui/react-select @radix-ui/react-checkbox
   npm install @radix-ui/react-toast @radix-ui/react-dropdown-menu date-fns
   npm install -D tailwindcss autoprefixer postcss
   ```

3. **Initialize Tailwind CSS**:
   ```bash
   npx tailwindcss init -p
   ```

4. **Start Development Server**:
   ```bash
   npm run dev
   ```

5. **Access Application**:
   - Open `http://localhost:5173` in your browser

## Default Login Credentials

### Admin Account:
- **Email**: admin@subscription.com
- **Password**: admin123

### Staff Account:
- **Email**: staff@subscription.com  
- **Password**: admin123

## API Endpoints

### Authentication
- `POST /api/auth.php?action=login` - User login
- `GET /api/auth.php?action=verify` - Token verification

### Clients
- `GET /api/clients.php?action=list` - Get all clients
- `POST /api/clients.php?action=add` - Add new client
- `POST /api/clients.php?action=edit` - Update client
- `GET /api/clients.php?action=delete&id={id}` - Delete client

### Subscriptions
- `GET /api/subscriptions.php?action=list` - Get subscriptions
- `POST /api/subscriptions.php?action=add` - Add subscription
- `POST /api/subscriptions.php?action=edit` - Update subscription
- `GET /api/subscriptions.php?action=stop&id={id}` - Stop subscription
- `GET /api/subscriptions.php?action=resume&id={id}` - Resume subscription

### Payments
- `POST /api/payments.php?action=pay` - Process payment
- `GET /api/payments.php?action=list` - Get payment history

### Reminders
- `GET /api/reminders.php?action=list` - Get reminders
- `POST /api/reminders.php?action=add` - Add reminder
- `GET /api/reminders.php?action=send&id={id}` - Send single reminder
- `GET /api/reminders.php?action=send_bulk` - Send all pending reminders

### System Users (Admin Only)
- `GET /api/system_users.php?action=list` - Get system users
- `POST /api/system_users.php?action=add` - Add system user
- `POST /api/system_users.php?action=edit` - Update system user
- `GET /api/system_users.php?action=delete&id={id}` - Delete system user

## Key Features Explained

### 📅 Automatic Payment Calculations
- **1 Month Billing**: Next payment = Current date + 1 month
- **3 Month Billing**: Next payment = Current date + 3 months
- Automatic status updates (active/expired)

### 📱 WhatsApp Integration
- Clients can opt-in/opt-out of WhatsApp messages
- Messages only sent to opted-in clients
- Simulated API calls (ready for real WhatsApp Business API)

### 💳 Payment Processing
- Record payments with multiple methods (cash, bank transfer, etc.)
- Automatic email confirmations
- Update subscription status and next payment dates
- Payment history tracking

### 🔔 Smart Reminders
- Schedule reminders for future dates
- Bulk send functionality
- WhatsApp and email integration
- Quick message templates

## Technology Stack

### Frontend:
- **React 19** with TypeScript
- **Vite** for build tooling
- **TailwindCSS** for styling
- **React Router** for navigation
- **Axios** for API calls
- **Lucide React** for icons
- **Radix UI** for components

### Backend:
- **PHP 7.4+** (Pure PHP, no frameworks)
- **MySQL 8.0+** for database
- **JWT** for authentication
- **PDO** for database operations
- **PHPMailer** ready integration

## Security Features

- **JWT Authentication**: Secure token-based auth
- **Password Hashing**: bcrypt for password security  
- **SQL Injection Protection**: PDO prepared statements
- **CORS Headers**: Proper cross-origin configuration
- **Input Validation**: Server-side validation for all inputs
- **Role-based Access**: Admin/Staff permission levels

## Production Deployment

1. **Database**: Use production MySQL server
2. **API**: Deploy PHP files to production server
3. **Frontend**: Build and deploy static files
   ```bash
   npm run build
   # Deploy dist/ folder to web server
   ```
4. **Configuration**: Update API base URL in production
5. **Security**: Use HTTPS and secure JWT secret keys

## Customization

### Adding New Features:
1. **Database**: Add new tables in schema.sql
2. **API**: Create new PHP endpoint files
3. **Frontend**: Add new React components and routes

### Styling:
- Modify `tailwind.config.js` for theme customization
- Update CSS classes in components
- Add custom styles in `App.css`

## Support & Documentation

For technical support or feature requests, please refer to the code comments and API documentation within each endpoint file.

## License

This project is built for educational and commercial use. Modify as needed for your specific requirements.
