import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, FacebookAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp, onSnapshot } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { getStorage, ref, refFromURL, uploadBytes, getDownloadURL, deleteObject, listAll } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";
import { firebaseConfig } from "./firebase-config.js";

const configured = ["apiKey", "authDomain", "projectId", "storageBucket", "messagingSenderId", "appId"].every(k => typeof firebaseConfig[k] === "string" && firebaseConfig[k] && !firebaseConfig[k].includes("PEGAR_") && !firebaseConfig[k].includes("TU-PROYECTO"));
let app, auth, db, storage, currentUser = null, currentProfile = null, allListings = [], commentsUnsubscribe = null;
const ADMIN_WA = "595984363598";
const FEATURED_PRICES = { 30: 30000, 20: 20000, 10: 10000, 5: 5000 };
const demoListings = [
  {id:"demo1",title:"Moto en venta",price:4500000,category:"Vehículos",city:"San Pedro del Ycuamandyyú",department:"San Pedro",sellerName:"Vendedor de ejemplo",photo:"https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=800",featured:true,description:"Publicación de muestra para ver el diseño.",whatsapp:"0984123456"},
  {id:"demo2",title:"Celular usado",price:850000,category:"Celulares",city:"Asunción",department:"Central",sellerName:"Comercio de ejemplo",photo:"https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800",featured:false,description:"Publicación de muestra para ver el diseño.",whatsapp:"0984123456"},
  {id:"demo3",title:"Juego de muebles",price:1200000,category:"Muebles",city:"Encarnación",department:"Itapúa",sellerName:"Vendedor de ejemplo",photo:"https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800",featured:false,description:"Publicación de muestra para ver el diseño.",whatsapp:"0984123456"},
  {id:"demo4",title:"Casa en alquiler",price:0,category:"Inmuebles",city:"Caaguazú",department:"Caaguazú",sellerName:"Inmobiliaria de ejemplo",photo:"https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800",featured:true,description:"Publicación de muestra para ver el diseño.",whatsapp:"0984123456"}
];
const $ = s => document.querySelector(s);
const money = n => n ? "Gs. " + Number(n).toLocaleString("es-PY") : "Consultar precio";
const cleanPhone = p => (p || "").replace(/\D/g, "").replace(/^0/, "595");
const escapeHtml = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function show(id) { const d = document.getElementById(id); if (d && !d.open) d.showModal(); }
function close(id) { const d = document.getElementById(id); if (d?.open) d.close(); }
function notice(id, msg) { const el = document.getElementById(id); if (el) el.textContent = msg; }
function isDemo() { return !configured; }
function waLink(number, text = "Hola, vi tu publicación en SAN PEDRO OFERTAS. ¿Sigue disponible?") { return `https://wa.me/${cleanPhone(number)}?text=${encodeURIComponent(text)}`; }
async function upload(file, path) {
  if (!file) throw new Error("Seleccioná un archivo.");
  if (file.size > 8 * 1024 * 1024) throw new Error("El archivo no puede superar 8 MB.");
  const r = ref(storage, path); await uploadBytes(r, file); return getDownloadURL(r);
}
async function removeStorageUrl(url) { if (!url) return; try { await deleteObject(refFromURL(storage, url)); } catch (e) { if (e.code !== "storage/object-not-found") console.warn("No se pudo borrar archivo:", e); } }
async function isAdmin() { if (!currentUser || isDemo()) return false; const s = await getDoc(doc(db, "admins", currentUser.uid)); return s.exists(); }
function sampleCard(item) {
  return `<article class="listing-card" data-id="${escapeHtml(item.id)}"><img class="listing-image" src="${escapeHtml(item.photo || "assets/icon.svg")}" alt="${escapeHtml(item.title)}" loading="lazy"><div class="listing-body">${item.featured ? '<span class="featured-tag">⭐ DESTACADO</span>' : ""}<h3>${escapeHtml(item.title)}</h3><div class="price">${money(item.price)}</div><div class="listing-meta">📍 ${escapeHtml(item.city || "Paraguay")} · ${escapeHtml(item.sellerName || "Vendedor")}</div></div></article>`;
}
function renderListings() {
  const search = $("#searchInput").value.trim().toLowerCase();
  const active = document.querySelector(".category.active")?.dataset.category || "Todas";
  const filtered = allListings.filter(x => (active === "Todas" || x.category === active) && (!search || `${x.title} ${x.description} ${x.city} ${x.category}`.toLowerCase().includes(search)));
  const featured = filtered.filter(x => x.featured).sort((a, b) => (b.featuredUntil || 0) - (a.featuredUntil || 0));
  $("#featuredGrid").innerHTML = featured.length ? featured.map(sampleCard).join("") : '<div class="empty">Todavía no hay destacados activos.</div>';
  $("#listingGrid").innerHTML = filtered.length ? filtered.map(sampleCard).join("") : '<div class="empty">No encontramos publicaciones con esos filtros.</div>';
}
function openDetail(id) {
  const item = allListings.find(x => x.id === id) || demoListings.find(x => x.id === id); if (!item) return;
  const sellerPhoto = item.sellerPhoto || "assets/icon.svg";
  $("#detailContent").innerHTML = `<img class="detail-photo" src="${escapeHtml(item.photo || "assets/icon.svg")}" alt="${escapeHtml(item.title)}"><div style="padding-top:15px">${item.featured ? '<span class="featured-tag">⭐ DESTACADO</span>' : ""}<h2>${escapeHtml(item.title)}</h2><div class="price">${money(item.price)}</div><p>${escapeHtml(item.description || "")}</p><p class="muted">📍 ${escapeHtml(item.city || "")} · ${escapeHtml(item.department || "")}</p><div class="profile-head"><img class="avatar" src="${escapeHtml(sellerPhoto)}" alt="Foto del vendedor"><div><b>${escapeHtml(item.sellerName || "Vendedor")}</b><div class="muted">Vendedor en SAN PEDRO OFERTAS</div></div></div><div class="detail-actions"><a class="primary" style="text-decoration:none" href="${waLink(item.whatsapp, `Hola, vi ${item.title} en SAN PEDRO OFERTAS. ¿Me das más información?`)}" target="_blank" rel="noopener">💬 Contactar por WhatsApp</a><button class="secondary" id="shareListing">↗ Compartir</button><button class="secondary" id="askComment">Comentar / preguntar</button></div><h3>Comentarios y consultas</h3><div id="commentsList"><p class="muted">Cargando comentarios…</p></div><form id="commentForm"><label>Tu comentario<textarea name="comment" required maxlength="500" rows="2" placeholder="Preguntá por el precio, disponibilidad…"></textarea></label><button class="primary" type="submit">Publicar comentario</button></form></div>`;
  $("#shareListing").onclick = async () => { const share = { title: item.title, text: `${item.title} - ${money(item.price)}`, url: location.href }; if (navigator.share) { try { await navigator.share(share); } catch {} } else { try { await navigator.clipboard.writeText(`${share.text} ${share.url}`); alert("Enlace copiado."); } catch { alert("No se pudo copiar el enlace en este navegador."); } } };
  $("#askComment").onclick = () => { if (!currentUser) show("authDialog"); else $("#commentForm textarea").focus(); };
  $("#commentForm").onsubmit = async e => {
    e.preventDefault(); if (!currentUser) { show("authDialog"); return; }
    if (isDemo()) { alert("Conectá Firebase para guardar comentarios."); return; }
    const text = e.target.comment.value.trim(); if (!text) return;
    try { await addDoc(collection(db, "listings", id, "comments"), { uid: currentUser.uid, author: currentProfile?.name || currentUser.displayName || "Usuario", text, createdAt: serverTimestamp(), status: "visible" }); e.target.reset(); }
    catch (err) { alert(`No se pudo publicar el comentario: ${err.message}`); }
  };
  show("detailDialog"); loadComments(id);
}
async function loadComments(id) {
  const box = $("#commentsList"); if (!box) return;
  if (commentsUnsubscribe) { commentsUnsubscribe(); commentsUnsubscribe = null; }
  if (isDemo() || id.startsWith("demo")) { box.innerHTML = '<p class="muted">Sé el primero en consultar. Iniciá sesión para comentar.</p>'; return; }
  const admin = await isAdmin();
  const q = query(collection(db, "listings", id, "comments"), orderBy("createdAt", "asc"));
  commentsUnsubscribe = onSnapshot(q, snap => {
    const rows = snap.docs.filter(d => d.data().status !== "deleted");
    box.innerHTML = rows.length ? rows.map(d => `<div class="comment"><b>${escapeHtml(d.data().author || "Usuario")}</b><br>${escapeHtml(d.data().text || "")}${admin ? ` <button class="danger comment-delete" data-comment-delete="${d.id}">Eliminar</button>` : ""}</div>`).join("") : '<p class="muted">Todavía no hay comentarios.</p>';
    box.querySelectorAll("[data-comment-delete]").forEach(b => b.onclick = async () => { if (confirm("¿Eliminar este comentario?")) { try { await deleteDoc(doc(db, "listings", id, "comments", b.dataset.commentDelete)); } catch (e) { alert(e.message); } } });
  }, err => { console.error(err); box.innerHTML = '<p class="muted">No se pudieron cargar los comentarios.</p>'; });
}
async function loadWantedRequests(){const grid=$("#wantedGrid");if(!grid)return;if(isDemo()){grid.innerHTML='<div class="empty">Conectá Firebase para publicar y consultar pedidos reales.</div>';return;}try{const snap=await getDocs(query(collection(db,"wantedRequests"),where("status","==","approved")));const rows=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.toMillis?.()||0)-(a.createdAt?.toMillis?.()||0));grid.innerHTML=rows.length?rows.map(x=>'<article class="wanted-card" data-wanted="'+escapeHtml(x.id)+'"><div class="wanted-card-body"><span class="pill">🔎 BUSCO COMPRAR</span><h3>'+escapeHtml(x.title)+'</h3><p>'+escapeHtml(x.details||"")+'</p><div class="listing-meta">📍 '+escapeHtml(x.city||"")+', '+escapeHtml(x.department||"")+'</div><small>Publicado por '+escapeHtml(x.author||"Comprador")+'</small></div></article>').join(""):'<div class="empty">Todavía no hay pedidos de compra. ¡Sé el primero!</div>';}catch(e){console.error(e);grid.innerHTML='<div class="empty">No se pudieron cargar los pedidos.</div>';}}
async function openWantedDetail(id){if(isDemo()){alert("Conectá Firebase para ver pedidos y responder.");return;}try{const snap=await getDoc(doc(db,"wantedRequests",id));if(!snap.exists()||snap.data().status!=="approved")return;const item={id,...snap.data()};$("#wantedDetailContent").innerHTML='<span class="pill">🔎 BUSCO COMPRAR</span><h2>'+escapeHtml(item.title)+'</h2><p>'+escapeHtml(item.details||"")+'</p>'+(item.photo?'<img class="detail-photo" src="'+escapeHtml(item.photo)+'" alt="Foto de referencia">':"")+'<p class="muted">📍 '+escapeHtml(item.city||"")+', '+escapeHtml(item.department||"")+' · '+escapeHtml(item.author||"Comprador")+'</p><div class="detail-actions"><a class="primary" style="text-decoration:none" href="'+waLink(item.whatsapp,"Hola, vi tu pedido en SAN PEDRO OFERTAS. Tengo una opción para ofrecerte.")+'" target="_blank" rel="noopener">💬 Contactar comprador</a></div><h3>Ofertas de vendedores</h3><div id="wantedReplies"><p class="muted">Cargando respuestas…</p></div><form id="wantedReplyForm"><label>Tu oferta o comentario<textarea name="text" required maxlength="600" rows="3" placeholder="Contá qué tenés para ofrecer, precio y detalles…"></textarea></label><label>Foto del producto (opcional)<input name="photo" type="file" accept="image/*"></label><button class="primary" type="submit">Enviar oferta</button></form>';const rs=await getDocs(collection(db,"wantedRequests",id,"replies"));const rows=rs.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.status!=="deleted").sort((a,b)=>(a.createdAt?.toMillis?.()||0)-(b.createdAt?.toMillis?.()||0));$("#wantedReplies").innerHTML=rows.length?rows.map(x=>'<div class="comment"><b>'+escapeHtml(x.author||"Vendedor")+'</b><p>'+escapeHtml(x.text||"") + '</p>'+(x.photo?'<a href="'+escapeHtml(x.photo)+'" target="_blank" rel="noopener"><img class="reply-photo" src="'+escapeHtml(x.photo)+'" alt="Foto de oferta"></a>':"")+'</div>').join(""):'<p class="muted">Todavía no hay ofertas. ¡Podés ser el primero!</p>';$("#wantedReplyForm").onsubmit=async e=>{e.preventDefault();if(!currentUser){show("authDialog");return;}const text=e.target.elements.namedItem("text").value.trim(),file=e.target.elements.namedItem("photo").files[0];if(!text)return;try{let photo="";if(file)photo=await upload(file,"wanted-replies/"+currentUser.uid+"/"+Date.now()+"-"+file.name.replace(/[^\\w.-]/g,"_"));await addDoc(collection(db,"wantedRequests",id,"replies"),{uid:currentUser.uid,author:currentProfile?.name||currentUser.displayName||"Vendedor",text,photo,status:"visible",createdAt:serverTimestamp()});await openWantedDetail(id);}catch(err){alert("No se pudo enviar la oferta: "+err.message);}};show("wantedDetailDialog");}catch(e){alert("No se pudo abrir el pedido: "+e.message);}}
async function submitWantedRequest(e){e.preventDefault();if(!currentUser){show("authDialog");return;}if(isDemo()){notice("wantedMessage","Conectá Firebase para publicar pedidos reales.");return;}const f=e.target,title=f.elements.namedItem("title").value.trim(),details=f.elements.namedItem("details").value.trim();if(!title||!details)return;try{const file=f.elements.namedItem("photo").files[0];let photo="";if(file)photo=await upload(file,"wanted/"+currentUser.uid+"/"+Date.now()+"-"+file.name.replace(/[^\\w.-]/g,"_"));await addDoc(collection(db,"wantedRequests"),{title,details,department:f.elements.namedItem("department").value.trim(),city:f.elements.namedItem("city").value.trim(),whatsapp:f.elements.namedItem("whatsapp").value.trim(),photo,uid:currentUser.uid,author:currentProfile?.name||currentUser.displayName||"Comprador",status:"pending",createdAt:serverTimestamp()});notice("wantedMessage","¡Pedido enviado! Aparecerá después de la aprobación del administrador.");f.reset();}catch(err){notice("wantedMessage","No se pudo enviar: "+err.message);}}
async function loadListings() {
  if (isDemo()) { allListings = demoListings; renderListings(); return; }
  try {
    const snap = await getDocs(query(collection(db, "listings"), where("status", "==", "approved")));
    const now = Date.now();
    allListings = snap.docs.map(d => ({ id: d.id, ...d.data() })).map(x => ({ ...x, featured: !!x.featured && (x.featuredUntil?.toMillis?.() || new Date(x.featuredUntil || 0).getTime()) > now, featuredUntil: x.featuredUntil?.toMillis?.() || new Date(x.featuredUntil || 0).getTime() }));
    renderListings();
  } catch (e) { console.error(e); allListings = []; renderListings(); }
}
async function ensureProfile(user) {
  const r = doc(db, "users", user.uid), s = await getDoc(r);
  if (!s.exists()) {
    currentProfile = { uid: user.uid, name: user.displayName || "Usuario", email: user.email || "", photo: user.photoURL || "", whatsapp: "", city: "", status: "active", createdAt: serverTimestamp() };
    await setDoc(r, currentProfile);
  } else currentProfile = s.data();
  if (["suspended", "deleted"].includes(currentProfile.status)) { await signOut(auth); currentUser = null; currentProfile = null; alert("Esta cuenta no tiene acceso a la plataforma. Si necesitás ayuda, contactá al administrador."); }
}
async function login(providerName) {
  if (isDemo()) { notice("authMessage", "Modo demostración: falta conectar Firebase para habilitar el ingreso real."); return; }
  try {
    const provider = providerName === "google" ? new GoogleAuthProvider() : new FacebookAuthProvider();
    await signInWithPopup(auth, provider); close("authDialog");
  } catch (e) {
    if (["auth/popup-blocked", "auth/operation-not-supported-in-this-environment"].includes(e.code)) {
      try { const provider = providerName === "google" ? new GoogleAuthProvider() : new FacebookAuthProvider(); await signInWithRedirect(auth, provider); return; } catch (redirectError) { e = redirectError; }
    }
    console.error(e); notice("authMessage", e.message || "No se pudo iniciar sesión.");
  }
}
function renderAccount() { $("#accountBtn").textContent = currentUser ? "✓" : "👤"; if (currentUser) $("#accountBtn").title = currentProfile?.name || "Mi cuenta"; }
function openProfile() {
  if (!currentUser) { show("authDialog"); return; }
  $("#profileContent").innerHTML = `<span class="eyebrow">MI CUENTA</span><h2>Perfil del vendedor</h2><div class="profile-head"><img class="avatar" src="${escapeHtml(currentProfile?.photo || currentUser.photoURL || "assets/icon.svg")}" alt="Foto de perfil"><div><b>${escapeHtml(currentProfile?.name || currentUser.displayName || "Usuario")}</b><p class="muted">${escapeHtml(currentProfile?.city || "Agregá tu ciudad")}</p></div></div><form id="profileForm"><label>Nombre visible<input name="name" required maxlength="80" value="${escapeHtml(currentProfile?.name || currentUser.displayName || "")}"></label><label>Ciudad<input name="city" maxlength="80" value="${escapeHtml(currentProfile?.city || "")}"></label><label>Tu WhatsApp para recibir consultas<input name="whatsapp" required inputmode="tel" value="${escapeHtml(currentProfile?.whatsapp || "")}" placeholder="0984 123 456"></label><label>Foto de perfil<input name="photo" type="file" accept="image/*"></label><button class="primary">Guardar perfil</button></form><button class="secondary" id="myFeatured" style="margin-top:12px">⭐ Solicitar publicación destacada</button><button class="secondary" id="logoutBtn" style="margin:12px 0 0 8px">Cerrar sesión</button><p class="fine-print">Tu nombre, foto y ciudad podrán mostrarse junto a tus publicaciones.</p>`;
  $("#profileForm").onsubmit = async e => { e.preventDefault(); const f = e.target; try { let photo = currentProfile?.photo || currentUser.photoURL || ""; if (f.elements.namedItem("photo").files[0]) photo = await upload(f.elements.namedItem("photo").files[0], `profiles/${currentUser.uid}/avatar`); currentProfile = { ...currentProfile, name: f.elements.namedItem("name").value.trim(), city: f.elements.namedItem("city").value.trim(), whatsapp: f.elements.namedItem("whatsapp").value.trim(), photo }; await setDoc(doc(db, "users", currentUser.uid), currentProfile, { merge: true }); alert("Perfil guardado."); close("profileDialog"); } catch (err) { alert(err.message); } };
  $("#myFeatured").onclick = () => { close("profileDialog"); openFeatured(); };
  $("#logoutBtn").onclick = () => signOut(auth);
  show("profileDialog");
}
async function openFeatured() {
  if (!currentUser) { show("authDialog"); return; }
  if (isDemo()) { alert("Conectá Firebase para solicitar un destacado."); return; }
  const mine = allListings.filter(x => x.ownerUid === currentUser.uid);
  $("#featuredListing").innerHTML = mine.map(x => `<option value="${escapeHtml(x.id)}">${escapeHtml(x.title)}</option>`).join("");
  if (!mine.length) { alert("Primero necesitás tener una publicación aprobada."); return; }
  show("featuredDialog");
}
async function submitPublish(e) {
  e.preventDefault(); if (!currentUser) { show("authDialog"); return; } if (isDemo()) { notice("publishMessage", "Conectá Firebase para enviar publicaciones reales."); return; }
  const f = e.target, photo = f.elements.namedItem("photo").files[0]; if (!photo) return;
  try {
    const url = await upload(photo, `listings/${currentUser.uid}/${Date.now()}-${photo.name.replace(/[^\w.-]/g, "_")}`);
    await addDoc(collection(db, "listings"), { title: f.elements.namedItem("title").value.trim(), price: Number(f.elements.namedItem("price").value) || 0, category: f.elements.namedItem("category").value, description: f.elements.namedItem("description").value.trim(), department: f.elements.namedItem("department").value.trim(), city: f.elements.namedItem("city").value.trim(), whatsapp: f.elements.namedItem("whatsapp").value.trim(), photo: url, sellerName: currentProfile?.name || currentUser.displayName || "Vendedor", sellerPhoto: currentProfile?.photo || currentUser.photoURL || "", ownerUid: currentUser.uid, status: "pending", featured: false, createdAt: serverTimestamp() });
    notice("publishMessage", "¡Enviado! Tu publicación queda pendiente de aprobación."); f.reset();
  } catch (err) { notice("publishMessage", err.message); }
}
async function submitFeatured(e) {
  e.preventDefault(); if (!currentUser || isDemo()) return;
  const f = e.target, file = f.receipt.files[0], days = Number(f.duration.value), amount = FEATURED_PRICES[days];
  if (!file || !amount) { notice("featuredMessage", "Revisá la duración y adjuntá el comprobante."); return; }
  try {
    const receipt = await upload(file, `receipts/${currentUser.uid}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`);
    await addDoc(collection(db, "featuredRequests"), { uid: currentUser.uid, listingId: f.listing.value, duration: days, amount, receipt, status: "pending", createdAt: serverTimestamp() });
    notice("featuredMessage", "Solicitud enviada. Esperá la aprobación del administrador."); f.reset();
  } catch (err) { notice("featuredMessage", err.message); }
}
async function deleteListingAndFiles(listing) {
  await removeStorageUrl(listing.photo);
  const comments = await getDocs(collection(db, "listings", listing.id, "comments"));
  for (const c of comments.docs) await deleteDoc(c.ref);
  await deleteDoc(doc(db, "listings", listing.id));
}
async function deleteMemberData(userRow) {
  const owned = await getDocs(query(collection(db, "listings"), where("ownerUid", "==", userRow.id)));
  for (const d of owned.docs) await deleteListingAndFiles({ id: d.id, ...d.data() });
  try {
    const folder = await listAll(ref(storage, `profiles/${userRow.id}`));
    for (const item of folder.items) await deleteObject(item);
  } catch (e) { console.warn("No se pudo limpiar la foto de perfil", e); }
  const requests = await getDocs(query(collection(db, "featuredRequests"), where("uid", "==", userRow.id)));
  for (const d of requests.docs) { await removeStorageUrl(d.data().receipt); await deleteDoc(d.ref); }
  await updateDoc(doc(db, "users", userRow.id), { status: "deleted", name: "Cuenta eliminada", photo: "", whatsapp: "", city: "", email: "", deletedAt: serverTimestamp() });
}
async function openAdmin() {
  if (!currentUser) { show("authDialog"); return; }
  if (isDemo()) { alert("El panel real aparece al conectar Firebase y registrar al administrador."); return; }
  try {
    if (!(await isAdmin())) { alert("Esta cuenta no tiene permisos de administrador."); return; }
    const [pending, requests, users, approved, wantedPending] = await Promise.all([
      getDocs(query(collection(db, "listings"), where("status", "==", "pending"))),
      getDocs(query(collection(db, "featuredRequests"), where("status", "==", "pending"))),
      getDocs(collection(db, "users")),
      getDocs(query(collection(db, "listings"), where("status", "==", "approved"))),
      getDocs(query(collection(db, "wantedRequests"), where("status", "==", "pending")))
    ]);
    const listingRows = pending.docs.map(d => ({ id: d.id, ...d.data() }));
    const requestRows = requests.docs.map(d => ({ id: d.id, ...d.data() }));
    const userRows = users.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => x.status !== "deleted");
    const approvedRows = approved.docs.map(d => ({ id: d.id, ...d.data() }));
    const wantedRows = wantedPending.docs.map(d => ({ id: d.id, ...d.data() }));
    $("#adminContent").innerHTML = `<span class="eyebrow">CONTROL TOTAL</span><h2>Panel de administración</h2><p class="muted">Juan Saucedo · WhatsApp <a href="https://wa.me/${ADMIN_WA}" target="_blank" rel="noopener">0984 36 35 98</a></p><h3>Publicaciones pendientes (${listingRows.length})</h3>${listingRows.map(x => `<div class="admin-row"><span><b>${escapeHtml(x.title)}</b><br>${escapeHtml(x.city || "")}</span><span><button class="success" data-approve="${x.id}">Aprobar</button> <button class="danger" data-delete-pending="${x.id}">Eliminar</button></span></div>`).join("") || '<p class="muted">No hay pendientes.</p>'}<h3>Pedidos BUSCO COMPRAR pendientes (${wantedRows.length})</h3>${wantedRows.map(x => `<div class="admin-row"><span><b>${escapeHtml(x.title)}</b><br>${escapeHtml(x.city || "")}</span><span><button class="success" data-approve-wanted="${x.id}">Aprobar</button> <button class="danger" data-delete-wanted="${x.id}">Eliminar</button></span></div>`).join("") || '<p class="muted">No hay pedidos pendientes.</p>'}<h3>Solicitudes de destacados (${requestRows.length})</h3>${requestRows.map(x => `<div class="admin-row"><span>${x.duration} días · ${money(x.amount)}<br><a href="${escapeHtml(x.receipt)}" target="_blank" rel="noopener">Ver comprobante</a></span><button class="success" data-feature="${x.id}">Aprobar</button></div>`).join("") || '<p class="muted">No hay solicitudes.</p>'}<h3>Publicaciones activas (${approvedRows.length})</h3>${approvedRows.map(x => `<div class="admin-row"><span><b>${escapeHtml(x.title)}</b><br><small>${escapeHtml(x.city || "")}</small></span><button class="danger" data-delete-approved="${x.id}">Eliminar foto y anuncio</button></div>`).join("") || '<p class="muted">No hay publicaciones activas.</p>'}<h3>Integrantes (${userRows.length})</h3>${userRows.map(x => `<div class="admin-row"><span>${escapeHtml(x.name || x.email || x.id)}<br><small>${escapeHtml(x.city || "")}</small></span><span><button class="${x.status === "suspended" ? "success" : "danger"}" data-suspend="${x.id}" data-status="${x.status || "active"}">${x.status === "suspended" ? "Reactivar" : "Suspender"}</button> <button class="danger" data-delete-member="${x.id}">Eliminar integrante</button></span></div>`).join("") || '<p class="muted">No hay integrantes.</p>'}<p class="fine-print">Eliminar integrante borra su perfil, publicaciones, comentarios, comprobantes y fotos de la plataforma. La cuenta de acceso del proveedor Google/Facebook requiere eliminación administrativa adicional en Firebase Authentication.</p>`;
    $("#adminContent").querySelectorAll("[data-approve-wanted]").forEach(b => b.onclick = async () => { try { await updateDoc(doc(db,"wantedRequests",b.dataset.approveWanted),{status:"approved",approvedAt:serverTimestamp()}); await openAdmin(); await loadWantedRequests(); } catch(e){alert(e.message);} });
    $("#adminContent").querySelectorAll("[data-delete-wanted]").forEach(b => b.onclick = async () => { const row=wantedRows.find(x=>x.id===b.dataset.deleteWanted); if(row&&confirm("¿Eliminar este pedido y sus respuestas?")){try{await removeStorageUrl(row.photo);const rs=await getDocs(collection(db,"wantedRequests",row.id,"replies"));for(const r of rs.docs){await removeStorageUrl(r.data().photo);await deleteDoc(r.ref);}await deleteDoc(doc(db,"wantedRequests",row.id));await openAdmin();await loadWantedRequests();}catch(e){alert(e.message);}} });
    $("#adminContent").querySelectorAll("[data-approve]").forEach(b => b.onclick = async () => { try { await updateDoc(doc(db, "listings", b.dataset.approve), { status: "approved", approvedAt: serverTimestamp() }); await openAdmin(); await loadListings(); } catch (e) { alert(e.message); } });
    for (const selector of ["[data-delete-pending]", "[data-delete-approved]"]) $("#adminContent").querySelectorAll(selector).forEach(b => b.onclick = async () => { const row = [...listingRows, ...approvedRows].find(x => x.id === b.dataset[selector.includes("pending") ? "deletePending" : "deleteApproved"]); if (row && confirm("¿Eliminar definitivamente esta publicación, sus comentarios y su foto?")) { try { await deleteListingAndFiles(row); await openAdmin(); await loadListings(); } catch (e) { alert(e.message); } } });
    $("#adminContent").querySelectorAll("[data-feature]").forEach(b => b.onclick = async () => { const r = requestRows.find(x => x.id === b.dataset.feature); if (!r || !FEATURED_PRICES[r.duration] || r.amount !== FEATURED_PRICES[r.duration]) { alert("La solicitud tiene datos de pago no válidos."); return; } try { const until = new Date(Date.now() + r.duration * 86400000); await updateDoc(doc(db, "listings", r.listingId), { featured: true, featuredUntil: until, status: "approved" }); await updateDoc(doc(db, "featuredRequests", r.id), { status: "approved", approvedAt: serverTimestamp() }); await openAdmin(); await loadListings(); } catch (e) { alert(e.message); } });
    $("#adminContent").querySelectorAll("[data-suspend]").forEach(b => b.onclick = async () => { try { const status = b.dataset.status === "suspended" ? "active" : "suspended"; await updateDoc(doc(db, "users", b.dataset.suspend), { status }); await openAdmin(); } catch (e) { alert(e.message); } });
    $("#adminContent").querySelectorAll("[data-delete-member]").forEach(b => b.onclick = async () => { const row = userRows.find(x => x.id === b.dataset.deleteMember); if (row && row.id !== currentUser.uid && confirm("¿Eliminar el integrante y todos sus datos, fotos, anuncios y comprobantes? Esta acción no se puede deshacer.")) { try { await deleteMemberData(row); await openAdmin(); await loadListings(); } catch (e) { alert(`No se pudo completar la eliminación: ${e.message}`); } } else if (row?.id === currentUser.uid) alert("No podés eliminar tu propia cuenta desde este panel."); });
    show("adminDialog");
  } catch (e) { console.error(e); alert(`No se pudo abrir el panel: ${e.message}`); }
}
function setup() {
  document.addEventListener("click", e => { const card = e.target.closest(".listing-card"); if (card) openDetail(card.dataset.id); });
  document.querySelectorAll("[data-category]").forEach(b => b.addEventListener("click", () => { document.querySelectorAll(".category").forEach(x => x.classList.remove("active")); b.classList.add("active"); renderListings(); }));
  $("#searchBtn").onclick = renderListings; $("#searchInput").addEventListener("keydown", e => { if (e.key === "Enter") renderListings(); });
  $("#clearFilters").onclick = () => { $("#searchInput").value = ""; document.querySelectorAll(".category").forEach(x => x.classList.toggle("active", x.dataset.category === "Todas")); renderListings(); };
  $("#publishBtn").onclick = $("#navPublish").onclick = () => { if (!currentUser) show("authDialog"); else show("publishDialog"); };
  $("#accountBtn").onclick = $("#navProfile").onclick = openProfile; $("#navAdmin").onclick = openAdmin;
  $("#googleLogin").onclick = () => login("google"); $("#facebookLogin").onclick = () => login("facebook");
  $("#publishForm").onsubmit = submitPublish; $("#featuredForm").onsubmit = submitFeatured; $("#wantedForm").onsubmit = submitWantedRequest;
  $("#wantedPublishBtn").onclick = () => { if (!currentUser) show("authDialog"); else show("wantedDialog"); };
  $("#wantedGrid").addEventListener("click", e => { const card=e.target.closest("[data-wanted]"); if(card) openWantedDetail(card.dataset.wanted); });
  document.querySelectorAll("[data-close]").forEach(b => b.onclick = () => close(b.dataset.close));
  document.querySelectorAll(".modal").forEach(d => d.addEventListener("click", e => { if (e.target === d) d.close(); }));
  if (configured) {
    app = initializeApp(firebaseConfig); auth = getAuth(app); db = getFirestore(app); storage = getStorage(app);
    getRedirectResult(auth).catch(e => { console.error(e); notice("authMessage", e.message); });
    onAuthStateChanged(auth, async user => { currentUser = user; if (user) { try { await ensureProfile(user); } catch (e) { console.error(e); } } else currentProfile = null; renderAccount(); });
  } else {
    notice("authMessage", "Modo de demostración: falta conectar Firebase.");
  }
  loadListings(); loadWantedRequests();
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("./sw.js").catch(console.warn);
}
setup();
