import { useCallback, useEffect, useRef, useState } from 'react';

import { getProductos } from '../api/productos';
import { Producto } from '../types';

const PAGE_SIZE = 50;

export function useProductos(incluirInactivos = false) {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const pageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cargar = useCallback(
    async (reset: boolean) => {
      if (reset) {
        setLoading(true);
        pageRef.current = 1;
      } else {
        setLoadingMore(true);
      }
      setError(null);
      try {
        const data = await getProductos({
          q: query.trim(),
          page: pageRef.current,
          page_size: PAGE_SIZE,
          incluir_inactivos: incluirInactivos,
        });
        setProductos((prev) => (reset ? data.items : [...prev, ...data.items]));
        setTotal(data.total);
        hasMoreRef.current = pageRef.current * PAGE_SIZE < data.total;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al cargar productos');
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [query, incluirInactivos]
  );

  useEffect(() => {
    cargar(true);
  }, [cargar]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    cargar(true);
  }, [cargar]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMoreRef.current) return;
    pageRef.current += 1;
    cargar(false);
  }, [cargar, loading, loadingMore]);

  const buscar = useCallback((texto: string) => {
    setQuery(texto);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      pageRef.current = 1;
      cargar(true);
    }, 400);
  }, [cargar]);

  useEffect(() => () => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
  }, []);

  return {
    productos,
    total,
    loading,
    refreshing,
    loadingMore,
    error,
    query,
    buscar,
    onRefresh,
    loadMore,
  };
}