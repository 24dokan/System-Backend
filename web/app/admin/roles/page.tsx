'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Card, Empty, Field, Modal, PageHeader, Spinner, useAction, useLoad } from '@/components/ui';

type Perm = { key: string; group: string; label: string };

export default function Roles() {
  const { can } = useAuth();
  const roles = useLoad(() => api('/api/admin/roles'));
  const perms = useLoad<Perm[]>(() => api('/api/admin/permissions'));
  const [editing, setEditing] = useState<any | 'new' | null>(null);
  if (!roles.data || !perms.data) return <Spinner />;
  if (!can('roles.manage')) return <p className="text-slate-500">You do not have access to this page.</p>;
  const label = (k: string) => perms.data!.find((p) => p.key === k)?.label ?? k;

  return (
    <>
      <PageHeader title="Roles & permissions" subtitle="A role is a set of things a staff member is allowed to do"
        actions={<button className="btn-primary" onClick={() => setEditing('new')}>Add role</button>} />
      <Card className="!p-0">
        {!roles.data.length ? <Empty>No roles yet. Super admins can do everything; create roles for everyone else.</Empty> : (
          <table className="tbl">
            <thead><tr><th>Role</th><th>Can do</th><th>Staff</th><th></th></tr></thead>
            <tbody>
              {roles.data.map((r: any) => (
                <tr key={r.id}>
                  <td><div className="font-medium">{r.name}</div><div className="text-xs text-slate-400">{r.description}</div></td>
                  <td className="max-w-md text-sm text-slate-600">{r.permissions.length ? r.permissions.map(label).join(', ') : 'Nothing'}</td>
                  <td>{r.staffCount}</td>
                  <td className="text-right"><button className="btn-secondary btn-sm" onClick={() => setEditing(r)}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <p className="mt-3 text-xs text-slate-500">Administrators without a role are super admins and can do everything.</p>
      {editing && <RoleForm role={editing === 'new' ? null : editing} perms={perms.data} onClose={() => setEditing(null)} onDone={() => { setEditing(null); roles.reload(); }} />}
    </>
  );
}

function RoleForm({ role, perms, onClose, onDone }: { role: any | null; perms: Perm[]; onClose: () => void; onDone: () => void }) {
  const { user, can } = useAuth();
  const { busy, run } = useAction();
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [picked, setPicked] = useState<string[]>(role?.permissions ?? []);
  const groups = [...new Set(perms.map((p) => p.group))];
  // You can only hand out what you hold yourself (super admins hold everything).
  const toggle = (k: string) => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  const save = async () => {
    const ok = role
      ? await run(() => api(`/api/admin/roles/${role.id}`, { method: 'PATCH', body: { name, description, permissions: picked } }), 'Role saved')
      : await run(() => api('/api/admin/roles', { body: { name, description, permissions: picked } }), 'Role created');
    if (ok) onDone();
  };
  const remove = async () => {
    if (!confirm(`Delete the role "${role.name}"?`)) return;
    if (await run(() => api(`/api/admin/roles/${role.id}`, { method: 'DELETE' }).then(() => true), 'Role deleted')) onDone();
  };
  return (
    <Modal title={role ? `Edit ${role.name}` : 'New role'} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Role name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Product reviewer" /></Field>
          <Field label="Description (optional)"><input className="input" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        </div>
        <div className="space-y-3">
          {groups.map((g) => (
            <div key={g}>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{g}</div>
              <div className="grid gap-1 sm:grid-cols-2">
                {perms.filter((p) => p.group === g).map((p) => (
                  <label key={p.key} className={`flex items-center gap-2 text-sm ${can(p.key) ? '' : 'opacity-50'}`} title={can(p.key) ? '' : 'You do not have this permission yourself'}>
                    <input type="checkbox" checked={picked.includes(p.key)} disabled={!can(p.key)} onChange={() => toggle(p.key)} /> {p.label}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between pt-2">
          <div>{role && !role.staffCount && <button className="btn-secondary" disabled={busy} onClick={remove}>Delete role</button>}</div>
          <div className="flex gap-2"><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy || name.length < 2} onClick={save}>Save</button></div>
        </div>
      </div>
    </Modal>
  );
}
