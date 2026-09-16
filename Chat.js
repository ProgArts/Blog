// ============================================
// ====== متغیرهای چت =========================
// ============================================

let chatChannel = null;
let myUsername = '';


// ============================================
// ====== شروع چت =============================
// ============================================

async function initChat() {
    const messagesEl = document.getElementById('chat-messages');
    if (!messagesEl) return;

    // اسم کاربر رو از localStorage بگیر
    myUsername = localStorage.getItem('chat-username') || '';
    if (myUsername) {
        document.getElementById('chat-username').value = myUsername;
    }

    // پاک‌سازی پیام‌های قدیمی
    await cleanupOldMessages();

    // بارگذاری پیام‌ها
    await loadMessages();

    // فعال کردن Realtime
    setupRealtime();

    // فعال کردن فرم
    setupChatForm();

    // وضعیت آنلاین
    setStatus('آنلاین', true);
}


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
    const isMine = msg.username === myUsername;
    const time = formatTime(msg.created_at);

    return `
        <div class="chat-message ${isMine ? 'mine' : ''}" data-id="${msg.id}">
            <div class="chat-message-header">
                <span class="chat-message-name">${escapeHtml(msg.username)}</span>
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
    chatChannel = supabaseClient
        .channel('chat-room')
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'messages' },
            (payload) => {
                const msg = payload.new;
                // اگه پیام خودمون نباشه، اضافه کن
                if (msg.username !== myUsername || !document.querySelector(`[data-id="${msg.id}"]`)) {
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

    // اگه "هنوز پیامی نیست" هست، پاکش کن
    const empty = container.querySelector('.empty');
    if (empty) empty.remove();

    // جلوگیری از تکراری
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
    const usernameInput = document.getElementById('chat-username');
    const messageInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send');

    if (!form) return;

    // ذخیره اسم وقتی عوض می‌شه
    usernameInput.addEventListener('input', () => {
        myUsername = usernameInput.value.trim();
        localStorage.setItem('chat-username', myUsername);
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = usernameInput.value.trim();
        const content = messageInput.value.trim();

        if (!username) {
            usernameInput.focus();
            return;
        }

        if (!content) {
            messageInput.focus();
            return;
        }

        myUsername = username;
        localStorage.setItem('chat-username', username);

        sendBtn.disabled = true;
        messageInput.disabled = true;

        const { data, error } = await supabaseClient
            .from('messages')
            .insert([{ username, content }])
            .select()
            .single();

        if (error) {
            console.error('خطا:', error);
            alert('خطا در ارسال پیام');
            sendBtn.disabled = false;
            messageInput.disabled = false;
            return;
        }

        // پیام خودمون رو فوری اضافه کن (چون Realtime ممکنه تأخیر داشته باشه)
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

if (document.getElementById('chat-messages')) {
    initChat();
}