import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export function FavoriteButton({ anilistId, inline = false }: { anilistId: number; inline?: boolean }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: favorites = [] } = useQuery({
    queryKey: ['favorites'],
    queryFn: async () => (await api.getFavorites()).anilist_ids,
    enabled: !!user,
  });

  const isFavorite = favorites.includes(anilistId);

  const toggle = useMutation({
    mutationFn: async () => {
      if (!user) {
        navigate('/login');
        return;
      }
      if (isFavorite) await api.removeFavorite(anilistId);
      else await api.addFavorite(anilistId);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['favorites'] }),
  });

  return (
    <button
      type="button"
      aria-label={isFavorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle.mutate();
      }}
      className={
        inline
          ? `shrink-0 rounded p-1 text-xl leading-none transition-colors ${
              isFavorite ? 'text-red-400' : 'text-gray-500 hover:text-red-400'
            }`
          : `rounded-full p-2 transition-colors ${
              isFavorite ? 'bg-red-500/20 text-red-400' : 'bg-black/40 text-white hover:bg-red-500/30 hover:text-red-400'
            }`
      }
    >
      {isFavorite ? '♥' : '♡'}
    </button>
  );
}
