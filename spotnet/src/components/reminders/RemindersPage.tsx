import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiService } from '../../services/api-service';
import {
  Plus,
  Search,
  Send,
  Trash2,
  MessageCircle,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import ReminderModal from './ReminderModal';
import DataTable from '../common/DataTable';
import type { Column, PaginationState, SortState } from '../common/DataTable';
import StatisticsPanel from '../common/StatisticsPanel';
import type { StatItem } from '../common/StatisticsPanel';
import Modal from '../common/Modal';

interface Client {
  id: number;
  name: string;
  email: string;
  whatsapp_opt_in: number;
}

interface Reminder {
  id: number;
  client_id: number;
  client_name: string;
  client_phone: string;
  whatsapp_opt_in: number;
  message: string;
  send_via_whatsapp: number;
  status: 'pending' | 'sent' | 'failed';
  scheduled_date: string | null;
  sent_date: string | null;
  created_at: string;
}

const RemindersPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedReminder, setSelectedReminder] = useState<Reminder | null>(null);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [isSending, setIsSending] = useState<number | null>(null);
  const [isBulkSending, setIsBulkSending] = useState(false);
  const [confirmDeleteModal, setConfirmDeleteModal] = useState<{show: boolean, reminderId: number | null}>({show: false, reminderId: null});
  
  // Statistics state
  const [stats, setStats] = useState<{
    totalReminders: number;
    pendingReminders: number;
    sentReminders: number;
    failedReminders: number;
  }>({totalReminders: 0, pendingReminders: 0, sentReminders: 0, failedReminders: 0});
  
  // Pagination state
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    pageSize: 10,
    totalItems: 0,
    totalPages: 0
  });
  
  // Sorting state
  const [sortState, setSortState] = useState<SortState>({
    field: 'scheduled_date',
    direction: 'asc'
  });
  
  // Filter state
  const [filterState, setFilterState] = useState<{
    search: string;
    status: string;
    whatsappOnly: number | null;
  }>({
    search: '',
    status: 'all',
    whatsappOnly: null
  });

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      
      const [remindersResponse, clientsResponse] = await Promise.all([
        apiService.getReminders({
          page: pagination.page,
          pageSize: pagination.pageSize,
          search: filterState.search,
          status: filterState.status !== 'all' ? filterState.status : undefined,
          whatsappOnly: filterState.whatsappOnly ?? undefined,
          sortField: sortState.field,
          sortDirection: sortState.direction
        }),
        apiService.getClients()
      ]);
      
      if (remindersResponse.success) {
        setReminders(remindersResponse.data.data);
        setPagination(remindersResponse.data.pagination);
        
        // Update statistics
        const totalReminders = remindersResponse.data.pagination.totalItems;
        const pendingReminders = remindersResponse.data.data.filter((reminder: Reminder) => reminder.status === 'pending').length;
        const sentReminders = remindersResponse.data.data.filter((reminder: Reminder) => reminder.status === 'sent').length;
        const failedReminders = remindersResponse.data.data.filter((reminder: Reminder) => reminder.status === 'failed').length;
        
        setStats({
          totalReminders,
          pendingReminders,
          sentReminders,
          failedReminders
        });
      }
      
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
      setSelectedReminder(null);
    }
  }, [searchParams, loadData]);

  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, page }));
    setTimeout(() => loadData(), 0);
  };

  const handlePageSizeChange = (pageSize: number) => {
    setPagination(prev => ({ ...prev, page: 1, pageSize }));
    setTimeout(() => loadData(), 0);
  };

  const handleSortChange = (newSortState: SortState) => {
    setSortState(newSortState);
    setPagination(prev => ({ ...prev, page: 1 }));
    setTimeout(() => loadData(), 0);
  };

  const handleFilterChange = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    setTimeout(() => loadData(), 0);
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
    const whatsappOnly = value === 'all' ? null : parseInt(value);
    setFilterState(prev => ({ ...prev, whatsappOnly }));
  };

  const handleAddReminder = () => {
    setSelectedReminder(null);
    setShowModal(true);
    setSearchParams({});
  };

  const handleSendReminder = async (reminderId: number) => {
    try {
      setIsSending(reminderId);
      const response = await apiService.sendReminder(reminderId);
      if (response.success) {
        await loadData();
      } else {
        alert('Error sending reminder: ' + response.message);
      }
    } catch (error) {
      console.error('Error sending reminder:', error);
      alert('Error sending reminder');
    } finally {
      setIsSending(null);
    }
  };

  const handleBulkSend = async () => {
    try {
      setIsBulkSending(true);
      const response = await apiService.sendBulkReminders();
      if (response.success) {
        await loadData();
        alert(`Bulk send completed. Sent: ${response.data.sent}, Failed: ${response.data.failed}`);
      } else {
        alert('Error sending bulk reminders: ' + response.message);
      }
    } catch (error) {
      console.error('Error sending bulk reminders:', error);
      alert('Error sending bulk reminders');
    } finally {
      setIsBulkSending(false);
    }
  };

  const handleDeleteReminder = (reminderId: number) => {
    setConfirmDeleteModal({ show: true, reminderId });
  };

  const confirmDeleteReminder = async () => {
    if (!confirmDeleteModal.reminderId) return;
    
    try {
      setIsDeleting(confirmDeleteModal.reminderId);
      setConfirmDeleteModal({ show: false, reminderId: null });
      
      const response = await apiService.deleteReminder(confirmDeleteModal.reminderId);
      if (response.success) {
        await loadData();
      } else {
        alert('Error deleting reminder: ' + response.message);
      }
    } catch (error) {
      console.error('Error deleting reminder:', error);
      alert('Error deleting reminder');
    } finally {
      setIsDeleting(null);
    }
  };

  const handleModalClose = () => {
    setShowModal(false);
    setSelectedReminder(null);
    setSearchParams({});
  };

  const handleReminderSaved = () => {
    loadData();
    handleModalClose();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not scheduled';
    return new Date(dateString).toLocaleString();
  };

  // Define table columns
  const columns: Column<Reminder>[] = [
    {
      header: 'Client',
      accessor: (reminder) => (
        <div>
          <div className="text-sm font-medium text-gray-900">
            {reminder.client_name}
          </div>
          <div className="text-sm text-gray-500">
            {reminder.client_phone}
          </div>
        </div>
      ),
      sortable: true,
      sortKey: 'client_id'
    },
    {
      header: 'Message',
      accessor: (reminder) => (
        <div className="max-w-xs">
          <p className="text-sm text-gray-900 truncate">
            {reminder.message}
          </p>
        </div>
      ),
      sortable: true,
      sortKey: 'message'
    },
    {
      header: 'Method',
      accessor: (reminder) => (
        <div className="flex items-center">
          <MessageCircle className={`h-4 w-4 mr-2 ${
            reminder.send_via_whatsapp && reminder.whatsapp_opt_in 
              ? 'text-green-500' 
              : 'text-gray-400'
          }`} />
          <span className="text-sm text-gray-600">
            {reminder.send_via_whatsapp ? (
              reminder.whatsapp_opt_in ? 'WhatsApp' : 'WhatsApp (Not opted in)'
            ) : 'System Only'}
          </span>
        </div>
      ),
      sortable: true,
      sortKey: 'send_via_whatsapp'
    },
    {
      header: 'Status',
      accessor: (reminder) => (
        <div className="flex items-center">
          {getStatusIcon(reminder.status)}
          <span
            className={`ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
              reminder.status === 'sent'
                ? 'bg-green-100 text-green-800'
                : reminder.status === 'failed'
                ? 'bg-red-100 text-red-800'
                : 'bg-yellow-100 text-yellow-800'
            }`}
          >
            {reminder.status}
          </span>
        </div>
      ),
      sortable: true,
      sortKey: 'status'
    },
    {
      header: 'Scheduled',
      accessor: (reminder) => (
        <div className="text-sm text-gray-900">
          {formatDate(reminder.scheduled_date)}
          {reminder.sent_date && (
            <div className="text-xs text-gray-500">
              Sent: {formatDate(reminder.sent_date)}
            </div>
          )}
        </div>
      ),
      sortable: true,
      sortKey: 'scheduled_date'
    }
  ];

  // Create statistics items
  const statisticsItems: StatItem[] = [
    {
      title: 'Total Reminders',
      value: stats.totalReminders,
      icon: <MessageCircle className="h-5 w-5" />,
      color: 'blue'
    },
    {
      title: 'Pending',
      value: stats.pendingReminders,
      icon: <Clock className="h-5 w-5" />,
      color: 'yellow'
    },
    {
      title: 'Sent',
      value: stats.sentReminders,
      icon: <CheckCircle className="h-5 w-5" />,
      color: 'green'
    },
    {
      title: 'Failed',
      value: stats.failedReminders,
      icon: <XCircle className="h-5 w-5" />,
      color: 'red'
    }
  ];

  const renderRowActions = (reminder: Reminder) => (
    <div className="flex items-center space-x-2">
      {reminder.status === 'pending' && (
        <button
          onClick={() => handleSendReminder(reminder.id)}
          disabled={isSending === reminder.id}
          className="p-1 text-gray-400 hover:text-green-600 disabled:opacity-50"
          title="Send Now"
        >
          {isSending === reminder.id ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      )}
      
      <button
        onClick={() => handleDeleteReminder(reminder.id)}
        disabled={isDeleting === reminder.id}
        className="p-1 text-gray-400 hover:text-red-600 disabled:opacity-50"
        title="Delete"
      >
        {isDeleting === reminder.id ? (
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
            placeholder="Search reminders..."
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
          <option value="pending">Pending</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
        </select>
      </div>
      <div className="sm:w-48">
        <select
          className="input"
          value={filterState.whatsappOnly === null ? 'all' : String(filterState.whatsappOnly)}
          onChange={handleWhatsappFilterChange}
        >
          <option value="all">All Methods</option>
          <option value="1">WhatsApp Only</option>
          <option value="0">System Only</option>
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

  const pendingCount = stats.pendingReminders;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Reminders</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage client reminders and WhatsApp messages
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex space-x-3">
          {pendingCount > 0 && (
            <button
              onClick={handleBulkSend}
              disabled={isBulkSending}
              className="btn btn-secondary px-4 py-2 disabled:opacity-50"
            >
              {isBulkSending ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                  Sending...
                </div>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send All ({pendingCount})
                </>
              )}
            </button>
          )}
          <button
            onClick={handleAddReminder}
            className="btn btn-primary px-4 py-2"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Reminder
          </button>
        </div>
      </div>

      {/* Statistics */}
      <StatisticsPanel 
        stats={statisticsItems} 
        loading={isLoading}
      />

      {/* Reminders Table */}
      <DataTable
        columns={columns}
        data={reminders}
        pagination={pagination}
        isLoading={isLoading}
        sortState={sortState}
        filterState={filterState}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        onSortChange={handleSortChange}
        onFilterChange={handleFilterChange}
        onRefresh={loadData}
        keyField="id"
        renderRowActions={renderRowActions}
        renderFilters={renderFilters}
        emptyMessage={filterState.search || filterState.status !== 'all' || filterState.whatsappOnly !== null
          ? 'No reminders found matching your criteria'
          : 'No reminders yet. Add your first reminder to get started.'}
      />

      {/* Reminder Modal */}
      <Modal
        isOpen={showModal}
        onClose={handleModalClose}
        title={selectedReminder ? 'Edit Reminder' : 'Add New Reminder'}
        size="md"
      >
        <ReminderModal
          reminder={selectedReminder}
          clients={clients}
          onClose={handleModalClose}
          onSave={handleReminderSaved}
        />
      </Modal>

      {/* Confirm Delete Modal */}
      <Modal
        isOpen={confirmDeleteModal.show}
        onClose={() => setConfirmDeleteModal({show: false, reminderId: null})}
        title="Confirm Delete"
        size="sm"
        footer={
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setConfirmDeleteModal({show: false, reminderId: null})}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={confirmDeleteReminder}
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
          Are you sure you want to delete this reminder?
        </p>
        <p className="text-red-600 mt-2 text-sm">
          This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
};

export default RemindersPage;
