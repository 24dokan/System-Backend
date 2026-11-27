'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Badge, Card, PageHeader, Spinner, StatusBadge, useLoad } from '@/components/ui';

const yn = (v: any) => (v === true ? 'Yes' : v === false ? 'No' : '—');
const SECTIONS: [string, [string, string, boolean?][]][] = [
  ['Contact person', [['contactFirstName', 'First name'], ['contactLastName', 'Last name'], ['idNumber', 'I.C. / Passport no.'], ['contactEmail', 'Email'], ['contactPhone', 'Phone']]],
  ['Company', [['legalName', 'Legal name'], ['sstNumber', 'SST no.'], ['sellerType', 'Type of seller'], ['companyAddress', 'Address'], ['city', 'City'], ['state', 'State'], ['postcode', 'Postcode'], ['country', 'Country'], ['womanOwned', 'Woman-owned', true], ['malaysianOwned', 'Malaysian-owned', true]]],
  ['Bank account', [['bankName', 'Bank'], ['bankAccountName', 'Account owner'], ['bankAccountNumber', 'Account number'], ['bankAddress', 'Bank address']]],
  ['Store', [['storeUrl', 'Website'], ['productCategory', 'Main category'], ['productCountRange', 'Products'], ['cartSystem', 'Shopping system now'], ['stockedInMalaysia', 'Stored in Malaysia', true]]],
  ['Technical contact', [['techContactTitle', 'Title'], ['techContactName', 'Name'], ['techContactEmail', 'Email'], ['techContactMobile', 'Mobile']]],
  ['E-invoicing', [['tinNumber', 'TIN'], ['einvoiceContactName', 'Contact person'], ['einvoiceEmail', 'Email']]],
];

export default function SellerProfileView() {
  const { id } = useParams<{ id: string }>();
  const { data, loading, error } = useLoad<any>(() => api(`/api/sellers/${id}/profile`), [id]);
  if (loading) return <Spinner />;
  if (error || !data) return <p className="text-red-600">{error || 'Not found'}</p>;
  const p = data.profile;
  return (
    <>
      <PageHeader title={data.seller.name} subtitle="Store profile" actions={<><StatusBadge status={data.seller.status} /><Link className="btn-secondary" href="/admin/sellers">Back</Link></>} />
      <div className="mb-5 flex flex-wrap gap-2">
        {data.complete ? <Badge tone="green">Profile complete</Badge> : <Badge tone="amber">Profile incomplete: {data.missing.length} required fields missing</Badge>}
        {data.sensitiveHidden && <Badge tone="blue">ID and bank account numbers are hidden for your role</Badge>}
      </div>
      <div className="space-y-5">
        {SECTIONS.map(([title, rows]) => (
          <Card key={title} title={title}>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {rows.map(([k, label, bool]) => (
                <div key={k}><dt className="text-xs text-slate-500">{label}</dt><dd className="text-sm">{bool ? yn(p[k]) : p[k] || '—'}</dd></div>
              ))}
            </dl>
          </Card>
        ))}
      </div>
    </>
  );
}
