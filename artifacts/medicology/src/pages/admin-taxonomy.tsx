import React, { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  Pencil,
  Trash2,
  ChevronRight,
  ChevronDown,
  Globe,
  GraduationCap,
  BookOpen,
  Layers,
  Tag,
  Save,
  X,
  Search,
} from 'lucide-react';
import { clsx } from 'clsx';

// ---------------------------------------------------------------------------
// Taxonomy entities: id -> label, plus the fields the form needs to know about.
// ---------------------------------------------------------------------------

type EntityKey =
  | 'countries'
  | 'exam-systems'
  | 'exams'
  | 'programs'
  | 'years'
  | 'subjects'
  | 'systems'
  | 'topics'
  | 'subtopics';

const ENTITIES: { key: EntityKey; label: string; icon: React.ReactNode; parent?: string }[] = [
  { key: 'countries', label: 'Countries', icon: <Globe size={16} /> },
  { key: 'exam-systems', label: 'Exam Systems', icon: <Layers size={16} />, parent: 'countries' },
  { key: 'exams', label: 'Exams', icon: <GraduationCap size={16} />, parent: 'exam-systems' },
  { key: 'programs', label: 'Programs', icon: <BookOpen size={16} />, parent: 'exams' },
  { key: 'years', label: 'Academic Years', icon: <Layers size={16} />, parent: 'programs' },
  { key: 'subjects', label: 'Subjects', icon: <BookOpen size={16} /> },
  { key: 'systems', label: 'Systems', icon: <Layers size={16} />, parent: 'subjects' },
  { key: 'topics', label: 'Topics', icon: <Tag size={16} />, parent: 'systems' },
  { key: 'subtopics', label: 'Subtopics', icon: <Tag size={16} />, parent: 'topics' },
];

// Field metadata for the create/edit form (ordered).
const FIELD_ORDER: Record<EntityKey, string[]> = {
  countries: ['code', 'name', 'flag', 'active'],
  'exam-systems': ['name', 'countryId', 'sortOrder', 'active'],
  exams: ['code', 'name', 'examSystemId', 'countryId', 'status', 'sortOrder', 'active'],
  programs: ['code', 'name', 'examId', 'sortOrder', 'active'],
  years: ['name', 'programId', 'sortOrder', 'active'],
  subjects: ['code', 'name', 'shortName', 'icon', 'color', 'description', 'active'],
  systems: ['name', 'subjectId', 'sortOrder', 'active'],
  topics: ['name', 'systemId', 'sortOrder', 'active'],
  subtopics: ['name', 'topicId', 'sortOrder', 'active'],
};

const FIELD_LABELS: Record<string, string> = {
  code: 'Code',
  name: 'Name',
  flag: 'Flag',
  active: 'Active',
  shortName: 'Short Name',
  icon: 'Icon',
  color: 'Color',
  description: 'Description',
  sortOrder: 'Sort Order',
  countryId: 'Country',
  examSystemId: 'Exam System',
  examId: 'Exam',
  programId: 'Program',
  subjectId: 'Subject',
  systemId: 'System',
  topicId: 'Topic',
  status: 'Status',
};

const EXAM_STATUSES = ['planned', 'coming_soon', 'beta', 'available', 'paused', 'archived'];

// "Countries" -> "Country", "Exam Systems" -> "Exam System", etc.
const singular = (label: string) => label.replace(/ies$/, 'y').replace(/s$/, '');

interface Row {
  id: number;
  [key: string]: any;
}

export default function AdminTaxonomyPage() {
  const { toast } = useToast();
  const [activeEntity, setActiveEntity] = useState<EntityKey>('countries');
  const [rows, setRows] = useState<Record<EntityKey, Row[]>>({
    countries: [],
    'exam-systems': [],
    exams: [],
    programs: [],
    years: [],
    subjects: [],
    systems: [],
    topics: [],
    subtopics: [],
  });
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; row?: Row } | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const entries = await Promise.all(
        ENTITIES.map(async (entity) => {
          const response = await fetch(`/api/taxonomy/${entity.key}`);
          if (!response.ok) throw new Error(`Failed to load ${entity.label}`);
          const data = await response.json();
          return [entity.key, data[entity.key] ?? []] as const;
        })
      );
      setRows(Object.fromEntries(entries) as Record<EntityKey, Row[]>);
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to load taxonomy', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const openCreate = () => {
    setForm({ active: true, sortOrder: 1 });
    setModal({ mode: 'create' });
  };

  const openEdit = (row: Row) => {
    setForm({ ...row });
    setModal({ mode: 'edit', row });
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!modal) return;

    try {
      const entity = activeEntity;
      const url = modal.mode === 'edit' ? `/api/taxonomy/${entity}/${modal.row!.id}` : `/api/taxonomy/${entity}`;
      const method = modal.mode === 'edit' ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || 'Failed to save');
      }

      toast({ title: 'Success', description: modal.mode === 'edit' ? 'Updated' : 'Created' });
      setModal(null);
      await fetchAll();
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Save failed', variant: 'destructive' });
    }
  };

  const handleDelete = async (row: Row) => {
    if (!window.confirm('Delete this row? This may fail if child rows reference it.')) return;
    try {
      const response = await fetch(`/api/taxonomy/${activeEntity}/${row.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete');
      toast({ title: 'Success', description: 'Deleted' });
      await fetchAll();
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Delete failed', variant: 'destructive' });
    }
  };

  // Resolve a parent select's options (e.g. countries for exam-systems).
  const parentOptions = (parentKey?: string): Row[] => (parentKey ? rows[parentKey as EntityKey] ?? [] : []);

  const renderField = (field: string) => {
    const value = form[field];
    const isParent = field.endsWith('Id');
    const options = isParent ? parentOptions(ENTITIES.find((e) => e.key === activeEntity)?.parent) : [];

    if (field === 'active') {
      return (
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => setForm({ ...form, [field]: e.target.checked })}
          className="h-4 w-4 rounded border-border"
        />
      );
    }

    if (field === 'status') {
      return (
        <select
          value={value ?? 'coming_soon'}
          onChange={(e) => setForm({ ...form, [field]: e.target.value })}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          {EXAM_STATUSES.map((status) => (
            <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>
          ))}
        </select>
      );
    }

    if (isParent && options.length > 0) {
      return (
        <select
          value={value ?? ''}
          onChange={(e) => setForm({ ...form, [field]: e.target.value ? Number(e.target.value) : undefined })}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">— Select —</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name ?? option.code}
            </option>
          ))}
        </select>
      );
    }

    if (field === 'description') {
      return (
        <textarea
          rows={2}
          value={value ?? ''}
          onChange={(e) => setForm({ ...form, [field]: e.target.value })}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      );
    }

    return (
      <input
        type="text"
        value={value ?? ''}
        onChange={(e) => setForm({ ...form, [field]: e.target.value })}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
      />
    );
  };

  const entityDef = ENTITIES.find((e) => e.key === activeEntity)!;
  const currentRows = rows[activeEntity] ?? [];
  const currentParent = entityDef.parent;
  const parentLabel = currentParent ? FIELD_LABELS[`${currentParent === 'exam-systems' ? 'examSystem' : currentParent.replace('-', '')}Id`] ?? 'Parent' : null;

  // Case-insensitive filter for the current entity's rows.
  const searchable = (row: Row) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return [row.name, row.code, row.shortName, row.flag]
      .filter((v): v is string => typeof v === 'string')
      .some((v) => v.toLowerCase().includes(q));
  };
  const visibleRows = currentRows.filter(searchable);

  // Simple tree display for the currently selected entity's parent chain.
  const toggleExpand = (key: string) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const renderTree = () => {
    const parentKey = currentParent;
    if (!parentKey) {
      return visibleRows.map((row) => (
        <div key={row.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/40">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">{row.flag ? `${row.flag} ` : ''}{row.name}</span>
            <span className="text-xs text-muted-foreground">{row.code ? `(${row.code})` : ''}</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => openEdit(row)} className="rounded p-1.5 text-muted-foreground hover:text-foreground" title="Edit">
              <Pencil size={14} />
            </button>
            <button onClick={() => void handleDelete(row)} className="rounded p-1.5 text-muted-foreground hover:text-destructive" title="Delete">
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ));
    }

    const parents = parentOptions(parentKey);
    return parents.map((parent) => {
      const children = visibleRows.filter((row) => row[`${parentKey.replace('-', '')}Id`] === parent.id);
      const isOpen = expanded[`${parentKey}-${parent.id}`] ?? true;
      return (
        <div key={parent.id} className="border-b border-border/60">
          <button
            onClick={() => toggleExpand(`${parentKey}-${parent.id}`)}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium hover:bg-muted/40"
          >
            {isOpen ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronRight size={14} className="text-muted-foreground" />}
            <span>{parent.name ?? parent.code}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{children.length}</span>
          </button>
          {isOpen &&
            children.map((row) => (
              <div key={row.id} className="flex items-center justify-between py-2 pl-10 pr-4 text-sm hover:bg-muted/40">
                <span>{row.name ?? row.code}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(row)} className="rounded p-1.5 text-muted-foreground hover:text-foreground" title="Edit">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => void handleDelete(row)} className="rounded p-1.5 text-muted-foreground hover:text-destructive" title="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
        </div>
      );
    });
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-bold">Taxonomy Management</h2>
          <p className="text-sm text-muted-foreground">
            The universal exam hierarchy — countries → exams → programs → years, and subjects → systems → topics → subtopics.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          <Plus size={16} />
          New {singular(entityDef.label)}
        </button>
      </div>

      {/* Entity tabs */}
      <div className="flex flex-wrap gap-2">
        {ENTITIES.map((entity) => (
          <button
            key={entity.key}
            onClick={() => setActiveEntity(entity.key)}
            className={clsx(
              'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
              activeEntity === entity.key
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-card text-muted-foreground hover:text-foreground'
            )}
          >
            {entity.icon}
            {entity.label}
          </button>
        ))}
      </div>

      {/* Row list / tree */}
      <div className="rounded-xl border border-border bg-card">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading taxonomy…</div>
        ) : currentRows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No {entityDef.label.toLowerCase()} yet.</div>
        ) : (
          <div className="divide-y divide-border">{renderTree()}</div>
        )}
      </div>

      {/* Create / edit modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold">
                {modal.mode === 'edit' ? `Edit ${singular(entityDef.label)}` : `New ${singular(entityDef.label)}`}
              </h3>
              <button onClick={() => setModal(null)} className="text-muted-foreground hover:text-foreground">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {(FIELD_ORDER[activeEntity] ?? []).map((field) => (
                <div key={field}>
                  <label className="mb-1 block text-sm font-medium">{FIELD_LABELS[field] ?? field}</label>
                  {renderField(field)}
                </div>
              ))}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setModal(null)} className="rounded-lg border border-border px-4 py-2 text-sm">
                  Cancel
                </button>
                <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white">
                  <Save size={14} />
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
