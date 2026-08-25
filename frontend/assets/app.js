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

const API_URL = 'http://localhost:5000/api/recipes';

// --- SAYFA YÖNETİMİ ---
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    if(pageId === 'home') fetchRecipes();
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

// Google ile Giriş
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

// E-posta ile Kayıt
async function handleEmailSignUp() {
    const email = document.getElementById('signupEmail').value;
    const pass = document.getElementById('signupPass').value;
    try {
        await auth.createUserWithEmailAndPassword(email, pass);
        alert("Hesap başarıyla oluşturuldu!");
        toggleAuthMode(false);
    } catch (err) {
        alert("Kayıt hatası: " + err.message);
    }
}

// E-posta ile Giriş
async function handleEmailLogin() {
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPass').value;
    try {
        await auth.signInWithEmailAndPassword(email, pass);
        closeAuthModal();
        updateAuthUI();
    } catch (err) {
        alert("Giriş hatası: " + err.message);
    }
}

// Çıkış Yap
async function handleLogout() {
    try {
        await auth.signOut();
        updateAuthUI();
    } catch (err) {
        console.error("Çıkış hatası:", err);
    }
}

// Arayüzü Kullanıcı Durumuna Göre Güncelle
function updateAuthUI() {
    const authSection = document.getElementById('authSection');
    const addBtn = document.getElementById('addRecipeBtn');
    const user = auth.currentUser;

    if (user) {
        authSection.innerHTML = `
            <span style="font-size:0.8rem; color:var(--text-light)">Merhaba, ${user.displayName || user.email.split('@')[0]}</span>
            <button onclick="handleLogout()" class="user-profile-btn">Çıkış Yap</button>
        `;
        addBtn.style.display = 'flex';
    } else {
        authSection.innerHTML = `
            <button onclick="openAuthModal()" class="user-profile-btn" style="background:var(--primary); color:white">Giriş Yap</button>
        `;
        addBtn.style.display = 'none';
    }
}

// --- TARİF İŞLEMLERİ (Sadece Giriş Yapmış Kullanıcılar İçin) ---
async function fetchRecipes() {
    const container = document.getElementById('recipeContainer');
    container.innerHTML = '<div class="loader">Tarifler getiriliyor...</div>';

    try {
        const res = await fetch(API_URL);
        const data = await res.json();

        if(data.length === 0) {
            container.innerHTML = '<p style="text-align:center; grid-column:1/-1">Henüz tarif eklenmemiş.</p>';
            return;
        }

        container.innerHTML = data.map(recipe => `
            <div class="recipe-card">
                <div class="card-content">
                    <div class="card-title">${recipe.title}</div>
                    <div class="card-meta">
                        <span><i class="fa-regular fa-clock"></i> ${recipe.cookTime} dk</span>
                        <span><i class="fa-solid fa-gauge-high"></i> ${recipe.difficulty}</span>
                    </div>
                    <div class="card-desc">
                        <strong>Malzemeler:</strong> ${recipe.ingredients.join(', ')}<br><br>
                        <strong>Hazırlanışı:</strong> ${recipe.instructions.substring(0, 100)}...
                    </div>
                    ${auth.currentUser ? `<button class="btn-delete" onclick="deleteRecipe('${recipe._id}')"><i class="fa-solid fa-trash"></i> Sil</button>` : ''}
                </div>
            </div>
        `).join('');
    } catch (err) {
        container.innerHTML = '<p style="color:red; text-align:center; grid-column:1/-1">Sunucu bağlantısı yok (Backend kapalı).</p>';
    }
}

async function deleteRecipe(id) {
    if(!confirm('Bu tarifi silmek istediğinize emin misiniz?')) return;
    try {
        await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
        fetchRecipes();
    } catch (err) {
        alert('Silme işlemi başarısız oldu.');
    }
}

document.getElementById('recipeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if(!auth.currentUser) return alert("Lütfen önce giriş yapın!");

    const recipeData = {
        title: document.getElementById('title').value,
        ingredients: document.getElementById('ingredients').value.split(',').map(i => i.trim()),
        instructions: document.getElementById('instructions').value,
        cookTime: parseInt(document.getElementById('cookTime').value),
        difficulty: document.getElementById('difficulty').value,
        userId: auth.currentUser.uid
    };

    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(recipeData)
        });

        if(res.ok) {
            alert('Tarif başarıyla eklendi!');
            document.getElementById('recipeForm').reset();
            showPage('home');
        }
    } catch (err) {
        alert('Tarif eklenirken bir hata oluştu.');
    }
});

// Firebase Auth Durum İzleyici
auth.onAuthStateChanged(user => {
    updateAuthUI();
});

window.onload = () => {
    updateAuthUI();
    fetchRecipes();
};
