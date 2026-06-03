import React, { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { useToast } from '@/hooks/use-toast';
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Shield,
  User,
  Lock,
} from 'lucide-react';
import { clsx } from 'clsx';

interface AdminUser {
  id: number;
  name: string;
  email: string;
  college: string;
  year: number;
  role: string;
  isAdmin: boolean;
  createdAt: string;
}

function UserManagementPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('view');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    college: '',
    year: 1,
    role: 'user',
    password: '',
  });
  const { toast } = useToast();

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('medicology_token');
      const params = new URLSearchParams({
        limit: pageSize.toString(),
        offset: ((currentPage - 1) * pageSize).toString(),
        search: searchQuery,
      });

      const response = await fetch(`http://localhost:5000/api/admin/users?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      setUsers(data.users || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Error fetching users:', err);
      toast({
        title: 'Error',
        description: 'Failed to load users',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
      fetchUsers();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    fetchUsers();
  }, [currentPage]);

  const handleCreateUser = async () => {
    try {
      const token = localStorage.getItem('medicology_token');
      const response = await fetch('http://localhost:5000/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to create user');
      }

      toast({
        title: 'Success',
        description: 'User created successfully',
      });

      setShowModal(false);
      resetForm();
      fetchUsers();
    } catch (err) {
      console.error('Error creating user:', err);
      toast({
        title: 'Error',
        description: 'Failed to create user',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;

    try {
      const token = localStorage.getItem('medicology_token');
      const response = await fetch(`http://localhost:5000/api/admin/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to update user');
      }

      toast({
        title: 'Success',
        description: 'User updated successfully',
      });

      setShowModal(false);
      resetForm();
      fetchUsers();
    } catch (err) {
      console.error('Error updating user:', err);
      toast({
        title: 'Error',
        description: 'Failed to update user',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      const token = localStorage.getItem('medicology_token');
      const response = await fetch(`http://localhost:5000/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete user');
      }

      toast({
        title: 'Success',
        description: 'User deleted successfully',
      });

      fetchUsers();
    } catch (err) {
      console.error('Error deleting user:', err);
      toast({
        title: 'Error',
        description: 'Failed to delete user',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      college: '',
      year: 1,
      role: 'user',
      password: '',
    });
    setSelectedUser(null);
  };

  const openEditModal = (user: AdminUser) => {
    setSelectedUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      college: user.college,
      year: user.year,
      role: user.role,
      password: '',
    });
    setModalMode('edit');
    setShowModal(true);
  };

  const openViewModal = (user: AdminUser) => {
    setSelectedUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      college: user.college,
      year: user.year,
      role: user.role,
      password: '',
    });
    setModalMode('view');
    setShowModal(true);
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <AdminLayout>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold mb-2">User Management</h2>
            <p className="text-muted-foreground">Manage all registered users and their roles</p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setModalMode('create');
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus size={18} />
            Create User
          </button>
        </div>

        {/* Search & Filter */}
        <div className="bg-card border border-border rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            <Search size={18} className="text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name, email, or college..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent border-0 outline-none text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading users...</div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No users found</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-6 py-3 text-left text-sm font-semibold text-muted-foreground">Name</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-muted-foreground">Email</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-muted-foreground">College</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-muted-foreground">Year</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-muted-foreground">Role</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-muted-foreground">Status</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                        <td className="px-6 py-4 text-sm font-medium">{user.name}</td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">{user.email}</td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">{user.college}</td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">Year {user.year}</td>
                        <td className="px-6 py-4 text-sm">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                            <Shield size={12} />
                            {user.role.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-500">
                            Active
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openViewModal(user)}
                              className="p-1 hover:bg-muted rounded transition-colors text-muted-foreground hover:text-foreground"
                              title="View"
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              onClick={() => openEditModal(user)}
                              className="p-1 hover:bg-muted rounded transition-colors text-muted-foreground hover:text-foreground"
                              title="Edit"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              className="p-1 hover:bg-destructive/10 rounded transition-colors text-muted-foreground hover:text-destructive"
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-border flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages} • Total: {total} users
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-2 hover:bg-muted rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-2 hover:bg-muted rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg shadow-lg max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-border">
              <h3 className="text-lg font-semibold">
                {modalMode === 'create' ? 'Create New User' : modalMode === 'edit' ? 'Edit User' : 'View User'}
              </h3>
            </div>

            <div className="px-6 py-4 space-y-4 max-h-96 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium mb-2">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  disabled={modalMode === 'view'}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground disabled:opacity-50"
                  placeholder="Full name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={modalMode === 'view'}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground disabled:opacity-50"
                  placeholder="email@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">College</label>
                <input
                  type="text"
                  value={formData.college}
                  onChange={(e) => setFormData({ ...formData, college: e.target.value })}
                  disabled={modalMode === 'view'}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground disabled:opacity-50"
                  placeholder="College name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Year</label>
                  <select
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                    disabled={modalMode === 'view'}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground disabled:opacity-50"
                  >
                    {[1, 2, 3, 4, 5, 6].map((y) => (
                      <option key={y} value={y}>
                        Year {y}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    disabled={modalMode === 'view'}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground disabled:opacity-50"
                  >
                    <option value="user">User</option>
                    <option value="editor">Editor</option>
                    <option value="teacher">Teacher</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              {modalMode === 'create' && (
                <div>
                  <label className="block text-sm font-medium mb-2">Password</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                    placeholder="Set password"
                  />
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="px-4 py-2 border border-border rounded-lg font-medium hover:bg-muted transition-colors"
              >
                {modalMode === 'view' ? 'Close' : 'Cancel'}
              </button>
              {modalMode !== 'view' && (
                <button
                  onClick={modalMode === 'create' ? handleCreateUser : handleUpdateUser}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
                >
                  {modalMode === 'create' ? 'Create' : 'Update'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

export default UserManagementPage;
