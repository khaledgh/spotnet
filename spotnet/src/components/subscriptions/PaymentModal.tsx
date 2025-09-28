import React, { useState } from 'react';
import { apiService } from '../../services/api-service';
import { X, AlertCircle, DollarSign, Calendar } from 'lucide-react';

interface Subscription {
  id: number;
  client_name: string;
  client_phone?: string;
  client_whatsapp_opt_in?: number;
  type: string;
  billing_cycle: number;
  monthly_amount: number;
  next_payment_date: string;
}

interface PaymentModalProps {
  subscription: Subscription;
  onClose: () => void;
  onSave: () => void;
}

type PaymentFormState = {
  amount: number;
  payment_method: string;
  notes: string;
  payment_date: string;
  send_whatsapp: boolean;
};

const PaymentModal: React.FC<PaymentModalProps> = ({ subscription, onClose, onSave }) => {
  const [formData, setFormData] = useState<PaymentFormState>({
    amount: subscription.monthly_amount * subscription.billing_cycle,
    payment_method: 'cash',
    notes: '',
    payment_date: new Date().toISOString().slice(0, 10),
    send_whatsapp: subscription.client_whatsapp_opt_in === 1,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const calculateNewPaymentDate = () => {
    const currentDate = new Date(subscription.next_payment_date);
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + subscription.billing_cycle);
    return newDate.toLocaleDateString();
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.amount || formData.amount <= 0) {
      newErrors.amount = 'Payment amount must be greater than 0';
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
      const paymentData = {
        amount: formData.amount,
        payment_method: formData.payment_method,
        payment_date: formData.payment_date,
        notes: formData.notes,
        send_whatsapp: formData.send_whatsapp,
      };

      const response = await apiService.processPayment(subscription.id, paymentData);

      if (response.success) {
        onSave();
      } else {
        setErrors({ submit: response.message || 'An error occurred' });
      }
    } catch (error: unknown) {
      console.error('Error processing payment:', error);
      const responseError = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErrors({ submit: responseError || 'An error occurred' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;

    let newValue: string | number | boolean = value;

    if (type === 'number') {
      newValue = parseFloat(value) || 0;
    } else if (type === 'checkbox') {
      newValue = (e.target as HTMLInputElement).checked;
    }

    setFormData(prev => ({
      ...prev,
      [name]: newValue,
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Process Payment
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Subscription Info */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h4 className="font-medium text-gray-900 mb-2">Subscription Details</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Client:</span>
              <span className="font-medium">{subscription.client_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Type:</span>
              <span className="font-medium capitalize">{subscription.type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Billing Cycle:</span>
              <span className="font-medium">{subscription.billing_cycle} month{subscription.billing_cycle > 1 ? 's' : ''}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Current Due Date:</span>
              <span className="font-medium">{new Date(subscription.next_payment_date).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">New Due Date:</span>
              <span className="font-medium text-green-600">{calculateNewPaymentDate()}</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {errors.submit && (
            <div className="flex items-center space-x-2 text-red-600 text-sm bg-red-50 p-3 rounded-md">
              <AlertCircle className="h-4 w-4" />
              <span>{errors.submit}</span>
            </div>
          )}

          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
              Payment Amount ($) *
            </label>
            <div className="mt-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <DollarSign className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="number"
                id="amount"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                step="0.01"
                min="0"
                className={`input pl-10 ${errors.amount ? 'border-red-300' : ''}`}
                placeholder="0.00"
              />
            </div>
            {errors.amount && (
              <p className="mt-1 text-sm text-red-600">{errors.amount}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Suggested: ${(subscription.monthly_amount * subscription.billing_cycle).toFixed(2)} 
              ({subscription.billing_cycle} month{subscription.billing_cycle > 1 ? 's' : ''} × ${subscription.monthly_amount})
            </p>
          </div>

          <div>
            <label htmlFor="payment_method" className="block text-sm font-medium text-gray-700">
              Payment Method
            </label>
            <select
              id="payment_method"
              name="payment_method"
              value={formData.payment_method}
              onChange={handleChange}
              className="mt-1 input"
            >
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="credit_card">Credit Card</option>
              <option value="check">Check</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
              Notes (Optional)
            </label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              className="mt-1 input"
              placeholder="Additional notes about this payment..."
            />
          </div>

          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-start">
              <Calendar className="h-5 w-5 text-blue-400 mt-0.5" />
              <div className="ml-3">
                <h4 className="text-sm font-medium text-blue-800">Payment Processing</h4>
                <p className="text-sm text-blue-700 mt-1">
                  Processing this payment will:
                </p>
                <ul className="text-sm text-blue-700 mt-1 ml-4 list-disc">
                  <li>Record the payment in the system</li>
                  <li>Update the next payment date to {calculateNewPaymentDate()}</li>
                  <li>Send an email confirmation to the client</li>
                  <li>Set subscription status to active</li>
                  {subscription.client_whatsapp_opt_in === 1 && (
                    <li>Send a WhatsApp confirmation message</li>
                  )}
                </ul>
              </div>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">Send WhatsApp Receipt</h4>
                <p className="text-xs text-gray-500">
                  The client will receive a WhatsApp confirmation message if they have opted in.
                </p>
              </div>
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  name="send_whatsapp"
                  checked={formData.send_whatsapp}
                  onChange={handleChange}
                  className="form-checkbox h-5 w-5 text-primary-600"
                  disabled={subscription.client_whatsapp_opt_in !== 1}
                />
                <span className="ml-2 text-sm text-gray-700">
                  {subscription.client_whatsapp_opt_in === 1 ? 'Enabled' : 'Client not opted in'}
                </span>
              </label>
            </div>

            <div>
              <label htmlFor="payment_date" className="block text-sm font-medium text-gray-700">
                Payment Date
              </label>
              <input
                type="date"
                id="payment_date"
                name="payment_date"
                value={formData.payment_date}
                onChange={handleChange}
                className="mt-1 input"
              />
            </div>
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
                  Processing...
                </div>
              ) : (
                <>
                  <DollarSign className="h-4 w-4 mr-2" />
                  Process Payment
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PaymentModal;
