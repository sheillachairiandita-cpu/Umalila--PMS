import { useQuery, useQueryClient } from '@tanstack/react-query';
import { bookingsApi } from '../../api';
import { useFinancialIncome } from './useFinancial';
import { sortReservationsByRecency } from '../../utils/bookingUtils';

function enrichBookingsWithLedger(bookings, incomeRows) {
  const ledgerById = Object.fromEntries((incomeRows || []).map((row) => [row.bookingId, row]));
  return (bookings || []).map((b) => ({
    ...b,
    ledger_total: ledgerById[b.id]?.total ?? b.total_price,
    ledger_discount: ledgerById[b.id]?.discountAmount ?? 0,
  }));
}

export function useBookings(options = {}) {
  const { limit = 500, enabled = true } = options;
  return useQuery({
    queryKey: ['bookings', { limit }],
    queryFn: () => bookingsApi.list({ limit }),
    staleTime: 30_000,
    enabled,
  });
}

export function useReservationsData(options = {}) {
  const bookingsQuery = useBookings(options);
  const incomeQuery = useFinancialIncome(options);

  const enriched = enrichBookingsWithLedger(bookingsQuery.data, incomeQuery.data);

  const pending = enriched
    .filter((b) => b.status === 'pending')
    .map((b) => ({
      ...b,
      guest_full_name: b.guests?.full_name || 'Unknown Guest',
      adults: parseInt(b.notes?.match(/Adults:\s*(\d+)/)?.[1] || '0', 10),
      children: parseInt(b.notes?.match(/Children:\s*(\d+)/)?.[1] || '0', 10),
    }));

  const reservations = sortReservationsByRecency(
    enriched
      .filter((b) => b.status !== 'pending')
      .map((b) => ({
        ...b,
        guest_full_name: b.guests?.full_name || 'Unknown Guest',
        payment_status: b.status === 'cancelled' ? 'cancelled' : (b.payment_status || 'pending'),
        phase_status: b.status === 'cancelled' ? 'cancelled' : (b.stay_phase || b.status),
      })),
  );

  const stats = {
    totalBookings: enriched.length,
    pendingApproval: pending.length,
    confirmedBookings: reservations.filter((b) => b.status === 'confirmed').length,
  };

  return {
    pendingRequests: pending,
    allReservations: reservations,
    stats,
    isLoading: bookingsQuery.isLoading || incomeQuery.isLoading,
    isFetching: bookingsQuery.isFetching || incomeQuery.isFetching,
    error: bookingsQuery.error || incomeQuery.error,
    refetch: async () => {
      await Promise.all([bookingsQuery.refetch(), incomeQuery.refetch()]);
    },
  };
}

export function useInvalidateBookings() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['bookings'] });
}
