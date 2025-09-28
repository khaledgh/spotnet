import axios from 'axios';

const API_BASE_URL = 'http://localhost:8080/spotnet/api';

// Real API service that makes HTTP requests to the backend
class ApiService {
  private api;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor to include auth token
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Add response interceptor to handle errors
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        // Check if this is a 401 error but not from a login attempt
        if (error.response?.status === 401 && 
            !error.config.url.includes('/auth.php?action=login')) {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user_data');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  async login(email: string, password: string) {
    try {
      const response = await this.api.post('/auth.php?action=login', {
        email,
        password,
      });
      return response.data;
    } catch (error: unknown) {
      console.error('Login error:', error);
      
      // Type assertion for axios error
      const axiosError = error as { 
        response?: { 
          status: number, 
          data?: { message: string } 
        } 
      };
      
      // Check if this is a 401 Unauthorized error from the server
      if (axiosError.response?.status === 401) {
        return {
          success: false,
          message: axiosError.response.data?.message || 'Invalid email or password'
        };
      }
      
      // For other errors (network issues, server down, etc.)
      return {
        success: false,
        message: 'Error connecting to the server'
      };
    }
  }

  async verifyToken() {
    try {
      const response = await this.api.get('/auth.php?action=verify');
      return response.data;
    } catch (error) {
      console.error('Token verification error:', error);
      return {
        success: false,
        message: 'Error verifying token'
      };
    }
  }

  async getClients(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: string;
    whatsappOptIn?: number;
    sortField?: string;
    sortDirection?: 'asc' | 'desc';
  }) {
    try {
      let url = '/clients.php?action=list';
      
      if (params) {
        const queryParams = [];
        
        if (params.page) queryParams.push(`page=${params.page}`);
        if (params.pageSize) queryParams.push(`pageSize=${params.pageSize}`);
        if (params.search) queryParams.push(`search=${encodeURIComponent(params.search)}`);
        if (params.status) queryParams.push(`status=${params.status}`);
        if (params.whatsappOptIn !== undefined) queryParams.push(`whatsappOptIn=${params.whatsappOptIn}`);
        if (params.sortField) queryParams.push(`sortField=${params.sortField}`);
        if (params.sortDirection) queryParams.push(`sortDirection=${params.sortDirection}`);
        
        if (queryParams.length > 0) {
          url += `&${queryParams.join('&')}`;
        }
      }
      
      const response = await this.api.get(url);
      return response.data;
    } catch (error) {
      console.error('Error fetching clients:', error);
      return {
        success: false,
        message: 'Error fetching clients',
        data: [],
        pagination: {
          page: 1,
          pageSize: 10,
          totalItems: 0,
          totalPages: 0
        }
      };
    }
  }

  async getClient(id: number) {
    try {
      const response = await this.api.get(`/clients.php?action=get&id=${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching client ${id}:`, error);
      return {
        success: false,
        message: 'Error fetching client details',
        data: null
      };
    }
  }

  async addClient(clientData: { name: string, email: string, phone: string, status?: string, whatsapp_opt_in?: number }) {
    try {
      const response = await this.api.post('/clients.php?action=add', clientData);
      return response.data;
    } catch (error) {
      console.error('Error adding client:', error);
      return {
        success: false,
        message: 'Error adding client',
        data: null
      };
    }
  }

  async updateClient(clientData: { id: number, name: string, email: string, phone: string, status?: string, whatsapp_opt_in?: number }) {
    try {
      const response = await this.api.post('/clients.php?action=edit', clientData);
      return response.data;
    } catch (error) {
      console.error('Error updating client:', error);
      return {
        success: false,
        message: 'Error updating client',
        data: null
      };
    }
  }

  async deleteClient(id: number) {
    try {
      const response = await this.api.get(`/clients.php?action=delete&id=${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error deleting client ${id}:`, error);
      return {
        success: false,
        message: 'Error deleting client',
        data: null
      };
    }
  }

  async getSubscriptions(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: string;
    type?: string;
    clientId?: number;
    sortField?: string;
    sortDirection?: 'asc' | 'desc';
  }) {
    try {
      let url = '/subscriptions.php?action=list';
      
      if (params) {
        const queryParams = [];
        
        if (params.clientId) queryParams.push(`client_id=${params.clientId}`);
        if (params.page) queryParams.push(`page=${params.page}`);
        if (params.pageSize) queryParams.push(`pageSize=${params.pageSize}`);
        if (params.search) queryParams.push(`search=${encodeURIComponent(params.search)}`);
        if (params.status) queryParams.push(`status=${params.status}`);
        if (params.type) queryParams.push(`type=${params.type}`);
        if (params.sortField) queryParams.push(`sortField=${params.sortField}`);
        if (params.sortDirection) queryParams.push(`sortDirection=${params.sortDirection}`);
        
        if (queryParams.length > 0) {
          url += `&${queryParams.join('&')}`;
        }
      }
      
      const response = await this.api.get(url);
      return response.data;
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
      return {
        success: false,
        message: 'Error fetching subscriptions',
        data: [],
        pagination: {
          page: 1,
          pageSize: 10,
          totalItems: 0,
          totalPages: 0
        }
      };
    }
  }

  async createSubscription(subscriptionData: any) {
    try {
      const response = await this.api.post('/subscriptions.php?action=add', subscriptionData);
      return response.data;
    } catch (error) {
      console.error('Error adding subscription:', error);
      return {
        success: false,
        message: 'Error adding subscription',
        data: null
      };
    }
  }

  async updateSubscription(id: number, subscriptionData: any) {
    try {
      const data = { ...subscriptionData, id };
      const response = await this.api.post('/subscriptions.php?action=edit', data);
      return response.data;
    } catch (error) {
      console.error('Error updating subscription:', error);
      return {
        success: false,
        message: 'Error updating subscription',
        data: null
      };
    }
  }

  async stopSubscription(id: number) {
    try {
      const response = await this.api.get(`/subscriptions.php?action=stop&id=${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error stopping subscription ${id}:`, error);
      return {
        success: false,
        message: 'Error stopping subscription',
        data: null
      };
    }
  }

  async resumeSubscription(id: number) {
    try {
      const response = await this.api.get(`/subscriptions.php?action=resume&id=${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error resuming subscription ${id}:`, error);
      return {
        success: false,
        message: 'Error resuming subscription',
        data: null
      };
    }
  }

  async deleteSubscription(id: number) {
    try {
      const response = await this.api.get(`/subscriptions.php?action=delete&id=${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error deleting subscription ${id}:`, error);
      return {
        success: false,
        message: 'Error deleting subscription',
        data: null
      };
    }
  }

  async processPayment(subscriptionId: number, paymentData: {
    amount: number;
    payment_date: string;
    payment_method: string;
    notes?: string;
    send_whatsapp?: boolean;
  }) {
    try {
      const data = { ...paymentData, subscription_id: subscriptionId };
      const response = await this.api.post('/payments.php?action=pay', data);
      return response.data;
    } catch (error) {
      console.error('Error processing payment:', error);
      return {
        success: false,
        message: 'Error processing payment',
        data: null
      };
    }
  }

  async getPayments(subscriptionId?: number, clientId?: number) {
    try {
      let url = '/payments.php?action=list';
      const params = [];
      if (subscriptionId) params.push(`subscription_id=${subscriptionId}`);
      if (clientId) params.push(`client_id=${clientId}`);
      if (params.length > 0) url += '&' + params.join('&');
      
      const response = await this.api.get(url);
      return response.data;
    } catch (error) {
      console.error('Error fetching payments:', error);
      return {
        success: false,
        message: 'Error fetching payments',
        data: []
      };
    }
  }

  async getPaymentHistory() {
    try {
      const response = await this.api.get('/payments.php?action=history');
      return response.data;
    } catch (error) {
      console.error('Error fetching payment history:', error);
      return {
        success: false,
        message: 'Error fetching payment history',
        data: {
          monthly_history: [],
          recent_payments: []
        }
      };
    }
  }

  async getReminders(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: string;
    whatsappOnly?: number;
    clientId?: number;
    sortField?: string;
    sortDirection?: 'asc' | 'desc';
  }) {
    try {
      let url = '/reminders.php?action=list';
      
      if (params) {
        const queryParams = [];
        
        if (params.clientId) queryParams.push(`client_id=${params.clientId}`);
        if (params.page) queryParams.push(`page=${params.page}`);
        if (params.pageSize) queryParams.push(`pageSize=${params.pageSize}`);
        if (params.search) queryParams.push(`search=${encodeURIComponent(params.search)}`);
        if (params.status) queryParams.push(`status=${params.status}`);
        if (params.whatsappOnly !== undefined) queryParams.push(`whatsappOnly=${params.whatsappOnly}`);
        if (params.sortField) queryParams.push(`sortField=${params.sortField}`);
        if (params.sortDirection) queryParams.push(`sortDirection=${params.sortDirection}`);
        
        if (queryParams.length > 0) {
          url += `&${queryParams.join('&')}`;
        }
      }
      
      const response = await this.api.get(url);
      return response.data;
    } catch (error) {
      console.error('Error fetching reminders:', error);
      return {
        success: false,
        message: 'Error fetching reminders',
        data: [],
        pagination: {
          page: 1,
          pageSize: 10,
          totalItems: 0,
          totalPages: 0
        }
      };
    }
  }

  async addReminder(reminderData: any) {
    try {
      const response = await this.api.post('/reminders.php?action=add', reminderData);
      return response.data;
    } catch (error) {
      console.error('Error adding reminder:', error);
      return {
        success: false,
        message: 'Error adding reminder',
        data: null
      };
    }
  }

  async sendReminder(id: number) {
    try {
      const response = await this.api.get(`/reminders.php?action=send&id=${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error sending reminder ${id}:`, error);
      return {
        success: false,
        message: 'Error sending reminder',
        data: null
      };
    }
  }

  async sendBulkReminders() {
    try {
      const response = await this.api.get('/reminders.php?action=send_bulk');
      return response.data;
    } catch (error) {
      console.error('Error sending bulk reminders:', error);
      return {
        success: false,
        message: 'Error sending bulk reminders',
        data: { sent: 0, failed: 0 }
      };
    }
  }

  async deleteReminder(id: number) {
    try {
      const response = await this.api.get(`/reminders.php?action=delete&id=${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error deleting reminder ${id}:`, error);
      return {
        success: false,
        message: 'Error deleting reminder',
        data: null
      };
    }
  }

  async getSystemUsers() {
    try {
      const response = await this.api.get('/system_users.php?action=list');
      return response.data;
    } catch (error) {
      console.error('Error fetching system users:', error);
      return {
        success: false,
        message: 'Error fetching system users',
        data: []
      };
    }
  }

  async addSystemUser(userData: any) {
    try {
      const response = await this.api.post('/system_users.php?action=add', userData);
      return response.data;
    } catch (error) {
      console.error('Error adding system user:', error);
      return {
        success: false,
        message: 'Error adding system user',
        data: null
      };
    }
  }

  async updateSystemUser(userData: any) {
    try {
      const response = await this.api.post('/system_users.php?action=edit', userData);
      return response.data;
    } catch (error) {
      console.error('Error updating system user:', error);
      return {
        success: false,
        message: 'Error updating system user',
        data: null
      };
    }
  }

  async deleteSystemUser(id: number) {
    try {
      const response = await this.api.get(`/system_users.php?action=delete&id=${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error deleting system user ${id}:`, error);
      return {
        success: false,
        message: 'Error deleting system user',
        data: null
      };
    }
  }

  async getMessageTemplates() {
    try {
      const response = await this.api.get('/message_templates.php?action=list');
      return response.data;
    } catch (error) {
      console.error('Error fetching message templates:', error);
      return {
        success: false,
        message: 'Error fetching message templates',
        data: []
      };
    }
  }

  async addMessageTemplate(templateData: { name?: string; content: string }) {
    try {
      const response = await this.api.post('/message_templates.php?action=add', templateData);
      return response.data;
    } catch (error) {
      console.error('Error adding message template:', error);
      return {
        success: false,
        message: 'Error adding message template',
        data: null
      };
    }
  }

  async deleteMessageTemplate(id: number) {
    try {
      const response = await this.api.get(`/message_templates.php?action=delete&id=${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error deleting message template ${id}:`, error);
      return {
        success: false,
        message: 'Error deleting message template',
        data: null
      };
    }
  }
}

export const apiService = new ApiService();
export default apiService;
