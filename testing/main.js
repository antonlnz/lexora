const Parser = require('rss-parser');
const { Readability } = require('@mozilla/readability');
const { JSDOM } = require('jsdom');

const parser = new Parser();

async function procesarRSS(urlRSS) {
    try {
        // Leer el feed RSS
        const feed = await parser.parseURL(urlRSS);
        
        console.log(`Feed: ${feed.title}\n`);
        
        // Procesar cada artículo del feed
        for (const item of feed.items) {
            console.log(`\n--- ${item.title} ---`);
            console.log(`Link: ${item.link}\n`);
            
            // Obtener el contenido de la página
            const response = await fetch(item.link);
            const html = await response.text();
            
            // Crear un DOM virtual
            const dom = new JSDOM(html, { url: item.link });
            
            // Usar Readability para extraer el contenido
            const reader = new Readability(dom.window.document);
            const article = reader.parse();
            
            if (article) {
                
                console.log(`Título: ${article.title}`);
                console.log(`Autor: ${article.byline || 'N/A'}`);
                console.log(`Contenido:\n${article.textContent.substring(0, 500)}...\n`);
            } else {
                console.log('No se pudo extraer el contenido del artículo.\n');
            }
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
}

// Ejemplo de uso
const urlRSS = 'https://feeds.bbci.co.uk/news/rss.xml'; // Reemplaza con la URL del RSS
procesarRSS(urlRSS);