// 腾讯云开发协作逻辑
(function setupTCBCollab() {
    document.addEventListener('DOMContentLoaded', () => {
        const roomInput = document.getElementById('roomIdInput');
        const generateBtn = document.getElementById('generateRoomBtn');
        const createBtn = document.getElementById('createRoomBtn');
        const copyBtn = document.getElementById('copyInviteBtn');
        const roomStatusBar = document.getElementById('roomStatusBar');
        const roomStatus = document.getElementById('roomStatus');

        let currentRoomId = null;
        let unsubscribe = null;

        // 若 URL 中已有房间参数，自动加入
        const url = new URL(window.location.href);
        const prefillRoom = url.searchParams.get('room');
        if (prefillRoom) {
            roomInput.value = prefillRoom;
            tryJoinRoom(prefillRoom);
        }

        generateBtn.addEventListener('click', () => {
            const newId = generateRoomId();
            roomInput.value = newId;
        });

        createBtn.addEventListener('click', () => {
            const inputId = roomInput.value.trim();
            if (!inputId) {
                alert('请输入房间名或点击"随机生成"');
                return;
            }
            tryJoinRoom(inputId);
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

        async function tryJoinRoom(roomId) {
            if (!window.db) {
                alert('请先在 tcb-config.js 中填入你的腾讯云开发环境ID，然后刷新页面。');
                return;
            }

            // 离开当前房间
            if (unsubscribe) {
                unsubscribe();
                unsubscribe = null;
            }

            currentRoomId = roomId;

            // 更新 URL
            const url = new URL(location.href);
            url.searchParams.set('room', roomId);
            history.replaceState({}, '', url);

            // 显示状态栏
            roomStatusBar.style.display = 'flex';
            roomStatus.textContent = `已加入房间：${roomId}`;

            try {
                // 监听数据变化
                const collection = db.collection('rooms').doc(roomId).collection('todos');
                
                unsubscribe = collection.orderBy('createdAt', 'desc').watch({
                    onChange: function(snapshot) {
                        const items = [];
                        snapshot.docs.forEach(doc => {
                            const data = doc.data();
                            items.push({
                                id: data.id || doc.id,
                                text: data.text,
                                completed: !!data.completed,
                                createdAt: data.createdAt || new Date().toLocaleString('zh-CN'),
                                completedAt: data.completedAt || null
                            });
                        });

                        if (window.todoManager) {
                            window.todoManager.todos = items;
                            window.todoManager.render();
                            window.todoManager.updateStats();
                        }
                    },
                    onError: function(err) {
                        console.error('监听失败：', err);
                        alert('房间连接失败，请重试');
                    }
                });

                // 替换todoManager的方法
                patchTodoManager(roomId);

            } catch (error) {
                console.error('加入房间失败：', error);
                alert('加入房间失败：' + error.message);
            }
        }

        function patchTodoManager(roomId) {
            const checkManager = setInterval(() => {
                if (!window.todoManager) return;
                clearInterval(checkManager);

                const collection = db.collection('rooms').doc(roomId).collection('todos');

                // 覆盖保存方法
                todoManager.saveTodos = function () {};

                // 重写添加方法
                todoManager.addTodo = async function () {
                    const input = document.getElementById('todoInput');
                    const text = (input.value || '').trim();
                    if (!text) { alert('请输入待办事项内容！'); return; }
                    
                    const idNum = Date.now();
                    const payload = {
                        id: idNum,
                        text,
                        completed: false,
                        createdAt: new Date().toLocaleString('zh-CN'),
                        completedAt: null
                    };
                    
                    try {
                        await collection.doc(String(idNum)).set(payload);
                        input.value = '';
                    } catch (error) {
                        console.error('添加失败：', error);
                        alert('添加失败，请重试');
                    }
                };

                // 重写切换状态方法
                todoManager.toggleTodo = async function (id) {
                    try {
                        const doc = await collection.doc(String(id)).get();
                        if (!doc.data) return;
                        
                        const cur = doc.data();
                        const nextCompleted = !cur.completed;
                        await collection.doc(String(id)).update({
                            completed: nextCompleted,
                            completedAt: nextCompleted ? new Date().toLocaleString('zh-CN') : null
                        });
                    } catch (error) {
                        console.error('更新失败：', error);
                        alert('操作失败，请重试');
                    }
                };

                // 重写删除方法
                todoManager.deleteTodo = async function (id) {
                    if (!confirm('确定要删除这个待办事项吗？')) return;
                    
                    try {
                        await collection.doc(String(id)).remove();
                    } catch (error) {
                        console.error('删除失败：', error);
                        alert('删除失败，请重试');
                    }
                };

                // 重写清除已完成方法
                todoManager.clearCompleted = async function () {
                    try {
                        const snapshot = await collection.where({
                            completed: true
                        }).get();
                        
                        if (snapshot.empty) { 
                            alert('没有已完成的待办事项！'); 
                            return; 
                        }
                        
                        if (!confirm(`确定要清除 ${snapshot.docs.length} 个已完成的待办事项吗？`)) return;
                        
                        const batch = db.batch();
                        snapshot.docs.forEach(doc => {
                            batch.delete(collection.doc(doc.id));
                        });
                        await batch.commit();
                    } catch (error) {
                        console.error('清除失败：', error);
                        alert('清除失败，请重试');
                    }
                };
            }, 50);
        }

        // 页面关闭时清理
        window.addEventListener('beforeunload', () => {
            if (unsubscribe) unsubscribe();
        });
    });
})();
