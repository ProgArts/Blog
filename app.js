// ============================================
// ====== تنظیمات Supabase ====================
// ============================================

const SUPABASE_URL = 'https://zhyzduzuikleolzpftvv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_WlVeHTmhCtxrD5Ae-TILog_6H4I0BP_';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);


// ============================================
// ====== ذخیره مقاله‌ها در حافظه =============
// ============================================

let allArticles = [];


// ============================================
// ====== بارگذاری مقاله‌ها ====================
// ============================================

async function loadArticles() {
    const list = document.getElementById('articles-list');
    if (!list) return;

    list.innerHTML = '<p class="loading">در حال بارگذاری...</p>';

    const { data, error } = await supabaseClient
        .from('articles')
        .select('id, title, content, tag, cover_url, created_at, expires_at')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('خطا:', error);
        list.innerHTML = '<p class="empty">خطا در بارگذاری مقالات</p>';
        return;
    }

    const now = new Date();
    allArticles = (data || []).filter(a => {
        if (!a.expires_at) return true;
        return new Date(a.expires_at) > now;
    });

    renderArticles(allArticles);
}


// ============================================
// ====== رندر کارت‌های مقاله ==================
// ============================================

function renderArticles(articles) {
    const list = document.getElementById('articles-list');
    if (!list) return;

    if (articles.length === 0) {
        const isSearching = document.getElementById('search-input')?.value.trim();
        list.innerHTML = isSearching
            ? '<p class="empty">چیزی پیدا نشد 🔍</p>'
            : '<p class="empty">هنوز مقاله‌ای منتشر نشده ✍️</p>';
        return;
    }

    list.innerHTML = articles.map(a => {
        const cover = a.cover_url
            ? `<div class="card-cover">
                   <img src="${a.cover_url}" alt="" loading="lazy" decoding="async">
               </div>`
            : '';

        return `
            <a href="article.html?id=${a.id}" class="card">
                ${cover}
                <div class="card-body">
                    <span class="card-tag">${escapeHtml(a.tag || 'عمومی')}</span>
                    <h3>${escapeHtml(a.title)}</h3>
                    <p>${escapeHtml((a.content || '').slice(0, 120))}...</p>
                    <div class="card-meta">
                        <span>${formatDate(a.created_at)}</span>
                    </div>
                </div>
            </a>
        `;
    }).join('');
}


// ============================================
// ====== جستجو ===============================
// ============================================

function setupSearch() {
    const input = document.getElementById('search-input');
    const clearBtn = document.getElementById('search-clear');
    if (!input) return;

    let timer;

    input.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            const q = input.value.trim().toLowerCase();

            clearBtn.style.display = q ? 'flex' : 'none';

            if (!q) {
                renderArticles(allArticles);
                return;
            }

            const filtered = allArticles.filter(a => {
                const title = (a.title || '').toLowerCase();
                const content = (a.content || '').toLowerCase();
                const tag = (a.tag || '').toLowerCase();
                return title.includes(q) || content.includes(q) || tag.includes(q);
            });

            renderArticles(filtered);
        }, 150);
    });

    clearBtn.addEventListener('click', () => {
        input.value = '';
        clearBtn.style.display = 'none';
        renderArticles(allArticles);
        input.focus();
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            input.value = '';
            clearBtn.style.display = 'none';
            renderArticles(allArticles);
        }
    });
}


// ============================================
// ====== ابزارها =============================
// ============================================

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('fa-IR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }).format(d);
}


// ============================================
// ====== پاک‌سازی مقاله‌های منقضی ============
// ============================================

async function cleanupExpired() {
    try {
        const now = new Date().toISOString();

        const { data: expired } = await supabaseClient
            .from('articles')
            .select('id, cover_url')
            .not('expires_at', 'is', null)
            .lt('expires_at', now);

        if (!expired || expired.length === 0) return;

        const imagePaths = expired
            .filter(a => a.cover_url)
            .map(a => {
                const parts = a.cover_url.split('/article-images/');
                return parts[1] || null;
            })
            .filter(Boolean);

        if (imagePaths.length > 0) {
            await supabaseClient.storage
                .from('article-images')
                .remove(imagePaths);
        }

        await supabaseClient
            .from('articles')
            .delete()
            .lt('expires_at', now);

        console.log(`🗑 ${expired.length} مقاله منقضی پاک شد`);
    } catch (err) {
        console.warn('خطا در پاک‌سازی:', err.message);
    }
}


// ============================================
// ====== شروع ================================
// ============================================

// پاک‌سازی فقط اگه توی پنل ادمین هستیم (کاربر لاگین‌کرده)
if (window.location.pathname.includes('admin')) {
    cleanupExpired();
}

loadArticles();
setupSearch();