import { useWindowDimensions, Platform } from 'react-native';

export const BREAKPOINTS = {
  mobile: 768,
  tablet: 1024,
};

export type BreakpointInfo = {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  width: number;
  height: number;
};

function getInitialWidth(): number {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.innerWidth;
  }
  return 0;
}

export function useBreakpoint(): BreakpointInfo {
  const dims = useWindowDimensions();
  const width = dims.width > 0 ? dims.width : getInitialWidth();
  const height = dims.height;
  return {
    isMobile: width < BREAKPOINTS.mobile,
    isTablet: width >= BREAKPOINTS.mobile && width < BREAKPOINTS.tablet,
    isDesktop: width >= BREAKPOINTS.tablet,
    width,
    height,
  };
}
