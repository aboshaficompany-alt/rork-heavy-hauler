import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatsCard } from '@/components/ui/stats-card';
import { supabase } from '@/integrations/supabase/client';
import { Profile, AppRole } from '@/types/database';
import { Users, Factory, Truck, Shield, Loader2, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface UserWithRole extends Profile {
  role?: AppRole;
  vehicle?: {
    vehicle_type: string;
    plate_number: string;
    vehicle_model?: string;
  };
}

interface NewDriverForm {
  full_name: string;
  phone: string;
  email: string;
  password: string;
  vehicle_type: string;
  plate_number: string;
  vehicle_model: string;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingDriver, setIsAddingDriver] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newDriver, setNewDriver] = useState<NewDriverForm>({
    full_name: '',
    phone: '',
    email: '',
    password: '',
    vehicle_type: '',
    plate_number: '',
    vehicle_model: ''
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data: profiles } = await supabase.from('profiles').select('*');
      const { data: roles } = await supabase.from('user_roles').select('*');
      const { data: vehicles } = await supabase.from('driver_vehicles').select('*');

      const usersWithRoles = (profiles || []).map(profile => ({
        ...profile,
        role: roles?.find(r => r.user_id === profile.user_id)?.role as AppRole,
        vehicle: vehicles?.find(v => v.driver_id === profile.user_id)
      }));

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddDriver = async () => {
    if (!newDriver.full_name || !newDriver.email || !newDriver.password || !newDriver.vehicle_type || !newDriver.plate_number) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    setIsAddingDriver(true);
    try {
      // Create user via Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newDriver.email,
        password: newDriver.password,
        options: {
          data: {
            full_name: newDriver.full_name,
            phone: newDriver.phone,
            company_name: '',
            role: 'driver'
          }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('فشل في إنشاء المستخدم');

      // Add vehicle info
      const { error: vehicleError } = await supabase.from('driver_vehicles').insert({
        driver_id: authData.user.id,
        vehicle_type: newDriver.vehicle_type,
        plate_number: newDriver.plate_number,
        vehicle_model: newDriver.vehicle_model || null
      });

      if (vehicleError) throw vehicleError;

      toast.success('تم إضافة السائق بنجاح');
      setIsDialogOpen(false);
      setNewDriver({
        full_name: '',
        phone: '',
        email: '',
        password: '',
        vehicle_type: '',
        plate_number: '',
        vehicle_model: ''
      });
      fetchUsers();
    } catch (error: any) {
      console.error('Error adding driver:', error);
      toast.error(error.message || 'فشل في إضافة السائق');
    } finally {
      setIsAddingDriver(false);
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
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">إدارة المستخدمين</h1>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                إضافة سائق
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>إضافة سائق جديد</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>الاسم الكامل *</Label>
                  <Input
                    value={newDriver.full_name}
                    onChange={(e) => setNewDriver(prev => ({ ...prev, full_name: e.target.value }))}
                    placeholder="أدخل اسم السائق"
                  />
                </div>
                <div className="space-y-2">
                  <Label>البريد الإلكتروني *</Label>
                  <Input
                    type="email"
                    value={newDriver.email}
                    onChange={(e) => setNewDriver(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="example@email.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>كلمة المرور *</Label>
                  <Input
                    type="password"
                    value={newDriver.password}
                    onChange={(e) => setNewDriver(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="أدخل كلمة المرور"
                  />
                </div>
                <div className="space-y-2">
                  <Label>رقم الهاتف</Label>
                  <Input
                    value={newDriver.phone}
                    onChange={(e) => setNewDriver(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="05xxxxxxxx"
                  />
                </div>
                <div className="space-y-2">
                  <Label>نوع المركبة *</Label>
                  <Select 
                    value={newDriver.vehicle_type} 
                    onValueChange={(value) => setNewDriver(prev => ({ ...prev, vehicle_type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="اختر نوع المركبة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="سطحة">سطحة</SelectItem>
                      <SelectItem value="جوانب">جوانب</SelectItem>
                      <SelectItem value="براد">براد</SelectItem>
                      <SelectItem value="لوبد">لوبد</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>رقم اللوحة *</Label>
                  <Input
                    value={newDriver.plate_number}
                    onChange={(e) => setNewDriver(prev => ({ ...prev, plate_number: e.target.value }))}
                    placeholder="أدخل رقم اللوحة"
                  />
                </div>
                <div className="space-y-2">
                  <Label>موديل المركبة</Label>
                  <Input
                    value={newDriver.vehicle_model}
                    onChange={(e) => setNewDriver(prev => ({ ...prev, vehicle_model: e.target.value }))}
                    placeholder="مثال: تويوتا 2020"
                  />
                </div>
                <Button 
                  onClick={handleAddDriver} 
                  disabled={isAddingDriver}
                  className="w-full"
                >
                  {isAddingDriver ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin ml-2" />
                      جاري الإضافة...
                    </>
                  ) : (
                    'إضافة السائق'
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatsCard title="إجمالي المستخدمين" value={stats.total} icon={<Users className="h-6 w-6" />} />
          <StatsCard title="المنشآت" value={stats.factories} icon={<Factory className="h-6 w-6" />} />
          <StatsCard title="السائقون" value={stats.drivers} icon={<Truck className="h-6 w-6" />} />
          <StatsCard title="المدراء" value={stats.admins} icon={<Shield className="h-6 w-6" />} />
        </div>

        <div className="bg-card rounded-xl border border-border overflow-hidden overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-right p-4 font-medium">الاسم</th>
                <th className="text-right p-4 font-medium">الشركة/المركبة</th>
                <th className="text-right p-4 font-medium">الهاتف</th>
                <th className="text-right p-4 font-medium">رقم اللوحة</th>
                <th className="text-right p-4 font-medium">الدور</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                  <td className="p-4 font-medium">{user.full_name}</td>
                  <td className="p-4 text-muted-foreground">
                    {user.role === 'driver' ? user.vehicle?.vehicle_type || '-' : user.company_name || '-'}
                  </td>
                  <td className="p-4 text-muted-foreground">{user.phone || '-'}</td>
                  <td className="p-4 text-muted-foreground">
                    {user.role === 'driver' ? user.vehicle?.plate_number || '-' : '-'}
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs ${user.role === 'admin' ? 'bg-primary/10 text-primary' : user.role === 'factory' ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'}`}>
                      {user.role === 'admin' ? 'مدير' : user.role === 'factory' ? 'منشأة' : 'سائق'}
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
