document.addEventListener('DOMContentLoaded', async () => {
    // ==================================================================
    // CONFIGURAÇÕES DO GITHUB - PREENCHA COM SUAS INFORMAÇÕES
    // ==================================================================
    const GITHUB_CONFIG = {
        token: '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', // Cole o token que você gerou no Passo 2
        owner: 'will3308', // Seu nome de usuário no GitHub
        repo: 'dados-igrejas',    // O nome do repositório que você criou (ex: dados-igrejas)
        path: 'database.json'             // O nome do arquivo que será criado no repositório
    };
    // ==================================================================

    // Variáveis globais e de estado
    const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/`;
    let currentFileSha = null;
    let cameraStream = null;
    const state = { igrejas: [], itens: [] };

    // Variáveis para formulários
    let stagedFiles = [];

    // ==================================================================
    // FUNÇÕES DE API E UTILITÁRIOS
    // ==================================================================
    const uploadImageToGitHub = async (file) => {
        const reader = new FileReader();
        return new Promise((resolve, reject) => {
            reader.onload = async () => {
                try {
                    const base64Content = reader.result.split(',')[1];
                    const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
                    const imageUrl = `${GITHUB_API_URL}images/${fileName}`;

                    const response = await fetch(imageUrl, {
                        method: 'PUT',
                        headers: {
                            'Authorization': `token ${GITHUB_CONFIG.token}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            message: `Upload da imagem: ${fileName}`,
                            content: base64Content
                        }),
                    });

                    if (!response.ok) throw new Error(`Falha no upload da imagem: ${response.statusText}`);
                    const data = await response.json();
                    resolve(data.content.download_url);
                } catch (error) { reject(error); }
            };
            reader.onerror = error => reject(error);
            reader.readAsDataURL(file);
        });
    };

    const loadStateFromGitHub = async () => {
        try {
            const response = await fetch(GITHUB_API_URL + GITHUB_CONFIG.path, { headers: { 'Authorization': `token ${GITHUB_CONFIG.token}` } });
            if (response.status === 404) {
                console.log('Arquivo não encontrado. Começando com estado vazio.');
                return;
            }
            if (!response.ok) throw new Error(`Erro ao buscar dados: ${response.statusText}`);
            const data = await response.json();
            currentFileSha = data.sha;
            const content = atob(data.content);
            const loadedState = JSON.parse(content);
            state.igrejas = loadedState.igrejas || [];
            state.itens = loadedState.itens || [];
        } catch (error) {
            console.error('Falha ao carregar estado do GitHub:', error);
            alert('Não foi possível carregar os dados.');
        }
    };

    const saveState = async () => {
        if (!GITHUB_CONFIG.token || GITHUB_CONFIG.token === 'SEU_TOKEN_PESSOAL_AQUI') {
            return alert('ERRO: O token do GitHub não foi configurado no script.js!');
        }
        try {
            const contentToSave = JSON.stringify({ igrejas: state.igrejas, itens: state.itens }, null, 2);
            const encodedContent = btoa(unescape(encodeURIComponent(contentToSave)));
            const payload = {
                message: `Atualização de dados em ${new Date().toISOString()}`,
                content: encodedContent,
                sha: currentFileSha
            };
            const response = await fetch(GITHUB_API_URL + GITHUB_CONFIG.path, {
                method: 'PUT',
                headers: { 'Authorization': `token ${GITHUB_CONFIG.token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!response.ok) throw new Error(`Erro na API do GitHub: ${response.statusText}`);
            const responseData = await response.json();
            currentFileSha = responseData.content.sha;
            console.log('Dados salvos no GitHub com sucesso!');
        } catch (error) {
            console.error("Falha ao salvar no GitHub:", error);
            alert("Erro: Não foi possível salvar os dados.");
        }
    };

    const dataURLtoBlob = (dataurl) => {
        let arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
            bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
        while(n--){ u8arr[n] = bstr.charCodeAt(n); }
        return new Blob([u8arr], {type:mime});
    };

    // NAVEGAÇÃO E ATUALIZAÇÃO DE SELECTS
    const navItems = document.querySelectorAll('.nav-item');
    const pages = document.querySelectorAll('.page');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetId = item.getAttribute('data-target');
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            pages.forEach(page => page.classList.toggle('active', page.id === targetId));
            if (targetId !== 'cadastrar-igreja') updateAllSelects();
        });
    });

    const updateIgrejaSelects = () => {
        const selects = document.querySelectorAll('#select-igreja-catalogo, #select-igreja-destino, #select-igreja-relatorio');
        selects.forEach(select => {
            const currentVal = select.value;
            select.innerHTML = '<option value="">Selecione...</option>';
            state.igrejas.forEach((igreja, index) => {
                const option = document.createElement('option');
                option.value = index;
                option.textContent = `${igreja.nome} (${igreja.cidade})`;
                select.appendChild(option);
            });
            select.value = currentVal;
        });
    };

    const updateItemSelect = () => {
        const select = document.getElementById('select-item-transferir');
        const currentVal = select.value;
        select.innerHTML = '<option value="">Selecione...</option>';
        state.itens.forEach((item, index) => {
            if (item.quantidade > 0) {
                const igreja = state.igrejas[item.igrejaId];
                const option = document.createElement('option');
                option.value = index;
                option.textContent = `${item.nome} (Igreja: ${igreja.nome}, ${igreja.cidade} | Qtd: ${item.quantidade})`;
                select.appendChild(option);
            }
        });
        select.value = currentVal;
    };
    
    const updateAllSelects = () => {
        updateIgrejaSelects();
        updateItemSelect();
    };
    
    // LÓGICA DE GERENCIAMENTO DE IMAGENS E CÂMERA
    const imageInput = document.getElementById('imagens-igreja');
    const previewContainer = document.getElementById('preview-imagens');

    const updatePreview = () => {
        previewContainer.innerHTML = '';
        stagedFiles.forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const previewItem = document.createElement('div');
                previewItem.className = 'preview-item';
                previewItem.innerHTML = `<img src="${e.target.result}" alt="${file.name}"><button type="button" class="btn-remove-preview" data-index="${index}">&times;</button>`;
                previewContainer.appendChild(previewItem);
            };
            reader.readAsDataURL(file);
        });
    };

    previewContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-remove-preview')) {
            const index = parseInt(e.target.getAttribute('data-index'));
            stagedFiles.splice(index, 1);
            updatePreview();
        }
    });

    imageInput.addEventListener('change', () => {
        Array.from(imageInput.files).forEach(file => stagedFiles.push(file));
        updatePreview();
        imageInput.value = '';
    });
    
    const cameraModal = document.getElementById('camera-modal');
    const cameraView = document.getElementById('camera-view');
    const cameraCanvas = document.getElementById('camera-canvas');

    document.getElementById('btn-abrir-camera').addEventListener('click', async () => {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
                cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
                cameraView.srcObject = cameraStream;
                cameraModal.style.display = 'flex';
            } catch (err) {
                alert("Não foi possível acessar a câmera. Verifique as permissões.");
            }
        }
    });
    
    const closeCamera = () => {
        if (cameraStream) cameraStream.getTracks().forEach(track => track.stop());
        cameraModal.style.display = 'none';
    };

    document.getElementById('btn-fechar-camera').addEventListener('click', closeCamera);
    
    document.getElementById('btn-capturar-foto').addEventListener('click', () => {
        cameraCanvas.width = cameraView.videoWidth;
        cameraCanvas.height = cameraView.videoHeight;
        cameraCanvas.getContext('2d').drawImage(cameraView, 0, 0, cameraCanvas.width, cameraCanvas.height);
        const dataUrl = cameraCanvas.toDataURL('image/jpeg');
        const file = new File([dataURLtoBlob(dataUrl)], `captura-${Date.now()}.jpg`, { type: 'image/jpeg' });
        
        stagedFiles.push(file);
        updatePreview();
        closeCamera();
    });
    
    // LÓGICA DO FORMULÁRIO DE CADASTRO
    document.getElementById('form-cadastrar-igreja').addEventListener('submit', async (e) => {
        e.preventDefault();
        const button = e.target.querySelector('button[type="submit"]');
        button.disabled = true; button.textContent = 'Salvando...';

        try {
            let imageUrls = [];
            if (stagedFiles.length > 0) {
                alert(`Iniciando upload de ${stagedFiles.length} imagem(ns).`);
                imageUrls = await Promise.all(stagedFiles.map(file => uploadImageToGitHub(file)));
            }
            state.igrejas.push({
                cidade: document.getElementById('cidade').value,
                bairro: document.getElementById('bairro').value,
                nome: document.getElementById('nome-igreja').value,
                imagensUrls: imageUrls,
            });
            await saveState();
            alert('Igreja cadastrada com sucesso!');
            e.target.reset();
            stagedFiles = [];
            updatePreview();
            updateAllSelects();
        } catch (error) {
            console.error("Erro no cadastro:", error);
            alert('Falha ao cadastrar a igreja.');
        } finally {
            button.disabled = false; button.textContent = 'Cadastrar';
        }
    });
    
    // LÓGICA PARA CATALOGAR ITENS
    document.getElementById('form-catalogar-item').addEventListener('submit', async (e) => {
        e.preventDefault();
        const nomeItem = document.getElementById('nome-item').value;
        const igrejaId = parseInt(document.getElementById('select-igreja-catalogo').value);
        const quantidade = parseInt(document.getElementById('quantidade').value);
        const ids = document.getElementById('ids').value.split(',').map(id => id.trim()).filter(id => id);

        if (ids.length > 0 && ids.length !== quantidade) {
            return alert('A quantidade de IDs deve ser igual à quantidade de itens.');
        }
        const itemExistente = state.itens.find(item => item.igrejaId === igrejaId && item.nome.toLowerCase() === nomeItem.toLowerCase());
        if (itemExistente) {
            itemExistente.quantidade += quantidade;
            itemExistente.ids.push(...ids);
        } else {
            state.itens.push({ igrejaId, nome: nomeItem, quantidade, ids });
        }
        await saveState();
        alert('Item catalogado com sucesso!');
        e.target.reset();
        updateAllSelects();
    });

    // LÓGICA PARA TRANSFERIR ITENS
    const formTransferirItem = document.getElementById('form-transferir-item');
    const selectItemTransferir = document.getElementById('select-item-transferir');
    const listaIdsContainer = document.getElementById('lista-ids-transferir');
    const quantidadeTransferirInput = document.getElementById('quantidade-transferir');

    selectItemTransferir.addEventListener('change', () => {
        const itemIndex = selectItemTransferir.value;
        quantidadeTransferirInput.value = 0;
        listaIdsContainer.innerHTML = '';
        if (itemIndex === "") {
            return listaIdsContainer.innerHTML = '<p>Selecione um item para ver os IDs disponíveis.</p>';
        }
        const item = state.itens[itemIndex];
        if (!item.ids || item.ids.length === 0) {
            return listaIdsContainer.innerHTML = '<p>Este item não possui IDs específicos para transferência.</p>';
        }
        item.ids.forEach(id => {
            if (id) {
                const div = document.createElement('div');
                div.className = 'checkbox-item';
                div.innerHTML = `<input type="checkbox" value="${id}" id="id-${id}"><label for="id-${id}">${id}</label>`;
                listaIdsContainer.appendChild(div);
            }
        });
    });

    listaIdsContainer.addEventListener('change', (e) => {
        if (e.target.type === 'checkbox') {
            const checkedCount = listaIdsContainer.querySelectorAll('input[type="checkbox"]:checked').length;
            quantidadeTransferirInput.value = checkedCount;
        }
    });
    
    formTransferirItem.addEventListener('submit', async (e) => {
        e.preventDefault();
        const itemIndex = parseInt(selectItemTransferir.value);
        const igrejaDestinoId = parseInt(document.getElementById('select-igreja-destino').value);
        const idsSelecionados = Array.from(listaIdsContainer.querySelectorAll('input:checked')).map(cb => cb.value);
        const quantidade = idsSelecionados.length;

        if (isNaN(itemIndex) || isNaN(igrejaDestinoId) || quantidade === 0) {
            return alert('Por favor, selecione o item, os IDs e a igreja de destino.');
        }

        const itemOrigem = state.itens[itemIndex];
        itemOrigem.quantidade -= quantidade;
        itemOrigem.ids = itemOrigem.ids.filter(id => !idsSelecionados.includes(id));

        const itemDestinoExistente = state.itens.find(item => item.igrejaId === igrejaDestinoId && item.nome.toLowerCase() === itemOrigem.nome.toLowerCase());

        if (itemDestinoExistente) {
            itemDestinoExistente.quantidade += quantidade;
            itemDestinoExistente.ids.push(...idsSelecionados);
        } else {
            state.itens.push({
                igrejaId: igrejaDestinoId,
                nome: itemOrigem.nome,
                quantidade: quantidade,
                ids: idsSelecionados
            });
        }
        await saveState();
        alert(`${quantidade} item(ns) transferido(s) com sucesso!`);
        formTransferirItem.reset();
        listaIdsContainer.innerHTML = '<p>Selecione um item para ver os IDs disponíveis.</p>';
        quantidadeTransferirInput.value = 0;
        updateAllSelects();
    });

    // LÓGICA PARA PESQUISAR ITENS
    const inputPesquisa = document.getElementById('input-pesquisa');
    const resultadoPesquisa = document.getElementById('resultado-pesquisa');

    inputPesquisa.addEventListener('input', () => {
        const termo = inputPesquisa.value.toLowerCase();
        resultadoPesquisa.innerHTML = '';
        if (!termo) return;

        const resultados = state.itens.filter(item => item.nome.toLowerCase().includes(termo));
        if (resultados.length === 0) {
            return resultadoPesquisa.innerHTML = '<p style="padding: 15px;">Nenhum item encontrado.</p>';
        }
        const table = document.createElement('table');
        table.innerHTML = `
            <thead><tr><th>Item</th><th>Qtd.</th><th>Igreja</th><th>Cidade</th><th>IDs</th></tr></thead>
            <tbody>
                ${resultados.map(item => {
                    const igreja = state.igrejas[item.igrejaId];
                    return `<tr><td>${item.nome}</td><td>${item.quantidade}</td><td>${igreja.nome}</td><td>${igreja.cidade}</td><td>${item.ids.join(', ')}</td></tr>`;
                }).join('')}
            </tbody>
        `;
        resultadoPesquisa.appendChild(table);
    });

    // LÓGICA DO RELATÓRIO
    document.getElementById('select-igreja-relatorio').addEventListener('change', (e) => {
        const igrejaId = parseInt(e.target.value);
        const resultadoRelatorio = document.getElementById('resultado-relatorio');
        resultadoRelatorio.innerHTML = ''; 

        if (isNaN(igrejaId)) return;

        const igreja = state.igrejas[igrejaId];

        const infoDiv = document.createElement('div');
        infoDiv.className = 'igreja-info';
        infoDiv.innerHTML = `<h3>${igreja.nome}</h3>`;
        resultadoRelatorio.appendChild(infoDiv);

        if (igreja.imagensUrls && igreja.imagensUrls.length > 0) {
            const galeriaDiv = document.createElement('div');
            galeriaDiv.className = 'igreja-galeria';
            igreja.imagensUrls.forEach(url => {
                galeriaDiv.innerHTML += `
                    <div class="igreja-imagem-container">
                        <a href="${url}" target="_blank">
                           <img src="${url}" alt="Foto de ${igreja.nome}">
                        </a>
                    </div>
                `;
            });
            resultadoRelatorio.appendChild(galeriaDiv);
        }

        const itensDaIgreja = state.itens.filter(item => item.igrejaId === igrejaId && item.quantidade > 0);
        if (itensDaIgreja.length === 0) {
            const p = document.createElement('p');
            p.style.padding = '15px';
            p.style.textAlign = 'center';
            p.textContent = 'Nenhum item catalogado para esta igreja.';
            resultadoRelatorio.appendChild(p);
        } else {
            const table = document.createElement('table');
            table.innerHTML = `
                <thead><tr><th>Item</th><th>Quantidade</th><th>IDs</th></tr></thead>
                <tbody>
                    ${itensDaIgreja.map(item => `<tr><td>${item.nome}</td><td>${item.quantidade}</td><td>${item.ids.join(', ')}</td></tr>`).join('')}
                </tbody>
            `;
            resultadoRelatorio.appendChild(table);
        }
    });

    // INICIALIZAÇÃO
    await loadStateFromGitHub();
    updateAllSelects();
});
