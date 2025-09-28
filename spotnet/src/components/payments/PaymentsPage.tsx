import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DollarSign, CreditCard, Calendar, RefreshCw } from 'lucide-react';
import DataTable from '../common/DataTable';
import type { Column, PaginationState } from '../common/DataTable';
import StatisticsPanel from '../common/StatisticsPanel';
import type { StatItem } from '../common/StatisticsPanel';
import { apiService } from '../../services/api-service';

interface Payment {
  id: number;
  subscription_id: number;
  amount: number;
  payment_date: string;
  payment_method: string;
  notes?: string | null;
  client_name: string;
  client_id: number;
  subscription_type: string;
}

interface ClientSummary {
  id: number;
  name: string;
}

interface PaymentFilters {
  clientId: string;
  method: string;
  search: string;
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const PaymentsPage: React.FC = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [filters, setFilters] = useState<PaymentFilters>({ clientId: 'all', method: 'all', search: '' });
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    pageSize: 10,
    totalItems: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSupportingData = useCallback(async () => {
    try {
      const clientsResponse = await apiService.getClients({ page: 1, pageSize: 500, sortField: 'name', sortDirection: 'asc' });

      if (clientsResponse?.success && clientsResponse.data?.data) {
        const items = (clientsResponse.data.data as ClientSummary[]).map((client) => ({
          id: Number(client.id),
          name: client.name,
        }));
        setClients(items);
      }
    } catch (err) {
      console.error('Error fetching payment supporting data:', err);
    }
  }, []);

  const fetchPayments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const clientIdParam = filters.clientId !== 'all' ? Number(filters.clientId) : undefined;
      const paymentsResponse = await apiService.getPayments(undefined, clientIdParam);

      if (paymentsResponse?.success) {
        const paymentList: Payment[] = (paymentsResponse.data || []).map((payment: Payment) => ({
          ...payment,
          id: Number(payment.id),
          subscription_id: Number(payment.subscription_id),
          amount: Number(payment.amount),
          client_id: Number(payment.client_id),
        }));
        setPayments(paymentList);
      } else {
        setError(paymentsResponse?.message || 'Failed to load payments');
        setPayments([]);
      }
    } catch (err) {
      console.error('Error fetching payments:', err);
      setError('Failed to load payments');
      setPayments([]);
    } finally {
      setIsLoading(false);
    }
  }, [filters.clientId]);

  useEffect(() => {
    fetchSupportingData();
  }, [fetchSupportingData]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const availableMethods = useMemo(() => {
    const methods = new Set<string>();
    payments.forEach((payment) => {
      if (payment.payment_method) {
        methods.add(payment.payment_method);
      }
    });
    return Array.from(methods);
  }, [payments]);

  const filteredPayments = useMemo(() => {
    const searchTerm = filters.search.trim().toLowerCase();
    const methodFilter = filters.method;

    return payments.filter((payment) => {
      const matchesMethod = methodFilter === 'all' || payment.payment_method === methodFilter;
      const matchesSearch =
        searchTerm.length === 0 ||
        payment.client_name.toLowerCase().includes(searchTerm) ||
        payment.subscription_type.toLowerCase().includes(searchTerm) ||
        (payment.notes ? payment.notes.toLowerCase().includes(searchTerm) : false) ||
        payment.payment_method.toLowerCase().includes(searchTerm);

      return matchesMethod && matchesSearch;
    });
  }, [payments, filters.search, filters.method]);

  useEffect(() => {
    setPagination((prev) => {
      const totalItems = filteredPayments.length;
      const totalPages = totalItems === 0 ? 1 : Math.ceil(totalItems / prev.pageSize);
      const currentPage = Math.min(prev.page, totalPages);
      return {
        ...prev,
        page: currentPage,
        totalItems,
        totalPages,
      };
    });
  }, [filteredPayments]);

  const paginatedPayments = useMemo(() => {
    const startIndex = (pagination.page - 1) * pagination.pageSize;
    return filteredPayments.slice(startIndex, startIndex + pagination.pageSize);
  }, [filteredPayments, pagination.page, pagination.pageSize]);

  const handlePageChange = (page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  };

  const handlePageSizeChange = (pageSize: number) => {
    setPagination({ page: 1, pageSize, totalItems: filteredPayments.length, totalPages: Math.max(1, Math.ceil(filteredPayments.length / pageSize) || 1) });
  };

  const handleFilterChange = (key: keyof PaymentFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchPayments();
    setIsRefreshing(false);
  };

  const totalAmount = useMemo(
    () => filteredPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    [filteredPayments]
  );

  const averageAmount = filteredPayments.length > 0 ? totalAmount / filteredPayments.length : 0;

  const lastPaymentDate = filteredPayments.reduce<string | null>((latest, payment) => {
    const currentDate = payment.payment_date ? new Date(payment.payment_date).getTime() : 0;
    if (!latest) {
      return payment.payment_date;
    }
    const latestDate = new Date(latest).getTime();
    return currentDate > latestDate ? payment.payment_date : latest;
  }, null);

  const statisticsItems: StatItem[] = [
    {
      title: 'Total Payments',
      value: filteredPayments.length,
      icon: <CreditCard className="h-5 w-5 text-white" />,
      color: 'blue',
    },
    {
      title: 'Total Amount',
      value: currencyFormatter.format(totalAmount || 0),
      icon: <DollarSign className="h-5 w-5 text-white" />,
      color: 'green',
    },
    {
      title: 'Average Amount',
      value: filteredPayments.length > 0 ? currencyFormatter.format(averageAmount) : '$0.00',
      icon: <DollarSign className="h-5 w-5 text-white" />,
      color: 'purple',
    },
    {
      title: 'Last Payment Date',
      value: lastPaymentDate ? new Date(lastPaymentDate).toLocaleDateString() : 'N/A',
      icon: <Calendar className="h-5 w-5 text-white" />,
      color: 'indigo',
    },
  ];

  const columns: Column<Payment>[] = [
    {
      header: 'Date',
      accessor: (payment) => new Date(payment.payment_date).toLocaleDateString(),
      sortable: true,
      sortKey: 'payment_date',
    },
    {
      header: 'Client',
      accessor: (payment) => (
        <div>
          <Link to={`/clients/${payment.client_id}`} className="text-sm font-medium text-primary-600 hover:text-primary-800 hover:underline">
            {payment.client_name}
          </Link>
          <div className="text-xs text-gray-500">Subscription #{payment.subscription_id}</div>
        </div>
      ),
    },
    {
      header: 'Subscription',
      accessor: (payment) => payment.subscription_type ? payment.subscription_type.charAt(0).toUpperCase() + payment.subscription_type.slice(1) : '—',
    },
    {
      header: 'Amount',
      accessor: (payment) => (
        <div className="font-medium text-gray-900">{currencyFormatter.format(payment.amount)}</div>
      ),
      sortable: true,
      sortKey: 'amount',
    },
    {
      header: 'Method',
      accessor: (payment) => payment.payment_method || '—',
    },
    {
      header: 'Notes',
      accessor: (payment) => payment.notes || '—',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Payments</h1>
        <p className="mt-1 text-sm text-gray-600">Review all recorded payments and filter by client or payment method.</p>
      </div>

      <StatisticsPanel stats={statisticsItems} loading={isLoading && payments.length === 0} />

      <div className="card">
        <div className="card-content">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
              <select
                className="input"
                value={filters.clientId}
                onChange={(event) => handleFilterChange('clientId', event.target.value)}
              >
                <option value="all">All Clients</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
              <select
                className="input"
                value={filters.method}
                onChange={(event) => handleFilterChange('method', event.target.value)}
              >
                <option value="all">All Methods</option>
                {availableMethods.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <input
                type="search"
                className="input"
                placeholder="Search by client, subscription, or notes"
                value={filters.search}
                onChange={(event) => handleFilterChange('search', event.target.value)}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleRefresh}
              className="btn btn-secondary inline-flex items-center"
              disabled={isRefreshing || isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-md">{error}</div>
      )}

      <DataTable
        columns={columns}
        data={paginatedPayments}
        pagination={pagination}
        isLoading={isLoading}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        onRefresh={handleRefresh}
        keyField="id"
        emptyMessage={filters.search || filters.method !== 'all' || filters.clientId !== 'all'
          ? 'No payments match the current filters.'
          : 'No payments have been recorded yet.'}
      />
    </div>
  );
};

export default PaymentsPage;
