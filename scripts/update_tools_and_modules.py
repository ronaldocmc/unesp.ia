from __future__ import annotations

import base64
import html
import re
import ssl
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from standardize_portal import standardize_portal


ROOT = Path(__file__).resolve().parents[1]
FOOTER = (
    '<footer class="footer">unesp.IA - Inteligência Artificial para Todos | '
    "Programa de Extensão Universitária | Coleção Editorial</footer>"
)
NAV_ROOT = (
    '<div class="topbar"><a class="brand" href="index.html"><img class="brand-logo" '
    'src="assets/img/logo-unesp-ia.svg" alt="unesp.IA"><small>Coleção Editorial | '
    'Portal Didático dos Participantes</small></a><div class="nav">'
    '<a href="index.html">Início</a><a href="modulos.html">Módulos</a>'
    '<a href="trilhas.html">Trilhas</a><a href="conceitos.html">Conceitos</a>'
    '<a href="ferramentas.html">Ferramentas</a><a href="laboratorios.html">Laboratórios</a>'
    '<a href="materiais.html">Materiais</a><a href="personagens.html">Personagens</a>'
    '<a href="banco-visual.html">Banco Visual</a><a href="mapa-conhecimento.html">Mapa</a>'
    "</div></div>"
)
NAV_SUB = (
    NAV_ROOT.replace('href="', 'href="../')
    .replace('href="../http', 'href="http')
    .replace('src="assets/', 'src="../assets/')
)


TOOLS = [
    {
        "slug": "chatgpt",
        "name": "ChatGPT",
        "initials": "CG",
        "color": "#10A37F",
        "type": "LLM",
        "summary": "Assistente conversacional para explicar temas, criar rascunhos, revisar textos, gerar ideias e estruturar planos.",
        "inputs": "Texto, imagens, arquivos, áudio e instruções estruturadas, conforme o plano e a modalidade usada.",
        "outputs": "Respostas em texto, listas, tabelas, roteiros, códigos, resumos, exemplos e orientações.",
        "uses": ["Explicar conceitos em níveis diferentes", "Transformar pedidos vagos em prompts melhores", "Criar rascunhos de mensagens, planos e checklists"],
        "examples": ["Explique viés algorítmico para iniciantes com três exemplos.", "Crie um checklist de verificação antes de compartilhar uma notícia."],
        "care": "Confirme informações relevantes, retire dados pessoais e não trate a resposta como fonte final.",
        "modules": [1, 2, 3, 4, 8, 9, 10],
    },
    {
        "slug": "gemini",
        "name": "Gemini",
        "initials": "GM",
        "color": "#4285F4",
        "type": "LLM",
        "summary": "Assistente multimodal do ecossistema Google para texto, imagem, planejamento, síntese e produtividade.",
        "inputs": "Perguntas, comandos, textos, imagens, arquivos e conteúdos conectados ao ambiente Google, quando autorizado.",
        "outputs": "Textos, resumos, sugestões, explicações, ideias de materiais e respostas multimodais.",
        "uses": ["Criar explicações e exemplos didáticos", "Apoiar organização de documentos e ideias", "Comparar respostas com outras IAs"],
        "examples": ["Crie uma sequência de aula introdutória sobre IA generativa.", "Monte uma tabela com benefícios, riscos e cuidados de uma aplicação de IA."],
        "care": "Revise permissões de arquivos conectados e não envie documentos sensíveis sem autorização.",
        "modules": [1, 2, 3, 8, 9, 10],
    },
    {
        "slug": "copilot",
        "name": "Copilot",
        "initials": "CP",
        "color": "#0078D4",
        "type": "LLM",
        "summary": "Assistente da Microsoft para produtividade, escrita, análise, programação e criação de materiais.",
        "inputs": "Texto, comandos, arquivos, páginas ou conteúdos do ecossistema Microsoft, conforme a configuração da conta.",
        "outputs": "Resumos, mensagens, planos, código, tabelas, ideias para slides e respostas explicativas.",
        "uses": ["Apoiar escrita profissional", "Sugerir estruturas de documentos e apresentações", "Ajudar em planilhas, e-mails e organização"],
        "examples": ["Escreva um e-mail formal de convite para oficina.", "Crie uma estrutura de apresentação de seis slides."],
        "care": "Confira permissões da conta e revise tudo antes de enviar a terceiros.",
        "modules": [1, 2, 3, 6, 8],
    },
    {
        "slug": "claude",
        "name": "Claude",
        "initials": "CL",
        "color": "#D97757",
        "type": "LLM",
        "summary": "Assistente útil para leitura, reescrita, síntese e análise de textos longos.",
        "inputs": "Texto, instruções, documentos, URLs ou códigos, de acordo com os recursos disponíveis.",
        "outputs": "Sínteses, reescritas, análises, estruturas de documento e respostas explicativas.",
        "uses": ["Resumir textos extensos", "Revisar clareza e tom", "Organizar argumentos e critérios"],
        "examples": ["Resuma um texto público em tópicos e dúvidas.", "Reescreva uma explicação técnica em linguagem acessível."],
        "care": "Evite material sigiloso e verifique fatos em temas legais, médicos ou acadêmicos.",
        "modules": [2, 3, 10],
    },
    {
        "slug": "perplexity",
        "name": "Perplexity",
        "initials": "PX",
        "color": "#20B8A8",
        "type": "Pesquisa com IA",
        "summary": "Busca assistida por IA que organiza respostas com fontes, útil para pesquisa inicial e comparação.",
        "inputs": "Perguntas, temas, links e consultas de pesquisa.",
        "outputs": "Resposta sintetizada, links de apoio, tópicos relacionados e caminhos para aprofundamento.",
        "uses": ["Começar pesquisa com fontes visíveis", "Levantar perguntas de verificação", "Mapear termos antes de consultar fontes oficiais"],
        "examples": ["Pesquise usos de IA na educação com fontes institucionais.", "Compare definições de RAG e liste pontos a validar."],
        "care": "Abra as fontes, confira datas, autoria e contexto antes de usar a informação.",
        "modules": [2, 7, 10],
    },
    {
        "slug": "notebooklm",
        "name": "NotebookLM",
        "initials": "NL",
        "color": "#7B61FF",
        "type": "Pesquisa/Literatura",
        "summary": "Ferramenta para trabalhar com fontes selecionadas pelo usuário, com perguntas, resumos e guias de estudo.",
        "inputs": "PDFs, documentos, texto colado, links e outras fontes aceitas pela plataforma.",
        "outputs": "Resumos, perguntas e respostas baseadas nas fontes, guias, notas e materiais de estudo.",
        "uses": ["Estudar um conjunto de textos", "Criar perguntas de revisão", "Preparar sínteses para aulas ou pesquisa"],
        "examples": ["Envie um texto público e peça cinco perguntas de compreensão.", "Crie um guia de estudo com termos-chave."],
        "care": "Use documentos autorizados e confira se a síntese não omitiu nuances importantes.",
        "modules": [2, 7, 10],
    },
    {
        "slug": "canva",
        "name": "Canva",
        "initials": "CV",
        "color": "#00C4CC",
        "type": "Imagem/Design",
        "summary": "Ambiente de design para cartazes, apresentações, posts e infográficos, com recursos de IA para criação visual.",
        "inputs": "Textos, imagens, vídeos, modelos, prompts visuais e arquivos de mídia.",
        "outputs": "Designs editáveis, imagens, apresentações, PDFs, vídeos curtos e peças de divulgação.",
        "uses": ["Criar cartazes educativos", "Transformar conteúdo em apresentação", "Produzir materiais de oficina"],
        "examples": ["Crie um cartaz sobre cuidados com dados pessoais.", "Monte um infográfico com benefícios e riscos da IA."],
        "care": "Respeite direitos de imagem e evite fotos ou dados de pessoas sem autorização.",
        "modules": [1, 2, 3, 6, 8, 9],
    },
    {
        "slug": "dalle",
        "name": "DALL·E",
        "initials": "DE",
        "color": "#111827",
        "type": "Imagem",
        "summary": "Geração de imagens a partir de descrições textuais para ilustrações e apoio criativo.",
        "inputs": "Prompt textual, referências permitidas e orientações de estilo.",
        "outputs": "Imagens sintéticas, variações e composições visuais.",
        "uses": ["Criar imagens conceituais", "Explorar alternativas visuais", "Gerar ilustrações para aulas"],
        "examples": ["Crie uma imagem educativa sobre segurança digital sem texto dentro da imagem."],
        "care": "Evite simular pessoas reais ou marcas sem autorização.",
        "modules": [3, 8],
    },
    {
        "slug": "leonardo",
        "name": "Leonardo AI",
        "initials": "LA",
        "color": "#6D28D9",
        "type": "Imagem",
        "summary": "Geração e edição de imagens com estilos, referências e variações para materiais visuais.",
        "inputs": "Prompts, imagens de referência, estilos, proporções e parâmetros visuais.",
        "outputs": "Imagens, variações, versões ampliadas e recursos visuais.",
        "uses": ["Explorar estilos visuais", "Criar imagens para storytelling", "Produzir variações para comparação crítica"],
        "examples": ["Gere três alternativas de ilustração para uma oficina de IA para idosos."],
        "care": "Confira licenças e sinalize quando a imagem for gerada por IA.",
        "modules": [3, 8],
    },
    {
        "slug": "gamma",
        "name": "Gamma",
        "initials": "GA",
        "color": "#F97316",
        "type": "Apresentações",
        "summary": "Transforma instruções, tópicos ou textos em apresentações, documentos visuais e páginas estruturadas.",
        "inputs": "Prompt, notas, tópicos, arquivos e URLs.",
        "outputs": "Slides, páginas, documentos visuais, PDFs e apresentações editáveis.",
        "uses": ["Criar estrutura inicial de apresentação", "Organizar tópicos de aula", "Testar narrativas visuais"],
        "examples": ["Peça uma apresentação de oito slides sobre uso seguro de IA na escola."],
        "care": "Use como rascunho visual e revise conteúdo, fontes e imagens.",
        "modules": [3, 8, 10],
    },
    {
        "slug": "google-colab",
        "name": "Google Colab",
        "initials": "GC",
        "color": "#F9AB00",
        "type": "Dados/Código",
        "summary": "Ambiente online para notebooks Python, análise de dados e experimentos introdutórios.",
        "inputs": "Código, textos, datasets, arquivos CSV, planilhas e notebooks.",
        "outputs": "Células executadas, gráficos, tabelas, modelos e resultados computacionais.",
        "uses": ["Executar exemplos de análise", "Criar protótipos simples", "Visualizar tabelas e gráficos"],
        "examples": ["Carregue um CSV público e gere um gráfico comentado."],
        "care": "Não envie bases com dados pessoais sem autorização.",
        "modules": [4, 5, 10],
    },
    {
        "slug": "power-bi",
        "name": "Power BI",
        "initials": "BI",
        "color": "#F2C811",
        "type": "Dados",
        "summary": "Dashboards e visualização de dados para acompanhar indicadores, criar relatórios e apoiar decisões.",
        "inputs": "Planilhas, bases de dados, CSVs, conectores e modelos de dados.",
        "outputs": "Painéis, gráficos, filtros, medidas, relatórios e visualizações interativas.",
        "uses": ["Criar painel de indicadores", "Acompanhar atendimento público", "Explorar dados com filtros"],
        "examples": ["Monte um painel fictício com vendas por mês, categoria e região."],
        "care": "Evite publicar painéis com dados identificáveis.",
        "modules": [6, 7],
    },
    {
        "slug": "looker-studio",
        "name": "Looker Studio",
        "initials": "LS",
        "color": "#1A73E8",
        "type": "Dados",
        "summary": "Painéis web conectados a fontes de dados para relatórios compartilháveis e indicadores.",
        "inputs": "Planilhas, conectores, bases online e métricas organizadas.",
        "outputs": "Dashboards, gráficos, filtros e relatórios digitais.",
        "uses": ["Publicar painéis simples", "Acompanhar campanhas", "Visualizar indicadores"],
        "examples": ["Crie um painel de inscrições de uma oficina com dados fictícios."],
        "care": "Revise permissões de compartilhamento e proteja dados pessoais.",
        "modules": [6, 7],
    },
    {
        "slug": "lexml",
        "name": "LexML Brasil",
        "initials": "LX",
        "color": "#0F766E",
        "type": "Pesquisa jurídica",
        "summary": "Portal para localizar legislação e documentos normativos brasileiros em fontes oficiais.",
        "inputs": "Termos jurídicos, número de norma, assunto, órgão ou período.",
        "outputs": "Resultados de legislação, metadados e links para documentos normativos.",
        "uses": ["Pesquisar normas", "Comparar fontes legais", "Preparar perguntas para análise jurídica"],
        "examples": ["Pesquise normas sobre proteção de dados e crie um resumo cidadão."],
        "care": "Não substitui parecer jurídico; confirme vigência e contexto.",
        "modules": [7],
    },
    {
        "slug": "jusbrasil",
        "name": "JusBrasil",
        "initials": "JB",
        "color": "#1F2937",
        "type": "Pesquisa jurídica",
        "summary": "Pesquisa jurídica e consulta a conteúdos legais para exploração inicial com verificação crítica.",
        "inputs": "Termos, temas, nomes de normas, perguntas e referências jurídicas.",
        "outputs": "Resultados, textos, notícias jurídicas e referências relacionadas.",
        "uses": ["Mapear termos", "Comparar entendimentos", "Preparar perguntas para especialistas"],
        "examples": ["Levante termos relacionados a IA e administração pública para checagem posterior."],
        "care": "Conteúdo jurídico exige validação, data e contexto.",
        "modules": [7],
    },
    {
        "slug": "kahoot",
        "name": "Kahoot",
        "initials": "KH",
        "color": "#46178F",
        "type": "Avaliação interativa",
        "summary": "Quizzes e gamificação para revisar conceitos e avaliar compreensão de forma lúdica.",
        "inputs": "Perguntas, alternativas, imagens e configurações de jogo.",
        "outputs": "Quizzes, pontuações, relatórios e feedback de participação.",
        "uses": ["Criar revisão rápida", "Diagnosticar conhecimentos prévios", "Engajar oficinas"],
        "examples": ["Crie dez perguntas sobre mitos e verdades de IA."],
        "care": "Use resultados para mediação, não para constranger participantes.",
        "modules": [1, 8],
    },
    {
        "slug": "mentimeter",
        "name": "Mentimeter",
        "initials": "MT",
        "color": "#2B9EB3",
        "type": "Participação",
        "summary": "Enquetes, nuvens de palavras e interação ao vivo para levantar percepções e dúvidas.",
        "inputs": "Perguntas, alternativas, escalas, textos curtos e respostas do público.",
        "outputs": "Nuvens de palavras, gráficos, rankings e respostas coletivas.",
        "uses": ["Mapear expectativas", "Coletar dúvidas anônimas", "Criar votação em oficina"],
        "examples": ["Pergunte onde os participantes já percebem IA no dia a dia."],
        "care": "Explique como respostas serão usadas e evite coletar dados pessoais.",
        "modules": [1, 8],
    },
    {
        "slug": "google-slides",
        "name": "Google Slides",
        "initials": "GS",
        "color": "#F4B400",
        "type": "Apresentações",
        "summary": "Editor de apresentações online para organizar aulas, socializar resultados de atividades e construir materiais colaborativos.",
        "inputs": "Textos, imagens, modelos, gráficos, links, comentários e contribuições colaborativas.",
        "outputs": "Slides editáveis, apresentações compartilháveis, PDFs, imagens e materiais para exposição.",
        "uses": ["Registrar produções de oficinas", "Apresentar sínteses de grupos", "Montar narrativas visuais com revisão humana"],
        "examples": ["Crie uma apresentação coletiva com exemplos de IA no cotidiano e cuidados de uso."],
        "care": "Revise permissões de compartilhamento e evite publicar dados pessoais dos participantes.",
        "modules": [1, 3, 8, 9],
    },
    {
        "slug": "google-docs",
        "name": "Google Docs",
        "initials": "GD",
        "color": "#4285F4",
        "type": "Escrita colaborativa",
        "summary": "Editor de texto online para escrita, revisão, comentários, roteiros, relatórios e produção coletiva.",
        "inputs": "Texto, imagens, links, comentários, sugestões e documentos compartilhados.",
        "outputs": "Documentos editáveis, PDFs, relatórios, roteiros, atas, listas e textos colaborativos.",
        "uses": ["Registrar respostas de atividades", "Revisar textos com comentários", "Produzir documentos de orientação"],
        "examples": ["Monte um documento colaborativo com regras de uso seguro de IA para a turma."],
        "care": "Controle quem pode ver, comentar ou editar e não inclua informações sensíveis sem necessidade.",
        "modules": [1, 2, 3, 8, 9, 10],
    },
    {
        "slug": "elicit",
        "name": "Elicit",
        "initials": "EL",
        "color": "#4F46E5",
        "type": "Pesquisa/Literatura",
        "summary": "Apoio à revisão bibliográfica, busca semântica e extração de informações de artigos científicos.",
        "inputs": "Perguntas de pesquisa, PDFs, tópicos e termos acadêmicos.",
        "outputs": "Listas de artigos, resumos, tabelas de comparação e pistas de evidência.",
        "uses": ["Iniciar levantamento bibliográfico", "Comparar objetivos e métodos", "Gerar quadro de leitura crítica"],
        "examples": ["Busque artigos sobre IA na educação e organize método e limites."],
        "care": "Leia os artigos originais; sínteses podem omitir método ou contexto.",
        "modules": [10],
    },
    {
        "slug": "scispace",
        "name": "SciSpace",
        "initials": "SS",
        "color": "#0EA5E9",
        "type": "Pesquisa/Literatura",
        "summary": "Leitura de PDFs acadêmicos, explicação de trechos e apoio à compreensão de artigos.",
        "inputs": "PDFs, perguntas, DOI, URLs, tópicos e trechos de texto.",
        "outputs": "Explicações, resumos, respostas sobre PDF, tabelas e citações.",
        "uses": ["Ler artigos com apoio guiado", "Explicar tabelas e equações", "Preparar fichamentos"],
        "examples": ["Carregue um artigo autorizado e peça explicação do método."],
        "care": "Não substitui leitura integral nem avaliação metodológica.",
        "modules": [10],
    },
    {
        "slug": "mendeley",
        "name": "Mendeley",
        "initials": "MD",
        "color": "#A61D55",
        "type": "Gerenciador bibliográfico",
        "summary": "Organização de referências, PDFs, anotações e citações para pesquisa acadêmica.",
        "inputs": "PDFs, metadados de artigos, referências, notas e coleções.",
        "outputs": "Biblioteca organizada, citações, bibliografias e anotações.",
        "uses": ["Organizar artigos", "Gerar bibliografia", "Manter notas de leitura"],
        "examples": ["Crie uma coleção para o módulo de pesquisa e marque artigos por tema."],
        "care": "Confira metadados importados e padrões de citação.",
        "modules": [10],
    },
    {
        "slug": "vosviewer",
        "name": "VOSviewer",
        "initials": "VV",
        "color": "#16A34A",
        "type": "Bibliometria",
        "summary": "Criação de mapas bibliométricos de coautoria, coocorrência de termos, citações e redes.",
        "inputs": "Arquivos RIS, BibTeX, CSV e bases exportadas de indexadores.",
        "outputs": "Mapas de rede, clusters, visualizações, imagens e arquivos de dados.",
        "uses": ["Explorar redes de autores", "Visualizar clusters", "Apoiar análise bibliométrica introdutória"],
        "examples": ["Importe uma busca pública e gere mapa de coocorrência de termos."],
        "care": "Explique base, filtros, limpeza e limitações do mapa.",
        "modules": [10],
    },
    {
        "slug": "grammarly",
        "name": "Grammarly",
        "initials": "GR",
        "color": "#15C39A",
        "type": "Escrita",
        "summary": "Correção, clareza, tom e revisão textual, especialmente útil em textos em inglês.",
        "inputs": "Textos, documentos, e-mails e conteúdos em editores integrados.",
        "outputs": "Sugestões de correção, reescrita, tom, clareza e qualidade textual.",
        "uses": ["Revisar textos em inglês", "Comparar versões formais", "Ajustar tom"],
        "examples": ["Cole um parágrafo sem dados pessoais e peça sugestões de clareza."],
        "care": "Nem toda sugestão preserva estilo, intenção ou terminologia.",
        "modules": [3, 10],
    },
    {
        "slug": "quillbot",
        "name": "QuillBot",
        "initials": "QB",
        "color": "#16A34A",
        "type": "Escrita",
        "summary": "Paráfrase, resumo e apoio à escrita para estudar alternativas de formulação.",
        "inputs": "Textos, documentos, URLs ou comandos de escrita.",
        "outputs": "Texto reescrito, resumido, expandido, corrigido ou traduzido.",
        "uses": ["Comparar modos de reescrita", "Resumir trechos", "Treinar clareza textual"],
        "examples": ["Reescreva um parágrafo em tom mais simples e compare com o original."],
        "care": "Não use para mascarar autoria; cite fontes e preserve honestidade acadêmica.",
        "modules": [3, 10],
    },
    {
        "slug": "ideogram",
        "name": "Ideogram AI",
        "initials": "ID",
        "color": "#EC4899",
        "type": "Imagem",
        "summary": "Gerador de imagens com controle de estilo, variações e composição visual.",
        "inputs": "Prompts, imagens de referência, estilos, proporção e parâmetros.",
        "outputs": "Imagens, variações, pôsteres, logos experimentais e composições.",
        "uses": ["Testar ideias visuais", "Criar pôsteres conceituais", "Comparar estilos"],
        "examples": ["Gere alternativas para cartaz de oficina de IA cidadã."],
        "care": "Verifique licenças, texto dentro da imagem e risco de confusão com marcas reais.",
        "modules": [3, 6, 8],
    },
    {
        "slug": "midjourney",
        "name": "Midjourney",
        "initials": "MJ",
        "color": "#111827",
        "type": "Imagem",
        "summary": "Geração visual artística com parâmetros de estilo e variações de imagem.",
        "inputs": "Prompts, referências visuais e parâmetros de composição.",
        "outputs": "Imagens, variações, ampliações e composições artísticas.",
        "uses": ["Explorar linguagem visual", "Criar referências", "Planejar campanhas"],
        "examples": ["Crie imagens conceituais de tecnologia inclusiva em diferentes estilos."],
        "care": "Observe regras da comunidade, direitos de imagem e transparência sobre IA.",
        "modules": [3, 6, 8],
    },
    {
        "slug": "suno",
        "name": "Suno AI",
        "initials": "SN",
        "color": "#F59E0B",
        "type": "Áudio/Vídeo",
        "summary": "Criação de músicas e trilhas a partir de prompts, estilos e letras.",
        "inputs": "Texto, estilo musical, letra, referência ou orientação criativa.",
        "outputs": "Áudio, música, versões instrumentais e faixas para protótipo.",
        "uses": ["Criar jingle educativo", "Explorar linguagem sonora", "Discutir autoria em IA generativa"],
        "examples": ["Crie uma vinheta curta sobre segurança digital."],
        "care": "Não imite artistas vivos nem use vozes de terceiros sem consentimento.",
        "modules": [3, 8],
    },
    {
        "slug": "elevenlabs",
        "name": "ElevenLabs",
        "initials": "11",
        "color": "#111111",
        "type": "Áudio/Vídeo",
        "summary": "Síntese de voz, narração, dublagem e recursos de áudio com IA.",
        "inputs": "Texto, voz selecionada, idioma, áudio autorizado e configurações de fala.",
        "outputs": "Áudio narrado, fala sintetizada, dublagem e transcrições.",
        "uses": ["Criar narração acessível", "Testar leitura em voz alta", "Produzir protótipos de áudio"],
        "examples": ["Transforme uma orientação de segurança em áudio curto."],
        "care": "Não clone voz sem autorização explícita e informe quando áudio for sintético.",
        "modules": [3, 8, 9],
    },
    {
        "slug": "whisper",
        "name": "Whisper",
        "initials": "WH",
        "color": "#64748B",
        "type": "Áudio/Vídeo",
        "summary": "Transcrição e reconhecimento de fala para converter áudio em texto e apoiar acessibilidade.",
        "inputs": "Arquivos de áudio ou vídeo.",
        "outputs": "Texto transcrito, idioma detectado e, em alguns fluxos, tradução.",
        "uses": ["Transcrever entrevistas autorizadas", "Criar legenda inicial", "Apoiar acessibilidade"],
        "examples": ["Transcreva um áudio autorizado e revise nomes próprios."],
        "care": "Avise participantes sobre gravação e proteja dados pessoais presentes no áudio.",
        "modules": [3, 8, 10],
    },
    {
        "slug": "magicschool",
        "name": "MagicSchool",
        "initials": "MS",
        "color": "#8B5CF6",
        "type": "Ensino/Aprendizagem",
        "summary": "Modelos para planejamento de aulas, comunicação escolar, rubricas e atividades educacionais.",
        "inputs": "Tópicos, série, objetivos, contexto escolar e instruções.",
        "outputs": "Planos de aula, rubricas, quizzes, atividades, mensagens e materiais adaptados.",
        "uses": ["Criar rascunhos pedagógicos", "Adaptar linguagem por nível", "Gerar rubricas"],
        "examples": ["Crie uma atividade sobre IA responsável para ensino médio."],
        "care": "Docentes continuam responsáveis por adequação curricular, inclusão e privacidade.",
        "modules": [8],
    },
    {
        "slug": "brisk-teaching",
        "name": "Brisk Teaching",
        "initials": "BT",
        "color": "#2563EB",
        "type": "Ensino/Aprendizagem",
        "summary": "Criação de materiais, feedback, nivelamento de textos e integração com documentos educacionais.",
        "inputs": "Tópicos, documentos, vídeos, rubricas, textos de estudantes e instruções.",
        "outputs": "Planos, quizzes, feedback, textos adaptados, apresentações e relatórios.",
        "uses": ["Gerar feedback inicial", "Adaptar textos", "Criar atividades conectadas a documentos"],
        "examples": ["Transforme um texto público em leitura em três níveis."],
        "care": "Não envie dados identificáveis de estudantes sem base legal e autorização.",
        "modules": [8],
    },
    {
        "slug": "teachable-machine",
        "name": "Teachable Machine",
        "initials": "TM",
        "color": "#F59E0B",
        "type": "Ensino/Aprendizagem",
        "summary": "Treinamento de modelos simples de classificação com imagem, som ou pose sem programação avançada.",
        "inputs": "Webcam, microfone, imagens, sons ou exemplos de pose.",
        "outputs": "Modelo treinado, predições, exportações e demonstrações interativas.",
        "uses": ["Demonstrar aprendizado de máquina", "Comparar dados de treino", "Discutir viés e generalização"],
        "examples": ["Treine um classificador simples com imagens autorizadas."],
        "care": "Modelo simples não prova funcionamento em contexto real.",
        "modules": [4, 5, 8],
    },
    {
        "slug": "goblin-tools",
        "name": "Goblin.tools",
        "initials": "GT",
        "color": "#6B7280",
        "type": "Organização",
        "summary": "Pequenas ferramentas para decompor tarefas, ajustar tom, estimar esforço e organizar ideias.",
        "inputs": "Tarefas, textos, listas, ideias e contexto.",
        "outputs": "Subtarefas, reescritas, estimativas, explicações simplificadas e organização de ideias.",
        "uses": ["Quebrar tarefa complexa", "Reescrever mensagem", "Apoiar organização pessoal"],
        "examples": ["Transforme 'preparar apresentação sobre IA' em subtarefas."],
        "care": "Use como apoio de organização, não como decisão automática de prioridade.",
        "modules": [2, 8, 9],
    },
    {
        "slug": "gptzero",
        "name": "GPTZero",
        "initials": "GZ",
        "color": "#111827",
        "type": "Detecção",
        "summary": "Estimativa de probabilidade de texto gerado por IA, com relatórios e marcações por trecho.",
        "inputs": "Textos, documentos e URLs conforme o recurso usado.",
        "outputs": "Pontuações, classificações, destaques e relatórios de autoria provável.",
        "uses": ["Discutir limites de detecção", "Apoiar políticas de autoria", "Comparar sinais de escrita"],
        "examples": ["Analise textos de exemplo e discuta falsos positivos."],
        "care": "Nunca use detector como prova única; resultados são probabilísticos.",
        "modules": [7, 8, 10],
    },
    {
        "slug": "github-copilot",
        "name": "GitHub Copilot",
        "initials": "GH",
        "color": "#24292F",
        "type": "Código",
        "summary": "Assistente de programação para autocompletar código, sugerir funções, explicar trechos e apoiar testes.",
        "inputs": "Código, comentários, arquivos de projeto e instruções.",
        "outputs": "Sugestões de código, explicações, testes e refatorações.",
        "uses": ["Acelerar protótipos", "Explicar trechos de código", "Sugerir testes"],
        "examples": ["Peça testes para uma função simples e revise cada caso sugerido."],
        "care": "Não aceite código sem entender, testar e verificar segurança.",
        "modules": [5],
    },
    {
        "slug": "phind",
        "name": "Phind",
        "initials": "PH",
        "color": "#F97316",
        "type": "Código",
        "summary": "Busca e resposta técnica para programação, depuração e explicações com apoio de fontes.",
        "inputs": "Perguntas técnicas, mensagens de erro, trechos de código e contexto.",
        "outputs": "Explicações, exemplos, código, links e passos de depuração.",
        "uses": ["Investigar erros", "Comparar soluções", "Aprender bibliotecas com exemplos"],
        "examples": ["Cole uma mensagem de erro sem dados sensíveis e peça hipóteses."],
        "care": "Teste soluções localmente e confira compatibilidade de versões.",
        "modules": [5],
    },
    {
        "slug": "julius",
        "name": "Julius",
        "initials": "JU",
        "color": "#2563EB",
        "type": "Dados",
        "summary": "Análise de dados conversacional para tabelas, gráficos, estatística exploratória e relatórios.",
        "inputs": "CSV, Excel, PDFs, imagens de tabelas, perguntas e conexões de dados.",
        "outputs": "Gráficos, tabelas, análises, código, resumos e relatórios.",
        "uses": ["Explorar dados de negócio", "Gerar gráficos iniciais", "Traduzir perguntas em análise"],
        "examples": ["Use uma planilha fictícia de vendas e peça tendências."],
        "care": "Confira cálculos e não envie bases pessoais ou sigilosas.",
        "modules": [6, 7, 10],
    },
    {
        "slug": "excel-sheets",
        "name": "Excel e Google Sheets",
        "initials": "XS",
        "color": "#217346",
        "type": "Dados",
        "summary": "Planilhas para organizar dados, fórmulas, tabelas, gráficos e análises simples.",
        "inputs": "Dados em células, arquivos CSV, fórmulas e tabelas.",
        "outputs": "Planilhas, gráficos, tabelas dinâmicas, resumos e fórmulas.",
        "uses": ["Organizar indicadores", "Preparar base para Power BI", "Criar exercícios de análise"],
        "examples": ["Monte tabela fictícia e calcule médias, totais e gráficos."],
        "care": "Proteja dados pessoais e confira fórmulas antes de decidir.",
        "modules": [5, 6, 7],
    },
    {
        "slug": "miro",
        "name": "Miro",
        "initials": "MR",
        "color": "#FFD02F",
        "type": "Quadros colaborativos",
        "summary": "Quadro visual colaborativo para brainstorming, fluxos, mapas mentais e planejamento.",
        "inputs": "Post-its, formas, imagens, textos, links e quadros.",
        "outputs": "Mapas, fluxos, diagramas, quadros colaborativos e exportações.",
        "uses": ["Mapear problema e solução", "Criar jornada do usuário", "Planejar projeto em equipe"],
        "examples": ["Crie um mapa de riscos e cuidados de um projeto com IA."],
        "care": "Revise permissões de compartilhamento e evite dados de participantes.",
        "modules": [6, 7, 8],
    },
    {
        "slug": "figjam",
        "name": "FigJam",
        "initials": "FJ",
        "color": "#A259FF",
        "type": "Quadros colaborativos",
        "summary": "Quadro colaborativo para ideação, diagramas, notas e organização visual em equipe.",
        "inputs": "Notas, desenhos, formas, imagens, comentários e links.",
        "outputs": "Mapas, fluxos, brainstorms e registros visuais.",
        "uses": ["Criar mapa conceitual", "Organizar ideias de aula", "Coletar contribuições"],
        "examples": ["Monte um quadro com benefícios, riscos e exemplos de IA."],
        "care": "Gerencie acesso e não inclua dados pessoais sem necessidade.",
        "modules": [3, 6, 8],
    },
    {
        "slug": "drawio",
        "name": "Draw.io",
        "initials": "DI",
        "color": "#F08705",
        "type": "Diagramas",
        "summary": "Editor de fluxogramas e diagramas para representar processos, arquiteturas e decisões.",
        "inputs": "Formas, conectores, texto e imagens.",
        "outputs": "Fluxogramas, diagramas, imagens e arquivos editáveis.",
        "uses": ["Desenhar fluxo de atendimento", "Representar algoritmo", "Mapear processo responsável"],
        "examples": ["Crie um fluxograma de verificação antes de confiar em uma IA."],
        "care": "Mantenha diagramas simples e indique fontes quando representar processos reais.",
        "modules": [4, 5, 7],
    },
]


OFFICIAL_SITES = {
    "chatgpt": "https://openai.com/chatgpt/",
    "gemini": "https://gemini.google.com/",
    "copilot": "https://copilot.microsoft.com/",
    "claude": "https://claude.ai/",
    "perplexity": "https://www.perplexity.ai/",
    "notebooklm": "https://notebooklm.google.com/",
    "canva": "https://www.canva.com/",
    "dalle": "https://openai.com/dall-e/",
    "leonardo": "https://leonardo.ai/",
    "gamma": "https://gamma.app/",
    "google-colab": "https://colab.research.google.com/",
    "power-bi": "https://powerbi.microsoft.com/",
    "looker-studio": "https://lookerstudio.google.com/",
    "lexml": "https://www.lexml.gov.br/",
    "jusbrasil": "https://www.jusbrasil.com.br/",
    "kahoot": "https://kahoot.com/",
    "mentimeter": "https://www.mentimeter.com/",
    "google-slides": "https://www.google.com/slides/about/",
    "google-docs": "https://www.google.com/docs/about/",
    "elicit": "https://elicit.com/",
    "scispace": "https://typeset.io/",
    "mendeley": "https://www.mendeley.com/",
    "vosviewer": "https://www.vosviewer.com/",
    "grammarly": "https://www.grammarly.com/",
    "quillbot": "https://quillbot.com/",
    "ideogram": "https://ideogram.ai/",
    "midjourney": "https://www.midjourney.com/",
    "suno": "https://suno.com/",
    "elevenlabs": "https://elevenlabs.io/",
    "whisper": "https://openai.com/research/whisper/",
    "magicschool": "https://www.magicschool.ai/",
    "brisk-teaching": "https://www.briskteaching.com/",
    "teachable-machine": "https://teachablemachine.withgoogle.com/",
    "goblin-tools": "https://goblin.tools/",
    "gptzero": "https://gptzero.me/",
    "github-copilot": "https://github.com/features/copilot",
    "phind": "https://www.phind.com/",
    "julius": "https://julius.ai/",
    "excel-sheets": "https://www.google.com/sheets/about/",
    "miro": "https://miro.com/",
    "figjam": "https://www.figma.com/figjam/",
    "drawio": "https://www.drawio.com/",
}


OFFICIAL_SUMMARY_UPDATES = {
    "claude": "Assistente da Anthropic voltado a conversa, escrita, leitura de documentos, análise e apoio à produção de conteúdo.",
    "perplexity": "Mecanismo de resposta com IA que combina busca, síntese e links de fontes para apoiar pesquisa verificável.",
    "notebooklm": "Assistente de pesquisa do Google para trabalhar com fontes escolhidas pelo usuário e gerar respostas, notas e guias de estudo ancorados nesses materiais.",
    "canva": "Plataforma de design visual com modelos, edição colaborativa e recursos de IA para criar apresentações, cartazes, vídeos e peças digitais.",
    "leonardo": "Plataforma criativa para gerar e editar imagens, ilustrações e recursos visuais com modelos de IA.",
    "gamma": "Ferramenta para criar apresentações, documentos e páginas a partir de prompts, notas ou conteúdos estruturados.",
    "google-colab": "Ambiente de notebooks no navegador para escrever e executar Python, analisar dados e compartilhar experimentos.",
    "power-bi": "Plataforma Microsoft de análise e visualização de dados para relatórios, dashboards e acompanhamento de indicadores.",
    "looker-studio": "Ferramenta Google para transformar dados conectados em relatórios e painéis interativos compartilháveis.",
    "kahoot": "Plataforma de aprendizagem baseada em quizzes, jogos e atividades interativas para participação em tempo real.",
    "mentimeter": "Ferramenta de apresentações interativas com enquetes, nuvens de palavras, perguntas e votação ao vivo.",
    "elicit": "Assistente de pesquisa voltado a revisão de literatura, busca de artigos e extração de informações acadêmicas.",
    "scispace": "Plataforma de apoio à leitura científica, busca acadêmica e explicação de trechos de artigos e PDFs.",
    "github-copilot": "Assistente de programação da GitHub que sugere código, explica trechos e apoia fluxos de desenvolvimento.",
    "julius": "Ferramenta de análise de dados por conversa para explorar planilhas, gerar gráficos e apoiar interpretações.",
}


OFFICIAL_ICON_OVERRIDES = {
    "midjourney": "https://www.midjourney.com/public/apple-touch-icon.png",
    "notebooklm": "https://notebooklm.google.com/_/static/branding/favicon.ico",
    "power-bi": "https://powerbi.microsoft.com/pictures/application-logos/svg/powerbi.svg",
    "phind": "https://www.phind.com/favicon.svg",
    "vosviewer": "https://www.vosviewer.com/favicon.ico",
}


for tool in TOOLS:
    slug = str(tool["slug"])
    tool["official_url"] = OFFICIAL_SITES.get(slug, "")
    if slug in OFFICIAL_SUMMARY_UPDATES:
        tool["summary"] = OFFICIAL_SUMMARY_UPDATES[slug]


def e(value: object) -> str:
    return html.escape(str(value), quote=True)


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def related_links(nums: list[int], kind: str, prefix: str) -> str:
    links = []
    for num in nums:
        if kind == "module":
            href = f"{prefix}modulos/m{num}.html"
            label = f"M{num}"
        else:
            href = f"{prefix}atividades/atividades-m{num}.html"
            label = f"Atividades M{num}"
        links.append(f'<a class="pill" href="{href}">{label}</a>')
    return "".join(links)


FREE_LIMITS_BY_TYPE = {
    "LLM": "Acesso gratuito geralmente tem limites de mensagens, velocidade, tamanho de arquivo e acesso aos modelos mais recentes.",
    "Pesquisa com IA": "Planos gratuitos costumam restringir consultas avançadas, coleções, anexos ou histórico de pesquisa.",
    "Pesquisa/Literatura": "O uso sem pagamento tende a limitar quantidade de buscas, PDFs analisados, exportações ou recursos colaborativos.",
    "Imagem/Design": "Recursos grátis podem limitar modelos premium, banco de imagens, exportações, créditos de IA e remoção de marca d'água.",
    "Imagem": "Normalmente há créditos, filas, resolução ou estilos limitados; alguns recursos exigem assinatura.",
    "Apresentações": "Versões gratuitas costumam limitar temas, exportações, colaboração avançada, créditos de IA ou armazenamento.",
    "Dados/Código": "Ambientes gratuitos podem limitar tempo de execução, memória, GPUs, conectores e automações.",
    "Dados": "Pode haver limites de conectores, volume de dados, atualização automática, colaboração e publicação de painéis.",
    "Pesquisa jurídica": "Consultas abertas ajudam na exploração, mas filtros avançados, alertas ou documentos completos podem exigir cadastro ou plano.",
    "Avaliação interativa": "Planos gratuitos geralmente limitam número de participantes, tipos de pergunta, relatórios e personalização.",
    "Participação": "Versões grátis costumam limitar perguntas por apresentação, participantes, exportações e identidade visual.",
    "Gerenciador bibliográfico": "O plano gratuito pode limitar armazenamento, grupos privados, sincronização ou recursos institucionais.",
    "Bibliometria": "A ferramenta é gratuita, mas depende da qualidade das bases importadas e da preparação dos dados.",
    "Escrita": "Recursos gratuitos tendem a oferecer revisão básica; sugestões avançadas de estilo, tom ou integridade ficam no plano pago.",
    "Áudio/Vídeo": "Planos grátis costumam restringir minutos, vozes, qualidade, exportação, direitos comerciais ou velocidade de processamento.",
    "Ensino/Aprendizagem": "Recursos gratuitos podem limitar quantidade de gerações, turmas, integrações, exportações e histórico.",
    "Organização": "O uso gratuito atende tarefas simples, mas pode limitar histórico, personalização e integrações.",
    "Detecção": "Análises gratuitas costumam limitar tamanho do texto, relatórios detalhados e quantidade de verificações.",
    "Código": "Planos gratuitos podem limitar uso, contexto, integrações com IDE, modelos avançados ou recursos corporativos.",
    "Quadros colaborativos": "Versões grátis normalmente limitam número de quadros, colaboradores, exportações e recursos administrativos.",
    "Diagramas": "A versão gratuita é suficiente para diagramas básicos; integrações, armazenamento corporativo ou colaboração avançada podem variar.",
    "Escrita colaborativa": "O uso gratuito depende da conta e do espaço disponível; controles avançados podem exigir conta institucional.",
}


DATA_USE_BY_TYPE = {
    "LLM": "Pode usar conversas para melhoria do serviço conforme conta e configurações. Para o curso, trate prompts como dados compartilhados e retire informações pessoais.",
    "Pesquisa com IA": "Consultas e fontes abertas podem ser registradas para melhorar busca e ranking. Evite pesquisar dados identificáveis de participantes.",
    "Pesquisa/Literatura": "Textos, PDFs e perguntas podem ser processados em nuvem. Use materiais públicos, autorizados ou institucionais.",
    "Imagem/Design": "Prompts, uploads e edições podem ser analisados pela plataforma. Evite fotos de pessoas sem consentimento e materiais protegidos.",
    "Imagem": "Prompts e imagens enviadas podem apoiar moderação e melhoria do serviço. Use referências autorizadas e sinalize geração por IA.",
    "Apresentações": "Conteúdos enviados podem ser processados em nuvem e associados à conta. Revise permissões antes de compartilhar.",
    "Dados/Código": "Arquivos, notebooks e execuções podem ficar vinculados à conta. Use bases fictícias ou anonimizadas nas atividades.",
    "Dados": "Bases e painéis podem ser armazenados ou publicados conforme configuração. Proteja dados pessoais e revise acesso público.",
    "Pesquisa jurídica": "Pesquisas podem compor histórico da conta ou métricas do serviço. Não insira dados sigilosos de casos reais.",
    "Avaliação interativa": "Respostas e pontuações podem ficar registradas. Prefira apelidos ou dados mínimos quando a atividade for formativa.",
    "Participação": "Respostas do público podem ser armazenadas em relatórios. Explique a finalidade e evite coletar identificação desnecessária.",
    "Gerenciador bibliográfico": "Referências, PDFs e anotações podem sincronizar na nuvem. Confira direitos de uso dos documentos.",
    "Bibliometria": "A análise ocorre sobre arquivos importados pelo usuário. Use bases exportadas de fontes autorizadas.",
    "Escrita": "Textos enviados podem ser processados para revisão e melhoria do serviço. Não submeta documentos sigilosos.",
    "Áudio/Vídeo": "Áudios, vozes, transcrições e prompts podem ser processados em nuvem. Garanta consentimento para gravação e uso de voz.",
    "Ensino/Aprendizagem": "Dados de aulas e estudantes podem ser processados. Use exemplos fictícios ou dados anonimizados.",
    "Organização": "Tarefas e textos inseridos podem ser processados pelo serviço. Evite expor rotinas pessoais sensíveis.",
    "Detecção": "Textos analisados podem ser armazenados para relatórios ou melhoria. Não envie avaliações identificadas sem base legal.",
    "Código": "Trechos de código e prompts podem ser enviados ao serviço. Evite chaves, senhas, dados privados e código confidencial.",
    "Quadros colaborativos": "Conteúdos do quadro ficam vinculados ao workspace e permissões. Controle acesso e remova dados pessoais.",
    "Diagramas": "Diagramas podem ser salvos localmente ou em nuvem conforme escolha. Proteja fluxos internos e informações sensíveis.",
    "Escrita colaborativa": "Documentos ficam associados à conta e às permissões de compartilhamento. Use acesso restrito para atividades do curso.",
}


DAILY_LIMITS_FROM_ATTACHMENT = {
    "chatgpt": "Anexo: cerca de 10 a 60 mensagens a cada 5 horas e aproximadamente 3 imagens por dia, variando conforme plano e disponibilidade.",
    "gemini": "Anexo: até 250 requisições por dia no uso gratuito indicado.",
    "copilot": "Anexo: 50 chats e 2.000 autocompletes por mês; não há cota diária fixa indicada.",
    "claude": "Anexo: cerca de 50 prompts por dia, com reset em janela de aproximadamente 5 horas.",
    "perplexity": "Anexo: IA padrão ilimitada; 5 pesquisas diárias com modelos avançados e 3 uploads por dia.",
    "notebooklm": "Anexo: 50 consultas de chat por dia, 3 áudios por dia e até 100 cadernos com 50 fontes cada.",
    "canva": "Anexo: 50 créditos por mês para recursos de imagem por IA; no plano gratuito, armazenamento em torno de 5 GB.",
    "dalle": "Anexo: geração de imagem vinculada ao ChatGPT com aproximadamente 3 imagens por dia no uso gratuito indicado.",
    "leonardo": "Anexo: aproximadamente 6 prompts por dia, com 4 imagens por prompt.",
    "gamma": "Anexo: 20.000 tokens de crédito, consumidos por deck, sugestão de IA, card ou imagem.",
    "google-colab": "Anexo: não informa cota diária específica para esta ferramenta; limites dependem de recursos disponíveis e políticas da plataforma.",
    "power-bi": "Anexo: não informa cota diária específica para Power BI.",
    "looker-studio": "Anexo: não informa cota diária específica para Looker Studio.",
    "lexml": "Anexo: não informa cota diária específica para LexML Brasil.",
    "jusbrasil": "Anexo: não informa cota diária específica para JusBrasil.",
    "kahoot": "Anexo: não informa cota diária específica para Kahoot.",
    "mentimeter": "Anexo: não informa cota diária específica para Mentimeter.",
    "google-slides": "Anexo: não informa cota diária específica para Google Slides.",
    "google-docs": "Anexo: não informa cota diária específica para Google Docs.",
    "elicit": "Anexo: 20 PDFs por mês no uso gratuito indicado.",
    "scispace": "Anexo: até 3 PDFs por dia, máximo de 120 páginas por PDF e 50 perguntas por dia.",
    "mendeley": "Anexo: 2 GB de armazenamento em nuvem.",
    "vosviewer": "Anexo: sem limites de uso indicados.",
    "grammarly": "Anexo: até 100 documentos ou 50.000 palavras a cada 24 horas; 300 documentos ou 150.000 palavras em 30 dias.",
    "quillbot": "Anexo: paráfrase com 125 palavras por vez, resumo com 1.200 palavras por vez e 50 usos por dia no gerador de IA.",
    "ideogram": "Anexo: 40 créditos por dia; cada prompt usa 10 créditos e gera 4 imagens.",
    "midjourney": "Anexo: teste gratuito indisponível.",
    "suno": "Anexo: 5 prompts por dia, com 2 áudios por prompt.",
    "elevenlabs": "Anexo: 10.000 créditos por mês, equivalentes a cerca de 10 minutos de texto para fala ou 15 minutos de conversação.",
    "whisper": "Anexo: uso local gratuito; API sem tier gratuito fixo.",
    "magicschool": "Anexo: há plano gratuito, mas limites de uso/gerações não documentados.",
    "brisk-teaching": "Anexo: não indica limite gratuito específico.",
    "teachable-machine": "Anexo: não indica limite gratuito específico.",
    "goblin-tools": "Anexo: zero custo no uso indicado.",
    "gptzero": "Anexo: scan básico por IA ilimitado e 5 scans avançados no limite informado.",
    "github-copilot": "Anexo: cerca de 2.000 completions e 50 requisições no limite indicado.",
    "phind": "Anexo: 10 consultas por dia, com até 3.000 caracteres por consulta.",
    "julius": "Anexo: 15 mensagens por mês; respostas da IA limitadas a 100 palavras.",
    "excel-sheets": "Anexo: uso gratuito limitado, sem cota diária detalhada.",
    "miro": "Anexo: quadros ilimitados, mas apenas 3 editáveis no plano gratuito indicado.",
    "figjam": "Anexo: uso individual com limite de editores/projetos.",
    "drawio": "Anexo: versão web/app gratuita.",
}


def detail(tool: dict[str, object], key: str) -> str:
    if key == "free_limit":
        return str(tool.get(key) or FREE_LIMITS_BY_TYPE.get(str(tool["type"]), "Recursos gratuitos podem variar por país, conta e data; confira os limites antes da atividade."))
    if key == "data_use":
        return str(tool.get(key) or DATA_USE_BY_TYPE.get(str(tool["type"]), "O uso de dados depende da política da plataforma; evite informações pessoais e revise as configurações da conta."))
    raise KeyError(key)


def module_tool_links(num: int, prefix: str = "../") -> str:
    links = [
        f'<a class="pill" href="{prefix}ferramentas/{tool["slug"]}.html">{e(tool["name"])}</a>'
        for tool in TOOLS
        if num in tool["modules"]
    ]
    return "".join(links)


def fetch_url(url: str, timeout: int = 10) -> tuple[bytes, str]:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; UNESP.IA portal asset updater)",
            "Accept": "image/avif,image/webp,image/png,image/svg+xml,image/*,*/*;q=0.8",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return response.read(), response.headers.get("Content-Type", "")
    except urllib.error.URLError as exc:
        if "CERTIFICATE_VERIFY_FAILED" not in str(exc):
            raise
        context = ssl._create_unverified_context()
        with urllib.request.urlopen(req, timeout=timeout, context=context) as response:
            return response.read(), response.headers.get("Content-Type", "")


def find_icon_url(official_url: str) -> str:
    try:
        page_bytes, _ = fetch_url(official_url)
    except (urllib.error.URLError, TimeoutError, ValueError):
        return urllib.parse.urljoin(official_url, "/favicon.ico")

    page = page_bytes.decode("utf-8", errors="ignore")
    icon_matches = re.findall(
        r'<link[^>]+rel=["\'][^"\']*(?:apple-touch-icon|shortcut icon|icon)[^"\']*["\'][^>]*>',
        page,
        flags=re.I,
    )
    for tag in icon_matches:
        href = re.search(r'href=["\']([^"\']+)["\']', tag, flags=re.I)
        if href:
            return urllib.parse.urljoin(official_url, html.unescape(href.group(1)))
    return urllib.parse.urljoin(official_url, "/favicon.ico")


def image_data_url(data: bytes, content_type: str, source_url: str) -> str:
    content_type = content_type.split(";")[0].strip().lower()
    if not content_type.startswith("image/"):
        suffix = Path(urllib.parse.urlparse(source_url).path).suffix.lower()
        content_type = {
            ".svg": "image/svg+xml",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".webp": "image/webp",
            ".ico": "image/x-icon",
        }.get(suffix, "image/png")
    encoded = base64.b64encode(data).decode("ascii")
    return f"data:{content_type};base64,{encoded}"


def official_logo_svg(tool: dict[str, object]) -> str | None:
    official_url = str(tool.get("official_url") or "")
    if not official_url:
        return None
    icon_url = OFFICIAL_ICON_OVERRIDES.get(str(tool["slug"])) or find_icon_url(official_url)
    try:
        data, content_type = fetch_url(icon_url)
    except (urllib.error.URLError, TimeoutError, ValueError):
        return None
    if not data or len(data) > 800_000:
        return None
    data_url = image_data_url(data, content_type, icon_url)
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img" '
        f'aria-label="{e(tool["name"])}"><rect width="96" height="96" rx="22" fill="#fff"/>'
        '<rect x="4" y="4" width="88" height="88" rx="20" fill="#fff" stroke="#D8E2EB"/>'
        f'<image href="{data_url}" x="16" y="16" width="64" height="64" preserveAspectRatio="xMidYMid meet"/>'
        "</svg>"
    )


def make_logos() -> None:
    logo_dir = ROOT / "assets" / "img" / "ferramentas"
    for tool in TOOLS:
        svg = official_logo_svg(tool)
        if svg is None:
            svg = (
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img" '
                f'aria-label="{e(tool["name"])}"><rect width="96" height="96" rx="22" '
                f'fill="{tool["color"]}"/><circle cx="72" cy="24" r="14" fill="rgba(255,255,255,.18)"/>'
                '<path d="M18 70 C30 48,44 88,78 32" fill="none" stroke="rgba(255,255,255,.34)" '
                'stroke-width="8" stroke-linecap="round"/>'
                f'<text x="48" y="58" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" '
                f'font-size="28" font-weight="800" fill="#fff">{e(tool["initials"])}</text></svg>'
            )
        write(logo_dir / f'{tool["slug"]}.svg', svg)


def tool_page(tool: dict[str, object]) -> str:
    uses = "".join(f"<li>{e(item)}</li>" for item in tool["uses"])
    examples = "".join(f"<li>{e(item)}</li>" for item in tool["examples"])
    facts = [
        ("Tipo", tool["type"]),
        ("Site oficial", tool.get("official_url") or "Consulte o endereço oficial da ferramenta."),
        ("Limitações gratuitas", detail(tool, "free_limit")),
        ("Limite diário/cota no anexo", DAILY_LIMITS_FROM_ATTACHMENT.get(str(tool["slug"]), "Anexo não informa cota diária específica para esta ferramenta.")),
        ("Uso de dados (Treino)", detail(tool, "data_use")),
        ("Entrada", tool["inputs"]),
        ("Saída", tool["outputs"]),
    ]
    facts_html = ""
    for label, value in facts:
        value_text = str(value)
        if label == "Site oficial" and value_text.startswith("http"):
            body = f'<a href="{e(value_text)}" target="_blank" rel="noopener">{e(value_text)}</a>'
        else:
            body = e(value_text)
        facts_html += f'<div class="tool-fact"><strong>{e(label)}</strong><p>{body}</p></div>'
    return (
        '<!doctype html><html lang="pt-br"><head><meta charset="utf-8"><meta name="viewport" '
        f'content="width=device-width,initial-scale=1"><title>{e(tool["name"])} | unesp.IA</title>'
        '<link rel="stylesheet" href="../assets/css/style.css"><script src="../assets/js/search.js"></script>'
        f'</head><body>{NAV_SUB}<main><div class="container content" id="top">'
        f'<div class="breadcrumbs"><a href="../index.html">Início</a> / <a href="../ferramentas.html">Ferramentas</a> / {e(tool["name"])}</div>'
        '<section class="tool-page-hero">'
        f'<img class="tool-logo" src="../assets/img/ferramentas/{tool["slug"]}.svg" alt="Logo {e(tool["name"])}">'
        f'<div><span class="tool-type">{e(tool["type"])}</span><h1>{e(tool["name"])}</h1><p>{e(tool["summary"])}</p></div></section>'
        f'<section class="tool-facts">{facts_html}</section>'
        f"<h2>Funcionalidades relacionadas ao curso</h2><ul>{uses}</ul>"
        f"<h2>Exemplos de atividade</h2><ol>{examples}</ol>"
        f'<h2>Cuidados de uso</h2><div class="callout warn"><p>{e(tool["care"])}</p></div>'
        '<h2>Relacionamentos</h2><h3>Módulos relacionados</h3>'
        f'<div class="related-strip">{related_links(tool["modules"], "module", "../")}</div>'
        f'<h3>Atividades relacionadas</h3><div class="related-strip">{related_links(tool["modules"], "activity", "../")}</div>'
        f'</div></main><a class="backtop" href="#top">Topo</a>{FOOTER}</body></html>'
    )


def tool_cards(prefix: str) -> str:
    cards = []
    for tool in TOOLS:
        official = str(tool.get("official_url") or "")
        official_link = f'<a class="pill" href="{e(official)}" target="_blank" rel="noopener">Site oficial</a>' if official else ""
        cards.append(
            f'<article class="card tool-card" data-search="{e(tool["name"] + " " + tool["type"] + " " + tool["summary"])}">'
            '<div class="tool-head">'
            f'<img class="tool-logo" src="{prefix}assets/img/ferramentas/{tool["slug"]}.svg" alt="Logo {e(tool["name"])}">'
            f'<div><span class="tool-type">{e(tool["type"])}</span><h3><a href="{prefix}ferramentas/{tool["slug"]}.html">{e(tool["name"])}</a></h3></div>'
            f'</div><p>{e(tool["summary"])}</p><div class="tool-links">{related_links(tool["modules"], "module", prefix)}{official_link}</div></article>'
        )
    return "".join(cards)


def make_tool_pages() -> None:
    make_logos()
    for tool in TOOLS:
        write(ROOT / "ferramentas" / f'{tool["slug"]}.html', tool_page(tool))

    root_page = (
        '<!doctype html><html lang="pt-br"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        '<title>Ferramentas | unesp.IA</title><link rel="stylesheet" href="assets/css/style.css"><script src="assets/js/search.js"></script>'
        f'</head><body>{NAV_ROOT}<main><div class="container content tool-library" id="top"><h1 class="section-title">Biblioteca de Ferramentas</h1>'
        '<p>Ferramentas organizadas por tipo de uso, com exemplos, cuidados, módulos e atividades relacionadas. Elas são meios para desenvolver competências, não substitutos da análise humana.</p>'
        '<div class="callout tool-language-note"><b>Termos técnicos em contexto.</b> Na primeira ocorrência de cada página, o equivalente em português acompanha termos como Machine Learning (Aprendizado de Máquina) e Deep Learning (Aprendizado Profundo).</div>'
        '<input id="searchBox" class="search" onkeyup="filterCards()" placeholder="Buscar ferramenta...">'
        f'<div class="tool-grid">{tool_cards("")}</div></div></main><a class="backtop" href="#top">Topo</a>{FOOTER}</body></html>'
    )
    sub_page = root_page.replace(NAV_ROOT, NAV_SUB)
    sub_page = sub_page.replace('href="assets/', 'href="../assets/').replace('src="assets/', 'src="../assets/')
    sub_page = sub_page.replace('href="ferramentas/', 'href="../ferramentas/')
    sub_page = sub_page.replace('href="modulos/', 'href="../modulos/')
    write(ROOT / "ferramentas.html", root_page)
    write(ROOT / "ferramentas" / "index.html", sub_page)


def clean_modules() -> None:
    tool_map = {tool["name"]: tool["slug"] for tool in TOOLS}
    aliases = {
        "Canva AI": "canva",
        "Canva": "canva",
        "GitHub Copilot": "github-copilot",
        "Google Sheets": "excel-sheets",
        "Excel": "excel-sheets",
        "Google Colab": "google-colab",
    }
    link_map = {**tool_map, **aliases}
    sorted_names = sorted(link_map, key=len, reverse=True)
    for path in (ROOT / "modulos").glob("m*.html"):
        text = path.read_text(encoding="utf-8")
        module_match = re.search(r"m(\d+)\.html$", path.name)
        module_num = int(module_match.group(1)) if module_match else 0
        text = re.sub(
            r'<div class="hero"><span class="badge">(M\d+)</span><h1>(.*?)</h1><p>Material didático completo do participante, no padrão visual da versão Sprint 1\.</p></div>',
            r'<div class="hero"><span class="badge">\1</span><h1>\2</h1></div>',
            text,
            flags=re.S,
        )
        text = re.sub(r'<h1 class="module-title".*?</h1>\s*', "", text, flags=re.S)
        text = re.sub(r'<h3 id="material-didatico-do-participante">Material Didático do Participante</h3>\s*', "", text)
        text = re.sub(
            r'<h3 id="ferramentas-utilizadas">Ferramentas utilizadas</h3>\s*<ul class="list">.*?</ul>\s*',
            "",
            text,
            flags=re.S,
        )
        text = re.sub(
            r'<h4 id="exemplos-de-ferramentas">Exemplos de ferramentas</h4>\s*<ul class="list">.*?</ul>\s*',
            "",
            text,
            flags=re.S,
        )

        text = re.sub(r'<section class="module-toolbox">.*?</section>\s*', "", text, flags=re.S)
        if module_num:
            toolbox = (
                '<section class="module-toolbox"><h3>Ferramentas relacionadas neste módulo</h3>'
                f'<div class="related-strip">{module_tool_links(module_num)}</div></section>'
            )
            text = re.sub(r'(<div class="module-actions">.*?</div>)', r'\1' + toolbox, text, count=1, flags=re.S)

        if module_num == 1:
            text = re.sub(r'<div class="callout practice m1-literacy">.*?</div>\s*', "", text, flags=re.S)
            literacy = (
                '<div class="callout practice m1-literacy"><h3>O que significa letramento em IA?</h3>'
                '<p>Neste módulo, letramento em Inteligência Artificial significa aprender a reconhecer onde a IA aparece, '
                'entender seus limites, formular bons prompts, interpretar respostas com senso crítico e decidir quando a tecnologia '
                'ajuda ou quando exige cuidado humano.</p><ul class="list">'
                '<li>perguntar de onde vêm os dados e quais vieses podem aparecer;</li>'
                '<li>comparar respostas da IA com fontes confiáveis;</li>'
                '<li>proteger dados pessoais e respeitar direitos de outras pessoas;</li>'
                '<li>usar ferramentas como apoio para aprender, criar e resolver problemas, sem abrir mão da responsabilidade humana.</li>'
                '</ul></div>'
            )
            text = text.replace(
                '<h2 class="section-title" id="1-organizacao-do-modulo">',
                literacy + '<h2 class="section-title" id="1-organizacao-do-modulo">',
                1,
            )

        for name, slug in link_map.items():
            escaped = re.escape(name)
            text = re.sub(
                rf'<a class="term" href="../ferramentas/index\.html">{escaped}</a>',
                f'<a class="term" href="../ferramentas/{slug}.html">{name}</a>',
                text,
            )
        for name in sorted_names:
            slug = link_map[name]
            escaped = re.escape(name)
            parts = re.split(r'(<a\b[^>]*>.*?</a>)', text, flags=re.S | re.I)
            for index in range(0, len(parts), 2):
                parts[index] = re.sub(
                    rf'(?<![\w/-]){escaped}(?![\w/-])',
                    f'<a class="term" href="../ferramentas/{slug}.html">{name}</a>',
                    parts[index],
                )
            text = "".join(parts)
        path.write_text(text, encoding="utf-8")


def main() -> None:
    make_tool_pages()
    clean_modules()
    standardize_portal()


if __name__ == "__main__":
    main()
