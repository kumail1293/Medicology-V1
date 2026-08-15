import React, { useState, useEffect } from 'react';
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
import { useAuth } from '@/lib/auth';

// Roles an admin can assign. Only a superadmin may grant/revoke admin roles;
// admins manage user/editor/teacher. Mirrors the backend whitelist.
const ASSIGNABLE_ROLES = ['user', 'editor', 'teacher', 'admin', 'superadmin'] as const;
const ADMIN_ROLES = ['admin', 'superadmin'];

const ROLE_STYLES: Record<string, string> = {
  user: 'bg-primary/10 text-primary',
  editor: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  teacher: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  admin: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  superadmin: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

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
  const { isSuperAdmin } = useAuth();

  // Roles this admin may actually assign (superadmin: all; admin: no admin roles).
  const assignableRoles = isSuperAdmin
    ? ASSIGNABLE_ROLES
    : ASSIGNABLE_ROLES.filter((r) => !ADMIN_ROLES.includes(r));

  // Quick role assignment straight from the table row.
  const handleRoleChange = async (user: AdminUser, role: string) => {
    if (role === user.role) return;
    if (!confirm(`Change ${user.name}'s role from ${user.role} to ${role}?`)) return;

    const previous = users;
    // Optimistic update.
    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role } : u)));
    try {
      const token = localStorage.getItem('medicology_token');
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update role');
      }
      toast({ title: 'Success', description: `Role updated to ${role}` });
    } catch (err) {
      console.error('Error updating role:', err);
      setUsers(previous);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to update role',
        variant: 'destructive',
      });
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('medicology_token');
      const params = new URLSearchParams({
        limit: pageSize.toString(),
        offset: ((currentPage - 1) * pageSize).toString(),
        search: searchQuery,
      });

      const response = await fetch(`/api/admin/users?${params}`, {
        headers: {
          'Content-Type': 'application/json',
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
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
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
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
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
                        <div className="flex items-center gap-2">
                          <span className={clsx(
                            'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium',
                            ROLE_STYLES[user.role] || ROLE_STYLES.user
                          )}>
                            <Shield size={12} />
                            {user.role.toUpperCase()}
                          </span>
                          <select
                            value={user.role}
                            onChange={(e) => void handleRoleChange(user, e.target.value)}
                            title={`Assign role for ${user.name}`}
                            className="rounded-md border border-border bg-background px-1.5 py-1 text-xs text-foreground outline-none hover:border-primary/40 focus:border-primary transition-colors"
                          >
                            {assignableRoles.map((r) => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        </div>
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
                    {assignableRoles.map((r) => (
                      <option key={r} value={r}>
                        {r.charAt(0).toUpperCase() + r.slice(1)}
                      </option>
                    ))}
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
    </div>
  );
}

export default UserManagementPage;
