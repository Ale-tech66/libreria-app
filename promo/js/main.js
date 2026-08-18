document.addEventListener('DOMContentLoaded', () => {
  const elementos = document.querySelectorAll('.funcion, .paso, .captura, .descarga, .kicker, .lead, .hero-nota');

  if (!('IntersectionObserver' in window)) {
    elementos.forEach((el) => el.classList.add('visible'));
    return;
  }

  const observador = new IntersectionObserver(
    (entradas) => {
      entradas.forEach((entrada) => {
        if (entrada.isIntersecting) {
          entrada.target.classList.add('visible');
          observador.unobserve(entrada.target);
        }
      });
    },
    { threshold: 0.12 },
  );

  elementos.forEach((el) => {
    el.classList.add('aparecer');
    observador.observe(el);
  });

  document.querySelectorAll('a[href^="#"]').forEach((enlace) => {
    enlace.addEventListener('click', (e) => {
      const destino = document.querySelector(enlace.getAttribute('href'));
      if (destino) {
        e.preventDefault();
        destino.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
});