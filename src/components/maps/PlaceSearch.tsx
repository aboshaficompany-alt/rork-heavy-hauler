import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, MapPin, Loader2, X, History, Navigation2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface PlaceResult {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

interface PlaceSearchProps {
  onSelect: (place: PlaceResult) => void;
  placeholder?: string;
  className?: string;
  defaultValue?: string;
}

export function PlaceSearch({ 
  onSelect, 
  placeholder = "ابحث عن موقع...",
  className,
  defaultValue = ""
}: PlaceSearchProps) {
  const [query, setQuery] = useState(defaultValue);
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [recentSearches, setRecentSearches] = useState<PlaceResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('recent-place-searches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved).slice(0, 5));
      } catch (e) {
        console.error('Error loading recent searches:', e);
      }
    }
  }, []);

  // Save to recent searches
  const saveToRecent = useCallback((place: PlaceResult) => {
    const updated = [place, ...recentSearches.filter(p => p.id !== place.id)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('recent-place-searches', JSON.stringify(updated));
  }, [recentSearches]);

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search with debounce
  const searchPlaces = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('mapbox-geocode', {
        body: { query: searchQuery, country: 'SA' }
      });

      if (error) throw error;
      
      if (data?.features) {
        const places: PlaceResult[] = data.features.map((f: any) => ({
          id: f.id,
          name: f.text || f.place_name?.split(',')[0] || '',
          address: f.place_name || '',
          lat: f.center[1],
          lng: f.center[0]
        }));
        setResults(places);
      }
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (value: string) => {
    setQuery(value);
    setShowResults(true);
    
    // Debounce search
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(() => {
      searchPlaces(value);
    }, 300);
  };

  const handleSelect = (place: PlaceResult) => {
    setQuery(place.name);
    setShowResults(false);
    saveToRecent(place);
    onSelect(place);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => setShowResults(true)}
          placeholder={placeholder}
          className="pr-10 pl-10"
          dir="rtl"
        />
        {query && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={handleClear}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
        {loading && (
          <Loader2 className="absolute left-10 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />
        )}
      </div>

      {/* Results Dropdown */}
      {showResults && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-xl z-50 max-h-80 overflow-auto">
          {/* Recent Searches */}
          {!query && recentSearches.length > 0 && (
            <div className="p-2">
              <p className="text-xs text-muted-foreground px-3 py-2 flex items-center gap-2">
                <History className="h-3 w-3" />
                عمليات البحث الأخيرة
              </p>
              {recentSearches.map((place) => (
                <button
                  key={place.id}
                  type="button"
                  className="w-full text-right px-3 py-3 hover:bg-accent rounded-lg transition-colors flex items-start gap-3"
                  onClick={() => handleSelect(place)}
                >
                  <MapPin className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{place.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{place.address}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Search Results */}
          {query && results.length > 0 && (
            <div className="p-2">
              {results.map((place) => (
                <button
                  key={place.id}
                  type="button"
                  className="w-full text-right px-3 py-3 hover:bg-accent rounded-lg transition-colors flex items-start gap-3"
                  onClick={() => handleSelect(place)}
                >
                  <Navigation2 className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{place.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{place.address}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* No Results */}
          {query && !loading && results.length === 0 && (
            <div className="p-6 text-center text-muted-foreground">
              <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">لا توجد نتائج لـ "{query}"</p>
            </div>
          )}

          {/* Loading State */}
          {query && loading && results.length === 0 && (
            <div className="p-6 text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground mt-2">جاري البحث...</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
