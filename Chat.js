// ============================================
// ====== متغیرهای چت =========================
// ============================================

let chatChannel = null;
let currentUser = null;
let currentDisplayName = '';


// ============================================
// ====== شروع چت =============================
// ============================================

async function initChat() {
    const authEl = document.getElementById('chat-auth');
    if (!authEl) return;

    // چک کن کاربر لاگین هست یا نه
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (session && session.user) {
        // اگه اسم نمایشی نداشت، بپرس
        const displayName = localStorage.getItem('chat-display-name');
        if (!displayName) {
            askForDisplayName(session.user);
        } else {
            currentUser = session.user;
            currentDisplayName = displayName;
            showChat();
        }
    } else {
        showAuth();
    }
}


// ============================================
// ====== نمایش صفحه ورود =====================
// ============================================

function showAuth() {
    document.getElementById('chat-auth').style.display = 'block';
    document.getElementById('chat-main').style.display = 'none';
    document.getElementById('auth-step-email').style.display = 'block';
    document.getElementById('auth-step-code').style.display = 'none';
}


// ============================================
// ====== نمایش چت =============================
// ============================================

async function showChat() {
    document.getElementById('chat-auth').style.display = 'none';
    document.getElementById('chat-main').style.display = 'block';

    // نمایش اطلاعات کاربر
    document.getElementById('user-display-name').textContent = currentDisplayName;
    document.getElementById('user-email').textContent = currentUser.email;

    await cleanupOldMessages();
    await loadMessages();
    setupRealtime();
    setupChatForm();
    setStatus('آنلاین', true);
}


// ============================================
// ====== مرحله ۱: ارسال کد به ایمیل =========
// ============================================

document.getElementById('email-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('chat-email').value.trim();
    const btn = document.getElementById('email-btn');
    const errorEl = document.getElementById('email-error');

    btn.textContent = 'در حال ارسال...';
    btn.disabled = true;
    errorEl.textContent = '';

    const { error } = await supabaseClient.auth.signInWithOtp({
        email,
        options: {
            shouldCreateUser: true
        }
    });

    btn.textContent = 'ارسال کد';
    btn.disabled = false;

    if (error) {
        errorEl.textContent = 'خطا: ' + error.message;
        return;
    }

    // رفتن به مرحله ۲
    document.getElementById('auth-step-email').style.display = 'none';
    document.getElementById('auth-step-code').style.display = 'block';
    document.getElementById('sent-email').textContent = email;
    document.getElementById('chat-code').focus();
});


// ============================================
// ====== مرحله ۲: تأیید کد ===================
// ============================================

document.getElementById('code-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('sent-email').textContent;
    const token = document.getElementById('chat-code').value.trim();
    const btn = document.getElementById('code-btn');
    const errorEl = document.getElementById('code-error');

    btn.textContent = 'در حال بررسی...';
    btn.disabled = true;
    errorEl.textContent = '';

    const { data, error } = await supabaseClient.auth.verifyOtp({
        email,
        token,
        type: 'email'
    });

    if (error) {
        errorEl.textContent = 'کد اشتباه یا منقضی شده';
        btn.textContent = 'ورود';
        btn.disabled = false;
        return;
    }

    // حالا کاربر لاگین شد
    currentUser = data.user;

    // اگه اسم نمایشی داشت، بفرستش چت
    const savedName = localStorage.getItem('chat-display-name');
    if (savedName) {
        currentDisplayName = savedName;
        showChat();
    } else {
        askForDisplayName(currentUser);
    }
});


// ============================================
// ====== برگشت به مرحله ایمیل ================
// ============================================

document.getElementById('back-to-email').addEventListener('click', () => {
    document.getElementById('auth-step-email').style.display = 'block';
    document.getElementById('auth-step-code').style.display = 'none';
});


// ============================================
// ====== گرفتن اسم نمایشی ====================
// ============================================

function askForDisplayName(user) {
    let name = prompt('یه اسم برای خودت انتخاب کن (مثلاً: علی):', '');

    // اگه لغو کرد یا خالی بود، دوباره بپرس
    while (!name || !name.trim()) {
        name = prompt('اسم نمی‌تونه خالی باشه. یه اسم انتخاب کن:', '');
        if (name === null) {
            // اگه لغو کرد، از اکانت خارج شو
            supabaseClient.auth.signOut();
            showAuth();
            return;
        }
    }

    name = name.trim().slice(0, 20);
    localStorage.setItem('chat-display-name', name);
    currentUser = user;
    currentDisplayName = name;
    showChat();
}


// ============================================
// ====== خروج ================================
// ============================================

document.getElementById('chat-logout').addEventListener('click', async () => {
    if (!confirm('از چت خارج می‌شی؟')) return;

    await supabaseClient.auth.signOut();

    // اگه بخوای، اسم نمایشی رو پاک کن
    // localStorage.removeItem('chat-display-name');

    currentUser = null;
    currentDisplayName = '';
    showAuth();
});


// ============================================
// ====== پاک‌سازی پیام‌های قدیمی =============
// ============================================

async function cleanupOldMessages() {
    try {
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        await supabaseClient
            .from('messages')
            .delete()
            .lt('created_at', dayAgo);
    } catch (err) {
        console.warn('خطا در پاک‌سازی:', err);
    }
}


// ============================================
// ====== بارگذاری پیام‌ها ====================
// ============================================

async function loadMessages() {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    const { data, error } = await supabaseClient
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(100);

    if (error) {
        console.error('خطا:', error);
        container.innerHTML = '<p class="empty">خطا در بارگذاری پیام‌ها</p>';
        return;
    }

    if (!data || data.length === 0) {
        container.innerHTML = '<p class="empty">هنوز پیامی نیست. اولین نفر باش! 💬</p>';
        return;
    }

    container.innerHTML = data.map(m => renderMessage(m)).join('');
    scrollToBottom();
}


// ============================================
// ====== رندر یه پیام ========================
// ============================================

function renderMessage(msg) {
    // پیام من = پیام از همون user_id
    const isMine = currentUser && msg.user_id === currentUser.id;
    const name = msg.display_name || msg.username || 'کاربر';
    const time = formatTime(msg.created_at);

    return `
        <div class="chat-message ${isMine ? 'mine' : ''}" data-id="${msg.id}">
            <div class="chat-message-header">
                <span class="chat-message-name">${escapeHtml(name)}</span>
                <span class="chat-message-time">${time}</span>
            </div>
            <div class="chat-message-content">${escapeHtml(msg.content)}</div>
        </div>
    `;
}


// ============================================
// ====== Realtime ============================
// ============================================

function setupRealtime() {
    if (chatChannel) {
        supabaseClient.removeChannel(chatChannel);
    }

    chatChannel = supabaseClient
        .channel('chat-room')
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'messages' },
            (payload) => {
                const msg = payload.new;
                if (!document.querySelector(`[data-id="${msg.id}"]`)) {
                    appendMessage(msg);
                }
            }
        )
        .on(
            'postgres_changes',
            { event: 'DELETE', schema: 'public', table: 'messages' },
            (payload) => {
                const el = document.querySelector(`[data-id="${payload.old.id}"]`);
                if (el) el.remove();
            }
        )
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                setStatus('آنلاین', true);
            } else if (status === 'CHANNEL_ERROR') {
                setStatus('خطا در اتصال', false);
            } else if (status === 'TIMED_OUT') {
                setStatus('اتصال قطع شد', false);
            }
        });
}


// ============================================
// ====== اضافه کردن پیام جدید ================
// ============================================

function appendMessage(msg) {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    const empty = container.querySelector('.empty');
    if (empty) empty.remove();

    if (document.querySelector(`[data-id="${msg.id}"]`)) return;

    container.insertAdjacentHTML('beforeend', renderMessage(msg));
    scrollToBottom();
}


// ============================================
// ====== اسکرول به آخر =======================
// ============================================

function scrollToBottom() {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    container.scrollTop = container.scrollHeight;
}


// ============================================
// ====== ارسال پیام ==========================
// ============================================

function setupChatForm() {
    const form = document.getElementById('chat-form');
    const messageInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send');

    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const content = messageInput.value.trim();
        if (!content) {
            messageInput.focus();
            return;
        }

        sendBtn.disabled = true;
        messageInput.disabled = true;

        const { data, error } = await supabaseClient
            .from('messages')
            .insert([{
                user_id: currentUser.id,
                display_name: currentDisplayName,
                username: currentDisplayName,
                content
            }])
            .select()
            .single();

        if (error) {
            console.error('خطا:', error);
            alert('خطا در ارسال پیام');
            sendBtn.disabled = false;
            messageInput.disabled = false;
            return;
        }

        if (data) {
            appendMessage(data);
        }

        messageInput.value = '';
        messageInput.disabled = false;
        sendBtn.disabled = false;
        messageInput.focus();
    });
}


// ============================================
// ====== وضعیت اتصال =========================
// ============================================

function setStatus(text, online) {
    const statusText = document.getElementById('status-text');
    const statusDot = document.querySelector('.status-dot');
    if (!statusText || !statusDot) return;

    statusText.textContent = text;
    statusDot.classList.toggle('online', online);
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

function formatTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('fa-IR', {
        hour: '2-digit',
        minute: '2-digit'
    }).format(d);
}


// ============================================
// ====== شروع ================================
// ============================================

if (document.getElementById('chat-auth')) {
    initChat();
}
