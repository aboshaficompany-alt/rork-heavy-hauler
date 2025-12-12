import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatsCard } from '@/components/ui/stats-card';
import { supabase } from '@/integrations/supabase/client';
import { Profile, AppRole } from '@/types/database';
import { Users, Factory, Truck, Shield, Loader2, Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

interface UserWithRole extends Profile {
  role?: AppRole;
  vehicle?: {
    id: string;
    vehicle_type: string;
    plate_number: string;
    vehicle_model?: string;
  };
}

interface DriverForm {
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
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [deleteUser, setDeleteUser] = useState<UserWithRole | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [driverForm, setDriverForm] = useState<DriverForm>({
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

  const resetForm = () => {
    setDriverForm({
      full_name: '',
      phone: '',
      email: '',
      password: '',
      vehicle_type: '',
      plate_number: '',
      vehicle_model: ''
    });
    setEditingUser(null);
  };

  const openEditDialog = (user: UserWithRole) => {
    setEditingUser(user);
    setDriverForm({
      full_name: user.full_name,
      phone: user.phone || '',
      email: '',
      password: '',
      vehicle_type: user.vehicle?.vehicle_type || '',
      plate_number: user.vehicle?.plate_number || '',
      vehicle_model: user.vehicle?.vehicle_model || ''
    });
    setIsDialogOpen(true);
  };

  const handleAddDriver = async () => {
    if (!driverForm.full_name || !driverForm.email || !driverForm.password || !driverForm.vehicle_type || !driverForm.plate_number) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    setIsAddingDriver(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: driverForm.email,
        password: driverForm.password,
        options: {
          data: {
            full_name: driverForm.full_name,
            phone: driverForm.phone,
            company_name: '',
            role: 'driver'
          }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('فشل في إنشاء المستخدم');

      const { error: vehicleError } = await supabase.from('driver_vehicles').insert({
        driver_id: authData.user.id,
        vehicle_type: driverForm.vehicle_type,
        plate_number: driverForm.plate_number,
        vehicle_model: driverForm.vehicle_model || null
      });

      if (vehicleError) throw vehicleError;

      toast.success('تم إضافة السائق بنجاح');
      setIsDialogOpen(false);
      resetForm();
      fetchUsers();
    } catch (error: any) {
      console.error('Error adding driver:', error);
      toast.error(error.message || 'فشل في إضافة السائق');
    } finally {
      setIsAddingDriver(false);
    }
  };

  const handleUpdateDriver = async () => {
    if (!editingUser) return;
    if (!driverForm.full_name) {
      toast.error('يرجى ملء الاسم');
      return;
    }

    setIsAddingDriver(true);
    try {
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: driverForm.full_name,
          phone: driverForm.phone
        })
        .eq('user_id', editingUser.user_id);

      if (profileError) throw profileError;

      // Update vehicle if driver
      if (editingUser.role === 'driver' && driverForm.vehicle_type && driverForm.plate_number) {
        if (editingUser.vehicle?.id) {
          const { error: vehicleError } = await supabase
            .from('driver_vehicles')
            .update({
              vehicle_type: driverForm.vehicle_type,
              plate_number: driverForm.plate_number,
              vehicle_model: driverForm.vehicle_model || null
            })
            .eq('id', editingUser.vehicle.id);

          if (vehicleError) throw vehicleError;
        } else {
          const { error: vehicleError } = await supabase.from('driver_vehicles').insert({
            driver_id: editingUser.user_id,
            vehicle_type: driverForm.vehicle_type,
            plate_number: driverForm.plate_number,
            vehicle_model: driverForm.vehicle_model || null
          });

          if (vehicleError) throw vehicleError;
        }
      }

      toast.success('تم تحديث البيانات بنجاح');
      setIsDialogOpen(false);
      resetForm();
      fetchUsers();
    } catch (error: any) {
      console.error('Error updating:', error);
      toast.error(error.message || 'فشل في التحديث');
    } finally {
      setIsAddingDriver(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUser) return;

    setIsDeleting(true);
    try {
      // Call edge function to delete user from auth
      const { data, error: funcError } = await supabase.functions.invoke('delete-user', {
        body: { userId: deleteUser.user_id }
      });

      if (funcError) throw funcError;
      if (data?.error) throw new Error(data.error);

      toast.success('تم حذف المستخدم بنجاح');
      setDeleteUser(null);
      fetchUsers();
    } catch (error: any) {
      console.error('Error deleting:', error);
      toast.error(error.message || 'فشل في الحذف');
    } finally {
      setIsDeleting(false);
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
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                إضافة سائق
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingUser ? 'تعديل بيانات المستخدم' : 'إضافة سائق جديد'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>الاسم الكامل *</Label>
                  <Input
                    value={driverForm.full_name}
                    onChange={(e) => setDriverForm(prev => ({ ...prev, full_name: e.target.value }))}
                    placeholder="أدخل الاسم"
                  />
                </div>
                {!editingUser && (
                  <>
                    <div className="space-y-2">
                      <Label>البريد الإلكتروني *</Label>
                      <Input
                        type="email"
                        value={driverForm.email}
                        onChange={(e) => setDriverForm(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="example@email.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>كلمة المرور *</Label>
                      <Input
                        type="password"
                        value={driverForm.password}
                        onChange={(e) => setDriverForm(prev => ({ ...prev, password: e.target.value }))}
                        placeholder="أدخل كلمة المرور"
                      />
                    </div>
                  </>
                )}
                <div className="space-y-2">
                  <Label>رقم الهاتف</Label>
                  <Input
                    value={driverForm.phone}
                    onChange={(e) => setDriverForm(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="05xxxxxxxx"
                  />
                </div>
                {(!editingUser || editingUser.role === 'driver') && (
                  <>
                    <div className="space-y-2">
                      <Label>نوع المركبة {!editingUser && '*'}</Label>
                      <Select 
                        value={driverForm.vehicle_type} 
                        onValueChange={(value) => setDriverForm(prev => ({ ...prev, vehicle_type: value }))}
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
                      <Label>رقم اللوحة {!editingUser && '*'}</Label>
                      <Input
                        value={driverForm.plate_number}
                        onChange={(e) => setDriverForm(prev => ({ ...prev, plate_number: e.target.value }))}
                        placeholder="أدخل رقم اللوحة"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>موديل المركبة</Label>
                      <Input
                        value={driverForm.vehicle_model}
                        onChange={(e) => setDriverForm(prev => ({ ...prev, vehicle_model: e.target.value }))}
                        placeholder="مثال: تويوتا 2020"
                      />
                    </div>
                  </>
                )}
                <Button 
                  onClick={editingUser ? handleUpdateDriver : handleAddDriver} 
                  disabled={isAddingDriver}
                  className="w-full"
                >
                  {isAddingDriver ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin ml-2" />
                      جاري الحفظ...
                    </>
                  ) : (
                    editingUser ? 'حفظ التعديلات' : 'إضافة السائق'
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
          <table className="w-full min-w-[800px]">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-right p-4 font-medium">الاسم</th>
                <th className="text-right p-4 font-medium">الشركة/المركبة</th>
                <th className="text-right p-4 font-medium">الهاتف</th>
                <th className="text-right p-4 font-medium">رقم اللوحة</th>
                <th className="text-right p-4 font-medium">الدور</th>
                <th className="text-right p-4 font-medium">الإجراءات</th>
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
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(user)}
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteUser(user)}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <AlertDialog open={!!deleteUser} onOpenChange={() => setDeleteUser(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
              <AlertDialogDescription>
                سيتم حذف بيانات "{deleteUser?.full_name}" بشكل نهائي. لا يمكن التراجع عن هذا الإجراء.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteUser}
                disabled={isDeleting}
                className="bg-destructive hover:bg-destructive/90"
              >
                {isDeleting ? 'جاري الحذف...' : 'حذف'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
