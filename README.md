# Gerador de Artes — Padaria da Cris

Aplicação web para criar etiquetas de preço nos modelos **Geladeira** e **Padrão**, com exportação em PNG e PDF A4 para impressão.

## Como usar

1. Abra a página publicada ou execute o projeto em um servidor estático local.
2. Escolha o modelo **Geladeira** ou **Padrão**.
3. Informe o nome e o preço.
4. Ajuste cor, orientação, tamanhos e opções disponíveis para o modelo.
5. No modelo Padrão, escolha entre foto, selo Promoção ou espaço vazio.
6. Informe a largura final da etiqueta em centímetros (de 2 a 18 cm); a altura é calculada automaticamente para preservar a proporção do modelo. São aceitos até 4 dígitos após a vírgula ou o ponto.
7. Use **Baixar PDF A4 (300 DPI)** para gerar uma etiqueta individual centralizada na folha.
8. Na impressão, selecione **Tamanho real / 100%** e desative opções como “Ajustar à página”.

## Estrutura

```
.
├── index.html
├── css/
│   └── styles.css
├── js/
│   ├── app.js       # controles, estado, validação, upload e exportação
│   ├── engine.js    # desenho das etiquetas no Canvas
│   ├── pdf-export.js # PDF A4, sangria e marcas de corte
│   ├── export.js    # implementação antiga, não carregada pela página atual
│   ├── render.js    # implementação antiga, não carregada pela página atual
│   └── templates.js # implementação antiga, não carregada pela página atual
└── assets/
    ├── fonts/
    └── logo-cris.png
```

A página atual carrega `js/engine.js`, `js/pdf-export.js` e `js/app.js`. Os arquivos `render.js`, `templates.js` e `export.js` foram mantidos no repositório para preservar o histórico; não os inclua no HTML sem uma migração planejada, pois pertencem à implementação anterior.

## Tecnologias e funcionamento

- HTML, CSS e JavaScript sem framework.
- Canvas 2D nativo para desenhar a etiqueta.
- Fontes e logotipo locais em `assets/`.
- Não há servidor, login, banco de dados ou API.
- As informações preenchidas e a foto ficam somente na memória da página. Ao atualizar ou fechar a página, a etiqueta atual não é preservada.
- A exportação PNG continua disponível e é gerada diretamente do Canvas.
- O PDF individual usa renderização própria em 300 DPI, papel A4 (210 × 297 mm), sangria de 2 mm por lado e marcas de corte vetoriais fora da sangria.
- A largura é informada em centímetros, aceitando até 4 casas decimais; a altura é exibida em centímetros e calculada pela proporção real do modelo ativo. O motor de PDF continua usando milímetros internamente; a arte não é deformada.
- A sangria prolonga os pixels das bordas da arte, em vez de acrescentar uma moldura branca.

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
- Gerar PDF nos modelos Geladeira (retrato e paisagem) e Padrão.
- Conferir página A4, dimensão física da etiqueta, sangria de 2 mm e marcas de corte.
- Imprimir uma página de teste em escala 100%, sem “Ajustar à página”.
- Repetir os testes em celular e computador.

## Próximas evoluções possíveis

1. Criar testes automatizados para validação de preço e funções de apoio.
2. Adicionar testes visuais em navegador para comparar os PNGs dos modelos.
3. Implementar histórico local opcional de etiquetas recentes, com aviso claro de que os dados ficam no dispositivo.
4. Adicionar fila temporária de várias artes e montagem automática da folha A4.
5. Se o projeto passar a atender outras lojas, permitir configuração de identidade visual sem alterar o desenho-base.

> As evoluções futuras devem preservar os dois modelos atuais e ser testadas antes de substituir qualquer comportamento visual já aprovado.
