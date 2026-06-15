'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import {
  Plus,
  Trash2,
  Send,
  ChevronLeft,
  MapPin,
  Package,
  Upload,
  FileText,
  CheckCircle,
  RotateCcw,
  Users,
  AlertTriangle,
  Eye,
  X,
  Building2,
} from 'lucide-react';
import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';
import useUpload from '@/utils/useUpload';
import Link from 'next/link';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';

// Stable counter-based ID
let _rowCounter = 0;
function nextRowId(): string {
  _rowCounter += 1;
  return `row-${_rowCounter}`;
}

// Supplier types that require a breakdown table entry
const BREAKDOWN_TYPES = ['dealer', 'collection_centre'];

const STATUS_CONFIG: Record<string, { label: string; cls: string; bar: string }> = {
  draft: { label: 'Draft', cls: 'bg-slate-100 text-slate-600', bar: 'bg-slate-300' },
  submitted: { label: 'Submitted', cls: 'bg-blue-100 text-blue-700', bar: 'bg-blue-500' },
  under_review: { label: 'Under Review', cls: 'bg-amber-100 text-amber-700', bar: 'bg-amber-500' },
  reopened: { label: 'Reopened', cls: 'bg-orange-100 text-orange-700', bar: 'bg-orange-500' },
  approved: { label: 'Approved', cls: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-500' },
};

const SUPPLIER_TYPE_CONFIG: Record<string, { label: string; cls: string }> = {
  dealer: { label: 'Dealer', cls: 'bg-purple-100 text-purple-700' },
  collection_centre: { label: 'Collection Centre', cls: 'bg-blue-100 text-blue-700' },
  estate: { label: 'Estate', cls: 'bg-green-100 text-green-700' },
  smallholder: { label: 'Smallholder', cls: 'bg-amber-100 text-amber-700' },
  external_supplier: { label: 'External Supplier', cls: 'bg-rose-100 text-rose-700' },
  in_house: { label: 'In-House Plantation', cls: 'bg-teal-100 text-teal-700' },
};

const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

function fmtDate(raw: string | null | undefined): string {
  if (!raw) return '—';
  return raw.replace('T', ' ').slice(0, 16);
}

interface BreakdownRow {
  id: string;
  name: string;
  location: string;
  volume: string;
  remarks: string;
}
function makeRow(): BreakdownRow {
  return { id: nextRowId(), name: '', location: '', volume: '', remarks: '' };
}

const CERT_BADGE: Record<string, string> = {
  RSPO: 'bg-green-100 text-green-700',
  MSPO: 'bg-blue-100 text-blue-700',
  ISCC: 'bg-purple-100 text-purple-700',
  NONE: 'bg-slate-100 text-slate-500',
};

// Known DB column field keys
const DB_COLUMNS = new Set([
  'name',
  'type',
  'volume',
  'latitude',
  'longitude',
  'address',
  'city',
  'state',
  'country',
  'postal_code',
  'mpob_license',
  'certification_status',
  'contact_person',
  'contact_number',
  'email',
  'remarks',
]);

// Evaluates conditional logic for field visibility
function evaluateCondition(logic: any, formValues: Record<string, any>): boolean {
  if (!logic || !logic.show_if) return true;
  const { field_key, operator, value } = logic.show_if;
  const currentValue = formValues[field_key];

  if (operator === 'in') {
    return Array.isArray(value) && value.includes(currentValue);
  }
  if (operator === 'equals') {
    return currentValue === value;
  }
  return true;
}

export default function AssessmentDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: session } = authClient.useSession();
  const userRole = (session?.user as any)?.role ?? '';
  const isAdmin = ['master_admin', 'admin'].includes(userRole);
  const isMillUser = userRole === 'mill_user';

  const [activeTab, setActiveTab] = useState<'suppliers' | 'evidence' | 'summary'>('suppliers');

  // Dynamic form state
  const [showForm, setShowForm] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [breakdownRows, setBreakdownRows] = useState<BreakdownRow[]>([makeRow()]);
  const formRef = useRef<HTMLFormElement>(null);

  // File upload
  const [upload, { loading: uploading }] = useUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Recall + Request Reopen dialogs
  const [showReopenDialog, setShowReopenDialog] = useState(false);
  const [reopenReason, setReopenReason] = useState('');

  // Breakdown type-change confirmation dialog
  const [showBreakdownClearDialog, setShowBreakdownClearDialog] = useState(false);
  const [pendingTypeValue, setPendingTypeValue] = useState<string | null>(null);

  // Queries
  const { data: assessment, isLoading: loadingA } = useQuery({
    queryKey: ['assessment', id],
    queryFn: async () => {
      const res = await fetch(`/api/assessments/${id}`);
      if (!res.ok) throw new Error('Assessment not found');
      return res.json();
    },
  });

  const { data: suppliers = [], isLoading: loadingS } = useQuery({
    queryKey: ['suppliers', id],
    queryFn: async () => {
      const res = await fetch(`/api/suppliers?assessmentId=${id}`);
      if (!res.ok) throw new Error('Failed to load suppliers');
      return res.json();
    },
  });

  const { data: evidence = [], isLoading: loadingE } = useQuery({
    queryKey: ['evidence', id],
    queryFn: async () => {
      const res = await fetch(`/api/evidence?assessmentId=${id}`);
      if (!res.ok) throw new Error('Failed to load evidence');
      return res.json();
    },
  });

  // Mutations
  const addSupplierMutation = useMutation({
    mutationFn: async (body: any) => {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, assessment_id: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add supplier');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers', id] });
      queryClient.invalidateQueries({ queryKey: ['assessment', id] });
      toast.success('Supplier added');
      setShowForm(false);
      setFormValues({});
      setBreakdownRows([makeRow()]);
      formRef.current?.reset();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteSupplierMutation = useMutation({
    mutationFn: async (supplierId: number) => {
      const res = await fetch('/api/suppliers', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: supplierId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete supplier');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers', id] });
      queryClient.invalidateQueries({ queryKey: ['assessment', id] });
      toast.success('Supplier removed');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteEvidenceMutation = useMutation({
    mutationFn: async (evidenceId: number) => {
      const res = await fetch('/api/evidence', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: evidenceId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete file');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence', id] });
      queryClient.invalidateQueries({ queryKey: ['assessment', id] });
      toast.success('File removed');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const statusMutation = useMutation({
    mutationFn: async (status: string) => {
      const res = await fetch('/api/assessments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update status');
      return data;
    },
    onSuccess: (updatedAssessment, status) => {
      // Immediately update cache so UI reflects new status without waiting for refetch
      queryClient.setQueryData(['assessment', id], (old: any) =>
        old ? { ...old, ...updatedAssessment } : updatedAssessment
      );
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      if (status === 'submitted') {
        toast.success('TTP Data submitted for review!');
        router.push('/assessments');
      } else {
        const labels: Record<string, string> = {
          approved: 'TTP Data Approved ✓',
          reopened: 'TTP Data Reopened for editing',
          under_review: 'Moved to Under Review',
        };
        toast.success(labels[status] ?? `Status updated`);
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Recall: submitted → draft (mill user only)
  // Calls the per-assessment PATCH which returns the fully-hydrated assessment
  // (status + template sections/fields + mill/year joins) in one response.
  // We replace the cache entry wholesale — no spread-merge, no race condition.
  const recallMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/assessments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'recall' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to recall submission');
      return data;
    },
    onSuccess: (hydratedAssessment) => {
      // Wholesale replace — the server already embedded status:'draft' + template + joins
      queryClient.setQueryData(['assessment', id], hydratedAssessment);
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      toast.success('TTP Data recalled — you can continue editing.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Request Reopen: for approved assessments (mill user only)
  const reopenRequestMutation = useMutation({
    mutationFn: async (reason: string) => {
      const res = await fetch(`/api/assessments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request_reopen', reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit request');
      return data;
    },
    onSuccess: () => {
      setShowReopenDialog(false);
      setReopenReason('');
      toast.success('Reopen request sent to administrators.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Handlers
  const handleSupplierSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Separate DB columns and custom fields
    const dbData: Record<string, any> = {};
    const customFields: Record<string, any> = {};

    for (const [key, value] of Object.entries(formValues)) {
      if (DB_COLUMNS.has(key)) {
        dbData[key] = value;
      } else {
        customFields[key] = value;
      }
    }

    const needsBreakdown = BREAKDOWN_TYPES.includes(dbData.type);
    const filledBreakdown = breakdownRows.filter((r) => r.name.trim());

    // Validation: dealer / collection_centre must have ≥1 breakdown record
    if (needsBreakdown && filledBreakdown.length === 0) {
      toast.error(
        'At least one breakdown record (with a name) is required for Dealer / Collection Centre suppliers.'
      );
      return;
    }

    const breakdown = needsBreakdown ? filledBreakdown : [];

    addSupplierMutation.mutate({
      ...dbData,
      custom_fields: customFields,
      breakdown,
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('File type not allowed. Use PDF, JPG, PNG, XLSX, or DOCX.');
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      toast.error(`File too large. Max size is 20 MB. Your file is ${formatBytes(file.size)}.`);
      return;
    }

    toast.info('Uploading file…');
    const result = await upload({ file });
    if ('error' in result) {
      toast.error(result.error);
      return;
    }

    const saveRes = await fetch('/api/evidence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assessment_id: id,
        file_name: file.name,
        file_url: result.url,
        file_type: file.type,
        file_size: file.size,
      }),
    });
    if (!saveRes.ok) {
      const err = await saveRes.json();
      toast.error(err.error || 'Failed to save file record');
      return;
    }

    queryClient.invalidateQueries({ queryKey: ['evidence', id] });
    queryClient.invalidateQueries({ queryKey: ['assessment', id] });
    toast.success(`${file.name} uploaded`);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const updateBreakdownRow = (rowId: string, field: keyof BreakdownRow, value: string) => {
    setBreakdownRows((rows) => rows.map((r) => (r.id === rowId ? { ...r, [field]: value } : r)));
  };

  // Intercept type-field changes to warn before clearing breakdown records
  const updateFormValue = (key: string, value: any) => {
    if (key === 'type') {
      const currentType = formValues['type'] ?? '';
      const wasBreakdown = BREAKDOWN_TYPES.includes(currentType);
      const willBeBreakdown = BREAKDOWN_TYPES.includes(value);
      const hasFilledRows = breakdownRows.some((r) => r.name.trim());

      if (wasBreakdown && !willBeBreakdown && hasFilledRows) {
        // Stash the pending value and show the confirmation dialog
        setPendingTypeValue(value);
        setShowBreakdownClearDialog(true);
        return;
      }
    }
    setFormValues((prev) => ({ ...prev, [key]: value }));
  };

  // Confirm: apply the pending type change and wipe breakdown rows
  const confirmTypeChange = () => {
    if (pendingTypeValue !== null) {
      setFormValues((prev) => ({ ...prev, type: pendingTypeValue }));
      setBreakdownRows([makeRow()]);
      setPendingTypeValue(null);
    }
    setShowBreakdownClearDialog(false);
  };

  // Cancel: discard the pending type change, keep the current type and breakdown rows
  const cancelTypeChange = () => {
    setPendingTypeValue(null);
    setShowBreakdownClearDialog(false);
  };

  const resetForm = () => {
    setShowForm(false);
    setFormValues({});
    setBreakdownRows([makeRow()]);
    setShowBreakdownClearDialog(false);
    setPendingTypeValue(null);
    formRef.current?.reset();
  };

  // Render a single field based on its type
  const renderField = (field: any) => {
    const value = formValues[field.field_key] ?? field.default_value ?? '';
    const required = field.is_required;
    const readOnly = field.is_read_only;
    const visible =
      evaluateCondition(field.conditional_logic, formValues) && field.is_visible !== false;

    if (!visible) return null;

    const commonProps = {
      value,
      onChange: (e: any) => updateFormValue(field.field_key, e.target.value),
      required,
      disabled: readOnly,
      placeholder: field.placeholder || '',
    };

    switch (field.field_type) {
      case 'short_text':
      case 'email':
      case 'phone':
        return (
          <Input
            {...commonProps}
            type={
              field.field_type === 'email' ? 'email' : field.field_type === 'phone' ? 'tel' : 'text'
            }
            maxLength={field.max_length || undefined}
            minLength={field.min_length || undefined}
          />
        );

      case 'long_text':
        return (
          <Textarea
            {...commonProps}
            className="resize-y min-h-[70px]"
            maxLength={field.max_length || undefined}
            minLength={field.min_length || undefined}
          />
        );

      case 'number':
      case 'currency':
      case 'percentage':
        return (
          <Input
            {...commonProps}
            type="number"
            step="any"
            min={field.min_value ?? undefined}
            max={field.max_value ?? undefined}
          />
        );

      case 'date':
        return <Input {...commonProps} type="date" />;

      case 'dropdown':
        return (
          <Select
            value={value}
            onValueChange={(v) => updateFormValue(field.field_key, v)}
            required={required}
            disabled={readOnly}
          >
            <SelectTrigger>
              <SelectValue placeholder={field.placeholder || 'Select…'} />
            </SelectTrigger>
            <SelectContent>
              {(Array.isArray(field.field_options) ? field.field_options : []).map(
                (opt: string) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        );

      case 'radio':
        return (
          <div className="space-y-1">
            {(Array.isArray(field.field_options) ? field.field_options : []).map((opt: string) => (
              <label
                key={opt}
                className="flex items-center gap-2 cursor-pointer text-sm text-slate-700"
              >
                <input
                  type="radio"
                  name={`radio_${field.field_key}`}
                  value={opt}
                  checked={value === opt}
                  onChange={() => updateFormValue(field.field_key, opt)}
                  required={required}
                  disabled={readOnly}
                  className="border-slate-300"
                />
                {opt}
              </label>
            ))}
          </div>
        );

      case 'checkbox':
      case 'multiple_choice':
        return (
          <div className="space-y-1">
            {(Array.isArray(field.field_options) ? field.field_options : []).map((opt: string) => (
              <label
                key={opt}
                className="flex items-center gap-2 cursor-pointer text-sm text-slate-700"
              >
                <Checkbox
                  checked={(value || '').split(',').filter(Boolean).includes(opt)}
                  onCheckedChange={(checked) => {
                    const current = (value || '').split(',').filter(Boolean);
                    const updated = checked
                      ? [...current, opt]
                      : current.filter((x: string) => x !== opt);
                    updateFormValue(field.field_key, updated.join(','));
                  }}
                  disabled={readOnly}
                />
                {opt}
              </label>
            ))}
          </div>
        );

      case 'yes_no':
        return (
          <Select
            value={value}
            onValueChange={(v) => updateFormValue(field.field_key, v)}
            required={required}
            disabled={readOnly}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">Yes</SelectItem>
              <SelectItem value="no">No</SelectItem>
            </SelectContent>
          </Select>
        );

      case 'gps':
        return (
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="number"
              step="any"
              value={formValues[`${field.field_key}_lat`] ?? ''}
              onChange={(e) => updateFormValue(`${field.field_key}_lat`, e.target.value)}
              placeholder="Latitude"
              disabled={readOnly}
            />
            <Input
              type="number"
              step="any"
              value={formValues[`${field.field_key}_lng`] ?? ''}
              onChange={(e) => updateFormValue(`${field.field_key}_lng`, e.target.value)}
              placeholder="Longitude"
              disabled={readOnly}
            />
          </div>
        );

      default:
        return <Input {...commonProps} />;
    }
  };

  // Derived state
  if (loadingA) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        Loading TTP Data…
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertTriangle size={32} className="text-red-400" />
        <p className="text-slate-500">TTP Data entry not found.</p>
        <Button variant="outline" onClick={() => router.back()}>
          Go back
        </Button>
      </div>
    );
  }

  const isEditable = ['draft', 'reopened'].includes(assessment.status);
  const statusCfg = STATUS_CONFIG[assessment.status] ?? STATUS_CONFIG.draft;
  const supplierList = Array.isArray(suppliers) ? (suppliers as any[]) : [];
  const evidenceList = Array.isArray(evidence) ? (evidence as any[]) : [];
  const totalVolume = supplierList.reduce((s, sup) => s + Number(sup?.volume || 0), 0);
  const template = assessment?.template ?? null;
  const templateSections: any[] = Array.isArray(template?.sections) ? template.sections : [];
  const hasTemplate = templateSections.length > 0;

  // canAddSupplier: adding NEW suppliers needs both editable status AND a template.
  // Deleting / viewing EXISTING suppliers only requires isEditable (no template needed).
  const canAddSupplier = isEditable && hasTemplate;

  // Safe supplier category counts
  const supplierCounts = {
    smallholder: supplierList.filter((s: any) => s?.type === 'smallholder').length,
    dealer: supplierList.filter((s: any) => s?.type === 'dealer').length,
    collection_centre: supplierList.filter((s: any) => s?.type === 'collection_centre').length,
    estate: supplierList.filter((s: any) => s?.type === 'estate').length,
    external_supplier: supplierList.filter((s: any) => s?.type === 'external_supplier').length,
    in_house: supplierList.filter((s: any) => s?.type === 'in_house').length,
    certified: supplierList.filter(
      (s: any) => s?.certification_status && s.certification_status !== 'NONE'
    ).length,
    non_certified: supplierList.filter(
      (s: any) => !s?.certification_status || s.certification_status === 'NONE'
    ).length,
  };

  const TABS = [
    { key: 'suppliers', label: 'Suppliers', count: supplierList.length },
    { key: 'evidence', label: 'Evidence', count: evidenceList.length },
    { key: 'summary', label: 'Summary', count: null },
  ] as const;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Back nav */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="text-slate-500 hover:text-[#344E41] -ml-2"
        >
          <Link href="/assessments">
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back to TTP Data
          </Link>
        </Button>
      </div>

      {/* Assessment header card */}
      <div className="bg-[#344E41] rounded-2xl p-6 text-white shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
                <Building2 size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">{assessment.mill_name}</h1>
                <p className="text-[#A3B18A] text-sm font-mono">{assessment.mill_code}</p>
              </div>
            </div>
            <p className="text-[#A3B18A] text-sm mt-2">
              TTP Year: <strong className="text-white">{assessment.year}</strong>
            </p>
          </div>

          <div className="flex flex-col items-end gap-3">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${statusCfg.cls}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.bar}`} />
              {statusCfg.label}
            </span>

            {/* Action buttons */}
            <div className="flex gap-2 flex-wrap justify-end">
              {isEditable && (
                <Button
                  size="sm"
                  className="bg-white text-[#344E41] hover:bg-[#A3B18A] hover:text-[#344E41] font-semibold"
                  onClick={() => statusMutation.mutate('submitted')}
                  disabled={supplierList.length === 0 || statusMutation.isPending}
                >
                  <Send className="mr-1.5 h-4 w-4" />
                  Submit TTP Data
                </Button>
              )}

              {/* Mill User: Recall when submitted (not yet under review) */}
              {isMillUser && assessment.status === 'submitted' && (
                <Button
                  size="sm"
                  className="bg-amber-500 hover:bg-amber-600 text-white font-semibold"
                  onClick={() => {
                    if (
                      confirm('Recall this TTP Data submission? It will return to Draft status.')
                    ) {
                      recallMutation.mutate();
                    }
                  }}
                  disabled={recallMutation.isPending}
                >
                  <RotateCcw className="mr-1.5 h-4 w-4" />
                  {recallMutation.isPending ? 'Recalling…' : 'Recall TTP Data'}
                </Button>
              )}

              {/* Mill User: Approved — Request Reopen */}
              {isMillUser && assessment.status === 'approved' && (
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                  onClick={() => setShowReopenDialog(true)}
                >
                  <RotateCcw className="mr-1.5 h-4 w-4" />
                  Request Reopen
                </Button>
              )}

              {isAdmin && assessment.status === 'submitted' && (
                <>
                  <Button
                    size="sm"
                    className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold"
                    onClick={() => statusMutation.mutate('approved')}
                    disabled={statusMutation.isPending}
                  >
                    <CheckCircle className="mr-1.5 h-4 w-4" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    className="bg-amber-500 hover:bg-amber-600 text-white font-semibold"
                    onClick={() => statusMutation.mutate('under_review')}
                    disabled={statusMutation.isPending}
                  >
                    Mark Under Review
                  </Button>
                  <Button
                    size="sm"
                    className="bg-orange-500 hover:bg-orange-600 text-white font-semibold"
                    onClick={() => statusMutation.mutate('reopened')}
                    disabled={statusMutation.isPending}
                  >
                    <RotateCcw className="mr-1.5 h-4 w-4" />
                    Reopen TTP Data
                  </Button>
                </>
              )}
              {isAdmin && assessment.status === 'under_review' && (
                <>
                  <Button
                    size="sm"
                    className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold"
                    onClick={() => statusMutation.mutate('approved')}
                    disabled={statusMutation.isPending}
                  >
                    <CheckCircle className="mr-1.5 h-4 w-4" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    className="bg-orange-500 hover:bg-orange-600 text-white font-semibold"
                    onClick={() => statusMutation.mutate('reopened')}
                    disabled={statusMutation.isPending}
                  >
                    <RotateCcw className="mr-1.5 h-4 w-4" />
                    Reopen TTP Data
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Mini stat bar */}
        <div className="flex gap-6 mt-5 pt-5 border-t border-white/10">
          {[
            { label: 'Suppliers', value: supplierList.length },
            { label: 'Total Volume', value: `${totalVolume.toFixed(1)} MT` },
            { label: 'Evidence Files', value: evidenceList.length },
            { label: 'Created', value: fmtDate(assessment.created_at) },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-lg font-bold text-white">{s.value}</p>
              <p className="text-xs text-[#A3B18A]">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Template warning — only shown when assessment is editable but has no template */}
      {isEditable && !hasTemplate && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <AlertTriangle size={18} className="flex-shrink-0 mt-0.5 text-amber-500" />
          <div className="flex-1">
            <p className="font-semibold">No Published Template Available</p>
            <p className="mt-1 text-amber-700">
              {isAdmin
                ? 'No published assessment template was found. Please publish a template and assign it to this assessment year, then reload this page.'
                : 'Adding new supplier records is unavailable — no published template has been set up yet. Contact your administrator.'}
            </p>
            {isAdmin && (
              <div className="mt-3 flex items-center gap-2">
                <Button
                  size="sm"
                  asChild
                  className="bg-amber-600 hover:bg-amber-700 text-white border-0"
                >
                  <Link href="/templates">Manage Templates</Link>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  asChild
                  className="border-amber-300 text-amber-700 hover:bg-amber-100"
                >
                  <Link href="/years">Assign Template to Year</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Warnings */}
      {assessment.status === 'reopened' && (
        <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-xl text-sm text-orange-700">
          <AlertTriangle size={16} className="flex-shrink-0" />
          This TTP data entry has been reopened for editing. Please update and resubmit.
        </div>
      )}
      {isEditable && supplierList.length === 0 && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
          <AlertTriangle size={16} className="flex-shrink-0" />
          At least one supplier is required before you can submit TTP Data.
        </div>
      )}

      {/* Mill User: under review lock notice */}
      {isMillUser && assessment.status === 'under_review' && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <AlertTriangle size={16} className="flex-shrink-0 text-amber-500" />
          <div>
            <p className="font-semibold">TTP Data Under Review</p>
            <p className="text-xs text-amber-700 mt-0.5">
              This TTP data entry is currently under review by an administrator and cannot be
              recalled.
            </p>
          </div>
        </div>
      )}

      {/* Mill User: approved notice */}
      {isMillUser && assessment.status === 'approved' && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800">
          <CheckCircle size={16} className="flex-shrink-0 text-emerald-500" />
          <div>
            <p className="font-semibold">TTP Data Approved</p>
            <p className="text-xs text-emerald-700 mt-0.5">
              This TTP data entry has been approved. To request changes, use the &quot;Request
              Reopen&quot; button.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.key ? 'bg-[#344E41] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            {tab.label}
            {tab.count !== null && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* TAB: Suppliers */}
      {activeTab === 'suppliers' && (
        <div className="space-y-4">
          {/* Add supplier button — visible when editable, disabled only when no template */}
          {isEditable && !showForm && (
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => setShowForm(true)}
                className="border-[#344E41] text-[#344E41] hover:bg-[#344E41]/5 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!canAddSupplier}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Supplier
              </Button>
              {!hasTemplate && (
                <p className="text-xs text-amber-600 flex items-center gap-1.5">
                  <AlertTriangle size={12} />
                  No published template available — adding new suppliers is disabled.
                </p>
              )}
            </div>
          )}

          {/* Dynamic Supplier Form — requires both editable status and template */}
          {canAddSupplier && showForm && (
            <Card className="border border-[#A3B18A] shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base text-[#344E41]">New Supplier Entry</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-slate-400"
                    onClick={resetForm}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <form ref={formRef} onSubmit={handleSupplierSubmit} className="space-y-5">
                  {templateSections.map((section: any) => {
                    const sectionVisible = evaluateCondition(
                      section?.conditional_logic || {},
                      formValues
                    );
                    if (!sectionVisible) return null;

                    const sectionFields: any[] = Array.isArray(section?.fields)
                      ? section.fields
                      : [];
                    const visibleFields = sectionFields.filter(
                      (f: any) =>
                        f &&
                        evaluateCondition(f.conditional_logic, formValues) &&
                        f.is_visible !== false
                    );

                    if (visibleFields.length === 0) return null;

                    // Check if this is the dealer breakdown section
                    const isBreakdownSection = section.name
                      .toLowerCase()
                      .includes('dealer breakdown');

                    if (isBreakdownSection) {
                      // Only show breakdown table for Dealer / Collection Centre
                      const currentType = formValues['type'] ?? '';
                      if (!BREAKDOWN_TYPES.includes(currentType)) return null;

                      return (
                        <div key={section.id} className="space-y-3 pt-4 border-t border-slate-200">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-semibold text-[#344E41]">{section.name}</p>
                              {section.description && (
                                <p className="text-xs text-slate-500 mt-0.5">
                                  {section.description}
                                </p>
                              )}
                              <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
                                <AlertTriangle size={11} />
                                At least one breakdown record is required
                              </p>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setBreakdownRows((r) => [...r, makeRow()])}
                            >
                              <Plus className="mr-1 h-3.5 w-3.5" />
                              Add Row
                            </Button>
                          </div>

                          <div className="rounded-xl border border-slate-200 overflow-hidden">
                            <table className="w-full text-sm">
                              <thead className="bg-slate-50">
                                <tr>
                                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">
                                    Dealer Name *
                                  </th>
                                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">
                                    Location
                                  </th>
                                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">
                                    Volume (MT)
                                  </th>
                                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">
                                    Remarks
                                  </th>
                                  <th className="w-8" />
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {breakdownRows.map((row) => (
                                  <tr key={row.id}>
                                    <td className="px-2 py-1.5">
                                      <Input
                                        value={row.name}
                                        onChange={(e) =>
                                          updateBreakdownRow(row.id, 'name', e.target.value)
                                        }
                                        placeholder="Dealer name"
                                        className="h-8 text-xs border-slate-200"
                                      />
                                    </td>
                                    <td className="px-2 py-1.5">
                                      <Input
                                        value={row.location}
                                        onChange={(e) =>
                                          updateBreakdownRow(row.id, 'location', e.target.value)
                                        }
                                        placeholder="Location"
                                        className="h-8 text-xs border-slate-200"
                                      />
                                    </td>
                                    <td className="px-2 py-1.5">
                                      <Input
                                        value={row.volume}
                                        onChange={(e) =>
                                          updateBreakdownRow(row.id, 'volume', e.target.value)
                                        }
                                        type="number"
                                        step="any"
                                        placeholder="0.0"
                                        className="h-8 text-xs border-slate-200"
                                      />
                                    </td>
                                    <td className="px-2 py-1.5">
                                      <Input
                                        value={row.remarks}
                                        onChange={(e) =>
                                          updateBreakdownRow(row.id, 'remarks', e.target.value)
                                        }
                                        placeholder="Optional"
                                        className="h-8 text-xs border-slate-200"
                                      />
                                    </td>
                                    <td className="px-1 py-1.5">
                                      {breakdownRows.length > 1 && (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7 text-slate-400 hover:text-red-500"
                                          onClick={() =>
                                            setBreakdownRows((r) =>
                                              r.filter((x) => x.id !== row.id)
                                            )
                                          }
                                        >
                                          <X className="h-3.5 w-3.5" />
                                        </Button>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={section.id} className="space-y-4">
                        {section.description && (
                          <div>
                            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                              {section.name}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">{section.description}</p>
                          </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {visibleFields.map((field: any) => (
                            <div
                              key={field.id}
                              className={`space-y-1.5 ${field.field_type === 'long_text' ? 'sm:col-span-2' : ''}`}
                            >
                              <label className="text-sm font-medium text-slate-700">
                                {field.label}
                                {field.is_required && (
                                  <span className="text-red-500 ml-0.5">*</span>
                                )}
                              </label>
                              {field.help_text && (
                                <p className="text-xs text-slate-500">💡 {field.help_text}</p>
                              )}
                              {renderField(field)}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  <div className="flex gap-3 pt-2">
                    <Button type="button" variant="outline" className="flex-1" onClick={resetForm}>
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 bg-[#344E41] hover:bg-[#3A5A40]"
                      disabled={addSupplierMutation.isPending}
                    >
                      {addSupplierMutation.isPending ? 'Saving…' : 'Save Supplier'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Supplier list */}
          {loadingS ? (
            <div className="text-center py-12 text-slate-400 text-sm">Loading suppliers…</div>
          ) : supplierList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 bg-white rounded-xl border border-slate-200">
              <Users size={36} className="text-slate-300" />
              <p className="text-slate-400 text-sm">No suppliers added yet</p>
              {canAddSupplier && (
                <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Add first supplier
                </Button>
              )}
              {isEditable && !hasTemplate && (
                <p className="text-xs text-amber-600 text-center max-w-xs">
                  No published template is available. An admin must publish and assign a template
                  before suppliers can be added.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {supplierList.map((s: any) => {
                const typeCfg = SUPPLIER_TYPE_CONFIG[s.type] ?? {
                  label: s.type,
                  cls: 'bg-slate-100 text-slate-600',
                };
                const hasBreakdown = s.breakdown && s.breakdown.length > 0;
                return (
                  <Card key={s.id} className="border border-slate-200 shadow-sm">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <h3 className="font-semibold text-[#344E41] text-base">{s.name}</h3>
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-semibold ${typeCfg.cls}`}
                            >
                              {typeCfg.label}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                            {s.latitude && s.longitude && (
                              <span className="flex items-center gap-1">
                                <MapPin size={11} className="text-[#588157]" />
                                {Number(s.latitude).toFixed(4)}, {Number(s.longitude).toFixed(4)}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Package size={11} className="text-[#588157]" />
                              {Number(s.volume).toFixed(2)} MT
                            </span>
                            {s.certification_status && s.certification_status !== 'NONE' && (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${CERT_BADGE[s.certification_status] ?? 'bg-slate-100 text-slate-500'}`}
                              >
                                {s.certification_status}
                              </span>
                            )}
                          </div>
                          {(s.contact_person || s.contact_number || s.email || s.mpob_license) && (
                            <div className="flex flex-wrap gap-3 text-xs text-slate-400 mt-1">
                              {s.mpob_license && <span>MPOB: {s.mpob_license}</span>}
                              {s.contact_person && <span>📋 {s.contact_person}</span>}
                              {s.contact_number && <span>📞 {s.contact_number}</span>}
                              {s.email && <span>✉ {s.email}</span>}
                            </div>
                          )}
                        </div>
                        {isEditable && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-slate-300 hover:text-red-500 flex-shrink-0"
                            onClick={() => deleteSupplierMutation.mutate(s.id)}
                            disabled={deleteSupplierMutation.isPending}
                          >
                            <Trash2 size={16} />
                          </Button>
                        )}
                      </div>

                      {hasBreakdown && (
                        <div className="mt-4 pt-4 border-t border-slate-100">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                            Dealer Breakdown ({s.breakdown.length} entr
                            {s.breakdown.length === 1 ? 'y' : 'ies'})
                          </p>
                          <div className="rounded-lg overflow-hidden border border-slate-100">
                            <table className="w-full text-xs">
                              <thead className="bg-slate-50">
                                <tr>
                                  <th className="text-left px-3 py-2 font-semibold text-slate-500">
                                    Dealer
                                  </th>
                                  <th className="text-left px-3 py-2 font-semibold text-slate-500">
                                    Location
                                  </th>
                                  <th className="text-right px-3 py-2 font-semibold text-slate-500">
                                    Volume (MT)
                                  </th>
                                  <th className="text-left px-3 py-2 font-semibold text-slate-500">
                                    Remarks
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                {s.breakdown.map((b: any) => (
                                  <tr key={b.id} className="hover:bg-slate-50/50">
                                    <td className="px-3 py-2 font-medium text-slate-700">
                                      {b.name}
                                    </td>
                                    <td className="px-3 py-2 text-slate-500">
                                      {b.location || '—'}
                                    </td>
                                    <td className="px-3 py-2 text-right text-slate-700 tabular-nums">
                                      {Number(b.volume || 0).toFixed(2)}
                                    </td>
                                    <td className="px-3 py-2 text-slate-400">{b.remarks || '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB: Evidence */}
      {activeTab === 'evidence' && (
        <div className="space-y-4">
          {isEditable && (
            <Card className="border border-dashed border-[#A3B18A] bg-[#344E41]/3 shadow-sm">
              <CardContent className="p-6">
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="w-12 h-12 rounded-xl bg-[#344E41]/10 flex items-center justify-center">
                    <Upload size={22} className="text-[#344E41]" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-700">Upload Evidence Files</p>
                    <p className="text-xs text-slate-400 mt-1">
                      PDF, JPG, PNG, XLSX, DOCX — max 20 MB
                    </p>
                  </div>
                  <Button
                    type="button"
                    className="bg-[#344E41] hover:bg-[#3A5A40] mt-1"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploading ? 'Uploading…' : 'Choose File'}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png,.xlsx,.docx"
                    onChange={handleFileUpload}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {loadingE ? (
            <div className="text-center py-12 text-slate-400 text-sm">Loading evidence…</div>
          ) : evidenceList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 bg-white rounded-xl border border-slate-200">
              <FileText size={36} className="text-slate-300" />
              <p className="text-slate-400 text-sm">No evidence files uploaded yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {evidenceList.map((ev: any) => (
                <div
                  key={ev.id}
                  className="flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="w-10 h-10 rounded-lg bg-[#344E41]/10 flex items-center justify-center flex-shrink-0">
                    <FileText size={18} className="text-[#344E41]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 truncate text-sm">{ev.file_name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formatBytes(ev.file_size)} · {fmtDate(ev.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <a href={ev.file_url} target="_blank" rel="noreferrer">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-[#344E41]"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </a>
                    {isEditable && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-300 hover:text-red-500"
                        onClick={() => deleteEvidenceMutation.mutate(ev.id)}
                        disabled={deleteEvidenceMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: Summary */}
      {activeTab === 'summary' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="border border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-[#344E41]">TTP Data Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: 'Mill', value: assessment.mill_name },
                { label: 'Mill Code', value: assessment.mill_code },
                { label: 'Year', value: assessment.year },
                { label: 'Status', value: statusCfg.label },
                { label: 'Created', value: fmtDate(assessment.created_at) },
                { label: 'Submitted', value: fmtDate(assessment.submitted_at) },
                { label: 'Approved', value: fmtDate(assessment.approved_at) },
              ].map((row) => (
                <div key={row.label} className="flex justify-between text-sm">
                  <span className="text-slate-500">{row.label}</span>
                  <span className="font-medium text-slate-800">{row.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-[#344E41]">Supplier Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: 'Total Suppliers', value: supplierList.length },
                { label: 'Total Volume', value: `${totalVolume.toFixed(2)} MT` },
                { label: 'Smallholders', value: supplierCounts.smallholder },
                { label: 'Dealers', value: supplierCounts.dealer },
                { label: 'Collection Centres', value: supplierCounts.collection_centre },
                { label: 'Estates', value: supplierCounts.estate },
                { label: 'External Suppliers', value: supplierCounts.external_supplier },
                { label: 'In-House Plantation', value: supplierCounts.in_house },
                { label: 'Certified Suppliers', value: supplierCounts.certified },
                { label: 'Non-Certified', value: supplierCounts.non_certified },
                { label: 'Evidence Files', value: evidenceList.length },
              ].map((row) => (
                <div key={row.label} className="flex justify-between text-sm">
                  <span className="text-slate-500">{row.label}</span>
                  <span className="font-semibold text-[#344E41]">{row.value}</span>
                </div>
              ))}
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Breakdown Rows</span>
                <span className="font-semibold text-[#344E41]">
                  {supplierList.reduce(
                    (s: number, sup: any) => s + (sup?.breakdown?.length ?? 0),
                    0
                  )}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Breakdown Clear Confirmation Dialog ── */}
      {showBreakdownClearDialog && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-5 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={16} className="text-amber-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800 leading-tight">
                    Remove Breakdown Records?
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">This action cannot be undone</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-700 leading-relaxed">
                This supplier contains <strong>Dealer / Collection Centre Breakdown</strong>{' '}
                records. Changing the supplier type will remove all breakdown entries.
              </p>
              <p className="text-sm text-slate-700 mt-3">Do you want to continue?</p>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <Button variant="outline" className="flex-1" onClick={cancelTypeChange}>
                Cancel — keep breakdown
              </Button>
              <Button
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                onClick={confirmTypeChange}
              >
                Confirm — change type
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Request TTP Data Reopen Dialog ── */}
      {showReopenDialog && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-5 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
                  <RotateCcw size={16} className="text-blue-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800 leading-none">
                    Request TTP Data Reopen
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    An administrator will review your request
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">
                  Reason for reopening <span className="text-red-500">*</span>
                </label>
                <Textarea
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="Explain why this approved TTP data entry needs to be reopened for editing…"
                  rows={4}
                  className="resize-none"
                />
                <p className="text-xs text-slate-400">
                  This reason will be sent to administrators for approval.
                </p>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowReopenDialog(false);
                  setReopenReason('');
                }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                onClick={() => {
                  if (!reopenReason.trim()) {
                    toast.error('A reason is required');
                    return;
                  }
                  reopenRequestMutation.mutate(reopenReason);
                }}
                disabled={reopenRequestMutation.isPending}
              >
                {reopenRequestMutation.isPending ? 'Sending…' : 'Submit Request'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
