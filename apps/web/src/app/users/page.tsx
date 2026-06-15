'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Edit,
  UserX,
  UserCheck,
  Search,
  MoreVertical,
  Users,
  ShieldCheck,
  Shield,
  HardHat,
  Filter,
  X,
  Lock,
  Unlock,
  KeyRound,
  Eye,
  EyeOff,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { authClient } from '@/lib/auth-client';
import RoleGuard from '@/components/role-guard';

const ROLE_CONFIG: Record<string, { label: string; badge: string; icon: typeof Users }> = {
  master_admin: {
    label: 'Master Admin',
    badge: 'bg-red-100 text-red-700 border-red-200',
    icon: ShieldCheck,
  },
  admin: {
    label: 'Admin',
    badge: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: Shield,
  },
  mill_user: {
    label: 'Mill User',
    badge: 'bg-green-100 text-green-700 border-green-200',
    icon: HardHat,
  },
};

export default function UserManagement() {
  return (
    <RoleGuard allowedRoles={['master_admin', 'admin']}>
      <UserManagementContent />
    </RoleGuard>
  );
}

function UserManagementContent() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [resetUser, setResetUser] = useState<any>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [forceChange, setForceChange] = useState(true);
  const [showResetPw, setShowResetPw] = useState(false);

  const { data: session } = authClient.useSession();
  const currentUserRole = (session?.user as any)?.role || 'mill_user';

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await fetch('/api/users');
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    },
  });

  const { data: mills } = useQuery({
    queryKey: ['mills'],
    queryFn: async () => {
      const res = await fetch('/api/mills');
      if (!res.ok) throw new Error('Failed to fetch mills');
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (newUser: any) => {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create user');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User created successfully');
      setIsCreateOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async (updatedUser: any) => {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedUser),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update user');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User updated');
      setEditingUser(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch('/api/users/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset password');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Password reset successfully');
      setResetUser(null);
      setResetPassword('');
      setForceChange(true);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const filteredUsers = (users || []).filter((user: any) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleCreateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = Object.fromEntries(fd.entries());
    createMutation.mutate(data);
  };

  const handleUpdateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const vals = Object.fromEntries(fd.entries());
    updateMutation.mutate({
      ...vals,
      id: editingUser.id,
      mill_id: vals.mill_id === 'none' ? null : vals.mill_id,
    });
  };

  const handleResetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetUser || !resetPassword) return;
    resetPasswordMutation.mutate({
      user_id: resetUser.id,
      new_password: resetPassword,
      force_change: forceChange,
    });
  };

  const patchUser = (user: any, patch: Record<string, any>) => {
    updateMutation.mutate({ id: user.id, ...patch });
  };

  const totalUsers = (users || []).length;
  const activeUsers = (users || []).filter((u: any) => u.status === 'active' && !u.locked).length;
  const lockedUsers = (users || []).filter((u: any) => u.locked).length;
  const masterAdmins = (users || []).filter((u: any) => u.role === 'master_admin').length;
  const admins = (users || []).filter((u: any) => u.role === 'admin').length;
  const millUsers = (users || []).filter((u: any) => u.role === 'mill_user').length;

  const hasFilters = roleFilter !== 'all' || statusFilter !== 'all' || Boolean(searchTerm);

  // Determine what actions are allowed on a given user
  const canEdit = (target: any) => {
    if (currentUserRole === 'master_admin') return true;
    if (currentUserRole === 'admin' && target.role !== 'master_admin') return true;
    return false;
  };
  const canResetPassword = (target: any) => {
    if (currentUserRole === 'master_admin') return true;
    if (currentUserRole === 'admin' && target.role !== 'master_admin') return true;
    return false;
  };
  const canLock = (target: any) => canEdit(target);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#344E41]">User Management</h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Manage administrators, mill users, access and passwords
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#344E41] hover:bg-[#3A5A40] shadow-sm self-start sm:self-auto">
              <Plus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-[#344E41]">Create New User</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateSubmit} className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Full Name</label>
                <Input name="name" placeholder="Ahmad Razif bin Azmi" required />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Email Address</label>
                <Input name="email" type="email" placeholder="user@company.com" required />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Initial Password</label>
                <Input name="password" type="password" placeholder="Min. 8 characters" required />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Role</label>
                <Select name="role" defaultValue="mill_user">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currentUserRole === 'master_admin' && (
                      <SelectItem value="master_admin">Master Admin</SelectItem>
                    )}
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="mill_user">Mill User</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">
                  Associated Mill <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <Select name="mill_id">
                  <SelectTrigger>
                    <SelectValue placeholder="Assign to mill" />
                  </SelectTrigger>
                  <SelectContent>
                    {(mills || []).map((mill: any) => (
                      <SelectItem key={mill.id} value={mill.id.toString()}>
                        {mill.name} ({mill.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-[#344E41] hover:bg-[#3A5A40]"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? 'Creating…' : 'Create User'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          {
            label: 'Total Users',
            value: totalUsers,
            icon: Users,
            color: 'text-slate-600',
            bg: 'bg-slate-100',
          },
          {
            label: 'Active',
            value: activeUsers,
            icon: UserCheck,
            color: 'text-emerald-600',
            bg: 'bg-emerald-100',
          },
          {
            label: 'Locked',
            value: lockedUsers,
            icon: Lock,
            color: 'text-red-600',
            bg: 'bg-red-100',
          },
          {
            label: 'Master Admins',
            value: masterAdmins,
            icon: ShieldCheck,
            color: 'text-red-600',
            bg: 'bg-red-100',
          },
          {
            label: 'Admins',
            value: admins,
            icon: Shield,
            color: 'text-blue-600',
            bg: 'bg-blue-100',
          },
          {
            label: 'Mill Users',
            value: millUsers,
            icon: HardHat,
            color: 'text-[#344E41]',
            bg: 'bg-[#344E41]/10',
          },
        ].map((stat) => (
          <Card key={stat.label} className="border border-slate-200 shadow-sm">
            <CardContent className="p-3 flex items-center gap-2.5">
              <div className={`${stat.bg} p-2 rounded-lg flex-shrink-0`}>
                <stat.icon size={15} className={stat.color} />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold text-[#344E41]">{stat.value}</p>
                <p className="text-[11px] text-slate-500 leading-tight">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
          <Input
            placeholder="Search by name or email…"
            className="pl-10 border-slate-200"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-3 flex-wrap">
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-40 border-slate-200">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="master_admin">Master Admin</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="mill_user">Mill User</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 border-slate-200">
              <SelectValue placeholder="All status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setSearchTerm('');
                setRoleFilter('all');
                setStatusFilter('all');
              }}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Users table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="text-slate-400 text-sm">Loading users…</div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <Users size={32} className="text-slate-300" />
            <p className="text-sm text-slate-400">
              {hasFilters ? 'No users match your filters' : 'No users found'}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="font-semibold text-slate-600">Name</TableHead>
                <TableHead className="font-semibold text-slate-600">Email</TableHead>
                <TableHead className="font-semibold text-slate-600">Role</TableHead>
                <TableHead className="font-semibold text-slate-600">Mill</TableHead>
                <TableHead className="font-semibold text-slate-600">Status</TableHead>
                <TableHead className="text-right font-semibold text-slate-600">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user: any) => {
                const roleConf = ROLE_CONFIG[user.role] || ROLE_CONFIG.mill_user;
                const RoleIcon = roleConf.icon;
                const isLocked = user.locked;
                const isInactive = user.status === 'inactive';
                const forceChangePending = user.force_password_change;
                return (
                  <TableRow
                    key={user.id}
                    className={`hover:bg-slate-50/80 transition-colors ${isLocked ? 'opacity-70' : ''}`}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0 ${isLocked ? 'bg-red-100 text-red-600' : 'bg-[#344E41]/10 text-[#344E41]'}`}
                        >
                          {isLocked ? (
                            <Lock size={14} />
                          ) : (
                            user.name?.charAt(0)?.toUpperCase() || '?'
                          )}
                        </div>
                        <div>
                          <span className="font-medium text-slate-800">{user.name}</span>
                          {forceChangePending && (
                            <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700">
                              <RefreshCw size={9} />
                              Must change pw
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm">{user.email}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${roleConf.badge}`}
                      >
                        <RoleIcon size={11} />
                        {roleConf.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm">
                      {user.mill_name || (
                        <span className="text-slate-300 italic">Not assigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isLocked ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                          <Lock size={10} /> Locked
                        </span>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${isInactive ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100 text-emerald-700'}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${isInactive ? 'bg-slate-400' : 'bg-emerald-500'}`}
                          />
                          {isInactive ? 'Inactive' : 'Active'}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {canEdit(user) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-slate-400 hover:text-slate-600"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            {/* Edit */}
                            <DropdownMenuItem
                              className="cursor-pointer"
                              onClick={() => setEditingUser(user)}
                            >
                              <Edit className="mr-2 h-4 w-4 text-slate-400" />
                              Edit Details
                            </DropdownMenuItem>

                            {/* Reset Password */}
                            {canResetPassword(user) && (
                              <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={() => {
                                  setResetUser(user);
                                  setResetPassword('');
                                  setForceChange(true);
                                  setShowResetPw(false);
                                }}
                              >
                                <KeyRound className="mr-2 h-4 w-4 text-amber-500" />
                                <span className="text-amber-700">Reset Password</span>
                              </DropdownMenuItem>
                            )}

                            <DropdownMenuSeparator />

                            {/* Lock / Unlock */}
                            {canLock(user) && (
                              <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={() => patchUser(user, { locked: !isLocked })}
                              >
                                {isLocked ? (
                                  <>
                                    <Unlock className="mr-2 h-4 w-4 text-emerald-500" />
                                    <span className="text-emerald-700">Unlock Account</span>
                                  </>
                                ) : (
                                  <>
                                    <Lock className="mr-2 h-4 w-4 text-red-400" />
                                    <span className="text-red-600">Lock Account</span>
                                  </>
                                )}
                              </DropdownMenuItem>
                            )}

                            {/* Activate / Deactivate */}
                            <DropdownMenuItem
                              className="cursor-pointer"
                              onClick={() =>
                                patchUser(user, { status: isInactive ? 'active' : 'inactive' })
                              }
                            >
                              {isInactive ? (
                                <>
                                  <UserCheck className="mr-2 h-4 w-4 text-emerald-500" />
                                  <span className="text-emerald-600">Activate</span>
                                </>
                              ) : (
                                <>
                                  <UserX className="mr-2 h-4 w-4 text-red-400" />
                                  <span className="text-red-600">Deactivate</span>
                                </>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        {filteredUsers.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50">
            <p className="text-xs text-slate-400">
              Showing {filteredUsers.length} of {totalUsers} user{totalUsers !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>

      {/* Edit user dialog */}
      {editingUser && (
        <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-[#344E41]">Edit User</DialogTitle>
            </DialogHeader>
            <div className="flex items-center gap-3 py-2 px-3 bg-slate-50 rounded-lg border border-slate-200 mb-2">
              <div className="w-9 h-9 rounded-full bg-[#344E41]/10 flex items-center justify-center text-[#344E41] font-bold">
                {editingUser.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div>
                <p className="font-medium text-slate-800">{editingUser.name}</p>
                <p className="text-xs text-slate-500">{editingUser.email}</p>
              </div>
            </div>
            <form onSubmit={handleUpdateSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Full Name</label>
                <Input name="name" defaultValue={editingUser.name} required />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Role</label>
                <Select name="role" defaultValue={editingUser.role}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currentUserRole === 'master_admin' && (
                      <SelectItem value="master_admin">Master Admin</SelectItem>
                    )}
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="mill_user">Mill User</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Status</label>
                <Select name="status" defaultValue={editingUser.status || 'active'}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Associated Mill</label>
                <Select name="mill_id" defaultValue={editingUser.mill_id?.toString() || 'none'}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select mill" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No mill assigned</SelectItem>
                    {(mills || []).map((mill: any) => (
                      <SelectItem key={mill.id} value={mill.id.toString()}>
                        {mill.name} ({mill.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setEditingUser(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-[#344E41] hover:bg-[#3A5A40]"
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Reset Password dialog */}
      {resetUser && (
        <Dialog open={!!resetUser} onOpenChange={() => setResetUser(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-[#344E41] flex items-center gap-2">
                <KeyRound size={18} className="text-amber-500" />
                Reset Password
              </DialogTitle>
            </DialogHeader>

            {/* Target user info */}
            <div className="flex items-center gap-3 py-2 px-3 bg-amber-50 rounded-lg border border-amber-200">
              <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold">
                {resetUser.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div>
                <p className="font-medium text-slate-800">{resetUser.name}</p>
                <p className="text-xs text-slate-500">{resetUser.email}</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-500 flex items-start gap-2">
              <AlertTriangle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <span>
                Set a temporary password. The user should change it immediately after logging in.
              </span>
            </div>

            <form onSubmit={handleResetSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Temporary Password *</label>
                <div className="relative">
                  <Input
                    type={showResetPw ? 'text' : 'password'}
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showResetPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition">
                <input
                  type="checkbox"
                  checked={forceChange}
                  onChange={(e) => setForceChange(e.target.checked)}
                  className="rounded border-slate-300 mt-0.5 flex-shrink-0"
                />
                <div>
                  <p className="text-sm font-medium text-slate-700">
                    Force password change at next login
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    User must set a new password before they can access the system
                  </p>
                </div>
              </label>

              <div className="flex gap-3 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setResetUser(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                  disabled={resetPasswordMutation.isPending || resetPassword.length < 8}
                >
                  {resetPasswordMutation.isPending ? 'Resetting…' : 'Reset Password'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
