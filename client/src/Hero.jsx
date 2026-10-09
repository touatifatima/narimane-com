import { useEffect, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';

const slides = [
  { src: '/images/thread-hero-ivory-v2.png', eyebrow: 'MOINS DE SUPERFLU. PLUS DE VOUS.', title: ['Les essentiels.', 'Tout simplement.'], description: ['Un style minimal. Une allure naturelle.', 'Vos T-shirts, au quotidien.'], cta: 'Découvrir la collection' },
  { src: '/images/thread-hero-olive-v2.png', eyebrow: 'DES TONS NATURELS. DU CARACTÈRE.', title: ['L’allure libre.', 'Au naturel.'], description: ['Une touche d’olive, une silhouette simple.', 'Le style se porte sans effort.'], cta: 'Explorer la collection' },
  { src: '/images/thread-hero-casbah.png', eyebrow: 'L’ESPRIT D’ALGER. AU QUOTIDIEN.', title: ['Blanc lumineux.', 'Esprit Casbah.'], description: ['La lumière d’Alger pour inspiration.', 'Un essentiel à porter à votre façon.'], cta: 'Trouver mon essentiel' },
  { src: '/images/thread-hero-tipaza.png', eyebrow: 'UN AIR DE MÉDITERRANÉE.', title: ['L’horizon bleu.', 'L’esprit libre.'], description: ['Des nuances profondes, une allure détendue.', 'Comme une échappée sur la côte.'], cta: 'Découvrir les T-shirts' },
  { src: '/images/thread-hero.png', eyebrow: 'VOTRE STYLE. VOTRE RYTHME.', title: ['Simple à porter.', 'Facile à aimer.'], description: ['Des lignes épurées pour tous vos moments.', 'L’essentiel, c’est de se sentir soi.'], cta: 'Voir la collection' },
  { src: '/images/thread-hero-olive.png', eyebrow: 'LA SIMPLICITÉ A DU STYLE.', title: ['Moins, mais mieux.', 'Chaque jour.'], description: ['Des couleurs sobres, des idées d’associations.', 'Composez votre quotidien avec THREAD.'], cta: 'Composer mon style' },
];

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
  const slide = slides[active];
  return <section className="hero hero-carousel" aria-label="Les essentiels THREAD" aria-roledescription="carrousel"
    onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
    onFocusCapture={() => setFocused(true)} onBlurCapture={e => { if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false); }}>
    <div className="hero-slides" aria-hidden="true">{slides.map(({ src }, i) => <img key={src} src={src} alt="" className={active === i ? 'hero-slide active' : 'hero-slide'} fetchPriority={i === 0 ? 'high' : 'auto'} />)}</div>
    <div className="hero-copy"><span className="eyebrow">{slide.eyebrow}</span><h1>{slide.title[0]}<br />{slide.title[1]}</h1><p>{slide.description[0]}<br />{slide.description[1]}</p><a href="#/shop" className="primary">{slide.cta} <ArrowRight size={18} /></a></div>
    <span className="hero-note">THREAD. / LE QUOTIDIEN, AUTREMENT.</span>
    <div className="hero-controls"><button aria-label="Image précédente" onClick={() => select(active - 1)}><ChevronLeft size={17} /></button>
      {slides.map((_, i) => <button key={i} aria-label={`Afficher l’image ${i + 1}`} aria-pressed={active === i} className={`hero-dot ${active === i ? 'active' : ''}`} onClick={() => select(i)}><span /></button>)}
      <button aria-label="Image suivante" onClick={() => select(active + 1)}><ChevronRight size={17} /></button>
      {!reduced && <button aria-label={paused ? 'Activer le défilement automatique' : 'Mettre le défilement en pause'} aria-pressed={paused} onClick={() => setPaused(p => !p)}>{paused ? <Play size={14} /> : <Pause size={14} />}</button>}
    </div>
  </section>;
}
