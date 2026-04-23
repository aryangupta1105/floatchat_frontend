// Hardcoded dictionary for demo translations
const dictionary: Record<string, Record<string, string>> = {
  // Hindi Translations
  hi: {
    salinity: 'लवणता',
    temperature: 'तापमान',
    ar: 'एआर',
    simulation: 'सिमुलेशन',
    float: 'फ्लोट',
    ocean: 'महासागर',

    'Here are the latest salinity profiles from ARGO floats in the Indian Ocean. The data shows typical values ranging from 34.5 to 36.5 PSU at various depths.':
      'हिंद महासागर में एर्गो फ्लोट्स से नवीनतम लवणता प्रोफाइल यहां दी गई हैं। डेटा विभिन्न गहराइयों पर 34.5 से 36.5 पीएसयू तक के विशिष्ट मान दिखाता है।',

    'Temperature data from ARGO floats shows seasonal variations. Current surface temperatures range from 18°C to 28°C across different regions.':
      'एर्गो फ्लोट्स से तापमान डेटा मौसमी बदलाव दिखाता है। वर्तमान सतह का तापमान विभिन्न क्षेत्रों में 18°C से 28°C तक है।',

    'Launching AR simulation for ocean current visualization. This immersive view will help you understand 3D flow patterns.':
      'महासागर की धारा के दृश्य के लिए एआर सिमुलेशन शुरू किया जा रहा है। यह दृश्य आपको 3डी प्रवाह पैटर्न को समझने में मदद करेगा।',

    'Here are active ARGO floats in your area of interest. Each float provides real-time oceanographic data.':
      'यहाँ आपकी रुचि के क्षेत्र में सक्रिय एर्गो फ्लोट्स हैं। प्रत्येक फ्लोट वास्तविक समय का महासागरीय डेटा प्रदान करता है।',

    "I'm FloatChat, your AI assistant for ARGO ocean data analysis. I can help you visualize salinity profiles, temperature data, ocean currents, and provide information about ARGO floats. Try asking about \"salinity profiles\", \"temperature data\", or \"show AR simulation\".":
      'मैं फ्लोटचैट हूं, एर्गो महासागर डेटा विश्लेषण के लिए आपका एआई सहायक। मैं लवणता प्रोफाइल, तापमान डेटा, महासागर की धाराओं की कल्पना करने और एर्गो फ्लोट्स के बारे में जानकारी प्रदान करने में आपकी सहायता कर सकता हूं।'
  },

  // Spanish Translations
  es: {
    salinity: 'salinidad',
    temperature: 'temperatura',
    ar: 'ar',
    float: 'flotador',

    'Here are the latest salinity profiles from ARGO floats in the Indian Ocean. The data shows typical values ranging from 34.5 to 36.5 PSU at various depths.':
      'Aquí están los últimos perfiles de salinidad de las boyas ARGO en el Océano Índico. Los datos muestran valores típicos que oscilan entre 34.5 y 36.5 PSU.',

    'Temperature data from ARGO floats shows seasonal variations. Current surface temperatures range from 18°C to 28°C across different regions.':
      'Los datos de temperatura de las boyas ARGO muestran variaciones estacionales. Las temperaturas superficiales actuales oscilan entre 18°C y 28°C en diferentes regiones.',

    'Launching AR simulation for ocean current visualization. This immersive view will help you understand 3D flow patterns.':
      'Iniciando simulación AR para la visualización de corrientes oceánicas. Esta vista inmersiva le ayudará a entender los patrones de flujo 3D.',

    'Here are active ARGO floats in your area of interest. Each float provides real-time oceanographic data.':
      'Aquí hay boyas ARGO activas en su área de interés. Cada boya proporciona datos oceanográficos en tiempo real.',

    "I'm FloatChat, your AI assistant for ARGO ocean data analysis. I can help you visualize salinity profiles, temperature data, ocean currents, and provide information about ARGO floats. Try asking about \"salinity profiles\", \"temperature data\", or \"show AR simulation\".":
      'Soy FloatChat, su asistente de IA para el análisis de datos oceánicos ARGO. Puedo ayudarle a visualizar perfiles de salinidad, datos de temperatura y corrientes oceánicas, y a obtener información sobre las boyas ARGO.'
  },

  // French Translations
  fr: {
    salinity: 'salinité',
    temperature: 'température',
    ar: 'réalité augmentée',
    simulation: 'simulation',
    float: 'flotteur',
    ocean: 'océan',

    'Here are the latest salinity profiles from ARGO floats in the Indian Ocean. The data shows typical values ranging from 34.5 to 36.5 PSU at various depths.':
      'Voici les derniers profils de salinité des flotteurs ARGO dans l’océan Indien. Les données montrent des valeurs typiques comprises entre 34,5 et 36,5 PSU à différentes profondeurs.',

    'Temperature data from ARGO floats shows seasonal variations. Current surface temperatures range from 18°C to 28°C across different regions.':
      'Les données de température des flotteurs ARGO montrent des variations saisonnières. Les températures de surface actuelles varient entre 18°C et 28°C selon les régions.',

    'Launching AR simulation for ocean current visualization. This immersive view will help you understand 3D flow patterns.':
      'Lancement de la simulation en réalité augmentée pour la visualisation des courants océaniques. Cette vue immersive vous aidera à comprendre les motifs d’écoulement en 3D.',

    'Here are active ARGO floats in your area of interest. Each float provides real-time oceanographic data.':
      'Voici les flotteurs ARGO actifs dans votre zone d’intérêt. Chaque flotteur fournit des données océanographiques en temps réel.',

    "I'm FloatChat, your AI assistant for ARGO ocean data analysis. I can help you visualize salinity profiles, temperature data, ocean currents, and provide information about ARGO floats. Try asking about \"salinity profiles\", \"temperature data\", or \"show AR simulation\".":
      'Je suis FloatChat, votre assistant IA pour l’analyse des données océaniques ARGO. Je peux vous aider à visualiser les profils de salinité, les données de température, les courants océaniques et à obtenir des informations sur les flotteurs ARGO. Essayez de demander « profils de salinité », « données de température » ou « montre la simulation AR ».'
  },

  // Telugu Translations
  te: {
    salinity: 'ఉప్పుదనం',
    temperature: 'ఉష్ణోగ్రత',
    ar: 'ఏఆర్',
    simulation: 'అనుకరణ',
    float: 'ఫ్లోట్',
    ocean: 'సముద్రం',

    'Here are the latest salinity profiles from ARGO floats in the Indian Ocean. The data shows typical values ranging from 34.5 to 36.5 PSU at various depths.':
      'ఇండియన్ మహాసముద్రంలో ఉన్న ARGO ఫ్లోట్ల నుండి తాజా ఉప్పుదనం ప్రొఫైళ్ళు ఇవి. వివిధ లోతుల్లో ఉప్పుదనం విలువలు సాధారణంగా 34.5 నుండి 36.5 PSU మధ్యలో కనిపిస్తున్నాయి.',

    'Temperature data from ARGO floats shows seasonal variations. Current surface temperatures range from 18°C to 28°C across different regions.':
      'ARGO ఫ్లోట్ల నుండి వచ్చిన ఉష్ణోగ్రత డేటా ఋతువారీ మార్పులను చూపిస్తుంది. ప్రస్తుతం ఉపరితల ఉష్ణోగ్రతలు ప్రాంతాన్ని బట్టి 18°C నుండి 28°C వరకు ఉన్నాయి.',

    'Launching AR simulation for ocean current visualization. This immersive view will help you understand 3D flow patterns.':
      'సాగర ప్రవాహాలను చూడటానికి AR సిమ్యులేషన్ ప్రారంభించబడుతోంది. ఈ ఇమర్సివ్ వీూ 3D ప్రవాహ విధానాలను అర్థం చేసుకోవడానికి మీకు సహాయపడుతుంది.',

    'Here are active ARGO floats in your area of interest. Each float provides real-time oceanographic data.':
      'మీ ఆసక్తి ఉన్న ప్రాంతంలో ప్రస్తుతం సక్రియంగా ఉన్న ARGO ఫ్లోట్లు ఇవి. ప్రతి ఫ్లోట్ రియల్-టైమ్ సముద్ర డేటాను అందిస్తుంది.',

    "I'm FloatChat, your AI assistant for ARGO ocean data analysis. I can help you visualize salinity profiles, temperature data, ocean currents, and provide information about ARGO floats. Try asking about \"salinity profiles\", \"temperature data\", or \"show AR simulation\".":
      'నేను ఫ్లోట్‌చాట్, ARGO సముద్ర డేటా విశ్లేషణ కోసం మీ AI అసిస్టెంట్‌ను. ఉప్పుదనం ప్రొఫైళ్ళు, ఉష్ణోగ్రత డేటా, సముద్ర ప్రవాహాలను చూడటానికి మరియు ARGO ఫ్లోట్ల గురించి సమాచారం అందించేందుకు నేను మీకు సహాయం చేస్తాను. "salinity profiles", "temperature data" లేదా "show AR simulation" గురించి అడిగి చూడండి.'
  },

  // Tamil Translations
  ta: {
    salinity: 'உப்பு அளவு',
    temperature: 'வெப்பநிலை',
    ar: 'ஏஆர்',
    simulation: 'ஒத்திகை',
    float: 'மிதவை',
    ocean: 'கடல்',

    'Here are the latest salinity profiles from ARGO floats in the Indian Ocean. The data shows typical values ranging from 34.5 to 36.5 PSU at various depths.':
      'இந்தியப் பெருங்கடலில் உள்ள ARGO மிதவைகளில் இருந்து பெறப்பட்ட சமீபத்திய உப்பு அளவு சுயவிவரங்கள் இவை. பல்வேறு ஆழங்களில் உப்பு அளவு பொதுவாக 34.5 முதல் 36.5 PSU வரை காணப்படுகிறது.',

    'Temperature data from ARGO floats shows seasonal variations. Current surface temperatures range from 18°C to 28°C across different regions.':
      'ARGO மிதவைகளின் வெப்பநிலை தரவு காலநிலை அடிப்படையிலான மாற்றங்களை காட்டுகிறது. தற்போது மேற்பரப்பு வெப்பநிலை பல பகுதிகளில் 18°C முதல் 28°C வரை மாறுபடுகிறது.',

    'Launching AR simulation for ocean current visualization. This immersive view will help you understand 3D flow patterns.':
      'கடல் நீர் ஓட்டத்தை காண்பிக்கும் AR ஒத்திகை இப்போது தொடங்கப்படுகிறது. இந்த ஆழமான காட்சி 3D ஓட்ட வடிவங்களை நீங்கள் எளிதாக புரிந்து கொள்ள உதவும்.',

    'Here are active ARGO floats in your area of interest. Each float provides real-time oceanographic data.':
      'உங்கள் ஆர்வப் பகுதியில் செயல்பாட்டில் உள்ள ARGO மிதவைகள் இங்கே காட்டப்பட்டுள்ளன. ஒவ்வொரு மிதவையும் நேரடி கடல் தரவுகளை வழங்குகிறது.',

    "I'm FloatChat, your AI assistant for ARGO ocean data analysis. I can help you visualize salinity profiles, temperature data, ocean currents, and provide information about ARGO floats. Try asking about \"salinity profiles\", \"temperature data\", or \"show AR simulation\".":
      'நான் FloatChat, ARGO கடல் தரவு பகுப்பாய்வுக்கான உங்கள் செயற்கை நுண்ணறிவு உதவியாளர். உப்பு அளவு சுயவிவரங்கள், வெப்பநிலைத் தரவு, கடல் நீர் ஓட்டங்கள் மற்றும் ARGO மிதவைகள் பற்றிய தகவல்களை காண்பிப்பதில் நான் உதவலாம். "salinity profiles", "temperature data" அல்லது "show AR simulation" என்று கேட்டு முயற்சி செய்யுங்கள்.'
  },

  // Mandarin Chinese Translations
  zh: {
    salinity: '盐度',
    temperature: '温度',
    ar: '增强现实',
    simulation: '模拟',
    float: '浮标',
    ocean: '海洋',

    'Here are the latest salinity profiles from ARGO floats in the Indian Ocean. The data shows typical values ranging from 34.5 to 36.5 PSU at various depths.':
      '这里是印度洋 ARGO 浮标最新的盐度剖面。数据表明，在不同深度，盐度典型取值大约在 34.5 到 36.5 PSU 之间。',

    'Temperature data from ARGO floats shows seasonal variations. Current surface temperatures range from 18°C to 28°C across different regions.':
      'ARGO 浮标的温度数据呈现出明显的季节性变化。目前不同海区的海表温度大约在 18°C 到 28°C 之间。',

    'Launching AR simulation for ocean current visualization. This immersive view will help you understand 3D flow patterns.':
      '正在启动用于海流可视化的增强现实模拟。这个沉浸式视图将帮助你理解三维流动结构。',

    'Here are active ARGO floats in your area of interest. Each float provides real-time oceanographic data.':
      '这是你关注海域中当前活动的 ARGO 浮标列表。每一个浮标都会提供实时的海洋观测数据。',

    "I'm FloatChat, your AI assistant for ARGO ocean data analysis. I can help you visualize salinity profiles, temperature data, ocean currents, and provide information about ARGO floats. Try asking about \"salinity profiles\", \"temperature data\", or \"show AR simulation\".":
      '我是 FloatChat，你的 ARGO 海洋数据分析智能助手。我可以帮助你查看盐度剖面、温度数据、海流情况，并提供 ARGO 浮标的相关信息。可以尝试询问“盐度剖面”、“温度数据”或“显示 AR 模拟”等问题。'
  },

  // Arabic Translations
  ar: {
    salinity: 'الملوحة',
    temperature: 'درجة الحرارة',
    ar: 'الواقع المعزز',
    simulation: 'محاكاة',
    float: 'عوامة',
    ocean: 'المحيط',

    'Here are the latest salinity profiles from ARGO floats in the Indian Ocean. The data shows typical values ranging from 34.5 to 36.5 PSU at various depths.':
      'هذه هي أحدث ملفات الملوحة من عوامات ARGO في المحيط الهندي. تُظهر البيانات قيماً نموذجية تتراوح بين 34.5 و 36.5 وحدة PSU على أعماق مختلفة.',

    'Temperature data from ARGO floats shows seasonal variations. Current surface temperatures range from 18°C to 28°C across different regions.':
      'بيانات درجة الحرارة من عوامات ARGO تُظهر تغيرات موسمية. تتراوح درجات حرارة السطح الحالية بين 18° و 28° مئوية في مناطق مختلفة.',

    'Launching AR simulation for ocean current visualization. This immersive view will help you understand 3D flow patterns.':
      'يتم الآن تشغيل محاكاة بالواقع المعزز لعرض تيارات المحيط. هذا العرض التفاعلي سيساعدك على فهم أنماط الجريان ثلاثية الأبعاد.',

    'Here are active ARGO floats in your area of interest. Each float provides real-time oceanographic data.':
      'هذه هي عوامات ARGO النشطة في منطقة اهتمامك، ويقوم كل عوامة بتوفير بيانات محيطية آنية (لحظية).',

    "I'm FloatChat, your AI assistant for ARGO ocean data analysis. I can help you visualize salinity profiles, temperature data, ocean currents, and provide information about ARGO floats. Try asking about \"salinity profiles\", \"temperature data\", or \"show AR simulation\".":
      'أنا FloatChat، مساعدك الذكي لتحليل بيانات المحيط من برنامج ARGO. يمكنني مساعدتك في عرض ملفات الملوحة، وبيانات درجة الحرارة، وتيارات المحيط، وتزويدك بمعلومات عن عوامات ARGO. جرّب أن تسأل عن "salinity profiles" أو "temperature data" أو "show AR simulation".'
  }
};

//
// UPDATED: INPUT → English keyword / query
//
export const translateToEnglish = async (
  text: string,
  fromLang: string
): Promise<string> => {
  if (fromLang === 'en') return text;

  const lowerText = text.toLowerCase();

  // ---------- Hindi ----------
  if (fromLang === 'hi') {
    if (lowerText.includes('लवण') || lowerText.includes('नमक')) return 'salinity profiles';
    if (lowerText.includes('तापमान')) return 'temperature data';
    if (lowerText.includes('एआर') || lowerText.includes('सिमुलेशन')) return 'ar simulation';
    if (lowerText.includes('फ्लोट')) return 'argo floats';

    if (lowerText.includes('महासागर') || lowerText.includes('समुद्र')) {
      return 'salinity profiles in the Indian Ocean';
    }
    return text;
  }

  // ---------- Spanish ----------
  if (fromLang === 'es') {
    if (lowerText.includes('salinidad')) return 'salinity profiles';
    if (lowerText.includes('temperatura')) return 'temperature data';
    if (lowerText.includes('simulación') || lowerText.includes(' ar ')) return 'ar simulation';
    if (lowerText.includes('flotador') || lowerText.includes('boya')) return 'argo floats';

    if (lowerText.includes('océano') || lowerText.includes('mar')) {
      return 'salinity profiles in the ocean';
    }
    return text;
  }

  // ---------- Telugu ----------
  if (fromLang === 'te') {
    if (
      text.includes('ఉప్పు') ||
      text.includes('ఉప్పుదనం') ||
      text.includes('లవణీయత') ||
      text.includes('లవణత')
    ) {
      return 'salinity profiles';
    }
    if (text.includes('ఉష్ణోగ్రత')) return 'temperature data';
    if (text.includes('ఏఆర్') || text.includes('అనుకరణ')) return 'ar simulation';
    if (text.includes('ఫ్లోట్') || text.includes('ఫ్లోట్లు')) return 'argo floats';

    if (text.includes('సముద్ర') || text.includes('మహాసముద్ర')) {
      return 'salinity profiles in the Indian Ocean';
    }
    return text;
  }

  // ---------- Tamil ----------
  if (fromLang === 'ta') {
    if (text.includes('உப்பு') || text.includes('உப்பு அளவு')) return 'salinity profiles';
    if (text.includes('வெப்பநிலை')) return 'temperature data';
    if (text.includes('ஏஆர்') || text.includes('ஒத்திகை')) return 'ar simulation';
    if (text.includes('மிதவை') || text.includes('மிதவைகள்')) return 'argo floats';

    if (text.includes('கடல்') || text.includes('பெருங்கடல்')) {
      return 'salinity profiles in the Indian Ocean';
    }
    return text;
  }

  // ---------- French ----------
  if (fromLang === 'fr') {
    if (lowerText.includes('salinité')) return 'salinity profiles';
    if (lowerText.includes('température')) return 'temperature data';
    if (lowerText.includes('réalité augmentée') || lowerText.includes('simulation')) {
      return 'ar simulation';
    }
    if (lowerText.includes('flotteur') || lowerText.includes('bouée')) return 'argo floats';

    if (lowerText.includes('océan') || lowerText.includes('mer')) {
      return 'salinity profiles in the ocean';
    }
    return text;
  }

  // ---------- Mandarin Chinese ----------
  if (fromLang === 'zh') {
    if (text.includes('盐度') || text.includes('盐 ')) return 'salinity profiles';
    if (text.includes('温度')) return 'temperature data';
    if (text.includes('增强现实') || text.includes('模拟')) return 'ar simulation';
    if (text.includes('浮标') || text.includes('漂流浮标')) return 'argo floats';

    if (text.includes('海洋') || text.includes('大海') || text.includes('海域')) {
      return 'salinity profiles in the ocean';
    }
    return text;
  }

  // ---------- Arabic ----------
  if (fromLang === 'ar') {
    if (text.includes('الملوحة')) return 'salinity profiles';
    if (text.includes('درجة الحرارة') || text.includes('الحرارة')) return 'temperature data';
    if (text.includes('الواقع المعزز') || text.includes('محاكاة')) return 'ar simulation';
    if (text.includes('عوامة') || text.includes('عوّامة') || text.includes('عوامات')) {
      return 'argo floats';
    }

    if (text.includes('المحيط') || text.includes('البحر')) {
      return 'salinity profiles in the ocean';
    }
    return text;
  }

  // Fallback for any other language
  return text;
};

//
// OUTPUT: English backend response -> user language
//
export const translateToUserLang = async (
  text: string,
  toLang: string
): Promise<string> => {
  if (toLang === 'en') return text;

  const langDict = dictionary[toLang];
  if (langDict && langDict[text]) {
    return langDict[text];
  }

  // Fallback tag for unknown sentences
  if (toLang === 'hi') return '[अनुवादित] ' + text;
  if (toLang === 'es') return '[Traducido] ' + text;
  if (toLang === 'fr') return '[Traduit en français] ' + text;
  if (toLang === 'te') return '[తెలుగు అనువాదం] ' + text;
  if (toLang === 'ta') return '[தமிழ் மொழிபெயர்ப்பு] ' + text;
  if (toLang === 'zh') return '【已翻译】' + text;
  if (toLang === 'ar') return '【ترجمة】 ' + text;

  return text;
};
