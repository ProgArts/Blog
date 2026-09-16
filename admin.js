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