// 待办事项管理器
class TodoManager {
    constructor() {
        this.todos = this.loadTodos();
        this.currentFilter = 'all';
        this.init();
    }

    // 初始化
    init() {
        this.bindEvents();
        this.render();
        this.updateStats();
    }

    // 绑定事件
    bindEvents() {
        // 添加待办事项
        const todoInput = document.getElementById('todoInput');
        const addBtn = document.getElementById('addBtn');
        
        addBtn.addEventListener('click', () => this.addTodo());
        todoInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addTodo();
            }
        });

        // 筛选按钮
        const filterBtns = document.querySelectorAll('.filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setFilter(e.target.dataset.filter);
            });
        });

        // 清除已完成
        document.getElementById('clearCompleted').addEventListener('click', () => {
            this.clearCompleted();
        });
    }

    // 添加待办事项
    addTodo() {
        const input = document.getElementById('todoInput');
        const text = input.value.trim();
        
        if (text === '') {
            alert('请输入待办事项内容！');
            return;
        }

        const todo = {
            id: Date.now(),
            text: text,
            completed: false,
            createdAt: new Date().toLocaleString('zh-CN')
        };

        this.todos.unshift(todo);
        input.value = '';
        this.saveTodos();
        this.render();
        this.updateStats();
        
        // 添加成功动画
        setTimeout(() => {
            const firstItem = document.querySelector('.todo-item');
            if (firstItem) {
                firstItem.style.backgroundColor = '#e8f5e8';
                setTimeout(() => {
                    firstItem.style.backgroundColor = '';
                }, 1000);
            }
        }, 100);
    }

    // 切换待办事项完成状态
    toggleTodo(id) {
        this.todos = this.todos.map(todo => {
            if (todo.id === id) {
                todo.completed = !todo.completed;
                todo.completedAt = todo.completed ? new Date().toLocaleString('zh-CN') : null;
            }
            return todo;
        });
        
        this.saveTodos();
        this.render();
        this.updateStats();
    }

    // 删除待办事项
    deleteTodo(id) {
        if (confirm('确定要删除这个待办事项吗？')) {
            this.todos = this.todos.filter(todo => todo.id !== id);
            this.saveTodos();
            this.render();
            this.updateStats();
        }
    }

    // 设置筛选器
    setFilter(filter) {
        this.currentFilter = filter;
        
        // 更新按钮状态
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-filter="${filter}"]`).classList.add('active');
        
        this.render();
    }

    // 清除已完成的待办事项
    clearCompleted() {
        const completedCount = this.todos.filter(todo => todo.completed).length;
        
        if (completedCount === 0) {
            alert('没有已完成的待办事项！');
            return;
        }
        
        if (confirm(`确定要清除 ${completedCount} 个已完成的待办事项吗？`)) {
            this.todos = this.todos.filter(todo => !todo.completed);
            this.saveTodos();
            this.render();
            this.updateStats();
        }
    }

    // 获取过滤后的待办事项
    getFilteredTodos() {
        switch (this.currentFilter) {
            case 'active':
                return this.todos.filter(todo => !todo.completed);
            case 'completed':
                return this.todos.filter(todo => todo.completed);
            default:
                return this.todos;
        }
    }

    // 渲染待办事项列表
    render() {
        const todoList = document.getElementById('todoList');
        const filteredTodos = this.getFilteredTodos();
        
        if (filteredTodos.length === 0) {
            todoList.innerHTML = this.getEmptyStateHTML();
            return;
        }
        
        todoList.innerHTML = filteredTodos.map(todo => this.getTodoItemHTML(todo)).join('');
        
        // 重新绑定事件
        this.bindTodoEvents();
    }

    // 绑定待办事项相关事件
    bindTodoEvents() {
        // 复选框事件
        document.querySelectorAll('.todo-checkbox').forEach(checkbox => {
            checkbox.addEventListener('click', (e) => {
                const id = parseInt(e.target.dataset.id);
                this.toggleTodo(id);
            });
        });

        // 删除按钮事件
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.target.dataset.id);
                this.deleteTodo(id);
            });
        });
    }

    // 生成待办事项HTML
    getTodoItemHTML(todo) {
        return `
            <li class="todo-item ${todo.completed ? 'completed' : ''}">
                <div class="todo-checkbox ${todo.completed ? 'checked' : ''}" data-id="${todo.id}"></div>
                <span class="todo-text">${this.escapeHtml(todo.text)}</span>
                <span class="todo-date">${todo.completed && todo.completedAt ? '完成于: ' + todo.completedAt : '创建于: ' + todo.createdAt}</span>
                <button class="delete-btn" data-id="${todo.id}">删除</button>
            </li>
        `;
    }

    // 生成空状态HTML
    getEmptyStateHTML() {
        const messages = {
            all: '还没有待办事项，快来添加一个吧！',
            active: '太棒了！没有未完成的待办事项。',
            completed: '还没有完成任何待办事项。'
        };
        
        return `
            <div class="empty-state">
                <div style="font-size: 4rem; margin-bottom: 20px;">
                    ${this.currentFilter === 'completed' ? '📝' : '✨'}
                </div>
                <p>${messages[this.currentFilter]}</p>
            </div>
        `;
    }

    // 更新统计信息
    updateStats() {
        const total = this.todos.length;
        const completed = this.todos.filter(todo => todo.completed).length;
        const remaining = total - completed;
        
        document.getElementById('totalCount').textContent = `总数: ${total}`;
        document.getElementById('completedCount').textContent = `已完成: ${completed}`;
        document.getElementById('remainingCount').textContent = `剩余: ${remaining}`;
    }

    // 保存到本地存储
    saveTodos() {
        localStorage.setItem('todos', JSON.stringify(this.todos));
    }

    // 从本地存储加载
    loadTodos() {
        const saved = localStorage.getItem('todos');
        return saved ? JSON.parse(saved) : [];
    }

    // HTML转义
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// 全局函数（保持向后兼容）
let todoManager;

function addTodo() {
    todoManager.addTodo();
}

function clearCompleted() {
    todoManager.clearCompleted();
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    todoManager = new TodoManager();
    
    // 不再自动添加示例数据，保持干净的初始状态
});

// 添加一些增强功能
document.addEventListener('DOMContentLoaded', () => {
    // 双击编辑功能
    document.addEventListener('dblclick', (e) => {
        if (e.target.classList.contains('todo-text')) {
            editTodo(e.target);
        }
    });
    
    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + Enter 添加待办事项
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            todoManager.addTodo();
        }
        
        // 按 1、2、3 切换筛选器
        if (e.key >= '1' && e.key <= '3') {
            const filters = ['all', 'active', 'completed'];
            todoManager.setFilter(filters[parseInt(e.key) - 1]);
        }
    });
});

// 双击编辑功能
function editTodo(textElement) {
    const todoItem = textElement.closest('.todo-item');
    const checkbox = todoItem.querySelector('.todo-checkbox');
    const id = parseInt(checkbox.dataset.id);
    const currentText = textElement.textContent;
    
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentText;
    input.className = 'edit-input';
    input.style.cssText = `
        flex: 1;
        padding: 8px;
        border: 2px solid #667eea;
        border-radius: 4px;
        font-size: 16px;
        background: white;
    `;
    
    textElement.style.display = 'none';
    textElement.parentNode.insertBefore(input, textElement);
    input.focus();
    input.select();
    
    function saveEdit() {
        const newText = input.value.trim();
        if (newText && newText !== currentText) {
            todoManager.todos = todoManager.todos.map(todo => {
                if (todo.id === id) {
                    todo.text = newText;
                }
                return todo;
            });
            todoManager.saveTodos();
            todoManager.render();
        } else {
            textElement.style.display = '';
            input.remove();
        }
    }
    
    input.addEventListener('blur', saveEdit);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            saveEdit();
        } else if (e.key === 'Escape') {
            textElement.style.display = '';
            input.remove();
        }
    });
}
