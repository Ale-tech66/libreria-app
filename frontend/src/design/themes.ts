export type Estilo = 'vidrio' | 'arcilla' | 'minimal' | 'neumorfo' | 'esqueuo' | 'aurora';

export type ThemeId =
  | 'aurora'
  | 'glass'
  | 'liquid'
  | 'spatial'
  | 'clay'
  | 'minimal'
  | 'neumorph'
  | 'skeuo';

export interface Theme {
  id: ThemeId;
  nombre: string;
  descripcion: string;
  estilo: Estilo;
  oscuro: boolean;
  /** Colores del fondo (1 color = sólido, varios = gradiente) */
  fondo: readonly string[];
  superficie: string;
  borde: string;
  texto: string;
  textoSuave: string;
  primario: string;
  primarioTexto: string;
  exito: string;
  peligro: string;
  advertencia: string;
  sombra: string;
  radio: number;
}

export const TEMAS: readonly Theme[] = [
  {
    id: 'aurora',
    nombre: 'Aurora',
    descripcion: 'Gradientes vibrantes con cristal',
    estilo: 'aurora',
    oscuro: false,
    fondo: ['#4f46e5', '#9333ea', '#db2777'],
    superficie: 'rgba(255,255,255,0.16)',
    borde: 'rgba(255,255,255,0.45)',
    texto: '#ffffff',
    textoSuave: 'rgba(255,255,255,0.85)',
    primario: '#ffffff',
    primarioTexto: '#7c3aed',
    exito: '#34d399',
    peligro: '#f87171',
    advertencia: '#fbbf24',
    sombra: '#4c1d95',
    radio: 22,
  },
  {
    id: 'glass',
    nombre: 'Glass',
    descripcion: 'Vidrio esmerilado clásico',
    estilo: 'vidrio',
    oscuro: false,
    fondo: ['#dbe7f5'],
    superficie: 'rgba(255,255,255,0.55)',
    borde: 'rgba(255,255,255,0.75)',
    texto: '#1e293b',
    textoSuave: '#64748b',
    primario: '#3b82f6',
    primarioTexto: '#ffffff',
    exito: '#22c55e',
    peligro: '#ef4444',
    advertencia: '#f59e0b',
    sombra: '#94a3b8',
    radio: 20,
  },
  {
    id: 'liquid',
    nombre: 'Liquid Glass',
    descripcion: 'Océano profundo con cristal líquido',
    estilo: 'vidrio',
    oscuro: true,
    fondo: ['#0f172a', '#164e63', '#0e7490'],
    superficie: 'rgba(255,255,255,0.10)',
    borde: 'rgba(103,232,249,0.35)',
    texto: '#e2f6ff',
    textoSuave: '#9bd8ea',
    primario: '#22d3ee',
    primarioTexto: '#083344',
    exito: '#34d399',
    peligro: '#fb7185',
    advertencia: '#fbbf24',
    sombra: '#083344',
    radio: 24,
  },
  {
    id: 'spatial',
    nombre: 'Spatial UI',
    descripcion: 'Estilo espacial con brillos',
    estilo: 'aurora',
    oscuro: true,
    fondo: ['#050816', '#0f172a', '#1e1b4b'],
    superficie: 'rgba(148,163,184,0.12)',
    borde: 'rgba(129,140,248,0.45)',
    texto: '#e6e9ff',
    textoSuave: '#9aa3c7',
    primario: '#818cf8',
    primarioTexto: '#0b1026',
    exito: '#4ade80',
    peligro: '#f87171',
    advertencia: '#fbbf24',
    sombra: '#312e81',
    radio: 18,
  },
  {
    id: 'clay',
    nombre: 'Clay',
    descripcion: 'Arcilla cálida y suave',
    estilo: 'arcilla',
    oscuro: false,
    fondo: ['#f6efe7'],
    superficie: '#fdf7f0',
    borde: '#e6d5c3',
    texto: '#4a3728',
    textoSuave: '#8a7560',
    primario: '#e0764f',
    primarioTexto: '#ffffff',
    exito: '#6a9b5e',
    peligro: '#c94f4f',
    advertencia: '#d99a3d',
    sombra: '#d8c3ab',
    radio: 26,
  },
  {
    id: 'minimal',
    nombre: 'Minimal',
    descripcion: 'Blanco, negro y un acento',
    estilo: 'minimal',
    oscuro: false,
    fondo: ['#ffffff'],
    superficie: '#ffffff',
    borde: '#e5e7eb',
    texto: '#111111',
    textoSuave: '#6b7280',
    primario: '#0a84ff',
    primarioTexto: '#ffffff',
    exito: '#16a34a',
    peligro: '#dc2626',
    advertencia: '#d97706',
    sombra: '#d1d5db',
    radio: 12,
  },
  {
    id: 'neumorph',
    nombre: 'Neumorphism',
    descripcion: 'Sombras suaves en relieve',
    estilo: 'neumorfo',
    oscuro: false,
    fondo: ['#dfe4ec'],
    superficie: '#dfe4ec',
    borde: 'rgba(255,255,255,0.6)',
    texto: '#3b4b5e',
    textoSuave: '#8b98a8',
    primario: '#5b7bd5',
    primarioTexto: '#ffffff',
    exito: '#4caf7d',
    peligro: '#d56a6a',
    advertencia: '#d9a13d',
    sombra: '#aeb9c9',
    radio: 18,
  },
  {
    id: 'skeuo',
    nombre: 'Skeuomorphism',
    descripcion: 'Texturas y biseles clásicos',
    estilo: 'esqueuo',
    oscuro: false,
    fondo: ['#f2e8d5', '#e7d8b8'],
    superficie: '#f6edd9',
    borde: '#c9b183',
    texto: '#4a3826',
    textoSuave: '#8a7254',
    primario: '#8a5a2b',
    primarioTexto: '#fdf3e3',
    exito: '#5f7d4d',
    peligro: '#a04a3a',
    advertencia: '#b98a2f',
    sombra: '#b39a72',
    radio: 10,
  },
];

export function obtenerTema(id: ThemeId): Theme {
  return TEMAS.find((t) => t.id === id) ?? TEMAS[0];
}