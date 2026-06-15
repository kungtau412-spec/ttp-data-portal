'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  User,
  KeyRound,
  Eye,
  EyeOff,
  Save,
  CheckCircle,
  AlertTriangle,
  Factory,
  Shield,
  ShieldCheck,
  HardHat,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';

const ROLE_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  master_admin: {
    label: 'Master Admin',
    icon: ShieldCheck,
    color: 'text-red-600',
    bg: 'bg-red-100',
  },
  admin: { label: 'Admin', icon: Shield, color: 'text-blue-600', bg: 'bg-blue-100' },
  mill_user: { label: 'Mill User', icon: HardHat, color: 'text-[#344E41]', bg: 'bg-[#344E41]/10' },
};

function fmtDate(raw: string | null | undefined) {
  if (!raw) return '—';
  return raw.replace('T', ' ').slice(0, 16);
}

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();

  const [editName, setEditName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const res = await fetch('/api/profile');
      if (!res.ok) throw new Error('Failed to load profile');
      return res.json();
    },
  });

  const updateNameMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update name');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Name updated successfully');
      setIsEditingName(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (payload: { current_password: string; new_password: string }) => {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to change password');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Password changed successfully');
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleNameSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;
    updateNameMutation.mutate(editName.trim());
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== confirmPw) {
      toast.error('New passwords do not match');
      return;
    }
    if (newPw.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    changePasswordMutation.mutate({ current_password: currentPw, new_password: newPw });
  };

  const startEditName = () => {
    setEditName(profile?.name || session?.user?.name || '');
    setIsEditingName(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        Loading profile…
      </div>
    );
  }

  const roleConf = ROLE_CONFIG[profile?.role] || ROLE_CONFIG.mill_user;
  const RoleIcon = roleConf.icon;
  const initials =
    (profile?.name || '')
      .split(' ')
      .map((n: string) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?';

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-[#344E41]">My Profile</h2>
        <p className="text-slate-500 text-sm mt-1">
          View your account details and change your password
        </p>
      </div>

      {/* Force password change banner */}
      {profile?.force_password_change && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-300 rounded-xl text-sm text-amber-800">
          <AlertTriangle size={18} className="flex-shrink-0 mt-0.5 text-amber-600" />
          <div>
            <p className="font-semibold">Password change required</p>
            <p className="mt-0.5 text-amber-700">
              An administrator has reset your password and requires you to set a new one before
              continuing.
            </p>
          </div>
          <RefreshCw size={16} className="flex-shrink-0 text-amber-500 animate-spin" />
        </div>
      )}

      {/* Profile card */}
      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base text-[#344E41] flex items-center gap-2">
            <User size={16} className="text-[#588157]" />
            Account Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Avatar + name */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[#344E41] flex items-center justify-center text-white font-bold text-2xl flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              {isEditingName ? (
                <form onSubmit={handleNameSave} className="flex gap-2">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-9"
                    autoFocus
                    required
                  />
                  <Button
                    type="submit"
                    size="sm"
                    className="bg-[#344E41] hover:bg-[#3A5A40]"
                    disabled={updateNameMutation.isPending}
                  >
                    <Save size={14} />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setIsEditingName(false)}
                  >
                    Cancel
                  </Button>
                </form>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-lg font-bold text-slate-800">{profile?.name}</p>
                  <button
                    onClick={startEditName}
                    className="text-xs text-[#588157] hover:text-[#344E41] font-medium underline-offset-2 hover:underline"
                  >
                    Edit
                  </button>
                </div>
              )}
              <p className="text-sm text-slate-500 mt-0.5">{profile?.email}</p>
            </div>
          </div>

          <Separator />

          {/* Details grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {
                label: 'Role',
                value: (
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${roleConf.bg} ${roleConf.color}`}
                  >
                    <RoleIcon size={11} />
                    {roleConf.label}
                  </span>
                ),
              },
              {
                label: 'Status',
                value: (
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${profile?.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${profile?.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`}
                    />
                    {profile?.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                ),
              },
              {
                label: 'Assigned Mill',
                value: profile?.mill_name ? (
                  <span className="inline-flex items-center gap-1.5 text-sm text-slate-700">
                    <Factory size={13} className="text-[#588157]" />
                    {profile.mill_name}
                  </span>
                ) : (
                  <span className="text-slate-400 italic text-sm">Not assigned</span>
                ),
              },
              {
                label: 'Member Since',
                value: (
                  <span className="text-sm text-slate-700">{fmtDate(profile?.createdAt)}</span>
                ),
              },
            ].map((row) => (
              <div key={row.label}>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">
                  {row.label}
                </p>
                {row.value}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Change Password card */}
      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base text-[#344E41] flex items-center gap-2">
            <KeyRound size={16} className="text-[#588157]" />
            Change Password
          </CardTitle>
          <p className="text-xs text-slate-400">
            Enter your current password and choose a strong new one (min. 8 characters)
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            {/* Current password */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Current Password *</label>
              <div className="relative">
                <Input
                  type={showCurrentPw ? 'text' : 'password'}
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  placeholder="Enter your current password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* New password */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">New Password *</label>
              <div className="relative">
                <Input
                  type={showNewPw ? 'text' : 'password'}
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="Min. 8 characters"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {newPw.length > 0 && newPw.length < 8 && (
                <p className="text-xs text-red-500">Password must be at least 8 characters</p>
              )}
              {newPw.length >= 8 && (
                <p className="text-xs text-emerald-600 flex items-center gap-1">
                  <CheckCircle size={11} /> Password length OK
                </p>
              )}
            </div>

            {/* Confirm password */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Confirm New Password *</label>
              <div className="relative">
                <Input
                  type={showConfirmPw ? 'text' : 'password'}
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  placeholder="Repeat new password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {confirmPw.length > 0 && newPw !== confirmPw && (
                <p className="text-xs text-red-500">Passwords do not match</p>
              )}
              {confirmPw.length > 0 && newPw === confirmPw && newPw.length >= 8 && (
                <p className="text-xs text-emerald-600 flex items-center gap-1">
                  <CheckCircle size={11} /> Passwords match
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full bg-[#344E41] hover:bg-[#3A5A40]"
              disabled={
                changePasswordMutation.isPending ||
                !currentPw ||
                newPw.length < 8 ||
                newPw !== confirmPw
              }
            >
              {changePasswordMutation.isPending ? 'Changing password…' : 'Change Password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
