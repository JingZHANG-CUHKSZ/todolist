// 协作（多人实时同步）逻辑
(function setupCollabUI() {
    document.addEventListener('DOMContentLoaded', () => {
        const roomInput = document.getElementById('roomIdInput');
        const createBtn = document.getElementById('createRoomBtn');
        const joinBtn = document.getElementById('joinRoomBtn');
        const copyBtn = document.getElementById('copyInviteBtn');
        const roomStatusBar = document.getElementById('roomStatusBar');
        const roomStatus = document.getElementById('roomStatus');

        // 若 URL 中已有房间参数，自动加入
        const url = new URL(window.location.href);
        const prefillRoom = url.searchParams.get('room');
        if (prefillRoom) {
            roomInput.value = prefillRoom;
            tryJoinRoom(prefillRoom);
        }

        createBtn.addEventListener('click', () => {
            const newId = generateRoomId();
            roomInput.value = newId;
            tryJoinRoom(newId, { createIfMissing: true });
        });

        joinBtn.addEventListener('click', () => {
            const id = roomInput.value.trim();
            if (!id) return alert('请输入房间号');
            tryJoinRoom(id);
        });

        copyBtn.addEventListener('click', async () => {
            const id = roomInput.value.trim();
            if (!id) return alert('请先输入或生成房间号');
            const inviteUrl = `${location.origin}${location.pathname}?room=${encodeURIComponent(id)}`;
            try {
                await navigator.clipboard.writeText(inviteUrl);
                copyBtn.textContent = '已复制';
                setTimeout(() => (copyBtn.textContent = '复制链接'), 1200);
            } catch {
                alert('复制失败，请手动复制：\n' + inviteUrl);
            }
        });

        function generateRoomId() {
            const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
            let s = '';
            for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
            return s;
        }

        async function tryJoinRoom(roomId, options = {}) {
            if (!window.db) {
                alert('请先在 firebase-config.js 中填入你的 Firebase 配置，然后刷新页面。');
                return;
            }

            // 更新 URL，便于分享
            const url = new URL(location.href);
            url.searchParams.set('room', roomId);
            history.replaceState({}, '', url);

            // 显示状态栏
            roomStatusBar.style.display = 'flex';
            roomStatus.textContent = `已加入房间：${roomId}`;

            // 创建房间文档（可选）
            const roomDocRef = db.collection('rooms').doc(roomId);
            if (options.createIfMissing) {
                await roomDocRef.set({ createdAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
            }

            // 建立 todos 子集合的订阅
            const todosRef = roomDocRef.collection('todos');
            const unsubscribe = todosRef.orderBy('createdAt', 'desc').onSnapshot(snapshot => {
                const items = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    items.push({
                        id: doc.id.startsWith('num_') ? Number(doc.id.slice(4)) : data.id || doc.id,
                        text: data.text,
                        completed: !!data.completed,
                        createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate().toLocaleString('zh-CN') : data.createdAt) : new Date().toLocaleString('zh-CN'),
                        completedAt: data.completedAt ? (data.completedAt.toDate ? data.completedAt.toDate().toLocaleString('zh-CN') : data.completedAt) : null
                    });
                });

                if (window.todoManager) {
                    window.todoManager.todos = items;
                    window.todoManager.render();
                    window.todoManager.updateStats();
                }
            });

            // 打补丁：将 todoManager 的本地操作替换为云端操作
            const patchWhenReady = setInterval(() => {
                if (!window.todoManager) return;
                clearInterval(patchWhenReady);

                const original = {
                    addTodo: todoManager.addTodo.bind(todoManager),
                    toggleTodo: todoManager.toggleTodo.bind(todoManager),
                    deleteTodo: todoManager.deleteTodo.bind(todoManager),
                    clearCompleted: todoManager.clearCompleted.bind(todoManager),
                    saveTodos: todoManager.saveTodos.bind(todoManager)
                };

                // 覆盖保存为 no-op（避免写 localStorage）
                todoManager.saveTodos = function () {};

                // 重写新增
                todoManager.addTodo = function () {
                    const input = document.getElementById('todoInput');
                    const text = (input.value || '').trim();
                    if (!text) { alert('请输入待办事项内容！'); return; }
                    const idNum = Date.now();
                    const payload = {
                        id: idNum,
                        text,
                        completed: false,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        completedAt: null
                    };
                    todosRef.doc('num_' + idNum).set(payload);
                    input.value = '';
                };

                // 重写切换完成状态
                todoManager.toggleTodo = function (id) {
                    const docRef = todosRef.doc(String(id).match(/^num_/) ? String(id) : 'num_' + id);
                    docRef.get().then(d => {
                        if (!d.exists) return;
                        const cur = d.data();
                        const nextCompleted = !cur.completed;
                        docRef.update({
                            completed: nextCompleted,
                            completedAt: nextCompleted ? firebase.firestore.FieldValue.serverTimestamp() : null
                        });
                    });
                };

                // 重写删除
                todoManager.deleteTodo = function (id) {
                    if (!confirm('确定要删除这个待办事项吗？')) return;
                    const docRef = todosRef.doc(String(id).match(/^num_/) ? String(id) : 'num_' + id);
                    docRef.delete();
                };

                // 重写清除已完成
                todoManager.clearCompleted = function () {
                    todosRef.where('completed', '==', true).get().then(snapshot => {
                        if (snapshot.empty) { alert('没有已完成的待办事项！'); return; }
                        const batch = db.batch();
                        snapshot.forEach(doc => batch.delete(doc.ref));
                        batch.commit();
                    });
                };

                // 页面关闭时取消订阅
                window.addEventListener('beforeunload', () => unsubscribe && unsubscribe());
            }, 50);
        }
    });
})();

