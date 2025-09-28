import React, { useState } from 'react';
import { apiService } from '../../services/api-service';
import { AlertCircle, CheckCircle } from 'lucide-react';

interface Subscription {
  id: number;
  client_id: number;
  client_name: string;
  client_email: string;
  client_whatsapp_opt_in?: number;
  type: 'internet' | 'satellite';
  monthly_amount: number;
  next_payment_date: string;
}

interface PaymentFormProps {
  subscription: Subscription;
  onSave: () => void;
  onCancel: () => void;
}

const PaymentForm: React.FC<PaymentFormProps> = ({ subscription, onSave, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{message: string, nextPaymentDate: string, whatsappSent?: boolean} | null>(null);
  const [formData, setFormData] = useState({
    amount: subscription.monthly_amount,
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'cash',
    notes: '',
    send_whatsapp: subscription.client_whatsapp_opt_in === 1
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      setFormData({
        ...formData,
        [name]: (e.target as HTMLInputElement).checked
      });
    } else if (name === 'amount') {
      setFormData({
        ...formData,
        [name]: parseFloat(value)
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
    setSuccess(null);

    try {
      // Process the payment
      const response = await apiService.processPayment(subscription.id, formData);

      if (response.success) {
        // Show success message with next payment date
        const nextPaymentDate = response.data?.next_payment_date 
          ? new Date(response.data.next_payment_date).toLocaleDateString() 
          : 'updated';
        
        // Check if WhatsApp message was sent
        const whatsappSent = formData.send_whatsapp ? response.data?.whatsapp_sent : undefined;
        
        // Set success state
        setSuccess({
          message: 'Payment processed successfully!',
          nextPaymentDate,
          whatsappSent
        });
        
        // Wait a moment before closing the modal to show the success message
        setTimeout(() => {
          onSave(); // This will close the modal and refresh data
        }, 2000);
      } else {
        setError(response.message || 'Failed to process payment');
      }
    } catch (error) {
      console.error('Error processing payment:', error);
      setError('An error occurred while processing payment');
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
      
      {success && (
        <div className="bg-green-50 border-l-4 border-green-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <CheckCircle className="h-5 w-5 text-green-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-green-700">{success.message}</p>
              <p className="text-sm text-green-700 font-semibold">Next payment due: {success.nextPaymentDate}</p>
              {success.whatsappSent !== undefined && (
                <p className="text-sm text-green-700">
                  WhatsApp notification: {success.whatsappSent ? 'Sent successfully' : 'Failed to send'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="bg-gray-50 p-4 rounded-md mb-4">
        <h3 className="text-lg font-medium text-gray-900">{subscription.client_name}</h3>
        <p className="text-sm text-gray-500">{subscription.client_email}</p>
        <p className="text-sm text-gray-500 mt-1">
          <span className="font-medium">Subscription:</span> {subscription.type}
        </p>
        <p className="text-sm text-gray-500">
          <span className="font-medium">Next payment due:</span> {new Date(subscription.next_payment_date).toLocaleDateString()}
        </p>
      </div>

      <div>
        <label htmlFor="amount" className="block text-sm font-medium text-gray-700">Payment Amount ($)</label>
        <input
          type="number"
          id="amount"
          name="amount"
          value={formData.amount}
          onChange={handleChange}
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
          min="0"
          step="0.01"
          required
        />
      </div>

      <div>
        <label htmlFor="payment_date" className="block text-sm font-medium text-gray-700">Payment Date</label>
        <input
          type="date"
          id="payment_date"
          name="payment_date"
          value={formData.payment_date}
          onChange={handleChange}
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
          required
        />
      </div>

      <div>
        <label htmlFor="payment_method" className="block text-sm font-medium text-gray-700">Payment Method</label>
        <select
          id="payment_method"
          name="payment_method"
          value={formData.payment_method}
          onChange={handleChange}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
        >
          <option value="cash">Cash</option>
          <option value="credit_card">Credit Card</option>
          <option value="bank_transfer">Bank Transfer</option>
          <option value="mobile_payment">Mobile Payment</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700">Notes (optional)</label>
        <textarea
          id="notes"
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          rows={3}
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <input
            type="checkbox"
            id="send_whatsapp"
            name="send_whatsapp"
            checked={formData.send_whatsapp}
            onChange={handleChange}
            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            disabled={subscription.client_whatsapp_opt_in !== 1}
          />
          <label htmlFor="send_whatsapp" className="ml-2 block text-sm text-gray-900">
            Send payment confirmation via WhatsApp
          </label>
        </div>
        <span className="text-xs text-gray-500">
          {subscription.client_whatsapp_opt_in === 1 ? 'Client opted-in' : 'Client not opted-in'}
        </span>
      </div>

      <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading || success !== null}
          className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:col-start-1 sm:text-sm disabled:opacity-50"
        >
          {success ? 'Closing...' : 'Cancel'}
        </button>
        <button
          type="submit"
          disabled={loading || success !== null}
          className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:col-start-2 sm:text-sm disabled:opacity-50"
        >
          {loading ? 'Processing...' : success ? 'Payment Processed' : 'Process Payment'}
        </button>
      </div>
    </form>
  );
};

export default PaymentForm;
