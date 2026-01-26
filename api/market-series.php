<?php
/**
 * Market Series API - Stooq Historical Data & TCMB EVDS Inflation Data
 * Endpoint: /api/market-series.php?asset=gold|usd|eur|bist100|nasdaq100|inflation_tr
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Asset to Stooq symbol mapping
// Note: Index symbols use ^ prefix which must be URL encoded
$STOOQ_SYMBOLS = [
    'gold' => 'xautry',
    'usd' => 'usdtry',
    'eur' => 'eurtry',
    'bist100' => '%5Exu100',   // ^xu100 URL encoded
    'nasdaq100' => '%5Endx',    // ^ndx URL encoded
];

$CACHE_DIR = __DIR__ . '/cache';
$STOOQ_CACHE_DURATION = 30 * 60; // 30 minutes
$EVDS_CACHE_DURATION = 12 * 60 * 60; // 12 hours (inflation updates monthly)

// Get asset parameter
$asset = isset($_GET['asset']) ? strtolower(trim($_GET['asset'])) : '';

$validAssets = array_merge(array_keys($STOOQ_SYMBOLS), ['inflation_tr']);

if (empty($asset) || !in_array($asset, $validAssets)) {
    http_response_code(400);
    echo json_encode([
        'error' => 'Invalid asset. Valid: gold, usd, eur, bist100, nasdaq100, inflation_tr'
    ]);
    exit;
}

// Ensure cache directory exists
if (!is_dir($CACHE_DIR)) {
    mkdir($CACHE_DIR, 0755, true);
}

$cacheFile = $CACHE_DIR . '/market-series-' . $asset . '.json';
$cacheDuration = ($asset === 'inflation_tr') ? $EVDS_CACHE_DURATION : $STOOQ_CACHE_DURATION;

// Check cache
if (file_exists($cacheFile)) {
    $cacheAge = time() - filemtime($cacheFile);
    if ($cacheAge < $cacheDuration) {
        // Return cached data
        echo file_get_contents($cacheFile);
        exit;
    }
}

// Fetch data based on asset type
if ($asset === 'inflation_tr') {
    $result = fetchInflationData($cacheFile);
} else {
    $result = fetchStooqData($asset, $STOOQ_SYMBOLS[$asset], $cacheFile);
}

echo $result;
exit;

/**
 * Fetch data from Stooq
 */
function fetchStooqData($asset, $symbol, $cacheFile) {
    $url = "https://stooq.com/q/d/l/?s={$symbol}&i=d";
    
    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'header' => "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36\r\n",
            'timeout' => 30,
        ]
    ]);
    
    $csv = @file_get_contents($url, false, $context);
    
    if ($csv === false) {
        // Try to return stale cache
        if (file_exists($cacheFile)) {
            return file_get_contents($cacheFile);
        }
        
        http_response_code(502);
        return json_encode(['error' => 'Failed to fetch data from Stooq']);
    }
    
    // Parse CSV
    $lines = explode("\n", trim($csv));
    $points = [];
    
    // Skip header line
    for ($i = 1; $i < count($lines); $i++) {
        $parts = str_getcsv($lines[$i]);
        if (count($parts) >= 5) {
            $date = $parts[0];
            $close = floatval($parts[4]);
            
            if (!empty($date) && $close > 0) {
                $points[] = [
                    'date' => $date,
                    'value' => $close
                ];
            }
        }
    }
    
    // Sort by date ascending
    usort($points, function($a, $b) {
        return strcmp($a['date'], $b['date']);
    });
    
    // Keep last 3 years (~1095 days)
    $points = array_slice($points, -1095);
    
    $response = [
        'asset' => $asset,
        'updatedAt' => date('c'),
        'points' => array_values($points),
        'source' => 'Stooq'
    ];
    
    $json = json_encode($response, JSON_UNESCAPED_UNICODE);
    
    // Save to cache
    file_put_contents($cacheFile, $json);
    
    return $json;
}

/**
 * Fetch TÜFE (CPI) inflation data from TCMB EVDS
 */
function fetchInflationData($cacheFile) {
    // EVDS API key should be set as environment variable or in a config file
    $apiKey = getenv('EVDS_API_KEY');
    
    if (empty($apiKey)) {
        // Try to read from a config file
        $configFile = __DIR__ . '/.evds_config.php';
        if (file_exists($configFile)) {
            include $configFile;
            $apiKey = $EVDS_API_KEY ?? '';
        }
    }
    
    if (empty($apiKey)) {
        // Return stale cache if available
        if (file_exists($cacheFile)) {
            return file_get_contents($cacheFile);
        }
        
        http_response_code(500);
        return json_encode(['error' => 'EVDS_API_KEY not configured']);
    }
    
    // Get last 3 years of data
    $endDate = date('d-m-Y');
    $startDate = date('d-m-Y', strtotime('-3 years'));
    
    // EVDS Series: TP.FG.J0 = TÜFE Yıllık % Değişim
    $url = "https://evds2.tcmb.gov.tr/service/evds/series=TP.FG.J0&startDate={$startDate}&endDate={$endDate}&type=json&key={$apiKey}";
    
    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'header' => "Accept: application/json\r\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36\r\n",
            'timeout' => 30,
        ]
    ]);
    
    $response = @file_get_contents($url, false, $context);
    
    if ($response === false) {
        // Try to return stale cache
        if (file_exists($cacheFile)) {
            return file_get_contents($cacheFile);
        }
        
        http_response_code(502);
        return json_encode(['error' => 'Failed to fetch data from TCMB EVDS']);
    }
    
    $data = json_decode($response, true);
    
    if (!isset($data['items']) || !is_array($data['items'])) {
        // Try to return stale cache
        if (file_exists($cacheFile)) {
            return file_get_contents($cacheFile);
        }
        
        http_response_code(502);
        return json_encode(['error' => 'EVDS returned unexpected format']);
    }
    
    $points = [];
    
    foreach ($data['items'] as $item) {
        // EVDS returns date as "DD-MM-YYYY" and value in "TP_FG_J0" field
        $dateStr = $item['Tarih'] ?? '';
        $value = isset($item['TP_FG_J0']) ? floatval($item['TP_FG_J0']) : null;
        
        if (!empty($dateStr) && $value !== null) {
            // Convert DD-MM-YYYY to YYYY-MM-DD
            $dateParts = explode('-', $dateStr);
            if (count($dateParts) === 3) {
                $isoDate = "{$dateParts[2]}-{$dateParts[1]}-{$dateParts[0]}";
                $points[] = [
                    'date' => $isoDate,
                    'value' => $value
                ];
            }
        }
    }
    
    // Sort by date ascending
    usort($points, function($a, $b) {
        return strcmp($a['date'], $b['date']);
    });
    
    $responseData = [
        'asset' => 'inflation_tr',
        'updatedAt' => date('c'),
        'points' => array_values($points),
        'source' => 'TCMB EVDS'
    ];
    
    $json = json_encode($responseData, JSON_UNESCAPED_UNICODE);
    
    // Save to cache
    file_put_contents($cacheFile, $json);
    
    return $json;
}
