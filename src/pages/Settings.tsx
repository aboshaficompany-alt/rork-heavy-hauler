import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  User, 
  Building, 
  Phone, 
  Lock, 
  Bell, 
  Palette,
  Save,
  Loader2,
  CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';

export default function Settings() {
  const { profile, user, role } = useAuth();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications'>('profile');
  
  const [formData, setFormData] = useState({
    full_name: profile?.full_name || '',
    company_name: profile?.company_name || '',
    phone: profile?.phone || ''
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const handleProfileUpdate = async () => {
    if (!profile) return;
    setLoading(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          company_name: formData.company_name,
          phone: formData.phone,
          updated_at: new Date().toISOString()
        })
        .eq('id', profile.id);

      if (error) throw error;
      toast.success('تم تحديث الملف الشخصي بنجاح');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('حدث خطأ أثناء تحديث الملف الشخصي');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('كلمات المرور غير متطابقة');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (error) throw error;
      
      toast.success('تم تغيير كلمة المرور بنجاح');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      console.error('Error changing password:', error);
      toast.error('حدث خطأ أثناء تغيير كلمة المرور');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'profile' as const, label: 'الملف الشخصي', icon: User },
    { id: 'security' as const, label: 'الأمان', icon: Lock },
    { id: 'notifications' as const, label: 'الإشعارات', icon: Bell }
  ];

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold">الإعدادات</h1>
          <p className="text-muted-foreground mt-1">إدارة حسابك وتفضيلاتك</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-border pb-4">
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? 'default' : 'ghost'}
              onClick={() => setActiveTab(tab.id)}
              className="gap-2"
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </Button>
          ))}
        </div>

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="bg-card rounded-xl p-6 border border-border space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-3xl font-bold text-primary">
                  {formData.full_name?.charAt(0) || 'م'}
                </span>
              </div>
              <div>
                <h3 className="text-xl font-bold">{formData.full_name}</h3>
                <p className="text-muted-foreground">{user?.email}</p>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-sm mt-2">
                  {role === 'admin' ? 'مدير' : role === 'factory' ? 'مصنع' : 'سائق'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="full_name" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  الاسم الكامل
                </Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="أدخل اسمك الكامل"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company_name" className="flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  اسم الشركة
                </Label>
                <Input
                  id="company_name"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  placeholder="أدخل اسم شركتك"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  رقم الهاتف
                </Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="أدخل رقم هاتفك"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-border">
              <Button onClick={handleProfileUpdate} disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 ml-2" />
                )}
                حفظ التغييرات
              </Button>
            </div>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="bg-card rounded-xl p-6 border border-border space-y-6">
            <div>
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Lock className="h-5 w-5" />
                تغيير كلمة المرور
              </h3>
              <p className="text-muted-foreground text-sm mt-1">
                تأكد من استخدام كلمة مرور قوية ومختلفة عن كلمات المرور الأخرى
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 max-w-md">
              <div className="space-y-2">
                <Label htmlFor="newPassword">كلمة المرور الجديدة</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  placeholder="أدخل كلمة المرور الجديدة"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">تأكيد كلمة المرور</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  placeholder="أعد إدخال كلمة المرور الجديدة"
                />
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-border">
              <Button 
                onClick={handlePasswordChange} 
                disabled={loading || !passwordData.newPassword || !passwordData.confirmPassword}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                ) : (
                  <Lock className="h-4 w-4 ml-2" />
                )}
                تغيير كلمة المرور
              </Button>
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="bg-card rounded-xl p-6 border border-border space-y-6">
            <div>
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Bell className="h-5 w-5" />
                إعدادات الإشعارات
              </h3>
              <p className="text-muted-foreground text-sm mt-1">
                تحكم في الإشعارات التي تريد تلقيها
              </p>
            </div>

            <div className="space-y-4">
              {[
                { label: 'إشعارات العروض الجديدة', desc: 'تلقي إشعار عند ورود عرض سعر جديد' },
                { label: 'تحديثات حالة الشحنة', desc: 'تلقي إشعار عند تغيير حالة الشحنة' },
                { label: 'تذكيرات مواعيد الاستلام', desc: 'تذكير قبل موعد الاستلام بيوم' },
                { label: 'إشعارات البريد الإلكتروني', desc: 'تلقي نسخة من الإشعارات على بريدك الإلكتروني' }
              ].map((item, index) => (
                <div key={index} className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                  <div>
                    <p className="font-medium">{item.label}</p>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked={index < 2} />
                    <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                  </label>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-4 border-t border-border">
              <Button variant="outline" className="gap-2">
                <CheckCircle className="h-4 w-4" />
                تم الحفظ تلقائياً
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
