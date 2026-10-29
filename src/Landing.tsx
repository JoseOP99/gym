import {
  Activity,
  ArrowDown,
  ArrowUpRight,
  Check,
  Dumbbell,
  HeartPulse,
  MoveUpRight,
  ShieldCheck,
} from "lucide-react";
import { Footer } from "./components";
import "./Landing.css";
const hero =
  "https://images.unsplash.com/photo-1526403646408-57b94dc15399?auto=format&fit=crop&w=1800&q=85";
const weights =
  "https://images.unsplash.com/photo-1603077492579-39ff927823db?auto=format&fit=crop&w=1000&q=80";
export default function Landing({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="landing">
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>
      <header className="landing-nav">
        <a className="brand" href="#inicio" aria-label="GYM inicio">
          <Activity size={30} /> GYM<span className="brand-dot">.</span>
        </a>
        <nav aria-label="Navegación pública">
          <a href="#entrena">Entrena</a>
          <a href="#planes">Planes</a>
          <a href="#empieza">Empieza aquí</a>
        </nav>
        <a className="login-link" href={signedIn ? "#panel" : "#login"}>
          {signedIn ? "Mi gimnasio" : "Ingresar"}
          <ArrowUpRight size={16} />
        </a>
      </header>
      <main id="contenido">
        <section className="gym-hero" aria-labelledby="hero-title">
          <img
            className="gym-hero-image"
            src={hero}
            alt="Atleta preparando un levantamiento con barra en un gimnasio"
            fetchPriority="high"
            width="1800"
            height="1200"
          />
          <div className="gym-hero-shade" />
          <div className="gym-hero-content">
            <p className="landing-kicker">
              <span /> TU PRÓXIMA VERSIÓN EMPIEZA AQUÍ
            </p>
            <h1 id="hero-title">
              NO ES SUERTE.
              <br />
              ES <span>CONSTANCIA.</span>
            </h1>
            <p>
              Un día para empezar. Un espacio para avanzar.
              <br />
              Haz del entrenamiento una parte de ti.
            </p>
            <a href="#planes" className="lime-button">
              Encuentra tu plan <ArrowUpRight size={20} />
            </a>
          </div>
          <div className="hero-bottom">
            <span>FUERZA. ENERGÍA. DISCIPLINA.</span>
            <a href="#entrena">
              DESCUBRE GYM <ArrowDown size={15} />
            </a>
          </div>
          <span className="hero-side-label" aria-hidden="true">
            BUILD YOUR OWN STRONG — GYM
          </span>
        </section>
        <div className="discipline-strip" aria-hidden="true">
          <span>ENTRENA A TU RITMO</span>
          <span>✳</span>
          <span>SUPERA TUS LÍMITES</span>
          <span>✳</span>
          <span>VUELVE POR TI</span>
          <span>✳</span>
        </div>
        <section id="entrena" className="training-section landing-section">
          <div className="training-photo">
            <img
              src={weights}
              alt="Mancuernas y equipo de entrenamiento de fuerza"
              loading="lazy"
              width="1000"
              height="1000"
            />
            <div className="photo-caption">
              <span>MENOS EXCUSAS.</span>
              <strong>MÁS MOVIMIENTO.</strong>
            </div>
          </div>
          <div className="training-copy">
            <p className="landing-kicker dark">01 / ENCUENTRA TU RITMO</p>
            <h2>
              El cambio empieza
              <br />
              con una repetición.
            </h2>
            <p className="section-intro">
              No necesitas tenerlo todo resuelto para empezar. Encuentra la
              forma de entrenar que encaja contigo y construye tu siguiente
              objetivo, paso a paso.
            </p>
            <div className="training-detail">
              <Dumbbell />
              <div>
                <h3>Construye fuerza</h3>
                <p>Pesas, técnica y progreso. Una repetición a la vez.</p>
              </div>
            </div>
            <div className="training-detail">
              <HeartPulse />
              <div>
                <h3>Activa tu energía</h3>
                <p>Muévete, encuentra tu ritmo y disfruta el proceso.</p>
              </div>
            </div>
            <div className="training-detail">
              <ShieldCheck />
              <div>
                <h3>Hazlo un hábito</h3>
                <p>Elige un pase o una membresía según tu rutina.</p>
              </div>
            </div>
          </div>
        </section>
        <section id="planes" className="plans-section landing-section">
          <div className="plans-heading">
            <div>
              <p className="landing-kicker dark">02 / UN PLAN PARA EMPEZAR</p>
              <h2>
                Tu objetivo.
                <br />
                Tu compromiso.
              </h2>
            </div>
            <p>
              Prueba un día o dale continuidad a tu rutina.
              <br />
              <span>
                Tarifas iniciales de referencia, en pesos colombianos.
              </span>
            </p>
          </div>
          <div className="plans-grid">
            <article className="plan">
              <span className="plan-index">01</span>
              <p className="plan-name">A tu ritmo</p>
              <h3>Pase diario</h3>
              <p className="price">
                $15.000 <span>/ día</span>
              </p>
              <p className="plan-description">
                Para conocer el espacio o entrenar cuando tu agenda lo permita.
              </p>
              <ul>
                <li>
                  <Check size={17} /> Un ingreso por pase
                </li>
                <li>
                  <Check size={17} /> Sin membresía mensual
                </li>
                <li>
                  <Check size={17} /> Pago en recepción
                </li>
              </ul>
              <a href="#empieza" className="plan-button">
                Quiero empezar <ArrowUpRight size={19} />
              </a>
            </article>
            <article className="plan featured">
              <span className="plan-tag">DALE CONTINUIDAD</span>
              <span className="plan-index">02</span>
              <p className="plan-name">Hazlo parte de ti</p>
              <h3>Membresía</h3>
              <p className="price">
                $100.000 <span>/ 30 días</span>
              </p>
              <p className="plan-description">
                Un espacio en tu rutina para trabajar por lo que quieres
                conseguir.
              </p>
              <ul>
                <li>
                  <Check size={17} /> Vigencia de 30 días
                </li>
                <li>
                  <Check size={17} /> Renovación en recepción
                </li>
                <li>
                  <Check size={17} /> Conserva tus días al renovar antes
                </li>
              </ul>
              <a href="#empieza" className="lime-button">
                Este es mi plan <ArrowUpRight size={19} />
              </a>
            </article>
          </div>
          <p className="plans-note">
            Los servicios, horarios y valores definitivos se confirman en
            recepción. Imágenes de referencia.
          </p>
        </section>
        <section id="empieza" className="start-section">
          <div>
            <p className="landing-kicker">03 / EL PRIMER PASO ES TUYO</p>
            <h2>
              HOY TAMBIÉN
              <br />
              ES UN BUEN DÍA.
            </h2>
            <p>
              Acércate a recepción para conocer el gimnasio,
              <br />
              elegir tu plan y registrar tu primera visita.
            </p>
          </div>
          <div className="start-mark" aria-hidden="true">
            <MoveUpRight />
          </div>
          <div className="staff-access">
            <span>¿ERES PARTE DEL EQUIPO?</span>
            <p>
              Tu gimnasio, tus herramientas,
              <br />
              todo en un mismo lugar.
            </p>
            <a href={signedIn ? "#panel" : "#login"}>
              {signedIn ? "Ir a mi gimnasio" : "Ingresar al panel"}{" "}
              <ArrowUpRight size={18} />
            </a>
          </div>
        </section>
      </main>
      <div className="landing-footer">
        <div>
          <a className="brand" href="#inicio">
            <Activity size={24} /> GYM.
          </a>
          <span>Entrena por ti.</span>
        </div>
        <p>
          Fotografías de{" "}
          <a
            href="https://unsplash.com/@victorfreitas"
            target="_blank"
            rel="noreferrer"
          >
            Victor Freitas
          </a>{" "}
          y{" "}
          <a
            href="https://unsplash.com/@greg_rosenke"
            target="_blank"
            rel="noreferrer"
          >
            Greg Rosenke
          </a>{" "}
          / Unsplash
        </p>
        <Footer />
      </div>
    </div>
  );
}
