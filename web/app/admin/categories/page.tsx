'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { flattenCategories } from '@/lib/format';
import { Badge, Card, Empty, Field, Modal, PageHeader, Spinner, useAction, useLoad } from '@/components/ui';

type Editing = { mode: 'create'; parentId?: string; parentLabel?: string } | { mode: 'edit'; node: any };

export default function Categories() {
  const { data, loading, reload } = useLoad(() => api('/api/categories?includeInactive=true'));
  const [editing, setEditing] = useState<Editing | null>(null);
  if (loading || !data) return <Spinner />;
  const rows = flattenCategories(data);
  return (
    <>
      <PageHeader title="Categories" subtitle="Each category sets the marketplace commission for its products" actions={<button className="btn-primary" onClick={() => setEditing({ mode: 'create' })}>Add category</button>} />
      <Card className="!p-0">
        {!rows.length ? <Empty>No categories yet.</Empty> : (
          <table className="tbl">
            <thead><tr><th>Category</th><th>Commission</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ paddingLeft: 16 + r.depth * 24 }} className="font-medium">{r.depth > 0 && <span className="mr-2 text-slate-300">└</span>}{r.node.name}</td>
                  <td>{Number(r.node.commissionPercent)}%</td>
                  <td>{r.node.isActive ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>}</td>
                  <td className="space-x-2 text-right">
                    <button className="btn-secondary btn-sm" onClick={() => setEditing({ mode: 'create', parentId: r.id, parentLabel: r.label })}>Add sub-category</button>
                    <button className="btn-secondary btn-sm" onClick={() => setEditing({ mode: 'edit', node: r.node })}>Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      {editing && <CategoryForm editing={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); reload(); }} />}
    </>
  );
}

function CategoryForm({ editing, onClose, onDone }: { editing: Editing; onClose: () => void; onDone: () => void }) {
  const { busy, run } = useAction();
  const node = editing.mode === 'edit' ? editing.node : null;
  const [name, setName] = useState(node?.name ?? '');
  const [commission, setCommission] = useState(String(node ? Number(node.commissionPercent) : 0));
  const [active, setActive] = useState(node?.isActive ?? true);
  const save = async () => {
    const commissionPercent = Number(commission);
    if (!(commissionPercent >= 0 && commissionPercent <= 100)) return run(async () => { throw new Error('Commission must be between 0 and 100'); });
    const ok = node
      ? await run(() => api(`/api/categories/${node.id}`, { method: 'PATCH', body: { name, commissionPercent, isActive: active } }), 'Category saved')
      : await run(() => api('/api/categories', { body: { name, commissionPercent, parentId: (editing as any).parentId } }), 'Category created');
    if (ok) onDone();
  };
  return (
    <Modal title={node ? `Edit ${node.name}` : (editing as any).parentLabel ? `New sub-category of ${(editing as any).parentLabel}` : 'New category'} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
        <Field label="Commission (%)"><input className="input" inputMode="decimal" value={commission} onChange={(e) => setCommission(e.target.value)} /></Field>
        {node && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active</label>}
        <div className="flex justify-end gap-2"><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy || !name.trim()} onClick={save}>Save</button></div>
      </div>
    </Modal>
  );
}
