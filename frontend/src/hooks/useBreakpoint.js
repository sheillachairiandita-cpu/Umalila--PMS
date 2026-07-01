import { useState, useEffect } from 'react';

const TABLET_MIN = 768;
const LAPTOP_MIN = 1024;
const DESKTOP_MIN = 1440;

export function useBreakpoint() {
  const [width, setWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : LAPTOP_MIN,
  );

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return {
    width,
    isMobile: width < TABLET_MIN,
    isTablet: width >= TABLET_MIN && width < LAPTOP_MIN,
    isLaptop: width >= LAPTOP_MIN && width < DESKTOP_MIN,
    isDesktop: width >= LAPTOP_MIN,
    isLargeDesktop: width >= DESKTOP_MIN,
  };
}

export default useBreakpoint;
