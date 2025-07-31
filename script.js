document.addEventListener('DOMContentLoaded', () => {
    // Estado da Aplicação
    const state = {
        igrejas: JSON.parse(localStorage.getItem('igrejas')) || [],
        itens: JSON.parse(localStorage.getItem('itens')) || [],
    };

    // Salvar estado no localStorage
    const saveState = () => {
        localStorage.setItem('igrejas', JSON.stringify(state.igrejas));
        localStorage.setItem('itens', JSON.stringify(state.itens));
    };

    // Navegação entre seções
    const navItems = document.querySelectorAll('.nav-item');
    const pages = document.querySelectorAll('.page');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetId = item.getAttribute('data-target');
            
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            pages.forEach(page => {
                page.classList.toggle('active', page.id === targetId);
            });
            
            if (targetId !== 'cadastrar-igreja') {
                updateAllSelects();
            }
        });
    });

    // Funções de atualização dos selects
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
    
    // ==================================================================
    // ALTERAÇÃO APLICADA AQUI
    // ==================================================================
    const updateItemSelect = () => {
        const select = document.getElementById('select-item-transferir');
        const currentVal = select.value;
        select.innerHTML = '<option value="">Selecione...</option>';
        state.itens.forEach((item, index) => {
            if (item.quantidade > 0) {
                const igreja = state.igrejas[item.igrejaId];
                const option = document.createElement('option');
                option.value = index;

                // Texto antigo:
                // option.textContent = `${item.nome} (Igreja: ${igreja.nome}, Qtd: ${item.quantidade})`;
                
                // Texto NOVO, com a cidade:
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

    // Cadastro de Igreja
    document.getElementById('form-cadastrar-igreja').addEventListener('submit', (e) => {
        e.preventDefault();
        state.igrejas.push({
            cidade: document.getElementById('cidade').value,
            bairro: document.getElementById('bairro').value,
            nome: document.getElementById('nome-igreja').value,
        });
        saveState();
        alert('Igreja cadastrada com sucesso!');
        e.target.reset();
        updateIgrejaSelects();
    });

    // Catalogar Item
    document.getElementById('form-catalogar-item').addEventListener('submit', (e) => {
        e.preventDefault();
        const nomeItem = document.getElementById('nome-item').value;
        const igrejaId = parseInt(document.getElementById('select-igreja-catalogo').value);
        const quantidade = parseInt(document.getElementById('quantidade').value);
        const ids = document.getElementById('ids').value.split(',').map(id => id.trim()).filter(id => id);

        if (ids.length > 0 && ids.length !== quantidade) {
            alert('A quantidade de IDs deve ser igual à quantidade de itens.');
            return;
        }

        const itemExistente = state.itens.find(item => 
            item.igrejaId === igrejaId && item.nome.toLowerCase() === nomeItem.toLowerCase()
        );

        if (itemExistente) {
            itemExistente.quantidade += quantidade;
            itemExistente.ids.push(...ids);
        } else {
            state.itens.push({
                igrejaId,
                nome: nomeItem,
                quantidade,
                ids,
            });
        }
        
        saveState();
        alert('Item catalogado com sucesso!');
        e.target.reset();
        updateAllSelects();
    });

    // Lógica de Transferência
    const formTransferirItem = document.getElementById('form-transferir-item');
    const selectItemTransferir = document.getElementById('select-item-transferir');
    const listaIdsContainer = document.getElementById('lista-ids-transferir');
    const quantidadeTransferirInput = document.getElementById('quantidade-transferir');

    selectItemTransferir.addEventListener('change', () => {
        const itemIndex = selectItemTransferir.value;
        quantidadeTransferirInput.value = 0;
        listaIdsContainer.innerHTML = '';

        if (itemIndex === "") {
            listaIdsContainer.innerHTML = '<p>Selecione um item para ver os IDs disponíveis.</p>';
            return;
        }

        const item = state.itens[itemIndex];
        if (!item.ids || item.ids.length === 0) {
            listaIdsContainer.innerHTML = '<p>Este item não possui IDs específicos para transferência.</p>';
            return;
        }

        item.ids.forEach(id => {
            if (id) {
                const div = document.createElement('div');
                div.className = 'checkbox-item';
                div.innerHTML = `
                    <input type="checkbox" value="${id}" id="id-${id}">
                    <label for="id-${id}">${id}</label>
                `;
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

    formTransferirItem.addEventListener('submit', (e) => {
        e.preventDefault();
        const itemIndex = parseInt(selectItemTransferir.value);
        const igrejaDestinoId = parseInt(document.getElementById('select-igreja-destino').value);
        
        const idsSelecionados = Array.from(listaIdsContainer.querySelectorAll('input:checked')).map(cb => cb.value);
        const quantidade = idsSelecionados.length;

        if (isNaN(itemIndex) || isNaN(igrejaDestinoId) || quantidade === 0) {
            alert('Por favor, selecione o item, os IDs e a igreja de destino.');
            return;
        }

        const itemOrigem = state.itens[itemIndex];

        // Atualiza item de origem
        itemOrigem.quantidade -= quantidade;
        itemOrigem.ids = itemOrigem.ids.filter(id => !idsSelecionados.includes(id));
        
        // Verifica se já existe um item similar no destino
        const itemDestinoExistente = state.itens.find(item => 
            item.igrejaId === igrejaDestinoId && item.nome.toLowerCase() === itemOrigem.nome.toLowerCase()
        );

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
        
        saveState();
        alert(`${quantidade} iten(s) transferido(s) com sucesso!`);
        
        formTransferirItem.reset();
        listaIdsContainer.innerHTML = '<p>Selecione um item para ver os IDs disponíveis.</p>';
        quantidadeTransferirInput.value = 0;
        updateAllSelects();
    });


    // Pesquisa de Itens
    const inputPesquisa = document.getElementById('input-pesquisa');
    const resultadoPesquisa = document.getElementById('resultado-pesquisa');
    
    inputPesquisa.addEventListener('input', () => {
        const termo = inputPesquisa.value.toLowerCase();
        resultadoPesquisa.innerHTML = '';
        if (!termo) return;

        const resultados = state.itens.filter(item => item.nome.toLowerCase().includes(termo));
        
        if (resultados.length === 0) {
            resultadoPesquisa.innerHTML = '<p style="padding: 15px;">Nenhum item encontrado.</p>';
            return;
        }

        const table = document.createElement('table');
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Item</th>
                    <th>Qtd.</th>
                    <th>Igreja</th>
                    <th>Cidade</th>
                    <th>IDs</th>
                </tr>
            </thead>
            <tbody>
                ${resultados.map(item => {
                    const igreja = state.igrejas[item.igrejaId];
                    return `
                        <tr>
                            <td>${item.nome}</td>
                            <td>${item.quantidade}</td>
                            <td>${igreja.nome}</td>
                            <td>${igreja.cidade}</td>
                            <td>${item.ids.join(', ')}</td>
                        </tr>
                    `}).join('')}
            </tbody>
        `;
        resultadoPesquisa.appendChild(table);
    });

    // Relatório por Igreja
    document.getElementById('select-igreja-relatorio').addEventListener('change', (e) => {
        const igrejaId = parseInt(e.target.value);
        const resultadoRelatorio = document.getElementById('resultado-relatorio');
        resultadoRelatorio.innerHTML = '';

        if (isNaN(igrejaId)) return;

        const itensDaIgreja = state.itens.filter(item => item.igrejaId === igrejaId && item.quantidade > 0);
        
        if (itensDaIgreja.length === 0) {
            resultadoRelatorio.innerHTML = '<p style="padding: 15px;">Nenhum item catalogado para esta igreja.</p>';
            return;
        }

        const table = document.createElement('table');
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Item</th>
                    <th>Quantidade</th>
                    <th>IDs</th>
                </tr>
            </thead>
            <tbody>
                ${itensDaIgreja.map(item => `
                    <tr>
                        <td>${item.nome}</td>
                        <td>${item.quantidade}</td>
                        <td>${item.ids.join(', ')}</td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        resultadoRelatorio.appendChild(table);
    });

    // Inicialização
    updateAllSelects();
});
