// ====== متغیرهای عکس ======
let selectedImageFile = null;
let currentCoverUrl = null;

// ====== چک کردن وضعیت ورود ======
async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        showAdminPanel();
    } else {
        showLogin();
    }
}

function showLogin() {
    document.getElementById('login-view').style.display = 'block';
    document.getElementById('admin-view').style.display = 'none';
}

function showAdminPanel() {
    document.getElementById('login-view').style.display = 'none';
    document.getElementById('admin-view').style.display = 'block';
cleanupExpired();          // 👈 این خط اضافه شه
    loadAdminArticles();
}


// ====== ورود ======
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const btn = document.getElementById('login-btn');
    const errorEl = document.getElementById('login-error');

    btn.textContent = 'در حال ورود...';
    btn.disabled = true;
    errorEl.textContent = '';

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
        errorEl.textContent = 'ایمیل یا رمز اشتباه است';
        btn.textContent = 'ورود';
        btn.disabled = false;
        return;
    }

    showAdminPanel();
    btn.textContent = 'ورود';
    btn.disabled = false;
});


// ====== خروج ======
document.getElementById('logout-btn').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    showLogin();
});


// ====== آپلود عکس ======
const imageBox = document.getElementById('image-upload-box');
const imageInput = document.getElementById('image-input');
const imagePreview = document.getElementById('image-preview');
const imagePreviewWrap = document.getElementById('image-preview-wrap');
const imagePlaceholder = document.getElementById('image-placeholder');

imageBox.addEventListener('click', (e) => {
    if (e.target.closest('#remove-image')) return;
    imageInput.click();
});

imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
        alert('حجم عکس باید کمتر از ۵ مگابایت باشد');
        return;
    }

    selectedImageFile = file;
    const reader = new FileReader();
    reader.onload = (ev) => {
        imagePreview.src = ev.target.result;
        imagePreviewWrap.style.display = 'block';
        imagePlaceholder.style.display = 'none';
    };
    reader.readAsDataURL(file);
});

document.getElementById('remove-image').addEventListener('click', (e) => {
    e.stopPropagation();
    selectedImageFile = null;
    currentCoverUrl = null;
    imageInput.value = '';
    imagePreview.src = '';
    imagePreviewWrap.style.display = 'none';
    imagePlaceholder.style.display = 'block';
});


// ====== آپلود عکس به Supabase ======
async function uploadImage(file) {
    const ext = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { data, error } = await supabaseClient.storage
        .from('article-images')
        .upload(fileName, file);

    if (error) throw error;

    const { data: urlData } = supabaseClient.storage
        .from('article-images')
        .getPublicUrl(fileName);

    return urlData.publicUrl;
}


// ====== انتشار / ویرایش مقاله ======
document.getElementById('article-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const editId = document.getElementById('edit-id').value;
    const title = document.getElementById('title').value.trim();
    const tag = document.getElementById('tag').value.trim() || 'عمومی';
    const content = document.getElementById('content').value.trim();
    const days = parseInt(document.getElementById('expires').value);

    const btn = document.getElementById('publish-btn');
    const successEl = document.getElementById('publish-success');
    const errorEl = document.getElementById('publish-error');

    btn.textContent = editId ? 'در حال ذخیره...' : 'در حال انتشار...';
    btn.disabled = true;
    successEl.textContent = '';
    errorEl.textContent = '';

    try {
        let coverUrl = currentCoverUrl;
        if (selectedImageFile) {
            coverUrl = await uploadImage(selectedImageFile);
        }

        let expiresAt = null;
        if (days > 0) {
            const d = new Date();
            d.setDate(d.getDate() + days);
            expiresAt = d.toISOString();
        }

        let error;
        if (editId) {
            const res = await supabaseClient
                .from('articles')
                .update({ title, tag, content, cover_url: coverUrl, expires_at: expiresAt })
                .eq('id', editId);
            error = res.error;
        } else {
            const res = await supabaseClient
                .from('articles')
                .insert([{ title, tag, content, cover_url: coverUrl, expires_at: expiresAt }]);
            error = res.error;
        }

        if (error) throw error;

        successEl.textContent = editId ? '✅ مقاله ویرایش شد' : '✅ مقاله منتشر شد';
        resetForm();
        loadAdminArticles();

    } catch (err) {
        console.error(err);
        errorEl.textContent = 'خطا: ' + err.message;
    } finally {
        btn.textContent = '🚀 انتشار مقاله';
        btn.disabled = false;
    }
});


// ====== ریست فرم ======
function resetForm() {
    document.getElementById('article-form').reset();
    document.getElementById('edit-id').value = '';
    document.getElementById('tag').value = 'عمومی';
    document.getElementById('editor-title').textContent = 'مقاله جدید';
    document.getElementById('publish-btn').textContent = '🚀 انتشار مقاله';
    document.getElementById('cancel-edit-btn').style.display = 'none';

    selectedImageFile = null;
    currentCoverUrl = null;
    imageInput.value = '';
    imagePreview.src = '';
    imagePreviewWrap.style.display = 'none';
    imagePlaceholder.style.display = 'block';
}


// ====== لغو ویرایش ======
document.getElementById('cancel-edit-btn').addEventListener('click', resetForm);


// ====== شروع ویرایش ======
async function editArticle(id) {
    const { data, error } = await supabaseClient
        .from('articles')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        alert('خطا در بارگذاری مقاله');
        return;
    }

    document.getElementById('edit-id').value = data.id;
    document.getElementById('title').value = data.title;
    document.getElementById('tag').value = data.tag || 'عمومی';
    document.getElementById('content').value = data.content;

    if (data.cover_url) {
        currentCoverUrl = data.cover_url;
        imagePreview.src = data.cover_url;
        imagePreviewWrap.style.display = 'block';
        imagePlaceholder.style.display = 'none';
    } else {
        currentCoverUrl = null;
        imagePreviewWrap.style.display = 'none';
        imagePlaceholder.style.display = 'block';
    }

    if (data.expires_at) {
        const diff = Math.ceil((new Date(data.expires_at) - new Date()) / (1000 * 60 * 60 * 24));
        const select = document.getElementById('expires');
        let found = false;
        for (let opt of select.options) {
            if (parseInt(opt.value) === diff) { found = true; break; }
        }
        select.value = found ? diff : '30';
    } else {
        document.getElementById('expires').value = '0';
    }

    document.getElementById('editor-title').textContent = 'ویرایش مقاله';
    document.getElementById('publish-btn').textContent = '💾 ذخیره تغییرات';
    document.getElementById('cancel-edit-btn').style.display = 'inline-block';

    window.scrollTo({ top: 0, behavior: 'smooth' });
}


// ====== بارگذاری مقاله‌های ادمین ======
async function loadAdminArticles() {
    const list = document.getElementById('admin-articles-list');
    if (!list) return;

    const { data, error } = await supabaseClient
        .from('articles')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        list.innerHTML = '<p class="empty">خطا در بارگذاری</p>';
        return;
    }

    if (!data || data.length === 0) {
        list.innerHTML = '<p class="empty">هنوز مقاله‌ای نساختی</p>';
        return;
    }

    list.innerHTML = data.map(a => `
        <div class="admin-article-row">
            ${a.cover_url 
                ? `<img src="${a.cover_url}" class="admin-thumb" alt="">` 
                : `<div class="admin-thumb no-img">📄</div>`}
            <div class="admin-article-info">
                <span class="card-tag">${escapeHtml(a.tag || 'عمومی')}</span>
                <strong>${escapeHtml(a.title)}</strong>
                <small>
                    ${formatDate(a.created_at)}
                    ${a.expires_at ? ' • انقضا: ' + formatDate(a.expires_at) : ' • بدون انقضا'}
                </small>
            </div>
            <div class="admin-actions">
                <button class="btn-edit" onclick="editArticle('${a.id}')">✏️ ویرایش</button>
                <button class="btn-delete" onclick="deleteArticle('${a.id}')">🗑 حذف</button>
            </div>
        </div>
    `).join('');
}


// ====== حذف مقاله ======
async function deleteArticle(id) {
    if (!confirm('مطمئنی می‌خوای این مقاله رو حذف کنی؟')) return;

    const { error } = await supabaseClient
        .from('articles')
        .delete()
        .eq('id', id);

    if (error) {
        alert('خطا در حذف: ' + error.message);
        return;
    }

    loadAdminArticles();
}


// ====== شروع ======
checkSession();