import { redirect } from 'next/navigation';

// Registration is switched off while the UI is shown as a preview. See app/login/page.tsx.
export default function Register() {
  redirect('/login');
}
