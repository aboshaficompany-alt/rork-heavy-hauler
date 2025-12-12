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
import { CalendarIcon, Loader2, ArrowRight, Truck } from 'lucide-react';
import LocationPicker from '@/components/maps/LocationPicker';

const vehicleTypes = [
  { id: 'flatbed', label: 'سطحة', icon: 'flatbed' },
  { id: 'sides', label: 'جوانب', icon: 'sides' },
  { id: 'refrigerated', label: 'براد', icon: 'refrigerated' },
  { id: 'lowbed', label: 'لوبد', icon: 'lowbed' },
];

// Simple truck icon component with different styles
function TruckIcon({ type }: { type: string }) {
  return (
    <svg viewBox="0 0 80 40" fill="none" className="w-full h-full">
      {type === 'flatbed' && (
        <>
          {/* Flatbed truck */}
          <rect x="5" y="20" width="45" height="4" rx="1" stroke="currentColor" strokeWidth="2" fill="none" />
          <circle cx="15" cy="30" r="6" stroke="currentColor" strokeWidth="2" fill="hsl(var(--warning))" />
          <circle cx="25" cy="30" r="6" stroke="currentColor" strokeWidth="2" fill="hsl(var(--warning))" />
          <circle cx="35" cy="30" r="6" stroke="currentColor" strokeWidth="2" fill="hsl(var(--warning))" />
          <path d="M50 10 L50 24 L65 24 L70 20 L70 16 L65 10 Z" stroke="currentColor" strokeWidth="2" fill="none" />
          <circle cx="60" cy="30" r="6" stroke="currentColor" strokeWidth="2" fill="hsl(var(--warning))" />
          <rect x="55" y="14" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </>
      )}
      {type === 'sides' && (
        <>
          {/* Truck with sides */}
          <rect x="5" y="8" width="45" height="16" rx="1" stroke="currentColor" strokeWidth="2" fill="none" />
          <line x1="15" y1="8" x2="15" y2="24" stroke="currentColor" strokeWidth="1.5" />
          <line x1="25" y1="8" x2="25" y2="24" stroke="currentColor" strokeWidth="1.5" />
          <line x1="35" y1="8" x2="35" y2="24" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="15" cy="30" r="6" stroke="currentColor" strokeWidth="2" fill="hsl(var(--warning))" />
          <circle cx="35" cy="30" r="6" stroke="currentColor" strokeWidth="2" fill="hsl(var(--warning))" />
          <path d="M50 10 L50 24 L65 24 L70 20 L70 16 L65 10 Z" stroke="currentColor" strokeWidth="2" fill="none" />
          <circle cx="60" cy="30" r="6" stroke="currentColor" strokeWidth="2" fill="hsl(var(--warning))" />
          <rect x="55" y="14" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </>
      )}
      {type === 'refrigerated' && (
        <>
          {/* Refrigerated truck */}
          <rect x="5" y="6" width="45" height="18" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
          <circle cx="15" cy="30" r="6" stroke="currentColor" strokeWidth="2" fill="hsl(var(--warning))" />
          <circle cx="35" cy="30" r="6" stroke="currentColor" strokeWidth="2" fill="hsl(var(--warning))" />
          <path d="M50 10 L50 24 L65 24 L70 20 L70 16 L65 10 Z" stroke="currentColor" strokeWidth="2" fill="none" />
          <circle cx="60" cy="30" r="6" stroke="currentColor" strokeWidth="2" fill="hsl(var(--warning))" />
          <rect x="55" y="14" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </>
      )}
      {type === 'lowbed' && (
        <>
          {/* Lowbed trailer */}
          <path d="M5 22 L15 22 L20 28 L45 28 L45 22" stroke="currentColor" strokeWidth="2" fill="none" />
          <circle cx="10" cy="30" r="5" stroke="currentColor" strokeWidth="2" fill="hsl(var(--warning))" />
          <circle cx="20" cy="32" r="5" stroke="currentColor" strokeWidth="2" fill="hsl(var(--warning))" />
          <circle cx="35" cy="32" r="5" stroke="currentColor" strokeWidth="2" fill="hsl(var(--warning))" />
          <path d="M50 10 L50 24 L65 24 L70 20 L70 16 L65 10 Z" stroke="currentColor" strokeWidth="2" fill="none" />
          <circle cx="60" cy="30" r="6" stroke="currentColor" strokeWidth="2" fill="hsl(var(--warning))" />
          <rect x="55" y="14" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </>
      )}
    </svg>
  );
}

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

    // Validate map locations
    if (!formData.pickup_lat || !formData.pickup_lng) {
      toast.error('يرجى تحديد موقع الاستلام على الخريطة');
      return;
    }

    if (!formData.delivery_lat || !formData.delivery_lng) {
      toast.error('يرجى تحديد موقع التسليم على الخريطة');
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
          {/* Vehicle Type Selection */}
          <div className="space-y-3">
            <Label>نوع المركبة *</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {vehicleTypes.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => handleChange('equipment_type', type.label)}
                  className={cn(
                    "flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-200 hover:border-primary/50",
                    formData.equipment_type === type.label
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border bg-card hover:bg-muted/50"
                  )}
                >
                  <div className={cn(
                    "w-16 h-12 flex items-center justify-center mb-2",
                    formData.equipment_type === type.label ? "text-primary" : "text-muted-foreground"
                  )}>
                    <TruckIcon type={type.icon} />
                  </div>
                  <span className={cn(
                    "text-sm font-medium",
                    formData.equipment_type === type.label ? "text-primary" : "text-foreground"
                  )}>
                    {type.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="equipment_details">تفاصيل المعدّة</Label>
              <Input
                id="equipment_details"
                placeholder="مثال: مولد كهربائي، ماكينة صناعية..."
                value={formData.equipment_type.includes(' - ') ? formData.equipment_type.split(' - ')[1] : ''}
                onChange={(e) => {
                  // Find the base vehicle type from the current equipment_type
                  const currentVehicleType = vehicleTypes.find(t => 
                    formData.equipment_type === t.label || formData.equipment_type.startsWith(t.label + ' - ')
                  );
                  if (currentVehicleType) {
                    handleChange('equipment_type', e.target.value ? `${currentVehicleType.label} - ${e.target.value}` : currentVehicleType.label);
                  }
                }}
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
