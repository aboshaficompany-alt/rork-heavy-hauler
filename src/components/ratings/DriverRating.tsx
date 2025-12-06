import { useState } from 'react';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface DriverRatingProps {
  shipmentId: string;
  driverId: string;
  factoryId: string;
  onSuccess?: () => void;
}

export function DriverRating({ shipmentId, driverId, factoryId, onSuccess }: DriverRatingProps) {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error('يرجى اختيار تقييم');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('ratings').insert({
        shipment_id: shipmentId,
        driver_id: driverId,
        factory_id: factoryId,
        rating,
        comment: comment.trim() || null
      });

      if (error) throw error;

      toast.success('تم إرسال التقييم بنجاح');
      onSuccess?.();
    } catch (error) {
      console.error('Error submitting rating:', error);
      toast.error('فشل في إرسال التقييم');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <h3 className="font-bold text-lg mb-4">قيّم السائق</h3>
      
      <div className="flex items-center gap-2 mb-4 justify-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            onMouseEnter={() => setHoveredRating(star)}
            onMouseLeave={() => setHoveredRating(0)}
            className="p-1 transition-transform hover:scale-110"
          >
            <Star
              className={cn(
                "h-8 w-8 transition-colors",
                (hoveredRating || rating) >= star
                  ? "fill-warning text-warning"
                  : "text-muted-foreground"
              )}
            />
          </button>
        ))}
      </div>

      <p className="text-center text-sm text-muted-foreground mb-4">
        {rating === 0 && 'اختر تقييمك'}
        {rating === 1 && 'سيء جداً'}
        {rating === 2 && 'سيء'}
        {rating === 3 && 'مقبول'}
        {rating === 4 && 'جيد'}
        {rating === 5 && 'ممتاز'}
      </p>

      <Textarea
        placeholder="أضف تعليقاً (اختياري)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        className="mb-4"
        rows={3}
      />

      <Button onClick={handleSubmit} disabled={loading || rating === 0} className="w-full">
        {loading ? 'جاري الإرسال...' : 'إرسال التقييم'}
      </Button>
    </Card>
  );
}

interface RatingDisplayProps {
  driverId: string;
}

export function RatingDisplay({ driverId }: RatingDisplayProps) {
  const [stats, setStats] = useState<{ avg: number; count: number } | null>(null);

  useState(() => {
    const fetchRatings = async () => {
      const { data } = await supabase
        .from('ratings')
        .select('rating')
        .eq('driver_id', driverId);

      if (data && data.length > 0) {
        const avg = data.reduce((sum, r) => sum + r.rating, 0) / data.length;
        setStats({ avg: Math.round(avg * 10) / 10, count: data.length });
      }
    };
    fetchRatings();
  });

  if (!stats) return null;

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              "h-4 w-4",
              stats.avg >= star
                ? "fill-warning text-warning"
                : stats.avg >= star - 0.5
                ? "fill-warning/50 text-warning"
                : "text-muted-foreground"
            )}
          />
        ))}
      </div>
      <span className="text-sm font-medium">{stats.avg}</span>
      <span className="text-xs text-muted-foreground">({stats.count} تقييم)</span>
    </div>
  );
}
