<script setup>
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import {
  auth,
  db,
  signOut,
  collection,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  ADMIN_UID,
} from "../main";

const router = useRouter();

const cerrarSesion = async () => {
  await signOut(auth);
  router.push("/");
};

// ── Estado ───────────────────────────────────────────────────────────────────
const cargando = ref(true);
const busqueda = ref("");

// Mapa: uid → { email, nombre, notas[] }
const usuarios = ref({});

const PRIORIDADES = ["Low", "Normal", "High"];
const ORDEN = { High: 0, Normal: 1, Low: 2 };

// Edición
const editandoId = ref(null);
const editandoTexto = ref("");

// Preview modal
const previewModal = ref(null);

// ── Cargar todas las notas agrupadas por uid ─────────────────────────────────
onMounted(async () => {
  try {
    const snapNotas = await getDocs(collection(db, "recordatorios"));
    const todasNotas = snapNotas.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      creadaEn:
        d.data().creadaEn?.toDate?.()?.toISOString() ??
        new Date().toISOString(),
    }));

    const infoUsuarios = {};
    try {
      const snapUsuarios = await getDocs(collection(db, "usuarios"));
      snapUsuarios.docs.forEach((d) => {
        infoUsuarios[d.id] = d.data();
      });
    } catch {
      // colección "usuarios" no existe
    }

    const mapa = {};
    todasNotas.forEach((nota) => {
      const uid = nota.correo || "sin-uid";
      if (!mapa[uid]) {
        const info = infoUsuarios[uid];
        mapa[uid] = {
          uid,
          email: info?.email || nota.email || null,
          nombre: info?.nombre || nota.nombre || null,
          notas: [],
        };
      }
      mapa[uid].notas.push(nota);
    });

    Object.values(mapa).forEach((u) => {
      u.notas.sort((a, b) => ORDEN[a.prioridad] - ORDEN[b.prioridad]);
    });

    usuarios.value = mapa;
  } catch (e) {
    console.error("Error cargando datos de administración:", e);
  } finally {
    cargando.value = false;
  }
});

// ── Computed ──────────────────────────────────────────────────────────────────
const usuariosFiltrados = computed(() => {
  const texto = busqueda.value.toLowerCase().trim();
  return Object.values(usuarios.value).filter((u) => {
    if (!texto) return true;
    return (
      (u.email || "").toLowerCase().includes(texto) ||
      (u.nombre || "").toLowerCase().includes(texto) ||
      u.notas.some((n) => (n.texto || "").toLowerCase().includes(texto))
    );
  });
});

const totalNotas = computed(() =>
  Object.values(usuarios.value).reduce((acc, u) => acc + u.notas.length, 0),
);

const totalUsuarios = computed(() => Object.keys(usuarios.value).length);

// ── Acciones sobre notas ──────────────────────────────────────────────────────

// Completar / descompletar
const toggleCompletada = async (uid, id) => {
  const nota = usuarios.value[uid]?.notas.find((n) => n.id === id);
  if (!nota) return;
  nota.completada = !nota.completada;
  try {
    await updateDoc(doc(db, "recordatorios", id), {
      completada: nota.completada,
    });
    // Reordenar notas del usuario
    usuarios.value[uid].notas.sort(
      (a, b) => ORDEN[a.prioridad] - ORDEN[b.prioridad],
    );
  } catch (e) {
    nota.completada = !nota.completada;
    console.error("Error actualizando nota:", e);
  }
};

// Borrar nota
const borrarNota = async (uid, id) => {
  usuarios.value[uid].notas = usuarios.value[uid].notas.filter(
    (n) => n.id !== id,
  );
  try {
    await deleteDoc(doc(db, "recordatorios", id));
  } catch (e) {
    console.error("Error borrando nota:", e);
  }
};

// Cambiar prioridad
const cambiarPrioridad = async (uid, id, nuevaPrioridad) => {
  const nota = usuarios.value[uid]?.notas.find((n) => n.id === id);
  if (!nota) return;
  nota.prioridad = nuevaPrioridad;
  try {
    await updateDoc(doc(db, "recordatorios", id), {
      prioridad: nuevaPrioridad,
    });
    // Reordenar
    usuarios.value[uid].notas.sort(
      (a, b) => ORDEN[a.prioridad] - ORDEN[b.prioridad],
    );
  } catch (e) {
    console.error("Error cambiando prioridad:", e);
  }
};

// Edición
const iniciarEdicion = (nota) => {
  editandoId.value = nota.id;
  editandoTexto.value = nota.texto;
};

const guardarEdicion = async (uid, id) => {
  const texto = editandoTexto.value.trim();
  const nota = usuarios.value[uid]?.notas.find((n) => n.id === id);
  if (nota && texto) {
    nota.texto = texto;
    try {
      await updateDoc(doc(db, "recordatorios", id), { texto });
    } catch (e) {
      console.error("Error editando nota:", e);
    }
  }
  editandoId.value = null;
};

const cancelarEdicion = () => {
  editandoId.value = null;
};

// ── Preview modal ─────────────────────────────────────────────────────────────
const abrirPreview = (adjunto) => {
  previewModal.value = adjunto;
};
const cerrarPreview = () => {
  previewModal.value = null;
};

const esImagen = (tipo) => tipo?.startsWith("image/");
const esPDF = (tipo) => tipo === "application/pdf";
const esVideo = (tipo) => tipo?.startsWith("video/");

// ── Helpers ───────────────────────────────────────────────────────────────────
const tiempoRelativo = (iso) => {
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60) return `hace ${diff}s`;
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
  return `hace ${Math.floor(diff / 86400)}d`;
};

const inicialAvatar = (nombre) =>
  nombre ? nombre.charAt(0).toUpperCase() : "?";

const colorAvatar = (uid) => {
  const colores = [
    "#7c5cff",
    "#00c6ff",
    "#ff4d9d",
    "#f38ba8",
    "#a6e3a1",
    "#fab387",
    "#89b4fa",
    "#cba6f7",
  ];
  let hash = 0;
  for (let i = 0; i < uid.length; i++)
    hash = uid.charCodeAt(i) + ((hash << 5) - hash);
  return colores[Math.abs(hash) % colores.length];
};
</script>

<template>
  <div class="app">
    <!-- Header -->
    <header class="header">
      <div class="header-izq">
        <span class="header-badge">🛡️ Admin</span>
        <h1 class="titulo">Panel de Administración</h1>
      </div>
      <div class="header-der">
        <button class="btn-usuarios" @click="router.push('/recordatorios')">
          📋 Mis recordatorios
        </button>
        <button class="btn-logout" @click="cerrarSesion">
          <span>⎋</span> Cerrar sesión
        </button>
      </div>
    </header>

    <main class="main">
      <!-- Stats globales -->
      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-icono">👥</span>
          <div>
            <p class="stat-valor">{{ totalUsuarios }}</p>
            <p class="stat-label">Usuarios con notas</p>
          </div>
        </div>
        <div class="stat-card">
          <span class="stat-icono">📝</span>
          <div>
            <p class="stat-valor">{{ totalNotas }}</p>
            <p class="stat-label">Notas totales</p>
          </div>
        </div>
        <div class="stat-card">
          <span class="stat-icono">✅</span>
          <div>
            <p class="stat-valor">
              {{
                Object.values(usuarios).reduce(
                  (a, u) => a + u.notas.filter((n) => n.completada).length,
                  0,
                )
              }}
            </p>
            <p class="stat-label">Completadas</p>
          </div>
        </div>
        <div class="stat-card">
          <span class="stat-icono">⏳</span>
          <div>
            <p class="stat-valor">
              {{
                Object.values(usuarios).reduce(
                  (a, u) => a + u.notas.filter((n) => !n.completada).length,
                  0,
                )
              }}
            </p>
            <p class="stat-label">Pendientes</p>
          </div>
        </div>
      </div>

      <!-- Buscador -->
      <div class="buscador-wrapper">
        <span class="buscador-icono">🔍</span>
        <input
          v-model="busqueda"
          class="buscador"
          placeholder="Buscar por usuario o contenido de nota..."
        />
      </div>

      <!-- Cargando -->
      <div v-if="cargando" class="cargando">
        <span class="spinner"></span>
        <span>Cargando datos...</span>
      </div>

      <!-- Sin resultados -->
      <p v-else-if="usuariosFiltrados.length === 0" class="vacio">
        No se encontraron resultados.
      </p>

      <!-- Usuarios con sus notas -->
      <div v-else class="usuarios-lista">
        <div
          v-for="usuario in usuariosFiltrados"
          :key="usuario.uid"
          class="usuario-bloque"
        >
          <!-- Cabecera del usuario -->
          <div class="usuario-header">
            <div
              class="avatar"
              :style="{ background: colorAvatar(usuario.uid) }"
            >
              {{ inicialAvatar(usuario.nombre) }}
            </div>
            <div class="usuario-info">
              <p class="usuario-nombre">
                <span v-if="usuario.uid === ADMIN_UID" class="badge-yo"
                  >⭐ Mis notas</span
                >
                <span v-else>{{
                  usuario.nombre || "Usuario " + usuario.uid.slice(0, 8) + "..."
                }}</span>
              </p>
              <p class="usuario-email">{{ usuario.email || usuario.uid }}</p>
            </div>
            <div class="usuario-resumen">
              <span class="badge badge-total"
                >{{ usuario.notas.length }} notas</span
              >
              <span class="badge badge-pendiente">
                {{ usuario.notas.filter((n) => !n.completada).length }}
                pendientes
              </span>
              <span class="badge badge-completada">
                {{ usuario.notas.filter((n) => n.completada).length }}
                completadas
              </span>
            </div>
          </div>

          <!-- Notas del usuario -->
          <div class="notas-lista">
            <div
              v-for="nota in usuario.notas"
              :key="nota.id"
              class="nota"
              :class="{ completada: nota.completada }"
            >
              <!-- Botón completar -->
              <button
                class="btn-toggle"
                @click="toggleCompletada(usuario.uid, nota.id)"
                :title="
                  nota.completada
                    ? 'Marcar como pendiente'
                    : 'Marcar como completada'
                "
              >
                <span v-if="nota.completada">✔</span>
              </button>

              <!-- Contenido -->
              <div class="nota-contenido">
                <!-- Modo edición -->
                <template v-if="editandoId === nota.id">
                  <input
                    v-model="editandoTexto"
                    class="input-edicion"
                    @keyup.enter="guardarEdicion(usuario.uid, nota.id)"
                    @keyup.escape="cancelarEdicion"
                    autofocus
                  />
                  <div class="edicion-acciones">
                    <button
                      class="btn-guardar"
                      @click="guardarEdicion(usuario.uid, nota.id)"
                    >
                      Guardar
                    </button>
                    <button class="btn-cancelar" @click="cancelarEdicion">
                      Cancelar
                    </button>
                  </div>
                </template>

                <!-- Modo lectura -->
                <template v-else>
                  <p class="nota-texto">{{ nota.texto || "(sin texto)" }}</p>
                </template>

                <!-- Adjunto -->
                <div v-if="nota.adjunto" class="adjunto-zona">
                  <!-- Preview inline si es imagen -->
                  <img
                    v-if="esImagen(nota.adjunto.tipo)"
                    :src="nota.adjunto.url"
                    class="adjunto-img-thumb"
                    @click="abrirPreview(nota.adjunto)"
                    title="Ver imagen"
                  />
                  <!-- Icono para otros tipos -->
                  <button
                    v-else
                    class="adjunto-btn"
                    @click="abrirPreview(nota.adjunto)"
                  >
                    <span>{{
                      esPDF(nota.adjunto.tipo)
                        ? "📄"
                        : esVideo(nota.adjunto.tipo)
                          ? "🎬"
                          : "📎"
                    }}</span>
                    <span class="adjunto-nombre">{{ nota.adjunto.nombre }}</span>
                    <span class="adjunto-ver">Ver</span>
                  </button>

                  <!-- Descarga directa -->
                  <a
                    :href="`${nota.adjunto.url}?download=${nota.adjunto.nombre}`"
                    :download="nota.adjunto.nombre"
                    class="modal-btn-descarga"
                  >
                    Descargar ⬇️
                  </a>
                </div>

                <!-- Meta -->
                <div class="nota-meta">
                  <span class="meta-label">Prioridad:</span>
                  <button
                    v-for="p in PRIORIDADES"
                    :key="p"
                    class="btn-prioridad"
                    :class="[
                      `prio-${(nota.prioridad || 'normal').toLowerCase()}`,
                      { activa: nota.prioridad === p },
                    ]"
                    @click="cambiarPrioridad(usuario.uid, nota.id, p)"
                  >
                    <span v-if="p === 'Low'">▼ </span>
                    <span v-if="p === 'High'">▲ </span>
                    {{ p }}
                  </button>
                  <span class="meta-tiempo"
                    >🕐 {{ tiempoRelativo(nota.creadaEn) }}</span
                  >
                  <span v-if="nota.completada" class="meta-completada"
                    >✅ Completada</span
                  >
                </div>
              </div>

              <!-- Acciones -->
              <div class="nota-acciones">
                <button
                  v-if="editandoId !== nota.id"
                  class="btn-editar"
                  @click="iniciarEdicion(nota)"
                  title="Editar"
                >
                  ✏️
                </button>
                <button
                  class="btn-borrar"
                  @click="borrarNota(usuario.uid, nota.id)"
                  title="Borrar"
                >
                  ⊖
                </button>
              </div>
            </div>

            <p v-if="usuario.notas.length === 0" class="sin-notas">
              Este usuario no tiene notas.
            </p>
          </div>
        </div>
      </div>
    </main>

    <!-- Modal Preview -->
    <Teleport to="body">
      <div
        v-if="previewModal"
        class="modal-overlay"
        @click.self="cerrarPreview"
      >
        <div class="modal">
          <div class="modal-header">
            <span class="modal-titulo">{{ previewModal.nombre }}</span>
            <div class="modal-acciones">
              <a
                :href="`${previewModal.url}?download=${previewModal.nombre}`"
                :download="previewModal.nombre"
                class="modal-btn-descarga"
              >
                ⬇️ Descargar
              </a>
              <button class="modal-btn-cerrar" @click="cerrarPreview">✕</button>
            </div>
          </div>
          <div class="modal-body">
            <img
              v-if="esImagen(previewModal.tipo)"
              :src="previewModal.url"
              class="modal-img"
            />
            <video
              v-else-if="esVideo(previewModal.tipo)"
              :src="previewModal.url"
              controls
              class="modal-video"
            />
            <iframe
              v-else-if="esPDF(previewModal.tipo)"
              :src="previewModal.url"
              class="modal-pdf"
            />
            <div v-else class="modal-otro">
              <p>No hay vista previa disponible para este tipo de archivo.</p>
              <a
                :href="`${previewModal.url}?download=${previewModal.nombre}`"
                :download="previewModal.nombre"
                class="modal-btn-descarga-grande"
              >
                ⬇️ Descargar {{ previewModal.nombre }}
              </a>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap");

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

.app {
  min-height: 100vh;
  background: #1e1e2e;
  color: #cdd6f4;
  font-family: "Inter", sans-serif;
  display: flex;
  flex-direction: column;
}

/* Header */
.header {
  padding: 20px 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #313244;
  flex-wrap: wrap;
  gap: 12px;
}

.header-izq {
  display: flex;
  align-items: center;
  gap: 14px;
}
.header-badge {
  background: rgba(124, 92, 255, 0.2);
  border: 1px solid rgba(124, 92, 255, 0.4);
  color: #cba6f7;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 20px;
  letter-spacing: 0.5px;
}
.titulo {
  font-size: 22px;
  font-weight: 600;
}

.header-der {
  display: flex;
  align-items: center;
  gap: 10px;
}

.btn-usuarios {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 9px 16px;
  background: rgba(137, 180, 250, 0.1);
  border: 1px solid rgba(137, 180, 250, 0.3);
  border-radius: 8px;
  color: #89b4fa;
  font-family: "Inter", sans-serif;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}
.btn-usuarios:hover {
  background: rgba(137, 180, 250, 0.2);
}

.btn-logout {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 9px 16px;
  background: rgba(243, 139, 168, 0.1);
  border: 1px solid rgba(243, 139, 168, 0.35);
  border-radius: 8px;
  color: #f38ba8;
  font-family: "Inter", sans-serif;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}
.btn-logout:hover {
  background: rgba(243, 139, 168, 0.2);
}

/* Main */
.main {
  flex: 1;
  padding: 32px 48px 40px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* Stats */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.stat-card {
  background: #252535;
  border: 1px solid #313244;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
}
.stat-icono {
  font-size: 28px;
}
.stat-valor {
  font-size: 28px;
  font-weight: 700;
  color: #cdd6f4;
  line-height: 1;
}
.stat-label {
  font-size: 12px;
  color: #6c7086;
  margin-top: 4px;
}

/* Buscador */
.buscador-wrapper {
  position: relative;
}
.buscador-icono {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 16px;
}
.buscador {
  width: 100%;
  padding: 14px 16px 14px 44px;
  font-size: 14px;
  font-family: "Inter", sans-serif;
  background: #252535;
  color: #cdd6f4;
  border: 1px solid #313244;
  border-radius: 10px;
  outline: none;
  transition: border-color 0.2s;
}
.buscador:focus {
  border-color: rgba(124, 92, 255, 0.6);
}
.buscador::placeholder {
  color: #45475a;
}

/* Cargando */
.cargando {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  color: #585b70;
  font-size: 14px;
  padding: 60px 0;
}
.spinner {
  width: 22px;
  height: 22px;
  border: 2px solid #313244;
  border-top-color: #7c5cff;
  border-radius: 50%;
  animation: girar 0.7s linear infinite;
  display: inline-block;
}
@keyframes girar {
  to {
    transform: rotate(360deg);
  }
}

.vacio {
  text-align: center;
  color: #45475a;
  padding: 60px 0;
  font-size: 15px;
}

/* Usuarios */
.usuarios-lista {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.usuario-bloque {
  background: #252535;
  border: 1px solid #313244;
  border-radius: 14px;
  overflow: hidden;
}

.usuario-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px 24px;
  background: #2a2a3e;
  border-bottom: 1px solid #313244;
  flex-wrap: wrap;
}

.avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 700;
  color: #1e1e2e;
  flex-shrink: 0;
}

.usuario-info {
  flex: 1;
  min-width: 0;
}
.usuario-nombre {
  font-size: 15px;
  font-weight: 600;
  color: #cdd6f4;
}
.badge-yo {
  background: rgba(250, 179, 135, 0.2);
  border: 1px solid rgba(250, 179, 135, 0.4);
  color: #fab387;
  font-size: 13px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 20px;
}
.usuario-email {
  font-size: 12px;
  color: #6c7086;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.usuario-resumen {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.badge {
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 20px;
}
.badge-total {
  background: rgba(203, 166, 247, 0.15);
  color: #cba6f7;
  border: 1px solid rgba(203, 166, 247, 0.3);
}
.badge-pendiente {
  background: rgba(250, 179, 135, 0.15);
  color: #fab387;
  border: 1px solid rgba(250, 179, 135, 0.3);
}
.badge-completada {
  background: rgba(166, 227, 161, 0.15);
  color: #a6e3a1;
  border: 1px solid rgba(166, 227, 161, 0.3);
}

/* Notas del usuario */
.notas-lista {
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.nota {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background: #1e1e2e;
  border: 1px solid #313244;
  border-radius: 8px;
  padding: 12px 14px;
  transition: background 0.2s;
}
.nota:hover {
  background: #252535;
}
.nota.completada {
  opacity: 0.65;
}

/* Botón completar */
.btn-toggle {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid #585b70;
  background: transparent;
  cursor: pointer;
  flex-shrink: 0;
  margin-top: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: #1e1e2e;
  transition:
    border-color 0.2s,
    background 0.2s;
}
.nota.completada .btn-toggle {
  background: #a6e3a1;
  border-color: #a6e3a1;
}
.btn-toggle:hover {
  border-color: #a6e3a1;
}

.nota-contenido {
  flex: 1;
  min-width: 0;
}

.nota-texto {
  font-size: 15px;
  color: #cdd6f4;
  word-break: break-word;
  margin-bottom: 8px;
}
.nota.completada .nota-texto {
  text-decoration: line-through;
  color: #585b70;
}

/* Edición inline */
.input-edicion {
  width: 100%;
  padding: 7px 11px;
  font-size: 14px;
  font-family: "Inter", sans-serif;
  background: #252535;
  color: #cdd6f4;
  border: 1px solid #585b70;
  border-radius: 6px;
  outline: none;
  margin-bottom: 7px;
}
.edicion-acciones {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}
.btn-guardar,
.btn-cancelar {
  padding: 4px 12px;
  border-radius: 6px;
  border: none;
  font-size: 12px;
  font-family: "Inter", sans-serif;
  cursor: pointer;
  font-weight: 500;
}
.btn-guardar {
  background: #89b4fa;
  color: #1e1e2e;
}
.btn-cancelar {
  background: #45475a;
  color: #cdd6f4;
}

/* Meta */
.nota-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 12px;
}
.meta-label {
  color: #6c7086;
}

/* Botones de prioridad */
.btn-prioridad {
  padding: 3px 9px;
  border-radius: 4px;
  border: 1px solid transparent;
  font-size: 11px;
  font-family: "Inter", sans-serif;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.15s;
  background: #313244;
  color: #7f849c;
}
.btn-prioridad:hover {
  opacity: 0.85;
}
.btn-prioridad.prio-low.activa {
  background: #313244;
  color: #89b4fa;
  border-color: #89b4fa;
}
.btn-prioridad.prio-normal.activa {
  background: #313244;
  color: #cdd6f4;
  border-color: #585b70;
}
.btn-prioridad.prio-high.activa {
  background: #f38ba8;
  color: #1e1e2e;
  border-color: #f38ba8;
}

.meta-tiempo {
  color: #45475a;
  font-size: 11px;
}
.meta-completada {
  font-size: 11px;
  color: #a6e3a1;
}

/* Acciones editar / borrar */
.nota-acciones {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
  margin-top: 1px;
}

.btn-editar {
  background: #45475a;
  border: none;
  border-radius: 6px;
  width: 32px;
  height: 32px;
  cursor: pointer;
  color: #fff;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    background 0.2s,
    transform 0.15s;
}
.btn-editar:hover {
  background: #585b70;
  transform: scale(1.08);
}

.btn-borrar {
  background: #e05c5c;
  border: none;
  border-radius: 6px;
  width: 32px;
  height: 32px;
  cursor: pointer;
  color: #fff;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    background 0.2s,
    transform 0.15s;
}
.btn-borrar:hover {
  background: #c0392b;
  transform: scale(1.08);
}

.sin-notas {
  text-align: center;
  color: #45475a;
  font-size: 13px;
  padding: 16px 0;
}

/* Adjunto en nota */
.adjunto-zona {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.adjunto-img-thumb {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid #45475a;
  transition: opacity 0.2s, transform 0.2s;
}
.adjunto-img-thumb:hover {
  opacity: 0.85;
  transform: scale(1.03);
}

.adjunto-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #313244;
  border: 1px solid #45475a;
  border-radius: 8px;
  padding: 8px 12px;
  cursor: pointer;
  color: #cdd6f4;
  font-family: "Inter", sans-serif;
  font-size: 13px;
  transition: background 0.2s;
}
.adjunto-btn:hover {
  background: #45475a;
}
.adjunto-nombre {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.adjunto-ver {
  color: #89b4fa;
  font-size: 12px;
}

.modal-btn-descarga {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  background: rgba(137, 180, 250, 0.1);
  border: 1px solid rgba(137, 180, 250, 0.3);
  border-radius: 8px;
  color: #89b4fa;
  font-size: 13px;
  font-family: "Inter", sans-serif;
  text-decoration: none;
  cursor: pointer;
  transition: background 0.2s;
}
.modal-btn-descarga:hover {
  background: rgba(137, 180, 250, 0.2);
}

/* Modal Preview */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  backdrop-filter: blur(4px);
}

.modal {
  background: #1e1e2e;
  border: 1px solid #313244;
  border-radius: 16px;
  width: 100%;
  max-width: 860px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 40px 80px rgba(0, 0, 0, 0.6);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #313244;
  gap: 12px;
}
.modal-titulo {
  font-size: 14px;
  font-weight: 500;
  color: #cdd6f4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}
.modal-acciones {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.modal-btn-cerrar {
  width: 32px;
  height: 32px;
  background: rgba(243, 139, 168, 0.1);
  border: 1px solid rgba(243, 139, 168, 0.3);
  border-radius: 8px;
  color: #f38ba8;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}
.modal-btn-cerrar:hover {
  background: rgba(243, 139, 168, 0.2);
}

.modal-body {
  flex: 1;
  overflow: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  min-height: 200px;
}

.modal-img {
  max-width: 100%;
  max-height: 70vh;
  border-radius: 8px;
  object-fit: contain;
}
.modal-video {
  max-width: 100%;
  max-height: 70vh;
  border-radius: 8px;
}
.modal-pdf {
  width: 100%;
  height: 70vh;
  border: none;
  border-radius: 8px;
}

.modal-otro {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  color: #6c7086;
}
.modal-btn-descarga-grande {
  padding: 12px 24px;
  background: #7c5cff;
  border: none;
  border-radius: 10px;
  color: #fff;
  font-size: 15px;
  font-family: "Inter", sans-serif;
  text-decoration: none;
  cursor: pointer;
  transition: opacity 0.2s;
  display: inline-block;
}
.modal-btn-descarga-grande:hover {
  opacity: 0.85;
}

/* Responsive */
@media (max-width: 900px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 600px) {
  .header,
  .main {
    padding-left: 20px;
    padding-right: 20px;
  }
  .stats-grid {
    grid-template-columns: 1fr 1fr;
  }
  .usuario-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
