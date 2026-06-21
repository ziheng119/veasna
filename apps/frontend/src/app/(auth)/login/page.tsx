// app/login/page.tsx (server component)
import Login from '@/components/login/login';
import { getUsers } from '@/lib/api/user/getUsers';

export default async function LoginPage() {
  return <Login/>;
} 
