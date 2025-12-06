import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { Filter, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface ShipmentFilters {
  equipmentType: string;
  maxDistance: number;
  minWeight: number;
  maxWeight: number;
  pickupLocation: string;
}

interface ShipmentFiltersProps {
  filters: ShipmentFilters;
  onFiltersChange: (filters: ShipmentFilters) => void;
}

const equipmentTypes = [
  { value: 'all', label: 'جميع الأنواع' },
  { value: 'lowbed', label: 'لوبد' },
  { value: 'trailer', label: 'مقطورة' },
  { value: 'tipper', label: 'قلاب' },
  { value: 'crane', label: 'رافعة' },
  { value: 'flatbed', label: 'سطحة' },
];

export function ShipmentFiltersSheet({ filters, onFiltersChange }: ShipmentFiltersProps) {
  const [localFilters, setLocalFilters] = useState(filters);
  const [open, setOpen] = useState(false);

  const activeFiltersCount = [
    filters.equipmentType !== 'all',
    filters.maxDistance < 1000,
    filters.minWeight > 0,
    filters.maxWeight < 100,
    filters.pickupLocation !== ''
  ].filter(Boolean).length;

  const handleApply = () => {
    onFiltersChange(localFilters);
    setOpen(false);
  };

  const handleReset = () => {
    const defaultFilters: ShipmentFilters = {
      equipmentType: 'all',
      maxDistance: 1000,
      minWeight: 0,
      maxWeight: 100,
      pickupLocation: ''
    };
    setLocalFilters(defaultFilters);
    onFiltersChange(defaultFilters);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="h-4 w-4" />
          <span>فلترة</span>
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="h-5 w-5 p-0 flex items-center justify-center text-xs">
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <span>فلترة الشحنات</span>
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <X className="h-4 w-4 ml-1" />
              إعادة تعيين
            </Button>
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Equipment Type */}
          <div className="space-y-2">
            <Label>نوع المعدات</Label>
            <Select
              value={localFilters.equipmentType}
              onValueChange={(value) => setLocalFilters({ ...localFilters, equipmentType: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر نوع المعدات" />
              </SelectTrigger>
              <SelectContent>
                {equipmentTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Max Distance */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>المسافة القصوى</Label>
              <span className="text-sm text-muted-foreground">{localFilters.maxDistance} كم</span>
            </div>
            <Slider
              value={[localFilters.maxDistance]}
              onValueChange={([value]) => setLocalFilters({ ...localFilters, maxDistance: value })}
              max={1000}
              step={50}
              className="py-4"
            />
          </div>

          {/* Weight Range */}
          <div className="space-y-2">
            <Label>نطاق الوزن (طن)</Label>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Input
                  type="number"
                  placeholder="الحد الأدنى"
                  value={localFilters.minWeight || ''}
                  onChange={(e) => setLocalFilters({ ...localFilters, minWeight: Number(e.target.value) || 0 })}
                  min={0}
                />
              </div>
              <span className="text-muted-foreground">-</span>
              <div className="flex-1">
                <Input
                  type="number"
                  placeholder="الحد الأقصى"
                  value={localFilters.maxWeight || ''}
                  onChange={(e) => setLocalFilters({ ...localFilters, maxWeight: Number(e.target.value) || 100 })}
                  min={0}
                />
              </div>
            </div>
          </div>

          {/* Pickup Location */}
          <div className="space-y-2">
            <Label>موقع الاستلام</Label>
            <Input
              placeholder="ابحث عن موقع..."
              value={localFilters.pickupLocation}
              onChange={(e) => setLocalFilters({ ...localFilters, pickupLocation: e.target.value })}
            />
          </div>

          {/* Apply Button */}
          <Button onClick={handleApply} className="w-full">
            تطبيق الفلاتر
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export const defaultFilters: ShipmentFilters = {
  equipmentType: 'all',
  maxDistance: 1000,
  minWeight: 0,
  maxWeight: 100,
  pickupLocation: ''
};
