'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authClient } from '@/lib/auth-client';
import { safeFormat } from '@/lib/date-utils';
import {
  Plus,
  FileText,
  Search,
  Filter,
  Archive,
  CheckCircle2,
  FileEdit,
  Calendar,
  Eye,
  X,
  MoreVertical,
  Send,
  GitBranch,
  Copy,
  Trash2,
  Sparkles,
  Download,
  ChevronRight,
  List,
  Hash,
  ToggleLeft,
  MapPin,
  Mail,
  AlignLeft,
  AlertCircle,
  ShieldX,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type Template = {
  id: number;
  name: string;
  year_id: number | null;
  year_name: number | null;
  version_number: number;
  status: 'draft' | 'published' | 'archived';
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
};

type AssessmentYear = {
  id: number;
  year: number;
  status: string;
};

// ─── Template structure preview data ─────────────────────────────────────────

const SDCP_PREVIEW = [
  {
    section: 'Supplier Information',
    description: 'Core supplier details for SDCP traceability & sustainability compliance.',
    fields: [
      {
        icon: List,
        label: 'Supplier Type',
        type: 'Dropdown',
        note: 'Required · Triggers dealer section',
      },
      { icon: FileText, label: 'Supplier Name', type: 'Short Text', note: 'Required' },
      { icon: FileText, label: 'Company Name', type: 'Short Text', note: '' },
      { icon: FileText, label: 'Parent Company Name', type: 'Short Text', note: '' },
      { icon: Hash, label: 'MPOB License Number', type: 'Short Text', note: 'Unique' },
      { icon: MapPin, label: 'Latitude', type: 'Number', note: '' },
      { icon: MapPin, label: 'Longitude', type: 'Number', note: '' },
      { icon: AlignLeft, label: 'Address', type: 'Long Text', note: '' },
      { icon: Mail, label: 'Email Address', type: 'Email', note: '' },
      { icon: Hash, label: 'Total Hectarage', type: 'Number', note: '' },
      { icon: Hash, label: 'Planted Hectarage', type: 'Number', note: '' },
      { icon: Hash, label: 'Total FFB Supplied', type: 'Number', note: '' },
      { icon: ToggleLeft, label: 'RSPO Certification', type: 'Yes / No', note: '' },
      { icon: ToggleLeft, label: 'MSPO Certification', type: 'Yes / No', note: '' },
      { icon: FileText, label: 'Other Certification', type: 'Short Text', note: '' },
    ],
  },
  {
    section: 'Dealer / Collection Centre Breakdown',
    description:
      'Individual FFB suppliers under a Dealer or Collection Centre. Shown conditionally.',
    fields: [
      { icon: FileText, label: 'FFB Supplier Name', type: 'Short Text', note: 'Required' },
      { icon: FileText, label: 'Company Name', type: 'Short Text', note: '' },
      { icon: Hash, label: 'MPOB License Number', type: 'Short Text', note: '' },
      { icon: MapPin, label: 'Latitude', type: 'Number', note: '' },
      { icon: MapPin, label: 'Longitude', type: 'Number', note: '' },
      { icon: AlignLeft, label: 'Address', type: 'Long Text', note: '' },
      { icon: FileText, label: 'District', type: 'Short Text', note: '' },
      { icon: ToggleLeft, label: 'Negligible Risk Area', type: 'Yes / No', note: '' },
      { icon: Hash, label: 'Total Hectarage', type: 'Number', note: '' },
      { icon: Hash, label: 'Planted Hectarage', type: 'Number', note: '' },
      { icon: Hash, label: 'Total FFB Supplied', type: 'Number', note: '' },
      { icon: ToggleLeft, label: 'MSPO Certification', type: 'Yes / No', note: '' },
      { icon: FileText, label: 'Other Certification', type: 'Short Text', note: '' },
    ],
  },
];

// ─── Seed dialog ──────────────────────────────────────────────────────────────

function SeedDefaultDialog({
  open,
  onOpenChange,
  onSeed,
  seeding,
  alreadyExists,
  existingTemplateId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSeed: (force: boolean) => void;
  seeding: boolean;
  alreadyExists: boolean;
  existingTemplateId: number | null;
}) {
  const router = useRouter();
  const [expandedSection, setExpandedSection] = useState<number | null>(0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 gap-0 overflow-hidden"
        style={{ maxWidth: '72vw', width: '72vw', maxHeight: '88vh' }}
      >
        {/* Header */}
        <div className="flex items-start gap-4 px-7 py-6 border-b border-slate-200 bg-gradient-to-r from-[#344E41]/5 to-transparent">
          <div className="w-11 h-11 rounded-xl bg-[#344E41]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Sparkles size={20} className="text-[#344E41]" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-slate-800">Default SDCP Assessment Template</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Pre-built template based on the standard Excel assessment format. Includes{' '}
              {SDCP_PREVIEW[0].fields.length + SDCP_PREVIEW[1].fields.length} fields across 2
              sections — fully editable after loading.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="flex-shrink-0 text-slate-400"
            onClick={() => onOpenChange(false)}
          >
            <X size={16} />
          </Button>
        </div>

        <div
          className="flex flex-1 min-h-0 overflow-hidden"
          style={{ height: 'calc(88vh - 180px)' }}
        >
          {/* Left: section tabs */}
          <div className="w-64 flex-shrink-0 border-r border-slate-100 bg-slate-50/60 overflow-y-auto">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Sections
              </p>
            </div>
            {SDCP_PREVIEW.map((section, i) => (
              <button
                key={i}
                onClick={() => setExpandedSection(i)}
                className={`w-full text-left px-4 py-3.5 border-b border-slate-100 transition ${
                  expandedSection === i
                    ? 'bg-[#344E41]/8 border-l-2 border-l-[#344E41]'
                    : 'hover:bg-white'
                }`}
              >
                <p
                  className={`text-sm font-semibold leading-tight ${expandedSection === i ? 'text-[#344E41]' : 'text-slate-700'}`}
                >
                  {section.section}
                </p>
                <p className="text-xs text-slate-400 mt-1">{section.fields.length} fields</p>
              </button>
            ))}

            {/* Conditional logic callout */}
            <div className="p-4">
              <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <GitBranch size={12} className="text-blue-500" />
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wide">
                    Conditional Logic
                  </p>
                </div>
                <p className="text-[11px] text-blue-700 leading-relaxed">
                  The <strong>Dealer / Collection Centre Breakdown</strong> section is shown only
                  when <strong>Supplier Type = Dealer</strong> or <strong>Collection Centre</strong>
                  .
                </p>
              </div>
            </div>
          </div>

          {/* Right: field list */}
          <div className="flex-1 overflow-y-auto">
            {expandedSection !== null && (
              <div className="p-6">
                <div className="mb-5">
                  <h3 className="text-base font-bold text-slate-800">
                    {SDCP_PREVIEW[expandedSection].section}
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    {SDCP_PREVIEW[expandedSection].description}
                  </p>
                </div>

                <div className="space-y-1.5">
                  {SDCP_PREVIEW[expandedSection].fields.map((field, fi) => {
                    const Icon = field.icon;
                    return (
                      <div
                        key={fi}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 bg-white"
                      >
                        <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <Icon size={13} className="text-slate-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800">{field.label}</p>
                          <p className="text-xs text-slate-400">{field.type}</p>
                        </div>
                        {field.note && (
                          <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#344E41]/8 text-[#344E41]">
                            {field.note}
                          </span>
                        )}
                        <span className="text-xs text-slate-300 flex-shrink-0 font-mono">
                          #{fi + 1}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-4 px-7 py-5 border-t border-slate-200 bg-white flex-shrink-0">
          {alreadyExists ? (
            <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <AlertCircle size={14} />
              <span>
                A default SDCP template already exists.{' '}
                {existingTemplateId && (
                  <button
                    className="font-semibold underline underline-offset-2"
                    onClick={() => {
                      onOpenChange(false);
                      router.push(`/templates/${existingTemplateId}`);
                    }}
                  >
                    Open it →
                  </button>
                )}
              </span>
            </div>
          ) : (
            <p className="text-xs text-slate-400">
              The template will be created as a <strong>Draft</strong>. You can edit, add fields,
              and publish it when ready.
            </p>
          )}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {alreadyExists ? (
              <Button
                className="bg-[#344E41] hover:bg-[#3A5A40]"
                onClick={() => onSeed(true)}
                disabled={seeding}
              >
                {seeding ? 'Creating…' : 'Create Duplicate'}
              </Button>
            ) : (
              <Button
                className="bg-[#344E41] hover:bg-[#3A5A40]"
                onClick={() => onSeed(false)}
                disabled={seeding}
              >
                <Download size={15} className="mr-1.5" />
                {seeding ? 'Loading Template…' : 'Load Default Template'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === 'published') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
        <CheckCircle2 size={10} /> Published
      </span>
    );
  }
  if (status === 'draft') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
        <FileEdit size={10} /> Draft
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
      <Archive size={10} /> Archived
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TemplatesPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const userRole = (session?.user as any)?.role ?? '';

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateYearId, setNewTemplateYearId] = useState('');
  const [seedDialogOpen, setSeedDialogOpen] = useState(false);

  const canCreate = ['master_admin', 'admin'].includes(userRole);
  const canArchive = userRole === 'master_admin';
  const isMillUser = userRole === 'mill_user';

  // ── Access Denied for Mill Users ─────────────────────────────────────────
  if (isMillUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
          <ShieldX size={36} className="text-red-500" />
        </div>
        <div className="text-center max-w-sm">
          <h2 className="text-xl font-bold text-slate-800 mb-2">Access Denied</h2>
          <p className="text-slate-500 text-sm">
            Insufficient permissions. TTP Templates are a system configuration module accessible
            only to Administrators.
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push('/mill/dashboard')}>
          Return to Dashboard
        </Button>
      </div>
    );
  }

  const {
    data: templates = [],
    isLoading,
    isError,
    error,
  } = useQuery<Template[]>({
    queryKey: ['templates', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      const res = await fetch(`/api/templates?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server error ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      return data.templates ?? [];
    },
  });

  // Check if default SDCP template exists
  const { data: seedStatus } = useQuery({
    queryKey: ['seed-status'],
    queryFn: async () => {
      const res = await fetch('/api/templates/seed-default');
      if (!res.ok) return { exists: false, template: null };
      return res.json();
    },
    enabled: canCreate,
  });

  const { data: years = [] } = useQuery<AssessmentYear[]>({
    queryKey: ['years'],
    queryFn: async () => {
      const res = await fetch('/api/years');
      if (!res.ok) throw new Error('Failed to fetch years');
      const data = await res.json();
      return data.years ?? [];
    },
    enabled: canCreate,
  });

  const createMutation = useMutation({
    mutationFn: async (payload: { name: string; year_id: number | null }) => {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create template');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Template created successfully');
      setCreateDialogOpen(false);
      setNewTemplateName('');
      setNewTemplateYearId('');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const seedMutation = useMutation({
    mutationFn: async (force: boolean) => {
      const res = await fetch(`/api/templates/seed-default${force ? '?force=true' : ''}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load default template');
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      queryClient.invalidateQueries({ queryKey: ['seed-status'] });
      setSeedDialogOpen(false);
      if (data.alreadyExists) {
        toast.info('Default template already exists');
      } else {
        toast.success('Default SDCP template loaded! Redirecting to editor…');
        if (data.template?.id) {
          router.push(`/templates/${data.template.id}`);
        }
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/templates/${id}/archive`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to archive template');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Template archived');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const publishMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/templates/${id}/publish`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to publish template');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Template published successfully');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const versionMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/templates/${id}/version`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create new version');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success('New draft version created');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const duplicateMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/templates/${id}/duplicate`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        // Prefer the detailed per-field message when available
        const msg = data.detail
          ? `${data.error}: ${data.detail}`
          : data.error || 'Failed to duplicate template';
        throw new Error(msg);
      }
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success(`Template duplicated as "${data.template?.name ?? 'Copy'}"`, {
        action: data.template?.id
          ? {
              label: 'Open',
              onClick: () => router.push(`/templates/${data.template.id}`),
            }
          : undefined,
      });
    },
    onError: (err: Error) => toast.error(err.message, { duration: 8000 }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete template');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Template deleted');
    },
    onError: (err: Error) => {
      if ((err as any).response?.status === 409) {
        toast.error('Template is in use and cannot be deleted.');
      } else {
        toast.error(err.message);
      }
    },
  });

  const recallMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/templates/${id}/recall`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to recall template');
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      if (data.linkedAssessments > 0) {
        toast.warning(data.message ?? 'Template recalled to draft.');
      } else {
        toast.success('Template recalled — status is now Draft.');
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleCreate = () => {
    if (!newTemplateName.trim()) {
      toast.error('Template name is required');
      return;
    }
    createMutation.mutate({
      name: newTemplateName,
      year_id: newTemplateYearId ? parseInt(newTemplateYearId) : null,
    });
  };

  const handleArchive = (id: number, name: string) => {
    if (!confirm(`Are you sure you want to archive "${name}"?`)) return;
    archiveMutation.mutate(id);
  };

  const handlePublish = (id: number, name: string) => {
    if (!confirm(`Publish "${name}"? It will be available for TTP Data entries.`)) return;
    publishMutation.mutate(id);
  };

  const handleVersion = (id: number, name: string) => {
    if (!confirm(`Create a new draft version of "${name}"?`)) return;
    versionMutation.mutate(id);
  };

  const handleRecall = (id: number, name: string) => {
    if (
      !confirm(
        `Recall publication of "${name}"?\n\nThe template will revert to Draft status. TTP Data entries already linked to this template will keep their connection and remain editable.`
      )
    )
      return;
    recallMutation.mutate(id);
  };

  const handleDuplicate = (id: number) => {
    duplicateMutation.mutate(id);
  };

  const handleDelete = (id: number, name: string) => {
    if (!confirm(`Permanently delete "${name}"? This cannot be undone.`)) return;
    deleteMutation.mutate(id);
  };

  const filtered = templates.filter((t) => t.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const counts = {
    all: templates.length,
    draft: templates.filter((t) => t.status === 'draft').length,
    published: templates.filter((t) => t.status === 'published').length,
    archived: templates.filter((t) => t.status === 'archived').length,
  };

  const sdcpExists = seedStatus?.exists ?? false;
  const sdcpTemplateId = seedStatus?.template?.id ?? null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#344E41]">TTP Templates</h2>
          <p className="text-slate-500 text-sm mt-0.5">
            {isMillUser
              ? 'View published TTP templates'
              : 'Manage TTP templates with sections and fields'}
          </p>
        </div>
        {canCreate && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* Load Default SDCP Template */}
            <Button
              variant="outline"
              onClick={() => setSeedDialogOpen(true)}
              className="border-[#344E41]/30 text-[#344E41] hover:bg-[#344E41]/5"
            >
              <Sparkles size={15} className="mr-1.5" />
              {sdcpExists ? 'SDCP Template' : 'Load Default Template'}
            </Button>
            <Button
              onClick={() => setCreateDialogOpen(true)}
              className="bg-[#344E41] hover:bg-[#3A5A40] shadow-sm"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Template
            </Button>
          </div>
        )}
      </div>

      {/* SDCP Quick-access banner — shown when it exists */}
      {canCreate && sdcpExists && sdcpTemplateId && (
        <div
          className="flex items-center justify-between gap-4 px-5 py-4 rounded-xl border border-[#344E41]/20 bg-gradient-to-r from-[#344E41]/5 to-transparent cursor-pointer group"
          onClick={() => router.push(`/templates/${sdcpTemplateId}`)}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#344E41]/10 flex items-center justify-center flex-shrink-0">
              <Sparkles size={16} className="text-[#344E41]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#344E41]">SDCP TTP Template</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Default template with {28} fields across 2 sections · Click to open
              </p>
            </div>
          </div>
          <ChevronRight
            size={18}
            className="text-[#344E41]/40 group-hover:text-[#344E41] transition"
          />
        </div>
      )}

      {/* Error banner */}
      {isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex flex-col gap-1">
          <p className="font-semibold text-red-700 text-sm">Failed to load templates</p>
          <p className="text-xs text-red-600">
            {(error as Error)?.message || 'An unexpected error occurred.'}
          </p>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { key: 'all', label: 'Total' },
          { key: 'draft', label: 'Draft' },
          { key: 'published', label: 'Published' },
          { key: 'archived', label: 'Archived' },
        ].map((stat) => (
          <Card
            key={stat.key}
            className={`border shadow-sm cursor-pointer transition-all ${statusFilter === stat.key ? 'border-[#344E41] ring-1 ring-[#344E41]/20' : 'border-slate-200 hover:border-slate-300'}`}
            onClick={() => setStatusFilter(stat.key)}
          >
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-[#344E41]">
                {counts[stat.key as keyof typeof counts]}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
          <Input
            placeholder="Search templates…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 border-slate-200"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44 border-slate-200">
            <Filter className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        {(searchTerm || statusFilter !== 'all') && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('all');
            }}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Templates list */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
            Loading templates…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4 px-6 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
              <FileText size={28} className="text-slate-300" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-600">
                {searchTerm || statusFilter !== 'all'
                  ? 'No templates match your filters'
                  : 'No templates yet'}
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                {!searchTerm && statusFilter === 'all' && canCreate
                  ? 'Start with the pre-built SDCP template or create a blank one from scratch.'
                  : 'Try adjusting your search or filter.'}
              </p>
            </div>
            {canCreate && !searchTerm && statusFilter === 'all' && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="bg-[#344E41] hover:bg-[#3A5A40]"
                  onClick={() => setSeedDialogOpen(true)}
                >
                  <Sparkles size={13} className="mr-1.5" />
                  Load Default SDCP Template
                </Button>
                <Button size="sm" variant="outline" onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Create Blank
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((template) => (
              <div
                key={template.id}
                className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/80 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-[#344E41]/10 flex items-center justify-center flex-shrink-0">
                  <FileText size={18} className="text-[#344E41]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                    <span className="font-semibold text-slate-800 truncate">{template.name}</span>
                    <StatusBadge status={template.status} />
                    <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                      v{template.version_number}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap">
                    {template.year_name && (
                      <span className="flex items-center gap-1">
                        <Calendar size={11} />
                        Year {template.year_name}
                      </span>
                    )}
                    <span>By {template.created_by_name || 'Unknown'}</span>
                    <span>Created {safeFormat(template.created_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {!isMillUser && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0 border-slate-200"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem asChild>
                          <Link href={`/templates/${template.id}`} className="cursor-pointer">
                            <FileEdit className="mr-2 h-4 w-4" />
                            Edit Template
                          </Link>
                        </DropdownMenuItem>
                        {template.status === 'draft' && (
                          <DropdownMenuItem
                            onClick={() => handlePublish(template.id, template.name)}
                            disabled={publishMutation.isPending}
                            className="cursor-pointer"
                          >
                            <Send className="mr-2 h-4 w-4" />
                            Publish
                          </DropdownMenuItem>
                        )}
                        {template.status === 'published' && (
                          <DropdownMenuItem
                            onClick={() => handleVersion(template.id, template.name)}
                            disabled={versionMutation.isPending}
                            className="cursor-pointer"
                          >
                            <GitBranch className="mr-2 h-4 w-4" />
                            Create New Version
                          </DropdownMenuItem>
                        )}
                        {template.status === 'published' && (
                          <DropdownMenuItem
                            onClick={() => handleRecall(template.id, template.name)}
                            disabled={recallMutation.isPending}
                            className="cursor-pointer text-amber-600 focus:text-amber-700"
                          >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Recall Publication
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => handleDuplicate(template.id)}
                          disabled={duplicateMutation.isPending}
                          className="cursor-pointer"
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          Duplicate
                        </DropdownMenuItem>
                        {template.status !== 'archived' && canArchive && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleArchive(template.id, template.name)}
                              disabled={archiveMutation.isPending}
                              className="cursor-pointer"
                            >
                              <Archive className="mr-2 h-4 w-4" />
                              Archive
                            </DropdownMenuItem>
                          </>
                        )}
                        {userRole === 'master_admin' && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDelete(template.id, template.name)}
                              disabled={deleteMutation.isPending}
                              className="cursor-pointer text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  {isMillUser && (
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="h-8 border-slate-200 text-slate-600 hover:border-[#344E41] hover:text-[#344E41]"
                    >
                      <Link href={`/templates/${template.id}`}>
                        <Eye className="mr-1.5 h-3.5 w-3.5" />
                        View
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50">
            <p className="text-xs text-slate-400">
              Showing {filtered.length} of {templates.length} template
              {templates.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>

      {/* ── Seed Default Dialog ── */}
      <SeedDefaultDialog
        open={seedDialogOpen}
        onOpenChange={setSeedDialogOpen}
        onSeed={(force) => seedMutation.mutate(force)}
        seeding={seedMutation.isPending}
        alreadyExists={sdcpExists}
        existingTemplateId={sdcpTemplateId}
      />

      {/* ── Create Template Dialog ── */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#344E41]">Create New Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Template Name *</Label>
              <Input
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="e.g., RSPO Assessment 2025"
              />
            </div>
            <div className="space-y-1.5">
              <Label>
                TTP Year <span className="text-slate-400 font-normal">(optional)</span>
              </Label>
              <Select value={newTemplateYearId} onValueChange={setNewTemplateYearId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {(years as AssessmentYear[]).map((year) => (
                    <SelectItem key={year.id} value={year.id.toString()}>
                      {year.year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setCreateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-[#344E41] hover:bg-[#3A5A40]"
                onClick={handleCreate}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? 'Creating…' : 'Create Template'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
