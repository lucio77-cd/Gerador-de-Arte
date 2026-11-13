# Gerador de Artes — Padaria da Cris

Aplicação web simples para criar etiquetas de preço nos modelos **Geladeira** e **Padrão** e baixar o resultado em PNG.

## Como usar

1. Abra a página publicada ou execute o projeto em um servidor estático local.
2. Escolha o modelo **Geladeira** ou **Padrão**.
3. Informe o nome e o preço.
4. Ajuste cor, orientação, tamanhos e opções disponíveis para o modelo.
5. No modelo Padrão, escolha entre foto, selo Promoção ou espaço vazio.
6. Clique em **Baixar arte (PNG)**.

## Estrutura

```
.
├── index.html
├── css/
│   └── styles.css
├── js/
│   ├── app.js       # controles, estado, validação, upload e exportação
│   ├── engine.js    # desenho das etiquetas no Canvas
│   ├── export.js    # implementação antiga, não carregada pela página atual
│   ├── render.js    # implementação antiga, não carregada pela página atual
│   └── templates.js # implementação antiga, não carregada pela página atual
└── assets/
    ├── fonts/
    └── logo-cris.png
```

A página atual carrega somente `js/engine.js` e `js/app.js`. Os arquivos `render.js`, `templates.js` e `export.js` foram mantidos no repositório para preservar o histórico; não os inclua no HTML sem uma migração planejada, pois pertencem à implementação anterior.

## Tecnologias e funcionamento

- HTML, CSS e JavaScript sem framework.
- Canvas 2D nativo para desenhar a etiqueta.
- Fontes e logotipo locais em `assets/`.
- Não há servidor, login, banco de dados ou API.
- As informações preenchidas e a foto ficam somente na memória da página. Ao atualizar ou fechar a página, a etiqueta atual não é preservada.
- A exportação gera um PNG diretamente do Canvas, sem capturar o HTML da tela.

## Proteções implementadas

- Renderização agrupada com `requestAnimationFrame` para reduzir desenhos repetidos durante a digitação.
- Controle de versão da prévia para descartar solicitações antigas.
- Validação do preço antes da exportação.
- Upload restrito a imagens de até 8 MB e redimensionamento para até 1000 px no maior lado.
- Tratamento de falhas no carregamento, desenho e exportação.
- Mensagens de estado acessíveis e foco visível para navegação por teclado.

## Desenvolvimento e verificação

O projeto pode ser servido por qualquer servidor HTTP estático. Abrir diretamente por `file://` pode causar diferenças no carregamento de fontes e recursos conforme o navegador.

Verificações manuais recomendadas antes de publicar:

- Abrir os dois modelos e alternar entre retrato e paisagem.
- Testar preços inteiros, centavos vazios, centavos 00 e 99, valores negativos e decimais.
- Testar foto válida, arquivo que não seja imagem, imagem acima de 8 MB e remoção da foto.
- Baixar PNG nos dois modelos e confirmar nome, preço, logotipo, fontes e orientação.
- Repetir os testes em celular e computador.

## Próximas evoluções possíveis

1. Criar testes automatizados para validação de preço e funções de apoio.
2. Adicionar testes visuais em navegador para comparar os PNGs dos modelos.
3. Implementar histórico local opcional de etiquetas recentes, com aviso claro de que os dados ficam no dispositivo.
4. Adicionar exportação em PDF e opções próprias para impressão.
5. Se o projeto passar a atender outras lojas, permitir configuração de identidade visual sem alterar o desenho-base.

> As evoluções futuras devem preservar os dois modelos atuais e ser testadas antes de substituir qualquer comportamento visual já aprovado.
