import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api-service';
import { X, AlertCircle } from 'lucide-react';

interface Client {
  id?: number;
  name: string;
  email: string;
  phone: string;
  status: 'active' | 'stopped';
  whatsapp_opt_in: number;
}

interface ClientModalProps {
  client: Client | null;
  onClose: () => void;
  onSave: () => void;
  useModalWrapper?: boolean;
}

const ClientModal: React.FC<ClientModalProps> = ({ client, onClose, onSave, useModalWrapper = true }) => {
  const [formData, setFormData] = useState<Client>({
    name: '',
    email: '',
    phone: '',
    status: 'active',
    whatsapp_opt_in: 0,
  });
  const [isWhatsAppEnabled, setIsWhatsAppEnabled] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (client) {
      const whatsappOptInValue = Number(client.whatsapp_opt_in) === 1 ? 1 : 0;

      setIsWhatsAppEnabled(whatsappOptInValue === 1);

      setFormData({
        id: client.id,
        name: client.name,
        email: client.email || '',
        phone: client.phone || '',
        status: client.status,
        whatsapp_opt_in: whatsappOptInValue,
      });
    } else {
      setFormData({
        name: '',
        email: '',
        phone: '',
        status: 'active',
        whatsapp_opt_in: 0,
      });
      setIsWhatsAppEnabled(false);
    }
    setErrors({});
  }, [client]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    // Email is optional, but validate format if provided
    if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    // Phone is optional, but validate format if provided
    if (formData.phone && !/^[\d\s\-+()]+$/.test(formData.phone)) {
      newErrors.phone = 'Invalid phone number format';
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
    
    // Ensure the WhatsApp opt-in value is correctly set from our separate state
    const dataToSubmit = {
      ...formData,
      whatsapp_opt_in: isWhatsAppEnabled ? 1 : 0
    };
    
    // Debug log to check what's being sent
    console.log('Submitting client data:', dataToSubmit);
    console.log('WhatsApp opt-in value:', dataToSubmit.whatsapp_opt_in);
    console.log('isWhatsAppEnabled state:', isWhatsAppEnabled);

    try {
      let response;
      if (client?.id) {
        // Make sure id is included and is a number
        const updateData = {
          ...dataToSubmit,
          id: client.id
        };
        console.log('Sending update data:', updateData);
        response = await apiService.updateClient(updateData);
      } else {
        console.log('Sending add data:', dataToSubmit);
        response = await apiService.addClient(dataToSubmit);
      }

      if (response.success) {
        onSave();
      } else {
        setErrors({ submit: response.message || 'An error occurred' });
      }
    } catch (error: unknown) {
      console.error('Error saving client:', error);
      const responseError = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErrors({ submit: responseError || 'An error occurred' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const isChecked = (e.target as HTMLInputElement).checked;
      console.log(`Checkbox ${name} changed to: ${isChecked ? 'checked' : 'unchecked'}, value will be: ${isChecked ? 1 : 0}`);
      
      setFormData(prev => ({
        ...prev,
        [name]: isChecked ? 1 : 0
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const renderForm = () => (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errors.submit && (
        <div className="flex items-center space-x-2 text-red-600 text-sm bg-red-50 p-3 rounded-md">
          <AlertCircle className="h-4 w-4" />
          <span>{errors.submit}</span>
        </div>
      )}

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          Name *
        </label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          className={`mt-1 input ${errors.name ? 'border-red-300' : ''}`}
          placeholder="Enter client name"
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-600">{errors.name}</p>
        )}
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          Email
        </label>
        <input
          type="email"
          id="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          className={`mt-1 input ${errors.email ? 'border-red-300' : ''}`}
          placeholder="Enter email address"
        />
        {errors.email && (
          <p className="mt-1 text-sm text-red-600">{errors.email}</p>
        )}
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
          Phone
        </label>
        <input
          type="tel"
          id="phone"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          className={`mt-1 input ${errors.phone ? 'border-red-300' : ''}`}
          placeholder="Enter phone number"
        />
        {errors.phone && (
          <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
        )}
      </div>

      <div>
        <label htmlFor="status" className="block text-sm font-medium text-gray-700">
          Status
        </label>
        <select
          id="status"
          name="status"
          value={formData.status}
          onChange={handleChange}
          className="mt-1 input"
        >
          <option value="active">Active</option>
          <option value="stopped">Stopped</option>
        </select>
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          id="whatsapp_opt_in"
          name="whatsapp_opt_in"
          checked={isWhatsAppEnabled}
          onChange={(e) => {
            const isChecked = e.target.checked;

            setIsWhatsAppEnabled(isChecked);
            setFormData(prev => ({
              ...prev,
              whatsapp_opt_in: isChecked ? 1 : 0,
            }));

            if (errors['whatsapp_opt_in']) {
              setErrors(prev => ({ ...prev, whatsapp_opt_in: '' }));
            }
          }}
          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
        />
        <label htmlFor="whatsapp_opt_in" className="ml-2 block text-sm text-gray-900">
          WhatsApp Opt-in (Allow sending WhatsApp messages) {isWhatsAppEnabled ? '(Enabled)' : '(Disabled)'}
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
            client ? 'Update Client' : 'Add Client'
          )}
        </button>
      </div>
    </form>
  );

  if (!useModalWrapper) {
    return renderForm();
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            {client ? 'Edit Client' : 'Add New Client'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        {renderForm()}
      </div>
    </div>
  );
};

export default ClientModal;