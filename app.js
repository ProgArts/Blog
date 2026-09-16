// ============================================
// ====== تنظیمات Supabase ====================
// ============================================

const SUPABASE_URL = 'https://zhyzduzuikleolzpftvv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_WlVeHTmhCtxrD5Ae-TILog_6H4I0BP_';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);


// ============================================
// ====== تم شب/روز ===========================
// ============================================

function initTheme() {
    const saved = localStorage.getItem('progarts-theme');
    let theme = saved;

    if (!theme) {
        const hour = new Date().getHours();
        theme = (hour >= 7 && hour < 19) ? 'light' : 'dark';
    }

    document.documentElement.setAttribute('data-theme', theme);

    const btn = document.getElementById('theme-toggle');
    if (btn) {
        btn.addEventListener('click', toggleTheme);
    }
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('progarts-theme', next);
}

initTheme();


// ============================================
// ====== ذخیره مقاله‌ها در حافظه =============
// ============================================

let allArticles = [];
let currentCategory = 'همه';
let currentSort = 'newest';


// ============================================
// ====== بارگذاری مقاله‌ها ====================
// ============================================

async function loadArticles() {
    const list = document.getElementById('articles-list');
    if (!list) return;

    list.innerHTML = '<p class="loading">در حال بارگذاری...</p>';

    const { data, error } = await supabaseClient
        .from('articles')
        .select('id, title, content, tag, cover_url, created_at, expires_at, views, likes')
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

    buildCategories();
    applyFilters();
}


// ============================================
// ====== ساخت نوار دسته‌بندی =================
// ============================================

function buildCategories() {
    const bar = document.getElementById('categories-bar');
    if (!bar) return;

    const tags = new Set();
    allArticles.forEach(a => {
        if (a.tag) tags.add(a.tag);
    });

    const sorted = ['همه', ...Array.from(tags).sort()];

    bar.innerHTML = sorted.map(tag => `
        <button class="cat-btn ${tag === currentCategory ? 'active' : ''}" data-tag="${escapeHtml(tag)}">
            ${escapeHtml(tag)}
        </button>
    `).join('');

    bar.querySelectorAll('.cat-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentCategory = btn.dataset.tag;
            bar.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            applyFilters();
        });
    });
}


// ============================================
// ====== اعمال فیلترها =======================
// ============================================

function applyFilters() {
    const q = (document.getElementById('search-input')?.value || '').trim().toLowerCase();

    let filtered = allArticles.filter(a => {
        if (currentCategory !== 'همه' && a.tag !== currentCategory) return false;

        if (q) {
            const title = (a.title || '').toLowerCase();
            const content = (a.content || '').toLowerCase();
            const tag = (a.tag || '').toLowerCase();
            if (!title.includes(q) && !content.includes(q) && !tag.includes(q)) return false;
        }

        return true;
    });

    // مرتب‌سازی
    if (currentSort === 'newest') {
        filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else if (currentSort === 'oldest') {
        filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    } else if (currentSort === 'popular') {
        filtered.sort((a, b) => (b.views || 0) - (a.views || 0));
    } else if (currentSort === 'liked') {
        filtered.sort((a, b) => (b.likes || 0) - (a.likes || 0));
    }

    renderArticles(filtered);
}


// ============================================
// ====== زمان مطالعه =========================
// ============================================

function calculateReadTime(text) {
    if (!text) return 1;
    const words = text.trim().split(/\s+/).length;
    return Math.max(1, Math.ceil(words / 200));
}


// ============================================
// ====== رندر کارت‌های مقاله ==================
// ============================================

function renderArticles(articles) {
    const list = document.getElementById('articles-list');
    if (!list) return;

    if (articles.length === 0) {
        const isFiltering = currentCategory !== 'همه' || document.getElementById('search-input')?.value.trim();
        list.innerHTML = isFiltering
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

        const readTime = calculateReadTime(a.content);

        return `
            <a href="article.html?id=${a.id}" class="card">
                ${cover}
                <div class="card-body">
                    <span class="card-tag">${escapeHtml(a.tag || 'عمومی')}</span>
                    <h3>${escapeHtml(a.title)}</h3>
                    <p>${escapeHtml((a.content || '').slice(0, 120))}...</p>
                    <div class="card-meta">
                        <span>${formatDate(a.created_at)}</span>
                        <div class="card-meta-stats">
                            <span title="زمان مطالعه">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <path d="M12 6v6l4 2"></path>
                                </svg>
                                ${readTime} دقیقه
                            </span>
                        </div>
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
            const q = input.value.trim();
            clearBtn.style.display = q ? 'flex' : 'none';
            applyFilters();
        }, 150);
    });

    clearBtn.addEventListener('click', () => {
        input.value = '';
        clearBtn.style.display = 'none';
        applyFilters();
        input.focus();
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            input.value = '';
            clearBtn.style.display = 'none';
            applyFilters();
        }
    });
}


// ============================================
// ====== مرتب‌سازی ===========================
// ============================================

function setupSort() {
    const select = document.getElementById('sort-select');
    if (!select) return;

    select.addEventListener('change', () => {
        currentSort = select.value;
        applyFilters();
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

if (document.getElementById('articles-list')) {
    loadArticles();
    setupSearch();
    setupSort();
}
