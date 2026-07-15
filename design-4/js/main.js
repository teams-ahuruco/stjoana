(function(){
  var lite = window.matchMedia('(max-width: 768px)').matches
    || window.matchMedia('(prefers-reduced-motion: reduce)').matches
    || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4)
    || (navigator.connection && navigator.connection.saveData);
  if(lite) document.documentElement.classList.add('lite-ui');
})();

  const rootEl = document.documentElement;
  const isLiteUi = rootEl.classList.contains('lite-ui');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobileReveal = window.matchMedia('(max-width: 768px)').matches;

  const designClass = Array.from(document.body.classList).find(c => /^design-\d+$/.test(c)) || 'design-1';

  const animProfiles = {
    'design-1': { reanimate: true, exitAnimate: true, thresholdScale: 1 },
    'design-2': { reanimate: false, exitAnimate: false, thresholdScale: 1.1 },
    'design-3': { reanimate: true, exitAnimate: true, thresholdScale: 0.9 },
    'design-4': { reanimate: true, exitAnimate: true, thresholdScale: 1.15 }
  };
  const animProfile = animProfiles[designClass] || animProfiles['design-1'];

  const revealEls = document.querySelectorAll('.reveal');
  let scrollDir = 'down';
  let lastScrollY = window.scrollY;
  let scrollTicking = false;

  const updateScrollDir = ()=>{
    const y = window.scrollY;
    scrollDir = y > lastScrollY ? 'down' : 'up';
    lastScrollY = y;
    scrollTicking = false;
  };

  window.addEventListener('scroll', ()=>{
    if(!scrollTicking){
      scrollTicking = true;
      requestAnimationFrame(updateScrollDir);
    }
  }, { passive:true });

  if(prefersReducedMotion){
    revealEls.forEach(el=>el.classList.add('in-view'));
  } else if('IntersectionObserver' in window){
    let revealPending = false;
    const revealQueue = [];

    const flushRevealQueue = ()=>{
      revealPending = false;
      const seen = new Set();
      while(revealQueue.length){
        const entry = revealQueue.shift();
        if(seen.has(entry.target)) continue;
        seen.add(entry.target);

        const el = entry.target;
        const isVisible = el.dataset.revealVisible === '1';

        if(entry.isIntersecting){
          if(!isVisible){
            el.dataset.revealVisible = '1';
            el.classList.remove('out-up', 'out-down');
            el.classList.add('in-view');
          }
          continue;
        }

        if(isVisible){
          if(!animProfile.reanimate){
            continue;
          }
          el.classList.add('reveal-seen');
          el.dataset.revealVisible = '0';
          el.classList.remove('in-view');
          el.classList.remove('out-up', 'out-down');
          if(animProfile.exitAnimate && !isLiteUi){
            el.classList.add(scrollDir === 'up' ? 'out-up' : 'out-down');
          }
        }
      }
    };

    const baseThreshold = isLiteUi ? 0.1 : (isMobileReveal ? [0, 0.08, 0.14] : [0, 0.08, 0.16, 0.28]);
    const threshold = Array.isArray(baseThreshold)
      ? baseThreshold.map(t => Math.min(t * animProfile.thresholdScale, 0.45))
      : baseThreshold;

    const revealObserver = new IntersectionObserver((entries)=>{
      revealQueue.push(...entries);
      if(!revealPending){
        revealPending = true;
        requestAnimationFrame(flushRevealQueue);
      }
    }, {
      threshold,
      rootMargin: isLiteUi ? '0px 0px -2% 0px' : (isMobileReveal ? '0px 0px -4% 0px' : '-2% 0px -8% 0px')
    });

    revealEls.forEach(el=>{
      el.dataset.revealVisible = '0';
      revealObserver.observe(el);
    });
  } else {
    revealEls.forEach(el=>el.classList.add('in-view'));
  }

  const counterDurations = {
    'design-1': 1000,
    'design-2': 1200,
    'design-3': 900,
    'design-4': 700
  };
  const counterDuration = isMobileReveal
    ? Math.round((counterDurations[designClass] || 1000) * 0.85)
    : (counterDurations[designClass] || 1000);

  const counters = document.querySelectorAll('.num[data-count]');
  const animateCount = (el)=>{
    const target = parseInt(el.getAttribute('data-count'), 10);
    const start = performance.now();
    const step = (now)=>{
      const progress = Math.min((now - start) / counterDuration, 1);
      const eased = designClass === 'design-3'
        ? 1 - Math.pow(1 - progress, 4)
        : designClass === 'design-4'
          ? progress
          : 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target);
      if(progress < 1){ requestAnimationFrame(step); } else { el.textContent = target; }
    };
    requestAnimationFrame(step);
  };
  if('IntersectionObserver' in window && counters.length){
    const co = new IntersectionObserver((entries)=>{
      entries.forEach(entry=>{
        if(entry.isIntersecting){
          animateCount(entry.target);
          co.unobserve(entry.target);
        }
      });
    }, { threshold:0.5 });
    counters.forEach(el=>co.observe(el));
  }

  document.querySelectorAll('#navlinks a').forEach(a=>{
    a.addEventListener('click', ()=>document.getElementById('navlinks').classList.remove('open'));
  });

  const navLinks = Array.from(document.querySelectorAll('#navlinks a[href^="#"]'));
  const sectionMap = navLinks
    .map(link => ({ link, section: document.querySelector(link.getAttribute('href')) }))
    .filter(item => item.section);

  const setActiveNav = (id) => {
    navLinks.forEach(link => {
      link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
    });
  };

  const updateActiveByScroll = () => {
    const checkpoint = window.scrollY + 170;
    let currentId = sectionMap.length ? sectionMap[0].section.id : null;
    sectionMap.forEach(({ section }) => {
      if (section.offsetTop <= checkpoint) currentId = section.id;
    });
    if (currentId) setActiveNav(currentId);
  };

  let navTicking = false;
  const onScrollNav = ()=>{
    if(navTicking) return;
    navTicking = true;
    requestAnimationFrame(()=>{
      updateActiveByScroll();
      navTicking = false;
    });
  };

  if ('IntersectionObserver' in window && sectionMap.length) {
    const visibleSections = new Map();
    const spyObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          visibleSections.set(entry.target.id, entry.intersectionRatio);
        } else {
          visibleSections.delete(entry.target.id);
        }
      });
      if (visibleSections.size) {
        const topSection = [...visibleSections.entries()].sort((a, b) => b[1] - a[1])[0][0];
        setActiveNav(topSection);
      } else {
        updateActiveByScroll();
      }
    }, { threshold:[0.2, 0.4, 0.6], rootMargin:'-35% 0px -55% 0px' });

    sectionMap.forEach(({ section }) => spyObserver.observe(section));
  }

  window.addEventListener('scroll', onScrollNav, { passive:true });
  updateActiveByScroll();
