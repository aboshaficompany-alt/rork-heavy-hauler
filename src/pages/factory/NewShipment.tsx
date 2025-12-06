import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { CalendarIcon, Loader2, ArrowRight } from 'lucide-react';
import LocationPicker from '@/components/maps/LocationPicker';

export default function NewShipment() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    equipment_type: '',
    weight: '',
    pickup_location: '',
    delivery_location: '',
    pickup_date: undefined as Date | undefined,
    notes: '',
    pickup_lat: null as number | null,
    pickup_lng: null as number | null,
    delivery_lat: null as number | null,
    delivery_lng: null as number | null
  });

  const handleChange = (field: string, value: string | Date | number | null | undefined) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.equipment_type || !formData.weight || !formData.pickup_location || !formData.delivery_location || !formData.pickup_date) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    if (!user) {
      toast.error('يجب تسجيل الدخول أولاً');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('shipments').insert({
        factory_id: user.id,
        equipment_type: formData.equipment_type,
        weight: parseFloat(formData.weight),
        pickup_location: formData.pickup_location,
        delivery_location: formData.delivery_location,
        pickup_date: format(formData.pickup_date, 'yyyy-MM-dd'),
        notes: formData.notes || null,
        status: 'open',
        pickup_lat: formData.pickup_lat,
        pickup_lng: formData.pickup_lng,
        delivery_lat: formData.delivery_lat,
        delivery_lng: formData.delivery_lng
      });

      if (error) throw error;

      toast.success('تم إنشاء الشحنة بنجاح');
      navigate('/shipments');
    } catch (error) {
      console.error('Error creating shipment:', error);
      toast.error('حدث خطأ أثناء إنشاء الشحنة');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowRight className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">شحنة جديدة</h1>
            <p className="text-muted-foreground mt-1">أضف تفاصيل طلب النقل</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-card rounded-xl p-6 border border-border space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="equipment_type">نوع المعدّة *</Label>
              <Input
                id="equipment_type"
                placeholder="مثال: مولد كهربائي، ماكينة صناعية..."
                value={formData.equipment_type}
                onChange={(e) => handleChange('equipment_type', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="weight">الوزن (طن) *</Label>
              <Input
                id="weight"
                type="number"
                step="0.1"
                min="0"
                placeholder="مثال: 25"
                value={formData.weight}
                onChange={(e) => handleChange('weight', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pickup_location">موقع الاستلام *</Label>
            <Input
              id="pickup_location"
              placeholder="العنوان الكامل لموقع الاستلام"
              value={formData.pickup_location}
              onChange={(e) => handleChange('pickup_location', e.target.value)}
            />
          </div>

          {/* Map Location Picker */}
          <LocationPicker
            pickupLat={formData.pickup_lat}
            pickupLng={formData.pickup_lng}
            deliveryLat={formData.delivery_lat}
            deliveryLng={formData.delivery_lng}
            onPickupChange={(lat, lng) => {
              handleChange('pickup_lat', lat);
              handleChange('pickup_lng', lng);
            }}
            onDeliveryChange={(lat, lng) => {
              handleChange('delivery_lat', lat);
              handleChange('delivery_lng', lng);
            }}
          />

          <div className="space-y-2">
            <Label htmlFor="delivery_location">موقع التسليم *</Label>
            <Input
              id="delivery_location"
              placeholder="العنوان الكامل لموقع التسليم"
              value={formData.delivery_location}
              onChange={(e) => handleChange('delivery_location', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>تاريخ الاستلام *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-right font-normal",
                    !formData.pickup_date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="ml-2 h-4 w-4" />
                  {formData.pickup_date ? (
                    format(formData.pickup_date, "PPP", { locale: ar })
                  ) : (
                    "اختر التاريخ"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={formData.pickup_date}
                  onSelect={(date) => handleChange('pickup_date', date)}
                  disabled={(date) => date < new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">ملاحظات إضافية</Label>
            <Textarea
              id="notes"
              placeholder="أي تفاصيل إضافية عن الشحنة..."
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              rows={4}
            />
          </div>

          <div className="flex gap-4 pt-4">
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
              إنشاء الشحنة
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              إلغاء
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
