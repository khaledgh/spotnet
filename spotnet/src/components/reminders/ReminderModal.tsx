import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api-service';
import { X, AlertCircle, MessageCircle } from 'lucide-react';

interface Reminder {
  id?: number;
  client_id: number;
  client_name?: string;
  client_phone?: string;
  whatsapp_opt_in?: number;
  message: string;
  send_via_whatsapp: number;
  status?: 'pending' | 'sent' | 'failed';
  scheduled_date: string | null;
  sent_date?: string | null;
  created_at?: string;
}

interface Client {
  id: number;
  name: string;
  email: string;
  whatsapp_opt_in: number;
}

interface ReminderModalProps {
  reminder: Reminder | null;
  clients: Client[];
  onClose: () => void;
  onSave: () => void;
}

const ReminderModal: React.FC<ReminderModalProps> = ({ reminder, clients, onClose, onSave }) => {
  const [formData, setFormData] = useState<Reminder>({
    client_id: 0,
    message: '',
    send_via_whatsapp: 0,
    scheduled_date: null,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [messageTemplates, setMessageTemplates] = useState<Array<{id: number, name: string, content: string}>>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [showSaveTemplateForm, setShowSaveTemplateForm] = useState(false);
  const [templateName, setTemplateName] = useState('');

  // Load message templates from the database
  const loadMessageTemplates = async () => {
    setIsLoadingTemplates(true);
    try {
      const response = await apiService.getMessageTemplates();
      if (response.success) {
        setMessageTemplates(response.data);
      }
    } catch (error) {
      console.error('Error loading message templates:', error);
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  // Save a new message template
  const saveMessageTemplate = async () => {
    if (!formData.message.trim()) {
      setErrors(prev => ({ ...prev, message: 'Message is required to save as template' }));
      return;
    }

    try {
      const name = templateName.trim() || formData.message.substring(0, 30) + '...';
      const response = await apiService.addMessageTemplate({
        name,
        content: formData.message
      });

      if (response.success) {
        setShowSaveTemplateForm(false);
        setTemplateName('');
        loadMessageTemplates(); // Reload templates
      }
    } catch (error) {
      console.error('Error saving message template:', error);
    }
  };

  // Load templates when component mounts
  useEffect(() => {
    loadMessageTemplates();
  }, []);

  useEffect(() => {
    if (reminder) {
      setFormData({
        id: reminder.id,
        client_id: reminder.client_id,
        message: reminder.message,
        send_via_whatsapp: reminder.send_via_whatsapp,
        scheduled_date: reminder.scheduled_date,
      });
      
      const client = Array.isArray(clients) ? clients.find(c => c.id === reminder.client_id) : null;
      setSelectedClient(client || null);
    } else {
      setFormData({
        client_id: 0,
        message: '',
        send_via_whatsapp: 0,
        scheduled_date: null,
      });
      setSelectedClient(null);
    }
    setErrors({});
  }, [reminder, clients]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.client_id) {
      newErrors.client_id = 'Client is required';
    }

    if (!formData.message.trim()) {
      newErrors.message = 'Message is required';
    }

    if (formData.scheduled_date && typeof formData.scheduled_date === 'string' && formData.scheduled_date.trim() !== '') {
      const scheduledDate = new Date(formData.scheduled_date);
      const now = new Date();
      if (scheduledDate < now) {
        newErrors.scheduled_date = 'Scheduled date must be in the future';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Make sure client_id is a number
      const dataToSubmit = {
        ...formData,
        client_id: Number(formData.client_id)
      };
      
      const response = await apiService.addReminder(dataToSubmit);

      if (response.success) {
        onSave();
      } else {
        setErrors({ submit: response.message || 'An error occurred' });
      }
    } catch (error: unknown) {
      console.error('Error saving reminder:', error);
      const responseError = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErrors({ submit: responseError || 'An error occurred' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (name === 'client_id') {
      const clientId = parseInt(value);
      const client = Array.isArray(clients) ? clients.find(c => c.id === clientId) : null;
      setSelectedClient(client || null);
      
      // Auto-enable WhatsApp if client has opted in
      if (client?.whatsapp_opt_in) {
        setFormData(prev => ({
          ...prev,
          client_id: clientId,
          send_via_whatsapp: 1,
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          client_id: clientId,
          send_via_whatsapp: 0,
        }));
      }
    } else if (name === 'scheduled_date') {
      // Handle empty string for scheduled_date as null
      setFormData(prev => ({
        ...prev,
        [name]: value === '' ? null : value,
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked ? 1 : 0 : value,
      }));
    }
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // Function removed as we now use database templates

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-5 mx-auto p-5 border w-full max-w-lg shadow-lg rounded-md bg-white">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            {reminder ? 'Edit Reminder' : 'Add New Reminder'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {errors.submit && (
            <div className="flex items-center space-x-2 text-red-600 text-sm bg-red-50 p-3 rounded-md">
              <AlertCircle className="h-4 w-4" />
              <span>{errors.submit}</span>
            </div>
          )}

          <div>
            <label htmlFor="client_id" className="block text-sm font-medium text-gray-700">
              Client *
            </label>
            <select
              id="client_id"
              name="client_id"
              value={formData.client_id}
              onChange={handleChange}
              className={`mt-1 input ${errors.client_id ? 'border-red-300' : ''}`}
            >
              <option value="0">Select a client</option>
              {Array.isArray(clients) ? clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name} ({client.email})
                  {client.whatsapp_opt_in ? ' ✓ WhatsApp' : ''}
                </option>
              )) : <option value="0">Loading clients...</option>}
            </select>
            {errors.client_id && (
              <p className="mt-1 text-sm text-red-600">{errors.client_id}</p>
            )}
          </div>

          {selectedClient && (
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="flex items-center">
                <MessageCircle className={`h-4 w-4 mr-2 ${selectedClient.whatsapp_opt_in ? 'text-green-500' : 'text-gray-400'}`} />
                <span className="text-sm text-blue-800">
                  {selectedClient.whatsapp_opt_in 
                    ? 'This client has opted in for WhatsApp messages'
                    : 'This client has not opted in for WhatsApp messages'
                  }
                </span>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="message" className="block text-sm font-medium text-gray-700">
              Message *
            </label>
            <textarea
              id="message"
              name="message"
              value={formData.message}
              onChange={handleChange}
              rows={4}
              className={`mt-1 input ${errors.message ? 'border-red-300' : ''}`}
              placeholder="Enter your reminder message..."
            />
            {errors.message && (
              <p className="mt-1 text-sm text-red-600">{errors.message}</p>
            )}
            
            <div className="mt-2">
              <div className="flex justify-between items-center mb-1">
                <p className="text-sm font-medium text-gray-700">Message Templates</p>
                <button 
                  type="button"
                  onClick={() => setShowSaveTemplateForm(!showSaveTemplateForm)}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  {showSaveTemplateForm ? 'Cancel' : 'Save Current Message'}
                </button>
              </div>
              
              {showSaveTemplateForm ? (
                <div className="border rounded p-3 mb-2 bg-gray-50">
                  <div className="mb-2">
                    <label htmlFor="templateName" className="block text-xs font-medium text-gray-700">
                      Template Name (Optional)
                    </label>
                    <input
                      type="text"
                      id="templateName"
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      className="mt-1 input text-sm w-full"
                      placeholder="Leave blank to use message beginning"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={saveMessageTemplate}
                      className="btn btn-sm btn-primary px-3 py-1 text-xs"
                    >
                      Save Template
                    </button>
                  </div>
                </div>
              ) : null}
              
              <select
                className="w-full input"
                onChange={(e) => {
                  if (e.target.value) {
                    const template = messageTemplates.find(t => t.id === parseInt(e.target.value));
                    if (template) {
                      setFormData(prev => ({ ...prev, message: template.content }));
                    }
                  }
                }}
                value=""
              >
                <option value="">Select a message template</option>
                {isLoadingTemplates ? (
                  <option disabled>Loading templates...</option>
                ) : (
                  messageTemplates.map(template => (
                    <option key={template.id} value={template.id}>{template.name}</option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="scheduled_date" className="block text-sm font-medium text-gray-700">
              Scheduled Date & Time (Optional)
            </label>
            <input
              type="datetime-local"
              id="scheduled_date"
              name="scheduled_date"
              value={formData.scheduled_date || ''}
              onChange={handleChange}
              className={`mt-1 input ${errors.scheduled_date ? 'border-red-300' : ''}`}
            />
            {errors.scheduled_date && (
              <p className="mt-1 text-sm text-red-600">{errors.scheduled_date}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Leave empty to send immediately
            </p>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="send_via_whatsapp"
              name="send_via_whatsapp"
              checked={formData.send_via_whatsapp === 1}
              onChange={handleChange}
              disabled={!selectedClient?.whatsapp_opt_in}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded disabled:opacity-50"
            />
            <label htmlFor="send_via_whatsapp" className="ml-2 block text-sm text-gray-900">
              Send via WhatsApp
              {selectedClient && !selectedClient.whatsapp_opt_in && (
                <span className="text-red-500 ml-1">(Client not opted in)</span>
              )}
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary px-4 py-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary px-4 py-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </div>
              ) : (
                reminder ? 'Update Reminder' : 'Add Reminder'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReminderModal;
