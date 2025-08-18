// 本地协作逻辑 - 通过URL分享，完全无服务器
(function setupLocalCollab() {
    document.addEventListener('DOMContentLoaded', () => {
        const roomInput = document.getElementById('roomIdInput');
        const generateBtn = document.getElementById('generateRoomBtn');
        const createBtn = document.getElementById('createRoomBtn');
        const copyBtn = document.getElementById('copyInviteBtn');
        const roomStatusBar = document.getElementById('roomStatusBar');
        const roomStatus = document.getElementById('roomStatus');

        let currentRoomId = null;
        
        // 压缩和解压缩数据
        function compressData(data) {
            return btoa(encodeURIComponent(JSON.stringify(data)));
        }
        
        function decompressData(compressed) {
            try {
                return JSON.parse(decodeURIComponent(atob(compressed)));
            } catch (e) {
                return null;
            }
        }
        
        // 从URL获取房间数据
        function getRoomDataFromUrl() {
            const urlParams = new URLSearchParams(window.location.search);
            const roomData = urlParams.get('data');
            return roomData ? decompressData(roomData) : null;
        }
        
        // 更新URL中的房间数据
        function updateUrlWithRoomData(roomId, todos) {
            const data = { roomId, todos, lastUpdated: new Date().toISOString() };
            const compressed = compressData(data);
            const url = new URL(window.location);
            url.searchParams.set('room', roomId);
            url.searchParams.set('data', compressed);
            window.history.replaceState({}, '', url);
        }

        // 若 URL 中已有房间参数，自动加入
        const url = new URL(window.location.href);
        const prefillRoom = url.searchParams.get('room');
        if (prefillRoom) {
            roomInput.value = prefillRoom;
            joinRoom(prefillRoom);
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
            joinRoom(inputId);
        });

        copyBtn.addEventListener('click', async () => {
            if (!currentRoomId) {
                alert('请先创建或加入房间');
                return;
            }
            
            // 复制当前完整的URL（包含数据）
            const currentUrl = window.location.href;
            try {
                await navigator.clipboard.writeText(currentUrl);
                copyBtn.textContent = '已复制';
                setTimeout(() => (copyBtn.textContent = '复制链接'), 1200);
            } catch {
                alert('复制失败，请手动复制：\n' + currentUrl);
            }
        });

        function generateRoomId() {
            const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
            let s = '';
            for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
            return s;
        }

        function joinRoom(roomId) {
            currentRoomId = roomId;

            // 显示状态栏
            roomStatusBar.style.display = 'flex';
            roomStatus.textContent = `已加入房间：${roomId} (本地协作)`;

            // 强制清空所有本地数据
            localStorage.clear();
            
            // 立即清空URL中的旧数据，避免房间间数据污染
            const url = new URL(window.location);
            url.searchParams.delete('data'); // 删除旧的数据参数
            url.searchParams.set('room', roomId); // 只保留房间名
            window.history.replaceState({}, '', url);
            
            // 强制重置todoManager
            if (window.todoManager) {
                todoManager.todos = [];
                todoManager.currentFilter = 'all';
                todoManager.render();
                todoManager.updateStats();
                
                // 重置筛选按钮
                document.querySelectorAll('.filter-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                document.querySelector('[data-filter="all"]').classList.add('active');
            }

            // 检查URL中是否有当前房间的数据
            const roomData = getRoomDataFromUrl();
            if (roomData && roomData.roomId === roomId && Array.isArray(roomData.todos) && roomData.todos.length > 0) {
                // 只有明确匹配当前房间ID且有有效数据时才加载
                if (window.todoManager) {
                    todoManager.todos = roomData.todos;
                    todoManager.render();
                    todoManager.updateStats();
                }
                roomStatus.textContent = `已加入房间：${roomId} (已同步 ${new Date(roomData.lastUpdated).toLocaleTimeString()})`;
            } else {
                // 新房间或无匹配数据，初始化为空
                updateUrlWithRoomData(roomId, []);
                roomStatus.textContent = `已创建房间：${roomId} (空房间)`;
            }

            // 替换todoManager的方法
            patchTodoManager(roomId);
        }

        // 保存房间数据到URL
        function saveRoomData(roomId, todos) {
            updateUrlWithRoomData(roomId, todos);
        }

        function patchTodoManager(roomId) {
            const checkManager = setInterval(() => {
                if (!window.todoManager) return;
                clearInterval(checkManager);

                // 绑定按钮事件
                const addBtn = document.getElementById('addBtn');
                const clearBtn = document.getElementById('clearCompleted');
                
                if (addBtn) {
                    addBtn.onclick = () => todoManager.addTodo();
                }
                if (clearBtn) {
                    clearBtn.onclick = () => todoManager.clearCompleted();
                }

                // 覆盖保存方法
                todoManager.saveTodos = function () {
                    // 本地协作版本通过URL保存
                    saveRoomData(roomId, this.todos);
                };

                // 重写添加方法
                todoManager.addTodo = function () {
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
                    
                    saveRoomData(roomId, this.todos);
                };

                // 重写切换状态方法
                todoManager.toggleTodo = function (id) {
                    this.todos = this.todos.map(todo => {
                        if (todo.id === id) {
                            todo.completed = !todo.completed;
                            todo.completedAt = todo.completed ? new Date().toLocaleString('zh-CN') : null;
                        }
                        return todo;
                    });
                    
                    this.render();
                    this.updateStats();
                    saveRoomData(roomId, this.todos);
                };

                // 重写删除方法
                todoManager.deleteTodo = function (id) {
                    if (!confirm('确定要删除这个待办事项吗？')) return;
                    
                    this.todos = this.todos.filter(todo => todo.id !== id);
                    this.render();
                    this.updateStats();
                    saveRoomData(roomId, this.todos);
                };

                // 重写清除已完成方法
                todoManager.clearCompleted = function () {
                    const completedCount = this.todos.filter(todo => todo.completed).length;
                    
                    if (completedCount === 0) {
                        alert('没有已完成的待办事项！');
                        return;
                    }
                    
                    if (confirm(`确定要清除 ${completedCount} 个已完成的待办事项吗？`)) {
                        this.todos = this.todos.filter(todo => !todo.completed);
                        this.render();
                        this.updateStats();
                        saveRoomData(roomId, this.todos);
                    }
                };
            }, 50);
        }

    });
})();
