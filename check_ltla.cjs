const fs = require('fs');
const csvText = fs.readFileSync('public/data/lookup/ltla_centroids.csv', 'utf8');
const lines = csvText.split('\n');

console.log('Total de linhas (incluindo header):', lines.length);

const problematicas = [];
lines.slice(1).forEach((line, idx) => {
  if (!line.trim()) return;
  
  const values = line.split(',');
  const code = values[0] ? values[0].trim() : '';
  const name = values[1] ? values[1].trim() : '';
  const lat = parseFloat(values[2] ? values[2].trim() : '0');
  const lon = parseFloat(values[3] ? values[3].trim() : '0');
  
  const passaFiltro = code && lat && lon && lat !== 0 && lon !== 0;
  
  if (!passaFiltro) {
    problematicas.push({
      linha: idx + 2,
      code: code,
      name: name,
      lat: lat,
      lon: lon
    });
  }
});

console.log('\nLinhas problemáticas:', problematicas.length);
console.log(JSON.stringify(problematicas, null, 2));
