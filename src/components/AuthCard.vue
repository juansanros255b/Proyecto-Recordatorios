<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import {
  auth,
  googleProvider, facebookProvider, twitterProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "../main";

const router = useRouter();

const modo = ref("login");
const email = ref("");
const password = ref("");
const nombre = ref("");
const confirmPassword = ref("");
const cargando = ref(false);
const error = ref("");
const mostrarPassword = ref(false);

const limpiarError = () => (error.value = "");

// ── Email / Password ──────────────────────────────────────────────────────────
const manejarSubmit = async () => {
  limpiarError();
  if (!email.value || !password.value) {
    error.value = "Por favor, completa todos los campos.";
    return;
  }
  if (modo.value === "register" && password.value !== confirmPassword.value) {
    error.value = "Las contraseñas no coinciden.";
    return;
  }
  if (password.value.length < 6) {
    error.value = "La contraseña debe tener al menos 6 caracteres.";
    return;
  }

  cargando.value = true;
  try {
    if (modo.value === "register") {
      await createUserWithEmailAndPassword(auth, email.value, password.value);
    } else {
      await signInWithEmailAndPassword(auth, email.value, password.value);
    }
    router.push("/recordatorios");
  } catch (err) {
    const mensajes = {
      "auth/email-already-in-use": "Este correo ya está registrado.",
      "auth/invalid-email": "Correo electrónico inválido.",
      "auth/user-not-found": "Usuario no encontrado.",
      "auth/wrong-password": "Contraseña incorrecta.",
      "auth/invalid-credential": "Credenciales inválidas.",
      "auth/too-many-requests": "Demasiados intentos. Intenta más tarde.",
    };
    error.value = mensajes[err.code] || "Ocurrió un error. Intenta de nuevo.";
  } finally {
    cargando.value = false;
  }
};

// ── Login social ──────────────────────────────────────────────────────────────
const loginSocial = async (proveedor, nombreP) => {
  limpiarError();
  cargando.value = true;
  try {
    const proveedorMap = {
      google: googleProvider,
      facebook: facebookProvider,
      twitter: twitterProvider,
    };
    await signInWithPopup(auth, proveedorMap[proveedor]);
    router.push("/recordatorios");
  } catch (err) {
    if (err.code !== "auth/popup-closed-by-user") {
      error.value = `Error al iniciar sesión con ${nombreP}.`;
    }
  } finally {
    cargando.value = false;
  }
};

const cambiarModo = (nuevoModo) => {
  modo.value = nuevoModo;
  error.value = "";
  email.value = "";
  password.value = "";
  confirmPassword.value = "";
  nombre.value = "";
};
</script>

<template>
  <div class="auth-card">
    <div class="tabs">
      <button class="tab" :class="{ activo: modo === 'login' }" @click="cambiarModo('login')">
        Iniciar sesión
      </button>
      <button class="tab" :class="{ activo: modo === 'register' }" @click="cambiarModo('register')">
        Registrarse
      </button>
      <div class="tab-indicador" :class="{ derecha: modo === 'register' }"></div>
    </div>

    <div class="formulario">
      <div v-if="error" class="alerta-error">
        <span>⚠</span> {{ error }}
      </div>

      <div v-if="modo === 'register'" class="campo">
        <label>Nombre completo</label>
        <input v-model="nombre" type="text" placeholder="Tu nombre" @input="limpiarError" />
      </div>

      <div class="campo">
        <label>Correo electrónico</label>
        <input v-model="email" type="email" placeholder="correo@ejemplo.com" @input="limpiarError" />
      </div>

      <div class="campo">
        <label>Contraseña</label>
        <div class="input-password">
          <input
            v-model="password"
            :type="mostrarPassword ? 'text' : 'password'"
            placeholder="••••••••"
            @input="limpiarError"
            @keyup.enter="manejarSubmit"
          />
          <button class="ojo" @click="mostrarPassword = !mostrarPassword" type="button">
            {{ mostrarPassword ? '🙈' : '👁' }}
          </button>
        </div>
      </div>

      <div v-if="modo === 'register'" class="campo">
        <label>Confirmar contraseña</label>
        <input
          v-model="confirmPassword"
          :type="mostrarPassword ? 'text' : 'password'"
          placeholder="••••••••"
          @input="limpiarError"
          @keyup.enter="manejarSubmit"
        />
      </div>

      <div v-if="modo === 'login'" class="olvidaste">
        <a href="#">¿Olvidaste tu contraseña?</a>
      </div>

      <button class="btn-principal" @click="manejarSubmit" :disabled="cargando">
        <span v-if="cargando" class="spinner"></span>
        <span v-else>{{ modo === 'login' ? 'Entrar a mi cuenta' : 'Crear mi cuenta' }}</span>
      </button>

      <div class="separador">
        <span class="linea"></span>
        <span class="separador-texto">o continúa con</span>
        <span class="linea"></span>
      </div>

      <div class="social-btns">
        <button class="btn-social btn-google" @click="loginSocial('google', 'Google')" :disabled="cargando">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          <span>Google</span>
        </button>

        <button class="btn-social btn-facebook" @click="loginSocial('facebook', 'Facebook')" :disabled="cargando">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="#1877F2">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
          <span>Facebook</span>
        </button>

        <button class="btn-social btn-x" @click="loginSocial('twitter', 'X')" :disabled="cargando">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.631 5.905-5.631zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
          <span>X</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-card {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.09);
  border-radius: 24px;
  padding: 36px;
  width: 100%;
  max-width: 440px;
  backdrop-filter: blur(20px);
  box-shadow: 0 40px 80px rgba(0,0,0,0.4);
}

.tabs {
  display: grid; grid-template-columns: 1fr 1fr;
  position: relative; background: rgba(255,255,255,0.05);
  border-radius: 12px; padding: 4px; margin-bottom: 28px;
}
.tab {
  padding: 11px; border: none; background: transparent;
  color: rgba(240,240,245,0.4); font-family: 'Inter', sans-serif;
  font-size: 14px; font-weight: 500; cursor: pointer;
  border-radius: 9px; transition: color 0.3s; position: relative; z-index: 1;
}
.tab.activo { color: #f0f0f5; }
.tab-indicador {
  position: absolute; top: 4px; left: 4px;
  width: calc(50% - 4px); height: calc(100% - 8px);
  background: rgba(124,92,255,0.3); border: 1px solid rgba(124,92,255,0.45);
  border-radius: 9px; transition: transform 0.3s cubic-bezier(0.4,0,0.2,1);
}
.tab-indicador.derecha { transform: translateX(100%); }

.formulario { display: flex; flex-direction: column; gap: 16px; }

.campo { display: flex; flex-direction: column; gap: 6px; }
.campo label { font-size: 13px; font-weight: 500; color: rgba(240,240,245,0.55); letter-spacing: 0.3px; }
.campo input {
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09);
  border-radius: 10px; padding: 12px 16px;
  font-family: 'Inter', sans-serif; font-size: 14px; color: #f0f0f5;
  outline: none; transition: border-color 0.2s, background 0.2s; width: 100%;
}
.campo input::placeholder { color: rgba(240,240,245,0.22); }
.campo input:focus { border-color: rgba(124,92,255,0.65); background: rgba(124,92,255,0.07); }

.input-password { position: relative; }
.input-password input { padding-right: 46px; }
.ojo {
  position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
  background: none; border: none; cursor: pointer; font-size: 15px;
  padding: 4px; opacity: 0.45; transition: opacity 0.2s;
}
.ojo:hover { opacity: 1; }

.olvidaste { text-align: right; margin-top: -6px; }
.olvidaste a { font-size: 12px; color: #7c5cff; text-decoration: none; }
.olvidaste a:hover { opacity: 0.75; }

.btn-principal {
  background: linear-gradient(135deg, #7c5cff, #5b3de8);
  border: none; border-radius: 12px; padding: 14px;
  width: 100%; color: #fff; font-family: 'Syne', sans-serif;
  font-size: 15px; font-weight: 700; cursor: pointer;
  transition: opacity 0.2s, transform 0.15s;
  margin-top: 4px; display: flex; align-items: center;
  justify-content: center; min-height: 48px;
}
.btn-principal:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
.btn-principal:disabled { opacity: 0.55; cursor: not-allowed; }

.spinner {
  width: 18px; height: 18px;
  border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff;
  border-radius: 50%; animation: girar 0.7s linear infinite;
}
@keyframes girar { to { transform: rotate(360deg); } }

.separador { display: flex; align-items: center; gap: 12px; }
.linea { flex: 1; height: 1px; background: rgba(255,255,255,0.09); }
.separador-texto { font-size: 12px; color: rgba(240,240,245,0.3); white-space: nowrap; }

.social-btns { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }

.btn-social {
  display: flex; align-items: center; justify-content: center; gap: 7px;
  padding: 11px 6px; border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.09);
  background: rgba(255,255,255,0.04);
  color: rgba(240,240,245,0.75);
  font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 500;
  cursor: pointer; transition: background 0.2s, border-color 0.2s, transform 0.15s;
}
.btn-social:hover:not(:disabled) { background: rgba(255,255,255,0.09); transform: translateY(-2px); }
.btn-social:disabled { opacity: 0.45; cursor: not-allowed; }
.btn-google:hover:not(:disabled) { border-color: rgba(66,133,244,0.4); background: rgba(66,133,244,0.08); }
.btn-facebook:hover:not(:disabled) { border-color: rgba(24,119,242,0.4); background: rgba(24,119,242,0.08); }
.btn-x:hover:not(:disabled) { border-color: rgba(240,240,245,0.3); background: rgba(255,255,255,0.08); }

.alerta-error {
  background: rgba(255,80,80,0.1); border: 1px solid rgba(255,80,80,0.3);
  border-radius: 10px; padding: 12px 14px; font-size: 13px; color: #ff8080;
  display: flex; align-items: center; gap: 8px;
}

@media (max-width: 780px) {
  .auth-card { padding: 24px; }
  .social-btns { grid-template-columns: 1fr; }
}
</style>
