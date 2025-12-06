import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatsCard } from '@/components/ui/stats-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { supabase } from '@/integrations/supabase/client';
import { Profile, UserRole, AppRole } from '@/types/database';
import { Users, Factory, Truck, Shield, Loader2 } from 'lucide-react';

interface UserWithRole extends Profile {
  role?: AppRole;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data: profiles } = await supabase.from('profiles').select('*');
      const { data: roles } = await supabase.from('user_roles').select('*');

      const usersWithRoles = (profiles || []).map(profile => ({
        ...profile,
        role: roles?.find(r => r.user_id === profile.user_id)?.role as AppRole
      }));

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    total: users.length,
    factories: users.filter(u => u.role === 'factory').length,
    drivers: users.filter(u => u.role === 'driver').length,
    admins: users.filter(u => u.role === 'admin').length
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-3xl font-bold">إدارة المستخدمين</h1>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatsCard title="إجمالي المستخدمين" value={stats.total} icon={<Users className="h-6 w-6" />} />
          <StatsCard title="المصانع" value={stats.factories} icon={<Factory className="h-6 w-6" />} />
          <StatsCard title="السائقون" value={stats.drivers} icon={<Truck className="h-6 w-6" />} />
          <StatsCard title="المدراء" value={stats.admins} icon={<Shield className="h-6 w-6" />} />
        </div>

        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-right p-4 font-medium">الاسم</th>
                <th className="text-right p-4 font-medium">الشركة</th>
                <th className="text-right p-4 font-medium">الهاتف</th>
                <th className="text-right p-4 font-medium">الدور</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} className="border-t border-border">
                  <td className="p-4">{user.full_name}</td>
                  <td className="p-4 text-muted-foreground">{user.company_name || '-'}</td>
                  <td className="p-4 text-muted-foreground">{user.phone || '-'}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs ${user.role === 'admin' ? 'bg-primary/10 text-primary' : user.role === 'factory' ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'}`}>
                      {user.role === 'admin' ? 'مدير' : user.role === 'factory' ? 'مصنع' : 'سائق'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
