import { useEffect, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';

const slides = ['/images/thread-hero.png', '/images/thread-hero-olive.png'];

export default function Hero() {
  const [active, setActive] = useState(0), [paused, setPaused] = useState(false);
  const [hover, setHover] = useState(false), [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const motion = () => setReduced(media.matches), visibility = () => setHidden(document.hidden);
    media.addEventListener('change', motion); document.addEventListener('visibilitychange', visibility);
    return () => { media.removeEventListener('change', motion); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  useEffect(() => {
    if (paused || hover || focused || hidden || reduced) return;
    const timer = setInterval(() => setActive(i => (i + 1) % slides.length), 6000);
    return () => clearInterval(timer);
  }, [paused, hover, focused, hidden, reduced]);
  function select(index) { setActive((index + slides.length) % slides.length); setPaused(true); }
  return <section className="hero hero-carousel" aria-label="Les essentiels THREAD" aria-roledescription="carrousel"
    onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
    onFocusCapture={() => setFocused(true)} onBlurCapture={e => { if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false); }}>
    <div className="hero-slides" aria-hidden="true">{slides.map((src, i) => <img key={src} src={src} alt="" className={active === i ? 'hero-slide active' : 'hero-slide'} fetchPriority={i === 0 ? 'high' : 'auto'} />)}</div>
    <div className="hero-copy"><span className="eyebrow">MOINS DE SUPERFLU. PLUS DE VOUS.</span><h1>Les essentiels.<br />Tout simplement.</h1><p>Un style minimal. Une allure naturelle.<br />Vos T-shirts, au quotidien.</p><a href="#/shop" className="primary">Découvrir la collection <ArrowRight size={18} /></a></div>
    <span className="hero-note">THREAD. / LE QUOTIDIEN, AUTREMENT.</span>
    <div className="hero-controls"><button aria-label="Image précédente" onClick={() => select(active - 1)}><ChevronLeft size={17} /></button>
      {slides.map((_, i) => <button key={i} aria-label={`Afficher l’image ${i + 1}`} aria-pressed={active === i} className={`hero-dot ${active === i ? 'active' : ''}`} onClick={() => select(i)}><span /></button>)}
      <button aria-label="Image suivante" onClick={() => select(active + 1)}><ChevronRight size={17} /></button>
      {!reduced && <button aria-label={paused ? 'Activer le défilement automatique' : 'Mettre le défilement en pause'} aria-pressed={paused} onClick={() => setPaused(p => !p)}>{paused ? <Play size={14} /> : <Pause size={14} />}</button>}
    </div>
  </section>;
}
