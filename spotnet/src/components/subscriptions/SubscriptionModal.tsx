import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api-service';
import { X, AlertCircle } from 'lucide-react';

interface Subscription {
  id?: number;
  client_id: number;
  type: 'internet' | 'satellite';
  start_date: string;
  end_date?: string | null;
  billing_cycle: number;
  monthly_amount: number;
}

interface Client {
  id: number;
  name: string;
  email: string;
}

interface SubscriptionModalProps {
  subscription: Subscription | null;
  clients: Client[];
  onClose: () => void;
  onSave: () => void;
}

const SubscriptionModal: React.FC<SubscriptionModalProps> = ({ subscription, clients, onClose, onSave }) => {
  const [formData, setFormData] = useState<Subscription>({
    client_id: 0,
    type: 'internet',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    billing_cycle: 1,
    monthly_amount: 0,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  // const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  
  const calculateEndDate = (startDate: string, billingCycle: number): string => {
    if (!startDate) return '';
    
    try {
      const date = new Date(startDate);
      // Add billing cycle months to the start date
      date.setMonth(date.getMonth() + billingCycle);
      // Format as YYYY-MM-DD
      return date.toISOString().split('T')[0];
    } catch (error) {
      console.error('Error calculating end date:', error);
      return '';
    }
  };
  useEffect(() => {
    if (subscription) {
      // For existing subscription, use the provided end_date or calculate it
      const endDate = subscription.end_date || 
                     calculateEndDate(subscription.start_date, subscription.billing_cycle);
      
      setFormData({
        id: subscription.id,
        client_id: subscription.client_id,
        type: subscription.type,
        start_date: subscription.start_date,
        end_date: endDate,
        billing_cycle: subscription.billing_cycle,
        monthly_amount: subscription.monthly_amount,
      });
      // const client = Array.isArray(clients) ? clients.find(c => c.id === subscription.client_id) : null;
      // // setSelectedClient(client || null);
    } else {
      // For new subscription, calculate end_date based on default values
      const startDate = new Date().toISOString().split('T')[0];
      const billingCycle = 1; // Default to 1 month
      const endDate = calculateEndDate(startDate, billingCycle);
      
      setFormData({
        client_id: 0,
        type: 'internet',
        start_date: startDate,
        end_date: endDate,
        billing_cycle: billingCycle,
        monthly_amount: 0,
      });
      // setSelectedClient(null);
    }
    setErrors({});
  }, [subscription, clients]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.client_id) {
      newErrors.client_id = 'Client is required';
    }

    if (!formData.start_date) {
      newErrors.start_date = 'Start date is required';
    }

    if (!formData.monthly_amount || formData.monthly_amount <= 0) {
      newErrors.monthly_amount = 'Monthly amount must be greater than 0';
    }

    // Convert billing_cycle to a number for comparison
    const billingCycle = Number(formData.billing_cycle);
    if (billingCycle !== 1 && billingCycle !== 3) {
      newErrors.billing_cycle = 'Billing cycle must be 1 or 3 months';
    }

    if (formData.end_date && formData.end_date <= formData.start_date) {
      newErrors.end_date = 'End date must be after start date';
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
      let response;
      if (subscription?.id) {
        response = await apiService.updateSubscription(subscription.id, formData);
      } else {
        response = await apiService.createSubscription(formData);
      }

      if (response.success) {
        onSave();
      } else {
        setErrors({ submit: response.message || 'An error occurred' });
      }
    } catch (error: unknown) {
      console.error('Error saving subscription:', error);
      const responseError = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErrors({ submit: responseError || 'An error occurred' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    // Create updated form data
    const updatedData = {
      ...formData,
      [name]: type === 'number' ? parseFloat(value) || 0 : value,
    };
    
    // If start_date or billing_cycle changes, update end_date automatically
    if (name === 'start_date' || name === 'billing_cycle') {
      const startDate = name === 'start_date' ? value : formData.start_date;
      // Make sure billing_cycle is a number (1 or 3)
      let cycle = name === 'billing_cycle' ? Number(value) : Number(formData.billing_cycle);
      
      // Ensure cycle is either 1 or 3
      if (cycle !== 1 && cycle !== 3) {
        cycle = 1; // Default to 1 month if invalid
      }
      
      updatedData.end_date = calculateEndDate(startDate, cycle);
      
      // If billing_cycle changed, ensure it's stored as a number
      if (name === 'billing_cycle') {
        updatedData.billing_cycle = cycle;
      }
    }
    
    setFormData(updatedData);
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-5 mx-auto p-5 border w-full max-w-lg shadow-lg rounded-md bg-white">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            {subscription ? 'Edit Subscription' : 'Add New Subscription'}
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
                </option>
              )) : <option value="0">Loading clients...</option>}
            </select>
            {errors.client_id && (
              <p className="mt-1 text-sm text-red-600">{errors.client_id}</p>
            )}
          </div>

          <div>
            <label htmlFor="type" className="block text-sm font-medium text-gray-700">
              Subscription Type *
            </label>
            <select
              id="type"
              name="type"
              value={formData.type}
              onChange={handleChange}
              className="mt-1 input"
            >
              <option value="internet">Internet</option>
              <option value="satellite">Satellite</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="start_date" className="block text-sm font-medium text-gray-700">
                Start Date *
              </label>
              <input
                type="date"
                id="start_date"
                name="start_date"
                value={formData.start_date}
                onChange={handleChange}
                className={`mt-1 input ${errors.start_date ? 'border-red-300' : ''}`}
              />
              {errors.start_date && (
                <p className="mt-1 text-sm text-red-600">{errors.start_date}</p>
              )}
            </div>

            <div>
              <label htmlFor="end_date" className="block text-sm font-medium text-gray-700">
                End Date
              </label>
              <input
                type="date"
                id="end_date"
                name="end_date"
                value={formData.end_date ?? ''}
                readOnly
                className={`mt-1 input ${errors.end_date ? 'border-red-300' : ''} bg-gray-100`}
              />
              {errors.end_date && (
                <p className="mt-1 text-sm text-red-600">{errors.end_date}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Automatically calculated based on start date and billing cycle
              </p>
            </div>
          </div>

          <div>
            <label htmlFor="billing_cycle" className="block text-sm font-medium text-gray-700">
              Billing Cycle *
            </label>
            <select
              id="billing_cycle"
              name="billing_cycle"
              value={formData.billing_cycle}
              onChange={handleChange}
              className={`mt-1 input ${errors.billing_cycle ? 'border-red-300' : ''}`}
            >
              <option value={1}>1 Month</option>
              <option value={3}>3 Months</option>
            </select>
            {errors.billing_cycle && (
              <p className="mt-1 text-sm text-red-600">{errors.billing_cycle}</p>
            )}
          </div>

          <div>
            <label htmlFor="monthly_amount" className="block text-sm font-medium text-gray-700">
              Monthly Amount ($) *
            </label>
            <input
              type="number"
              id="monthly_amount"
              name="monthly_amount"
              value={formData.monthly_amount}
              onChange={handleChange}
              step="0.01"
              min="0"
              className={`mt-1 input ${errors.monthly_amount ? 'border-red-300' : ''}`}
              placeholder="0.00"
            />
            {errors.monthly_amount && (
              <p className="mt-1 text-sm text-red-600">{errors.monthly_amount}</p>
            )}
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
                subscription ? 'Update Subscription' : 'Add Subscription'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SubscriptionModal;
