'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Settings2,
  Plus,
  Trash2,
  Edit,
  ChevronUp,
  ChevronDown,
  GripVertical,
  Star,
  StarOff,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';
import RoleGuard from '@/components/role-guard';

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: 'Text',
  textarea: 'Textarea',
  number: 'Number',
  date: 'Date',
  dropdown: 'Dropdown',
  checkbox: 'Checkbox',
  radio: 'Radio Button',
};

const FIELD_TYPE_COLORS: Record<string, string> = {
  text: 'bg-slate-100 text-slate-600',
  textarea: 'bg-blue-100 text-blue-700',
  number: 'bg-amber-100 text-amber-700',
  date: 'bg-teal-100 text-teal-700',
  dropdown: 'bg-purple-100 text-purple-700',
  checkbox: 'bg-emerald-100 text-emerald-700',
  radio: 'bg-indigo-100 text-indigo-700',
};

const EMPTY_FORM = {
  field_label: '',
  field_key: '',
  field_type: 'text',
  field_options: '',
  is_required: false,
};

function SupplierFieldsContent() {
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const userRole = (session?.user as any)?.role ?? '';
  const isMasterAdmin = userRole === 'master_admin';

  const [showDialog, setShowDialog] = useState(false);
  const [editingField, setEditingField] = useState<any | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const { data: fields = [], isLoading } = useQuery({
    queryKey: ['supplier-fields-all'],
    queryFn: async () => {
      const res = await fetch('/api/supplier-fields?all=true');
      if (!res.ok) throw new Error('Failed to fetch fields');
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (body: any) => {
      const res = await fetch('/api/supplier-fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create field');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-fields-all'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-fields'] });
      toast.success('Field added successfully');
      closeDialog();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async (body: any) => {
      const res = await fetch('/api/supplier-fields', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update field');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-fields-all'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-fields'] });
      toast.success('Field updated');
      closeDialog();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch('/api/supplier-fields', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete field');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-fields-all'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-fields'] });
      toast.success('Field deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: number; is_active: boolean }) => {
      const res = await fetch('/api/supplier-fields', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to toggle field');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-fields-all'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-fields'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleRequired = useMutation({
    mutationFn: async ({ id, is_required }: { id: number; is_required: boolean }) => {
      const res = await fetch('/api/supplier-fields', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_required }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update required');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-fields-all'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-fields'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const reorderMutation = useMutation({
    mutationFn: async ({ id, sort_order }: { id: number; sort_order: number }) => {
      const res = await fetch('/api/supplier-fields', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, sort_order }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reorder');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-fields-all'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-fields'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openCreate = () => {
    setEditingField(null);
    setForm({ ...EMPTY_FORM });
    setShowDialog(true);
  };

  const openEdit = (field: any) => {
    setEditingField(field);
    const options = Array.isArray(field.field_options)
      ? field.field_options.join('\n')
      : typeof field.field_options === 'string'
        ? field.field_options
        : '';
    setForm({
      field_label: field.field_label,
      field_key: field.field_key,
      field_type: field.field_type,
      field_options: options,
      is_required: field.is_required,
    });
    setShowDialog(true);
  };

  const closeDialog = () => {
    setShowDialog(false);
    setEditingField(null);
    setForm({ ...EMPTY_FORM });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const optionsList = ['dropdown', 'radio', 'checkbox'].includes(form.field_type)
      ? form.field_options
          .split('\n')
          .map((o) => o.trim())
          .filter(Boolean)
      : null;

    const payload = {
      field_label: form.field_label,
      field_key: form.field_key,
      field_type: form.field_type,
      field_options: optionsList,
      is_required: form.is_required,
    };

    if (editingField) {
      updateMutation.mutate({ id: editingField.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleLabelChange = (label: string) => {
    const autoKey = label
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');
    setForm((f) => ({ ...f, field_label: label, field_key: editingField ? f.field_key : autoKey }));
  };

  const fieldList = fields as any[];

  const moveField = (field: any, direction: 'up' | 'down') => {
    const idx = fieldList.findIndex((f) => f.id === field.id);
    const swap = direction === 'up' ? fieldList[idx - 1] : fieldList[idx + 1];
    if (!swap) return;
    reorderMutation.mutate({ id: field.id, sort_order: swap.sort_order });
    reorderMutation.mutate({ id: swap.id, sort_order: field.sort_order });
  };

  const needsOptions = ['dropdown', 'radio', 'checkbox'].includes(form.field_type);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#344E41]/10 flex items-center justify-center">
              <Settings2 size={16} className="text-[#344E41]" />
            </div>
            <h2 className="text-2xl font-bold text-[#344E41]">Supplier Field Configuration</h2>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Configure dynamic fields that appear on all supplier forms
          </p>
        </div>
        <Button
          className="bg-[#344E41] hover:bg-[#3A5A40] self-start sm:self-auto"
          onClick={openCreate}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Field
        </Button>
      </div>

      {/* Info banner */}
      <div className="p-4 rounded-xl bg-[#344E41]/5 border border-[#344E41]/20 text-sm text-[#344E41]">
        <strong>How it works:</strong> Fields added here automatically appear on all supplier forms
        within assessments. No code changes required.{' '}
        {!isMasterAdmin && (
          <span className="text-slate-500">
            Master Admin can reorder and delete fields; Admins can add and edit.
          </span>
        )}
      </div>

      {/* Fields list */}
      {isLoading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Loading fields…</div>
      ) : fieldList.length === 0 ? (
        <Card className="border border-dashed border-slate-300 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
              <Settings2 size={24} className="text-slate-400" />
            </div>
            <div className="text-center">
              <p className="font-medium text-slate-700">No custom fields yet</p>
              <p className="text-sm text-slate-400 mt-1">
                Add fields to extend the supplier form with your organization's requirements
              </p>
            </div>
            <Button variant="outline" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add first field
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {fieldList.map((field: any, idx: number) => {
            const typeCls = FIELD_TYPE_COLORS[field.field_type] ?? 'bg-slate-100 text-slate-600';
            return (
              <Card
                key={field.id}
                className={`border shadow-sm transition-all ${field.is_active ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    {/* Drag handle / order indicator */}
                    <div className="flex flex-col items-center gap-0.5 text-slate-300 flex-shrink-0">
                      {isMasterAdmin && (
                        <button
                          onClick={() => moveField(field, 'up')}
                          disabled={idx === 0}
                          className="hover:text-[#344E41] disabled:opacity-30 transition"
                        >
                          <ChevronUp size={14} />
                        </button>
                      )}
                      <GripVertical size={14} />
                      {isMasterAdmin && (
                        <button
                          onClick={() => moveField(field, 'down')}
                          disabled={idx === fieldList.length - 1}
                          className="hover:text-[#344E41] disabled:opacity-30 transition"
                        >
                          <ChevronDown size={14} />
                        </button>
                      )}
                    </div>

                    {/* Field info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-800">{field.field_label}</span>
                        {field.is_required && (
                          <span className="text-[10px] font-bold text-red-500 uppercase tracking-wide">
                            Required
                          </span>
                        )}
                        {!field.is_active && (
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                            Hidden
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-[11px] text-slate-400 font-mono bg-slate-50 px-1.5 py-0.5 rounded">
                          {field.field_key}
                        </code>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${typeCls}`}
                        >
                          {FIELD_TYPE_LABELS[field.field_type] ?? field.field_type}
                        </span>
                        {field.field_options && (
                          <span className="text-[11px] text-slate-400">
                            {Array.isArray(field.field_options)
                              ? `${field.field_options.length} options`
                              : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {/* Toggle required */}
                      <button
                        title={field.is_required ? 'Mark as optional' : 'Mark as required'}
                        onClick={() =>
                          toggleRequired.mutate({ id: field.id, is_required: !field.is_required })
                        }
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-amber-500 hover:bg-amber-50 transition"
                      >
                        {field.is_required ? (
                          <Star size={15} className="text-amber-500 fill-amber-500" />
                        ) : (
                          <StarOff size={15} />
                        )}
                      </button>

                      {/* Toggle active */}
                      <button
                        title={field.is_active ? 'Hide field' : 'Show field'}
                        onClick={() =>
                          toggleMutation.mutate({ id: field.id, is_active: !field.is_active })
                        }
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-[#344E41] hover:bg-[#344E41]/5 transition"
                      >
                        {field.is_active ? <Eye size={15} /> : <EyeOff size={15} />}
                      </button>

                      {/* Edit */}
                      <button
                        title="Edit field"
                        onClick={() => openEdit(field)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-blue-500 hover:bg-blue-50 transition"
                      >
                        <Edit size={15} />
                      </button>

                      {/* Delete (master_admin only) */}
                      {isMasterAdmin && (
                        <button
                          title="Delete field"
                          onClick={() => {
                            if (confirm(`Delete field "${field.field_label}"?`)) {
                              deleteMutation.mutate(field.id);
                            }
                          }}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#344E41]">
              {editingField ? 'Edit Field' : 'Add New Field'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Field Label *</label>
              <Input
                value={form.field_label}
                onChange={(e) => handleLabelChange(e.target.value)}
                placeholder="e.g. Plantation Group"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Field Key *</label>
              <Input
                value={form.field_key}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    field_key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''),
                  }))
                }
                placeholder="e.g. plantation_group"
                required
                disabled={!!editingField}
              />
              <p className="text-[11px] text-slate-400">
                Auto-generated from label. Used as the data key. Cannot be changed after creation.
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Field Type *</label>
              <Select
                value={form.field_type}
                onValueChange={(v) => setForm((f) => ({ ...f, field_type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FIELD_TYPE_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {needsOptions && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Options *</label>
                <textarea
                  className="w-full min-h-[100px] rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#344E41]/30 resize-y"
                  placeholder="One option per line&#10;Option A&#10;Option B&#10;Option C"
                  value={form.field_options}
                  onChange={(e) => setForm((f) => ({ ...f, field_options: e.target.value }))}
                  required={needsOptions}
                />
                <p className="text-[11px] text-slate-400">Enter one option per line</p>
              </div>
            )}

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_required}
                onChange={(e) => setForm((f) => ({ ...f, is_required: e.target.checked }))}
                className="rounded border-slate-300 text-[#344E41] focus:ring-[#344E41]/30"
              />
              <span className="text-sm font-medium text-slate-700">Mark as required field</span>
            </label>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={closeDialog}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-[#344E41] hover:bg-[#3A5A40]"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending
                  ? 'Saving…'
                  : editingField
                    ? 'Save Changes'
                    : 'Add Field'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function SupplierFieldsPage() {
  return (
    <RoleGuard allowedRoles={['master_admin', 'admin']}>
      <SupplierFieldsContent />
    </RoleGuard>
  );
}
