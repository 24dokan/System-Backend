'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { date } from '@/lib/format';
import { Badge, Card, Field, Modal, PageHeader, Spinner, useAction, useLoad } from '@/components/ui';

export default function Staff() {
  const { user, can } = useAuth();
  const staff = useLoad(() => api('/api/admin/staff'));
  const roles = useLoad(() => api('/api/admin/roles'));
  const [editing, setEditing] = useState<any | 'new' | null>(null);
  const [password, setPassword] = useState<any | null>(null);
  const { busy, run } = useAction();
  if (!staff.data || !roles.data) return <Spinner />;
  if (!can('staff.manage')) return <p className="text-slate-500">You do not have access to this page.</p>;

  const toggle = async (s: any) => { if (await run(() => api(`/api/admin/staff/${s.id}`, { method: 'PATCH', body: { isActive: !s.isActive } }), s.isActive ? 'Account switched off' : 'Account switched on')) staff.reload(); };

  return (
    <>
      <PageHeader title="Staff" subtitle="Company employees who work in the back office" actions={<button className="btn-primary" onClick={() => setEditing('new')}>Add staff member</button>} />
      <Card className="!p-0">
        <table className="tbl">
          <thead><tr><th>Name</th><th>Role</th><th>Status</th><th>Added</th><th></th></tr></thead>
          <tbody>
            {staff.data.map((s: any) => (
              <tr key={s.id}>
                <td><div className="font-medium">{s.name || '—'}</div><div className="text-xs text-slate-400">{s.email}</div></td>
                <td>{s.staffRole ? s.staffRole.name : <Badge tone="blue">Super admin</Badge>}</td>
                <td>{s.isActive ? <Badge tone="green">Active</Badge> : <Badge>Switched off</Badge>}</td>
                <td className="text-slate-500">{date(s.createdAt)}</td>
                <td className="space-x-2 text-right">
                  {s.id !== user?.id && (s.staffRole || user?.superAdmin) && <>
                    <button className="btn-secondary btn-sm" onClick={() => setEditing(s)}>Edit</button>
                    <button className="btn-secondary btn-sm" onClick={() => setPassword(s)}>New password</button>
                    <button className="btn-secondary btn-sm" disabled={busy} onClick={() => toggle(s)}>{s.isActive ? 'Switch off' : 'Switch on'}</button>
                  </>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {editing && <StaffForm staff={editing === 'new' ? null : editing} roles={roles.data} onClose={() => setEditing(null)} onDone={() => { setEditing(null); staff.reload(); }} />}
      {password && <PasswordForm staff={password} onClose={() => setPassword(null)} />}
    </>
  );
}

function StaffForm({ staff, roles, onClose, onDone }: { staff: any | null; roles: any[]; onClose: () => void; onDone: () => void }) {
  const { busy, run } = useAction();
  const [name, setName] = useState(staff?.name ?? '');
  const [email, setEmail] = useState(staff?.email ?? '');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState(staff?.staffRoleId ?? roles[0]?.id ?? '');
  const save = async () => {
    const ok = staff
      ? await run(() => api(`/api/admin/staff/${staff.id}`, { method: 'PATCH', body: { name, staffRoleId: roleId } }), 'Saved')
      : await run(() => api('/api/admin/staff', { body: { name, email, password, staffRoleId: roleId } }), 'Staff member added');
    if (ok) onDone();
  };
  return (
    <Modal title={staff ? `Edit ${staff.name || staff.email}` : 'Add staff member'} onClose={onClose}>
      <div className="space-y-4">
        {!roles.length && <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">Create a role first (Roles &amp; permissions), then add staff.</p>}
        <Field label="Name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
        {!staff && <Field label="Email"><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>}
        {!staff && <Field label="Temporary password" hint="At least 10 characters. Tell the person to keep it private."><input className="input" type="text" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>}
        <Field label="Role">
          <select className="input" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </Field>
        <div className="flex justify-end gap-2"><button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy || !roleId || name.length < 2 || (!staff && (!email || password.length < 10))} onClick={save}>Save</button></div>
      </div>
    </Modal>
  );
}

function PasswordForm({ staff, onClose }: { staff: any; onClose: () => void }) {
  const { busy, run } = useAction();
  const [password, setPassword] = useState('');
  const save = async () => { if (await run(() => api(`/api/admin/staff/${staff.id}/password`, { body: { password } }).then(() => true), 'Password changed')) onClose(); };
  return (
    <Modal title={`New password for ${staff.name || staff.email}`} onClose={onClose}>
      <div className="space-y-4">
        <Field label="New password" hint="At least 10 characters"><input className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus /></Field>
        <div className="flex justify-end gap-2"><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy || password.length < 10} onClick={save}>Change password</button></div>
      </div>
    </Modal>
  );
}
