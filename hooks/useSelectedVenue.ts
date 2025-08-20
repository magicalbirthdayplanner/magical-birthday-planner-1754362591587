import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface SelectedVenue {
  id: string;
  venueId: string;
  title: string;
  address: string;
  rating?: number;
  reviewsCount?: number;
  phone?: string;
  website?: string;
  imageUrl?: string;
  category?: string;
  coordinates?: any;
  selected: boolean;
  createdAt: string;
}

export function useSelectedVenue() {
  const { user } = useAuth();
  const [selectedVenue, setSelectedVenue] = useState<SelectedVenue | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSelectedVenue = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/venue-favorites/selected');
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setSelectedVenue(data.selectedVenue);
          }
        }
      } catch (error) {
        console.error('Error fetching selected venue:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSelectedVenue();
  }, [user]);

  return { selectedVenue, loading, refetch: () => setLoading(true) };
}