const openFileBtn = document.getElementById('open-file-btn');
const darkModeBtn = document.getElementById('dark-mode-btn');
const contentEl = document.getElementById('content');

darkModeBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
});

openFileBtn.addEventListener('click', async () => {
    const file = await window.electronAPI.openFile();
    if (file) {
        const { filePath, content } = file;
        if (filePath.endsWith('.md')) {
            contentEl.innerHTML = marked.parse(content);
        } else {
            // Para arquivos .txt, usamos <pre> para manter a formatação
            const pre = document.createElement('pre');
            pre.textContent = content;
            contentEl.innerHTML = '';
            contentEl.appendChild(pre);
        }
    }
});
