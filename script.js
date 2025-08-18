// 伙伴群任务管理系统
class GroupTaskManager {
    constructor() {
        this.currentGroup = null;
        this.tasks = [];
        this.githubConfig = null;
        this.syncInterval = null;
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

        // 加入群组
        document.getElementById('joinGroup').addEventListener('click', () => {
            this.joinGroup();
        });


    }

    // 创建群组
    async createGroup() {
        const groupNameInput = document.getElementById('groupName');
        const groupName = groupNameInput.value.trim();

        if (!groupName) {
            alert('请输入群组名称');
            return;
        }

        // 检查是否需要GitHub配置
        const needsGithubConfig = !this.loadGithubConfigFromStorage();
        
        if (needsGithubConfig) {
            const token = prompt('请输入GitHub Token（用于数据同步）：\n\n如果没有token，可以去 https://github.com/settings/tokens 创建一个\n\n⚠️ Token会保存到本地，方便下次使用');
            if (!token) {
                return;
            }
            
            this.githubConfig = {
                token: token,
                owner: 'JingZHANG-CUHKSZ', // 你的GitHub用户名
                repo: 'todolist',          // 使用现有仓库
                branch: 'main'
            };
            
            // 保存到本地存储
            this.saveGithubConfigToStorage();
        }

        // 生成群组ID
        const groupId = this.generateGroupId();
        
        this.currentGroup = {
            id: groupId,
            name: groupName,
            createdAt: new Date().toISOString(),
            createdBy: '创建者',
            tasks: []
        };

        this.tasks = [];
        
        try {
            // 保存到GitHub
            await this.saveToGithub();
            this.showGroupInterface();
            this.updateUrlSimple(); // 使用简单URL
            this.startAutoSync();
        } catch (error) {
            alert('创建群组失败：' + error.message);
            return;
        }
        
        // 清空输入框
        groupNameInput.value = '';
    }

    // 生成群组ID
    generateGroupId() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    // 加入群组
    async joinGroup() {
        const joinInput = document.getElementById('groupName');
        const joinValue = joinInput.value.trim();

        if (!joinValue) {
            alert('请输入群组ID或名称');
            return;
        }

        // 检查是否有GitHub配置
        let githubConfig = this.loadGithubConfigFromStorage() || 
                          this.loadGithubConfigFromFragment() ||
                          this.loadGithubConfigFromUrl();
        
        if (!githubConfig) {
            alert('无法加入群组！\n\n请通过以下方式加入：\n1. 使用朋友分享的完整链接\n2. 或者先创建群组获取权限');
            return;
        }

        this.githubConfig = githubConfig;

        try {
            // 尝试按群组ID直接查找（ID通常是大写）
            let groupId = joinValue.toUpperCase();
            
            try {
                await this.loadFromGithub(groupId);
                this.startAutoSync();
                joinInput.value = '';
                return;
            } catch (error) {
                // 如果直接查找失败，尝试按名称搜索
                console.log('按ID查找失败，尝试按名称搜索...');
            }

            // 按群组名称搜索（不区分大小写）
            const foundGroup = await this.searchGroupByName(joinValue);
            if (foundGroup) {
                await this.loadFromGithub(foundGroup.id);
                this.startAutoSync();
                joinInput.value = '';
            } else {
                alert(`未找到群组：${joinValue}\n\n可能原因：\n1. 群组ID或名称不正确\n2. 群组尚未创建\n3. 您没有访问权限\n\n建议使用朋友分享的完整链接加入`);
            }

        } catch (error) {
            console.error('加入群组失败:', error);
            alert('加入群组失败：' + error.message + '\n\n建议使用朋友分享的完整链接加入');
        }
    }

    // 按名称搜索群组
    async searchGroupByName(groupName) {
        if (!this.githubConfig) return null;

        try {
            // 获取data文件夹下的所有文件
            const response = await fetch(
                `https://api.github.com/repos/${this.githubConfig.owner}/${this.githubConfig.repo}/contents/data`,
                {
                    headers: {
                        'Authorization': `token ${this.githubConfig.token}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const files = await response.json();
            
            // 搜索所有群组文件
            for (const file of files) {
                if (file.name.startsWith('group-') && file.name.endsWith('.json')) {
                    try {
                        // 获取文件内容
                        const fileResponse = await fetch(file.download_url);
                        const content = await fileResponse.json();
                        
                        // 检查群组名称是否匹配（不区分大小写）
                        if (content.group && content.group.name && 
                            content.group.name.toLowerCase() === groupName.toLowerCase()) {
                            return content.group;
                        }
                    } catch (error) {
                        console.error('读取群组文件失败:', file.name, error);
                    }
                }
            }

            return null;
        } catch (error) {
            console.error('搜索群组失败:', error);
            throw error;
        }
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
        if (!this.currentGroup) return;
        
        // 生成分享链接（包含隐藏token）
        this.updateUrlSimple();
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
    async addTask() {
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
        
        // 保存到GitHub（如果有配置）
        if (this.githubConfig) {
            try {
                await this.saveToGithub();
            } catch (error) {
                console.error('保存失败:', error);
            }
        } else {
            this.updateUrl();
        }
    }

    // 切换任务状态
    async toggleTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            task.completed = !task.completed;
            task.completedAt = task.completed ? new Date().toISOString() : null;
            
            this.currentGroup.tasks = this.tasks;
            this.updateTaskList();
            this.updateStats();
            
            // 保存到GitHub（如果有配置）
            if (this.githubConfig) {
                try {
                    await this.saveToGithub();
                } catch (error) {
                    console.error('保存失败:', error);
                }
            } else {
                this.updateUrl();
            }
        }
    }

    // 删除任务
    async deleteTask(taskId) {
        if (confirm('确定要删除这个任务吗？')) {
            this.tasks = this.tasks.filter(t => t.id !== taskId);
            this.currentGroup.tasks = this.tasks;
            
            this.updateTaskList();
            this.updateStats();
            
            // 保存到GitHub（如果有配置）
            if (this.githubConfig) {
                try {
                    await this.saveToGithub();
                } catch (error) {
                    console.error('保存失败:', error);
                }
            } else {
                this.updateUrl();
            }
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
                     onclick="taskManager.handleToggleTask('${task.id}')"></div>
                <div class="task-content">
                    <div class="task-text ${task.completed ? 'completed' : ''}">${this.escapeHtml(task.text)}</div>
                    <div class="task-meta">
                        ${task.createdBy} • ${this.formatDate(task.createdAt)}
                        ${task.completed ? ' • 已完成' : ''}
                    </div>
                </div>
                <div class="task-actions">
                    <button class="btn-small btn-delete" onclick="taskManager.handleDeleteTask('${task.id}')">删除</button>
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

        const compressed = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
        const url = new URL(window.location);
        url.searchParams.set('data', compressed);
        
        window.history.replaceState({}, '', url);
    }

    // 从URL加载数据
    async loadFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const dataParam = urlParams.get('data');
        const groupParam = urlParams.get('group');
        
        // 优先尝试GitHub同步模式（简单链接模式）
        if (groupParam) {
            // 按优先级尝试加载GitHub配置
            let githubConfig = this.loadGithubConfigFromFragment() || // 1. 从URL fragment加载（新方式）
                               this.loadGithubConfigFromStorage() ||  // 2. 从本地存储加载
                               this.loadGithubConfigFromUrl();        // 3. 从URL参数加载（兼容旧链接）
            
            if (githubConfig) {
                try {
                    await this.loadFromGithub(groupParam);
                    this.startAutoSync();
                    return;
                } catch (error) {
                    console.error('从GitHub加载失败:', error);
                    alert('加载群组失败：' + error.message + '\n\n请联系群组创建者重新分享链接');
                }
            } else {
                alert('无法加载群组配置\n\n请确保使用正确的分享链接，或联系群组创建者重新分享');
            }
        }
        
        // 回退到URL参数模式
        if (!dataParam) return;

        try {
            const data = JSON.parse(decodeURIComponent(escape(atob(dataParam))));
            
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

    // === 同步包装器方法（用于HTML onclick调用）===

    // 处理任务状态切换（同步包装器）
    handleToggleTask(taskId) {
        this.toggleTask(taskId).catch(error => {
            console.error('切换任务状态失败:', error);
        });
    }

    // 处理任务删除（同步包装器）
    handleDeleteTask(taskId) {
        this.deleteTask(taskId).catch(error => {
            console.error('删除任务失败:', error);
        });
    }

    // === GitHub API 相关方法 ===

    // 保存GitHub配置到本地存储
    saveGithubConfigToStorage() {
        if (!this.githubConfig) return;
        
        try {
            localStorage.setItem('github_config', JSON.stringify(this.githubConfig));
        } catch (error) {
            console.error('保存GitHub配置失败:', error);
        }
    }

    // 从本地存储加载GitHub配置
    loadGithubConfigFromStorage() {
        try {
            const configStr = localStorage.getItem('github_config');
            if (configStr) {
                const config = JSON.parse(configStr);
                this.githubConfig = config;
                return config;
            }
        } catch (error) {
            console.error('从本地存储加载GitHub配置失败:', error);
        }
        return null;
    }

    // 从URL fragment加载GitHub配置
    loadGithubConfigFromFragment() {
        const hash = window.location.hash;
        if (!hash.startsWith('#token=')) return null;

        try {
            const tokenParam = hash.substring(7); // 去掉 '#token='
            const config = JSON.parse(decodeURIComponent(escape(atob(tokenParam))));
            this.githubConfig = config;
            return config;
        } catch (error) {
            console.error('从fragment加载GitHub配置失败:', error);
            return null;
        }
    }

    // 从URL加载GitHub配置（兼容旧链接）
    loadGithubConfigFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const configParam = urlParams.get('config');
        
        if (!configParam) return null;

        try {
            const config = JSON.parse(decodeURIComponent(escape(atob(configParam))));
            this.githubConfig = config;
            return config;
        } catch (error) {
            console.error('加载GitHub配置失败:', error);
            return null;
        }
    }

    // 保存数据到GitHub
    async saveToGithub() {
        if (!this.githubConfig || !this.currentGroup) return;

        const data = {
            group: this.currentGroup,
            tasks: this.tasks,
            lastUpdated: new Date().toISOString()
        };

        const fileName = `data/group-${this.currentGroup.id}.json`;
        const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));

        try {
            // 先尝试获取文件（检查是否存在）
            let sha = null;
            try {
                const response = await fetch(
                    `https://api.github.com/repos/${this.githubConfig.owner}/${this.githubConfig.repo}/contents/${fileName}`,
                    {
                        headers: {
                            'Authorization': `token ${this.githubConfig.token}`,
                            'Accept': 'application/vnd.github.v3+json'
                        }
                    }
                );
                
                if (response.ok) {
                    const fileData = await response.json();
                    sha = fileData.sha;
                }
            } catch (e) {
                // 文件不存在，sha保持null
            }

            // 创建或更新文件
            const updateResponse = await fetch(
                `https://api.github.com/repos/${this.githubConfig.owner}/${this.githubConfig.repo}/contents/${fileName}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${this.githubConfig.token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: `Update group ${this.currentGroup.name} tasks`,
                        content: content,
                        branch: this.githubConfig.branch,
                        ...(sha && { sha })
                    })
                }
            );

            if (!updateResponse.ok) {
                const error = await updateResponse.text();
                throw new Error(`GitHub API错误: ${error}`);
            }

        } catch (error) {
            console.error('保存到GitHub失败:', error);
            throw error;
        }
    }

    // 从GitHub加载数据
    async loadFromGithub(groupId) {
        if (!this.githubConfig) return;

        const fileName = `data/group-${groupId}.json`;

        try {
            const response = await fetch(
                `https://api.github.com/repos/${this.githubConfig.owner}/${this.githubConfig.repo}/contents/${fileName}`,
                {
                    headers: {
                        'Authorization': `token ${this.githubConfig.token}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const fileData = await response.json();
            const content = JSON.parse(decodeURIComponent(escape(atob(fileData.content))));

            if (content.group && content.tasks) {
                this.currentGroup = content.group;
                this.tasks = content.tasks || [];
                this.showGroupInterface();
            }

        } catch (error) {
            console.error('从GitHub加载失败:', error);
            throw error;
        }
    }

    // 开始自动同步
    startAutoSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }

        // 每10秒同步一次
        this.syncInterval = setInterval(async () => {
            if (this.githubConfig && this.currentGroup) {
                try {
                    await this.loadFromGithub(this.currentGroup.id);
                } catch (error) {
                    console.error('自动同步失败:', error);
                }
            }
        }, 10000);
    }

    // 更新URL（简单模式 - 群组ID + 隐藏token）
    updateUrlSimple() {
        if (!this.currentGroup || !this.githubConfig) return;

        const url = new URL(window.location);
        url.searchParams.set('group', this.currentGroup.id);
        url.searchParams.delete('config'); // 删除配置参数
        url.searchParams.delete('data'); // 删除旧的data参数
        
        // 将token加密后放在fragment中（#后面，不会发送到服务器）
        const tokenData = {
            token: this.githubConfig.token,
            owner: this.githubConfig.owner,
            repo: this.githubConfig.repo,
            branch: this.githubConfig.branch
        };
        const encryptedToken = btoa(unescape(encodeURIComponent(JSON.stringify(tokenData))));
        url.hash = `token=${encryptedToken}`;
        
        window.history.replaceState({}, '', url);
    }

    // 更新URL（完整模式 - 兼容旧版本）
    updateUrlForGithub() {
        if (!this.currentGroup || !this.githubConfig) return;

        const configData = {
            token: this.githubConfig.token,
            owner: this.githubConfig.owner,
            repo: this.githubConfig.repo,
            branch: this.githubConfig.branch
        };

        const compressed = btoa(unescape(encodeURIComponent(JSON.stringify(configData))));
        const url = new URL(window.location);
        url.searchParams.set('group', this.currentGroup.id);
        url.searchParams.set('config', compressed);
        url.searchParams.delete('data'); // 删除旧的data参数
        
        window.history.replaceState({}, '', url);
    }
}

// 初始化应用
const taskManager = new GroupTaskManager();

// 导出到全局，方便HTML中的onclick调用
window.taskManager = taskManager;
