import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiService } from '../../services/api-service';
import {
  CheckCircle,
  XCircle,
  Clock,
  Wifi,
  Satellite,
  Pause,
  Plus,
  Search,
  AlertCircle,
  ListChecks,
  Edit,
  Trash2,
  Play,
  DollarSign
} from 'lucide-react';
import type { SortState } from '../common/DataTable';
import Modal from '../common/Modal';
import SubscriptionModal from './SubscriptionModal';
import PaymentForm from './PaymentForm';

interface PaginationState {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

interface Client {
  id: number;
  name: string;
  email: string;
  phone: string;
  status: string;
  whatsapp_opt_in: number;
  created_at: string;
}

interface Subscription {
  id: number;
  client_id: number;
  client_name: string;
  client_email: string;
  client_phone?: string | null;
  client_whatsapp_opt_in?: number;
  type: 'internet' | 'satellite';
  start_date: string;
  end_date?: string | null;
  billing_cycle: number;
  status: 'active' | 'stopped' | 'expired';
  next_payment_date: string;
  monthly_amount: number;
  created_at: string;
}

const SubscriptionsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  // We'll keep clients state for future use in forms
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [confirmDeleteModal, setConfirmDeleteModal] = useState<{show: boolean, subscriptionId: number | null}>({show: false, subscriptionId: null});
  
  // Statistics state
  const [stats, setStats] = useState<{
    totalSubscriptions: number;
    activeSubscriptions: number;
    expiredSubscriptions: number;
    dueSubscriptions: number;
  }>({totalSubscriptions: 0, activeSubscriptions: 0, expiredSubscriptions: 0, dueSubscriptions: 0});
  
  // Pagination state
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    pageSize: 10,
    totalItems: 0,
    totalPages: 0
  });
  
  // Sorting state
  const [sortState] = useState<SortState>({
    field: 'next_payment_date',
    direction: 'asc'
  });
  
  // Filter state
  const [filterState, setFilterState] = useState<{
    search: string;
    status: string;
    type: string;
  }>({
    search: '',
    status: 'all',
    type: 'all'
  });

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      
      const [subscriptionsResponse, clientsResponse] = await Promise.all([
        apiService.getSubscriptions({
          page: pagination.page,
          pageSize: pagination.pageSize,
          search: filterState.search,
          status: filterState.status !== 'all' ? filterState.status : undefined,
          type: filterState.type !== 'all' ? filterState.type : undefined,
          sortField: sortState.field,
          sortDirection: sortState.direction
        }),
        apiService.getClients()
      ]);
      
      if (subscriptionsResponse.success) {
        const normalizedSubscriptions = subscriptionsResponse.data.data.map((subscription: Subscription) => ({
          ...subscription,
          client_whatsapp_opt_in: subscription.client_whatsapp_opt_in !== undefined
            ? Number(subscription.client_whatsapp_opt_in)
            : undefined,
        }));

        setSubscriptions(normalizedSubscriptions);
        setPagination(subscriptionsResponse.data.pagination);
        
        // Update statistics
        const totalSubscriptions = subscriptionsResponse.data.pagination.totalItems;
        const activeSubscriptions = normalizedSubscriptions.filter((sub: Subscription) => sub.status === 'active').length;
        const expiredSubscriptions = normalizedSubscriptions.filter((sub: Subscription) => sub.status === 'expired').length;
        const dueSubscriptions = normalizedSubscriptions.filter((sub: Subscription) => 
          sub.status === 'active' && isPaymentDue(sub.next_payment_date)
        ).length;
        
        setStats({
          totalSubscriptions,
          activeSubscriptions,
          expiredSubscriptions,
          dueSubscriptions
        });
      }
      
      // Load clients for forms
      if (clientsResponse.success) {
        setClients(clientsResponse.data.data || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.pageSize, filterState, sortState]);
  
  useEffect(() => {
    loadData();
    
    if (searchParams.get('action') === 'add') {
      setShowModal(true);
      setSelectedSubscription(null);
    }
  }, [searchParams, loadData]);

  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, page }));
    setTimeout(() => loadData(), 0);
  };

  const handleFilterChange = useCallback(() => {
    setPagination(prev => ({ ...prev, page: 1 }));
    setTimeout(() => loadData(), 0);
  }, [loadData]);
  
  // Apply filters when search, status, or type changes
  useEffect(() => {
    handleFilterChange();
  }, [filterState, handleFilterChange]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const search = e.target.value;
    setFilterState(prev => ({ ...prev, search }));
  };

  const handleStatusFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const status = e.target.value;
    setFilterState(prev => ({ ...prev, status }));
  };

  const handleTypeFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const type = e.target.value;
    setFilterState(prev => ({ ...prev, type }));
  };

  const handleAddSubscription = () => {
    setSelectedSubscription(null);
    setShowModal(true);
    setSearchParams({});
  };

  const handleEditSubscription = (subscription: Subscription) => {
    setSelectedSubscription(subscription);
    setShowModal(true);
  };

  const handlePayment = (subscription: Subscription) => {
    const clientDetails = clients.find(client => client.id === subscription.client_id);

    setSelectedSubscription({
      ...subscription,
      client_phone: clientDetails?.phone ?? subscription.client_phone ?? '',
      client_whatsapp_opt_in: clientDetails?.whatsapp_opt_in !== undefined
        ? Number(clientDetails.whatsapp_opt_in)
        : (subscription.client_whatsapp_opt_in !== undefined ? Number(subscription.client_whatsapp_opt_in) : 0),
    });
    setShowPaymentModal(true);
  };

  const handleStopSubscription = async (subscriptionId: number) => {
    try {
      setActionLoading(subscriptionId);
      const response = await apiService.stopSubscription(subscriptionId);
      if (response.success) {
        await loadData();
      } else {
        alert('Error stopping subscription: ' + response.message);
      }
    } catch (error) {
      console.error('Error stopping subscription:', error);
      alert('Error stopping subscription');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResumeSubscription = async (subscriptionId: number) => {
    try {
      setActionLoading(subscriptionId);
      const response = await apiService.resumeSubscription(subscriptionId);
      if (response.success) {
        await loadData();
      } else {
        alert('Error resuming subscription: ' + response.message);
      }
    } catch (error) {
      console.error('Error resuming subscription:', error);
      alert('Error resuming subscription');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteSubscription = (subscriptionId: number) => {
    setConfirmDeleteModal({ show: true, subscriptionId });
  };

  const confirmDeleteSubscription = async () => {
    if (!confirmDeleteModal.subscriptionId) return;
    
    try {
      setIsDeleting(confirmDeleteModal.subscriptionId);
      setConfirmDeleteModal({ show: false, subscriptionId: null });
      
      const response = await apiService.deleteSubscription(confirmDeleteModal.subscriptionId);
      if (response.success) {
        await loadData();
      } else {
        alert('Error deleting subscription: ' + response.message);
      }
    } catch (error) {
      console.error('Error deleting subscription:', error);
      alert('Error deleting subscription');
    } finally {
      setIsDeleting(null);
    }
  };

  const handleModalClose = () => {
    setShowModal(false);
    setSelectedSubscription(null);
    setSearchParams({});
  };

  const handlePaymentModalClose = () => {
    setShowPaymentModal(false);
    setSelectedSubscription(null);
  };

  const handleSubscriptionSaved = () => {
    loadData();
    handleModalClose();
  };

  const handlePaymentProcessed = () => {
    loadData();
    handlePaymentModalClose();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'stopped':
        return <Pause className="h-4 w-4 text-yellow-500" />;
      case 'expired':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTypeIcon = (type: string) => {
    return type === 'internet' ? 
      <Wifi className="h-4 w-4 text-blue-500" /> : 
      <Satellite className="h-4 w-4 text-purple-500" />;
  };

  const isPaymentDue = (nextPaymentDate: string) => {
    const today = new Date();
    const paymentDate = new Date(nextPaymentDate);
    const diffTime = paymentDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 7;
  };

  if (isLoading && !subscriptions.length) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Subscriptions</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage client subscriptions and payments
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button
            onClick={handleAddSubscription}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" />
            Add Subscription
          </button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-blue-500 rounded-md p-3">
                <ListChecks className="h-6 w-6 text-white" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Subscriptions</dt>
                  <dd className="text-lg font-semibold text-gray-900">{stats.totalSubscriptions}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-500 rounded-md p-3">
                <CheckCircle className="h-6 w-6 text-white" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Active Subscriptions</dt>
                  <dd className="text-lg font-semibold text-gray-900">{stats.activeSubscriptions}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-red-500 rounded-md p-3">
                <XCircle className="h-6 w-6 text-white" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Expired Subscriptions</dt>
                  <dd className="text-lg font-semibold text-gray-900">{stats.expiredSubscriptions}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-yellow-500 rounded-md p-3">
                <AlertCircle className="h-6 w-6 text-white" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Due for Payment</dt>
                  <dd className="text-lg font-semibold text-gray-900">{stats.dueSubscriptions}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="card-content">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search subscriptions..."
                  className="input pl-10"
                  value={filterState.search}
                  onChange={handleSearchChange}
                />
              </div>
            </div>
            <div>
              <select
                className="input"
                value={filterState.status}
                onChange={handleStatusFilterChange}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="stopped">Stopped</option>
                <option value="expired">Expired</option>
              </select>
            </div>
            <div>
              <select
                className="input"
                value={filterState.type}
                onChange={handleTypeFilterChange}
              >
                <option value="all">All Types</option>
                <option value="internet">Internet</option>
                <option value="satellite">Satellite</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Subscriptions Table */}
      <div className="card">
        <div className="card-content p-0">
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subscription</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Billing</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Next Payment</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {subscriptions.length > 0 ? (
                  subscriptions.map((subscription) => (
                    <tr key={subscription.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {subscription.client_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {subscription.client_email}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {getTypeIcon(subscription.type)}
                          <div className="ml-2">
                            <div className="text-sm font-medium text-gray-900 capitalize">
                              {subscription.type}
                            </div>
                            <div className="text-sm text-gray-500">
                              ID: {subscription.id}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            ${subscription.monthly_amount}
                          </div>
                          <div className="text-sm text-gray-500">
                            Every {subscription.billing_cycle} month{subscription.billing_cycle > 1 ? 's' : ''}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {getStatusIcon(subscription.status)}
                          <span
                            className={`ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              subscription.status === 'active'
                                ? 'bg-green-100 text-green-800'
                                : subscription.status === 'stopped'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {subscription.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`${isPaymentDue(subscription.next_payment_date) ? 'text-red-600' : 'text-gray-900'}`}>
                          <div className="text-sm font-medium">
                            {new Date(subscription.next_payment_date).toLocaleDateString()}
                          </div>
                          {isPaymentDue(subscription.next_payment_date) && (
                            <div className="text-xs text-red-500">
                              Payment due soon
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          {subscription.status === 'active' && (
                            <button
                              onClick={() => handlePayment(subscription)}
                              className="p-1 text-gray-400 hover:text-green-600"
                              title="Process Payment"
                            >
                              <DollarSign className="h-4 w-4" />
                            </button>
                          )}
                          
                          <button
                            onClick={() => handleEditSubscription(subscription)}
                            className="p-1 text-gray-400 hover:text-primary-600"
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          
                          {subscription.status === 'active' ? (
                            <button
                              onClick={() => handleStopSubscription(subscription.id)}
                              disabled={actionLoading === subscription.id}
                              className="p-1 text-gray-400 hover:text-yellow-600 disabled:opacity-50"
                              title="Stop Subscription"
                            >
                              {actionLoading === subscription.id ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600"></div>
                              ) : (
                                <Pause className="h-4 w-4" />
                              )}
                            </button>
                          ) : subscription.status === 'stopped' ? (
                            <button
                              onClick={() => handleResumeSubscription(subscription.id)}
                              disabled={actionLoading === subscription.id}
                              className="p-1 text-gray-400 hover:text-green-600 disabled:opacity-50"
                              title="Resume Subscription"
                            >
                              {actionLoading === subscription.id ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                            </button>
                          ) : null}
                          
                          <button
                            onClick={() => handleDeleteSubscription(subscription.id)}
                            disabled={isDeleting === subscription.id}
                            className="p-1 text-gray-400 hover:text-red-600 disabled:opacity-50"
                            title="Delete"
                          >
                            {isDeleting === subscription.id ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                      {filterState.search || filterState.status !== 'all' || filterState.type !== 'all'
                        ? 'No subscriptions found matching your criteria'
                        : 'No subscriptions yet. Add your first subscription to get started.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          <div className="px-6 py-4 flex items-center justify-between border-t border-gray-200">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => handlePageChange(Math.max(1, pagination.page - 1))}
                disabled={pagination.page === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => handlePageChange(Math.min(pagination.totalPages, pagination.page + 1))}
                disabled={pagination.page === pagination.totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{subscriptions.length > 0 ? (pagination.page - 1) * pagination.pageSize + 1 : 0}</span> to{' '}
                  <span className="font-medium">
                    {Math.min(pagination.page * pagination.pageSize, pagination.totalItems)}
                  </span>{' '}
                  of <span className="font-medium">{pagination.totalItems}</span> results
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => handlePageChange(Math.max(1, pagination.page - 1))}
                    disabled={pagination.page === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <span className="sr-only">Previous</span>
                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                  
                  {/* Page numbers */}
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    let pageNum;
                    if (pagination.totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (pagination.page <= 3) {
                      pageNum = i + 1;
                    } else if (pagination.page >= pagination.totalPages - 2) {
                      pageNum = pagination.totalPages - 4 + i;
                    } else {
                      pageNum = pagination.page - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                          pagination.page === pageNum
                            ? 'z-10 bg-primary-50 border-primary-500 text-primary-600'
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  
                  <button
                    onClick={() => handlePageChange(Math.min(pagination.totalPages, pagination.page + 1))}
                    disabled={pagination.page === pagination.totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <span className="sr-only">Next</span>
                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                </nav>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showModal && (
        <SubscriptionModal
          subscription={selectedSubscription}
          clients={clients}
          onClose={handleModalClose}
          onSave={handleSubscriptionSaved}
        />
      )}

      <Modal
        isOpen={showPaymentModal && selectedSubscription !== null}
        title="Process Payment"
        onClose={handlePaymentModalClose}
      >
        <div className="p-4">
          {selectedSubscription && (
            <PaymentForm 
              subscription={selectedSubscription}
              onSave={handlePaymentProcessed}
              onCancel={handlePaymentModalClose}
            />
          )}
        </div>
      </Modal>

      {/* Confirm Delete Modal */}
      <Modal
        isOpen={confirmDeleteModal.show}
        title="Confirm Delete"
        onClose={() => setConfirmDeleteModal({ show: false, subscriptionId: null })}
      >
        <div className="p-4">
          <p>Are you sure you want to delete this subscription? This action cannot be undone.</p>
          <div className="mt-4 flex justify-end space-x-2">
            <button
              onClick={() => setConfirmDeleteModal({ show: false, subscriptionId: null })}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={confirmDeleteSubscription}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SubscriptionsPage;
