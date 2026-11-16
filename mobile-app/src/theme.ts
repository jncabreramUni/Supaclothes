import { useColorScheme } from 'react-native';
import { usePreferences, type TextSize } from './preferences';

const shared = {
  navy: '#101C2C',
  brand: '#2E9B72',
  primary: '#237C5B',
  primaryPressed: '#1B654A',
  dangerButton: '#A33845',
  dangerPressed: '#862B36',
  white: '#FFFFFF',
  heroStart: '#122538',
  heroEnd: '#1C4B4A',
  heroText: '#C5D4DC',
  heroAccent: '#85D9B3',
  loginTint: '#D9F0E6',
  adminPressed: '#243A56',
  chartRefunds: '#C56C37',
};

const light = {
  ...shared,
  canvas: '#F5F7FA',
  surface: '#FFFFFF',
  ink: '#162235',
  muted: '#5F6B7B',
  line: '#E7EBF1',
  focus: '#146C52',
  input: '#FFFFFF',
  inputLine: '#DCE2EA',
  secondaryPressed: '#F2F6F8',
  accent: '#237C5B',
  error: '#B33D4B',
  errorSurface: '#FFF0F0',
  success: '#287354',
  successSurface: '#E8F5EE',
  warning: '#9A5A21',
  warningSurface: '#FFF3DF',
};

const dark: typeof light = {
  ...shared,
  canvas: '#152131',
  surface: '#223144',
  ink: '#EDF2F8',
  muted: '#B2C0D0',
  line: '#405063',
  focus: '#8EE2BC',
  input: '#172536',
  inputLine: '#405063',
  secondaryPressed: '#263D4A',
  accent: '#8EE2BC',
  error: '#FFB6BD',
  errorSurface: '#422D37',
  success: '#8EE2BC',
  successSurface: '#1D3440',
  warning: '#FFF3DF',
  warningSurface: '#524233',
};

export const typography = {
  regular: 'Inter_400Regular',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

export const radius = { field: 8, button: 9, card: 14, login: 18 };
const textScales: Record<TextSize, number> = { normal: 1, large: 1.2, extraLarge: 1.4 };

export function useTheme() {
  const scheme = useColorScheme();
  const { colorMode, textSize } = usePreferences();
  const isDark = colorMode === 'system' ? scheme === 'dark' : colorMode === 'dark';
  return { colors: isDark ? dark : light, isDark, textScale: textScales[textSize] };
}
