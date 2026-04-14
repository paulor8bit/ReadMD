const darkModeBtn = document.getElementById('dark-mode-btn');
const tabContainer = document.getElementById('tab-container');
const tabBar = document.getElementById('tab-bar');
const openFolderBtn = document.getElementById('open-folder-btn');
const fileListContainer = document.getElementById('file-list-container');
const contextMenu = document.getElementById('context-menu');

let activeTabId = 'main-tab';
let selectedFile = null;
let rootFolders = []; // Armazena as árvores de pastas do workspace
let activeFilePath = null; // Caminho do arquivo sendo visualizado/editado

// --- Modo Escuro ---
darkModeBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    darkModeBtn.textContent = document.body.classList.contains('dark-mode') ? 'Modo Claro ☀️' : 'Modo Escuro 🌙';
});

// --- Gerenciamento de Workspace (Múltiplas Pastas) ---
openFolderBtn.addEventListener('click', async () => {
    const folderPath = await window.electronAPI.openFolder();
    if (folderPath) {
        if (rootFolders.some(f => f.path === folderPath)) return;
        const tree = await window.electronAPI.readDirectory(folderPath);
        if (tree) {
            rootFolders.push(tree);
            renderWorkspace();
        }
    }
});

function renderWorkspace() {
    fileListContainer.innerHTML = '';
    if (rootFolders.length === 0) {
        fileListContainer.innerHTML = '<p>Selecione uma pasta para listar os arquivos .md e .txt! (´｡• ᵕ •｡`) ♡</p>';
        return;
    }
    
    rootFolders.forEach((tree, index) => {
        const rootElement = createTreeElement(tree, true, index);
        fileListContainer.appendChild(rootElement);
    });

    if (activeFilePath) {
        highlightActiveFileInTree(activeFilePath);
    }
}

function createTreeElement(node, isRoot = false, index = -1) {
    const container = document.createElement('div');
    container.className = 'tree-node';

    const item = document.createElement('div');
    item.className = 'file-item';
    item.setAttribute('data-path', node.path);
    
    let icon = '📄';
    if (node.isDirectory) icon = '📁';
    else if (node.name.endsWith('.md')) icon = '📝';

    const toggleHtml = node.isDirectory ? '<span class="folder-toggle">▼</span>' : '<span style="width:15px; display:inline-block;"></span>';
    
    let removeBtnHtml = '';
    if (isRoot) {
        removeBtnHtml = `<span class="remove-folder-btn" title="Remover do Workspace">✖</span>`;
    }

    item.innerHTML = `
        ${toggleHtml}
        <span class="file-icon">${icon}</span>
        <span class="file-name">${node.name}</span>
        ${removeBtnHtml}
    `;

    // Lógica para remover pasta do workspace
    if (isRoot) {
        item.querySelector('.remove-folder-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            rootFolders.splice(index, 1);
            renderWorkspace();
        });
    }

    if (node.isDirectory) {
        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'tree-children';
        
        node.children.forEach(child => {
            childrenContainer.appendChild(createTreeElement(child));
        });

        item.addEventListener('click', (e) => {
            if (e.target.closest('.folder-toggle') || e.target.closest('.file-name') || e.target === item || e.target.closest('.file-icon')) {
                if (e.target.closest('.remove-folder-btn')) return;
                const toggle = item.querySelector('.folder-toggle');
                toggle.classList.toggle('collapsed');
                childrenContainer.classList.toggle('hidden');
            }
        });
        
        container.appendChild(item);
        container.appendChild(childrenContainer);
    } else {
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

function highlightActiveFileInTree(path) {
    document.querySelectorAll('.file-item').forEach(el => el.classList.remove('active-in-tree'));
    const activeEl = document.querySelector(`.file-item[data-path="${path.replace(/\\/g, '\\\\')}"]`);
    if (activeEl) {
        activeEl.classList.add('active-in-tree');
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
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
    tab.setAttribute('data-file-path', filePath || '');
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
                    tab.setAttribute('data-file-path', result.filePath);
                    filePath = result.filePath;
                }
                alert('Arquivo salvo com sucesso! ( ^▽^ )');
                refreshWorkspace();
            }
        });

        actions.appendChild(saveBtn);
        editorContainer.appendChild(textarea);
        editorContainer.appendChild(actions);
        container.appendChild(editorContainer);
    }
}

async function refreshWorkspace() {
    const newRootFolders = [];
    for (const folder of rootFolders) {
        const tree = await window.electronAPI.readDirectory(folder.path);
        if (tree) newRootFolders.push(tree);
    }
    rootFolders = newRootFolders;
    renderWorkspace();
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

        if (tabId === 'main-tab') {
            if (activeFilePath) highlightActiveFileInTree(activeFilePath);
        } else {
            activeFilePath = tab.getAttribute('data-file-path');
        }
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
