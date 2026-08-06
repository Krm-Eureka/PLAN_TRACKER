import React from 'react';
import { Task, ViewMode } from 'gantt-task-react';

export function useGanttScrollSync(
  wrapperRef: React.RefObject<HTMLDivElement | null>,
  ganttTasks: Task[],
  view: ViewMode
) {
  const realScrollLeft = React.useRef(0);

  // Touch scroll support for mobile via Native Browser Scrolling
  React.useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    
    let header: HTMLElement | null = null;
    let grid: HTMLElement | null = null;
    let scrollbar: HTMLElement | null = null;
    
    const svgs = wrapper.querySelectorAll('svg');
    if (svgs.length >= 2) {
      header = svgs[svgs.length - 2].parentElement as HTMLElement;
      grid = svgs[svgs.length - 1].parentElement as HTMLElement;
    }
    
    const divs = Array.from(wrapper.getElementsByTagName('div'));
    for (let i = divs.length - 1; i >= 0; i--) {
      if (divs[i].dir === 'ltr' && divs[i] !== header && divs[i] !== grid) {
        scrollbar = divs[i] as HTMLElement;
        break;
      }
    }

    if (!grid) return;

    // Enable native horizontal scrolling on the grid container
    grid.style.setProperty('overflow-x', 'auto', 'important');
    grid.style.setProperty('-webkit-overflow-scrolling', 'touch');
    
    // Hide the native scrollbar visually on the grid
    grid.style.setProperty('scrollbar-width', 'none'); 
    grid.style.setProperty('-ms-overflow-style', 'none'); 
    grid.classList.add('hide-scrollbar');

    let isSyncing = false;
    
    const handleNativeScroll = () => {
      if (isSyncing) return;
      isSyncing = true;
      
      const currentScroll = grid!.scrollLeft;
      realScrollLeft.current = currentScroll;
      
      // Visually sync the other containers
      if (header) header.scrollLeft = currentScroll;
      if (scrollbar) scrollbar.scrollLeft = currentScroll;
      
      isSyncing = false;
    };

    grid.addEventListener('scroll', handleNativeScroll, { passive: true });

    return () => {
      grid!.removeEventListener('scroll', handleNativeScroll);
    };
  }, [ganttTasks, view, wrapperRef]);

  // Enforce scroll position after renders to beat gantt-task-react's snapback
  React.useEffect(() => {
    if (wrapperRef.current && realScrollLeft.current > 0) {
      const svgs = wrapperRef.current.querySelectorAll('svg');
      if (svgs.length >= 2) {
        const headerCont = svgs[svgs.length - 2].parentElement;
        const gridCont = svgs[svgs.length - 1].parentElement;
        if (headerCont) headerCont.scrollLeft = realScrollLeft.current;
        if (gridCont) gridCont.scrollLeft = realScrollLeft.current;
      }
    }
  });

  return realScrollLeft;
}
