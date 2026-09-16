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
        page.innerHTML = `
            <div class="article-error">
                <p>مقاله پیدا نشد یا حذف شده 😕</p>
                <a href="index.html" class="back-link">← بازگشت به خانه</a>
            </div>
        `;
        return;
    }

    // چک انقضا
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
        page.innerHTML = `
            <div class="article-error">
                <p>این مقاله منقضی شده ⏰</p>
                <a href="index.html" class="back-link">← بازگشت به خانه</a>
            </div>
        `;
        return;
    }

    // تنظیم عنوان صفحه
    document.title = `${data.title} | پروگ آرت`;

    // پاراگراف‌ها
    const paragraphs = (data.content || '')
        .split(/\n\s*\n|\n/)
        .filter(p => p.trim())
        .map(p => `<p>${escapeHtml(p.trim())}</p>`)
        .join('');

    // عکس کاور
    const cover = data.cover_url
        ? `<div class="article-cover">
               <img src="${data.cover_url}" alt="" loading="eager" decoding="async">
           </div>`
        : '';

    page.innerHTML = `
        <a href="index.html" class="back-link">← بازگشت به خانه</a>

        ${cover}

        <div class="article-body">
            <div class="article-head">
                <span class="article-tag">${escapeHtml(data.tag || 'عمومی')}</span>
                <h1 class="article-title">${escapeHtml(data.title)}</h1>
                <time class="article-date">${formatDate(data.created_at)}</time>
            </div>

            <div class="article-content">
                ${paragraphs}
            </div>
        </div>
    `;
}


// ============================================
// ====== شروع ================================
// ============================================
// ============================================
// ====== پاک‌سازی مقاله‌های منقضی ============
// ============================================

async function cleanupExpired() {
    try {
        const now = new Date().toISOString();

        // اول عکس‌های مقاله‌های منقضی رو پیدا کن
        const { data: expired } = await supabaseClient
            .from('articles')
            .select('id, cover_url')
            .not('expires_at', 'is', null)
            .lt('expires_at', now);

        if (!expired || expired.length === 0) return;

        // عکس‌ها رو از Storage پاک کن
        const imagePaths = expired
            .filter(a => a.cover_url)
            .map(a => {
                // از URL کامل، فقط مسیر فایل رو استخراج کن
                const parts = a.cover_url.split('/article-images/');
                return parts[1] || null;
            })
            .filter(Boolean);

        if (imagePaths.length > 0) {
            await supabaseClient.storage
                .from('article-images')
                .remove(imagePaths);
        }

        // خود مقاله‌ها رو پاک کن
        await supabaseClient
            .from('articles')
            .delete()
            .lt('expires_at', now);

        console.log(`🗑 ${expired.length} مقاله منقضی پاک شد`);
    } catch (err) {
        // خطا رو بی‌صدا رد کن (چون ممکنه RLS اجازه نده کاربر مهمان حذف کنه)
        console.warn('خطا در پاک‌سازی:', err.message);
    }
}
loadArticle();