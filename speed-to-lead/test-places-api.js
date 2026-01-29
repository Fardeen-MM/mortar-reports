const https = require('https');

const API_KEY = 'AIzaSyA2ZN122gLi2zNGI5dckM88BMyP8Ni4obc';

function searchPlaces(query, location) {
  return new Promise((resolve, reject) => {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query + ' ' + location)}&key=${API_KEY}`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

(async () => {
  console.log('Testing Google Places API...\n');
  
  const results = await searchPlaces('family law lawyer', 'Toronto, ON');
  
  if (results.status === 'OK') {
    console.log(`✅ Found ${results.results.length} competitors\n`);
    
    results.results.slice(0, 10).forEach((place, i) => {
      console.log(`${i + 1}. ${place.name}`);
      console.log(`   Rating: ${place.rating || 'N/A'} (${place.user_ratings_total || 0} reviews)`);
      console.log(`   Address: ${place.formatted_address}`);
      console.log('');
    });
  } else {
    console.log('❌ Error:', results.status);
    console.log('Message:', results.error_message || 'Unknown error');
  }
})();
