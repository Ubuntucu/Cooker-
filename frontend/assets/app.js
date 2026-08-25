// --- FIREBASE KONFİGÜRASYONU ---
const firebaseConfig = {
    apiKey: "AIzaSyA82-yDAU3BtI1ZZ4c7DjCVRziK8aDhCKQ",
    authDomain: "cooker-711bd.firebaseapp.com",
    projectId: "cooker-711bd",
    storageBucket: "cooker-711bd.firebasestorage.app",
    messagingSenderId: "872050564904",
    appId: "1:872050564904:web:b48a3acd83a51fadf83a1d",
    measurementId: "G-F87CR5SRZT"
};

// Firebase'i başlat
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// --- SAYFA YÖNETİMİ ---
let currentChatId = null;
let chatUnsubscribe = null;

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

    // Chat dinleyicisini temizle
    if (chatUnsubscribe) {
        chatUnsubscribe();
        chatUnsubscribe = null;
    }

    if (pageId === 'admin') {
        if (auth.currentUser && auth.currentUser.uid === "YyLCEm4YjrZAHiF2ZbHvexCSlNC2") {
            document.getElementById('admin').classList.add('active');
            loadAdminPanel();
        } else {
            alert("Bu sayfaya erişim yetkiniz yok!");
            showPage('home');
        }
    } else if (pageId === 'users') {
        document.getElementById('users').classList.add('active');
        fetchUsers();
    } else if (pageId === 'add') {
        document.getElementById('add').classList.add('active');
    } else {
        const page = document.getElementById(pageId);
        if (page) page.classList.add('active');
        if (pageId === 'home') fetchRecipes();
    }
}

// --- AUTH MODAL YÖNETİMİ ---
function openAuthModal() {
    document.getElementById('authModal').style.display = 'flex';
}

function closeAuthModal() {
    document.getElementById('authModal').style.display = 'none';
}

function toggleAuthMode(isSignup) {
    document.getElementById('loginForm').style.display = isSignup ? 'none' : 'block';
    document.getElementById('signupForm').style.display = isSignup ? 'block' : 'none';
}

// --- FIREBASE AUTH İŞLEMLERİ ---
async function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        await auth.signInWithPopup(provider);
        closeAuthModal();
        updateAuthUI();
    } catch (err) {
        alert("Google girişi başarısız: " + err.message);
    }
}

async function handleEmailSignUp() {
    const nick = document.getElementById('signupNick').value.trim();
    const email = document.getElementById('signupEmail').value;
    const pass = document.getElementById('signupPass').value;

    if (!nick) return alert("Lütfen bir kullanıcı adı belirleyin!");

    try {
        const nickSnapshot = await db.collection('users').where('nickname', '==', nick).get();
        if (!nickSnapshot.empty) {
            return alert("Bu kullanıcı adı zaten alınmış. Lütfen başka bir tane deneyin.");
        }

        const userCredential = await auth.createUserWithEmailAndPassword(email, pass);
        const uid = userCredential.user.uid;

        await db.collection('users').doc(uid).set({
            nickname: nick,
            email: email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
            isBanned: false,
            following: [],
            followers: [],
            totalTimeSpent: 0
        });

        alert("Hesap başarıyla oluşturuldu!");
        toggleAuthMode(false);
    } catch (err) {
        alert("Kayıt hatası: " + err.message);
    }
}

async function handleEmailLogin() {
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPass').value;
    try {
        await auth.signInWithEmailAndPassword(email, pass);
        await db.collection('users').doc(auth.currentUser.uid).update({
            lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        });
        closeAuthModal();
        updateAuthUI();
    } catch (err) {
        alert("Giriş hatası: " + err.message);
    }
}

async function handleLogout() {
    try {
        await auth.signOut();
        updateAuthUI();
    } catch (err) {
        console.error("Çıkış hatası:", err);
    }
}

function updateAuthUI() {
    const authSection = document.getElementById('authSection');
    const addBtn = document.getElementById('addRecipeBtn');
    const user = auth.currentUser;
    const adminUID = "YyLCEm4YjrZAHiF2ZbHvexCSlNC2";

    if (user) {
        let authHTML = `
            <span style="font-size:0.8rem; color:var(--text-light)">Merhaba, ${user.displayName || user.email.split('@')[0]}</span>
            <button onclick="handleLogout()" class="user-profile-btn">Çıkış Yap</button>
        `;

        if (user.uid === adminUID) {
            authHTML += `
                <button onclick="showPage('admin')" class="user-profile-btn btn-gold">Admin</button>
            `;
        }

        authSection.innerHTML = authHTML;
        addBtn.style.display = 'flex';
    } else {
        authSection.innerHTML = `
            <button onclick="openAuthModal()" class="user-profile-btn" style="background:var(--primary); color:white">Giriş Yap</button>
        `;
        addBtn.style.display = 'none';
    }
}

// --- TARİF İŞLEMLERİ ---
async function fetchRecipes() {
    const user = auth.currentUser;
    const container = document.getElementById('recipeContainer');

    if (!user) {
        container.innerHTML = `
            <div style="text-align:center; grid-column:1/-1; padding: 2rem;">
                <p style="font-size:1.2rem; color:var(--text-light); margin-bottom:1rem;">Tarifleri görmek için lütfen giriş yapın.</p>
                <button onclick="openAuthModal()" class="user-profile-btn" style="background:var(--primary); color:white; margin: 0 auto;">Giriş Yap</button>
            </div>
        `;
        return;
    }

    container.innerHTML = '<div class="loader">Tarifler getiriliyor...</div>';

    try {
        const snapshot = await db.collection('recipes').orderBy('createdAt', 'desc').get();
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if(data.length === 0) {
            container.innerHTML = '<p style="text-align:center; grid-column:1/-1">Henüz tarif eklenmemiş.</p>';
            return;
        }

        container.innerHTML = data.map(recipe => {
            const dateStr = recipe.createdAt ? recipe.createdAt.toDate().toLocaleDateString('tr-TR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            }) : 'Tarih yok';

            return `
                <div class="recipe-card">
                    ${recipe.image ? `<img src="${recipe.image}" style="width:100%; height:200px; object-fit:cover; border-radius:15px; margin-bottom:15px;">` : ''}
                    <div class="card-content">
                        <div class="card-title">${recipe.title}</div>
                        <div class="card-meta">
                            <span><i class="fa-regular fa-clock"></i> ${recipe.cookTime} dk</span>
                            <span><i class="fa-solid fa-gauge-high"></i> ${recipe.difficulty}</span>
                            <span><i class="fa-regular fa-calendar"></i> ${dateStr}</span>
                        </div>
                        <div class="card-desc">
                            <strong>Malzemeler:</strong> ${recipe.ingredients.join(', ')}<br><br>
                            <strong>Hazırlanışı:</strong> ${recipe.instructions.substring(0, 100)}...
                        </div>
                        ${auth.currentUser && auth.currentUser.uid === recipe.userId ? `<button class="btn-delete" onclick="deleteRecipe('${recipe.id}')"><i class="fa-solid fa-trash"></i> Sil</button>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error(err);
        container.innerHTML = '<p style="color:red; text-align:center; grid-column:1/-1">Veriler yüklenirken bir hata oluştu.</p>';
    }
}

async function deleteRecipe(id) {
    if(!confirm('Bu tarifi silmek istediğinize emin misiniz?')) return;
    try {
        const recipeDoc = await db.collection('recipes').doc(id).get();
        if (recipeDoc.exists) {
            const recipeData = recipeDoc.data();
            if (recipeData.image) {
                try {
                    const imageRef = storage.ref(recipeData.image);
                    await imageRef.delete();
                } catch (err) {
                    console.error("Resim silme hatası (dosya zaten yok olabilir):", err);
                }
            }
        }
        await db.collection('recipes').doc(id).delete();
        fetchRecipes();
    } catch (err) {
        alert('Silme işlemi başarısız oldu: ' + err.message);
    }
}

async function processImage(file) {
    if (!file) return null;
    if (file.size > 1024 * 1024) {
        throw new Error("Dosya boyutu 1MB'dan büyük olamaz!");
    }
    if (file.type !== "image/jpeg") {
        throw new Error("Sadece JPG formatında resimler kabul edilir!");
    }

    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800;
                const MAX_HEIGHT = 800;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Bloba çevirerek upload edeceğiz
                canvas.toBlob(async (blob) => {
                    resolve(blob);
                }, 'image/jpeg', 0.8);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

document.getElementById('recipeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if(!auth.currentUser) return alert("Lütfen önce giriş yapın!");

    const imageFile = document.getElementById('recipeImage').files[0];
    let imageUrl = null;

    try {
        if (imageFile) {
            const processedBlob = await processImage(imageFile);
            const storageRef = storage.ref(`recipe_images/${Date.now()}_${imageFile.name}`);
            await storageRef.put(processedBlob);
            imageUrl = await storageRef.getDownloadURL();
        }
    } catch (err) {
        return alert(err.message);
    }

    const recipeData = {
        title: document.getElementById('title').value,
        image: imageUrl,
        ingredients: Array.from(document.querySelectorAll('.ingredient-input')).map(i => i.value.trim()).filter(i => i !== ""),
        instructions: Array.from(document.querySelectorAll('.instruction-input')).map(i => i.value.trim()).filter(i => i !== "").join('\n'),
        cookTime: parseInt(document.getElementById('cookTime').value),
        difficulty: document.getElementById('difficulty').value,
        userId: auth.currentUser.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        await db.collection('recipes').add(recipeData);
        alert('Tarif başarıyla eklendi!');
        document.getElementById('recipeForm').reset();
        showPage('home');
    } catch (err) {
        alert('Tarif eklenirken bir hata oluştu: ' + err.message);
    }
});

// --- TOPLULUK VE TAKİP SİSTEMİ ---
async function fetchUsers() {
    const container = document.getElementById('usersContainer');
    container.innerHTML = '<div class="loader">Kullanıcılar yükleniyor...</div>';

    try {
        const snapshot = await db.collection('users').get();
        const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const currentUser = auth.currentUser;

        if (users.length === 0) {
            container.innerHTML = '<p style="text-align:center; grid-column:1/-1">Henüz kullanıcı bulunmuyor.</p>';
            return;
        }

        container.innerHTML = users.map(user => {
            if (currentUser && user.id === currentUser.uid) return '';

            const isFollowing = currentUser && currentUser.following && currentUser.following.includes(user.id);

            return `
                <div class="recipe-card">
                    <div class="card-title">@${user.nickname || 'isimsiz'}</div>
                    <div class="card-desc">Sohbet et ve tariflerini keşfet!</div>
                    <div style="display:flex; gap:10px; flex-wrap: wrap;">
                        <button onclick="toggleFollow('${user.id}')" class="btn-submit" style="flex:1; font-size:0.9rem; padding:8px;">
                            ${isFollowing ? 'Takipten Çık' : 'Takip Et'}
                        </button>
                        <button onclick="startChat('${user.id}', '${user.nickname}')" class="btn-add" style="flex:1; font-size:0.9rem; padding:8px; cursor:pointer;">
                            <i class="fa-solid fa-message"></i> Mesaj
                        </button>
                        <button onclick="reportUser('${user.id}', '${user.nickname}')" class="btn-delete" style="flex:1; font-size:0.9rem; padding:8px; cursor:pointer;">
                            <i class="fa-solid fa-flag"></i> Bildir
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        container.innerHTML = '<p style="color:red; text-align:center; grid-column:1/-1">Kullanıcılar yüklenirken hata oluştu.</p>';
    }
}

async function toggleFollow(targetUid) {
    if (!auth.currentUser) return alert("Lütfen önce giriş yapın!");
    const myUid = auth.currentUser.uid;

    try {
        const myDoc = await db.collection('users').doc(myUid).get();
        const myData = myDoc.data();
        const following = myData.following || [];

        if (following.includes(targetUid)) {
            await db.collection('users').doc(myUid).update({
                following: firebase.firestore.FieldValue.arrayRemove(targetUid)
            });
            await db.collection('users').doc(targetUid).update({
                followers: firebase.firestore.FieldValue.arrayRemove(myUid)
            });
        } else {
            await db.collection('users').doc(myUid).update({
                following: firebase.firestore.FieldValue.arrayUnion(targetUid)
            });
            await db.collection('users').doc(targetUid).update({
                followers: firebase.firestore.FieldValue.arrayUnion(myUid)
            });
        }
        fetchUsers();
    } catch (err) {
        alert("İşlem başarısız: " + err.message);
    }
}

// --- CHAT SİSTEMİ (Optimize edilmiş) ---
async function startChat(targetUid, targetNick) {
    if (!auth.currentUser) return alert("Lütfen önce giriş yapın!");
    const myUid = auth.currentUser.uid;

    currentChatId = [myUid, targetUid].sort().join('_');
    document.getElementById('chatUserTitle').innerText = targetNick;
    showPage('chat');

    // Real-time listener
    chatUnsubscribe = db.collection('chats').doc(currentChatId).collection('messages')
        .orderBy('timestamp', 'asc')
        .onSnapshot(snapshot => {
            const container = document.getElementById('chatMessages');
            const messages = snapshot.docs.map(doc => doc.data());
            const myUid = auth.currentUser.uid;

            container.innerHTML = messages.map(msg => `
                <div class="message ${msg.sender === myUid ? 'sent' : 'received'}">
                    ${msg.text}
                    <span class="message-time">${msg.timestamp ? msg.timestamp.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}</span>
                </div>
            `).join('');
            container.scrollTop = container.scrollHeight;
        }, err => {
            console.error("Mesajlar dinlenemedi:", err);
        });
}

async function sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    if (!text || !currentChatId) return;

    try {
        await db.collection('chats').doc(currentChatId).collection('messages').add({
            sender: auth.currentUser.uid,
            text: text,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        input.value = '';
    } catch (err) {
        alert("Mesaj gönderilemedi: " + err.message);
    }
}

// --- ADMIN PANEL İŞLEMLERİ ---
async function loadAdminPanel() {
    if (auth.currentUser.uid !== "YyLCEm4YjrZAHiF2ZbHvexCSlNC2") return;

    loadAdminRecipes();
    loadAdminUsers();
    loadAnnouncements();
    loadAdminMessages();
    loadAdminReports();
}

async function loadAdminReports() {
    const list = document.getElementById('adminReportList');
    list.innerHTML = '<div class="loader">Bildirimler yükleniyor...</div>';

    try {
        const snapshot = await db.collection('reports').orderBy('createdAt', 'desc').get();
        const reports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (reports.length === 0) {
            list.innerHTML = 'Henüz bildirim yok.';
            return;
        }

        list.innerHTML = reports.map(rep => `
            <div class="admin-item">
                <div class="admin-item-info">
                    <strong>Bildiren: ${rep.reporterNick} ➡️ Bildirilen: ${rep.reportedNick}</strong>
                    <span>Sebep: ${rep.reason}</span>
                </div>
                <div style="display:flex; gap:5px;">
                    <button onclick="banUser('${rep.reportedUid}')" class="btn-admin-action btn-ban">Banla</button>
                    <button onclick="deleteReport('${rep.id}')" class="btn-admin-action btn-delete-admin">Kapat</button>
                </div>
            </div>
        `).join('');
    } catch (err) {
        list.innerHTML = 'Hata: ' + err.message;
    }
}

async function deleteReport(id) {
    try {
        await db.collection('reports').doc(id).delete();
        loadAdminReports();
    } catch (err) {
        alert("Hata: " + err.message);
    }
}

async function reportUser(uid, nick) {
    if (!auth.currentUser) return alert("Lütfen önce giriş yapın!");
    const reason = prompt(`${nick} kullanıcısını neden bildiriyorsunuz?`);
    if (!reason) return;

    try {
        const myDoc = await db.collection('users').doc(auth.currentUser.uid).get();
        const myNick = myDoc.data().nickname || 'isimsiz';

        await db.collection('reports').add({
            reporterUid: auth.currentUser.uid,
            reporterNick: myNick,
            reportedUid: uid,
            reportedNick: nick,
            reason: reason,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("Bildirim başarıyla iletildi. Admin tarafından incelenecektir.");
    } catch (err) {
        alert("Bildirim hatası: " + err.message);
    }
}

async function loadAdminMessages() {
    const list = document.getElementById('adminMsgList');
    list.innerHTML = '<div class="loader">Mesajlar yükleniyor...</div>';

    try {
        const chatsSnapshot = await db.collection('chats').get();
        let allMessagesHTML = '';

        for (const chatDoc of chatsSnapshot.docs) {
            const messagesSnapshot = await chatDoc.ref.collection('messages').get();
            messagesSnapshot.forEach(msgDoc => {
                const msg = msgDoc.data();
                allMessagesHTML += `
                    <div class="admin-msg-item">
                        <div class="admin-item-info">
                            <strong>Sohbet: ${chatDoc.id}</strong>
                            <span>${msg.text}</span>
                        </div>
                        <button onclick="deleteAdminMessage('${chatDoc.id}', '${msgDoc.id}')" class="btn-admin-action btn-delete-admin">Sil</button>
                    </div>
                `;
            });
        }

        list.innerHTML = allMessagesHTML || 'Henüz mesaj yok.';
    } catch (err) {
        list.innerHTML = 'Hata: ' + err.message;
    }
}

async function deleteAdminMessage(chatId, msgId) {
    if(!confirm('Bu mesajı silmek istediğinize emin misiniz?')) return;
    try {
        await db.collection('chats').doc(chatId).collection('messages').doc(msgId).delete();
        loadAdminMessages();
    } catch (err) {
        alert("Silme hatası: " + err.message);
    }
}

async function loadAdminRecipes() {
    const list = document.getElementById('adminRecipeList');
    list.innerHTML = '<div class="loader">Yükleniyor...</div>';

    try {
        const snapshot = await db.collection('recipes').get();
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        list.innerHTML = data.map(recipe => `
            <div class="admin-item">
                <div class="admin-item-info">
                    <strong>${recipe.title}</strong>
                    <span>Kullanıcı: ${recipe.userId} | Tarih: ${recipe.createdAt ? recipe.createdAt.toDate().toLocaleDateString() : 'Bilinmiyor'}</span>
                </div>
                <button onclick="deleteRecipe('${recipe.id}')" class="btn-admin-action btn-delete-admin">Sil</button>
            </div>
        `).join('');
    } catch (err) {
        list.innerHTML = 'Hata: ' + err.message;
    }
}

async function loadAdminUsers() {
    const list = document.getElementById('adminUserList');
    list.innerHTML = '<div class="loader">Yükleniyor...</div>';

    try {
        const usersSnapshot = await db.collection('users').get();
        const recipesSnapshot = await db.collection('recipes').get();

        const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const allRecipes = recipesSnapshot.docs.map(doc => doc.data());

        const totalUsers = users.length;
        const totalRecipes = allRecipes.length;

        list.innerHTML = `
            <div style="margin-bottom: 20px; padding: 10px; background: var(--primary-dark); color: white; border-radius: 8px;">
                <strong>Genel İstatistikler:</strong> Toplam Kullanıcı: ${totalUsers} | Toplam Tarif: ${totalRecipes}
            </div>
        ` + users.map(user => {
            const userRecipes = allRecipes.filter(r => r.userId === user.id);
            const createdAt = user.createdAt ? user.createdAt.toDate().toLocaleDateString() : 'Bilinmiyor';
            const lastSession = user.lastLogin ? user.lastLogin.toDate().toLocaleString() : 'Bilgi yok';
            const totalTime = user.totalTimeSpent || '0';

            return `
                <div class="admin-item">
                    <div class="admin-item-info">
                        <strong>${user.email || user.id}</strong><br>
                        <span>Kayıt Tarihi: ${createdAt} | Son Oturum: ${lastSession}</span><br>
                        <span>Toplam Süre: ${totalTime} | Tarif Sayısı: ${userRecipes.length}</span><br>
                        <span>Tarifleri: ${userRecipes.map(r => r.title).join(', ') || 'Tarifi yok'}</span><br>
                        <span>Durum: ${user.isBanned ? '🚫 Yasaklı' : '✅ Aktif'}</span>
                    </div>
                    <button onclick="banUser('${user.id}')" class="btn-admin-action btn-ban">Banla</button>
                </div>
            `;
        }).join('');
    } catch (err) {
        list.innerHTML = 'Hata: ' + err.message;
    }
}

async function banUser(uid) {
    const minutes = prompt("Kaç dakika banlansın?");
    const reason = prompt("Ban sebebi nedir?");

    if (!minutes || !reason) return;

    try {
        const banUntil = new Date();
        banUntil.setMinutes(banUntil.getMinutes() + parseInt(minutes));

        await db.collection('users').doc(uid).set({
            isBanned: true,
            banUntil: firebase.firestore.Timestamp.fromDate(banUntil),
            banReason: reason
        }, { merge: true });

        alert("Kullanıcı banlandı.");
        loadAdminUsers();
    } catch (err) {
        alert("Hata: " + err.message);
    }
}

async function postAnnouncement() {
    const text = document.getElementById('announcementText').value;
    if (!text) return;

    try {
        await db.collection('announcements').add({
            text: text,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            author: 'Admin'
        });
        document.getElementById('announcementText').value = '';
        loadAnnouncements();
        alert("Duyuru yayınlandı.");
    } catch (err) {
        alert("Hata: " + err.message);
    }
}

async function loadAnnouncements() {
    const list = document.getElementById('announcementsList');
    try {
        const snapshot = await db.collection('announcements').orderBy('createdAt', 'desc').get();
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        list.innerHTML = data.map(ann => `
            <div class="admin-item">
                <div class="admin-item-info">
                    <strong>${ann.text}</strong>
                    <span>${ann.createdAt ? ann.createdAt.toDate().toLocaleString() : ''}</span>
                </div>
                <button onclick="deleteAnnouncement('${ann.id}')" class="btn-admin-action btn-delete-admin">Sil</button>
            </div>
        `).join('');
    } catch (err) {
        list.innerHTML = 'Duyuru yok.';
    }
}

async function deleteAnnouncement(id) {
    if(!confirm('Sileyim mi?')) return;
    await db.collection('announcements').doc(id).delete();
    loadAnnouncements();
}

// --- DİNAMİK FORM ALANLARI ---
function addIngredientField() {
    const list = document.getElementById('ingredientsList');
    const div = document.createElement('div');
    div.className = 'dynamic-field';
    div.innerHTML = `
        <input type="text" class="ingredient-input" placeholder="Malzeme adı">
        <button type="button" onclick="this.parentElement.remove()" class="btn-delete-field">&times;</button>
    `;
    list.appendChild(div);
}

function addInstructionField() {
    const list = document.getElementById('instructionsList');
    const div = document.createElement('div');
    div.className = 'dynamic-field';
    div.innerHTML = `
        <input type="text" class="instruction-input" placeholder="Hazırlanış adımı">
        <button type="button" onclick="this.parentElement.remove()" class="btn-delete-field">&times;</button>
    `;
    list.appendChild(div);
}

// Sayfa yüklendiğinde başlangıç alanlarını ekle
window.onload = () => {
    addIngredientField();
    addInstructionField();
    updateAuthUI();
    fetchRecipes();
};

auth.onAuthStateChanged(user => {
    updateAuthUI();
});
