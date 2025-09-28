import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, CreditCard, DollarSign, MessageCircle, Mail, Phone, AlertCircle } from 'lucide-react';
import { apiService } from '../../services/api-service';

interface ClientDetails {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  status: 'active' | 'stopped';
  whatsapp_opt_in: number;
  created_at?: string;
  subscriptions?: Subscription[];
  payments?: Payment[];
}

interface Subscription {
  id: number;
  type: 'internet' | 'satellite';
  start_date: string;
  end_date?: string | null;
  billing_cycle: number;
  status: 'active' | 'stopped' | 'expired';
  next_payment_date: string;
  monthly_amount: number;
  created_at: string;
}

interface Payment {
  id: number;
  subscription_id: number;
  amount: number;
  payment_date: string;
  payment_method: string;
  notes?: string | null;
  subscription_type?: string;
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const ClientDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<ClientDetails | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchClient = async () => {
      if (!id) {
        setError('Client ID is required');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const response = await apiService.getClient(Number(id));
        if (response?.success && response.data) {
          const clientData = response.data as ClientDetails;
          clientData.whatsapp_opt_in = Number(clientData.whatsapp_opt_in);

          if (Array.isArray(clientData.subscriptions)) {
            clientData.subscriptions = clientData.subscriptions.map((sub) => ({
              ...sub,
              billing_cycle: Number(sub.billing_cycle),
              monthly_amount: Number(sub.monthly_amount),
            }));
          }

          if (Array.isArray(clientData.payments)) {
            clientData.payments = clientData.payments.map((payment) => ({
              ...payment,
              amount: Number(payment.amount),
              subscription_id: Number(payment.subscription_id),
            }));
          }

          setClient(clientData);
        } else {
          setError(response?.message || 'Unable to load client');
        }
      } catch (err) {
        console.error('Error fetching client details:', err);
        setError('Unable to load client details');
      } finally {
        setIsLoading(false);
      }
    };

    fetchClient();
  }, [id]);

  const sortedSubscriptions = useMemo(() => {
    if (!client?.subscriptions) return [];
    return [...client.subscriptions].sort((a, b) => {
      const aDate = new Date(a.next_payment_date).getTime();
      const bDate = new Date(b.next_payment_date).getTime();
      return bDate - aDate;
    });
  }, [client?.subscriptions]);

  const sortedPayments = useMemo(() => {
    if (!client?.payments) return [];
    return [...client.payments].sort((a, b) => {
      const aDate = new Date(a.payment_date).getTime();
      const bDate = new Date(b.payment_date).getTime();
      return bDate - aDate;
    });
  }, [client?.payments]);

  const totalPayments = sortedPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <button onClick={() => navigate(-1)} className="btn btn-secondary inline-flex items-center">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </button>
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!client) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => navigate(-1)} className="btn btn-secondary inline-flex items-center">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-content">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-gray-900">{client.name}</h1>
              <div className="mt-2 space-y-2 text-sm text-gray-600">
                {client.email && (
                  <div className="flex items-center">
                    <Mail className="h-4 w-4 mr-2 text-gray-400" />
                    {client.email}
                  </div>
                )}
                {client.phone && (
                  <div className="flex items-center">
                    <Phone className="h-4 w-4 mr-2 text-gray-400" />
                    {client.phone}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 sm:mt-0 space-y-2">
              <span
                className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${
                  client.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}
              >
                {client.status}
              </span>
              <div className="flex items-center text-sm text-gray-600">
                <MessageCircle
                  className={`h-4 w-4 mr-2 ${client.whatsapp_opt_in ? 'text-green-500' : 'text-gray-400'}`}
                />
                WhatsApp {client.whatsapp_opt_in ? 'Opted-in' : 'Opted-out'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {client.payments && client.payments.length > 0 && (
        <div className="card">
          <div className="card-content">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Payments</h2>
              <div className="text-sm text-gray-600">Total: {currencyFormatter.format(totalPayments)}</div>
            </div>

            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subscription</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedPayments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {new Date(payment.payment_date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {currencyFormatter.format(payment.amount)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {payment.payment_method || '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {payment.subscription_type
                          ? payment.subscription_type.charAt(0).toUpperCase() + payment.subscription_type.slice(1)
                          : `Subscription #${payment.subscription_id}`}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {payment.notes || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4">
              <Link
                to="/payments"
                className="text-sm text-primary-600 hover:text-primary-800 hover:underline inline-flex items-center"
              >
                <DollarSign className="h-4 w-4 mr-1" /> View all payments
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-content">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Subscriptions</h2>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <span>{client.subscriptions?.length || 0} total</span>
            </div>
          </div>

          {client.subscriptions && client.subscriptions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Next Payment</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Billing Cycle</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedSubscriptions.map((subscription) => (
                    <tr key={subscription.id}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 capitalize">
                        {subscription.type}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {new Date(subscription.start_date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {new Date(subscription.next_payment_date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {currencyFormatter.format(subscription.monthly_amount)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            subscription.status === 'active'
                              ? 'bg-green-100 text-green-800'
                              : subscription.status === 'stopped'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {subscription.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        Every {subscription.billing_cycle} month{subscription.billing_cycle > 1 ? 's' : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-sm text-gray-500">No subscriptions found for this client.</div>
          )}

          <div className="mt-4">
            <Link
              to="/subscriptions"
              className="text-sm text-primary-600 hover:text-primary-800 hover:underline inline-flex items-center"
            >
              <CreditCard className="h-4 w-4 mr-1" /> Manage subscriptions
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientDetailsPage;
