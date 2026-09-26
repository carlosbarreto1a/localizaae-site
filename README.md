# LocalizaaeCEP - Consulta de Endereços e Mapa em Tempo Real

Aplicação web desenvolvida com JavaScript puro (Vanilla JS), HTML5 e CSS3. Permite consultar localizações por CEP ou endereço textual, exibindo detalhes completos do endereço e a sua posição exata no mapa.

##  Funcionalidades
- Busca por CEP: Integração com a API pública ViaCEP para autocompletar Logradouro, Bairro, Cidade, UF, DDD, Código IBGE e SIAFI.
- Busca por Endereço Livre: Suporte a nomes de ruas, avenidas ou pontos turísticos.
- Geocodificação Reversa: Clique em qualquer ponto do mapa para obter o endereço correspondente.
- Geolocalização: Botão para capturar a posição atual do utilizador.
- Cálculo de Distância Exata: Fórmula matemática de Haversine para calcular a distância em km entre o utilizador e o endereço pesquisado.
- Histórico Local: Guarda as últimas 5 pesquisas no `localStorage`.
- Cópia Rápida: Botão dedicado para copiar todos os dados formatados para a área de transferência.

## Estrutura do Projeto

localizaae-site/
├── assets/
│   ├── css/
│   │   └── style.css
│   ├── images/
│   │   └── favicon.ico
│   └── js/
│       └── script.js
├── index.html
└── README.md
