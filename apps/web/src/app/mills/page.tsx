'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Edit,
  Search,
  MapPin,
  Factory,
  Users,
  ClipboardCheck,
  MoreVertical,
  Trash2,
  X,
  ChevronDown,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { authClient } from '@/lib/auth-client';
import RoleGuard from '@/components/role-guard';

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_STATES = [
  'Johor',
  'Kedah',
  'Kelantan',
  'Melaka',
  'Negeri Sembilan',
  'Pahang',
  'Perak',
  'Perlis',
  'Penang',
  'Selangor',
  'Terengganu',
  'Sabah',
  'Sarawak',
  'Labuan',
  'Putrajaya',
  'Kuala Lumpur',
];

const EAST_STATES = new Set(['Sabah', 'Sarawak', 'Labuan']);

// Sentinel used internally by the region-override <Select>.
// Radix UI does NOT allow value="" on <SelectItem> — use a real string.
const REGION_AUTO = '__auto__';

function computeRegion(state: string | null | undefined): 'east' | 'west' | null {
  if (!state) return null;
  return EAST_STATES.has(state) ? 'east' : 'west';
}

/** Coerce null / undefined to "" safely */
function safe(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

/** Coerce null / undefined / NaN to "" for numeric inputs */
function safeNum(v: unknown): string {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  return isNaN(n) ? '' : String(n);
}

// ─── StateMultiSelect ─────────────────────────────────────────────────────────

function StateMultiSelect({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (states: string[]) => void;
}) {
  const [open, setOpen] = useState(false);

  const toggle = (state: string) =>
    onChange(selected.includes(state) ? selected.filter((s) => s !== state) : [...selected, state]);

  const label =
    selected.length === 0
      ? 'All States'
      : selected.length === 1
        ? selected[0]
        : `${selected.length} states`;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:border-[#344E41] transition-colors min-w-[150px]"
      >
        <span className="flex-1 text-left truncate">{label}</span>
        {selected.length > 0 && (
          <span
            className="text-slate-400 hover:text-slate-600"
            onClick={(e) => {
              e.stopPropagation();
              onChange([]);
            }}
          >
            <X size={12} />
          </span>
        )}
        <ChevronDown size={13} className="text-slate-400 flex-shrink-0" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-20 w-52 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
            <div className="p-2 border-b border-slate-100 flex justify-between items-center">
              <span className="text-xs font-semibold text-slate-500">Filter by State</span>
              {selected.length > 0 && (
                <button className="text-xs text-[#344E41] font-medium" onClick={() => onChange([])}>
                  Clear
                </button>
              )}
            </div>
            <div className="max-h-60 overflow-y-auto">
              <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                West Malaysia
              </div>
              {ALL_STATES.filter((s) => !EAST_STATES.has(s)).map((state) => (
                <label
                  key={state}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer text-sm text-slate-700"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(state)}
                    onChange={() => toggle(state)}
                    className="rounded border-slate-300"
                  />
                  {state}
                </label>
              ))}
              <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-t border-slate-100">
                East Malaysia
              </div>
              {ALL_STATES.filter((s) => EAST_STATES.has(s)).map((state) => (
                <label
                  key={state}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer text-sm text-slate-700"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(state)}
                    onChange={() => toggle(state)}
                    className="rounded border-slate-300"
                  />
                  {state}
                </label>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── MillForm ─────────────────────────────────────────────────────────────────
// MUST be at module level — never nest a component definition inside another
// component. Doing so makes React create a new component type on every render,
// which unmounts the form and crashes hooks.

interface MillFormProps {
  defaults?: Record<string, any> | null;
  onSubmit: (data: Record<string, string>) => void;
  isPending: boolean;
  onCancel: () => void;
  isMasterAdmin: boolean;
}

function MillForm({ defaults, onSubmit, isPending, onCancel, isMasterAdmin }: MillFormProps) {
  // ── Safe initialisation ─────────────────────────────────────────────────
  // All DB fields can be null for legacy mills. Never pass null into useState.
  const initState = safe(defaults?.state);

  // `region` is the *stored* override (may be null).
  // `effective_region` is COALESCE(region, computed) returned by the API.
  // We only want to pre-fill the override with an explicitly stored value.
  const storedRegion = safe(defaults?.region); // '' when null
  const initOverride: string =
    storedRegion === 'east' || storedRegion === 'west' ? storedRegion : '';

  const [selectedState, setSelectedState] = useState<string>(initState);
  // Internal override value — '' means "auto", 'east'/'west' means explicit override.
  const [regionOverride, setRegionOverride] = useState<string>(initOverride);
  const [validationError, setValidationError] = useState<string>('');

  // ── Derived region ───────────────────────────────────────────────────────
  // When state changes, always recompute (override is cleared).
  const autoRegion = computeRegion(selectedState); // 'east' | 'west' | null
  const effectiveRegion = regionOverride || autoRegion; // null when no state + no override

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleStateChange = (val: string) => {
    console.log('[MillForm] State changed:', val);
    setSelectedState(val);
    // Always reset override so region auto-recalculates from the new state.
    setRegionOverride('');
  };

  // Converts the sentinel REGION_AUTO back to '' (meaning "no override").
  const handleRegionOverrideChange = (val: string) => {
    const resolved = val === REGION_AUTO ? '' : val;
    console.log('[MillForm] Region override changed:', val, '→', resolved);
    setRegionOverride(resolved);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setValidationError('');

    const fd = new FormData(e.currentTarget);
    const raw = Object.fromEntries(fd.entries()) as Record<string, string>;

    // Log all field values for debugging
    console.log('[MillForm] Submit — raw fields:', {
      name: raw.name,
      code: raw.code,
      state: selectedState,
      country: raw.country,
      latitude: raw.latitude,
      longitude: raw.longitude,
      regionOverride,
    });

    // Validate required fields
    if (!raw.name?.trim()) {
      setValidationError('Mill Name is required.');
      return;
    }
    if (!raw.code?.trim()) {
      setValidationError('Mill Code is required.');
      return;
    }
    if (!selectedState) {
      setValidationError('Please select a State.');
      return;
    }
    if (!raw.country?.trim()) {
      setValidationError('Country is required.');
      return;
    }
    if (!raw.latitude?.trim()) {
      setValidationError('Latitude is required.');
      return;
    }
    if (!raw.longitude?.trim()) {
      setValidationError('Longitude is required.');
      return;
    }

    // Inject controlled-Select values that don't appear in FormData
    raw.state = selectedState;
    raw.region = regionOverride; // '' means "auto-compute on server"

    onSubmit(raw);
  };

  // ── Badge display ─────────────────────────────────────────────────────────
  const regionBadgeCls =
    effectiveRegion === 'east'
      ? 'bg-blue-100 text-blue-700'
      : effectiveRegion === 'west'
        ? 'bg-purple-100 text-purple-700'
        : 'bg-slate-100 text-slate-400';

  const regionBadgeLabel =
    effectiveRegion === 'east'
      ? 'East Malaysia'
      : effectiveRegion === 'west'
        ? 'West Malaysia'
        : 'Not Set';

  const regionBadgeSuffix = effectiveRegion ? (regionOverride ? ' (Override)' : ' (Auto)') : '';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {/* Missing-fields notice */}
      {defaults && (!defaults.state || defaults.latitude == null || defaults.longitude == null) && (
        <div className="flex items-start gap-2.5 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
          <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
          <span>
            This mill has incomplete data (missing:{' '}
            {[
              !defaults.state && 'State',
              defaults.latitude == null && 'Latitude',
              defaults.longitude == null && 'Longitude',
            ]
              .filter(Boolean)
              .join(', ')}
            ). Please fill in the missing fields and save.
          </span>
        </div>
      )}

      {/* Validation error */}
      {validationError && (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertTriangle size={14} className="flex-shrink-0" />
          {validationError}
        </div>
      )}

      {/* Name + Code */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5 col-span-2 sm:col-span-1">
          <label className="text-sm font-medium text-slate-700">
            Mill Name <span className="text-red-500">*</span>
          </label>
          <Input
            name="name"
            defaultValue={safe(defaults?.name)}
            placeholder="Kilang Sawit XYZ"
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">
            Mill Code <span className="text-red-500">*</span>
          </label>
          <Input
            name="code"
            defaultValue={safe(defaults?.code)}
            placeholder="KS-001"
            className="uppercase"
            autoComplete="off"
          />
        </div>
      </div>

      {/* State + Country */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">
            State <span className="text-red-500">*</span>
          </label>
          {/*
            CRITICAL: never pass value="" to Radix UI Select.
            Radix does not allow empty-string values — use `undefined` to mean
            "nothing selected" (shows placeholder).
          */}
          <Select value={selectedState || undefined} onValueChange={handleStateChange}>
            <SelectTrigger className={!selectedState ? 'text-slate-400' : ''}>
              <SelectValue placeholder="Select state…" />
            </SelectTrigger>
            <SelectContent>
              {ALL_STATES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s} {EAST_STATES.has(s) ? '(East)' : '(West)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">
            Country <span className="text-red-500">*</span>
          </label>
          <Input
            name="country"
            defaultValue={safe(defaults?.country) || 'Malaysia'}
            placeholder="Malaysia"
            autoComplete="off"
          />
        </div>
      </div>

      {/* Region panel */}
      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-600">Region Classification</span>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${regionBadgeCls}`}
          >
            {regionBadgeLabel}
            {regionBadgeSuffix}
          </span>
        </div>

        {!selectedState && (
          <p className="text-[11px] text-slate-400">
            Select a State — Region will be auto-calculated.
          </p>
        )}

        {selectedState && !isMasterAdmin && (
          <p className="text-[11px] text-slate-400">
            Auto-classified from State. Contact a Master Admin to override.
          </p>
        )}

        {isMasterAdmin && (
          <>
            <p className="text-[10px] text-slate-400">
              Master Admin: override the auto-computed region if needed.
            </p>
            {/*
              CRITICAL: Radix UI SelectItem does NOT allow value="".
              Use the REGION_AUTO sentinel ("__auto__") and convert it back
              to "" in handleRegionOverrideChange.
            */}
            <Select
              value={regionOverride || REGION_AUTO}
              onValueChange={handleRegionOverrideChange}
            >
              <SelectTrigger className="h-8 text-xs border-dashed">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={REGION_AUTO}>Auto (computed from State)</SelectItem>
                <SelectItem value="east">Override → East Malaysia</SelectItem>
                <SelectItem value="west">Override → West Malaysia</SelectItem>
              </SelectContent>
            </Select>
          </>
        )}
      </div>

      {/* GPS coordinates */}
      <div>
        <p className="text-sm font-medium text-slate-700 mb-2">
          GPS Coordinates <span className="text-red-500">*</span>
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs text-slate-500">Latitude</label>
            <Input
              name="latitude"
              type="number"
              step="any"
              defaultValue={safeNum(defaults?.latitude)}
              placeholder="4.123456"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-slate-500">Longitude</label>
            <Input
              name="longitude"
              type="number"
              step="any"
              defaultValue={safeNum(defaults?.longitude)}
              placeholder="117.654321"
              autoComplete="off"
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          className="flex-1 bg-[#344E41] hover:bg-[#3A5A40]"
          disabled={isPending}
        >
          {isPending ? 'Saving…' : defaults ? 'Save Changes' : 'Add Mill'}
        </Button>
      </div>
    </form>
  );
}

// ─── Page entry ───────────────────────────────────────────────────────────────

export default function MillManagement() {
  return (
    <RoleGuard allowedRoles={['master_admin', 'admin']}>
      <MillContent />
    </RoleGuard>
  );
}

// ─── MillContent ──────────────────────────────────────────────────────────────

function MillContent() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [countryFilter, setCountryFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState<string[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingMill, setEditingMill] = useState<any>(null);
  const [deletingMill, setDeletingMill] = useState<any>(null);

  const { data: session } = authClient.useSession();
  const userRole = (session?.user as any)?.role ?? '';
  const isMasterAdmin = userRole === 'master_admin';

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: mills = [], isLoading } = useQuery({
    queryKey: ['mills'],
    queryFn: async () => {
      const res = await fetch('/api/mills');
      if (!res.ok) throw new Error('Failed to fetch mills');
      const data = await res.json();
      if (!Array.isArray(data)) {
        console.error('[Mills] /api/mills returned non-array:', data);
        return [];
      }
      // Defensive: log any mills with incomplete data
      const incomplete = data.filter(
        (m: any) => !m.state || m.latitude == null || m.longitude == null
      );
      if (incomplete.length > 0) {
        console.warn(
          '[Mills] Mills with incomplete data:',
          incomplete.map((m: any) => ({
            id: m.id,
            name: m.name,
            state: m.state,
            lat: m.latitude,
            lng: m.longitude,
          }))
        );
      }
      return data;
    },
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async (body: any) => {
      const res = await fetch('/api/mills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create mill');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mills'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      toast.success('Mill created successfully');
      setIsCreateOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async (body: any) => {
      const res = await fetch('/api/mills', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update mill');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mills'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      toast.success('Mill updated successfully');
      setEditingMill(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch('/api/mills', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete mill');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mills'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      toast.success('Mill deleted');
      setDeletingMill(null);
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setDeletingMill(null);
    },
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleCreate = (data: Record<string, string>) => createMutation.mutate(data);

  const handleUpdate = (data: Record<string, string>) => {
    if (!editingMill?.id) {
      toast.error('Cannot update: mill ID is missing');
      return;
    }
    updateMutation.mutate({ ...data, id: editingMill.id });
  };

  const handleEditClick = (mill: any) => {
    console.log('[Mills] Opening edit dialog for mill:', {
      id: mill.id,
      name: mill.name,
      state: mill.state,
      region: mill.region,
      effective_region: mill.effective_region,
      latitude: mill.latitude,
      longitude: mill.longitude,
    });
    setEditingMill(mill);
  };

  // ── Derived state ─────────────────────────────────────────────────────────
  const countries = Array.from(
    new Set((mills as any[]).map((m: any) => m.country).filter(Boolean))
  ).sort() as string[];

  const filtered = (mills as any[]).filter((m) => {
    const q = searchTerm.toLowerCase();
    const matchSearch =
      (m.name ?? '').toLowerCase().includes(q) || (m.code ?? '').toLowerCase().includes(q);
    const matchCountry = countryFilter === 'all' || m.country === countryFilter;
    const matchState = stateFilter.length === 0 || stateFilter.includes(m.state);
    return matchSearch && matchCountry && matchState;
  });

  const hasFilters = Boolean(searchTerm) || countryFilter !== 'all' || stateFilter.length > 0;

  const totalAssessments = (mills as any[]).reduce(
    (s, m) => s + Number(m.assessment_count || 0),
    0
  );
  const eastMills = (mills as any[]).filter(
    (m) => m.effective_region === 'east' || (!m.effective_region && EAST_STATES.has(m.state))
  ).length;
  const westMills = (mills as any[]).length - eastMills;
  const totalSuppliers = (mills as any[]).reduce(
    (s, m) => s + Number(m.total_supplier_count || 0),
    0
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#344E41]">Mill Management</h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Configure and manage palm oil mill locations
          </p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#344E41] hover:bg-[#3A5A40] shadow-sm self-start sm:self-auto">
              <Plus className="mr-2 h-4 w-4" />
              Add Mill
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-[#344E41]">Register New Mill</DialogTitle>
            </DialogHeader>
            <div className="mt-2">
              <MillForm
                onSubmit={handleCreate}
                isPending={createMutation.isPending}
                onCancel={() => setIsCreateOpen(false)}
                isMasterAdmin={isMasterAdmin}
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          {
            label: 'Total Mills',
            value: (mills as any[]).length,
            icon: Factory,
            color: 'text-[#344E41]',
            bg: 'bg-[#344E41]/10',
          },
          {
            label: 'East Malaysia',
            value: eastMills,
            icon: MapPin,
            color: 'text-blue-600',
            bg: 'bg-blue-100',
          },
          {
            label: 'West Malaysia',
            value: westMills,
            icon: MapPin,
            color: 'text-purple-600',
            bg: 'bg-purple-100',
          },
          {
            label: 'Total Suppliers',
            value: totalSuppliers,
            icon: Users,
            color: 'text-emerald-600',
            bg: 'bg-emerald-100',
          },
          {
            label: 'Assessments',
            value: totalAssessments,
            icon: ClipboardCheck,
            color: 'text-amber-600',
            bg: 'bg-amber-100',
          },
        ].map((s) => (
          <Card key={s.label} className="border border-slate-200 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`${s.bg} p-2 rounded-lg flex-shrink-0`}>
                <s.icon size={17} className={s.color} />
              </div>
              <div>
                <p className="text-xl font-bold text-[#344E41]">{s.value}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
          <Input
            placeholder="Search by mill name or code…"
            className="pl-10 border-slate-200"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {countries.length > 0 && (
          <Select value={countryFilter} onValueChange={setCountryFilter}>
            <SelectTrigger className="w-40 border-slate-200">
              <SelectValue placeholder="All countries" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Countries</SelectItem>
              {countries.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <StateMultiSelect selected={stateFilter} onChange={setStateFilter} />

        {hasFilters && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSearchTerm('');
              setCountryFilter('all');
              setStateFilter([]);
            }}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </Button>
        )}

        <span className="text-xs text-slate-400 self-center ml-auto">
          Showing {filtered.length} of {(mills as any[]).length}
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
            Loading mills…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <Factory size={32} className="text-slate-300" />
            <p className="text-sm text-slate-400">
              {hasFilters ? 'No mills match your search' : 'No mills registered yet'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="font-semibold text-slate-600">Mill</TableHead>
                  <TableHead className="font-semibold text-slate-600">Region</TableHead>
                  <TableHead className="font-semibold text-slate-600">State</TableHead>
                  <TableHead className="text-right font-semibold text-slate-600">
                    Smallholders
                  </TableHead>
                  <TableHead className="text-right font-semibold text-slate-600">Dealers</TableHead>
                  <TableHead className="text-right font-semibold text-slate-600">
                    Ext. Suppliers
                  </TableHead>
                  <TableHead className="text-right font-semibold text-slate-600">
                    In-House
                  </TableHead>
                  <TableHead className="text-right font-semibold text-slate-600">
                    Total Supp.
                  </TableHead>
                  <TableHead className="text-right font-semibold text-slate-600">
                    Assessments
                  </TableHead>
                  <TableHead className="text-right font-semibold text-slate-600">Users</TableHead>
                  <TableHead className="text-right font-semibold text-slate-600">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((mill: any) => {
                  const isEast =
                    mill.effective_region === 'east' ||
                    (!mill.effective_region && EAST_STATES.has(mill.state));
                  const hasMissingFields =
                    !mill.state || mill.latitude == null || mill.longitude == null;

                  return (
                    <TableRow key={mill.id} className="hover:bg-slate-50/80 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-[#344E41]/10 flex items-center justify-center flex-shrink-0">
                            <Factory size={16} className="text-[#344E41]" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-medium text-slate-800">{mill.name ?? '—'}</p>
                              {hasMissingFields && (
                                <AlertTriangle
                                  size={12}
                                  className="text-amber-400 flex-shrink-0"
                                  title="Incomplete data"
                                />
                              )}
                            </div>
                            <p className="text-xs text-slate-400 font-mono">{mill.code ?? '—'}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${isEast ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}
                        >
                          {isEast ? 'East' : 'West'}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {mill.state || (
                          <span className="text-slate-300 italic text-xs">Not set</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {Number(mill.smallholder_count || 0)}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {Number(mill.dealer_count || 0)}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {Number(mill.external_supplier_count || 0)}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {Number(mill.in_house_count || 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-[#344E41]/10 text-[#344E41]">
                          {Number(mill.total_supplier_count || 0)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-purple-50 text-purple-600 font-medium">
                          <ClipboardCheck size={10} />
                          {Number(mill.assessment_count || 0)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-600 font-medium">
                          <Users size={10} />
                          {Number(mill.user_count || 0)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
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
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem
                              className="cursor-pointer"
                              onClick={() => handleEditClick(mill)}
                            >
                              <Edit className="mr-2 h-4 w-4 text-slate-400" />
                              Edit Details
                            </DropdownMenuItem>
                            {isMasterAdmin && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="cursor-pointer text-red-600"
                                  onClick={() => setDeletingMill(mill)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete Mill
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50">
            <p className="text-xs text-slate-400">
              Showing {filtered.length} of {(mills as any[]).length} mill
              {(mills as any[]).length !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>

      {/* Edit dialog */}
      <Dialog
        open={!!editingMill}
        onOpenChange={(open) => {
          if (!open) setEditingMill(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[#344E41]">Edit Mill</DialogTitle>
          </DialogHeader>

          {editingMill && (
            <>
              {/* Mill identity strip */}
              <div className="flex items-center gap-3 py-2 px-3 bg-slate-50 rounded-lg border border-slate-200 mt-2 mb-1">
                <div className="w-9 h-9 rounded-lg bg-[#344E41]/10 flex items-center justify-center flex-shrink-0">
                  <Factory size={16} className="text-[#344E41]" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-slate-800 truncate">{editingMill.name ?? '—'}</p>
                  <p className="text-xs text-slate-500 font-mono">{editingMill.code ?? '—'}</p>
                </div>
              </div>

              {/*
                key={editingMill.id} guarantees a fresh MillForm instance
                every time a different mill is selected.
                Safe defaults: all null DB fields are coerced inside MillForm.
              */}
              <MillForm
                key={editingMill.id}
                defaults={editingMill}
                onSubmit={handleUpdate}
                isPending={updateMutation.isPending}
                onCancel={() => setEditingMill(null)}
                isMasterAdmin={isMasterAdmin}
              />
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingMill} onOpenChange={() => setDeletingMill(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Mill</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deletingMill?.name}</strong>? This action
              cannot be undone. Mills with existing assessments cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deletingMill && deleteMutation.mutate(deletingMill.id)}
            >
              Delete Mill
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
