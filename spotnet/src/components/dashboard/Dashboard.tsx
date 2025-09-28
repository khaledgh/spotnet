import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiService } from '../../services/api-service';
import {
  Users,
  CreditCard,
  DollarSign,
  AlertCircle,
  TrendingUp,
  Calendar,
  CheckCircle,
} from 'lucide-react';

interface DashboardStats {
  totalClients: number;
  activeClients: number;
  totalSubscriptions: number;
  activeSubscriptions: number;
  expiredSubscriptions: number;
  monthlyRevenue: number;
  pendingPayments: number;
}

interface DashboardClient {
  id: number;
  name: string;
  email?: string;
  status: 'active' | 'stopped';
  whatsapp_opt_in?: number;
}

interface DashboardSubscription {
  id: number;
  client_id: number;
  client_name: string;
  type: 'internet' | 'satellite';
  status: 'active' | 'stopped' | 'expired';
  next_payment_date?: string;
  monthly_amount: number;
}

interface DashboardPayment {
  id: number;
  subscription_id: number;
  amount: number;
  payment_date: string;
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalClients: 0,
    activeClients: 0,
    totalSubscriptions: 0,
    activeSubscriptions: 0,
    expiredSubscriptions: 0,
    monthlyRevenue: 0,
    pendingPayments: 0,
  });
  const [recentClients, setRecentClients] = useState<DashboardClient[]>([]);
  const [upcomingPayments, setUpcomingPayments] = useState<DashboardSubscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      
      // Load clients
      const clientsResponse = await apiService.getClients({ pageSize: 100, page: 1, sortField: 'created_at', sortDirection: 'desc' });
      const clientsRaw = clientsResponse.success ? (clientsResponse.data?.data ?? []) : [];
      const clients: DashboardClient[] = Array.isArray(clientsRaw)
        ? clientsRaw.map((client) => ({
            id: Number(client.id),
            name: client.name,
            email: client.email,
            status: (client.status as 'active' | 'stopped') ?? 'active',
            whatsapp_opt_in: client.whatsapp_opt_in !== undefined ? Number(client.whatsapp_opt_in) : undefined,
          }))
        : [];
      
      // Load subscriptions
      const subscriptionsResponse = await apiService.getSubscriptions({ pageSize: 100, page: 1, sortField: 'next_payment_date', sortDirection: 'asc' });
      const subscriptionsRaw = subscriptionsResponse.success ? (subscriptionsResponse.data?.data ?? []) : [];
      const subscriptions: DashboardSubscription[] = Array.isArray(subscriptionsRaw)
        ? subscriptionsRaw.map((subscription) => ({
            id: Number(subscription.id),
            client_id: Number(subscription.client_id),
            client_name: subscription.client_name ?? 'Unknown client',
            type: (subscription.type as 'internet' | 'satellite') ?? 'internet',
            status: (subscription.status as 'active' | 'stopped' | 'expired') ?? 'active',
            next_payment_date: subscription.next_payment_date ?? undefined,
            monthly_amount: Number(subscription.monthly_amount ?? 0),
          }))
        : [];
      
      // Load payment history
      const paymentsResponse = await apiService.getPaymentHistory();
      const payments = paymentsResponse.success
        ? (paymentsResponse.data ?? { recent_payments: [], monthly_history: [] })
        : { recent_payments: [], monthly_history: [] };
      const recentPayments: DashboardPayment[] = Array.isArray(payments.recent_payments)
        ? payments.recent_payments.map((payment: Record<string, unknown>) => ({
            id: Number(payment.id ?? 0),
            subscription_id: Number(payment.subscription_id ?? 0),
            amount: Number(payment.amount ?? 0),
            payment_date: String(payment.payment_date ?? ''),
          }))
        : [];

      // Calculate stats
      const totalClients = clients.length;
      const activeClients = clients.filter((client) => client.status === 'active').length;
      const totalSubscriptions = subscriptions.length;
      const activeSubscriptions = subscriptions.filter((sub) => sub.status === 'active').length;
      const expiredSubscriptions = subscriptions.filter((sub) => sub.status === 'expired').length;
      
      // Calculate monthly revenue from recent payments
      const currentMonth = new Date().toISOString().slice(0, 7);
      const monthlyRevenue = recentPayments
        .filter((payment) => payment.payment_date?.startsWith(currentMonth))
        .reduce((sum, payment) => sum + payment.amount, 0);

      // Get upcoming payments (next 7 days)
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const upcoming = subscriptions.filter((s) => {
        if (s.status !== 'active') return false;
        if (!s.next_payment_date) return false;
        const paymentDate = new Date(s.next_payment_date);
        return paymentDate.getTime() <= nextWeek.getTime();
      });

      setStats({
        totalClients,
        activeClients,
        totalSubscriptions,
        activeSubscriptions,
        expiredSubscriptions,
        monthlyRevenue,
        pendingPayments: upcoming.length,
      });

      setRecentClients(clients.slice(0, 5));
      setUpcomingPayments(upcoming.slice(0, 5));
      
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const StatCard: React.FC<{
    title: string;
    value: string | number;
    icon: React.ElementType;
    color: string;
    change?: string;
    link?: string;
  }> = ({ title, value, icon: Icon, color, change, link }) => {
    const content = (
      <div className={`card p-6 ${link ? 'hover:shadow-md transition-shadow cursor-pointer' : ''}`}>
        <div className="flex items-center">
          <div className={`p-2 rounded-md ${color}`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-2xl font-semibold text-gray-900">{value}</p>
            {change && (
              <p className="text-sm text-green-600 flex items-center">
                <TrendingUp className="h-4 w-4 mr-1" />
                {change}
              </p>
            )}
          </div>
        </div>
      </div>
    );

    return link ? <Link to={link}>{content}</Link> : content;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">
          Welcome back! Here's what's happening with your subscriptions.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Clients"
          value={stats.totalClients}
          icon={Users}
          color="bg-blue-500"
          link="/clients"
        />
        <StatCard
          title="Active Subscriptions"
          value={stats.activeSubscriptions}
          icon={CheckCircle}
          color="bg-green-500"
          link="/subscriptions"
        />
        <StatCard
          title="Monthly Revenue"
          value={`$${stats.monthlyRevenue.toFixed(2)}`}
          icon={DollarSign}
          color="bg-purple-500"
        />
        <StatCard
          title="Pending Payments"
          value={stats.pendingPayments}
          icon={AlertCircle}
          color="bg-orange-500"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Clients */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium">Recent Clients</h3>
          </div>
          <div className="card-content">
            <div className="space-y-3">
              {recentClients.length > 0 ? (
                recentClients.map((client) => (
                  <div key={client.id} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-600">
                          {client.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-900">{client.name}</p>
                        <p className="text-sm text-gray-500">{client.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          client.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {client.status}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No clients found</p>
              )}
            </div>
            <div className="mt-4">
              <Link
                to="/clients"
                className="text-sm text-primary-600 hover:text-primary-500"
              >
                View all clients →
              </Link>
            </div>
          </div>
        </div>

        {/* Upcoming Payments */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium">Upcoming Payments</h3>
          </div>
          <div className="card-content">
            <div className="space-y-3">
              {upcomingPayments.length > 0 ? (
                upcomingPayments.map((subscription) => (
                  <div key={subscription.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {subscription.client_name}
                      </p>
                      <p className="text-sm text-gray-500 capitalize">
                        {subscription.type} subscription
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        ${subscription.monthly_amount}
                      </p>
                      <p className="text-sm text-gray-500">
                        {subscription.next_payment_date
                          ? new Date(subscription.next_payment_date).toLocaleDateString()
                          : '—'}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No upcoming payments</p>
              )}
            </div>
            <div className="mt-4">
              <Link
                to="/subscriptions"
                className="text-sm text-primary-600 hover:text-primary-500"
              >
                View all subscriptions →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium">Quick Actions</h3>
        </div>
        <div className="card-content">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              to="/clients?action=add"
              className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Users className="h-8 w-8 text-primary-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">Add Client</p>
                <p className="text-sm text-gray-500">Create new client</p>
              </div>
            </Link>
            
            <Link
              to="/subscriptions?action=add"
              className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <CreditCard className="h-8 w-8 text-primary-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">New Subscription</p>
                <p className="text-sm text-gray-500">Add subscription</p>
              </div>
            </Link>
            
            <Link
              to="/reminders?action=add"
              className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Calendar className="h-8 w-8 text-primary-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">Send Reminder</p>
                <p className="text-sm text-gray-500">Create reminder</p>
              </div>
            </Link>
            
            <button
              onClick={loadDashboardData}
              className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <TrendingUp className="h-8 w-8 text-primary-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">Refresh Data</p>
                <p className="text-sm text-gray-500">Update dashboard</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
