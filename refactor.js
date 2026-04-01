const fs = require('fs');
const path = require('path');

const basePath = path.join('c:\\', 'WORK', 'SodamFN', 'SodamApp', 'frontend', 'src', 'pages');
const targets = ["RevenueManagement", "VendorSettings", "PurchaseManagement", "ProfitLoss"];

targets.forEach(t => {
    const dirPath = path.join(basePath, t);
    
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
    
    const jsxPath = path.join(basePath, `${t}.jsx`);
    const cssPath = path.join(basePath, `${t}.css`);
    
    const newJsxPath = path.join(dirPath, "index.jsx");
    const newCssPath = path.join(dirPath, `${t}.css`);
    
    if (fs.existsSync(jsxPath)) {
        fs.renameSync(jsxPath, newJsxPath);
        console.log(`Moved ${t}.jsx to ${t}/index.jsx`);
    } else {
        console.log(`File not found: ${jsxPath}`);
    }
    
    if (fs.existsSync(cssPath)) {
        fs.renameSync(cssPath, newCssPath);
        console.log(`Moved ${t}.css to ${t}/${t}.css`);
    }
    
    if (fs.existsSync(newJsxPath)) {
        let content = fs.readFileSync(newJsxPath, 'utf8');
        content = content.replace(/from '\.\.\//g, "from '../../");
        content = content.replace(/import '\.\.\//g, "import '../../");
        fs.writeFileSync(newJsxPath, content, 'utf8');
        console.log(`Updated imports in ${t}/index.jsx`);
    }
});

console.log("Refactoring complete.");
