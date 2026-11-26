'use client';
import { useRef, useState } from 'react';
import { api } from '@/lib/api';
import { Card, Empty, useAction, useLoad } from '@/components/ui';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,application/pdf';

type Item = { mediaId: string; media: { id: string; kind: 'IMAGE' | 'VIDEO' | 'FILE'; mimeType: string } };

/** Shows one file. The link comes from the API (signed, expires), so it is fetched per file. */
function Thumb({ item }: { item: Item }) {
  const url = useLoad<{ url: string }>(() => api(`/api/media/${item.mediaId}/url`), [item.mediaId]);
  const box = 'h-full w-full rounded-md object-cover';
  if (!url.data) return <div className={`${box} animate-pulse bg-slate-100`} />;
  if (item.media.kind === 'IMAGE') return <img src={url.data.url} alt="" className={box} />;
  if (item.media.kind === 'VIDEO') return <video src={url.data.url} className={box} muted preload="metadata" />;
  return <a href={url.data.url} target="_blank" rel="noreferrer" className="grid h-full w-full place-items-center rounded-md bg-slate-100 text-sm text-slate-600">PDF</a>;
}

/** Upload, order and remove photos, videos and files. The first one is the cover. */
export default function ProductMedia({ p, editable, onSaved }: { p: any; editable: boolean; onSaved: () => void }) {
  const items: Item[] = p.media ?? [];
  const { busy, run } = useAction();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState('');

  const save = (ids: string[]) => api(`/api/products/${p.id}/media`, { method: 'PUT', body: { mediaIds: ids } });
  const ids = items.map((i) => i.mediaId);

  const upload = async (files: FileList) => {
    const added: string[] = [];
    for (const [n, file] of Array.from(files).entries()) {
      setProgress(`Uploading ${n + 1} of ${files.length}: ${file.name}`);
      const slot = await api<any>('/api/media/upload-url', { body: { filename: file.name, mimeType: file.type, sizeBytes: file.size } });
      const res = await fetch(slot.uploadUrl, { method: slot.method, headers: slot.headers, body: file });
      if (!res.ok) throw new Error(`Upload of ${file.name} failed (${res.status})`);
      await api(`/api/media/${slot.id}/confirm`, { method: 'POST' });
      added.push(slot.id);
    }
    setProgress('');
    await save([...ids, ...added]);
    onSaved();
  };

  const onPick = async (files: FileList | null) => {
    if (!files?.length) return;
    await run(() => upload(files).finally(() => setProgress('')));
    if (input.current) input.current.value = '';
  };
  const change = async (next: string[], msg: string) => { if (await run(() => save(next), msg) !== undefined) onSaved(); };

  return (
    <Card title="Photos and files" actions={editable && (
      <>
        <input ref={input} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => onPick(e.target.files)} />
        <button className="btn-secondary btn-sm" disabled={busy} onClick={() => input.current?.click()}>{busy ? 'Working…' : 'Add files'}</button>
      </>
    )}>
      {progress && <p className="mb-3 text-sm text-slate-500">{progress}</p>}
      {!items.length ? <Empty>No files yet. The first photo you add becomes the cover.</Empty> : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {items.map((it, i) => (
            <li key={it.mediaId}>
              <div className="relative aspect-square">
                <Thumb item={it} />
                {i === 0 && <span className="absolute left-1.5 top-1.5 rounded bg-brand px-1.5 py-0.5 text-xs text-white">Cover</span>}
              </div>
              {editable && (
                <div className="mt-1 flex gap-1 text-xs">
                  {i > 0 && <button className="btn-secondary btn-sm flex-1" disabled={busy} onClick={() => change([it.mediaId, ...ids.filter((x) => x !== it.mediaId)], 'Cover changed')}>Make cover</button>}
                  <button className="btn-secondary btn-sm flex-1" disabled={busy} onClick={() => change(ids.filter((x) => x !== it.mediaId), 'Removed')}>Remove</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-slate-400">Photos up to 10 MB (JPEG, PNG, WebP, GIF), videos up to 200 MB (MP4, MOV), PDFs up to 20 MB.</p>
    </Card>
  );
}
