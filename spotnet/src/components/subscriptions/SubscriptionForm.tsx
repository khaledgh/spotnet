import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api-service';
import { AlertCircle } from 'lucide-react';

interface Client {
  id: number;
  name: string;
  email: string;
}

interface Subscription {
  id?: number;
  client_id: number;
  type: 'internet' | 'satellite';
  start_date: string;
  end_date?: string | null;
  billing_cycle: number;
  status: 'active' | 'stopped' | 'expired';
  next_payment_date: string;
  monthly_amount: number;
}

interface SubscriptionFormProps {
  subscription?: Subscription | null;
  onSave: (subscription: Subscription) => void;
  onCancel: () => void;
}

const SubscriptionForm: React.FC<SubscriptionFormProps> = ({ subscription, onSave, onCancel }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Subscription>({
    client_id: 0,
    type: 'internet',
    start_date: new Date().toISOString().split('T')[0],
    end_date: null,
    billing_cycle: 1,
    status: 'active',
    next_payment_date: new Date().toISOString().split('T')[0],
    monthly_amount: 0
  });

  useEffect(() => {
    // Load clients for the dropdown
    const loadClients = async () => {
      try {
        const response = await apiService.getClients();
        if (response.success) {
          setClients(response.data);
        } else {
          setError('Failed to load clients');
        }
      } catch (err) {
        setError('An error occurred while loading clients');
      }
    };

    loadClients();

    // If editing, populate the form with subscription data
    if (subscription) {
      setFormData({
        ...subscription,
        start_date: subscription.start_date.split('T')[0],
        next_payment_date: subscription.next_payment_date.split('T')[0],
        end_date: subscription.end_date ? subscription.end_date.split('T')[0] : null
      });
    }
  }, [subscription]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Handle numeric values
    if (name === 'monthly_amount' || name === 'billing_cycle' || name === 'client_id') {
      setFormData({
        ...formData,
        [name]: name === 'client_id' ? parseInt(value) : parseFloat(value)
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate required fields
      if (!formData.client_id || formData.monthly_amount <= 0) {
        setError('Please fill all required fields');
        setLoading(false);
        return;
      }

      let response;
      if (subscription?.id) {
        response = await apiService.updateSubscription(subscription.id, formData);
      } else {
        response = await apiService.createSubscription(formData);
      }

      if (response.success) {
        onSave(response.data);
      } else {
        setError(response.message || 'Failed to save subscription');
      }
    } catch (error) {
      console.error('Error saving subscription:', error);
      setError('An error occurred while saving');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div>
        <label htmlFor="client_id" className="block text-sm font-medium text-gray-700">Client</label>
        <select
          id="client_id"
          name="client_id"
          value={formData.client_id}
          onChange={handleChange}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
          required
        >
          <option value="">Select a client</option>
          {clients.map(client => (
            <option key={client.id} value={client.id}>
              {client.name} ({client.email})
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="type" className="block text-sm font-medium text-gray-700">Subscription Type</label>
          <select
            id="type"
            name="type"
            value={formData.type}
            onChange={handleChange}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
          >
            <option value="internet">Internet</option>
            <option value="satellite">Satellite</option>
          </select>
        </div>

        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-700">Status</label>
          <select
            id="status"
            name="status"
            value={formData.status}
            onChange={handleChange}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
          >
            <option value="active">Active</option>
            <option value="stopped">Stopped</option>
            <option value="expired">Expired</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="monthly_amount" className="block text-sm font-medium text-gray-700">Monthly Amount ($)</label>
          <input
            type="number"
            id="monthly_amount"
            name="monthly_amount"
            value={formData.monthly_amount}
            onChange={handleChange}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            min="0"
            step="0.01"
            required
          />
        </div>

        <div>
          <label htmlFor="billing_cycle" className="block text-sm font-medium text-gray-700">Billing Cycle (months)</label>
          <input
            type="number"
            id="billing_cycle"
            name="billing_cycle"
            value={formData.billing_cycle}
            onChange={handleChange}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            min="1"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="start_date" className="block text-sm font-medium text-gray-700">Start Date</label>
          <input
            type="date"
            id="start_date"
            name="start_date"
            value={formData.start_date}
            onChange={handleChange}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            required
          />
        </div>

        <div>
          <label htmlFor="next_payment_date" className="block text-sm font-medium text-gray-700">Next Payment Date</label>
          <input
            type="date"
            id="next_payment_date"
            name="next_payment_date"
            value={formData.next_payment_date}
            onChange={handleChange}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            required
          />
        </div>
      </div>

      <div>
        <label htmlFor="end_date" className="block text-sm font-medium text-gray-700">End Date (optional)</label>
        <input
          type="date"
          id="end_date"
          name="end_date"
          value={formData.end_date || ''}
          onChange={handleChange}
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
        />
      </div>

      <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
        <button
          type="button"
          onClick={onCancel}
          className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:col-start-1 sm:text-sm"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:col-start-2 sm:text-sm"
        >
          {loading ? 'Saving...' : subscription ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  );
};

export default SubscriptionForm;
