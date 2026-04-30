<script setup>
import AuthCard from "./AuthCard.vue";
</script>

<template>
  <div class="landing">
    <div class="fondo">
      <div class="orbe orbe-1"></div>
      <div class="orbe orbe-2"></div>
      <div class="orbe orbe-3"></div>
      <div class="grid-overlay"></div>
    </div>

    <div class="contenedor">
      <!-- Hero -->
      <div class="panel-hero">
        <div class="logo">
          <span class="logo-icono">◈</span>
          <span class="logo-texto">Recordify</span>
        </div>
        <div class="hero-contenido">
          <p class="hero-tag">Tu espacio personal de organización</p>
          <h1 class="hero-titulo">
            Todo bajo<br />
            <span class="titulo-acento">control.</span>
          </h1>
          <p class="hero-desc">
            Gestiona tus recordatorios, tareas y notas en un solo lugar. Simple, rápido y siempre contigo.
          </p>
          <div class="features">
            <div class="feature">
              <span class="feature-icono">⚡</span>
              <span>Recordatorios instantáneos</span>
            </div>
            <div class="feature">
              <span class="feature-icono">🔒</span>
              <span>Privacidad garantizada</span>
            </div>
            <div class="feature">
              <span class="feature-icono">☁️</span>
              <span>Sincronización en la nube</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Auth Card como componente -->
      <div class="panel-auth">
        <AuthCard />
      </div>
    </div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Inter:wght@300;400;500&display=swap');

* { box-sizing: border-box; margin: 0; padding: 0; }

.landing {
  min-height: 100vh;
  font-family: 'Inter', sans-serif;
  background: #07080d;
  color: #f0f0f5;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fondo { position: fixed; inset: 0; z-index: 0; pointer-events: none; }

.orbe {
  position: absolute; border-radius: 50%;
  filter: blur(80px); opacity: 0.22;
  animation: flotar 8s ease-in-out infinite;
}
.orbe-1 { width: 600px; height: 600px; background: radial-gradient(circle, #6c3bff, transparent); top: -200px; left: -100px; animation-delay: 0s; }
.orbe-2 { width: 500px; height: 500px; background: radial-gradient(circle, #00c6ff, transparent); bottom: -150px; right: -100px; animation-delay: 3s; }
.orbe-3 { width: 350px; height: 350px; background: radial-gradient(circle, #ff4d9d, transparent); top: 50%; left: 50%; transform: translate(-50%, -50%); animation-delay: 6s; }

.grid-overlay {
  position: absolute; inset: 0;
  background-image: linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
  background-size: 50px 50px;
}

@keyframes flotar { 0%, 100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-30px) scale(1.05); } }

.contenedor {
  position: relative; z-index: 1;
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 60px; max-width: 1100px; width: 100%;
  padding: 40px; align-items: center; min-height: 100vh;
}

.panel-hero { display: flex; flex-direction: column; gap: 40px; }

.logo { display: flex; align-items: center; gap: 10px; }
.logo-icono { font-size: 28px; color: #7c5cff; animation: rotar 4s linear infinite; display: inline-block; }
@keyframes rotar { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.logo-texto { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 22px; letter-spacing: -0.5px; }

.hero-contenido { display: flex; flex-direction: column; gap: 20px; }

.hero-tag {
  font-size: 12px; font-weight: 500; color: #7c5cff;
  text-transform: uppercase; letter-spacing: 2px;
  background: rgba(124,92,255,0.1); border: 1px solid rgba(124,92,255,0.3);
  display: inline-block; padding: 6px 14px; border-radius: 20px; width: fit-content;
}

.hero-titulo { font-family: 'Syne', sans-serif; font-weight: 800; font-size: clamp(40px,5vw,62px); line-height: 1.05; letter-spacing: -2px; }
.titulo-acento { background: linear-gradient(135deg, #7c5cff, #00c6ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.hero-desc { font-size: 15px; line-height: 1.7; color: rgba(240,240,245,0.5); max-width: 380px; }

.features { display: flex; flex-direction: column; gap: 12px; margin-top: 8px; }
.feature { display: flex; align-items: center; gap: 12px; font-size: 14px; color: rgba(240,240,245,0.65); }
.feature-icono { width: 32px; height: 32px; background: rgba(124,92,255,0.12); border: 1px solid rgba(124,92,255,0.22); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 15px; }

.panel-auth { display: flex; align-items: center; justify-content: center; }

@media (max-width: 780px) {
  .contenedor { grid-template-columns: 1fr; gap: 30px; padding: 24px; min-height: auto; padding-top: 60px; padding-bottom: 40px; }
  .panel-hero { text-align: center; align-items: center; }
  .hero-desc { max-width: 100%; }
}
</style>
