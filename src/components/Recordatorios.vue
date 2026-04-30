<script setup>
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import {
  auth,
  db,
  signOut,
  ADMIN_UID,
  supabase,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  serverTimestamp,
} from "../main";

const router = useRouter();
const esAdmin = auth.currentUser?.uid === ADMIN_UID;

// ── Logout ───────────────────────────────────────────────────────────────────
const cerrarSesion = async () => {
  await signOut(auth);
  router.push("/");
};

// ── Estado ───────────────────────────────────────────────────────────────────
const notas = ref([]);
const inputTexto = ref("");
const archivoAdjunto = ref(null); // File object pendiente
const nombreArchivo = ref(""); // Nombre mostrado en UI
const subiendoArchivo = ref(false);
const editandoId = ref(null);
const editandoTexto = ref("");
const cargando = ref(true);
const previewModal = ref(null); // { url, nombre, tipo }

const PRIORIDADES = ["Low", "Normal", "High"];
const ORDEN = { High: 0, Normal: 1, Low: 2 };

const uid = () => auth.currentUser?.uid;

// ── Computed ──────────────────────────────────────────────────────────────────
const notasOrdenadas = computed(() =>
  [...notas.value].sort((a, b) => ORDEN[a.prioridad] - ORDEN[b.prioridad]),
);
const pendientes = computed(
  () => notas.value.filter((n) => !n.completada).length,
);
const total = computed(() => notas.value.length);

// ── Cargar desde Firestore ────────────────────────────────────────────────────
onMounted(async () => {
  try {
    const q = query(collection(db, "recordatorios"), where("uid", "==", uid()));
    const snap = await getDocs(q);
    notas.value = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      creadaEn:
        d.data().creadaEn?.toDate?.()?.toISOString() ??
        new Date().toISOString(),
    }));
  } catch (e) {
    console.error("Error cargando notas:", e);
  } finally {
    cargando.value = false;
  }
});

// ── Adjuntar archivo ──────────────────────────────────────────────────────────
const seleccionarArchivo = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  archivoAdjunto.value = file;
  nombreArchivo.value = file.name;
};

const quitarArchivo = () => {
  archivoAdjunto.value = null;
  nombreArchivo.value = "";
};

// ── Subir archivo a Supabase Storage ─────────────────────────────────────────
const subirASupabase = async (file) => {
  // Nombre único para evitar colisiones: uid/timestamp_nombre
  const ruta = `${uid()}/${Date.now()}_${file.name}`;

  const { data, error } = await supabase.storage
    .from("ArchivosAdjuntos")
    .upload(ruta, file);

  if (error) throw error;

  // Obtener URL pública
  const { data: urlData } = supabase.storage
    .from("ArchivosAdjuntos")
    .getPublicUrl(data.path);

  return {
    url: urlData.publicUrl,
    nombre: file.name,
    tipo: file.type,
    ruta: data.path,
  };
};

// ── Agregar nota ──────────────────────────────────────────────────────────────
const agregarNota = async () => {
  const texto = inputTexto.value.trim();
  if (!texto) return;

  subiendoArchivo.value = true;
  try {
    // 1. Subir archivo si hay uno adjunto
    let adjunto = null;
    if (archivoAdjunto.value) {
      adjunto = await subirASupabase(archivoAdjunto.value);
    }

    // 2. Guardar nota en Firestore
    const nueva = {
      uid: uid(),
      texto,
      prioridad: "Normal",
      completada: false,
      creadaEn: serverTimestamp(),
      adjunto: adjunto || null,
      correo: auth.currentUser?.email || null,
    };

    const docRef = await addDoc(collection(db, "recordatorios"), nueva);
    notas.value.push({
      id: docRef.id,
      ...nueva,
      creadaEn: new Date().toISOString(),
    });

    // 3. Limpiar
    inputTexto.value = "";
    quitarArchivo();
  } catch (e) {
    console.error("Error agregando nota:", e);
  } finally {
    subiendoArchivo.value = false;
  }
};

// ── Completar ─────────────────────────────────────────────────────────────────
const toggleCompletada = async (id) => {
  const nota = notas.value.find((n) => n.id === id);
  if (!nota) return;
  nota.completada = !nota.completada;
  try {
    await updateDoc(doc(db, "recordatorios", id), {
      completada: nota.completada,
    });
  } catch (e) {
    nota.completada = !nota.completada;
  }
};

// ── Borrar ────────────────────────────────────────────────────────────────────
const borrarNota = async (id) => {
  const nota = notas.value.find((n) => n.id === id);
  notas.value = notas.value.filter((n) => n.id !== id);
  try {
    // Borrar archivo de Supabase si existe
    if (nota?.adjunto?.ruta) {
      await supabase.storage
        .from("ArchivosAdjuntos")
        .remove([nota.adjunto.ruta]);
    }
    await deleteDoc(doc(db, "recordatorios", id));
  } catch (e) {
    console.error("Error borrando nota:", e);
  }
};

const borrarCompletadas = async () => {
  const completadas = notas.value.filter((n) => n.completada);
  notas.value = notas.value.filter((n) => !n.completada);
  try {
    const rutas = completadas
      .filter((n) => n.adjunto?.ruta)
      .map((n) => n.adjunto.ruta);
    if (rutas.length)
      await supabase.storage.from("ArchivosAdjuntos").remove(rutas);
    await Promise.all(
      completadas.map((n) => deleteDoc(doc(db, "recordatorios", n.id))),
    );
  } catch (e) {
    console.error("Error borrando completadas:", e);
  }
};

// ── Prioridad y edición ───────────────────────────────────────────────────────
const cambiarPrioridad = async (id, nuevaPrioridad) => {
  const nota = notas.value.find((n) => n.id === id);
  if (!nota) return;
  nota.prioridad = nuevaPrioridad;
  try {
    await updateDoc(doc(db, "recordatorios", id), {
      prioridad: nuevaPrioridad,
    });
  } catch (e) {
    console.error(e);
  }
};

const iniciarEdicion = (nota) => {
  editandoId.value = nota.id;
  editandoTexto.value = nota.texto;
};

const guardarEdicion = async (id) => {
  const texto = editandoTexto.value.trim();
  const nota = notas.value.find((n) => n.id === id);
  if (nota && texto) {
    nota.texto = texto;
    try {
      await updateDoc(doc(db, "recordatorios", id), { texto });
    } catch (e) {
      console.error(e);
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

// ── Tiempo relativo ───────────────────────────────────────────────────────────
const tiempoRelativo = (iso) => {
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60) return `hace ${diff} segundos`;
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} minutos`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} horas`;
  return `hace ${Math.floor(diff / 86400)} días`;
};
</script>

<template>
  <div class="app">
    <header class="header">
      <h1 class="titulo">
        Proyecto Vue.js – <span class="nombre">Recordatorios</span>
      </h1>
      <div class="header-der">
        <button
          v-if="esAdmin"
          class="btn-admin"
          @click="router.push('/administracion')"
        >
          🛡️ Administración
        </button>
        <button class="btn-logout" @click="cerrarSesion">
          <span class="logout-icono">⎋</span>
          Cerrar sesión
        </button>
      </div>
    </header>

    <main class="main">
      <!-- Input nueva nota -->
      <div class="input-wrapper">
        <div class="input-row">
          <input
            v-model="inputTexto"
            class="input-nueva"
            placeholder="¿Qué quieres recordar?"
            @keyup.enter="agregarNota"
            :disabled="cargando || subiendoArchivo"
          />
          <!-- Botón adjuntar -->
          <label class="btn-adjuntar" title="Adjuntar archivo">
            📎
            <input
              type="file"
              class="input-file"
              @change="seleccionarArchivo"
              :disabled="subiendoArchivo"
            />
          </label>
          <!-- Botón enviar -->
          <button
            class="btn-enviar"
            @click="agregarNota"
            :disabled="cargando || subiendoArchivo || !inputTexto.trim()"
          >
            <span v-if="subiendoArchivo" class="spinner-sm"></span>
            <span v-else>➕</span>
          </button>
        </div>

        <!-- Archivo seleccionado -->
        <div v-if="nombreArchivo" class="archivo-preview-badge">
          <span class="archivo-icono">📄</span>
          <span class="archivo-nombre">{{ nombreArchivo }}</span>
          <button class="btn-quitar-archivo" @click="quitarArchivo">✕</button>
        </div>
      </div>

      <!-- Stats -->
      <div class="stats">
        <span class="stats-texto">
          <span class="stats-icono">📊</span>
          <strong>{{ pendientes }}</strong> Tareas pendientes de un total de
          <strong>{{ total }}</strong>
        </span>
        <span v-if="notas.some((n) => n.completada)" class="sep">|</span>
        <button
          v-if="notas.some((n) => n.completada)"
          class="btn-borrar-completadas"
          @click="borrarCompletadas"
        >
          ✕ Borrar tareas completadas
        </button>
      </div>

      <hr class="divider" />

      <!-- Cargando -->
      <div v-if="cargando" class="cargando">
        <span class="spinner"></span>
        <span>Cargando recordatorios...</span>
      </div>

      <!-- Lista -->
      <TransitionGroup v-else name="nota" tag="div" class="lista">
        <div
          v-for="nota in notasOrdenadas"
          :key="nota.id"
          class="nota"
          :class="{ completada: nota.completada }"
        >
          <button class="btn-toggle" @click="toggleCompletada(nota.id)">
            <span v-if="nota.completada">✔</span>
          </button>

          <div class="nota-contenido">
            <template v-if="editandoId === nota.id">
              <input
                v-model="editandoTexto"
                class="input-edicion"
                @keyup.enter="guardarEdicion(nota.id)"
                @keyup.escape="cancelarEdicion"
                autofocus
              />
              <div class="edicion-acciones">
                <button class="btn-guardar" @click="guardarEdicion(nota.id)">
                  Guardar
                </button>
                <button class="btn-cancelar" @click="cancelarEdicion">
                  Cancelar
                </button>
              </div>
            </template>
            <template v-else>
              <p class="nota-texto">{{ nota.texto }}</p>
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
                v-if="nota.adjunto"
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
                  `prio-${p.toLowerCase()}`,
                  { activa: nota.prioridad === p },
                ]"
                @click="cambiarPrioridad(nota.id, p)"
              >
                <span v-if="p === 'Low'">▼ </span>
                <span v-if="p === 'High'">▲ </span>
                {{ p }}
              </button>
              <span class="meta-tiempo"
                >🕐 Añadido {{ tiempoRelativo(nota.creadaEn) }}</span
              >
            </div>
          </div>

          <button
            class="btn-editar"
            @click="iniciarEdicion(nota)"
            title="Editar"
          >
            ✏️
          </button>
          <button class="btn-borrar" @click="borrarNota(nota.id)">⊖</button>
        </div>
      </TransitionGroup>

      <p v-if="!cargando && notas.length === 0" class="vacio">
        No hay recordatorios. ¡Añade uno arriba!
      </p>
    </main>

    <footer class="footer">
      <p>Desarrollado por <strong>"Juan Santana Rosales"</strong>.</p>
      <p>Codigo disponible en <a href="#" class="link-github">🐙 GitHub</a>.</p>
    </footer>

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
                v-if="previewModal"
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
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap");

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

.header {
  padding: 28px 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #313244;
}
.titulo {
  font-size: 26px;
  font-weight: 600;
  color: #cdd6f4;
}
.nombre {
  color: #cdd6f4;
}
.header-der {
  display: flex;
  align-items: center;
  gap: 10px;
}

.btn-admin {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 9px 18px;
  background: rgba(203, 166, 247, 0.1);
  border: 1px solid rgba(203, 166, 247, 0.35);
  border-radius: 8px;
  color: #cba6f7;
  font-family: "Inter", sans-serif;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition:
    background 0.2s,
    transform 0.15s;
}
.btn-admin:hover {
  background: rgba(203, 166, 247, 0.2);
  transform: translateY(-1px);
}

.btn-logout {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 9px 18px;
  background: rgba(243, 139, 168, 0.1);
  border: 1px solid rgba(243, 139, 168, 0.35);
  border-radius: 8px;
  color: #f38ba8;
  font-family: "Inter", sans-serif;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition:
    background 0.2s,
    transform 0.15s;
}
.btn-logout:hover {
  background: rgba(243, 139, 168, 0.2);
  transform: translateY(-1px);
}
.logout-icono {
  font-size: 16px;
}

.main {
  flex: 1;
  padding: 32px 48px 40px;
  width: 100%;
}

/* Input zona */
.input-wrapper {
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.input-nueva {
  flex: 1;
  padding: 16px 20px;
  font-size: 16px;
  font-family: "Inter", sans-serif;
  background: #fff;
  color: #1e1e2e;
  border: none;
  border-radius: 8px;
  outline: none;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
}
.input-nueva:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.input-nueva::placeholder {
  color: #aaa;
}

.btn-adjuntar {
  width: 46px;
  height: 46px;
  background: #313244;
  border: 1px solid #45475a;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  cursor: pointer;
  transition: background 0.2s;
  flex-shrink: 0;
}
.btn-adjuntar:hover {
  background: #45475a;
}
.input-file {
  display: none;
}

.btn-enviar {
  width: 46px;
  height: 46px;
  background: #7c5cff;
  border: none;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  cursor: pointer;
  transition: opacity 0.2s;
  flex-shrink: 0;
}
.btn-enviar:hover:not(:disabled) {
  opacity: 0.85;
}
.btn-enviar:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.spinner-sm {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: girar 0.7s linear infinite;
}

.archivo-preview-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #252535;
  border: 1px solid #45475a;
  border-radius: 8px;
  padding: 8px 14px;
  width: fit-content;
}
.archivo-icono {
  font-size: 16px;
}
.archivo-nombre {
  font-size: 13px;
  color: #cdd6f4;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.btn-quitar-archivo {
  background: none;
  border: none;
  color: #6c7086;
  cursor: pointer;
  font-size: 14px;
  padding: 0 0 0 4px;
  transition: color 0.2s;
}
.btn-quitar-archivo:hover {
  color: #f38ba8;
}

/* Stats */
.stats {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: #a6adc8;
  margin-bottom: 10px;
  flex-wrap: wrap;
}
.stats-icono {
  margin-right: 4px;
}
.stats-texto strong {
  color: #cdd6f4;
}
.sep {
  color: #45475a;
}
.btn-borrar-completadas {
  background: none;
  border: none;
  color: #e5a028;
  font-size: 13px;
  cursor: pointer;
  font-family: "Inter", sans-serif;
  padding: 0;
  transition: opacity 0.2s;
}
.btn-borrar-completadas:hover {
  opacity: 0.75;
}

.divider {
  border: none;
  border-top: 1px solid #313244;
  margin-bottom: 20px;
}

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

.lista {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nota {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  background: #252535;
  border: 1px solid #313244;
  border-radius: 10px;
  padding: 18px 16px 14px;
  transition:
    background 0.2s,
    opacity 0.3s;
  width: 100%;
}
.nota:hover {
  background: #2a2a3e;
}
.nota.completada {
  opacity: 0.7;
}

.nota-enter-active {
  animation: entrar 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.nota-leave-active {
  animation: salir 0.25s ease forwards;
}
.nota-move {
  transition: transform 0.35s ease;
}
@keyframes entrar {
  from {
    opacity: 0;
    transform: translateY(-14px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
@keyframes salir {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(0.95) translateX(10px);
  }
}

.btn-toggle {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 2px solid #585b70;
  background: transparent;
  cursor: pointer;
  flex-shrink: 0;
  margin-top: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    border-color 0.2s,
    background 0.2s;
  color: #1e1e2e;
  font-size: 13px;
}
.nota.completada .btn-toggle {
  background: #a6e3a1;
  border-color: #a6e3a1;
}

.nota-contenido {
  flex: 1;
  min-width: 0;
}
.nota-texto {
  font-size: 20px;
  font-weight: 400;
  color: #cdd6f4;
  margin-bottom: 8px;
  word-break: break-word;
}
.nota.completada .nota-texto {
  text-decoration: line-through;
  color: #a6e3a1;
}

.input-edicion {
  width: 100%;
  padding: 8px 12px;
  font-size: 18px;
  font-family: "Inter", sans-serif;
  background: #1e1e2e;
  color: #cdd6f4;
  border: 1px solid #585b70;
  border-radius: 6px;
  outline: none;
  margin-bottom: 8px;
}
.edicion-acciones {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}
.btn-guardar,
.btn-cancelar {
  padding: 5px 14px;
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
  transition:
    opacity 0.2s,
    transform 0.2s;
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

.adjunto-download {
  font-size: 18px;
  text-decoration: none;
  opacity: 0.6;
  transition: opacity 0.2s;
}
.adjunto-download:hover {
  opacity: 1;
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
.btn-prioridad.prio-low {
  border-color: #45475a;
}
.btn-prioridad.prio-normal {
  border-color: #45475a;
}
.btn-prioridad.prio-high {
  border-color: #45475a;
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
  color: #6c7086;
  margin-left: 4px;
  font-size: 11px;
}

.btn-editar {
  background: #45475a;
  border: none;
  border-radius: 6px;
  width: 34px;
  height: 34px;
  cursor: pointer;
  color: #fff;
  font-size: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition:
    background 0.2s,
    transform 0.15s;
  margin-top: 1px;
}
.btn-editar:hover {
  background: #585b70;
  transform: scale(1.08);
}

.btn-borrar {
  background: #e05c5c;
  border: none;
  border-radius: 6px;
  width: 34px;
  height: 34px;
  cursor: pointer;
  color: #fff;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition:
    background 0.2s,
    transform 0.15s;
  margin-top: 1px;
}
.btn-borrar:hover {
  background: #c0392b;
  transform: scale(1.08);
}

.vacio {
  text-align: center;
  color: #45475a;
  font-size: 15px;
  margin-top: 40px;
}

.footer {
  text-align: center;
  padding: 24px;
  font-size: 13px;
  color: #585b70;
  line-height: 1.7;
}
.link-github {
  color: #89b4fa;
  text-decoration: none;
}
.link-github:hover {
  text-decoration: underline;
}

/* Modal */
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

@media (max-width: 600px) {
  .header {
    padding: 20px;
    flex-wrap: wrap;
    gap: 12px;
  }
  .main {
    padding: 20px;
  }
  .nota-texto {
    font-size: 17px;
  }
  .modal {
    max-height: 95vh;
  }
}
</style>
