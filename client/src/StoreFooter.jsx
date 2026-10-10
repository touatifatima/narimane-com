import { Mail, MapPin, ArrowUpRight } from 'lucide-react';

function Instagram({ size = 21, ...props }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...props}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>;
}

function Facebook({ size = 21, ...props }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...props}><path d="M14 22v-9h3l.5-4H14V7c0-1.2.4-2 2-2h2V1.4C17.3 1.2 16.3 1 15 1c-3 0-5 1.8-5 5v3H7v4h3v9z" /></svg>;
}

const contacts = [
  { label: 'Instagram', detail: '@print_yaci', href: 'https://www.instagram.com/print_yaci/', Icon: Instagram },
  { label: 'Facebook', detail: 'Retrouvez-nous sur Facebook', href: 'https://www.facebook.com/share/1A3Qmmn3je/', Icon: Facebook },
  { label: 'E-mail', detail: 'yacinetouati099@gmail.com', href: 'mailto:yacinetouati099@gmail.com', Icon: Mail },
  { label: 'Localisation', detail: 'Nous trouver sur Google Maps', href: 'https://maps.app.goo.gl/u1wzRM94fWypUoBb6', Icon: MapPin },
];

export default function StoreFooter() {
  return <footer className="store-footer">
    <section className="footer-contact" aria-labelledby="footer-contact-title">
      <div className="footer-contact-intro">
        <span className="eyebrow">RESTONS EN CONTACT</span>
        <h2 id="footer-contact-title">Votre idée, notre prochaine création.</h2>
        <p>Une question, un motif à imprimer ou une envie de broderie ? Parlons de votre projet.</p>
      </div>
      <div className="footer-contact-links">
        {contacts.map(({ label, detail, href, Icon }) => <a key={label} className="footer-contact-card" href={href} {...(href.startsWith('https:') ? { target: '_blank', rel: 'noopener noreferrer', 'aria-label': `${label} : ${detail} (nouvel onglet)` } : {})}>
          <span className="footer-contact-icon"><Icon size={21} aria-hidden="true" /></span>
          <span className="footer-contact-text"><strong>{label}</strong><span>{detail}</span></span>
          <ArrowUpRight size={17} aria-hidden="true" />
        </a>)}
      </div>
    </section>
    <section className="footer-bottom" aria-label="Informations de la boutique">
      <div><a className="wordmark" href="#/">THREAD.</a><p>Les essentiels. Tout simplement.</p></div>
      <div className="footer-navigation"><a href="#/shop">La collection</a><a href="#/about">Notre univers</a></div>
      <small>© {new Date().getFullYear()} THREAD. · Algérie<br />Paiement à la livraison</small>
    </section>
  </footer>;
}
