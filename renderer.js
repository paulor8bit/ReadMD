const darkModeBtn = document.getElementById('dark-mode-btn');
const tabContainer = document.getElementById('tab-container');
const tabBar = document.getElementById('tab-bar');
const openFolderBtn = document.getElementById('open-folder-btn');
const fileListContainer = document.getElementById('file-list-container');
const currentFolderPathEl = document.getElementById('current-folder-path');
const contextMenu = document.getElementById('context-menu');

let activeTabId = 'main-tab';
let selectedFile = null;

// --- Modo Escuro ---
darkModeBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    darkModeBtn.textContent = document.body.classList.contains('dark-mode') ? 'Modo Claro ☀️' : 'Modo Escuro 🌙';
});

// --- Gerenciamento de Pastas (Árvore) ---
openFolderBtn.addEventListener('click', async () => {
    const folderPath = await window.electronAPI.openFolder();
    if (folderPath) {
        currentFolderPathEl.textContent = folderPath;
        const tree = await window.electronAPI.readDirectory(folderPath);
        renderFileTree(tree);
    }
});

function renderFileTree(tree) {
    fileListContainer.innerHTML = '';
    if (!tree) {
        fileListContainer.innerHTML = '<p>Erro ao ler a pasta. (T-T)</p>';
        return;
    }
    
    // O nó raiz é a própria pasta selecionada
    const rootElement = createTreeElement(tree);
    fileListContainer.appendChild(rootElement);
}

function createTreeElement(node) {
    const container = document.createElement('div');
    container.className = 'tree-node';

    const item = document.createElement('div');
    item.className = 'file-item';
    
    let icon = '📄';
    if (node.isDirectory) icon = '📁';
    else if (node.name.endsWith('.md')) icon = '📝';

    const toggleHtml = node.isDirectory ? '<span class="folder-toggle">▼</span>' : '<span style="width:15px; display:inline-block;"></span>';
    
    item.innerHTML = `
        ${toggleHtml}
        <span class="file-icon">${icon}</span>
        <span class="file-name">${node.name}</span>
    `;

    if (node.isDirectory) {
        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'tree-children';
        
        node.children.forEach(child => {
            childrenContainer.appendChild(createTreeElement(child));
        });

        item.addEventListener('click', (e) => {
            if (e.target.closest('.folder-toggle') || e.target === item) {
                const toggle = item.querySelector('.folder-toggle');
                toggle.classList.toggle('collapsed');
                childrenContainer.classList.toggle('hidden');
            }
        });
        
        container.appendChild(item);
        container.appendChild(childrenContainer);
    } else {
        // Arquivo
        item.addEventListener('dblclick', () => {
            openTab(node.path, node.name, 'view');
        });

        item.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            selectedFile = node;
            showContextMenu(e.pageX, e.pageY);
        });

        container.appendChild(item);
    }

    return container;
}

// --- Menu de Contexto ---
function showContextMenu(x, y) {
    contextMenu.style.display = 'block';
    contextMenu.style.left = `${x}px`;
    contextMenu.style.top = `${y}px`;
}

window.addEventListener('click', () => {
    contextMenu.style.display = 'none';
});

document.getElementById('menu-open').addEventListener('click', () => {
    if (selectedFile) openTab(selectedFile.path, selectedFile.name, 'view');
});

document.getElementById('menu-edit').addEventListener('click', () => {
    if (selectedFile) openTab(selectedFile.path, selectedFile.name, 'edit');
});

document.getElementById('menu-new').addEventListener('click', () => {
    const fileName = prompt('Qual o nome do novo arquivo? (Ex: notas.md)', 'novo-arquivo.md');
    if (fileName) {
        openTab(null, fileName, 'edit');
    }
});

// --- Gerenciamento de Abas ---
function openTab(filePath, fileName, mode) {
    const tabId = filePath ? `tab-${filePath.replace(/[^a-zA-Z0-9]/g, '-')}` : `tab-new-${Date.now()}`;
    
    if (document.querySelector(`[data-tab-id="${tabId}"]`)) {
        switchTab(tabId);
        return;
    }

    const tab = document.createElement('div');
    tab.className = 'tab';
    tab.setAttribute('data-tab-id', tabId);
    tab.innerHTML = `
        <span>${fileName}</span>
        <span class="close-tab">✖</span>
    `;
    tab.addEventListener('click', (e) => {
        if (e.target.classList.contains('close-tab')) {
            closeTab(tabId);
        } else {
            switchTab(tabId);
        }
    });
    tabBar.appendChild(tab);

    const content = document.createElement('div');
    content.id = tabId;
    content.className = 'tab-content';
    tabContainer.appendChild(content);

    loadTabContent(content, filePath, mode);
    switchTab(tabId);
}

async function loadTabContent(container, filePath, mode) {
    let content = '';
    if (filePath) {
        content = await window.electronAPI.readFile(filePath);
    }

    if (mode === 'view') {
        container.innerHTML = `<div class="markdown-view">${marked.parse(content || '')}</div>`;
    } else {
        const editorContainer = document.createElement('div');
        editorContainer.className = 'editor-container';
        
        const textarea = document.createElement('textarea');
        textarea.value = content || '';
        
        const actions = document.createElement('div');
        actions.className = 'editor-actions';
        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Salvar 💾';
        saveBtn.addEventListener('click', async () => {
            const result = await window.electronAPI.saveFile({ filePath, content: textarea.value });
            if (result) {
                if (!filePath) {
                    const tabId = container.id;
                    const tab = document.querySelector(`[data-tab-id="${tabId}"]`);
                    tab.querySelector('span').textContent = result.name;
                    filePath = result.filePath;
                }
                alert('Arquivo salvo com sucesso! ( ^▽^ )');
                
                // Recarrega a árvore para mostrar o novo arquivo
                if (currentFolderPathEl.textContent) {
                    const tree = await window.electronAPI.readDirectory(currentFolderPathEl.textContent);
                    renderFileTree(tree);
                }
            }
        });

        actions.appendChild(saveBtn);
        editorContainer.appendChild(textarea);
        editorContainer.appendChild(actions);
        container.appendChild(editorContainer);
    }
}

function switchTab(tabId) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    const tab = document.querySelector(`[data-tab-id="${tabId}"]`);
    const content = document.getElementById(tabId);

    if (tab && content) {
        tab.classList.add('active');
        content.classList.add('active');
        activeTabId = tabId;
    }
}

function closeTab(tabId) {
    const tab = document.querySelector(`[data-tab-id="${tabId}"]`);
    const content = document.getElementById(tabId);

    if (tab && content) {
        const wasActive = tab.classList.contains('active');
        tab.remove();
        content.remove();

        if (wasActive) {
            switchTab('main-tab');
        }
    }
}

document.querySelector('[data-tab-id="main-tab"]').addEventListener('click', () => {
    switchTab('main-tab');
});
