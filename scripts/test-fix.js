const fs = require('fs');

function fixMojibake(str) {
    if (!str) return '';
    try {
        const decoded = Buffer.from(str, 'latin1').toString('utf8');
        if (!decoded.includes('')) {
            return decoded;
        }
    } catch (e) {}
    
    return str
        .replace(/Ã‘/g, 'Ñ')
        .replace(/Ã’/g, 'Ñ')
        .replace(/Ã±/g, 'ñ')
        .replace(/Ã¡/g, 'á')
        .replace(/Ã©/g, 'é')
        .replace(/Ã­/g, 'í')
        .replace(/Ã³/g, 'ó')
        .replace(/Ãº/g, 'ú')
        .replace(/NÂ°/g, 'N°')
        .replace(/Â°/g, '°');
}

const testStrings = [
    "MUÃ‘OZ",
    "AtenciÃ³n Personal",
    "ORMEÃ’O MAURICIO ANTONIO",
    "GONZALEZ, ELVIO OSCAR",
    "NÂ° de Expte."
];

testStrings.forEach(s => {
    console.log(`Original: "${s}"  ===>  Corregido: "${fixMojibake(s)}"`);
});
