'use client';

import { useEffect, useState, use, useRef, useCallback } from 'react';
import { authClient } from '@/lib/auth-client';
import { safeFormat } from '@/lib/date-utils';
import {
  Plus,
  ArrowLeft,
  Layers,
  CheckCircle2,
  Archive,
  Trash2,
  Lock,
  GripVertical,
  Settings,
  Eye,
  Copy,
  MoveVertical,
  Edit,
  ChevronDown,
  ChevronUp,
  Hash,
  FileText,
  List,
  ToggleLeft,
  Calendar,
  Upload,
  Mail,
  Phone,
  MapPin,
  Type,
  AlignLeft,
  DollarSign,
  Percent,
  CheckSquare,
  CircleDot,
  Info,
  Shield,
  Sliders,
  GitBranch,
  X,
  AlertCircle,
  Asterisk,
  EyeOff,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────

type TemplateField = {
  id: number;
  section_id: number;
  label: string;
  field_key: string;
  field_type: string;
  is_required: boolean;
  is_unique: boolean;
  is_read_only: boolean;
  is_visible: boolean;
  max_length: number | null;
  min_length: number | null;
  min_value: number | null;
  max_value: number | null;
  validation_pattern: string | null;
  placeholder: string | null;
  help_text: string | null;
  field_options: string[];
  conditional_logic: any;
  sort_order: number;
};

type TemplateSection = {
  id: number;
  template_id: number;
  name: string;
  description: string | null;
  is_required: boolean;
  is_visible: boolean;
  is_editable: boolean;
  sort_order: number;
  fields: TemplateField[];
};

type Template = {
  id: number;
  name: string;
  year_id: number | null;
  year_name: number | null;
  version_number: number;
  status: string;
  created_by_name: string | null;
  created_at: string;
  sections: TemplateSection[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const FIELD_TYPES = [
  { value: 'short_text', label: 'Short Text', icon: Type, group: 'Text' },
  { value: 'long_text', label: 'Long Text', icon: AlignLeft, group: 'Text' },
  { value: 'number', label: 'Number', icon: Hash, group: 'Numeric' },
  { value: 'currency', label: 'Currency', icon: DollarSign, group: 'Numeric' },
  { value: 'percentage', label: 'Percentage', icon: Percent, group: 'Numeric' },
  { value: 'date', label: 'Date', icon: Calendar, group: 'Date & Time' },
  { value: 'dropdown', label: 'Dropdown', icon: List, group: 'Choice' },
  { value: 'multiple_choice', label: 'Multiple Choice', icon: CheckSquare, group: 'Choice' },
  { value: 'checkbox', label: 'Checkbox', icon: CheckSquare, group: 'Choice' },
  { value: 'radio', label: 'Radio Button', icon: CircleDot, group: 'Choice' },
  { value: 'yes_no', label: 'Yes / No', icon: ToggleLeft, group: 'Choice' },
  { value: 'gps', label: 'GPS Coordinates', icon: MapPin, group: 'Special' },
  { value: 'file_upload', label: 'File Upload', icon: Upload, group: 'Special' },
  { value: 'email', label: 'Email', icon: Mail, group: 'Contact' },
  { value: 'phone', label: 'Phone Number', icon: Phone, group: 'Contact' },
];

const CHOICE_TYPES = new Set(['dropdown', 'multiple_choice', 'checkbox', 'radio']);
const TEXT_TYPES = new Set(['short_text', 'long_text']);
const NUM_TYPES = new Set(['number', 'currency', 'percentage']);

function getFieldTypeIcon(fieldType: string) {
  const def = FIELD_TYPES.find((t) => t.value === fieldType);
  return def?.icon ?? FileText;
}

function getFieldTypeLabel(fieldType: string) {
  return FIELD_TYPES.find((t) => t.value === fieldType)?.label ?? fieldType;
}

// ─── Field preview ────────────────────────────────────────────────────────────

function QuestionPreview({ form }: { form: any }) {
  const Icon = getFieldTypeIcon(form.field_type);
  const label = form.label || 'Question Label';

  const renderInput = () => {
    switch (form.field_type) {
      case 'short_text':
        return (
          <input
            disabled
            placeholder={form.placeholder || 'Enter text…'}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-400"
          />
        );
      case 'long_text':
        return (
          <textarea
            disabled
            placeholder={form.placeholder || 'Enter detailed text…'}
            rows={3}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-400 resize-none"
          />
        );
      case 'number':
      case 'currency':
      case 'percentage':
        return (
          <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
            {form.field_type === 'currency' && (
              <span className="px-3 py-2 bg-slate-50 text-xs text-slate-400 border-r border-slate-200">
                RM
              </span>
            )}
            <input
              disabled
              type="number"
              placeholder={form.placeholder || '0'}
              className="flex-1 px-3 py-2 text-sm bg-white text-slate-400"
            />
            {form.field_type === 'percentage' && (
              <span className="px-3 py-2 bg-slate-50 text-xs text-slate-400 border-l border-slate-200">
                %
              </span>
            )}
          </div>
        );
      case 'date':
        return (
          <input
            disabled
            type="date"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-400"
          />
        );
      case 'email':
        return (
          <input
            disabled
            type="email"
            placeholder={form.placeholder || 'name@example.com'}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-400"
          />
        );
      case 'phone':
        return (
          <input
            disabled
            type="tel"
            placeholder={form.placeholder || '+60 12-345 6789'}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-400"
          />
        );
      case 'dropdown':
        return (
          <div className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-400 flex items-center justify-between">
            <span>
              {form.field_options.length > 0 ? form.field_options[0] : 'Select an option…'}
            </span>
            <ChevronDown size={14} className="text-slate-300" />
          </div>
        );
      case 'multiple_choice':
      case 'checkbox': {
        const opts =
          form.field_options.length > 0
            ? form.field_options.slice(0, 4)
            : ['Option 1', 'Option 2', 'Option 3'];
        return (
          <div className="space-y-2">
            {opts.map((opt: string, i: number) => (
              <label key={i} className="flex items-center gap-2.5 cursor-default">
                <div className="w-4 h-4 rounded border border-slate-300 bg-white flex-shrink-0" />
                <span className="text-sm text-slate-500">{opt}</span>
              </label>
            ))}
            {form.field_options.length > 4 && (
              <p className="text-xs text-slate-400 ml-6">
                +{form.field_options.length - 4} more options
              </p>
            )}
          </div>
        );
      }
      case 'radio': {
        const opts =
          form.field_options.length > 0
            ? form.field_options.slice(0, 4)
            : ['Option A', 'Option B', 'Option C'];
        return (
          <div className="space-y-2">
            {opts.map((opt: string, i: number) => (
              <label key={i} className="flex items-center gap-2.5 cursor-default">
                <div className="w-4 h-4 rounded-full border border-slate-300 bg-white flex-shrink-0" />
                <span className="text-sm text-slate-500">{opt}</span>
              </label>
            ))}
            {form.field_options.length > 4 && (
              <p className="text-xs text-slate-400 ml-6">
                +{form.field_options.length - 4} more options
              </p>
            )}
          </div>
        );
      }
      case 'yes_no':
        return (
          <div className="flex gap-3">
            <button
              disabled
              className="flex-1 border-2 border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-400 bg-white"
            >
              Yes
            </button>
            <button
              disabled
              className="flex-1 border-2 border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-400 bg-white"
            >
              No
            </button>
          </div>
        );
      case 'gps':
        return (
          <div className="grid grid-cols-2 gap-2">
            <input
              disabled
              placeholder="Latitude"
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-400"
            />
            <input
              disabled
              placeholder="Longitude"
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-400"
            />
          </div>
        );
      case 'file_upload':
        return (
          <div className="border-2 border-dashed border-slate-200 rounded-lg p-5 text-center">
            <Upload size={20} className="mx-auto mb-1.5 text-slate-300" />
            <p className="text-xs text-slate-400">Click to upload or drag and drop</p>
          </div>
        );
      default:
        return (
          <input
            disabled
            placeholder={form.placeholder || ''}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-400"
          />
        );
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100 bg-slate-50">
        <Eye size={14} className="text-slate-400" />
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Live Preview
        </span>
      </div>
      <div className="flex-1 p-5 overflow-y-auto">
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3 shadow-sm">
          {/* Type chip */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#344E41]/8 text-[#344E41] text-[10px] font-semibold tracking-wide">
              <Icon size={11} />
              {getFieldTypeLabel(form.field_type)}
            </div>
            {form.is_required && (
              <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-red-50 text-red-500 text-[10px] font-semibold">
                <Asterisk size={9} />
                Required
              </span>
            )}
            {form.is_read_only && (
              <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 text-[10px] font-semibold">
                <Lock size={9} />
                Read-only
              </span>
            )}
            {!form.is_visible && (
              <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 text-[10px] font-semibold">
                <EyeOff size={9} />
                Hidden
              </span>
            )}
          </div>

          {/* Label */}
          <div className="space-y-1">
            <label className="block text-sm font-semibold text-slate-700">
              {label}
              {form.is_required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {form.help_text && (
              <p className="flex items-start gap-1.5 text-xs text-slate-400">
                <Info size={11} className="mt-0.5 flex-shrink-0 text-blue-400" />
                {form.help_text}
              </p>
            )}
          </div>

          {/* Input */}
          {renderInput()}
        </div>

        {/* Metadata grid */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          {[
            { label: 'Field Key', value: form.field_key || '—' },
            { label: 'Unique', value: form.is_unique ? 'Yes' : 'No' },
            ...(TEXT_TYPES.has(form.field_type)
              ? [
                  { label: 'Min Length', value: form.min_length || '—' },
                  { label: 'Max Length', value: form.max_length || '—' },
                ]
              : []),
            ...(NUM_TYPES.has(form.field_type)
              ? [
                  { label: 'Min Value', value: form.min_value || '—' },
                  { label: 'Max Value', value: form.max_value || '—' },
                ]
              : []),
            ...(form.validation_pattern
              ? [{ label: 'Pattern', value: form.validation_pattern }]
              : []),
          ].map((item) => (
            <div
              key={item.label}
              className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-100"
            >
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                {item.label}
              </p>
              <p className="text-xs text-slate-600 font-mono mt-0.5 truncate">{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Question Builder Dialog ──────────────────────────────────────────────────

interface QuestionBuilderProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editingField: TemplateField | null;
  onSave: () => void;
  saving: boolean;
  form: any;
  setForm: (f: any) => void;
}

function SectionCard({
  icon: Icon,
  title,
  subtitle,
  accent,
  children,
}: {
  icon: any;
  title: string;
  subtitle?: string;
  accent?: string;
  children: React.ReactNode;
}) {
  const accentMap: Record<string, string> = {
    green: 'bg-[#344E41]/8 text-[#344E41]',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
    slate: 'bg-slate-100 text-slate-500',
    rose: 'bg-rose-50 text-rose-500',
  };
  const cls = accentMap[accent ?? 'slate'];
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50/60">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${cls}`}>
          <Icon size={14} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-700 leading-none">{title}</p>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function BehaviourRow({
  icon: Icon,
  label,
  description,
  checked,
  onChange,
  danger,
}: {
  icon: any;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5 border-b border-slate-100 last:border-0">
      <div className="flex items-start gap-3 min-w-0">
        <div className={`mt-0.5 flex-shrink-0 ${danger ? 'text-amber-400' : 'text-slate-400'}`}>
          <Icon size={14} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-700 leading-none">{label}</p>
          <p className="text-xs text-slate-400 mt-1">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} className="flex-shrink-0" />
    </div>
  );
}

function QuestionBuilderDialog({
  open,
  onOpenChange,
  editingField,
  onSave,
  saving,
  form,
  setForm,
}: QuestionBuilderProps) {
  const [newOption, setNewOption] = useState('');
  const newOptionRef = useRef<HTMLInputElement>(null);

  const isChoice = CHOICE_TYPES.has(form.field_type);
  const isText = TEXT_TYPES.has(form.field_type);
  const isNumeric = NUM_TYPES.has(form.field_type);

  const setField = (key: string, value: any) => setForm({ ...form, [key]: value });

  // Auto-generate field_key from label
  const handleLabelChange = (label: string) => {
    const autoKey = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    setForm({
      ...form,
      label,
      field_key: editingField ? form.field_key : autoKey,
    });
  };

  const addOption = () => {
    const val = newOption.trim();
    if (!val) return;
    setField('field_options', [...form.field_options, val]);
    setNewOption('');
    setTimeout(() => newOptionRef.current?.focus(), 50);
  };

  const removeOption = (i: number) =>
    setField(
      'field_options',
      form.field_options.filter((_: any, idx: number) => idx !== i)
    );

  const moveOption = (i: number, dir: -1 | 1) => {
    const next = [...form.field_options];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setField('field_options', next);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 gap-0 overflow-hidden"
        style={{ maxWidth: '82vw', width: '82vw', maxHeight: '90vh', height: '90vh' }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-slate-200 bg-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#344E41]/10 flex items-center justify-center">
              {editingField ? (
                <Edit size={16} className="text-[#344E41]" />
              ) : (
                <Plus size={16} className="text-[#344E41]" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 leading-none">
                {editingField ? 'Edit Question' : 'New Question'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {editingField ? `Editing: ${editingField.label}` : 'Configure your question below'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-[#344E41] hover:bg-[#3A5A40]"
              onClick={onSave}
              disabled={saving}
            >
              {saving ? 'Saving…' : editingField ? 'Save Changes' : 'Add Question'}
            </Button>
          </div>
        </div>

        {/* ── Body: Form (left) + Preview (right) ── */}
        <div className="flex flex-1 min-h-0">
          {/* Left: scrollable form */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/40">
            {/* 1. Basic Information */}
            <SectionCard
              icon={Info}
              title="Basic Information"
              subtitle="Define the question identity and type"
              accent="green"
            >
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 col-span-2">
                    <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Question Label <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      value={form.label}
                      onChange={(e) => handleLabelChange(e.target.value)}
                      placeholder="e.g., Supplier Name"
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Field Key <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      value={form.field_key}
                      onChange={(e) => setField('field_key', e.target.value)}
                      placeholder="supplier_name"
                      className="bg-white font-mono text-sm"
                    />
                    <p className="text-[11px] text-slate-400">
                      Unique identifier. Lowercase, underscores only.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Question Type <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={form.field_type}
                      onValueChange={(v) => {
                        const opts = CHOICE_TYPES.has(v) ? form.field_options : [];
                        setForm({ ...form, field_type: v, field_options: opts });
                      }}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {['Text', 'Numeric', 'Choice', 'Date & Time', 'Contact', 'Special'].map(
                          (group) => {
                            const items = FIELD_TYPES.filter((t) => t.group === group);
                            if (!items.length) return null;
                            return (
                              <div key={group}>
                                <div className="px-2 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                  {group}
                                </div>
                                {items.map((t) => (
                                  <SelectItem key={t.value} value={t.value}>
                                    <div className="flex items-center gap-2">
                                      <t.icon size={13} className="text-slate-400" />
                                      {t.label}
                                    </div>
                                  </SelectItem>
                                ))}
                              </div>
                            );
                          }
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* 2. Answer Options — only for choice types */}
            {isChoice && (
              <SectionCard
                icon={List}
                title="Answer Options"
                subtitle="Define the choices available to respondents"
                accent="blue"
              >
                <div className="space-y-3">
                  {/* Option list */}
                  {form.field_options.length > 0 ? (
                    <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                      {form.field_options.map((opt: string, i: number) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white group"
                        >
                          <GripVertical size={14} className="text-slate-300 flex-shrink-0" />
                          <span className="flex-1 text-sm text-slate-700">{opt}</span>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                            <button
                              onClick={() => moveOption(i, -1)}
                              disabled={i === 0}
                              className="p-1 rounded hover:bg-slate-100 text-slate-400 disabled:opacity-30"
                            >
                              <ChevronUp size={12} />
                            </button>
                            <button
                              onClick={() => moveOption(i, 1)}
                              disabled={i === form.field_options.length - 1}
                              className="p-1 rounded hover:bg-slate-100 text-slate-400 disabled:opacity-30"
                            >
                              <ChevronDown size={12} />
                            </button>
                            <button
                              onClick={() => removeOption(i)}
                              className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-3 rounded-lg border border-dashed border-slate-200 text-slate-400 text-xs">
                      <AlertCircle size={13} />
                      No options yet. Add your first option below.
                    </div>
                  )}
                  {/* Add option */}
                  <div className="flex gap-2">
                    <Input
                      ref={newOptionRef}
                      value={newOption}
                      onChange={(e) => setNewOption(e.target.value)}
                      placeholder="Type an option and press Enter or +"
                      className="bg-white text-sm flex-1"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addOption();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={addOption}
                      className="flex-shrink-0"
                    >
                      <Plus size={14} className="mr-1" />
                      Add
                    </Button>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {form.field_options.length} option{form.field_options.length !== 1 ? 's' : ''}{' '}
                    configured
                  </p>
                </div>
              </SectionCard>
            )}

            {/* 3. User Experience */}
            <SectionCard
              icon={Eye}
              title="User Experience"
              subtitle="Help text, placeholder, and guidance for respondents"
              accent="blue"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Help Text
                  </Label>
                  <Input
                    value={form.help_text}
                    onChange={(e) => setField('help_text', e.target.value)}
                    placeholder="Guidance shown below the question label"
                    className="bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Placeholder
                  </Label>
                  <Input
                    value={form.placeholder}
                    onChange={(e) => setField('placeholder', e.target.value)}
                    placeholder="e.g., Enter supplier name"
                    className="bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Default Value
                  </Label>
                  <Input
                    value={form.default_value}
                    onChange={(e) => setField('default_value', e.target.value)}
                    placeholder="Pre-filled value (optional)"
                    className="bg-white"
                  />
                </div>
              </div>
            </SectionCard>

            {/* 4. Validation */}
            <SectionCard
              icon={Shield}
              title="Validation"
              subtitle="Rules enforced when the form is submitted"
              accent="amber"
            >
              <div className="space-y-4">
                {isText && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Min Length
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        value={form.min_length}
                        onChange={(e) => setField('min_length', e.target.value)}
                        placeholder="0"
                        className="bg-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Max Length
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        value={form.max_length}
                        onChange={(e) => setField('max_length', e.target.value)}
                        placeholder="Unlimited"
                        className="bg-white"
                      />
                    </div>
                  </div>
                )}
                {isNumeric && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Minimum Value
                      </Label>
                      <Input
                        type="number"
                        value={form.min_value}
                        onChange={(e) => setField('min_value', e.target.value)}
                        placeholder="No minimum"
                        className="bg-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Maximum Value
                      </Label>
                      <Input
                        type="number"
                        value={form.max_value}
                        onChange={(e) => setField('max_value', e.target.value)}
                        placeholder="No maximum"
                        className="bg-white"
                      />
                    </div>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Validation Pattern{' '}
                    <span className="font-normal text-slate-400 normal-case">(Regex)</span>
                  </Label>
                  <Input
                    value={form.validation_pattern}
                    onChange={(e) => setField('validation_pattern', e.target.value)}
                    placeholder="e.g., ^[A-Z0-9-]+$ for uppercase alphanumeric"
                    className="bg-white font-mono text-sm"
                  />
                  <p className="text-[11px] text-slate-400">
                    Optional. Standard JavaScript regular expression applied on submit.
                  </p>
                </div>
              </div>
            </SectionCard>

            {/* 5. Behaviour */}
            <SectionCard
              icon={Sliders}
              title="Behaviour"
              subtitle="Control how this field functions in the form"
              accent="purple"
            >
              <div className="divide-y divide-slate-100">
                <BehaviourRow
                  icon={Asterisk}
                  label="Required"
                  description="Respondents must fill in this field before submitting."
                  checked={form.is_required}
                  onChange={(v) => setField('is_required', v)}
                />
                <BehaviourRow
                  icon={CheckCircle2}
                  label="Unique Value"
                  description="Each submission must have a different value for this field."
                  checked={form.is_unique}
                  onChange={(v) => setField('is_unique', v)}
                />
                <BehaviourRow
                  icon={Lock}
                  label="Read Only"
                  description="Field is visible but cannot be modified by the respondent."
                  checked={form.is_read_only}
                  onChange={(v) => setField('is_read_only', v)}
                  danger
                />
                <BehaviourRow
                  icon={Eye}
                  label="Visible"
                  description="Show this field on the form. Hidden fields can be used for logic."
                  checked={form.is_visible}
                  onChange={(v) => setField('is_visible', v)}
                />
              </div>
            </SectionCard>

            {/* 6. Conditional Logic */}
            <SectionCard
              icon={GitBranch}
              title="Conditional Logic"
              subtitle="Show or hide this field based on other answers"
              accent="slate"
            >
              <div className="flex flex-col items-center justify-center py-4 gap-2 text-center">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                  <GitBranch size={18} className="text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-500">Conditional logic coming soon</p>
                <p className="text-xs text-slate-400 max-w-xs">
                  Set rules to show or hide this question based on responses to other questions in
                  this template.
                </p>
              </div>
            </SectionCard>
          </div>

          {/* Right: live preview */}
          <div className="w-[340px] flex-shrink-0 border-l border-slate-200 bg-white flex flex-col overflow-hidden">
            <QuestionPreview form={form} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page entry ───────────────────────────────────────────────────────────────

export default function TemplateEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session } = authClient.useSession();
  const userRole = (session?.user as any)?.role ?? '';

  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);
  const autoSelectedRef = useRef(false);
  const duplicateCounterRef = useRef(1);

  // Section dialogs
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [editingSectionId, setEditingSectionId] = useState<number | null>(null);
  const [sectionForm, setSectionForm] = useState({ name: '', description: '' });
  const [savingSect, setSavingSect] = useState(false);

  // Question builder
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingField, setEditingField] = useState<TemplateField | null>(null);
  const [fieldForm, setFieldForm] = useState({
    label: '',
    field_key: '',
    field_type: 'short_text',
    is_required: false,
    is_unique: false,
    is_read_only: false,
    is_visible: true,
    max_length: '',
    min_length: '',
    min_value: '',
    max_value: '',
    validation_pattern: '',
    placeholder: '',
    default_value: '',
    help_text: '',
    field_options: [] as string[],
  });
  const [savingField, setSavingField] = useState(false);

  // Move question dialog
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [movingField, setMovingField] = useState<TemplateField | null>(null);
  const [targetSectionId, setTargetSectionId] = useState<string>('');

  // Preview dialog
  const [previewOpen, setPreviewOpen] = useState(false);

  const canEdit = ['master_admin', 'admin'].includes(userRole) && template?.status !== 'published';
  const canArchive = userRole === 'master_admin';

  const fetchTemplate = useCallback(async () => {
    try {
      const res = await fetch(`/api/templates/${id}`);
      if (!res.ok) throw new Error('Failed to fetch template');
      const data = await res.json();
      setTemplate(data.template);
      if (data.template.sections.length > 0 && !autoSelectedRef.current) {
        autoSelectedRef.current = true;
        setSelectedSectionId(data.template.sections[0].id);
      }
    } catch (error) {
      console.error('Error fetching template:', error);
      toast.error('Failed to load template');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTemplate();
  }, [fetchTemplate]);

  const handlePublish = async () => {
    if (!confirm('Publish this template? It will be available for TTP Data entries.')) return;
    try {
      const res = await fetch(`/api/templates/${id}/publish`, { method: 'POST' });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || 'Failed to publish');
      }
      toast.success('Template published');
      fetchTemplate();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleArchive = async () => {
    if (!confirm('Archive this template?')) return;
    try {
      const res = await fetch(`/api/templates/${id}/archive`, { method: 'POST' });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || 'Failed to archive');
      }
      toast.success('Template archived');
      fetchTemplate();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  // ── Section management ────────────────────────────────────────────────────

  const openSectionDialog = (section?: TemplateSection) => {
    setEditingSectionId(section ? section.id : null);
    setSectionForm({ name: section?.name ?? '', description: section?.description ?? '' });
    setSectionDialogOpen(true);
  };

  const handleSaveSection = async () => {
    if (!sectionForm.name.trim()) {
      toast.error('Section name is required');
      return;
    }
    setSavingSect(true);
    try {
      let res;
      if (editingSectionId) {
        res = await fetch(`/api/templates/${id}/sections/${editingSectionId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: sectionForm.name,
            description: sectionForm.description || null,
          }),
        });
      } else {
        res = await fetch(`/api/templates/${id}/sections`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: sectionForm.name,
            description: sectionForm.description || null,
          }),
        });
      }
      if (!res.ok) throw new Error('Failed to save section');
      const data = await res.json();
      toast.success(editingSectionId ? 'Section updated' : 'Section added');
      setSectionDialogOpen(false);
      fetchTemplate();
      if (!editingSectionId) setSelectedSectionId(data.section.id);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSavingSect(false);
    }
  };

  const handleDeleteSection = async (sectionId: number, sectionName: string) => {
    if (!confirm(`Delete section "${sectionName}"? All questions will be removed.`)) return;
    try {
      const res = await fetch(`/api/templates/${id}/sections/${sectionId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete section');
      toast.success('Section deleted');
      fetchTemplate();
      setSelectedSectionId(null);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleMoveSectionUp = async (index: number) => {
    if (!template || index === 0) return;
    const sections = [...template.sections];
    [sections[index - 1], sections[index]] = [sections[index], sections[index - 1]];
    await reorderSections(sections);
  };

  const handleMoveSectionDown = async (index: number) => {
    if (!template || index === template.sections.length - 1) return;
    const sections = [...template.sections];
    [sections[index], sections[index + 1]] = [sections[index + 1], sections[index]];
    await reorderSections(sections);
  };

  const reorderSections = async (sections: TemplateSection[]) => {
    try {
      const res = await fetch(`/api/templates/${id}/sections/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section_ids: sections.map((s) => s.id) }),
      });
      if (!res.ok) throw new Error('Failed to reorder sections');
      fetchTemplate();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  // ── Field management ──────────────────────────────────────────────────────

  const EMPTY_FORM = {
    label: '',
    field_key: '',
    field_type: 'short_text',
    is_required: false,
    is_unique: false,
    is_read_only: false,
    is_visible: true,
    max_length: '',
    min_length: '',
    min_value: '',
    max_value: '',
    validation_pattern: '',
    placeholder: '',
    default_value: '',
    help_text: '',
    field_options: [] as string[],
  };

  const openFieldBuilder = (field?: TemplateField) => {
    if (field) {
      setEditingField(field);
      setFieldForm({
        label: field.label,
        field_key: field.field_key,
        field_type: field.field_type,
        is_required: field.is_required,
        is_unique: field.is_unique,
        is_read_only: field.is_read_only,
        is_visible: field.is_visible ?? true,
        max_length: field.max_length?.toString() ?? '',
        min_length: field.min_length?.toString() ?? '',
        min_value: field.min_value?.toString() ?? '',
        max_value: field.max_value?.toString() ?? '',
        validation_pattern: field.validation_pattern ?? '',
        placeholder: field.placeholder ?? '',
        default_value: '',
        help_text: field.help_text ?? '',
        field_options: Array.isArray(field.field_options) ? field.field_options : [],
      });
    } else {
      setEditingField(null);
      setFieldForm(EMPTY_FORM);
    }
    setBuilderOpen(true);
  };

  const handleSaveField = async () => {
    if (!fieldForm.label || !fieldForm.field_key) {
      toast.error('Question label and field key are required');
      return;
    }
    setSavingField(true);
    try {
      const payload = {
        label: fieldForm.label,
        field_key: fieldForm.field_key,
        field_type: fieldForm.field_type,
        is_required: fieldForm.is_required,
        is_unique: fieldForm.is_unique,
        is_read_only: fieldForm.is_read_only,
        is_visible: fieldForm.is_visible,
        max_length: fieldForm.max_length ? parseInt(fieldForm.max_length) : null,
        min_length: fieldForm.min_length ? parseInt(fieldForm.min_length) : null,
        min_value: fieldForm.min_value ? parseFloat(fieldForm.min_value) : null,
        max_value: fieldForm.max_value ? parseFloat(fieldForm.max_value) : null,
        validation_pattern: fieldForm.validation_pattern || null,
        placeholder: fieldForm.placeholder || null,
        help_text: fieldForm.help_text || null,
        field_options: fieldForm.field_options,
        conditional_logic: {},
      };

      let res;
      if (editingField) {
        res = await fetch(`/api/templates/fields/${editingField.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/templates/${id}/sections/${selectedSectionId}/fields`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) throw new Error('Failed to save question');
      toast.success(editingField ? 'Question updated' : 'Question added');
      setBuilderOpen(false);
      fetchTemplate();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSavingField(false);
    }
  };

  const handleDeleteField = async (fieldId: number, fieldLabel: string) => {
    if (!confirm(`Delete question "${fieldLabel}"?`)) return;
    try {
      const res = await fetch(`/api/templates/fields/${fieldId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete question');
      toast.success('Question deleted');
      fetchTemplate();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDuplicateField = async (field: TemplateField) => {
    duplicateCounterRef.current += 1;
    try {
      const payload = {
        label: `${field.label} (Copy)`,
        field_key: `${field.field_key}_copy_${duplicateCounterRef.current}`,
        field_type: field.field_type,
        is_required: field.is_required,
        is_unique: false,
        is_read_only: field.is_read_only,
        is_visible: field.is_visible,
        max_length: field.max_length,
        min_length: field.min_length,
        min_value: field.min_value,
        max_value: field.max_value,
        validation_pattern: field.validation_pattern,
        placeholder: field.placeholder,
        help_text: field.help_text,
        field_options: field.field_options,
        conditional_logic: field.conditional_logic,
      };
      const res = await fetch(`/api/templates/${id}/sections/${field.section_id}/fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to duplicate question');
      toast.success('Question duplicated');
      fetchTemplate();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const openMoveDialog = (field: TemplateField) => {
    setMovingField(field);
    setTargetSectionId('');
    setMoveDialogOpen(true);
  };

  const handleMoveField = async () => {
    if (!movingField || !targetSectionId) {
      toast.error('Select a target section');
      return;
    }
    try {
      const res = await fetch(`/api/templates/fields/${movingField.id}/move`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section_id: parseInt(targetSectionId) }),
      });
      if (!res.ok) throw new Error('Failed to move question');
      toast.success('Question moved');
      setMoveDialogOpen(false);
      fetchTemplate();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleMoveFieldUp = async (sectionId: number, index: number) => {
    const section = template?.sections.find((s) => s.id === sectionId);
    if (!section || index === 0) return;
    const fields = [...section.fields];
    [fields[index - 1], fields[index]] = [fields[index], fields[index - 1]];
    await reorderFields(sectionId, fields);
  };

  const handleMoveFieldDown = async (sectionId: number, index: number) => {
    const section = template?.sections.find((s) => s.id === sectionId);
    if (!section || index === section.fields.length - 1) return;
    const fields = [...section.fields];
    [fields[index], fields[index + 1]] = [fields[index + 1], fields[index]];
    await reorderFields(sectionId, fields);
  };

  const reorderFields = async (sectionId: number, fields: TemplateField[]) => {
    try {
      const res = await fetch(`/api/templates/${id}/sections/${sectionId}/fields/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field_ids: fields.map((f) => f.id) }),
      });
      if (!res.ok) throw new Error('Failed to reorder questions');
      fetchTemplate();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading)
    return <div className="text-center py-12 text-slate-400 text-sm">Loading template…</div>;
  if (!template) return <div className="text-center py-12 text-slate-500">Template not found</div>;

  // Mill users have no access to the template editor
  if (userRole === 'mill_user') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
          <Shield size={36} className="text-red-500" />
        </div>
        <div className="text-center max-w-sm">
          <h2 className="text-xl font-bold text-slate-800 mb-2">Access Denied</h2>
          <p className="text-slate-500 text-sm">
            Insufficient permissions. TTP Templates are a system configuration module accessible
            only to Administrators and Master Administrators.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/mill/dashboard">Return to Dashboard</Link>
        </Button>
      </div>
    );
  }

  const selectedSection = template.sections.find((s) => s.id === selectedSectionId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <Link href="/templates">
              <Button variant="outline" size="sm">
                <ArrowLeft size={14} className="mr-1" />
                Back
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-[#344E41]">{template.name}</h1>
            <Badge
              className={
                template.status === 'published'
                  ? 'bg-green-100 text-green-800'
                  : template.status === 'archived'
                    ? 'bg-slate-100 text-slate-600'
                    : 'bg-amber-100 text-amber-800'
              }
            >
              {template.status}
            </Badge>
            <Badge variant="outline">v{template.version_number}</Badge>
          </div>
          <div className="text-sm text-slate-500">
            {template.year_name ? `TTP Year: ${template.year_name} • ` : ''}
            Created: {safeFormat(template.created_at)} • {template.created_by_name || 'Unknown'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setPreviewOpen(true)} variant="outline">
            <Eye size={16} className="mr-1.5" />
            Preview
          </Button>
          {canEdit && template.status === 'draft' && (
            <Button onClick={handlePublish} className="bg-green-600 hover:bg-green-700 text-white">
              <CheckCircle2 size={16} className="mr-1.5" />
              Publish
            </Button>
          )}
          {canArchive && (
            <Button onClick={handleArchive} variant="outline">
              <Archive size={16} className="mr-1.5" />
              Archive
            </Button>
          )}
        </div>
      </div>

      {template.status === 'published' && (
        <Card className="p-4 bg-blue-50 border-blue-200">
          <p className="text-sm text-blue-800">
            <Lock className="inline mr-1.5 h-4 w-4" />
            This template is published and cannot be edited. Create a new version to make changes.
          </p>
        </Card>
      )}

      {/* Main Editor */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left: Sections */}
        <div className="col-span-3">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-[#344E41] flex items-center gap-2">
                <Layers size={18} />
                Sections
              </h3>
              {canEdit && (
                <Button size="sm" variant="outline" onClick={() => openSectionDialog()}>
                  <Plus size={14} />
                </Button>
              )}
            </div>
            <div className="space-y-2">
              {template.sections.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">No sections yet</p>
              ) : (
                template.sections.map((section, index) => {
                  const hasConditionalFields = section.fields.some(
                    (f) =>
                      f.conditional_logic &&
                      typeof f.conditional_logic === 'object' &&
                      Object.keys(f.conditional_logic).length > 0
                  );
                  return (
                    <div
                      key={section.id}
                      onClick={() => setSelectedSectionId(section.id)}
                      className={`p-3 rounded-lg cursor-pointer transition group ${
                        section.id === selectedSectionId
                          ? 'bg-[#588157] text-white'
                          : 'bg-slate-50 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{section.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <p
                              className={`text-xs ${section.id === selectedSectionId ? 'text-white/80' : 'text-slate-500'}`}
                            >
                              {section.fields.length} question
                              {section.fields.length !== 1 ? 's' : ''}
                            </p>
                            {hasConditionalFields && (
                              <span
                                className={`flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                                  section.id === selectedSectionId
                                    ? 'bg-white/20 text-white'
                                    : 'bg-purple-100 text-purple-500'
                                }`}
                              >
                                <GitBranch size={9} />
                                Conditional
                              </span>
                            )}
                          </div>
                        </div>
                        {canEdit && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button
                                size="sm"
                                variant="ghost"
                                className={`opacity-0 group-hover:opacity-100 h-6 w-6 p-0 ${
                                  section.id === selectedSectionId
                                    ? 'text-white hover:bg-white/20'
                                    : 'text-slate-400'
                                }`}
                              >
                                <Settings size={14} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openSectionDialog(section)}>
                                <Edit className="mr-2 h-4 w-4" /> Edit
                              </DropdownMenuItem>
                              {index > 0 && (
                                <DropdownMenuItem onClick={() => handleMoveSectionUp(index)}>
                                  <ChevronUp className="mr-2 h-4 w-4" /> Move Up
                                </DropdownMenuItem>
                              )}
                              {index < template.sections.length - 1 && (
                                <DropdownMenuItem onClick={() => handleMoveSectionDown(index)}>
                                  <ChevronDown className="mr-2 h-4 w-4" /> Move Down
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => handleDeleteSection(section.id, section.name)}
                                className="text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>

        {/* Right: Questions */}
        <div className="col-span-9">
          {selectedSection ? (
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-[#344E41]">{selectedSection.name}</h3>
                  {selectedSection.description && (
                    <p className="text-sm text-slate-500 mt-1">{selectedSection.description}</p>
                  )}
                </div>
                {canEdit && (
                  <Button
                    onClick={() => openFieldBuilder()}
                    className="bg-[#344E41] hover:bg-[#3A5A40]"
                  >
                    <Plus size={16} className="mr-1.5" />
                    Add Question
                  </Button>
                )}
              </div>

              {/* Conditional section callout */}
              {(() => {
                const firstConditionalField = selectedSection.fields.find(
                  (f) =>
                    f.conditional_logic &&
                    typeof f.conditional_logic === 'object' &&
                    (f.conditional_logic as any).show_when
                );
                if (!firstConditionalField) return null;
                const logic = (firstConditionalField.conditional_logic as any).show_when;
                const triggerValues: string[] = logic?.values ?? [];
                return (
                  <div className="flex items-start gap-3 mb-5 px-4 py-3 rounded-xl border border-purple-200 bg-purple-50">
                    <GitBranch size={15} className="text-purple-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-purple-800">Conditional Section</p>
                      <p className="text-xs text-purple-600 mt-0.5">
                        This section is displayed only when{' '}
                        <span className="font-bold">{logic?.field ?? 'a field'}</span> equals{' '}
                        {triggerValues.map((v: string, i: number) => (
                          <span key={v}>
                            <span className="font-bold">&quot;{v}&quot;</span>
                            {i < triggerValues.length - 1 ? ' or ' : ''}
                          </span>
                        ))}
                        . All {selectedSection.fields.length} fields in this section inherit this
                        logic.
                      </p>
                    </div>
                  </div>
                );
              })()}

              {selectedSection.fields.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                    <Settings size={24} className="text-slate-300" />
                  </div>
                  <p className="font-medium text-slate-500">No questions in this section</p>
                  {canEdit && (
                    <p className="text-sm mt-1 text-slate-400">
                      Click <span className="font-semibold text-[#344E41]">Add Question</span> to
                      get started
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedSection.fields.map((field, index) => {
                    const Icon = getFieldTypeIcon(field.field_type);
                    const hasConditionalLogic =
                      field.conditional_logic &&
                      typeof field.conditional_logic === 'object' &&
                      Object.keys(field.conditional_logic).length > 0;
                    return (
                      <div
                        key={field.id}
                        className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-sm transition group bg-white"
                      >
                        {canEdit && (
                          <GripVertical
                            size={16}
                            className="text-slate-200 group-hover:text-slate-400 flex-shrink-0 transition cursor-grab"
                          />
                        )}
                        {/* Type icon */}
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <Icon size={14} className="text-slate-500" />
                        </div>
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-slate-800">
                              {field.label}
                            </span>
                            {field.is_required && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-500 uppercase tracking-wide">
                                Required
                              </span>
                            )}
                            {field.is_unique && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-500 uppercase tracking-wide">
                                Unique
                              </span>
                            )}
                            {field.is_read_only && (
                              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-400 uppercase tracking-wide">
                                <Lock size={9} /> Read-only
                              </span>
                            )}
                            {!field.is_visible && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-400 uppercase tracking-wide">
                                Hidden
                              </span>
                            )}
                            {hasConditionalLogic && (
                              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-500 uppercase tracking-wide">
                                <GitBranch size={9} /> Conditional
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-slate-400 font-mono">
                              {field.field_key}
                            </span>
                            <span className="text-slate-200">·</span>
                            <span className="text-xs text-slate-400">
                              {getFieldTypeLabel(field.field_type)}
                            </span>
                            {field.help_text && (
                              <>
                                <span className="text-slate-200">·</span>
                                <span className="text-xs text-slate-400 truncate max-w-xs">
                                  {field.help_text}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        {/* Options count badge for choice fields */}
                        {CHOICE_TYPES.has(field.field_type) &&
                          Array.isArray(field.field_options) &&
                          field.field_options.length > 0 && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-500 flex-shrink-0">
                              <List size={10} />
                              {field.field_options.length} opts
                            </span>
                          )}
                        {/* Actions */}
                        {canEdit && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition text-slate-400 flex-shrink-0"
                              >
                                <Settings size={14} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openFieldBuilder(field)}>
                                <Edit className="mr-2 h-4 w-4" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDuplicateField(field)}>
                                <Copy className="mr-2 h-4 w-4" /> Duplicate
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openMoveDialog(field)}>
                                <MoveVertical className="mr-2 h-4 w-4" /> Move to Section
                              </DropdownMenuItem>
                              {index > 0 && (
                                <DropdownMenuItem
                                  onClick={() => handleMoveFieldUp(selectedSection.id, index)}
                                >
                                  <ChevronUp className="mr-2 h-4 w-4" /> Move Up
                                </DropdownMenuItem>
                              )}
                              {index < selectedSection.fields.length - 1 && (
                                <DropdownMenuItem
                                  onClick={() => handleMoveFieldDown(selectedSection.id, index)}
                                >
                                  <ChevronDown className="mr-2 h-4 w-4" /> Move Down
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => handleDeleteField(field.id, field.label)}
                                className="text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          ) : (
            <Card className="p-12 text-center">
              <Layers size={48} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500 font-medium">Select a section to view questions</p>
            </Card>
          )}
        </div>
      </div>

      {/* ── Question Builder Dialog (wide) ── */}
      <QuestionBuilderDialog
        open={builderOpen}
        onOpenChange={setBuilderOpen}
        editingField={editingField}
        onSave={handleSaveField}
        saving={savingField}
        form={fieldForm}
        setForm={setFieldForm}
      />

      {/* ── Section Dialog ── */}
      <Dialog open={sectionDialogOpen} onOpenChange={setSectionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSectionId ? 'Edit Section' : 'Add New Section'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Section Name *</Label>
              <Input
                value={sectionForm.name}
                onChange={(e) => setSectionForm({ ...sectionForm, name: e.target.value })}
                placeholder="e.g., Supplier Information"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Description (Optional)</Label>
              <Textarea
                value={sectionForm.description}
                onChange={(e) => setSectionForm({ ...sectionForm, description: e.target.value })}
                placeholder="Brief description of this section"
                className="mt-1.5"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSectionDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSection} disabled={savingSect}>
              {savingSect ? 'Saving…' : editingSectionId ? 'Update' : 'Add Section'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Move Question Dialog ── */}
      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move Question to Section</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-slate-600">
              Move &quot;{movingField?.label}&quot; to a different section:
            </p>
            <Select value={targetSectionId} onValueChange={setTargetSectionId}>
              <SelectTrigger>
                <SelectValue placeholder="Select target section" />
              </SelectTrigger>
              <SelectContent>
                {template.sections
                  .filter((s) => s.id !== movingField?.section_id)
                  .map((section) => (
                    <SelectItem key={section.id} value={section.id.toString()}>
                      {section.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleMoveField}>Move</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Full Template Preview Dialog ── */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Template Preview — {template.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-8 py-4">
            {template.sections.map((section) => (
              <div key={section.id} className="space-y-4">
                <div className="border-b pb-2">
                  <h3 className="text-base font-bold text-[#344E41]">{section.name}</h3>
                  {section.description && (
                    <p className="text-sm text-slate-500 mt-1">{section.description}</p>
                  )}
                </div>
                {section.fields
                  .filter((f) => f.is_visible !== false)
                  .map((field) => {
                    const Icon = getFieldTypeIcon(field.field_type);
                    return (
                      <div key={field.id} className="space-y-1.5">
                        <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                          <Icon size={13} className="text-slate-400" />
                          {field.label}
                          {field.is_required && <span className="text-red-500">*</span>}
                        </label>
                        {field.help_text && (
                          <p className="text-xs text-slate-400">💡 {field.help_text}</p>
                        )}
                        {field.field_type === 'short_text' && (
                          <Input placeholder={field.placeholder || ''} disabled />
                        )}
                        {field.field_type === 'long_text' && (
                          <Textarea placeholder={field.placeholder || ''} disabled />
                        )}
                        {['number', 'currency', 'percentage'].includes(field.field_type) && (
                          <Input type="number" disabled />
                        )}
                        {field.field_type === 'date' && <Input type="date" disabled />}
                        {field.field_type === 'email' && <Input type="email" disabled />}
                        {field.field_type === 'phone' && <Input type="tel" disabled />}
                        {field.field_type === 'dropdown' && (
                          <Select disabled>
                            <SelectTrigger>
                              <SelectValue placeholder="Select an option" />
                            </SelectTrigger>
                          </Select>
                        )}
                        {['multiple_choice', 'checkbox'].includes(field.field_type) && (
                          <div className="space-y-2">
                            {(Array.isArray(field.field_options) && field.field_options.length > 0
                              ? field.field_options
                              : ['Option 1', 'Option 2']
                            ).map((opt, i) => (
                              <label key={i} className="flex items-center gap-2.5">
                                <div className="w-4 h-4 rounded border border-slate-300" />
                                <span className="text-sm text-slate-600">{opt}</span>
                              </label>
                            ))}
                          </div>
                        )}
                        {field.field_type === 'radio' && (
                          <div className="space-y-2">
                            {(Array.isArray(field.field_options) && field.field_options.length > 0
                              ? field.field_options
                              : ['Option A', 'Option B']
                            ).map((opt, i) => (
                              <label key={i} className="flex items-center gap-2.5">
                                <div className="w-4 h-4 rounded-full border border-slate-300" />
                                <span className="text-sm text-slate-600">{opt}</span>
                              </label>
                            ))}
                          </div>
                        )}
                        {field.field_type === 'yes_no' && (
                          <div className="flex gap-3">
                            <Button variant="outline" size="sm" disabled>
                              Yes
                            </Button>
                            <Button variant="outline" size="sm" disabled>
                              No
                            </Button>
                          </div>
                        )}
                        {field.field_type === 'gps' && (
                          <div className="grid grid-cols-2 gap-2">
                            <Input placeholder="Latitude" disabled />
                            <Input placeholder="Longitude" disabled />
                          </div>
                        )}
                        {field.field_type === 'file_upload' && (
                          <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center text-sm text-slate-400">
                            Click to upload or drag and drop
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
