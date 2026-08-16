import React, { useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Shield, Search, ChevronLeft, ChevronRight, FileText, X, Download, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";

interface AuditLog {
  id: number;
  action: string;
  entityType: string;
  entityLabel: string | null;
  summary: string | null;
  actorName: string | null;
  actorEmail: string | null;
  oldValues: Record<string, any> | null;
  newValues: Record<string, any> | null;
  createdAt: string;
}

const ACTION_LABELS: Record<string, string> = {
  "settings.update": "Settings updated",
  "settings.reset": "Settings reset",
  "settings.import": "Settings imported",
  "email_template.create": "Email template created",
  "email_template.update": "Email template updated",
  "email_template.publish": "Email template published",
  "email_template.archive": "Email template archived",
  "email_template.restore": "Email template restored",
  "email_template.test_send": "Test email sent",
  "coming_soon.create": "Coming Soon created",
  "coming_soon.update": "Coming Soon updated",
  "coming_soon.delete": "Coming Soon deleted",
  "announcement.create": "Announcement created",
  "announcement.update": "Announcement updated",
  "announcement.delete": "Announcement deleted",
  "user.role_change": "Role changed",
  "qbank.create": "QBank created",
  "qbank.update": "QBank updated",
  "question.create": "Question created",
  "question.update": "Question updated",
  "question.review": "Question reviewed",
};

export default function AdminAudit() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<AuditLog | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      if (action) params.set("action", action);
      if (entityType) params.set("entityType", entityType);
      const res = await apiFetch(`/api/admin/audit-logs?${params}`);
      if (!res.ok) throw new Error("Failed to load audit logs");
      const data = await res.json();
      setLogs(data.logs ?? []);
      setTotal(data.total ?? 0);
    } catch (e: any) {
      toast({ title: "Failed to load audit logs", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [action, entityType, limit, offset]);

  const entityTypes = useMemo(() => Array.from(new Set(logs.map((l) => l.entityType))), [logs]);

  // Known action keys (from ACTION_LABELS) plus any seen in the loaded logs.
  const actionOptions = useMemo(() => {
    const known = Object.keys(ACTION_LABELS);
    const seen = logs.map((l) => l.action);
    return Array.from(new Set([...known, ...seen])).sort();
  }, [logs]);

  const actionLabel = (a: string) => ACTION_LABELS[a] ?? a.replace(/[._]/g, " ");

  const exportCsv = () => {
    const header = ["Action", "Entity", "Summary", "Actor", "Email", "When"];
    const rows = logs.map((l) => [
      actionLabel(l.action),
      l.entityType,
      (l.summary ?? "").replace(/"/g, '""'),
      l.actorName ?? "",
      l.actorEmail ?? "",
      new Date(l.createdAt).toISOString(),
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `medicology-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Shield className="text-primary" size={22} /> Audit Logs</h1>
          <p className="text-sm text-muted-foreground mt-1">Every administrative change, who made it, and what changed.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select value={action} onChange={(e) => { setAction(e.target.value); setOffset(0); }}
          className="rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none">
          <option value="">All actions</option>
          {actionOptions.map((a) => <option key={a} value={a}>{actionLabel(a)}</option>)}
        </select>
        <select value={entityType} onChange={(e) => { setEntityType(e.target.value); setOffset(0); }}
          className="rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none">
          <option value="">All entity types</option>
          {entityTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <span className="text-sm text-muted-foreground">{total} log entries</span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => void load()} title="Refresh"
            className="rounded-xl border border-border p-2 hover:border-primary/40"><RefreshCw size={15} /></button>
          <button onClick={exportCsv} disabled={logs.length === 0} title="Export CSV"
            className="rounded-xl border border-border p-2 hover:border-primary/40 disabled:opacity-40"><Download size={15} /></button>
          <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}
            className="rounded-xl border border-border p-2 disabled:opacity-40 hover:border-primary/40"><ChevronLeft size={15} /></button>
          <span className="text-xs text-muted-foreground">{offset + 1}–{Math.min(offset + limit, total)}</span>
          <button disabled={offset + limit >= total} onClick={() => setOffset(offset + limit)}
            className="rounded-xl border border-border p-2 disabled:opacity-40 hover:border-primary/40"><ChevronRight size={15} /></button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-14 rounded-xl bg-muted/40 animate-pulse" />)}</div>
      ) : logs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <FileText className="mx-auto mb-3 text-muted-foreground" size={40} />
          <p className="font-semibold">No audit entries</p>
          <p className="text-sm text-muted-foreground mt-1">Administrative changes will appear here.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border bg-muted/30">
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Summary</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">When</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} onClick={() => setSelected(l)} className="border-b border-border/50 hover:bg-muted/40 cursor-pointer transition-colors">
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-primary/10 text-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">{actionLabel(l.action)}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{l.entityType}</td>
                  <td className="px-4 py-3 max-w-[320px] truncate">{l.summary ?? "—"}</td>
                  <td className="px-4 py-3">{l.actorName ?? l.actorEmail ?? "system"}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{new Date(l.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelected(null)}>
          <div className="w-full max-w-2xl max-h-[85vh] rounded-2xl bg-card shadow-2xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <p className="font-bold">{actionLabel(selected.action)}</p>
                <p className="text-xs text-muted-foreground">{selected.actorName ?? selected.actorEmail ?? "system"} · {new Date(selected.createdAt).toLocaleString()}</p>
              </div>
              <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg hover:bg-muted"><X size={16} /></button>
            </div>
            <div className="p-5 overflow-y-auto custom-scrollbar">
              <p className="text-sm mb-4">{selected.summary}</p>
              <DiffView oldValues={selected.oldValues} newValues={selected.newValues} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DiffView({ oldValues, newValues }: { oldValues: Record<string, any> | null; newValues: Record<string, any> | null }) {
  if (!oldValues && !newValues) return <p className="text-sm text-muted-foreground">No value changes recorded.</p>;
  const groups = new Set([...Object.keys(oldValues ?? {}), ...Object.keys(newValues ?? {})]);
  if (groups.size === 0) return <p className="text-sm text-muted-foreground">No value changes recorded.</p>;

  return (
    <div className="space-y-3">
      {Array.from(groups).map((group) => {
        const oldV = oldValues?.[group];
        const newV = newValues?.[group];
        const oldJson = oldV ? JSON.stringify(oldV, null, 2) : "(defaults)";
        const newJson = newV ? JSON.stringify(newV, null, 2) : "(removed)";
        return (
          <div key={group} className="rounded-xl border border-border overflow-hidden">
            <p className="px-4 py-2 bg-muted/40 text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border">{group}</p>
            <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border">
              <div className="p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-red-500 mb-1">Before</p>
                <pre className="text-xs whitespace-pre-wrap break-all text-muted-foreground max-h-56 overflow-y-auto">{oldJson}</pre>
              </div>
              <div className="p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-green-600 mb-1">After</p>
                <pre className="text-xs whitespace-pre-wrap break-all text-muted-foreground max-h-56 overflow-y-auto">{newJson}</pre>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
