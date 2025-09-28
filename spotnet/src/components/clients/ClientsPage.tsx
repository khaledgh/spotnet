import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { apiService } from '../../services/api-service';

import {
  Plus,
  Search,
  Edit,
  Trash2,
  Phone,
  Mail,
  MessageCircle,
  CheckCircle,
  XCircle,
  Users,
} from 'lucide-react';
import ClientModal from './ClientModal';
import DataTable from '../common/DataTable';
import type { Column, PaginationState, SortState } from '../common/DataTable';
import StatisticsPanel from '../common/StatisticsPanel';
import type { StatItem } from '../common/StatisticsPanel';
import Modal from '../common/Modal';

interface Client {
  id: number;
  name: string;
  email: string;
  phone: string;
  status: 'active' | 'stopped';
  whatsapp_opt_in: number;
  subscription_count: number;
  active_subscriptions: number;
  created_at: string;
}

const ClientsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [confirmDeleteModal, setConfirmDeleteModal] = useState<{show: boolean, clientId: number | null}>({show: false, clientId: null});
  
  // Statistics state
  const [stats, setStats] = useState<{
    totalClients: number;
    activeClients: number;
    whatsappOptIn: number;
  }>({totalClients: 0, activeClients: 0, whatsappOptIn: 0});
  
  // Pagination state
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    pageSize: 10,
    totalItems: 0,
    totalPages: 0
  });
  
  // Sorting state
  const [sortState, setSortState] = useState<SortState>({
    field: 'created_at',
    direction: 'desc'
  });
  
  // Filter state
  const [filterState, setFilterState] = useState<{
    search: string;
    status: string;
    whatsappOptIn: number | null;
  }>({
    search: '',
    status: 'all',
    whatsappOptIn: null
  });

  const loadClients = useCallback(async () => {
    try {
      setIsLoading(true);
      
      const response = await apiService.getClients({
        page: pagination.page,
        pageSize: pagination.pageSize,
        search: filterState.search,
        status: filterState.status !== 'all' ? filterState.status : undefined,
        sortField: sortState.field,
        sortDirection: sortState.direction
      });
      
      if (response.success) {
        const clientsData = response.data.data.map((client: Client) => ({
          ...client,
          whatsapp_opt_in: Number(client.whatsapp_opt_in) === 1 ? 1 : 0,
        }));

        setClients(clientsData);
        setPagination(response.data.pagination);

        // Update statistics
        const totalClients = response.data.pagination.totalItems;
        const activeClients = clientsData.filter((client: Client) => client.status === 'active').length;
        const whatsappOptIn = clientsData.filter((client: Client) => client.whatsapp_opt_in === 1).length;
        
        setStats({
          totalClients,
          activeClients,
          whatsappOptIn,
        });
      }
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.pageSize, filterState, sortState]);
  
  useEffect(() => {
    loadClients();
    
    // Check if we should open the add modal
    if (searchParams.get('action') === 'add') {
      setShowModal(true);
      setSelectedClient(null);
    }
  }, [searchParams, loadClients]);

  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, page }));
    setTimeout(() => loadClients(), 0);
  };

  const handlePageSizeChange = (pageSize: number) => {
    setPagination(prev => ({ ...prev, page: 1, pageSize }));
    setTimeout(() => loadClients(), 0);
  };

  const handleSortChange = (newSortState: SortState) => {
    setSortState(newSortState);
    setPagination(prev => ({ ...prev, page: 1 }));
    setTimeout(() => loadClients(), 0);
  };

  const handleFilterChange = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    setTimeout(() => loadClients(), 0);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const search = e.target.value;
    setFilterState(prev => ({ ...prev, search }));
  };

  const handleStatusFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const status = e.target.value;
    setFilterState(prev => ({ ...prev, status }));
  };

  const handleWhatsappFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    const whatsappOptIn = value === 'all' ? null : parseInt(value);
    setFilterState(prev => ({ ...prev, whatsappOptIn }));
  };

  const handleAddClient = () => {
    setSelectedClient(null);
    setShowModal(true);
    setSearchParams({});
  };

  const handleEditClient = (client: Client) => {
    setSelectedClient(client);
    setShowModal(true);
  };

  const handleDeleteClient = (clientId: number) => {
    setConfirmDeleteModal({ show: true, clientId });
  };

  const confirmDeleteClient = async () => {
    if (!confirmDeleteModal.clientId) return;
    
    try {
      setIsDeleting(confirmDeleteModal.clientId);
      setConfirmDeleteModal({ show: false, clientId: null });
      
      const response = await apiService.deleteClient(confirmDeleteModal.clientId);
      if (response.success) {
        await loadClients();
      } else {
        alert('Error deleting client: ' + response.message);
      }
    } catch (error) {
      console.error('Error deleting client:', error);
      alert('Error deleting client');
    } finally {
      setIsDeleting(null);
    }
  };

  const handleModalClose = () => {
    setShowModal(false);
    setSelectedClient(null);
    setSearchParams({});
  };

  const handleClientSaved = () => {
    loadClients();
    handleModalClose();
  };

  // Define table columns
  const columns: Column<Client>[] = [
    {
      header: 'Client',
      accessor: (client) => (
        <Link to={`/clients/${client.id}`} className="flex items-center group">
          <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center group-hover:bg-primary-200 transition-colors">
            <span className="text-sm font-medium text-primary-700">
              {client.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="ml-4">
            <div className="text-sm font-medium text-primary-600 group-hover:text-primary-700">
              {client.name}
            </div>
            <div className="text-sm text-gray-500">
              ID: {client.id}
            </div>
          </div>
        </Link>
      ),
      sortable: true,
      sortKey: 'name'
    },
    {
      header: 'Contact',
      accessor: (client) => (
        <div className="space-y-1">
          <div className="flex items-center text-sm text-gray-900">
            <Mail className="h-4 w-4 mr-2 text-gray-400" />
            {client.email}
          </div>
          {client.phone && (
            <div className="flex items-center text-sm text-gray-500">
              <Phone className="h-4 w-4 mr-2 text-gray-400" />
              {client.phone}
            </div>
          )}
        </div>
      ),
      sortable: true,
      sortKey: 'email'
    },
    {
      header: 'Status',
      accessor: (client) => (
        <span
          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
            client.status === 'active'
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
          }`}
        >
          {client.status}
        </span>
      ),
      sortable: true,
      sortKey: 'status'
    },
    {
      header: 'Subscriptions',
      accessor: (client) => (
        <div>
          <div className="text-sm text-gray-900">
            {client.active_subscriptions} / {client.subscription_count}
          </div>
          <div className="text-xs text-gray-500">
            Active / Total
          </div>
        </div>
      )
    },
    {
      header: 'WhatsApp',
      accessor: (client) => (
        <div className="flex items-center">
          {client.whatsapp_opt_in ? (
            <CheckCircle className="h-5 w-5 text-green-500" />
          ) : (
            <XCircle className="h-5 w-5 text-red-500" />
          )}
          <span className="ml-2 text-sm text-gray-600">
            {client.whatsapp_opt_in ? 'Opted In' : 'Opted Out'}
          </span>
        </div>
      ),
      sortable: true,
      sortKey: 'whatsapp_opt_in'
    }
  ];

  // Create statistics items
  const statisticsItems: StatItem[] = [
    {
      title: 'Total Clients',
      value: stats.totalClients,
      icon: <Users className="h-5 w-5" />,
      color: 'blue'
    },
    {
      title: 'Active Clients',
      value: stats.activeClients,
      icon: <CheckCircle className="h-5 w-5" />,
      color: 'green'
    },
    {
      title: 'WhatsApp Opted In',
      value: stats.whatsappOptIn,
      icon: <MessageCircle className="h-5 w-5" />,
      color: 'purple'
    }
  ];

  const renderRowActions = (client: Client) => (
    <div className="flex items-center space-x-2">
      <button
        onClick={() => handleEditClient(client)}
        className="p-1 text-gray-400 hover:text-primary-600"
        title="Edit"
      >
        <Edit className="h-4 w-4" />
      </button>
      <button
        onClick={() => handleDeleteClient(client.id)}
        disabled={isDeleting === client.id}
        className="p-1 text-gray-400 hover:text-red-600 disabled:opacity-50"
        title="Delete"
      >
        {isDeleting === client.id ? (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
      </button>
    </div>
  );

  const renderFilters = () => (
    <div className="flex flex-col sm:flex-row gap-4">
      <div className="flex-1">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search clients..."
            className="input pl-10"
            value={filterState.search}
            onChange={handleSearchChange}
            onKeyDown={(e) => e.key === 'Enter' && handleFilterChange()}
          />
        </div>
      </div>
      <div className="sm:w-48">
        <select
          className="input"
          value={filterState.status}
          onChange={handleStatusFilterChange}
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="stopped">Stopped</option>
        </select>
      </div>
      <div className="sm:w-48">
        <select
          className="input"
          value={filterState.whatsappOptIn === null ? 'all' : String(filterState.whatsappOptIn)}
          onChange={handleWhatsappFilterChange}
        >
          <option value="all">All WhatsApp</option>
          <option value="1">Opted In</option>
          <option value="0">Opted Out</option>
        </select>
      </div>
      <div>
        <button 
          onClick={handleFilterChange}
          className="btn btn-primary"
        >
          Apply Filters
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Clients</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage your clients and their information
          </p>
        </div>
        <button
          onClick={handleAddClient}
          className="mt-4 sm:mt-0 btn btn-primary px-4 py-2"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Client
        </button>
      </div>

      {/* Statistics */}
      <StatisticsPanel 
        stats={statisticsItems} 
        loading={isLoading}
      />

      {/* Clients Table */}
      <DataTable
        columns={columns}
        data={clients}
        pagination={pagination}
        isLoading={isLoading}
        sortState={sortState}
        filterState={filterState}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        onSortChange={handleSortChange}
        onFilterChange={handleFilterChange}
        onRefresh={loadClients}
        keyField="id"
        renderRowActions={renderRowActions}
        renderFilters={renderFilters}
        emptyMessage={filterState.search || filterState.status !== 'all' || filterState.whatsappOptIn !== null
          ? 'No clients found matching your criteria'
          : 'No clients yet. Add your first client to get started.'}
      />

      {/* Client Modal */}
      <Modal
        isOpen={showModal}
        onClose={handleModalClose}
        title={selectedClient ? 'Edit Client' : 'Add New Client'}
        size="md"
      >
        <ClientModal
          client={selectedClient}
          onClose={handleModalClose}
          onSave={handleClientSaved}
          useModalWrapper={false}
        />
      </Modal>

      {/* Confirm Delete Modal */}
      <Modal
        isOpen={confirmDeleteModal.show}
        onClose={() => setConfirmDeleteModal({show: false, clientId: null})}
        title="Confirm Delete"
        size="sm"
        footer={
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setConfirmDeleteModal({show: false, clientId: null})}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={confirmDeleteClient}
              className="btn btn-danger"
              disabled={isDeleting !== null}
            >
              {isDeleting !== null ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Deleting...
                </div>
              ) : (
                'Delete'
              )}
            </button>
          </div>
        }
      >
        <p className="text-gray-700">
          Are you sure you want to delete this client? This will also delete all their subscriptions and data.
        </p>
        <p className="text-red-600 mt-2 text-sm">
          This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
};

export default ClientsPage;
