import { useWindowDimensions } from 'react-native';

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

export function useBreakpoint(): BreakpointInfo {
  const { width, height } = useWindowDimensions();
  return {
    isMobile: width < BREAKPOINTS.mobile,
    isTablet: width >= BREAKPOINTS.mobile && width < BREAKPOINTS.tablet,
    isDesktop: width >= BREAKPOINTS.tablet,
    width,
    height,
  };
}
