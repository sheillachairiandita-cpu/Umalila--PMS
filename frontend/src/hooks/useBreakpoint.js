import { useState, useEffect } from 'react';

const DESKTOP_MIN = 1024;
const TABLET_MIN = 768;

export function useBreakpoint() {
  const [width, setWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : DESKTOP_MIN,
  );

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return {
    width,
    isMobile: width < TABLET_MIN,
    isTablet: width >= TABLET_MIN && width < DESKTOP_MIN,
    isDesktop: width >= DESKTOP_MIN,
  };
}

export default useBreakpoint;
