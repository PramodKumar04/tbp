const http = require('http');
const fs = require('fs');
const path = require('path');

http.createServer((req, res) => {
    let filePath = '.' + req.url.split('?')[0];
    if (filePath == './') filePath = './index.html';
    
    let extname = path.extname(filePath);
    let contentType = 'text/html';
    switch (extname) {
        case '.js': contentType = 'text/javascript'; break;
        case '.css': contentType = 'text/css'; break;
        case '.csv': contentType = 'text/csv'; break;
        case '.svg': contentType = 'image/svg+xml'; break;
    }
    
    fs.readFile(filePath, (error, content) => {
        if (error) { 
            res.writeHead(404); 
            res.end('Error ' + filePath); 
        } else { 
            res.writeHead(200, { 'Content-Type': contentType }); 
            res.end(content, 'utf-8'); 
        }
    });
}).listen(9999);

console.log('========================================');
console.log('Frontend Debug Server running on:');
console.log('http://localhost:9999');
console.log('========================================');
