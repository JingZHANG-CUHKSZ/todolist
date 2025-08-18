// 伙伴群任务管理系统
class GroupTaskManager {
    constructor() {
        this.currentGroup = null;
        this.tasks = [];
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadFromUrl();
    }

    // 绑定所有事件
    bindEvents() {
        // 群组创建
        document.getElementById('createGroup').addEventListener('click', () => {
            this.createGroup();
        });

        // 群组分享
        document.getElementById('shareGroup').addEventListener('click', () => {
            this.shareGroup();
        });

        // 任务添加
        document.getElementById('addTask').addEventListener('click', () => {
            this.addTask();
        });

        // 回车添加任务
        document.getElementById('taskInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addTask();
            }
        });

        // 群组名回车创建
        document.getElementById('groupName').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.createGroup();
            }
        });
    }

    // 创建群组
    createGroup() {
        const groupNameInput = document.getElementById('groupName');
        const groupName = groupNameInput.value.trim();

        if (!groupName) {
            alert('请输入群组名称');
            return;
        }

        // 生成群组ID
        const groupId = this.generateGroupId();
        
        this.currentGroup = {
            id: groupId,
            name: groupName,
            createdAt: new Date().toISOString(),
            tasks: []
        };

        this.tasks = [];
        this.showGroupInterface();
        this.updateUrl();
        
        // 清空输入框
        groupNameInput.value = '';
    }

    // 生成群组ID
    generateGroupId() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    // 显示群组界面
    showGroupInterface() {
        if (!this.currentGroup) return;

        // 更新群组信息
        document.getElementById('currentGroupName').textContent = this.currentGroup.name;
        document.getElementById('groupId').textContent = this.currentGroup.id;

        // 显示相关区域
        document.getElementById('groupInfo').classList.remove('hidden');
        document.getElementById('taskSection').classList.remove('hidden');

        this.updateTaskList();
        this.updateStats();
    }

    // 分享群组
    async shareGroup() {
        const shareUrl = window.location.href;
        
        try {
            await navigator.clipboard.writeText(shareUrl);
            
            // 临时改变按钮文字
            const btn = document.getElementById('shareGroup');
            const originalText = btn.textContent;
            btn.textContent = '已复制到剪贴板！';
            
            setTimeout(() => {
                btn.textContent = originalText;
            }, 2000);
        } catch (err) {
            // 如果复制失败，显示URL
            alert('分享链接：\n' + shareUrl);
        }
    }

    // 添加任务
    addTask() {
        const taskInput = document.getElementById('taskInput');
        const taskText = taskInput.value.trim();

        if (!taskText) {
            return; // 静默返回
        }

        const task = {
            id: Date.now().toString(),
            text: taskText,
            completed: false,
            createdAt: new Date().toISOString(),
            createdBy: '我' // 后面可以改进为用户名
        };

        this.tasks.unshift(task);
        this.currentGroup.tasks = this.tasks;
        
        taskInput.value = '';
        this.updateTaskList();
        this.updateStats();
        this.updateUrl();
    }

    // 切换任务状态
    toggleTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            task.completed = !task.completed;
            task.completedAt = task.completed ? new Date().toISOString() : null;
            
            this.currentGroup.tasks = this.tasks;
            this.updateTaskList();
            this.updateStats();
            this.updateUrl();
        }
    }

    // 删除任务
    deleteTask(taskId) {
        if (confirm('确定要删除这个任务吗？')) {
            this.tasks = this.tasks.filter(t => t.id !== taskId);
            this.currentGroup.tasks = this.tasks;
            
            this.updateTaskList();
            this.updateStats();
            this.updateUrl();
        }
    }

    // 更新任务列表显示
    updateTaskList() {
        const taskList = document.getElementById('taskList');
        
        if (this.tasks.length === 0) {
            taskList.innerHTML = `
                <div class="empty-state">
                    <p>还没有任务，快来添加第一个吧！</p>
                </div>
            `;
            return;
        }

        taskList.innerHTML = this.tasks.map(task => `
            <div class="task-item">
                <div class="task-checkbox ${task.completed ? 'checked' : ''}" 
                     onclick="taskManager.toggleTask('${task.id}')"></div>
                <div class="task-content">
                    <div class="task-text ${task.completed ? 'completed' : ''}">${this.escapeHtml(task.text)}</div>
                    <div class="task-meta">
                        ${task.createdBy} • ${this.formatDate(task.createdAt)}
                        ${task.completed ? ' • 已完成' : ''}
                    </div>
                </div>
                <div class="task-actions">
                    <button class="btn-small btn-delete" onclick="taskManager.deleteTask('${task.id}')">删除</button>
                </div>
            </div>
        `).join('');
    }

    // 更新统计信息
    updateStats() {
        const total = this.tasks.length;
        const completed = this.tasks.filter(task => task.completed).length;
        
        document.getElementById('totalTasks').textContent = `总任务: ${total}`;
        document.getElementById('completedTasks').textContent = `已完成: ${completed}`;
    }

    // 更新URL
    updateUrl() {
        if (!this.currentGroup) return;

        const data = {
            group: this.currentGroup,
            tasks: this.tasks
        };

        const compressed = btoa(encodeURIComponent(JSON.stringify(data)));
        const url = new URL(window.location);
        url.searchParams.set('data', compressed);
        
        window.history.replaceState({}, '', url);
    }

    // 从URL加载数据
    loadFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const dataParam = urlParams.get('data');
        
        if (!dataParam) return;

        try {
            const data = JSON.parse(decodeURIComponent(atob(dataParam)));
            
            if (data.group && data.tasks) {
                this.currentGroup = data.group;
                this.tasks = data.tasks || [];
                this.showGroupInterface();
            }
        } catch (error) {
            console.error('加载数据失败:', error);
        }
    }

    // HTML转义
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 格式化日期
    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return '刚刚';
        if (diffMins < 60) return `${diffMins}分钟前`;
        if (diffHours < 24) return `${diffHours}小时前`;
        if (diffDays < 7) return `${diffDays}天前`;
        
        return date.toLocaleDateString('zh-CN');
    }
}

// 初始化应用
const taskManager = new GroupTaskManager();

// 导出到全局，方便HTML中的onclick调用
window.taskManager = taskManager;
