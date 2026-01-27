export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json'
    };
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    // Avatar proxy
    if (url.pathname === '/avatar') {
      try {
        const response = await fetch('https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=1111928311&size=150x150&format=Png&isCircular=false');
        const data = await response.json();
        return new Response(JSON.stringify(data), { status: 200, headers: corsHeaders });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to fetch avatar' }), { status: 500, headers: corsHeaders });
      }
    }
    
    // Weather API
    if (url.pathname === '/weather') {
      const city = url.searchParams.get('city') || 'New York';
      try {
        const response = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
        const data = await response.json();
        const current = data.current_condition[0];
        return new Response(JSON.stringify({
          temp: current.temp_F + '°F',
          condition: current.weatherDesc[0].value,
          humidity: current.humidity + '%',
          city: data.nearest_area[0].areaName[0].value
        }), { status: 200, headers: corsHeaders });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to fetch weather' }), { status: 500, headers: corsHeaders });
      }
    }
    
    // Google News scraper - Enhanced
    if (url.pathname === '/news') {
      const topic = url.searchParams.get('q') || 'technology';
      try {
        const response = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(topic)}&hl=en-US&gl=US&ceid=US:en`);
        const text = await response.text();
        
        const headlines = [];
        const items = text.matchAll(/<item>(.*?)<\/item>/gs);
        
        for (const item of items) {
          const titleMatch = item[1].match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/);
          const linkMatch = item[1].match(/<link>(.*?)<\/link>/);
          const pubDateMatch = item[1].match(/<pubDate>(.*?)<\/pubDate>/);
          
          if (titleMatch && headlines.length < 5) {
            headlines.push({
              title: titleMatch[1],
              link: linkMatch ? linkMatch[1] : '',
              date: pubDateMatch ? pubDateMatch[1] : ''
            });
          }
        }
        
        return new Response(JSON.stringify({ 
          headlines: headlines.map(h => h.title),
          articles: headlines
        }), { status: 200, headers: corsHeaders });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to fetch news' }), { status: 500, headers: corsHeaders });
      }
    }
    
    // Crypto prices
    if (url.pathname === '/crypto') {
      const symbol = url.searchParams.get('symbol') || 'bitcoin';
      try {
        const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${symbol}&vs_currencies=usd&include_24hr_change=true`);
        const data = await response.json();
        const coin = data[symbol];
        return new Response(JSON.stringify({
          price: '$' + coin.usd.toLocaleString(),
          change: coin.usd_24h_change.toFixed(2) + '%'
        }), { status: 200, headers: corsHeaders });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to fetch crypto price' }), { status: 500, headers: corsHeaders });
      }
    }
    
    // Random fact
    if (url.pathname === '/fact') {
      try {
        const response = await fetch('https://uselessfacts.jsph.pl/random.json?language=en');
        const data = await response.json();
        return new Response(JSON.stringify({ fact: data.text }), { status: 200, headers: corsHeaders });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to fetch fact' }), { status: 500, headers: corsHeaders });
      }
    }
    
    // Quote of the day
    if (url.pathname === '/quote') {
      try {
        const response = await fetch('https://zenquotes.io/api/random');
        const data = await response.json();
        return new Response(JSON.stringify({
          quote: data[0].q,
          author: data[0].a
        }), { status: 200, headers: corsHeaders });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to fetch quote' }), { status: 500, headers: corsHeaders });
      }
    }
    
    // Time/Date API
    if (url.pathname === '/time') {
      const timezone = url.searchParams.get('tz') || 'America/New_York';
      try {
        const now = new Date();
        return new Response(JSON.stringify({
          time: now.toLocaleTimeString('en-US', { timeZone: timezone }),
          date: now.toLocaleDateString('en-US', { timeZone: timezone }),
          timezone: timezone
        }), { status: 200, headers: corsHeaders });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to get time' }), { status: 500, headers: corsHeaders });
      }
    }
    
    // Cat fact
    if (url.pathname === '/catfact') {
      try {
        const response = await fetch('https://catfact.ninja/fact');
        const data = await response.json();
        return new Response(JSON.stringify({ fact: data.fact }), { status: 200, headers: corsHeaders });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to fetch cat fact' }), { status: 500, headers: corsHeaders });
      }
    }

    // IP Geolocation
    if (url.pathname === '/location') {
      try {
        const clientIP = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
        // Use Cloudflare's geolocation data if available
        const country = request.cf?.country || 'US';
        const city = request.cf?.city || 'Unknown';
        const timezone = request.cf?.timezone || 'America/New_York';
        const lat = request.cf?.latitude || '40.7128';
        const lon = request.cf?.longitude || '-74.0060';

        return new Response(JSON.stringify({
          ip: clientIP,
          city: city,
          country: country,
          timezone: timezone,
          latitude: lat,
          longitude: lon
        }), { status: 200, headers: corsHeaders });
      } catch (error) {
        return new Response(JSON.stringify({
          error: 'Failed to get location',
          city: 'New York',
          timezone: 'America/New_York'
        }), { status: 500, headers: corsHeaders });
      }
    }

    // Dad Joke
    if (url.pathname === '/joke') {
      try {
        const response = await fetch('https://icanhazdadjoke.com/', {
          headers: { 'Accept': 'application/json' }
        });
        const data = await response.json();
        return new Response(JSON.stringify({ joke: data.joke }), { status: 200, headers: corsHeaders });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to fetch joke' }), { status: 500, headers: corsHeaders });
      }
    }

    // Trivia Question
    if (url.pathname === '/trivia') {
      try {
        const response = await fetch('https://opentdb.com/api.php?amount=1&type=multiple');
        const data = await response.json();
        const q = data.results[0];
        return new Response(JSON.stringify({
          question: q.question,
          category: q.category,
          difficulty: q.difficulty,
          correct_answer: q.correct_answer,
          all_answers: [...q.incorrect_answers, q.correct_answer].sort(() => Math.random() - 0.5)
        }), { status: 200, headers: corsHeaders });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to fetch trivia' }), { status: 500, headers: corsHeaders });
      }
    }

    // Urban Dictionary
    if (url.pathname === '/define') {
      const term = url.searchParams.get('term') || 'bruh';
      try {
        const response = await fetch(`https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(term)}`);
        const data = await response.json();
        if (data.list && data.list.length > 0) {
          const def = data.list[0];
          return new Response(JSON.stringify({
            word: def.word,
            definition: def.definition.replace(/\[|\]/g, '').substring(0, 200),
            example: def.example.replace(/\[|\]/g, '').substring(0, 150)
          }), { status: 200, headers: corsHeaders });
        }
        return new Response(JSON.stringify({ error: 'No definition found' }), { status: 404, headers: corsHeaders });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to fetch definition' }), { status: 500, headers: corsHeaders });
      }
    }

    // Movie/TV Info (using free OMDb alternative - TMDb is better but needs API key)
    if (url.pathname === '/movie') {
      const title = url.searchParams.get('title') || 'Inception';
      try {
        // Using OMDb API (free tier - you may need to add API key as env var)
        const response = await fetch(`https://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=trilogy`);
        const data = await response.json();
        if (data.Response === 'True') {
          return new Response(JSON.stringify({
            title: data.Title,
            year: data.Year,
            rating: data.imdbRating,
            plot: data.Plot,
            genre: data.Genre
          }), { status: 200, headers: corsHeaders });
        }
        return new Response(JSON.stringify({ error: 'Movie not found' }), { status: 404, headers: corsHeaders });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to fetch movie info' }), { status: 500, headers: corsHeaders });
      }
    }

    // Random Advice
    if (url.pathname === '/advice') {
      try {
        const response = await fetch('https://api.adviceslip.com/advice');
        const data = await response.json();
        return new Response(JSON.stringify({ advice: data.slip.advice }), { status: 200, headers: corsHeaders });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to fetch advice' }), { status: 500, headers: corsHeaders });
      }
    }

    // Riddle
    if (url.pathname === '/riddle') {
      const riddles = [
        { riddle: "What has keys but no locks?", answer: "A piano" },
        { riddle: "What can travel around the world while staying in a corner?", answer: "A stamp" },
        { riddle: "What has a head and a tail but no body?", answer: "A coin" },
        { riddle: "What gets wetter the more it dries?", answer: "A towel" },
        { riddle: "What can you catch but not throw?", answer: "A cold" },
        { riddle: "What has hands but can't clap?", answer: "A clock" },
        { riddle: "What has a neck but no head?", answer: "A bottle" },
        { riddle: "What goes up but never comes down?", answer: "Your age" },
        { riddle: "I speak without a mouth and hear without ears. What am I?", answer: "An echo" },
        { riddle: "The more you take, the more you leave behind. What am I?", answer: "Footsteps" }
      ];
      const r = riddles[Math.floor(Math.random() * riddles.length)];
      return new Response(JSON.stringify(r), { status: 200, headers: corsHeaders });
    }

    // Horoscope
    if (url.pathname === '/horoscope') {
      const sign = url.searchParams.get('sign')?.toLowerCase() || 'aries';
      const horoscopes = {
        aries: "Today brings exciting opportunities. Your energy is high - use it wisely!",
        taurus: "Focus on stability today. A financial opportunity may present itself.",
        gemini: "Communication is key today. Express yourself clearly and listen to others.",
        cancer: "Trust your intuition today. Your emotional intelligence is your superpower.",
        leo: "Your creativity shines today. Take center stage and show your talents.",
        virgo: "Organization brings peace today. Tackle that project you've been avoiding.",
        libra: "Balance is essential today. Make time for both work and relationships.",
        scorpio: "Transformation is in the air. Embrace change and let go of the past.",
        sagittarius: "Adventure calls today. Say yes to new experiences and opportunities.",
        capricorn: "Hard work pays off today. Your dedication will be recognized.",
        aquarius: "Innovation is your strength today. Think outside the box.",
        pisces: "Creativity flows freely today. Express your artistic side."
      };
      const reading = horoscopes[sign] || horoscopes.aries;
      return new Response(JSON.stringify({ sign, horoscope: reading }), { status: 200, headers: corsHeaders });
    }

    // Random Color
    if (url.pathname === '/color') {
      const colors = [
        { name: "Coral", hex: "#FF7F50", rgb: "255, 127, 80", meaning: "warmth and energy" },
        { name: "Teal", hex: "#008080", rgb: "0, 128, 128", meaning: "calm and sophistication" },
        { name: "Lavender", hex: "#E6E6FA", rgb: "230, 230, 250", meaning: "grace and elegance" },
        { name: "Mint", hex: "#98FF98", rgb: "152, 255, 152", meaning: "freshness and vitality" },
        { name: "Crimson", hex: "#DC143C", rgb: "220, 20, 60", meaning: "passion and power" },
        { name: "Amber", hex: "#FFBF00", rgb: "255, 191, 0", meaning: "warmth and happiness" },
        { name: "Indigo", hex: "#4B0082", rgb: "75, 0, 130", meaning: "wisdom and intuition" },
        { name: "Sage", hex: "#9DC183", rgb: "157, 193, 131", meaning: "nature and growth" }
      ];
      const c = colors[Math.floor(Math.random() * colors.length)];
      return new Response(JSON.stringify(c), { status: 200, headers: corsHeaders });
    }

    // Magic 8 Ball
    if (url.pathname === '/8ball') {
      const question = url.searchParams.get('question') || 'Will it happen?';
      const answers = [
        "It is certain", "It is decidedly so", "Without a doubt", "Yes definitely",
        "You may rely on it", "As I see it, yes", "Most likely", "Outlook good",
        "Yes", "Signs point to yes", "Reply hazy, try again", "Ask again later",
        "Better not tell you now", "Cannot predict now", "Concentrate and ask again",
        "Don't count on it", "My reply is no", "My sources say no",
        "Outlook not so good", "Very doubtful"
      ];
      const answer = answers[Math.floor(Math.random() * answers.length)];
      return new Response(JSON.stringify({ question, answer }), { status: 200, headers: corsHeaders });
    }

    // Wikipedia Search
    if (url.pathname === '/wiki') {
      const query = url.searchParams.get('query') || 'Wikipedia';
      try {
        const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);
        if (response.ok) {
          const data = await response.json();
          return new Response(JSON.stringify({
            title: data.title,
            extract: data.extract?.substring(0, 300) || 'No summary available',
            url: data.content_urls?.desktop?.page || ''
          }), { status: 200, headers: corsHeaders });
        }
        // Try search if direct page not found
        const searchResponse = await fetch(`https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=1&format=json`);
        const searchData = await searchResponse.json();
        if (searchData[1]?.length > 0) {
          const pageTitle = searchData[1][0];
          const pageResponse = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`);
          const pageData = await pageResponse.json();
          return new Response(JSON.stringify({
            title: pageData.title,
            extract: pageData.extract?.substring(0, 300) || 'No summary available',
            url: pageData.content_urls?.desktop?.page || ''
          }), { status: 200, headers: corsHeaders });
        }
        return new Response(JSON.stringify({ error: 'No Wikipedia article found' }), { status: 404, headers: corsHeaders });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to fetch Wikipedia' }), { status: 500, headers: corsHeaders });
      }
    }

    // Calculator
    if (url.pathname === '/calc') {
      const expression = url.searchParams.get('expression') || '1+1';
      try {
        // Safe math evaluation (no eval)
        const sanitized = expression.replace(/[^0-9+\-*/().%\s^]/g, '');
        // Replace ^ with ** for power
        const jsExpr = sanitized.replace(/\^/g, '**');
        // Use Function constructor for safer eval
        const result = new Function('return ' + jsExpr)();
        return new Response(JSON.stringify({
          expression: expression,
          result: result,
          formatted: typeof result === 'number' ? result.toLocaleString() : result
        }), { status: 200, headers: corsHeaders });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Invalid math expression' }), { status: 400, headers: corsHeaders });
      }
    }

    // Translate (using LibreTranslate or fallback)
    if (url.pathname === '/translate') {
      const text = url.searchParams.get('text') || 'hello';
      const targetLang = url.searchParams.get('to') || 'es';

      // Language code mapping
      const langCodes = {
        'spanish': 'es', 'french': 'fr', 'german': 'de', 'italian': 'it',
        'portuguese': 'pt', 'russian': 'ru', 'japanese': 'ja', 'chinese': 'zh',
        'korean': 'ko', 'arabic': 'ar', 'hindi': 'hi', 'dutch': 'nl'
      };
      const langCode = langCodes[targetLang.toLowerCase()] || targetLang;

      try {
        // Try MyMemory API (free, no key needed)
        const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${langCode}`);
        const data = await response.json();
        if (data.responseStatus === 200 && data.responseData?.translatedText) {
          return new Response(JSON.stringify({
            original: text,
            translated: data.responseData.translatedText,
            language: targetLang
          }), { status: 200, headers: corsHeaders });
        }
        return new Response(JSON.stringify({ error: 'Translation failed' }), { status: 500, headers: corsHeaders });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to translate' }), { status: 500, headers: corsHeaders });
      }
    }

    // Word of the Day
    if (url.pathname === '/wordofday') {
      const words = [
        { word: "ephemeral", definition: "lasting for a very short time", example: "the ephemeral nature of social media trends" },
        { word: "serendipity", definition: "finding something good without looking for it", example: "meeting your best friend by serendipity at a concert" },
        { word: "mellifluous", definition: "sweet or musical; pleasant to hear", example: "her mellifluous voice calmed everyone" },
        { word: "sonder", definition: "realizing everyone has a life as complex as your own", example: "feeling sonder while people-watching at the mall" },
        { word: "petrichor", definition: "the pleasant earthy smell after rain", example: "the petrichor after a summer storm" },
        { word: "ineffable", definition: "too great to be expressed in words", example: "the ineffable beauty of the northern lights" },
        { word: "luminous", definition: "giving off light; bright or shining", example: "the luminous glow of fireflies at night" },
        { word: "ethereal", definition: "extremely delicate, light, otherworldly", example: "the ethereal music of the orchestra" },
        { word: "halcyon", definition: "denoting a period of happiness and peace", example: "remembering the halcyon days of childhood" },
        { word: "resplendent", definition: "dazzling in appearance; gorgeous", example: "the resplendent sunset painted the sky" }
      ];
      const today = new Date().getDate();
      const w = words[today % words.length];
      return new Response(JSON.stringify(w), { status: 200, headers: corsHeaders });
    }

    // Random Dog Image
    if (url.pathname === '/dog') {
      try {
        const response = await fetch('https://dog.ceo/api/breeds/image/random');
        const data = await response.json();
        return new Response(JSON.stringify({
          imageUrl: data.message,
          status: 'here\'s a good boy for you'
        }), { status: 200, headers: corsHeaders });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to fetch dog' }), { status: 500, headers: corsHeaders });
      }
    }

    // Chat API proxy
    if (url.pathname === '/chat') {
      if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
      }

      const apiKey = env.OPENAI_API_KEY;
      if (!apiKey) {
        return new Response(JSON.stringify({ error: 'API key not configured' }), { status: 500, headers: corsHeaders });
      }

      try {
        const body = await request.json();

        // Use OpenAI Responses API for gpt-5-nano
        const API_ENDPOINT = 'https://api.openai.com/v1/responses';

        const response = await fetch(API_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify(body)
        });

        const data = await response.json();
        return new Response(JSON.stringify(data), { status: response.status, headers: corsHeaders });
      } catch (error) {
        console.error('Chat API error:', error);
        return new Response(JSON.stringify({
          error: 'Request failed',
          details: error.message
        }), { status: 500, headers: corsHeaders });
      }
    }
    
    // Serve static assets
    return env.ASSETS.fetch(request);
  }
};
