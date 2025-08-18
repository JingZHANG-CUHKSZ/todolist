// GitHub协作逻辑 - 100%免费方案
(function setupGitHubCollab() {
    document.addEventListener('DOMContentLoaded', () => {
        const roomInput = document.getElementById('roomIdInput');
        const generateBtn = document.getElementById('generateRoomBtn');
        const createBtn = document.getElementById('createRoomBtn');
        const copyBtn = document.getElementById('copyInviteBtn');
        const roomStatusBar = document.getElementById('roomStatusBar');
        const roomStatus = document.getElementById('roomStatus');

        let currentRoomId = null;
        let syncInterval = null;

        // GitHub仓库信息（使用你现有的仓库）
        const GITHUB_OWNER = GITHUB_CONFIG.OWNER;
        const GITHUB_REPO = GITHUB_CONFIG.REPO;
        const GITHUB_API = GITHUB_CONFIG.API_BASE;

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
            currentRoomId = roomId;

            // 更新 URL
            const url = new URL(location.href);
            url.searchParams.set('room', roomId);
            history.replaceState({}, '', url);

            // 显示状态栏
            roomStatusBar.style.display = 'flex';
            roomStatus.textContent = `已加入房间：${roomId} (GitHub同步)`;

            // 首次加载数据
            await loadRoomData(roomId);

            // 开启定时同步（每3秒检查一次）
            if (syncInterval) clearInterval(syncInterval);
            syncInterval = setInterval(() => loadRoomData(roomId), 3000);

            // 替换todoManager的方法
            patchTodoManager(roomId);
        }

        async function loadRoomData(roomId) {
            try {
                const fileName = `room-${roomId}.json`;
                const response = await fetch(`${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/rooms/${fileName}`, {
                    headers: getAuthHeaders()
                });
                
                if (response.ok) {
                    const data = await response.json();
                    const content = JSON.parse(atob(data.content));
                    
                    if (window.todoManager) {
                        const newTodos = content.todos || [];
                        // 只有数据真的变化时才更新
                        if (JSON.stringify(todoManager.todos) !== JSON.stringify(newTodos)) {
                            todoManager.todos = newTodos;
                            todoManager.render();
                            todoManager.updateStats();
                        }
                    }
                } else if (response.status === 404) {
                    // 房间不存在，创建空房间
                    await saveRoomData(roomId, []);
                }
            } catch (error) {
                console.log('加载房间数据失败（可能是网络问题）：', error);
                // 失败时不显示错误，静默处理
            }
        }

        async function saveRoomData(roomId, todos) {
            try {
                const fileName = `room-${roomId}.json`;
                const content = JSON.stringify({
                    roomId,
                    lastUpdated: new Date().toISOString(),
                    todos: todos
                }, null, 2);

                // 先尝试获取文件（如果存在需要sha）
                let sha = null;
                try {
                    const getResponse = await fetch(`${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/rooms/${fileName}`, {
                        headers: getAuthHeaders()
                    });
                    if (getResponse.ok) {
                        const fileData = await getResponse.json();
                        sha = fileData.sha;
                    }
                } catch (e) {
                    // 文件不存在，sha保持null
                }

                // 保存到GitHub
                const payload = {
                    message: `更新房间 ${roomId} 的待办数据`,
                    content: btoa(unescape(encodeURIComponent(content))),
                };
                
                if (sha) payload.sha = sha;

                await fetch(`${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/rooms/${fileName}`, {
                    method: 'PUT',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(payload)
                });

            } catch (error) {
                console.error('保存失败：', error);
                alert('保存失败，请检查网络连接');
            }
        }

        function patchTodoManager(roomId) {
            const checkManager = setInterval(() => {
                if (!window.todoManager) return;
                clearInterval(checkManager);

                // 覆盖保存方法
                todoManager.saveTodos = function () {
                    // GitHub版本通过其他方法保存
                };

                // 重写添加方法
                todoManager.addTodo = async function () {
                    const input = document.getElementById('todoInput');
                    const text = (input.value || '').trim();
                    if (!text) { alert('请输入待办事项内容！'); return; }
                    
                    const todo = {
                        id: Date.now(),
                        text,
                        completed: false,
                        createdAt: new Date().toLocaleString('zh-CN'),
                        completedAt: null
                    };
                    
                    this.todos.unshift(todo);
                    input.value = '';
                    this.render();
                    this.updateStats();
                    
                    await saveRoomData(roomId, this.todos);
                };

                // 重写切换状态方法
                todoManager.toggleTodo = async function (id) {
                    this.todos = this.todos.map(todo => {
                        if (todo.id === id) {
                            todo.completed = !todo.completed;
                            todo.completedAt = todo.completed ? new Date().toLocaleString('zh-CN') : null;
                        }
                        return todo;
                    });
                    
                    this.render();
                    this.updateStats();
                    await saveRoomData(roomId, this.todos);
                };

                // 重写删除方法
                todoManager.deleteTodo = async function (id) {
                    if (!confirm('确定要删除这个待办事项吗？')) return;
                    
                    this.todos = this.todos.filter(todo => todo.id !== id);
                    this.render();
                    this.updateStats();
                    await saveRoomData(roomId, this.todos);
                };

                // 重写清除已完成方法
                todoManager.clearCompleted = async function () {
                    const completedCount = this.todos.filter(todo => todo.completed).length;
                    
                    if (completedCount === 0) {
                        alert('没有已完成的待办事项！');
                        return;
                    }
                    
                    if (confirm(`确定要清除 ${completedCount} 个已完成的待办事项吗？`)) {
                        this.todos = this.todos.filter(todo => !todo.completed);
                        this.render();
                        this.updateStats();
                        await saveRoomData(roomId, this.todos);
                    }
                };
            }, 50);
        }

        // 页面关闭时清理
        window.addEventListener('beforeunload', () => {
            if (syncInterval) clearInterval(syncInterval);
        });
    });
})();
