// ============================================
// ====== بارگذاری مقاله ======================
// ============================================

async function loadArticle() {
    const page = document.getElementById('article-page');
    if (!page) return;

    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');

    if (!id) {
        page.innerHTML = `
            <div class="article-error">
                <p>مقاله پیدا نشد 😕</p>
                <a href="index.html" class="back-link">← بازگشت به خانه</a>
            </div>
        `;
        return;
    }

    const { data, error } = await supabaseClient
        .from('articles')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !data) {
        console.error('خطا در بارگذاری مقاله:', error);
        page.innerHTML = `
            <div class="article-error">
                <p>مقاله پیدا نشد یا حذف شده 😕</p>
                <a href="index.html" class="back-link">← بازگشت به خانه</a>
            </div>
        `;
        return;
    }

    if (data.expires_at && new Date(data.expires_at) < new Date()) {
        page.innerHTML = `
            <div class="article-error">
                <p>این مقاله منقضی شده ⏰</p>
                <a href="index.html" class="back-link">← بازگشت به خانه</a>
            </div>
        `;
        return;
    }

    document.title = `${data.title} | پروگ آرت`;

    incrementViews(id, data.views || 0);

    const paragraphs = (data.content || '')
        .split(/\n\s*\n|\n/)
        .filter(p => p.trim())
        .map(p => `<p>${escapeHtml(p.trim())}</p>`)
        .join('');

    const cover = data.cover_url
        ? `<div class="article-cover">
               <img src="${data.cover_url}" alt="" loading="eager" decoding="async">
           </div>`
        : '';

    const readTime = calculateReadTime(data.content);
    const isLiked = localStorage.getItem('liked-' + id) === '1';

    page.innerHTML = `
        <a href="index.html" class="back-link">← بازگشت به خانه</a>

        ${cover}

        <div class="article-body">
            <div class="article-head">
                <span class="article-tag">${escapeHtml(data.tag || 'عمومی')}</span>
                <h1 class="article-title">${escapeHtml(data.title)}</h1>
                <div class="article-meta-row">
                    <span class="article-date">${formatDate(data.created_at)}</span>
                    <span title="زمان مطالعه">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <path d="M12 6v6l4 2"></path>
                        </svg>
                        ${readTime} دقیقه
                    </span>
                    <span title="بازدید">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                        <span id="views-count">${(data.views || 0) + 1}</span>
                    </span>
                </div>
            </div>

            <div class="article-content">
                ${paragraphs}
            </div>

            <div class="article-actions">
                <button class="action-btn ${isLiked ? 'liked' : ''}" id="like-btn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                    <span id="likes-count">${data.likes || 0}</span>
                </button>

                <div class="share-menu">
                    <button class="action-btn" id="share-btn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="18" cy="5" r="3"></circle>
                            <circle cx="6" cy="12" r="3"></circle>
                            <circle cx="18" cy="19" r="3"></circle>
                            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                        </svg>
                        اشتراک‌گذاری
                    </button>
                    <div class="share-dropdown" id="share-dropdown">
                        <a href="https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(data.title)}" target="_blank">
                            📱 تلگرام
                        </a>
                        <a href="https://wa.me/?text=${encodeURIComponent(data.title + ' ' + window.location.href)}" target="_blank">
                            💬 واتساپ
                        </a>
                        <a href="https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(data.title)}" target="_blank">
                            🐦 توییتر
                        </a>
                        <button id="copy-link">🔗 کپی لینک</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    setupLike(id, data.likes || 0, isLiked);
    setupShare();
    setupReadingProgress();
    setupFocusMode();
}


// ============================================
// ====== افزایش بازدید =======================
// ============================================

async function incrementViews(id, currentViews) {
    try {
        await supabaseClient
            .from('articles')
            .update({ views: currentViews + 1 })
            .eq('id', id);
    } catch (err) {
        console.warn('خطا در افزایش بازدید:', err);
    }
}


// ============================================
// ====== لایک ================================
// ============================================

function setupLike(id, currentLikes, isLiked) {
    const btn = document.getElementById('like-btn');
    const countEl = document.getElementById('likes-count');
    if (!btn) return;

    let liked = isLiked;
    let likes = currentLikes;

    btn.addEventListener('click', async () => {
        const newLiked = !liked;
        const newLikes = newLiked ? likes + 1 : likes - 1;

        liked = newLiked;
        likes = newLikes;
        countEl.textContent = newLikes;
        btn.classList.toggle('liked', liked);

        if (liked) {
            localStorage.setItem('liked-' + id, '1');
        } else {
            localStorage.removeItem('liked-' + id);
        }

        try {
            await supabaseClient
                .from('articles')
                .update({ likes: newLikes })
                .eq('id', id);
        } catch (err) {
            console.warn('خطا در لایک:', err);
        }
    });
}


// ============================================
// ====== اشتراک‌گذاری ========================
// ============================================

function setupShare() {
    const btn = document.getElementById('share-btn');
    const dropdown = document.getElementById('share-dropdown');
    const copyBtn = document.getElementById('copy-link');

    if (!btn) return;

    btn.addEventListener('click', (e) => {
        e.stopPropagation();

        if (navigator.share) {
            navigator.share({
                title: document.title,
                url: window.location.href
            }).catch(() => {});
            return;
        }

        dropdown.classList.toggle('show');
    });

    document.addEventListener('click', () => {
        dropdown?.classList.remove('show');
    });

    copyBtn?.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(window.location.href);
            copyBtn.textContent = '✅ کپی شد!';
            setTimeout(() => {
                copyBtn.textContent = '🔗 کپی لینک';
                dropdown.classList.remove('show');
            }, 1500);
        } catch (err) {
            alert('کپی نشد، دستی کپی کن: ' + window.location.href);
        }
    });
}


// ============================================
// ====== نوار پیشرفت مطالعه ==================
// ============================================

function setupReadingProgress() {
    const bar = document.getElementById('reading-progress');
    if (!bar) return;

    let ticking = false;

    function updateProgress() {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
        bar.style.width = progress + '%';
        ticking = false;
    }

    window.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(updateProgress);
            ticking = true;
        }
    }, { passive: true });

    updateProgress();
}


// ============================================
// ====== حالت مطالعه =========================
// ============================================

function setupFocusMode() {
    const btn = document.createElement('button');
    btn.className = 'focus-toggle';
    btn.setAttribute('aria-label', 'حالت مطالعه');
    btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
        </svg>
    `;

    document.body.appendChild(btn);

    const isFocus = localStorage.getItem('focus-mode') === '1';
    if (isFocus) {
        document.body.classList.add('focus-mode');
    }

    btn.addEventListener('click', () => {
        document.body.classList.toggle('focus-mode');
        const active = document.body.classList.contains('focus-mode');
        localStorage.setItem('focus-mode', active ? '1' : '0');
    });
}


// ============================================
// ====== شروع ================================
// ============================================

if (document.getElementById('article-page')) {
    loadArticle();
}
