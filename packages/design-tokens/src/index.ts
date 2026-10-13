export const colors = {
  brand: {
    primary: '#E040A0',
    primaryStrong: '#A91B73',
    secondary: '#7C52AA',
    tertiary: '#0096CC',
  },
  surface: {
    canvas: '#FEF7FF',
    card: '#FFFFFF',
    muted: '#F7ECF7',
  },
  text: {
    primary: '#2E1A28',
    muted: '#604868',
    inverse: '#FFFFFF',
  },
  status: {
    success: '#147A43',
    warning: '#9A5B00',
    danger: '#B42318',
    info: '#006C91',
  },
  border: '#EAD8E7',
} as const;

export const radii = {
  card: 18,
  control: 9999,
  small: 12,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const typography = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: '700' },
  h1: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  h2: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  h3: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
} as const;

export const motion = {
  standardMs: 180,
} as const;
